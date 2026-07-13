'use strict';

/**
 * Wraps an async Express handler/middleware so rejected promises are
 * forwarded to next(err) instead of crashing the process or hanging the
 * request. Every controller and RLS-aware middleware in this codebase is
 * async, so this wrapper is applied everywhere instead of repeating
 * try/catch in each handler.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
