const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer (React app)
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  db: {
    query:   (sql, params) => ipcRenderer.invoke('db:query',   { sql, params }),
    execute: (sql, params) => ipcRenderer.invoke('db:execute', { sql, params }),
    all:     (sql, params) => ipcRenderer.invoke('db:all',     { sql, params }),
  },

  // Sync
  sync: {
    getStatus: ()  => ipcRenderer.invoke('sync:status'),
    syncNow:   ()  => ipcRenderer.invoke('sync:now'),
    onStatus:  (cb) => ipcRenderer.on('sync:status-update', (_e, d) => cb(d)),
  },

  // Backup
  backup: {
    create:  ()         => ipcRenderer.invoke('backup:create'),
    restore: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
    list:    ()         => ipcRenderer.invoke('backup:list'),
  },

  // App settings
  settings: {
    get: (key)        => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },

  // Platform info
  platform: process.platform,
  isDesktop: true,
});
