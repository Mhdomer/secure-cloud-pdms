'use strict';

require('dotenv').config();

// See config/assertBootConfig.js for what this checks and why — it must run
// from every entry point, and api/index.js (the Vercel demo build) is the
// second one.
const { assertBootConfig } = require('./config/assertBootConfig');
assertBootConfig();

const app = require('./app');
const { pool } = require('./config/database');
const logger = require('./config/logger');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`pdms-backend listening on port ${PORT}`, { env: process.env.NODE_ENV || 'development' });
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    pool
      .end()
      .catch((err) => logger.error('Error draining PostgreSQL pool', { error: err.message }))
      .finally(() => process.exit(0));
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
