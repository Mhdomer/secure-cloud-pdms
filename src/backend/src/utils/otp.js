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

/**
 * Whether an OTP code should be echoed back to the caller in the response
 * body, instead of only being delivered out-of-band.
 *
 * True outside production (the long-standing dev convenience), and also
 * true in the hosted demonstration build, which runs NODE_ENV=production so
 * Express does not leak stack traces, but has no real SMS provider wired up
 * and stores the code hashed — so a demo participant would otherwise have
 * no way to complete the flow. See
 * docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md.
 *
 * Requires the literal string 'true' for DEMO_MODE — no loose truthiness —
 * so the AWS production deployment, which never sets DEMO_MODE, is
 * unaffected.
 *
 * Extracted as a pure function of an env object (defaulting to
 * process.env) so the rule can be unit-tested directly, without standing up
 * either controller's database/bcrypt/Otp-model dependencies.
 *
 * @param {NodeJS.ProcessEnv} [env] - defaults to process.env; pass explicitly in tests
 */
function shouldSurfaceOtp(env = process.env) {
  return env.NODE_ENV !== 'production' || env.DEMO_MODE === 'true';
}

module.exports = { generateOtpCode, OTP_TTL_MS, MAX_OTP_ATTEMPTS, shouldSurfaceOtp };
