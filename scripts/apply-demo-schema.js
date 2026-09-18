'use strict';

/**
 * Applies the role bootstrap and then schema.sql to a Neon database.
 *
 * Runs over the DIRECT connection, never the pooled one — DDL cannot go through
 * PgBouncer in transaction mode. `psql` is not on PATH in this environment, so
 * this is the runner.
 *
 * Usage:
 *   node scripts/apply-demo-schema.js demo
 *   node scripts/apply-demo-schema.js uat
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ENV_PATH = path.join(__dirname, '..', 'src', 'backend', '.env.demo.local');
require('dotenv').config({ path: ENV_PATH });

const target = (process.argv[2] || 'demo').toUpperCase();
const directUrl = process.env[`${target}_DIRECT_URL`];
const appPassword = process.env.PDMS_APP_PASSWORD;

if (!directUrl) throw new Error(`${target}_DIRECT_URL is not set in ${ENV_PATH}`);
if (!appPassword) throw new Error(`PDMS_APP_PASSWORD is not set in ${ENV_PATH}`);
if (/-pooler\./.test(directUrl)) {
  throw new Error(`${target}_DIRECT_URL points at the pooled host. DDL needs the direct one.`);
}

// The role password is substituted here rather than passed as a bind parameter,
// because CREATE ROLE does not accept bind parameters. It is safe only because
// the value is locally generated base64url with no quote characters — never
// interpolate a user-supplied string into this position.
if (!/^[A-Za-z0-9_-]+$/.test(appPassword)) {
  throw new Error('PDMS_APP_PASSWORD must be alphanumeric/underscore/hyphen only for safe interpolation.');
}

const initSql = fs
  .readFileSync(path.join(__dirname, 'init-demo-db.sql'), 'utf8')
  .replace(/:'app_password'/g, `'${appPassword}'`);

const schemaSql = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'backend', 'src', 'config', 'schema.sql'),
  'utf8'
);

(async () => {
  const client = new Client({ connectionString: directUrl });
  await client.connect();
  const who = await client.query('SELECT current_user, current_database()');
  console.log('connected as %s to %s', who.rows[0].current_user, who.rows[0].current_database);

  client.on('notice', (n) => console.log('  notice:', n.message));

  console.log('applying init-demo-db.sql ...');
  await client.query(initSql);
  console.log('  role pdms_app ready');

  console.log('applying schema.sql (%d KB) ...', Math.round(schemaSql.length / 1024));
  await client.query(schemaSql);
  console.log('  schema applied');

  const rls = await client.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relkind = 'r' AND relrowsecurity = true
      ORDER BY relname`
  );
  console.log('\nRLS-protected tables (%d):', rls.rows.length);
  rls.rows.forEach((r) => console.log('  %s force=%s', r.relname, r.relforcerowsecurity));

  const tables = await client.query(
    `SELECT count(*)::int AS n FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`
  );
  console.log('\ntotal tables: %d', tables.rows[0].n);

  const fns = await client.query(
    `SELECT p.proname, p.prosecdef, pg_get_userbyid(p.proowner) AS owner
       FROM pg_proc p
      WHERE p.proname IN ('appointment_conflict_id', 'doctor_slot_taken')`
  );
  console.log('\nSECURITY DEFINER helpers:');
  fns.rows.forEach((r) => console.log('  %s secdef=%s owner=%s', r.proname, r.prosecdef, r.owner));

  await client.end();
})().catch((e) => {
  console.log('FAILED:', e.message);
  if (e.position) console.log('  at character position', e.position);
  process.exitCode = 1;
});
