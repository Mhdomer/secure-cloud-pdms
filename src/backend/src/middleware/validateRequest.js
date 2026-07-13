'use strict';

const { validationResult } = require('express-validator');

/**
 * Runs after an array of express-validator chains and short-circuits with
 * HTTP 422 + field-level detail if any of them failed. Placed before the
 * JWT/RBAC middleware in every route so malformed input never reaches an
 * authenticated code path.
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const details = {};
  for (const err of errors.array()) {
    details[err.path] = err.msg;
  }

  return res.status(422).json({
    error: 'Validation failed',
    statusCode: 422,
    timestamp: new Date().toISOString(),
    details,
  });
}

module.exports = validateRequest;
