'use strict';

const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { MAX_FAILED_LOGIN_ATTEMPTS, AUDIT_ACTIONS, JWT_COOKIE_NAME } = require('../config/constants');
const { cookieOptions, issueSessionCookie } = require('../utils/session');
const logger = require('../config/logger');

const BCRYPT_COST = 12;

// Valid-format bcrypt hash with no matching password — used to burn a
// constant amount of CPU time on the "user doesn't exist" / "account
// locked" paths so their response latency cannot be distinguished from a
// genuine wrong-password attempt on an active account (timing side-channel
// / username enumeration mitigation).
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOtRMg7/tXqhCPhjCLyzxc/Y7BvvHJb2i';

/**
 * UC-01 / Figure 4.10 — User Login.
 * Password is only ever compared through bcrypt.compare against the
 * stored hash; the plaintext password is never logged.
 */
async function login(req, res) {
  const { username, password } = req.body;
  const ipAddress = req.ip;

  const user = await User.findByUsername(pool, username);

  if (!user || !user.is_active) {
    // Run a real bcrypt compare against a dummy hash so this path takes
    // roughly the same time as a wrong-password attempt against a real,
    // active account — otherwise response latency alone reveals whether a
    // username exists or is locked (reconnaissance for the lockout DoS).
    await bcrypt.compare(password, DUMMY_HASH);
    await AuditLog.log(pool, {
      userId: user ? user.user_id : null,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      resource: 'users',
      ipAddress,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const attempts = await User.incrementFailedAttempts(pool, user.user_id);

    if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await User.setActive(pool, user.user_id, false);
      await AuditLog.log(pool, { userId: user.user_id, action: AUDIT_ACTIONS.ACCOUNT_LOCKOUT, resource: 'users', ipAddress });
      logger.warn('Account locked after repeated failed logins', { userId: user.user_id });
    } else {
      await AuditLog.log(pool, { userId: user.user_id, action: AUDIT_ACTIONS.LOGIN_FAILED, resource: 'users', ipAddress });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  }

  await withTransaction(null, async (client) => {
    await User.resetFailedAttempts(client, user.user_id);
    await AuditLog.log(client, { userId: user.user_id, action: AUDIT_ACTIONS.LOGIN, resource: 'users', ipAddress });
  });

  issueSessionCookie(res, user);

  return res.status(200).json({
    userId: user.user_id,
    username: user.username,
    role: user.role,
    redirectUrl: `/dashboard/${user.role}`,
  });
}

/** UC-02 — User Logout. JWT is stateless; clearing the cookie is sufficient. */
async function logout(req, res) {
  const { maxAge, ...clearOptions } = cookieOptions();
  res.clearCookie(JWT_COOKIE_NAME, clearOptions);

  await AuditLog.log(pool, {
    userId: req.user.userId,
    action: AUDIT_ACTIONS.LOGOUT,
    resource: 'users',
    ipAddress: req.ip,
  });

  return res.status(200).json({ message: 'Logged out successfully' });
}

module.exports = { login, logout };
