const fs   = require('fs');
const path = require('path');
const { pool } = require('./database');
const { logger } = require('../utils/logger');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1', [file]
      );
      if (rows.length) {
        logger.info(`[migrate] ${file} already applied, skipping`);
        continue;
      }

      logger.info(`[migrate] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      logger.info(`[migrate] ${file} applied successfully`);
    }

    logger.info('[migrate] All migrations up to date');
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
