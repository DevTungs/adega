/**
 * App configuration — compiled with the backend.
 * Values can be overridden via process.env (set by Electron in production).
 */

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3333'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Database
  dbPath: process.env.DB_PATH || './data/delivery.db',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // License server — MUDAR AQUI QUANDO MIGRAR PARA VPS
  licenseApiUrl: process.env.LICENSE_API_URL || 'http://localhost:3400',
  licenseJwtSecret: process.env.LICENSE_JWT_SECRET || 'delivery-license-secret-2024',
  licenseAppId: process.env.LICENSE_APP_ID || 'delivery',

  // WhatsApp
  waSessionPath: process.env.WA_SESSION_PATH || './data/sessions',
  waReconnectInterval: parseInt(process.env.WA_RECONNECT_INTERVAL || '5000'),
  waMaxReconnect: parseInt(process.env.WA_MAX_RECONNECT || '10'),
  botMode: process.env.BOT_MODE || 'nlp',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3333',
  frontendPath: process.env.FRONTEND_PATH || null,

  // Uploads / Backup
  uploadsPath: process.env.UPLOADS_PATH || null, // null = use default
  backupPath: process.env.BACKUP_PATH || null,
  backupKeepCount: parseInt(process.env.BACKUP_KEEP_COUNT || '30'),

  // Printer
  printerType: process.env.PRINTER_TYPE || 'usb',

  // Electron (set by main process, not user-configurable)
  electronUserData: process.env.ELECTRON_USER_DATA || null,
} as const;
