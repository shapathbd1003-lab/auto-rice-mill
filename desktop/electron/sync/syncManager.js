const axios = require('axios');
const { dbAll, dbExecute, dbQuery } = require('../database/sqlite');
const log = require('electron-log');

const SYNC_INTERVAL = 30 * 1000; // 30 seconds

class SyncManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.timer = null;
    this.isSyncing = false;
    this.status = 'idle';
    this.lastSync = null;
    this.serverUrl = null;
    this.token = null;
  }

  start() {
    this.timer = setInterval(() => this.syncNow(), SYNC_INTERVAL);
    log.info('Sync manager started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  setCredentials(serverUrl, token) {
    this.serverUrl = serverUrl;
    this.token = token;
  }

  getStatus() {
    return { status: this.status, lastSync: this.lastSync };
  }

  async syncNow() {
    if (this.isSyncing || !this.serverUrl || !this.token) return;
    this.isSyncing = true;
    this.setStatus('syncing');
    try {
      await this.push();
      await this.pull();
      this.lastSync = new Date().toISOString();
      this.setStatus('synced');
      log.info('Sync complete');
    } catch (err) {
      this.setStatus('error');
      log.error('Sync failed', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  async push() {
    const pending = dbAll(
      'SELECT * FROM sync_queue WHERE is_synced = 0 AND retry_count < 5 ORDER BY created_at LIMIT 100'
    );
    if (!pending.length) return;

    const response = await axios.post(`${this.serverUrl}/api/sync/push`, {
      items: pending.map((item) => ({
        entityType: item.entity_type,
        entityId:   item.entity_id,
        operation:  item.operation,
        payload:    JSON.parse(item.payload),
      })),
      deviceId: this.getDeviceId(),
    }, { headers: { Authorization: `Bearer ${this.token}` }, timeout: 15000 });

    // Mark synced
    const ids = pending.map((i) => i.id);
    for (const id of ids) {
      dbExecute('UPDATE sync_queue SET is_synced = 1, synced_at = datetime(\'now\') WHERE id = ?', [id]);
    }
    log.info(`Pushed ${ids.length} items`);
  }

  async pull() {
    const meta = dbQuery('SELECT last_pulled FROM sync_metadata WHERE entity_type = ?', ['all']);
    const since = meta?.last_pulled || '1970-01-01T00:00:00Z';

    const response = await axios.get(`${this.serverUrl}/api/sync/pull`, {
      params: { since },
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 15000,
    });

    const { changes, serverTime } = response.data.data;

    // Apply server changes to local SQLite
    for (const [table, rows] of Object.entries(changes || {})) {
      for (const row of rows) {
        this.upsertRow(table, row);
      }
    }

    // Update pull timestamp
    dbExecute(
      'INSERT OR REPLACE INTO sync_metadata (entity_type, last_pulled, updated_at) VALUES (?, ?, datetime(\'now\'))',
      ['all', serverTime]
    );
  }

  upsertRow(table, row) {
    try {
      const existing = dbQuery(`SELECT id FROM ${table} WHERE server_id = ?`, [row.id]);
      if (existing) {
        const cols = Object.keys(row).filter((k) => k !== 'id').map((k) => `${k} = ?`).join(', ');
        const vals = Object.keys(row).filter((k) => k !== 'id').map((k) => row[k]);
        vals.push(row.id);
        dbExecute(`UPDATE ${table} SET ${cols} WHERE server_id = ?`, vals);
      } else {
        const keysWithServer = ['server_id', ...Object.keys(row).filter((k) => k !== 'id')];
        const placeholders = keysWithServer.map(() => '?').join(', ');
        const vals = [row.id, ...Object.keys(row).filter((k) => k !== 'id').map((k) => row[k])];
        dbExecute(`INSERT OR IGNORE INTO ${table} (${keysWithServer.join(',')}) VALUES (${placeholders})`, vals);
      }
    } catch (err) {
      log.warn(`Upsert failed for ${table}:`, err.message);
    }
  }

  setStatus(status) {
    this.status = status;
    this.mainWindow?.webContents?.send('sync:status-update', { status, lastSync: this.lastSync });
  }

  getDeviceId() {
    const { v4: uuidv4 } = require('uuid');
    const Store = require('electron-store');
    const store = new Store();
    let id = store.get('deviceId');
    if (!id) { id = uuidv4(); store.set('deviceId', id); }
    return id;
  }
}

module.exports = { SyncManager };
