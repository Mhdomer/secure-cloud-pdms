'use strict';

/**
 * Minimal duration parser for strings like '15m', '900s', '1h', '8h', or a
 * bare number of seconds (jsonwebtoken's `expiresIn` format). Used so the
 * JWT cookie's maxAge always matches JWT_EXPIRES_IN instead of a
 * hardcoded, independently-maintained constant that can silently drift.
 */
const UNIT_MS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };

function parseDurationMs(value, fallbackMs) {
  if (!value) return fallbackMs;

  if (/^\d+$/.test(value)) {
    return Number(value) * 1000; // bare number = seconds, per jsonwebtoken convention
  }

  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return fallbackMs;

  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}

module.exports = { parseDurationMs };
