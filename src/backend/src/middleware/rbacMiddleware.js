'use strict';

const { ROLES } = require('../config/constants');

/**
 * Application-layer RBAC — the first of the two independent authorisation
 * layers described in Chapter 4 §4.3.8.2 (the second is PostgreSQL RLS).
 * Must run after authenticateJWT so req.user is populated.
 *
 * Superadmin implicitly inherits all role permissions — routes that list
 * only ADMIN (or any other role) do not need to be updated to include
 * SUPERADMIN explicitly.
 *
 * @param {...string} roles - allowed roles for this route, e.g. authorizeRole('doctor')
 */
function authorizeRole(...roles) {
  return function rbac(req, res, next) {
    if (!req.user) {
      return res.status(403).json({ error: 'You do not have permission to access this resource' });
    }
    if (req.user.role === ROLES.SUPERADMIN || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'You do not have permission to access this resource' });
  };
}

module.exports = { authorizeRole };
