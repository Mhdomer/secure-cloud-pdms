'use strict';

// Creates or resets the initial superadmin/admin account. Deliberately NOT
// wired into schema.sql — a hardcoded username/password/hash committed to
// version control becomes a permanent, un-rotatable credential the moment
// it lands in git history. Run manually, once per environment:
//
//   ADMIN_USERNAME=admin ADMIN_PASSWORD='<a real secret, 12+ chars>' npm run seed:admin
//
// ADMIN_ROLE defaults to 'superadmin' since that's the only role with no
// other bootstrap path (POST /api/users requires superadmin auth to create
// doctor/admin accounts, so a superadmin must exist before anyone else can).
// Pass ADMIN_ROLE=admin explicitly if you specifically need a legacy admin
// row instead.
//
// The plaintext password is read only from the environment for the
// duration of this process, used solely as input to bcrypt.hash(), and is
// never logged, printed, or written to disk.

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { ROLES } = require('../src/config/constants');

const BCRYPT_COST = 12;
const MIN_ADMIN_PASSWORD_LENGTH = 12;
const SEEDABLE_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN];

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const role = process.env.ADMIN_ROLE || ROLES.SUPERADMIN;

  if (!username || !password) {
    console.error('Usage: ADMIN_USERNAME=<username> ADMIN_PASSWORD=<password> [ADMIN_ROLE=superadmin|admin] npm run seed:admin');
    process.exitCode = 1;
    return;
  }

  if (!SEEDABLE_ROLES.includes(role)) {
    console.error(`ADMIN_ROLE must be one of: ${SEEDABLE_ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    console.error(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });

  try {
    // Refuse to silently reassign role on an existing account — a typo'd or
    // reused username here (e.g. a doctor's) must not turn into an
    // unintended privilege escalation just by re-running this script with
    // ADMIN_ROLE defaulting to superadmin.
    const existing = await pool.query('SELECT role FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0 && existing.rows[0].role !== role) {
      console.error(
        `Refusing to reassign '${username}' from role '${existing.rows[0].role}' to '${role}'. ` +
          `Deactivate/rename the existing account first if this is intentional.`
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await pool.query(
      `INSERT INTO users (username, password_hash, role, is_active, failed_attempts)
       VALUES ($1, $2, $3, true, 0)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true, failed_attempts = 0`,
      [username, passwordHash, role]
    );

    console.log(`Account '${username}' (${role}) created/updated successfully.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
});
