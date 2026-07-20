'use strict';

const jwt = require('jsonwebtoken');
const { JWT_COOKIE_NAME } = require('../config/constants');

/**
 * Verifies the JWT delivered as an httpOnly cookie and attaches the decoded
 * claims to req.user. Never accepts a token from an Authorization header —
 * the cookie-only delivery is what makes the token inaccessible to XSS
 * (Chapter 4 §4.3.8.1).
 */
function authenticateJWT(req, res, next) {
  const token = req.cookies && req.cookies[JWT_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      // Generic message regardless of expiry vs. tampering vs. bad
      // signature — do not leak which failure mode occurred.
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };
    return next();
  });
}

module.exports = { authenticateJWT };
