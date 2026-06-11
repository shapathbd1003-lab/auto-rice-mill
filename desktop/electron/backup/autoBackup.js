const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');
const { getDbPath } = require('../database/sqlite');

function getBackupDir() {
  const dir = path.join(app.getPath('userData'), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createBackup() {
  const src = getDbPath();
  if (!fs.existsSync(src)) return { success: false, error: 'Database not found' };
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(getBackupDir(), `backup_${ts}.db`);
  fs.copyFileSync(src, dest);
  log.info('Backup created:', dest);
  // Keep only last 30 backups
  cleanOldBackups();
  return { success: true, path: dest };
}

function restoreBackup(filePath) {
  const dest = getDbPath();
  if (!fs.existsSync(filePath)) return { success: false, error: 'Backup file not found' };
  fs.copyFileSync(filePath, dest);
  log.info('Backup restored from:', filePath);
  return { success: true };
}

function listBackups() {
  const dir = getBackupDir();
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtime }))
    .sort((a, b) => b.mtime - a.mtime);
  return files;
}

function cleanOldBackups() {
  const files = listBackups();
  if (files.length > 30) {
    files.slice(30).forEach((f) => fs.unlinkSync(f.path));
  }
}

function setupAutoBackup() {
  // Backup every day at startup if last backup was >24h ago
  const backups = listBackups();
  const lastBackup = backups[0];
  const dayMs = 24 * 60 * 60 * 1000;
  if (!lastBackup || (Date.now() - new Date(lastBackup.mtime).getTime() > dayMs)) {
    createBackup();
    log.info('Auto backup created on startup');
  }
  // Schedule daily backup
  setInterval(() => { createBackup(); }, dayMs);
}

module.exports = { createBackup, restoreBackup, listBackups, setupAutoBackup };
