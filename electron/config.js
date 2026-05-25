const path = require('path');
const fs = require('fs');
const {
  getBaseDir,
  getDataDir,
  getDbPath,
  getSessionsPath,
  getUploadsPath,
  getBackupsPath,
  getLogsPath,
  getEnvPath,
} = require('./utils');

/**
 * Ensure all required data directories exist
 */
function ensureDirectories() {
  const dirs = [
    getDataDir(),
    getSessionsPath(),
    getUploadsPath(),
    getBackupsPath(),
    getLogsPath(),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Create a default .env file in userData if it doesn't exist
 */
function ensureEnvFile() {
  const envPath = path.join(getDataDir(), '..', '.env');

  if (!fs.existsSync(envPath)) {
    const defaultEnv = `# Configurações do Sistema - Gerado automaticamente
PORT=3333
HOST=127.0.0.1
NODE_ENV=production
LOG_LEVEL=basic

# JWT
JWT_SECRET=${generateRandomSecret()}
JWT_EXPIRES_IN=360d

# Database
DB_PATH=${getDbPath()}

# WhatsApp
WA_SESSION_PATH=${getSessionsPath()}
WA_RECONNECT_INTERVAL=5000
WA_MAX_RECONNECT=10
BOT_MODE=nlp

# Impressora
PRINTER_TYPE=usb

# Backup
BACKUP_PATH=${getBackupsPath()}
BACKUP_KEEP_COUNT=30

# URLs
FRONTEND_URL=http://localhost:3333
LICENSE_API_URL=http://localhost:3400
LICENSE_APP_ID=delivery
`;

    fs.writeFileSync(envPath, defaultEnv, 'utf-8');
    return envPath;
  }

  return envPath;
}

/**
 * Generate a random JWT secret
 */
function generateRandomSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let secret = '';
  for (let i = 0; i < 64; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

/**
 * Load environment variables for Electron
 */
function loadElectronEnv() {
  // Ensure directories exist
  ensureDirectories();

  // Ensure .env exists
  const envPath = ensureEnvFile();

  // Load .env file
  require('dotenv').config({ path: envPath });

  // Set Electron-specific env vars
  process.env.ELECTRON_USER_DATA = getBaseDir();
  process.env.DB_PATH = getDbPath();
  process.env.WA_SESSION_PATH = getSessionsPath();
  process.env.BACKUP_PATH = getBackupsPath();
  process.env.NODE_ENV = 'production';
  process.env.PORT = process.env.PORT || '3333';
  process.env.HOST = '127.0.0.1';

  // Frontend path — packaged: resources/frontend, dev: ../frontend/dist
  const { app } = require('electron');
  if (app.isPackaged) {
    process.env.FRONTEND_PATH = path.join(process.resourcesPath, 'frontend');
  } else {
    process.env.FRONTEND_PATH = path.resolve(__dirname, '..', 'frontend', 'dist');
  }
}

module.exports = {
  ensureDirectories,
  ensureEnvFile,
  loadElectronEnv,
};
