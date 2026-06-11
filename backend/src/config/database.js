const { Pool } = require('pg');
const { logger } = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => logger.error('Unexpected DB pool error', err));

async function testConnection() {
  const client = await pool.connect();
  const result = await client.query('SELECT version()');
  logger.info(`DB connected: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
  client.release();
}

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  logger.debug(`SQL [${Date.now() - start}ms]: ${text.slice(0, 80)}`);
  return result;
}

async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, getClient, testConnection };
