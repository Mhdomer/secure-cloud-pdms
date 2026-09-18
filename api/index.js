'use strict';

/**
 * Vercel serverless entry point for the hosted demonstration build.
 *
 * Exists only on demo/vercel-do-not-merge — see DO-NOT-MERGE.md. The AWS
 * deployment runs src/backend/src/server.js, which calls listen(); serverless
 * needs the bare app instead. That separation already existed, so this file is
 * a re-export rather than a restructuring.
 *
 * Module scope persists across warm invocations on the same instance, so
 * requiring the app here means the pg Pool inside it is created once per
 * instance rather than once per request. Cold starts still create one. Neon's
 * POOLED endpoint must be used, or concurrent cold starts exhaust the
 * connection limit.
 *
 * app.js itself does not validate JWT_SECRET — only server.js did, and this
 * file requires app.js directly, bypassing it. Run the same check here,
 * before the require, so a placeholder secret fails the boot instead of
 * silently signing tokens with a publicly known value.
 */
const { assertBootConfig } = require('../src/backend/src/config/assertBootConfig');
assertBootConfig();

module.exports = require('../src/backend/src/app');
