import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import dotenv from 'dotenv';
import { setupErrorHandler } from './shared/errors/error-handler';
import { setupRateLimit } from './shared/middlewares/rate-limit';
import { getDb } from './config/database';
import { setupWebSocket } from './services/websocket/ws.server';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isDev = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || 'info';
const isBasicLog = logLevel === 'basic';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: isBasicLog ? 'warn' : logLevel,
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
      serializers: isBasicLog
        ? {
            req: (req: any) => ({ method: req.method, url: req.url }),
            res: (res: any) => ({ statusCode: res.statusCode }),
          }
        : undefined,
    },
    bodyLimit: 10 * 1024 * 1024,
  });

  // CORS
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  });

  // Rate limit
  await setupRateLimit(app);

  // Static files (uploads)
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../../data/uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });


  // Error handler
  setupErrorHandler(app);

  // Health check
  app.get('/api/system/health', async () => {
    const db = getDb();
    const dbOk = await db.healthCheck();
    return {
      status: dbOk ? 'healthy' : 'degraded',
      checks: {
        database: dbOk ? 'ok' : 'error',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    };
  });

  // Register routes
  const { registerAuthRoutes } = await import('./modules/auth/auth.routes');
  const { registerCategoryRoutes } = await import('./modules/categories/categories.routes');
  const { registerProductRoutes } = await import('./modules/products/products.routes');
  const { registerOrderRoutes } = await import('./modules/orders/orders.routes');
  const { registerCustomerRoutes } = await import('./modules/customers/customers.routes');
  const { registerWhatsAppRoutes } = await import('./modules/whatsapp/whatsapp.routes');
  const { registerSettingsRoutes } = await import('./modules/settings/settings.routes');

  await registerAuthRoutes(app);
  await registerCategoryRoutes(app);
  await registerProductRoutes(app);
  await registerOrderRoutes(app);
  await registerCustomerRoutes(app);
  await registerWhatsAppRoutes(app);
  await registerSettingsRoutes(app);

  // WebSocket
  setupWebSocket(app);

  return app;
}
