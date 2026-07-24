'use strict';

const bcrypt = require('bcryptjs');

const { pool, withTransaction } = require('../config/database');
const User = require('../models/User');
const PasswordSetupToken = require('../models/PasswordSetupToken');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../config/constants');

const BCRYPT_COST = 12;
const WEAK_PASSWORD_MESSAGE = 'Password must be at least 8 characters and contain at least one number';
const PASSWORD_PATTERN = /^(?=.*\d).{8,}$/;

/** Shared by validateToken and setPassword so both apply identical checks. */
async function resolveToken(executor, token) {
  const row = await PasswordSetupToken.findByToken(executor, token);
  if (!row) return { status: 'not_found' };
  if (row.used_at) return { status: 'used' };
  if (new Date(row.expires_at) < new Date()) return { status: 'expired' };
  return { status: 'ok', row };
}

function respondTokenError(res, status) {
  if (status === 'not_found') {
    return res.status(404).json({ error: 'Invalid or expired link' });
  }
  if (status === 'used') {
    return res.status(400).json({ error: 'This link has already been used' });
  }
  return res.status(400).json({ error: 'This link has expired. Ask staff to generate a new one.' });
}

/**
 * GET /api/auth/setup-password?token=xxx — public; the token itself is the
 * credential. Never logs the token value.
 */
async function validateToken(req, res) {
  const { token } = req.query;

  const { status, row } = await resolveToken(pool, token);
  if (status !== 'ok') {
    return respondTokenError(res, status);
  }

  const user = await User.findById(pool, row.user_id);

  return res.status(200).json({ valid: true, username: user.username });
}

/**
 * POST /api/auth/setup-password — public; the token itself is the
 * credential. Never logs the token value.
 */
async function setPassword(req, res) {
  const { token, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return res.status(400).json({ error: WEAK_PASSWORD_MESSAGE });
  }

  // Pre-check purely for a specific, friendly error message (expired vs.
  // already used vs. not found) — the actual authorization decision is the
  // atomic consumeIfValid() below.
  const { status } = await resolveToken(pool, token);
  if (status !== 'ok') {
    return respondTokenError(res, status);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const consumed = await withTransaction(null, async (client) => {
    // Atomic check-and-mark closes the race window between the read above
    // and this write, so two concurrent submissions of the same token
    // can't both succeed.
    const row = await PasswordSetupToken.consumeIfValid(client, token);
    if (!row) return null;
    await User.updatePassword(client, row.user_id, passwordHash);
    // Clears failed_attempts and reactivates a locked account — a no-op for
    // a never-locked first-time-setup account, correct behavior for a
    // forgot-password reset ("I reset my password, so unlock me too").
    await User.reactivate(client, row.user_id);
    if (row.purpose === 'password_reset') {
      await AuditLog.log(client, {
        userId: row.user_id,
        action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
        resource: 'users',
        ipAddress: req.ip,
      });
    }
    return row;
  });

  if (!consumed) {
    return res.status(400).json({ error: 'This link is no longer valid. Ask staff to generate a new one.' });
  }

  return res.status(200).json({ message: 'Password set. You can now log in.' });
}

module.exports = { validateToken, setPassword };
