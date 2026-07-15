'use strict';

const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

/** Cryptographically random 6-digit numeric code, zero-padded. */
function generateOtpCode() {
  const value = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return value.toString().padStart(OTP_LENGTH, '0');
}

module.exports = { generateOtpCode, OTP_TTL_MS, MAX_OTP_ATTEMPTS };
