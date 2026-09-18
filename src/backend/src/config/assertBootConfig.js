'use strict';

// Validates JWT_SECRET at boot. This must run from every process entry point
// that can serve requests — today that's src/backend/src/server.js (the
// AWS/local listener) and api/index.js (the Vercel serverless demo build,
// which requires app.js directly and never executes server.js, so it would
// otherwise boot with no boot-time validation at all). Any future entry
// point needs to call this too.
function assertBootConfig() {
  // Fail fast at boot rather than surfacing a confusing jsonwebtoken error on
  // the first login attempt — consistent with the DB_* and CLOUDFRONT_ORIGIN
  // checks in config/database.js and middleware/corsValidator.js.
  //
  // Length alone doesn't catch a known, well-formed placeholder string — the
  // checked-in .env.example / dev default is long enough (64 chars) to pass a
  // bare length check while still being a publicly known value anyone could
  // forge tokens with, so it's rejected by name too.
  const KNOWN_DEV_PLACEHOLDERS = [
    'dev_only_change_this_in_production_use_64_random_chars_minimum',
    'change_me_to_a_64_char_random_string',
  ];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
  }
  if (KNOWN_DEV_PLACEHOLDERS.includes(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET is still set to a known placeholder value — generate a real random secret');
  }
}

module.exports = { assertBootConfig };
