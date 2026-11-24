const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const raw = fs.readFileSync(STATE_FILE(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      width: typeof parsed.width === 'number' ? Math.max(960, parsed.width) : 1380,
      height: typeof parsed.height === 'number' ? Math.max(680, parsed.height) : 880,
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
      isMaximized: Boolean(parsed.isMaximized),
    };
  } catch {
    return { width: 1380, height: 880, isMaximized: false };
  }
}

function saveWindowState(win) {
  try {
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    fs.writeFileSync(
      STATE_FILE(),
      JSON.stringify({ ...bounds, isMaximized }, null, 2),
      'utf8',
    );
  } catch {
    // Ignore disk write errors on read-only profiles
  }
}

function createWindow() {
  const state = loadWindowState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 960,
    minHeight: 640,
    title: 'WirelessLab ECE441 — Wireless & Mobile Communications Workbench',
    backgroundColor: '#f8fafc',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (state.isMaximized) {
    win.maximize();
  }

  const sendMenuAction = (action) => {
    if (!win.isDestroyed()) {
      win.webContents.send('wirelesslab:menu-action', action);
    }
  };

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project (.json)...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('load-project'),
        },
        {
          label: 'Save Project (.json)...',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save-project'),
        },
        { type: 'separator' },
        {
          label: 'Export Course Report...',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuAction('export-report'),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Light / Dark Theme',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendMenuAction('toggle-theme'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WirelessLab ECE441',
          click: () => {
            sendMenuAction('about');
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About WirelessLab ECE441',
              message: 'WirelessLab ECE441 v1.0.0',
              detail:
                'ECE 441 — Wireless and Mobile Communications\nDelta University for Science and Technology, Faculty of Engineering\n\n100% Offline Desktop Simulation Suite (Modules 1–8).',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  const isDev = process.env.ELECTRON_DEV === '1' && !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', () => saveWindowState(win));
  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
