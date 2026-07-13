'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { JWT_COOKIE_NAME, MAX_FAILED_LOGIN_ATTEMPTS, AUDIT_ACTIONS } = require('../config/constants');
const { parseDurationMs } = require('../utils/duration');
const logger = require('../config/logger');

const BCRYPT_COST = 12;
const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

// Valid-format bcrypt hash with no matching password — used to burn a
// constant amount of CPU time on the "user doesn't exist" / "account
// locked" paths so their response latency cannot be distinguished from a
// genuine wrong-password attempt on an active account (timing side-channel
// / username enumeration mitigation).
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeOtRMg7/tXqhCPhjCLyzxc/Y7BvvHJb2i';

function tokenTtlMs() {
  return parseDurationMs(process.env.JWT_EXPIRES_IN, DEFAULT_TOKEN_TTL_MS);
}

function cookieOptions() {
  return {
    httpOnly: true,
    // Kept as its own explicit flag (default true) rather than inferred
    // from NODE_ENV, so a staging/pre-prod stack behind real TLS never
    // silently ships secure:false cookies just because NODE_ENV isn't the
    // literal string "production". Only ever false for local HTTP dev.
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'strict',
    maxAge: tokenTtlMs(),
    path: '/',
  };
}

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

  const token = jwt.sign(
    { userId: user.user_id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  res.cookie(JWT_COOKIE_NAME, token, cookieOptions());

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
