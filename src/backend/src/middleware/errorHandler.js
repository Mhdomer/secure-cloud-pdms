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

  // A PL/pgSQL `RAISE EXCEPTION` with no explicit ERRCODE (used by DB-level
  // business-rule triggers, e.g. enforce_visit_status_transition in
  // schema.sql) surfaces here as SQLSTATE P0001 — map it to a clean 409
  // with the trigger's own message instead of falling through to a
  // generic, unhelpful 500, consistent with how every other
  // expected-business-rule violation in this app is reported.
  if (err.code === 'P0001') {
    return res.status(409).json({ error: err.message, statusCode: 409, timestamp: new Date().toISOString() });
  }

  // multer's own errors (file too large, too many files, etc.) are
  // MulterError instances with no statusCode set — they'd otherwise fall
  // through to a generic 500 even though they're caller input errors.
  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
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
