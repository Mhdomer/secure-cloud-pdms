'use strict';

// Creates or resets the initial admin account. Deliberately NOT wired into
// schema.sql — a hardcoded username/password/hash committed to version
// control becomes a permanent, un-rotatable credential the moment it lands
// in git history. Run manually, once per environment:
//
//   ADMIN_USERNAME=admin ADMIN_PASSWORD='<a real secret, 12+ chars>' npm run seed:admin
//
// The plaintext password is read only from the environment for the
// duration of this process, used solely as input to bcrypt.hash(), and is
// never logged, printed, or written to disk.

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const BCRYPT_COST = 12;
const MIN_ADMIN_PASSWORD_LENGTH = 12;

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Usage: ADMIN_USERNAME=<username> ADMIN_PASSWORD=<password> npm run seed:admin');
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
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    await pool.query(
      `INSERT INTO users (username, password_hash, role, is_active, failed_attempts)
       VALUES ($1, $2, 'admin', true, 0)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, is_active = true, failed_attempts = 0`,
      [username, passwordHash]
    );

    console.log(`Admin account '${username}' created/updated successfully.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
});
