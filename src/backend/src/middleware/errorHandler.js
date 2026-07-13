'use strict';

const logger = require('../config/logger');

/**
 * Centralised error handler — the last middleware registered in
 * server.js. Ensures no stack trace, SQL text, or internal detail ever
 * reaches the client, satisfying the "no information leakage" requirement
 * in the Sprint 3a route spec.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.message, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  return res.status(statusCode).json({
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
  });
}

function notFoundHandler(req, res) {
  return res.status(404).json({ error: 'Route not found', statusCode: 404 });
}

module.exports = { errorHandler, notFoundHandler };
