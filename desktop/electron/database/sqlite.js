const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const log = require('electron-log');

let db;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'ricemill.db');
}

function initDatabase() {
  const dbPath = getDbPath();
  log.info('SQLite path:', dbPath);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema migrations
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    log.info('SQLite schema applied');
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function dbQuery(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

function dbAll(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

function dbExecute(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

function dbTransaction(fn) {
  return getDb().transaction(fn)();
}

module.exports = { initDatabase, getDb, dbQuery, dbAll, dbExecute, dbTransaction, getDbPath };
