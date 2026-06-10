import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { config } from '../../config/app.config';

let logsDir: string;
if (config.logsPath) {
  logsDir = config.logsPath;
} else if (config.electronUserData) {
  logsDir = path.join(config.electronUserData, 'data', 'logs');
} else {
  logsDir = path.resolve(__dirname, '../../../data/logs');
}
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isDev = config.nodeEnv === 'development';
const isBasicLog = config.logLevel === 'basic';

export const logger = pino({
  level: isBasicLog ? 'info' : config.logLevel,
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
  ...(isDev
    ? {}
    : {
        transport: {
          targets: [
            {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
              level: 'info',
            },
            {
              target: 'pino/file',
              options: {
                destination: path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`),
                mkdir: true,
              },
              level: 'info',
            },
            {
              target: 'pino/file',
              options: {
                destination: path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`),
                mkdir: true,
              },
              level: 'error',
            },
          ],
        },
      }),
});

export function logOrder(action: string, orderId: string, data: any = {}) {
  logger.info({ module: 'orders', orderId, ...data }, `Order ${action}`);
}

export function logWhatsApp(action: string, phone: string, data: any = {}) {
  logger.debug({ module: 'whatsapp', phone, ...data }, `WhatsApp ${action}`);
}

export function logAI(action: string, data: any = {}) {
  logger.debug({ module: 'ai', ...data }, `AI ${action}`);
}
