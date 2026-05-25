import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDatabase, setDb } from './config/database';
import { logger } from './shared/middlewares/logger';

// Load .env from different locations based on environment
const envPaths = [
  path.resolve(__dirname, '../.env'),                // Development
  path.resolve(process.cwd(), '.env'),              // Production (cwd)
  path.resolve(process.resourcesPath || '', '.env'), // Electron packaged
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const PORT = parseInt(process.env.PORT || '3333');
const HOST = process.env.HOST || '0.0.0.0';

export async function start() {
  // Initialize database
  logger.info('[DB] Initializing SQLite (sql.js)...');
  const db = await initDatabase();
  setDb(db);

  // Run migrations
  logger.info('[DB] Running migrations...');
  await db.migrate();

  // Run seeds
  logger.info('[DB] Running seeds...');
  await db.seed();

  logger.info('[DB] Database ready');

  // Build and start app
  const { buildApp } = await import('./server');
  const app = await buildApp();

  // Graceful shutdown (only when running standalone, not Electron)
  if (!process.versions.electron) {
    const shutdown = async (signal: string) => {
      logger.info(`[Server] Received ${signal}, shutting down...`);
      db.save();
      db.close();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  await app.listen({ port: PORT, host: HOST });
  logger.info(`[Server] Running at http://${HOST}:${PORT}`);
  logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

  return app;
}

// Only start if not imported as module (Electron imports it)
if (require.main === module) {
  start().catch(err => {
    logger.error(err, '[Server] Failed to start');
    process.exit(1);
  });
}
