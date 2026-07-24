'use strict';

require('dotenv').config();

// Fail fast at boot rather than surfacing a confusing jsonwebtoken error on
// the first login attempt — consistent with the DB_* and CLOUDFRONT_ORIGIN
// checks in config/database.js and middleware/corsValidator.js.
//
// Length alone doesn't catch a known, well-formed placeholder string — the
// checked-in .env.example / dev default is long enough (64 chars) to pass a
// bare length check while still being a publicly known value anyone could
// forge tokens with, so it's rejected by name too.
const KNOWN_DEV_PLACEHOLDERS = [
  'dev_only_change_this_in_production_use_64_random_chars_minimum',
  'change_me_to_a_64_char_random_string',
];
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
}
if (KNOWN_DEV_PLACEHOLDERS.includes(process.env.JWT_SECRET)) {
  throw new Error('JWT_SECRET is still set to a known placeholder value — generate a real random secret');
}

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
