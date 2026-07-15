'use strict';

const logger = require('../config/logger');

/**
 * Stub SMS provider — open decision #1 in docs/psm2/self-registration-design.md.
 * No real carrier is wired up yet, so this logs instead of sending. Callers only
 * depend on the sendOtp(phoneNumber, code) contract, not on delivery mechanics,
 * so swapping in a real provider (Twilio, AWS SNS, Unifonic, ...) later is a
 * one-file change.
 *
 * The plaintext code is only ever logged outside production — never in prod,
 * since a real provider must replace this stub before this flow goes live.
 */
async function sendOtp(phoneNumber, code) {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('OTP stub provider invoked in production — no real SMS was sent', { phoneNumber });
  } else {
    logger.info('OTP generated (stub SMS provider — not actually sent)', { phoneNumber, code });
  }
  return { delivered: false, stub: true };
}

module.exports = { sendOtp };
