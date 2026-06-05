const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadElectronEnv } = require('./config');
const { getBackendPath } = require('./utils');
const { setupUpdater, checkAndUpdate, abortUpdateCheck } = require('./updater');

let mainWindow = null;
let backendServer = null;

function updateLoadingText(text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.executeJavaScript(
        `document.querySelector('.status-text').textContent = ${JSON.stringify(text)};`
      ).catch(() => {});
    } catch {}
  }
}

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
      background: #0f172a;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #f1f5f9;
    }
    .card {
      text-align: center; padding: 48px;
      animation: fade-in 0.6s ease-out;
      width: 420px;
    }
    .logo {
      width: 72px; height: 72px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      box-shadow: 0 8px 32px rgba(99,102,241,0.3);
    }
    .logo svg { width: 36px; height: 36px; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #1e293b;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    .progress-container {
      display: none;
      width: 100%;
      margin: 0 auto 16px;
    }
    .progress-track {
      width: 100%;
      height: 8px;
      background: #1e293b;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #818cf8);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .progress-percent {
      font-size: 13px;
      color: #818cf8;
      margin-top: 8px;
      font-weight: 600;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; background: linear-gradient(90deg, #818cf8, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 14px; font-weight: 500; color: #94a3b8; margin-bottom: 24px; }
    p  { font-size: 13px; color: #64748b; }
    .dots::after { content: ''; animation: dots 1.5s steps(4, end) infinite; }
    @keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    <h1>NETRIX SYSTEM</h1>
    <h2>Iniciando sistema</h2>
    <div class="spinner" id="spinner"></div>
    <div class="progress-container" id="progress-container">
      <div class="progress-track">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <div class="progress-percent" id="progress-percent">0%</div>
    </div>
    <p class="status-text">Verificando atualizacoes<span class="dots"></span></p>
  </div>
</body>
</html>`;

// ── Update installing screen ─────────────────────────────────────────
const UPDATE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #f1f5f9;
    }
    .card { text-align: center; padding: 48px; animation: fade-in 0.4s ease-out; width: 460px; }
    .icon-circle {
      width: 72px; height: 72px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; box-shadow: 0 8px 32px rgba(99,102,241,0.3);
    }
    .icon-circle svg { width: 32px; height: 32px; }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #1e293b; border-top-color: #6366f1;
      border-radius: 50%; animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; background: linear-gradient(90deg, #818cf8, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
    .warning { margin-top: 20px; padding: 12px 16px; background: #1e293b; border-radius: 8px; border-left: 3px solid #f59e0b; }
    .warning p { font-size: 12px; color: #fbbf24; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </div>
    <h1>Atualizando Sistema</h1>
    <p>A atualização esta sendo instalada.<br>O instalador sera aberto em instantes.</p>
    <div class="spinner"></div>
    <div class="warning">
      <p>Nao desligue o computador durante a atualizacao.</p>
    </div>
  </div>
</body>
</html>`;

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #f1f5f9;
    }
    .card { text-align: center; padding: 48px; max-width: 480px; animation: fade-in 0.6s ease-out; }
    .icon-circle {
      width: 72px; height: 72px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; box-shadow: 0 8px 32px rgba(245,158,11,0.3);
    }
    .icon-circle svg { width: 32px; height: 32px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; background: linear-gradient(90deg, #fbbf24, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .btn-retry {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 28px; border: none; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-retry:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }
    .btn-retry:active { transform: translateY(0); }
    .btn-retry:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
      border-radius: 50%; animation: spin 0.8s linear infinite;
      display: none;
    }
    .info { margin-top: 20px; padding: 12px 16px; background: #1e293b; border-radius: 8px; border-left: 3px solid #f59e0b; }
    .info p { font-size: 12px; color: #fbbf24; text-align: left; margin-bottom: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-circle">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>
    <h1>Servidor de Licenças em Manutenção</h1>
    <p>Não foi possível conectar ao servidor de licenças. O sistema pode estar em manutenção ou temporariamente indisponível.</p>
    <button class="btn-retry" id="btn-retry" onclick="retryCheck()">
      <span id="btn-text">Tentar novamente</span>
      <div class="spinner" id="btn-spinner"></div>
    </button>
    <div class="info">
      <p>Se o problema persistir, entre em contato com o suporte técnico.</p>
    </div>
  </div>
  <script>
    function retryCheck() {
      const btn = document.getElementById('btn-retry');
      const text = document.getElementById('btn-text');
      const spinner = document.getElementById('btn-spinner');
      btn.disabled = true;
      text.textContent = 'Verificando...';
      spinner.style.display = 'block';
      // Signal Electron to retry
      if (window.electronAPI && window.electronAPI.retryLicenseCheck) {
        window.electronAPI.retryLicenseCheck().then(function(ok) {
          if (!ok) {
            // Server still down — re-enable button
            btn.disabled = false;
            text.textContent = 'Tentar novamente';
            spinner.style.display = 'none';
          }
          // If ok === true, the IPC handler already loaded the frontend
        }).catch(function() {
          btn.disabled = false;
          text.textContent = 'Tentar novamente';
          spinner.style.display = 'none';
        });
      } else {
        // Fallback: reload after delay
        setTimeout(function() { location.reload(); }, 2000);
      }
    }
  </script>
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
      background: #0f172a; display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #f1f5f9;
    }
    .card { text-align: center; padding: 48px; max-width: 480px; }
    .icon { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: #1e293b; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #ef4444; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p  { font-size: 14px; color: #94a3b8; line-height: 1.6; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 12px; color: #e2e8f0; }
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
    title: 'Netrix System',
    icon: getIconPath(),
    show: false,
    backgroundColor: '#0f172a',
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
      return { ok: false, error: 'Backend dist not found at: ' + backendPath };
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
        // Timeout: se start() demorar mais de 45s, falha
        const startPromise = serverModule.start();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Backend start() timeout (45s)')), 45000)
        );
        backendServer = await Promise.race([startPromise, timeoutPromise]);
      } else if (typeof serverModule.default === 'function') {
        const startPromise = serverModule.default();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Backend default() timeout (45s)')), 45000)
        );
        backendServer = await Promise.race([startPromise, timeoutPromise]);
      }
    } catch (startErr) {
      console.error('[Electron] Backend start() threw:', startErr);
      process.exit = originalExit;
      return { ok: false, error: startErr.message || String(startErr) };
    } finally {
      process.exit = originalExit;
    }

    if (exitCode !== null) {
      console.error(`[Electron] Backend init failed (exit code ${exitCode})`);
      return { ok: false, error: `Backend tentou sair com código ${exitCode}` };
    }

    console.log('[Electron] Backend started successfully');
    return { ok: true };
  } catch (err) {
    console.error('[Electron] Failed to start backend:', err);
    return { ok: false, error: err.message || String(err) };
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

// ── License server health check ──────────────────────────────────────
async function checkLicenseServer(force = false) {
  const http = require('http');
  const url = force
    ? 'http://127.0.0.1:3333/api/system/license-health?force=true'
    : 'http://127.0.0.1:3333/api/system/license-health';
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.reachable === true);
        } catch {
          resolve(false);
        }
      });
      req.destroy();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(8000, () => { req.destroy(); resolve(false); });
  });
}

