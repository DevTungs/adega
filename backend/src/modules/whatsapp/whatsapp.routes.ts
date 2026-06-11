import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware';
import { licenseOrderMiddleware } from '../license/license.middleware';
import { baileysService } from '../../services/whatsapp/baileys.service';
import { whatsappSessionService } from './whatsapp.service';
import { logger } from '../../shared/middlewares/logger';

export async function registerWhatsAppRoutes(app: FastifyInstance) {
  // Connect to WhatsApp
  app.post('/api/whatsapp/connect', {
    preHandler: [authMiddleware, licenseOrderMiddleware],
    handler: async (request, reply) => {
      try {
        await baileysService.connect();
        reply.send({ success: true, message: 'Connecting...' });
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to connect WhatsApp');
        reply.status(500).send({ success: false, error: err.message });
      }
    },
  });

  // Disconnect
  app.post('/api/whatsapp/disconnect', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      await baileysService.disconnect();
      reply.send({ success: true, message: 'Disconnected' });
    },
  });

  // Get status
  app.get('/api/whatsapp/status', {
    handler: async (request, reply) => {
      reply.send({
        success: true,
        data: {
          state: baileysService.getState(),
          bot_active: baileysService.isBotActive(),
          qr: baileysService.getQR(),
        },
      });
    },
  });

  // Toggle bot
  app.post('/api/whatsapp/bot/toggle', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { active } = request.body as { active: boolean };
      baileysService.setBotActive(active);
      reply.send({ success: true, data: { active } });
    },
  });

  // Send message
  app.post('/api/whatsapp/send', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { phone, message } = request.body as { phone: string; message: string };
      if (!phone || !message) {
        return reply.status(400).send({ success: false, error: 'Phone and message required' });
      }

      const sent = await baileysService.sendMessage(phone, message);
      if (sent) {
        reply.send({ success: true, message: 'Message sent' });
      } else {
        reply.status(500).send({ success: false, error: 'Failed to send message' });
      }
    },
  });

  // Get conversations
  app.get('/api/whatsapp/conversations', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const conversations = baileysService.getConversations();
      reply.send({ success: true, data: conversations });
    },
  });

  // Get messages for a phone
  app.get('/api/whatsapp/messages/:phone', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { phone } = request.params as { phone: string };
      const messages = baileysService.getMessages(phone);
      reply.send({ success: true, data: messages });
    },
  });

  // Close agent request - resume bot
  app.post('/api/whatsapp/close-agent', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { phone } = request.body as { phone: string };
      if (!phone) return reply.status(400).send({ success: false, message: 'phone is required' });

      try {
        await whatsappSessionService.resetSession(phone);
        reply.send({ success: true, message: 'Agent request closed' });
      } catch (err: any) {
        logger.error({ error: err.message, phone }, 'Failed to close agent request');
        reply.status(500).send({ success: false, message: err.message });
      }
    },
  });
}
