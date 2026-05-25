const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

// Configure
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.disableSignatureVerification = true;
autoUpdater.logger = {
  info: (msg) => console.log('[Updater]', msg),
  warn: (msg) => console.warn('[Updater]', msg),
  error: (msg) => console.error('[Updater]', msg),
};

let mainWindow = null;

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function updateLoadingText(text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `document.querySelector('.status-text').textContent = ${JSON.stringify(text)};`
    ).catch(() => {});
  }
}

/**
 * Check for updates BEFORE the app starts.
 * Returns: { available: false } or { available: true, version, downloaded: true/false }
 */
async function checkAndUpdate() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      // Remove listeners to avoid leaks
      autoUpdater.removeAllListeners();
      resolve(result);
    };

    autoUpdater.on('error', (err) => {
      console.error('[Updater] Error:', err.message);
      done({ available: false, error: err.message });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[Updater] No update available');
      done({ available: false });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Update available:', info.version);
      updateLoadingText(`Atualização disponível: v${info.version}. Baixando...`);
      sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
      autoUpdater.downloadUpdate();
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent);
      updateLoadingText(`Baixando atualização: ${percent}%`);
      sendToRenderer('update-download-progress', {
        percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Update downloaded:', info.version);
      updateLoadingText('Atualização baixada. Reiniciando...');
      sendToRenderer('update-downloaded', {
        version: info.version,
      });
      done({ available: true, version: info.version, downloaded: true });
    });

    // Start check
    updateLoadingText('Verificando atualizações...');
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] Check failed:', err.message);
      done({ available: false, error: err.message });
    });

    // Timeout: 30s max
    setTimeout(() => {
      done({ available: false, error: 'Timeout verificando atualizações' });
    }, 30000);
  });
}

function setupUpdater(window) {
  mainWindow = window;

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result?.updateInfo };
    } catch (err) {
      console.error('[Updater] Manual check failed:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(true, true);
  });
}

module.exports = { setupUpdater, checkAndUpdate };
