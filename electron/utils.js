const path = require('path');
const { app } = require('electron');

/**
 * Resolve the base directory for the application.
 * In development: project root
 * In production (packaged): app.getPath('userData')
 */
function getBaseDir() {
  if (app.isPackaged) {
    return app.getPath('userData');
  }
  return path.resolve(__dirname, '..');
}

/**
 * Get the path to the data directory
 */
function getDataDir() {
  return path.join(getBaseDir(), 'data');
}

/**
 * Get the path to the database file
 */
function getDbPath() {
  return path.join(getDataDir(), 'delivery.db');
}

/**
 * Get the path to the sessions directory
 */
function getSessionsPath() {
  return path.join(getDataDir(), 'sessions');
}

/**
 * Get the path to the uploads directory
 */
function getUploadsPath() {
  return path.join(getDataDir(), 'uploads');
}

/**
 * Get the path to the backups directory
 */
function getBackupsPath() {
  return path.join(getDataDir(), 'backups');
}

/**
 * Get the path to the logs directory
 */
function getLogsPath() {
  return path.join(getDataDir(), 'logs');
}

/**
 * Get the path to the frontend dist directory
 */
function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend');
  }
  return path.resolve(__dirname, '..', 'frontend', 'dist');
}

/**
 * Get the path to the backend dist directory
 */
function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.resolve(__dirname, '..', 'backend', 'dist');
}

/**
 * Get the path to the .env file
 */
function getEnvPath() {
  const userDataEnv = path.join(getBaseDir(), '.env');
  const fs = require('fs');

  // If .env exists in userData, use it
  if (fs.existsSync(userDataEnv)) {
    return userDataEnv;
  }

  // Otherwise use the backend .env (dev mode)
  return path.resolve(__dirname, '..', 'backend', '.env');
}

module.exports = {
  getBaseDir,
  getDataDir,
  getDbPath,
  getSessionsPath,
  getUploadsPath,
  getBackupsPath,
  getLogsPath,
  getFrontendPath,
  getBackendPath,
  getEnvPath,
};
