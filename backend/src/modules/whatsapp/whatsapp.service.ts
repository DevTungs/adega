import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { WhatsAppSession } from '../../shared/types';

export type SessionState =
  | 'idle'
  | 'awaiting_items'
  | 'awaiting_confirmation'
  | 'awaiting_cancel'
  | 'awaiting_name'
  | 'awaiting_address'
  | 'awaiting_payment'
  | 'awaiting_notes'
  | 'awaiting_variant'
  | 'awaiting_modifier'
  | 'awaiting_pix_confirmation'
  | 'order_placed'
  | 'agent_active';

export class WhatsAppSessionService {
  async getOrCreate(phone: string): Promise<WhatsAppSession> {
    let session = qb.selectOne('whatsapp_sessions', '*', 'phone = ?', [phone]) as WhatsAppSession | undefined;
    if (!session) {
      const now = new Date().toISOString();
      const id = uuid();
      qb.insert('whatsapp_sessions', {
        id,
        phone,
        customer_id: null,
        state: 'idle',
        context: '{}',
        last_message_at: now,
        expires_at: null,
        created_at: now,
        updated_at: now,
      });
      session = qb.selectOne('whatsapp_sessions', '*', 'id = ?', [id]) as WhatsAppSession;
    }
    return session!;
  }

  async updateState(phone: string, state: SessionState, context: Record<string, any> = {}): Promise<void> {
    qb.update('whatsapp_sessions', {
      state,
      context: JSON.stringify(context),
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 'phone = ?', [phone]);
  }

  async setCustomer(phone: string, customerId: string): Promise<void> {
    qb.update('whatsapp_sessions', {
      customer_id: customerId,
      updated_at: new Date().toISOString(),
    }, 'phone = ?', [phone]);
  }

  async getContext(phone: string): Promise<Record<string, any>> {
    const session = await this.getOrCreate(phone);
    try {
      return JSON.parse(session.context);
    } catch {
      return {};
    }
  }

  async resetSession(phone: string): Promise<void> {
    await this.updateState(phone, 'idle', {});
  }
}

export const whatsappSessionService = new WhatsAppSessionService();
