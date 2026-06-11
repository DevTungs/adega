import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { logger } from '../../shared/middlewares/logger';
import { config } from '../../config/app.config';
import { whatsappHandler } from '../../modules/whatsapp/whatsapp.handler';
import { emitWAQR, emitWAStatus, emitWAMessage } from '../websocket/ws.server';
import { customersModel } from '../../modules/customers/customers.model';

const SESSION_PATH = path.resolve(__dirname, '../../../../', config.waSessionPath);

export type WAConnectionState = 'disconnected' | 'connecting' | 'connected' | 'qr_pending';

export interface WAMessage {
  phone: string;
  message: string;
  direction: 'in' | 'out';
  time: string;
}

interface PendingMessage {
  phone: string;
  message: string;
  jid: string;
  attempts: number;
}

class BaileysService {
  private sock: WASocket | null = null;
  private state: WAConnectionState = 'disconnected';
  private qrCode: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnect = config.waMaxReconnect;
  private botActive = true;
  private lastConnectTime = 0;
  private quickDisconnectCount = 0;
  private connectionGeneration = 0;
  private messages: Map<string, WAMessage[]> = new Map();
  private contactNames: Map<string, string> = new Map();
  private jidMap: Map<string, string> = new Map();
  private pendingMessages: PendingMessage[] = [];

  getState(): WAConnectionState {
    return this.state;
  }

  getQR(): string | null {
    return this.qrCode;
  }

  isBotActive(): boolean {
    return this.botActive;
  }

  setBotActive(active: boolean) {
    this.botActive = active;
    logger.info({ active }, 'Bot active state changed');
  }

  getConversations(): Array<{ phone: string; name: string | null; lastMessage: string; lastTime: string; unread: number }> {
    const conversations: Array<{ phone: string; name: string | null; lastMessage: string; lastTime: string; unread: number }> = [];
    for (const [phone, msgs] of this.messages.entries()) {
      if (msgs.length === 0) continue;
      const lastMsg = msgs[msgs.length - 1];
      let name = this.contactNames.get(phone) || null;
      if (!name) {
        const customer = customersModel.findByPhone(phone);
        if (customer?.name) {
          name = customer.name;
          this.contactNames.set(phone, name);
        }
      }
      conversations.push({
        phone,
        name,
        lastMessage: lastMsg.message,
        lastTime: lastMsg.time,
        unread: 0,
      });
    }
    return conversations.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
  }

  getMessages(phone: string): WAMessage[] {
    return this.messages.get(phone) || [];
  }

  private storeMessage(phone: string, message: string, direction: 'in' | 'out') {
    if (!this.messages.has(phone)) {
      this.messages.set(phone, []);
    }
    this.messages.get(phone)!.push({
      phone,
      message,
      direction,
      time: new Date().toISOString(),
    });
    const msgs = this.messages.get(phone)!;
    if (msgs.length > 100) {
      this.messages.set(phone, msgs.slice(-100));
    }
  }

