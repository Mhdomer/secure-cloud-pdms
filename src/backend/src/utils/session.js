'use strict';

const jwt = require('jsonwebtoken');

const { JWT_COOKIE_NAME } = require('../config/constants');
const { parseDurationMs } = require('./duration');

const DEFAULT_TOKEN_TTL_MS = 15 * 60 * 1000;

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

/** Signs a session JWT for `user` and sets it as the httpOnly auth cookie. Used by both login (UC-01) and self-registration (UC-19), which ends by logging the new patient straight in. */
function issueSessionCookie(res, user) {
  const token = jwt.sign(
    { userId: user.user_id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  res.cookie(JWT_COOKIE_NAME, token, cookieOptions());
}

module.exports = { cookieOptions, issueSessionCookie };
