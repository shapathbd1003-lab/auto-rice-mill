require('dotenv').config();
require('express-async-errors');

const app = require('./src/app');
const { logger } = require('./src/utils/logger');
const { testConnection } = require('./src/config/database');
const { runMigrations } = require('./src/config/migrate');
const { startScheduler } = require('./src/config/scheduler');

const PORT = process.env.PORT || 3001;

async function start() {
  await testConnection();
  await runMigrations();
  app.listen(PORT, () => {
    logger.info(`Rice Mill API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
  startScheduler();
}

start().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
