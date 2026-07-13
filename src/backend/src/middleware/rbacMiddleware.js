'use strict';

/**
 * Application-layer RBAC — the first of the two independent authorisation
 * layers described in Chapter 4 §4.3.8.2 (the second is PostgreSQL RLS).
 * Must run after authenticateJWT so req.user is populated.
 *
 * @param {...string} roles - allowed roles for this route, e.g. authorizeRole('doctor')
 */
function authorizeRole(...roles) {
  return function rbac(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource' });
    }
    return next();
  };
}

module.exports = { authorizeRole };
