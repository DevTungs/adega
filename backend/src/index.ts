import dotenv from 'dotenv';
import path from 'path';
import { initDatabase, setDb } from './config/database';
import { logger } from './shared/middlewares/logger';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '3333');
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
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

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`[Server] Received ${signal}, shutting down...`);
      db.save();
      db.close();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    await app.listen({ port: PORT, host: HOST });
    logger.info(`[Server] Running at http://${HOST}:${PORT}`);
    logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    logger.error(err, '[Server] Failed to start');
    process.exit(1);
  }
}

start();