function showMaintenanceScreen() {
  mainWindow.loadURL(`data:text/html,${encodeURIComponent(MAINTENANCE_HTML)}`);
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

// Retry license-server check from maintenance screen
ipcMain.handle('retry-license-check', async () => {
  const reachable = await checkLicenseServer(true); // force=true to bypass cache
  if (reachable) {
    // Server is back — load the frontend
    try {
      await mainWindow.loadURL('http://127.0.0.1:3333');
    } catch (err) {
      if (err.errno !== -3 && err.code !== 'ERR_ABORTED') {
        console.error('[Electron] Failed to load frontend after retry:', err);
      }
    }
  }
  return reachable;
});

// ── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // 1. Create window with loading screen
  createWindow();

  // 1.5. Setup updater IPC handlers
  setupUpdater(mainWindow);

  // 2. Check for updates BEFORE starting backend (only in packaged mode)
  if (app.isPackaged) {
    // Watchdog: if update check takes more than 65s, abort and proceed
    const updateWatchdogTimer = setTimeout(() => {
      console.error('[Electron] Update check watchdog fired — aborting and proceeding');
      abortUpdateCheck();
    }, 65000);

    const updateResult = await checkAndUpdate();

    clearTimeout(updateWatchdogTimer);

    if (updateResult.downloaded) {
      const { autoUpdater } = require('electron-updater');
      const installerPath = autoUpdater.installerPath;

      // Show dedicated update screen so user sees feedback
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(UPDATE_HTML)}`);

      if (installerPath && fs.existsSync(installerPath)) {
        // Prevent autoInstallOnAppQuit from spawning a second (silent) installer
        autoUpdater.autoInstallOnAppQuit = false;

        console.log('[Electron] Installer path:', installerPath);

        // Give user time to see the update screen before launching installer
        await new Promise(r => setTimeout(r, 2000));

        // Spawn installer with --updated --force-run (no /S = shows NSIS UI)
        const { spawn } = require('child_process');
        const installer = spawn(installerPath, ['--updated', '--force-run'], {
          detached: true,
          stdio: 'ignore',
          shell: true,
        });
        installer.unref();
        console.log('[Electron] Installer spawned with UI flags');

        // Wait for installer window to appear, then quit
        await new Promise(r => setTimeout(r, 2000));
        app.quit();
      } else {
        console.warn('[Electron] Installer path not found, falling back to quitAndInstall');
        await new Promise(r => setTimeout(r, 1500));
        autoUpdater.quitAndInstall(false, true);
      }
      return; // App will restart
    }
  }

  // 3. No update (or dev mode) — continue normal startup
  updateLoadingText('Iniciando sistema...');

  // 4. Start backend
  const backendResult = await startBackend();

  if (!backendResult.ok) {
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(ERROR_HTML_TEMPLATE(
      'Erro ao iniciar',
      'Nao foi possivel iniciar o servidor interno:\\n\\n' + (backendResult.error || 'Erro desconhecido')
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
    // ERR_ABORTED (-3) is expected — the loading screen was cancelled by the new navigation
    if (err.errno === -3 || err.code === 'ERR_ABORTED') {
      console.log('[Electron] Frontend navigation started (previous page aborted — normal)');
    } else {
      console.error('[Electron] Failed to load frontend:', err);
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(ERROR_HTML_TEMPLATE(
        'Erro ao carregar',
        'O servidor iniciou mas a pagina nao carregou. Erro: ' + err.message
      ))}`);
    }
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
