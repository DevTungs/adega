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
 * Get .env path (kept for optional manual overrides only)
 */
function ensureEnvFile() {
  return path.join(getDataDir(), '..', '.env');
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

  // Load .env file if it exists (optional manual overrides)
  const envPath = ensureEnvFile();
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }

  // Set Electron-specific env vars (always override)
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
