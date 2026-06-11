const { dbQuery, dbAll, dbExecute } = require('../database/sqlite');
const { createBackup, restoreBackup, listBackups } = require('../backup/autoBackup');
const Store = require('electron-store');
const store = new Store();

function setupIpcHandlers(ipcMain) {
  // Database IPC
  ipcMain.handle('db:query', (_e, { sql, params }) => {
    try { return { success: true, data: dbQuery(sql, params) };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('db:all', (_e, { sql, params }) => {
    try { return { success: true, data: dbAll(sql, params) };
    } catch (err) { return { success: false, error: err.message }; }
  });

  ipcMain.handle('db:execute', (_e, { sql, params }) => {
    try { return { success: true, data: dbExecute(sql, params) };
    } catch (err) { return { success: false, error: err.message }; }
  });

  // Backup IPC
  ipcMain.handle('backup:create',  () => createBackup());
  ipcMain.handle('backup:restore', (_e, filePath) => restoreBackup(filePath));
  ipcMain.handle('backup:list',    () => listBackups());

  // Settings IPC
  ipcMain.handle('settings:get', (_e, key)        => store.get(key));
  ipcMain.handle('settings:set', (_e, key, value) => store.set(key, value));
}

module.exports = { setupIpcHandlers };
