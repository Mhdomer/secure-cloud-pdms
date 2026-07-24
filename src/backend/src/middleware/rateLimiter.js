'use strict';

const rateLimit = require('express-rate-limit');

// Chapter 4 §4.3.8.3's original 100 requests / 15 min was tuned as a per-IP
// ceiling, but express-rate-limit's default keyGenerator is req.ip — an
// entire clinic (every doctor, admin, and nurse on shift, all day) sits
// behind one shared office NAT gateway, so they all draw from the same
// budget. This app's own dashboard polling (30s refetch intervals on the
// doctor's queue/sidebar) plus ordinary multi-page use across a 9-10 hour
// shift comfortably exceeds 100 requests in 15 minutes on its own — the
// limiter was tripping on legitimate concurrent staff use, not abuse. Raised
// to a ceiling that still catches real scraping/DoS volumes without
// disrupting normal clinic traffic; the endpoints that actually need a
// tight, security-meaningful ceiling (login, OTP) keep their own dedicated,
// far stricter limiters below, applied on top of this one.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
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

// Forgot-password (phone OTP reset) — a separate instance from
// otpRequestLimiter even though the shape is identical, so a patient's
// registration-OTP attempts and password-reset-OTP attempts don't drain the
// same per-phone budget (two semantically distinct actions sharing one
// counter would be a surprising cross-feature coupling).
const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.phone_number || req.ip,
  message: { error: 'Too many password reset requests for this number. Please try again later.' },
});

module.exports = { globalLimiter, loginLimiter, otpRequestLimiter, otpVerifyLimiter, passwordResetRequestLimiter };
