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

module.exports = { globalLimiter, loginLimiter };
