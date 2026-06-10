const { autoUpdater } = require('electron-updater');
const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

function withTimeout(promise, ms, label = 'operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// ── File logger for diagnostics ──────────────────────────────────────
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(LOG_DIR, 'updater.log');

function writeLog(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  if (level === 'ERROR') console.error('[Updater]', msg);
  else console.log('[Updater]', msg);
}

// ── Configure autoUpdater ────────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true; // Fallback: install on quit if startup update fails
autoUpdater.disableSignatureVerification = true;

// electron-updater on Linux (AppImage) needs correct channel and feed setup
if (process.platform === 'linux') {
  autoUpdater.autoInstallOnAppQuit = false; // AppImage needs explicit quitAndInstall
}

autoUpdater.logger = {
  info: (msg) => writeLog('INFO', msg),
  warn: (msg) => writeLog('WARN', msg),
  error: (msg) => writeLog('ERROR', msg),
};

let mainWindow = null;
let updateAborted = false;

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function updateLoadingText(text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript(
        `document.querySelector('.status-text').textContent = ${JSON.stringify(text)};`
      ).catch(() => {});
    } catch {}
  }
}

function updateProgressBar(percent) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript(`
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('progress-container').style.display = 'block';
        document.getElementById('progress-bar').style.width = ${percent} + '%';
        document.getElementById('progress-percent').textContent = ${percent} + '%';
      `).catch(() => {});
    } catch {}
  }
}

// ── Retry wrapper ────────────────────────────────────────────────────
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 2000, attemptTimeoutMs = 15000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(), attemptTimeoutMs, `attempt ${attempt}`);
    } catch (err) {
      lastErr = err;
      writeLog('WARN', `Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        writeLog('INFO', `Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ── Core update check ────────────────────────────────────────────────
async function checkAndUpdate() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled || updateAborted) return;
      settled = true;
      autoUpdater.removeAllListeners();
      writeLog('INFO', `Update check result: ${JSON.stringify(result)}`);
      resolve(result);
    };

    autoUpdater.on('error', (err) => {
      writeLog('ERROR', `AutoUpdater error: ${err.message}`);
      done({ available: false, error: err.message });
    });

    autoUpdater.on('update-not-available', () => {
      writeLog('INFO', 'No update available');
      done({ available: false });
    });

    autoUpdater.on('update-available', (info) => {
      writeLog('INFO', `Update available: ${info.version}`);
      updateLoadingText(`Atualização disponível: v${info.version}. Baixando...`);
      updateProgressBar(0);
      sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
      autoUpdater.downloadUpdate();
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent);
      updateLoadingText(`Baixando atualização: ${percent}%`);
      updateProgressBar(percent);
      sendToRenderer('update-download-progress', {
        percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      writeLog('INFO', `Update downloaded: ${info.version}`);
      updateProgressBar(100);
      updateLoadingText('Atualização baixada. Preparando instalador...');
      sendToRenderer('update-downloaded', { version: info.version });
      done({ available: true, version: info.version, downloaded: true });
    });

    // Check with retry (each attempt has a 15s timeout)
    updateLoadingText('Verificando atualizações...');
    withRetry(() => autoUpdater.checkForUpdates(), { maxAttempts: 3, baseDelayMs: 2000, attemptTimeoutMs: 15000 })
      .catch((err) => {
        writeLog('ERROR', `All update check attempts failed: ${err.message}`);
        done({ available: false, error: err.message });
      });

    // Hard timeout: 55s (3x15s attempts + 2s+4s backoff + buffer)
    setTimeout(() => {
      done({ available: false, error: 'Timeout verificando atualizações (55s)' });
    }, 55000);
  });
}

// ── IPC handlers ─────────────────────────────────────────────────────
function setupUpdater(window) {
  mainWindow = window;

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err) {
      writeLog('ERROR', `Manual check failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('install-update', () => {
    writeLog('INFO', 'Manual install triggered via IPC');
    autoUpdater.quitAndInstall(false, true);
  });
}

function abortUpdateCheck() {
  updateAborted = true;
  autoUpdater.removeAllListeners();
  writeLog('INFO', 'Update check aborted externally');
}

module.exports = { setupUpdater, checkAndUpdate, abortUpdateCheck };
