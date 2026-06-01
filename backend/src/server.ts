import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { setupErrorHandler } from './shared/errors/error-handler';
import { setupRateLimit } from './shared/middlewares/rate-limit';
import { getDb } from './config/database';
import { config } from './config/app.config';
import { setupWebSocket } from './services/websocket/ws.server';
import { logger } from './shared/middlewares/logger';

const isDev = config.nodeEnv === 'development';
const isBasicLog = config.logLevel === 'basic';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: isBasicLog ? 'warn' : config.logLevel,
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
    origin: isDev
      ? config.frontendUrl
      : ['http://localhost:3333', 'http://127.0.0.1:3333', 'file://'],
    credentials: true,
  });

  // JWT
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });

  // Rate limit
  await setupRateLimit(app);

  // Static files (uploads)
  let uploadsPath: string;
  if (config.electronUserData) {
    uploadsPath = path.join(config.electronUserData, 'data', 'uploads');
  } else {
    uploadsPath = path.resolve(__dirname, '../../data/uploads');
  }
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Serve frontend in production
  if (!isDev) {
    // Resolve frontend path - support Electron and standard deployment
    let frontendPath: string;

    if (config.frontendPath) {
      // Explicit path from environment (Electron or custom deployment)
      frontendPath = config.frontendPath;
    } else if (config.electronUserData) {
      // Electron packaged - frontend is in resources
      frontendPath = path.join(process.resourcesPath || '', 'frontend');
    } else {
      // Standard deployment - relative to backend
      frontendPath = path.resolve(__dirname, '../../frontend/dist');
    }

    if (fs.existsSync(frontendPath)) {
      await app.register(fastifyStatic, {
        root: frontendPath,
        prefix: '/',
        decorateReply: false,
      });

      // SPA fallback - serve index.html for non-API routes
      app.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/') || request.url.startsWith('/uploads/')) {
          reply.status(404).send({ error: 'Not found' });
          return;
        }
        return reply.sendFile('index.html');
      });
    } else {
      logger.warn(`[Server] Frontend path not found: ${frontendPath}`);
    }
  }


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

  // License-server health check (public, no auth)
  app.get('/api/system/license-health', async (request) => {
    const { licenseService } = await import('./modules/license/license.service');
    const force = (request.query as any)?.force === 'true';

    // Non-blocking: return cached result immediately, refresh in background
    const cached = licenseService.getCachedServerReachable();
    if (cached !== null && !force) {
      // Kick off background refresh (fire-and-forget)
      licenseService.checkServerReachable(false).catch(() => {});
      return {
        reachable: cached,
        licenseServerUrl: config.licenseApiUrl,
        timestamp: new Date().toISOString(),
      };
    }

    // First call or forced: must wait for real result
    const reachable = await licenseService.checkServerReachable(force);
    return {
      reachable,
      licenseServerUrl: config.licenseApiUrl,
      timestamp: new Date().toISOString(),
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
  const { registerLicenseRoutes } = await import('./modules/license/license.routes');
  const { registerReportRoutes } = await import('./modules/reports/reports.routes');
  const { registerStockRoutes } = await import('./modules/stock/stock.routes');
  const { registerSupplierRoutes } = await import('./modules/suppliers/suppliers.routes');
  const { registerCashRegisterRoutes } = await import('./modules/cash-register/cash-register.routes');

  await registerAuthRoutes(app);
  await registerCategoryRoutes(app);
  await registerProductRoutes(app);
  await registerOrderRoutes(app);
  await registerCustomerRoutes(app);
  await registerWhatsAppRoutes(app);
  await registerSettingsRoutes(app);
  await registerLicenseRoutes(app);
  await registerReportRoutes(app);
  await registerStockRoutes(app);
  await registerSupplierRoutes(app);
  await registerCashRegisterRoutes(app);

  // WebSocket
  setupWebSocket(app);

  return app;
}
