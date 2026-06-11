import { initDatabase, setDb } from './config/database';
import { config } from './config/app.config';
import { logger } from './shared/middlewares/logger';

// Prevent the process from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  logger.error(err, '[Process] Uncaught exception — continuing');
});

process.on('unhandledRejection', (reason: any) => {
  logger.error(reason, '[Process] Unhandled rejection — continuing');
});

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

  // Reset all agent_active sessions on startup (bot was paused, resume it)
  try {
    const { qb } = await import('./config/database');
    qb.update('whatsapp_sessions', {
      state: 'idle',
      context: '{}',
      updated_at: new Date().toISOString(),
    }, "state = 'agent_active'");
    logger.info('[DB] Reset all agent_active sessions to idle');
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to reset agent_active sessions');
  }

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

  await app.listen({ port: config.port, host: config.host });
  logger.info(`[Server] Running at http://${config.host}:${config.port}`);
  logger.info(`[Server] Environment: ${config.nodeEnv}`);

  return app;
}

// Only start if not imported as module (Electron imports it)
if (require.main === module) {
  start().catch(err => {
    logger.error(err, '[Server] Failed to start');
    process.exit(1);
  });
}
