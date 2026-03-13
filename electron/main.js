const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let backendProcess;

// Check if running in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Get paths based on environment
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend-ts', 'dist', 'index.js');
  }
  // In production, backend code is in Resources/backend-ts/dist (outside asar)
  return path.join(process.resourcesPath, 'backend-ts', 'dist', 'index.js');
}

function getBackendCwd() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend-ts');
  }
  // In production, everything is in Resources/backend-ts (outside asar)
  return path.join(process.resourcesPath, 'backend-ts');
}

function getFrontendPath() {
  if (isDev) {
    return 'http://localhost:3002';
  }
  return path.join(__dirname, '..', 'frontend', 'out', 'index.html');
}

// Start backend server
function startBackend() {
  const backendPath = getBackendPath();
  const backendCwd = getBackendCwd();
  console.log('Starting backend from:', backendPath);
  console.log('Backend CWD:', backendCwd);

  backendProcess = fork(backendPath, [], {
    cwd: backendCwd,
    env: {
      ...process.env,
      PORT: '8002',
      NODE_ENV: isDev ? 'development' : 'production',
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log('Backend process exited with code:', code);
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend stdout: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend stderr: ${data}`);
  });
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Skill Checker',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow file:// to access localhost API
    },
  });

  // Load frontend
  if (isDev) {
    mainWindow.loadURL('http://localhost:3002');
  } else {
    // For production, load from file:// but allow access to localhost
    mainWindow.loadFile(getFrontendPath());
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Open DevTools in production for debugging (can remove later)
  mainWindow.webContents.openDevTools();

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/anthropics/claude-code');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle
app.whenReady().then(() => {
  // Start backend server
  startBackend();

  // Wait for backend to start
  setTimeout(() => {
    createWindow();
    createMenu();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
