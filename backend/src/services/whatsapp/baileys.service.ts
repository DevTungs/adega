import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  WASocket,
  proto,
  generateWAMessageFromContent,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { logger } from '../../shared/middlewares/logger';
import { whatsappHandler } from '../../modules/whatsapp/whatsapp.handler';
import { emitWAQR, emitWAStatus, emitWAMessage } from '../websocket/ws.server';

const SESSION_PATH = path.resolve(__dirname, '../../../../', process.env.WA_SESSION_PATH || './data/sessions');

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
  private maxReconnect = parseInt(process.env.WA_MAX_RECONNECT || '10');
  private botActive = true;
  private lastConnectTime = 0;
  private quickDisconnectCount = 0;
  private connectionGeneration = 0;  // Track connection generations to ignore stale events
  private messages: Map<string, WAMessage[]> = new Map();
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

  getConversations(): Array<{ phone: string; lastMessage: string; lastTime: string; unread: number }> {
    const conversations: Array<{ phone: string; lastMessage: string; lastTime: string; unread: number }> = [];
    for (const [phone, msgs] of this.messages.entries()) {
      if (msgs.length === 0) continue;
      const lastMsg = msgs[msgs.length - 1];
      conversations.push({
        phone,
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
    // Keep last 100 messages per conversation
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
        // Connection lost again, re-queue remaining
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
      await new Promise(r => setTimeout(r, 500)); // Delay between sends
    }
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.info('Already connected or connecting');
      return;
    }

    // Ensure session directory exists
    if (!fs.existsSync(SESSION_PATH)) {
      fs.mkdirSync(SESSION_PATH, { recursive: true });
    }

    // Increment generation to ignore events from old sockets
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

      // Handle QR code
      this.sock.ev.on('connection.update', async (update) => {
        // Ignore events from old socket generations
        if (generation !== this.connectionGeneration) {
          logger.debug({ generation, current: this.connectionGeneration }, 'Ignoring stale event from old socket');
          return;
        }

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Ignore QR events if already connected (Baileys sometimes emits spurious QR events)
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

          // Track quick disconnects (connect -> disconnect within 30s)
          if (connectedDuration < 30000 && this.lastConnectTime > 0) {
            this.quickDisconnectCount++;
            logger.warn({ quickDisconnectCount: this.quickDisconnectCount, connectedDuration }, 'Quick disconnect detected');
          } else {
            this.quickDisconnectCount = 0;
          }

          logger.info({ statusCode, shouldReconnect }, 'Connection closed');

          // Break the loop: session is corrupted after 3 quick disconnects
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
            // Properly close old socket before reconnecting
            if (this.sock) {
              this.sock.end(undefined);
              this.sock = null;
            }
            this.state = 'disconnected';
            emitWAStatus('connecting');
            // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
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
          // Re-send any messages that failed during disconnect
          this.flushPendingMessages();
        }
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Ignore events from old socket generations
        if (generation !== this.connectionGeneration) return;

        if (type !== 'notify') return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue;

          const remoteJid = msg.key.remoteJid || '';
          if (!remoteJid) continue;

          // Skip group messages - multiple checks
          if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) {
            logger.debug({ remoteJid }, 'Skipping group/broadcast message');
            continue;
          }
          // Also skip if message has participant (group indicator)
          if (msg.key.participant) {
            logger.debug({ remoteJid, participant: msg.key.participant }, 'Skipping group message (has participant)');
            continue;
          }

          const messageText = this.extractMessageText(msg);
          if (!messageText) continue;

          // Extract real phone number - handle @lid (linked device) format
          let phone = remoteJid;
          const whatsappJid = remoteJid; // Keep original JID for sending messages
          if (remoteJid.endsWith('@lid')) {
            // Try to get real phone from message metadata
            const senderPn = (msg as any).senderPn || (msg as any).messageContextInfo?.senderPn;
            if (senderPn) {
              phone = senderPn.replace('@s.whatsapp.net', '');
            }
            // If still @lid, try participant field
            if (phone.endsWith('@lid') && msg.key.participant) {
              phone = msg.key.participant.replace('@s.whatsapp.net', '');
            }
          }

          const senderName = msg.pushName || '';

          logger.debug({ remoteJid, phone, whatsappJid, message: messageText, senderName }, 'WhatsApp message received');
          this.storeMessage(phone, messageText, 'in');
          emitWAMessage(phone, messageText, 'in');

          try {
            if (this.botActive) {
              const response = await whatsappHandler.handleMessage(phone, messageText, senderName, whatsappJid);
              if (response) {
                const isObj = typeof response === 'object';
                const delay = isObj ? 500 : Math.min(300 + (response as string).length * 5, 2500);
                await new Promise(r => setTimeout(r, delay));
                await this.sendMessage(phone, response);
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

  async sendMessage(phone: string, message: string | object): Promise<boolean> {
    const isInteractive = typeof message === 'object';
    const textSummary = isInteractive ? '[Mensagem interativa]' : message;

    // Wait for connection if currently reconnecting (max 5s)
    for (let i = 0; i < 5; i++) {
      if (this.sock && this.state === 'connected') break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!this.sock || this.state !== 'connected') {
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      this.pendingMessages.push({ phone, message: textSummary, jid, attempts: 1 });
      return false;
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (isInteractive) {
          // Interactive messages (listMessage, interactiveMessage) need generateWAMessageFromContent
          const userJid = this.sock.user?.id || '';
          const fullMsg = generateWAMessageFromContent(jid, message as proto.IMessage, {
            userJid,
          } as any);
          await this.sock.relayMessage(jid, fullMsg.message as proto.IMessage, { messageId: fullMsg.key.id as string });
        } else {
          await this.sock.sendMessage(jid, { text: message as string });
        }
        this.storeMessage(phone, textSummary, 'out');
        emitWAMessage(phone, textSummary, 'out');
        return true;
      } catch (err: any) {
        logger.error({ error: err.message, phone, attempt }, '[MSG] Failed to send');

        if (attempt === 1) {
          for (let i = 0; i < 3; i++) {
            if (this.sock && this.state === 'connected') break;
            await new Promise(r => setTimeout(r, 1000));
          }
          if (!this.sock || this.state !== 'connected') {
            this.pendingMessages.push({ phone, message: textSummary, jid, attempts: 1 });
            return false;
          }
        }
      }
    }

    this.pendingMessages.push({ phone, message: textSummary, jid, attempts: 1 });
    return false;
  }

  async sendButtons(phone: string, contentText: string, buttons: Array<{ id: string; text: string }>): Promise<boolean> {
    const msg = {
      interactiveMessage: {
        body: { text: contentText },
        nativeFlowMessage: {
          buttons: buttons.map(b => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id }),
          })),
        },
      },
    };
    return this.sendMessage(phone, msg);
  }

  async sendList(phone: string, title: string, description: string, buttonText: string, sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>): Promise<boolean> {
    const msg = {
      listMessage: {
        title,
        description,
        buttonText,
        listType: 2,
        sections: sections.map(s => ({
          title: s.title,
          rows: s.rows.map(r => ({
            rowId: r.id,
            title: r.title,
            description: r.description || '',
          })),
        })),
      },
    };
    return this.sendMessage(phone, msg);
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

    return null;
  }
}

export const baileysService = new BaileysService();
