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
 * Never log the returned token/setupUrl — they are the bearer credential
 * for setting the account's first password.
 */
async function generateSetupToken(db, userId, frontendBaseUrl) {
  await PasswordSetupToken.invalidateUnusedForUser(db, userId);

  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars = 256 bits
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await PasswordSetupToken.create(db, { userId, token, expiresAt });

  const setupUrl = `${frontendBaseUrl}/setup-password?token=${token}`;
  const qrDataUrl = await QRCode.toDataURL(setupUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#111827', light: '#ffffff' },
  });

  return { token, setupUrl, qrDataUrl, expiresAt };
}

module.exports = { generateSetupToken };
