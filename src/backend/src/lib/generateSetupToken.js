'use strict';

const crypto = require('crypto');
const QRCode = require('qrcode');

const PasswordSetupToken = require('../models/PasswordSetupToken');

const TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Issues a one-time password-setup token for `userId` and renders it as a
 * QR code pointing at the frontend setup page. Any previous unused token
 * for this user is invalidated first, so tokens never accumulate.
 *
 * `db` is either the shared pool or a transaction client — callers that
 * create the token alongside a new user/patient row (registerPatient)
 * should pass the same client so the token is committed atomically with
 * the account, not left dangling if a later step in that transaction fails.
 *
 * `options.ttlMs`/`options.purpose` let a caller override the default
 * 72-hour/`'initial_setup'` behavior — the forgot-password flow
 * (passwordResetController.js) passes a much shorter TTL and
 * purpose: 'password_reset', since that token is a live continuation of a
 * browser session that just proved phone ownership via OTP, not a link
 * that needs to survive being physically handed to a patient. QR generation
 * is skipped for that case too, since nothing in that flow ever scans it.
 *
 * Never log the returned token/setupUrl — they are the bearer credential
 * for setting the account's first password.
 */
async function generateSetupToken(db, userId, frontendBaseUrl, options = {}) {
  const { ttlMs = TOKEN_TTL_MS, purpose = 'initial_setup' } = options;

  await PasswordSetupToken.invalidateUnusedForUser(db, userId);

  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars = 256 bits
  const expiresAt = new Date(Date.now() + ttlMs);

  await PasswordSetupToken.create(db, { userId, token, expiresAt, purpose });

  const setupUrl = `${frontendBaseUrl}/setup-password?token=${token}`;
  const qrDataUrl =
    purpose === 'password_reset'
      ? null
      : await QRCode.toDataURL(setupUrl, {
          width: 300,
          margin: 2,
          color: { dark: '#111827', light: '#ffffff' },
        });

  return { token, setupUrl, qrDataUrl, expiresAt };
}

module.exports = { generateSetupToken };
