const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');

const { initDatabase } = require('./database/sqlite');
const { setupIpcHandlers } = require('./ipc/handlers');
const { SyncManager } = require('./sync/syncManager');
const { setupAutoBackup } = require('./backup/autoBackup');

let mainWindow;
let tray;
let syncManager;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    title: 'Auto Rice Mill Management System',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Rice Mill — Synced');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow?.show() },
    { label: 'Sync Now', click: () => syncManager?.syncNow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

app.whenReady().then(async () => {
  log.info('App starting...');
  try {
    await initDatabase();
    log.info('Database initialized');
  } catch (err) {
    log.error('DB init failed', err);
  }

  setupIpcHandlers(ipcMain);
  createWindow();
  createTray();

  syncManager = new SyncManager(mainWindow);
  syncManager.start();
  setupAutoBackup();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  syncManager?.stop();
});

// Expose sync status to renderer
ipcMain.handle('sync:status', async () => syncManager?.getStatus());
ipcMain.handle('sync:now', async () => syncManager?.syncNow());
