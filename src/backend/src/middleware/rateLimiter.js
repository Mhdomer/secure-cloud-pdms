'use strict';

const rateLimit = require('express-rate-limit');

// Chapter 4 §4.3.8.3 — 100 requests / 15 min globally, 10 requests / 15 min
// on the login endpoint specifically (brute-force mitigation, layered on
// top of the 3-strikes account lockout in authController).
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// UC-19 patient self-registration (docs/psm2/self-registration-design.md).
// Keyed on the phone number itself, not IP — a mobile user switching
// networks shouldn't reset the limit, and the resource actually being
// protected (SMS send cost / number spam) is per-phone, not per-connection.
// The existing globalLimiter above still applies its own per-IP ceiling on
// top of this since it runs on every /api route.
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone_number || req.ip,
  message: { error: 'Too many verification code requests for this number. Please try again later.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.requestId || req.ip,
  message: { error: 'Too many attempts. Please request a new code.' },
});

module.exports = { globalLimiter, loginLimiter, otpRequestLimiter, otpVerifyLimiter };
