import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware';
import { getDb } from '../../config/database';
import { printerService } from '../../services/printer/printer.service';
import { settingsAgent } from '../../services/settings/settings.service';

export async function registerSettingsRoutes(app: FastifyInstance) {
  // List available printers on this machine
  app.get('/api/settings/printers', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const result = await printerService.checkPrinter();
      reply.send({
        success: true,
        data: {
          connected: result.connected,
          printers: result.printers,
        },
      });
    },
  });

  // Get all settings
  app.get('/api/settings', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const db = getDb();
      const rows = db.all('SELECT key, value FROM settings');
      const settings: Record<string, string> = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      reply.send({ success: true, data: settings });
    },
  });

  // Update settings
  app.put('/api/settings', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const db = getDb();
      const body = request.body as Record<string, string>;

      for (const [key, value] of Object.entries(body)) {
        db.run(
          'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime(\'now\')',
          [key, value, value]
        );
      }

      settingsAgent.invalidateCache();

      reply.send({ success: true, message: 'Settings saved' });
    },
  });

  // Get single setting
  app.get('/api/settings/:key', {
    handler: async (request, reply) => {
      const db = getDb();
      const { key } = request.params as { key: string };
      const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
      reply.send({ success: true, data: row?.value || null });
    },
  });
}
