require('dotenv').config();
require('express-async-errors');

const app = require('./src/app');
const { logger } = require('./src/utils/logger');
const { testConnection } = require('./src/config/database');
const { runMigrations } = require('./src/config/migrate');
const { startScheduler } = require('./src/config/scheduler');

const PORT = process.env.PORT || 3001;

async function waitForDb(retries = 10, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await testConnection();
      return;
    } catch (err) {
      logger.warn(`DB not ready (attempt ${i}/${retries}): ${err.message}`);
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function start() {
  const dbUrl = process.env.DATABASE_URL || '(not set)';
  logger.info(`DB URL: ${dbUrl.replace(/:([^@]+)@/, ':***@')}`);

  // Start HTTP server first so Railway healthcheck passes
  await new Promise(resolve => app.listen(PORT, () => {
    logger.info(`Rice Mill API running on port ${PORT} [${process.env.NODE_ENV}]`);
    resolve();
  }));

  // Then connect to DB with retries
  try {
    await waitForDb(15, 5000);
    await runMigrations();
    startScheduler();
  } catch (err) {
    logger.error('DB connection failed after retries — server running without DB', err);
  }
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
