'use strict';

/**
 * Wipes and re-seeds a demo database.
 *
 * Run manually — deliberately NOT exposed as an HTTP endpoint and NOT on a
 * schedule. Two reasons:
 *
 *   1. `pdms_app` has no TRUNCATE or DELETE grant (schema.sql withholds it on
 *      purpose), so a reset must connect as the database owner. The owner has
 *      BYPASSRLS, which is exactly the privilege every row-level security
 *      policy in this system exists to deny. Handing that credential to a
 *      public-facing web app to support a convenience feature is a bad trade on
 *      a project whose subject is data isolation.
 *
 *   2. A GitHub Actions `schedule:` trigger only fires on the repository's
 *      DEFAULT branch. This branch is never merged, so a workflow here would
 *      never run; putting one on `main` would move demo concerns and a
 *      RLS-bypassing credential onto the production branch.
 *
 * Manual reset is enough for the way this demo is actually used — before a UAT
 * session, before a demonstration. If it ever needs to be unattended, add a
 * workflow on `main` that runs this script with the owner URL as a repository
 * secret; do not add an endpoint to the app.
 *
 * Usage:
 *   node scripts/reset-demo.js          # resets the demo database
 *   node scripts/reset-demo.js uat      # resets the uat database
 *
 * Credentials come from src/backend/.env.demo.local (gitignored).
 */

const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', 'src', 'backend', '.env.demo.local'),
});

const { seed, truncateAll } = require('./seed-demo');

const target = (process.argv[2] || 'demo').toLowerCase();

async function reset() {
  const label = target.toUpperCase();
  if (!process.env[`${label}_DIRECT_URL`]) {
    throw new Error(
      `${label}_DIRECT_URL is not set in src/backend/.env.demo.local — nothing to reset.`
    );
  }

  console.log('resetting the %s database ...', target);
  await truncateAll();
  console.log('  truncated');
  await seed();
  console.log('  re-seeded');
  console.log('done.');
}

if (require.main === module) {
  reset().catch((err) => {
    console.error('reset failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { reset };
