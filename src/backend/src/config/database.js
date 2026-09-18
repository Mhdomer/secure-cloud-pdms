'use strict';

const fs = require('fs');
const { Pool } = require('pg');
const logger = require('./logger');

// Amazon RDS's regional CA (rds-ca-rsa2048-g1) chains to a private AWS
// root that is NOT in Node's bundled trust store, so rejectUnauthorized:
// true alone would fail every connection. src/backend/Dockerfile fetches
// the global bundle to this path at image build time. Read lazily and only
// when DB_SSL=true, so local dev (DB_SSL=false, no bundle on disk) is
// unaffected.
const RDS_CA_BUNDLE_PATH = '/app/rds-global-bundle.pem';

const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    // Fail fast at boot rather than surfacing a confusing pg connection
    // error on the first request.
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// DB_SSL_MODE only means anything once TLS itself is on. Without this guard,
// setting DB_SSL_MODE while leaving DB_SSL unset/false silently disables TLS
// entirely (the ssl ternary below short-circuits on DB_SSL first) with no
// signal that the mode was ignored.
if (process.env.DB_SSL_MODE && process.env.DB_SSL !== 'true') {
  throw new Error('DB_SSL_MODE requires DB_SSL=true');
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // rds.force_ssl = 1 is enforced server-side (Chapter 4 §4.3.8.5); the
  // client must also request SSL or the connection is rejected outright.
  //
  // DB_SSL_MODE=standard verifies against Node's bundled public trust store
  // instead of the RDS private root — for managed providers (Neon, Supabase)
  // that present a publicly trusted certificate and ship no CA bundle.
  //
  // There is deliberately no fallback from the RDS path to this one. If the
  // bundle is missing, the connection must fail rather than quietly verify
  // against a different trust anchor; a silent TLS downgrade is precisely the
  // class of defect this system exists to avoid. Certificate verification
  // stays on in every mode.
  ssl:
    process.env.DB_SSL === 'true'
      ? process.env.DB_SSL_MODE === 'standard'
        ? { rejectUnauthorized: true }
        : {
          rejectUnauthorized: true,
          ca: fs.readFileSync(RDS_CA_BUNDLE_PATH).toString(),
        }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Errors on idle clients in the pool (e.g. connection dropped by RDS) —
  // must be handled or the process crashes on the next unrelated request.
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
});

/**
 * Runs `callback` inside a single PostgreSQL transaction on a dedicated
 * pooled client, with RLS session variables applied via set_config(...,
 * true) — i.e. SET LOCAL semantics, scoped to this transaction only.
 *
 * This MUST be used for every query against `patients` or `medical_records`
 * (the two RLS-protected tables). Using pool.query() directly for those
 * tables would either run outside a transaction (session variables never
 * take effect) or reuse a connection from a previous request that still has
 * a different session's variables applied.
 *
 * @param {{userId?: string, role?: string, doctorId?: string|null, patientId?: string|null}|null} session
 *   Pass null only for genuinely unauthenticated queries (e.g. the login
 *   lookup against `users`, which has no RLS).
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 * @param {{isolationLevel?: 'SERIALIZABLE'}} [options]
 *   Pass isolationLevel: 'SERIALIZABLE' for the appointment conflict-check
 *   + insert/update pair (Figure 4.12) so two concurrent requests for the
 *   same doctor/slot cannot both pass the conflict check before either
 *   commits — Postgres aborts the loser with a 40001 serialization_failure,
 *   which callers should map to HTTP 409.
 * @returns {Promise<any>}
 */
async function withTransaction(session, callback, options = {}) {
  const client = await pool.connect();
  try {
    if (options.isolationLevel === 'SERIALIZABLE') {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    } else {
      await client.query('BEGIN');
    }

    if (session) {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', session.userId || '']);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_role', session.role || '']);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_doctor_id', session.doctorId || '']);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_patient_id', session.patientId || '']);
    }

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Rollback failed', { error: rollbackErr.message });
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
