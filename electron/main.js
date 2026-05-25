const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadElectronEnv } = require('./config');
const { getBackendPath } = require('./utils');
const { setupUpdater } = require('./updater');

let mainWindow = null;
let backendServer = null;

// Load environment variables before anything else
loadElectronEnv();

app.disableHardwareAcceleration();

// ── Loading screen HTML ──────────────────────────────────────────────
const LOADING_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #334155;
    }
    .card {
      text-align: center; padding: 48px;
    }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 14px; color: #64748b; }
    .dots::after {
      content: '';
      animation: dots 1.5s steps(4, end) infinite;
    }
    @keyframes dots {
      0%  { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Iniciando sistema</h1>
    <p>Preparando o ambiente<span class="dots"></span></p>
  </div>
</body>
</html>`;

const ERROR_HTML_TEMPLATE = (title, msg) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc; display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #334155;
    }
    .card { text-align: center; padding: 48px; max-width: 480px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 14px; color: #64748b; line-height: 1.6; }
    code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">!</div>
    <h1>${title}</h1>
    <p>${msg}</p>
  </div>
</body>
</html>`;

// ── Window creation ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    title: 'Painel Delivery',
    icon: getIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Show loading screen immediately
  mainWindow.loadURL(`data:text/html,${encodeURIComponent(LOADING_HTML)}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

function getIconPath() {
  const iconPath = path.join(__dirname, 'icon.ico');
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

// ── Backend startup ──────────────────────────────────────────────────
async function startBackend() {
  try {
    const backendPath = getBackendPath();
    if (!fs.existsSync(backendPath)) {
      console.error('[Electron] Backend dist not found at:', backendPath);
      return false;
    }

    const originalExit = process.exit.bind(process);
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code ?? 1;
      console.error(`[Electron] Backend attempted process.exit(${code}) — blocked`);
    };

    try {
      const serverModule = require(path.join(backendPath, 'index.js'));
      if (typeof serverModule.start === 'function') {
        backendServer = await serverModule.start();
      } else if (typeof serverModule.default === 'function') {
        backendServer = await serverModule.default();
      }
    } finally {
      process.exit = originalExit;
    }

    if (exitCode !== null) {
      console.error(`[Electron] Backend init failed (exit code ${exitCode})`);
      return false;
    }

    console.log('[Electron] Backend started successfully');
    return true;
  } catch (err) {
    console.error('[Electron] Failed to start backend:', err);
    return false;
  }
}

async function waitForBackend(maxWaitMs = 30000) {
  const http = require('http');
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const ok = await new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:3333/api/system/health', (res) => {
        resolve(res.statusCode === 200);
        req.destroy();
      });
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return true;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.error('[Electron] Backend did not become ready within timeout');
  return false;
}

// ── IPC Handlers ─────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-app-name', () => app.getName());
ipcMain.handle('is-packaged', () => app.isPackaged);
ipcMain.on('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.on('close-window', () => { if (mainWindow) mainWindow.close(); });
ipcMain.on('log', (event, { level, message }) => {
  (console[level] || console.log)(`[Renderer] ${message}`);
});

// ── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // 1. Create window with loading screen
  createWindow();

  // 1.5. Start auto-updater (runs in parallel with backend)
  setupUpdater(mainWindow);

  // 2. Start backend
  const backendStarted = await startBackend();

  if (!backendStarted) {
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(ERROR_HTML_TEMPLATE(
      'Erro ao iniciar',
      'Nao foi possivel iniciar o servidor interno. Verifique os logs do sistema.'
    ))}`);
    return;
  }

  // 3. Wait for backend to be healthy
  const ready = await waitForBackend();
  if (!ready) {
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(ERROR_HTML_TEMPLATE(
      'Servidor demorou demais',
      'O servidor nao respondeu a tempo. Tente reiniciar o aplicativo.'
    ))}`);
    return;
  }

  // 4. Load frontend from backend server (solves white screen)
  try {
    await mainWindow.loadURL('http://127.0.0.1:3333');
  } catch (err) {
    console.error('[Electron] Failed to load frontend:', err);
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(ERROR_HTML_TEMPLATE(
      'Erro ao carregar',
      'O servidor iniciou mas a pagina nao carregou. Erro: ' + err.message
    ))}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  const forceTimer = setTimeout(() => app.exit(0), 3000);

  if (backendServer && typeof backendServer.close === 'function') {
    try { await backendServer.close(); } catch (err) {
      console.error('[Electron] Error closing backend:', err);
    }
  }

  clearTimeout(forceTimer);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'app:') return;
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') return;
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