  private clearSession() {
    try {
      if (fs.existsSync(SESSION_PATH)) {
        const files = fs.readdirSync(SESSION_PATH);
        for (const file of files) {
          fs.unlinkSync(path.join(SESSION_PATH, file));
        }
        logger.info({ files: files.length }, 'Session files cleared');
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to clear session files');
    }
  }

  private async flushPendingMessages() {
    if (this.pendingMessages.length === 0) return;
    logger.info({ count: this.pendingMessages.length }, '[MSG] Flushing pending messages');
    const queue = [...this.pendingMessages];
    this.pendingMessages = [];
    for (const pending of queue) {
      if (!this.sock || this.state !== 'connected') {
        this.pendingMessages.push(...queue.slice(queue.indexOf(pending)));
        break;
      }
      try {
        await this.sock.sendMessage(pending.jid, { text: pending.message });
        this.storeMessage(pending.phone, pending.message, 'out');
        emitWAMessage(pending.phone, pending.message, 'out');
        logger.info({ phone: pending.phone }, '[MSG] Pending message sent');
      } catch (err: any) {
        pending.attempts++;
        if (pending.attempts < 3) {
          this.pendingMessages.push(pending);
          logger.warn({ phone: pending.phone, attempts: pending.attempts }, '[MSG] Pending send failed, re-queuing');
        } else {
          logger.warn({ phone: pending.phone }, '[MSG] Pending send failed after 3 attempts, discarding');
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.info('Already connected or connecting');
      return;
    }

    if (!fs.existsSync(SESSION_PATH)) {
      fs.mkdirSync(SESSION_PATH, { recursive: true });
    }

    const generation = ++this.connectionGeneration;

    this.state = 'connecting';
    this.reconnectAttempts = 0;
    emitWAStatus('connecting');
    logger.info({ sessionPath: SESSION_PATH }, 'Connecting to WhatsApp...');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.windows('Chrome'),
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
        markOnlineOnConnect: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 250,
        generateHighQualityLinkPreview: false,
      });

      this.sock.ev.on('connection.update', async (update) => {
        if (generation !== this.connectionGeneration) {
          logger.debug({ generation, current: this.connectionGeneration }, 'Ignoring stale event from old socket');
          return;
        }

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          if (this.state === 'connected') {
            logger.debug('Ignoring QR event - already connected');
            return;
          }
          this.qrCode = qr;
          this.state = 'qr_pending';
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
            emitWAQR(qrDataUrl);
            emitWAStatus('qr_pending');
            logger.info('QR code generated - scan with WhatsApp');
          } catch (e) {
            logger.error('Failed to generate QR data URL');
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          const connectedDuration = Date.now() - this.lastConnectTime;

          if (connectedDuration < 30000 && this.lastConnectTime > 0) {
            this.quickDisconnectCount++;
            logger.warn({ quickDisconnectCount: this.quickDisconnectCount, connectedDuration }, 'Quick disconnect detected');
          } else {
            this.quickDisconnectCount = 0;
          }

          logger.info({ statusCode, shouldReconnect }, 'Connection closed');

          if (this.quickDisconnectCount >= 3) {
            logger.error('Session corrupted - clearing session, scan QR again');
            this.clearSession();
            this.state = 'disconnected';
            this.qrCode = null;
            this.quickDisconnectCount = 0;
            emitWAStatus('disconnected');
            return;
          }

          if (statusCode === 405) {
            this.state = 'disconnected';
            this.qrCode = null;
            emitWAStatus('disconnected');
            logger.info('Connection rejected by WhatsApp - try again');
            return;
          }

          if (shouldReconnect && this.reconnectAttempts < this.maxReconnect) {
            this.reconnectAttempts++;
            if (this.sock) {
              this.sock.end(undefined);
              this.sock = null;
            }
            this.state = 'disconnected';
            emitWAStatus('connecting');
            const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            logger.info({ attempt: this.reconnectAttempts, delay }, 'Reconnecting...');
            setTimeout(() => this.connect(), delay);
          } else {
            this.state = 'disconnected';
            this.qrCode = null;
            emitWAStatus('disconnected');
            logger.info('Disconnected');
          }
        }

        if (connection === 'open') {
          this.state = 'connected';
          this.qrCode = null;
          this.reconnectAttempts = 0;
          this.lastConnectTime = Date.now();
          emitWAStatus('connected');
          logger.info('WhatsApp connected!');
          this.flushPendingMessages();
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (generation !== this.connectionGeneration) return;
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue;

          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid) continue;

          if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) {
            logger.debug({ remoteJid }, 'Skipping group/broadcast message');
            continue;
          }
          if (msg.key.participant) {
            logger.debug({ remoteJid, participant: msg.key.participant }, 'Skipping group message (has participant)');
            continue;
          }

          const messageText = this.extractMessageText(msg);
          logger.info({ remoteJid, messageText, msgType: Object.keys(msg.message || {}).join(',') }, 'RAW message');
          if (!messageText) continue;

          let phone = remoteJid;
          const whatsappJid = remoteJid;
          if (remoteJid.endsWith('@lid')) {
            const senderPn = (msg as any).senderPn || (msg as any).messageContextInfo?.senderPn;
            if (senderPn) {
              phone = senderPn.replace('@s.whatsapp.net', '');
            } else if (msg.key.participant) {
              phone = msg.key.participant.replace('@s.whatsapp.net', '');
              if (phone.endsWith('@lid')) {
                phone = phone.replace(':.*@lid|@lid', '');
              }
            }
          }

          this.jidMap.set(phone, whatsappJid);

          const senderName = msg.pushName || '';

          logger.info({ remoteJid, phone, whatsappJid, message: messageText, senderName, msgType: Object.keys(msg.message || {}).join(',') }, 'WhatsApp message received');
          this.storeMessage(phone, messageText, 'in');
          const customer = customersModel.findByPhone(phone);
          const displayName = customer?.name || senderName;
          if (displayName) {
            this.contactNames.set(phone, displayName);
          }
          emitWAMessage(phone, messageText, 'in', displayName);

          try {
            if (this.botActive) {
              const response = await whatsappHandler.handleMessage(phone, messageText, senderName, whatsappJid);
              if (response) {
                const isObj = typeof response === 'object';
                const delay = isObj ? 500 : Math.min(300 + (response as string).length * 5, 2500);
                await new Promise(r => setTimeout(r, delay));
                if (isObj) {
                  const r = response as any;
                  if (r._type === 'buttons') {
                    await this.sendButtons(phone, r.text, r.buttons);
                  } else if (r._type === 'list') {
                    await this.sendList(phone, r.title, r.description, r.buttonText, r.sections);
                  }
                } else {
                  await this.sendMessage(phone, response);
                }
              }
            }
          } catch (err: any) {
            logger.error({ error: err.message, stack: err.stack, phone }, 'Error handling message');
          }
        }
      });

    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to connect');
      this.state = 'disconnected';
      emitWAStatus('disconnected');
    }
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
    }
    this.state = 'disconnected';
    this.qrCode = null;
    this.pendingMessages = [];
    emitWAStatus('disconnected');
    logger.info('WhatsApp disconnected');
  }

  async sendMessage(phone: string, message: string): Promise<boolean> {
    for (let i = 0; i < 5; i++) {
      if (this.sock && this.state === 'connected') break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!this.sock || this.state !== 'connected') {
      const jid = this.jidMap.get(phone) || (phone.includes('@') ? phone : `${phone}@s.whatsapp.net`);
      this.pendingMessages.push({ phone, message, jid, attempts: 1 });
      return false;
    }

    const jid = this.jidMap.get(phone) || (phone.includes('@') ? phone : `${phone}@s.whatsapp.net`);

        for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.sock.sendMessage(jid, { text: message });
        this.storeMessage(phone, message, 'out');
        emitWAMessage(phone, message, 'out');
        return true;
      } catch (err: any) {
        logger.error({ error: err.message, phone, attempt, jid }, '[MSG] Failed to send');

        if (attempt === 1) {
          for (let i = 0; i < 3; i++) {
            if (this.sock && this.state === 'connected') break;
            await new Promise(r => setTimeout(r, 1000));
          }
          if (!this.sock || this.state !== 'connected') {
            this.pendingMessages.push({ phone, message, jid, attempts: 1 });
            return false;
          }
        }
      }
    }

    this.pendingMessages.push({ phone, message, jid, attempts: 1 });
    return false;
  }

  async sendButtons(phone: string, contentText: string, buttons: Array<{ id: string; text: string }>): Promise<boolean> {
    const lines = buttons.map(b => b.text);
    const text = `${contentText}\n\n${lines.join('\n')}\n\n_Responda com sua escolha._`;
    return this.sendMessage(phone, text);
  }

  async sendList(phone: string, title: string, description: string, buttonText: string, sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>): Promise<boolean> {
    const lines: string[] = [];
    for (const section of sections) {
      lines.push(`\n*${section.title}*`);
      for (const row of section.rows) {
        const desc = row.description ? ` - ${row.description}` : '';
        lines.push(`• ${row.title}${desc}`);
      }
    }
    const text = `${description}\n${lines.join('\n')}\n\nDigite o nome da opção desejada.`;
    return this.sendMessage(phone, text);
  }

  private extractMessageText(msg: proto.IWebMessageInfo): string | null {
    const m = msg.message;
    if (!m) return null;

    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId;
    if (m.listResponseMessage?.singleSelectReply?.selectedRowId) return m.listResponseMessage.singleSelectReply.selectedRowId;
    if (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
      try {
        const params = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
        return params.id || params.display_text || m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson;
      } catch {
        return m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson;
      }
    }
    if (m.interactiveResponseMessage?.body?.text) return m.interactiveResponseMessage.body.text;

    return null;
  }
}

export const baileysService = new BaileysService();
