/**
 * App configuration — compiled with the backend.
 * Dynamic paths (DB, uploads, frontend) are injected by Electron at runtime.
 */

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3333'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  logLevel: 'basic',

  // Database
  dbPath: process.env.DB_PATH || './data/delivery.db',

  // JWT
  jwtSecret: '3WvpQdBGk2X9oycNgz8BgfuZWO5tx4uNUCD1wcAcSxs',
  jwtExpiresIn: '360d',

  // License server
  licenseApiUrl: 'https://royalblue-butterfly-353375.hostingersite.com',
  licenseJwtSecret: 'delivery-license-secret-2024',
  licenseAppId: 'delivery',

  // WhatsApp
  waSessionPath: process.env.WA_SESSION_PATH || './data/sessions',
  waReconnectInterval: 5000,
  waMaxReconnect: 10,
  botMode: 'nlp',

  // Frontend
  frontendUrl: 'http://localhost:3333',
  frontendPath: process.env.FRONTEND_PATH || null,

  // Logs
  logsPath: process.env.LOGS_PATH || null,

  // Uploads / Backup
  uploadsPath: process.env.UPLOADS_PATH || null,
  backupPath: process.env.BACKUP_PATH || null,
  backupKeepCount: 30,

  // Printer
  printerType: 'usb',

  // Electron (set by main process, not user-configurable)
  electronUserData: process.env.ELECTRON_USER_DATA || null,
} as const;
