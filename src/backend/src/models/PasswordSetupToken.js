'use strict';

/**
 * password_setup_tokens table — no RLS (see schema.sql). Every method
 * accepts an executor (pool or transaction client) so callers can compose
 * these queries into a larger atomic operation, e.g. registerPatient
 * creating the user, patient, and setup token in one transaction.
 */
class PasswordSetupToken {
  static async invalidateUnusedForUser(executor, userId) {
    await executor.query(
      `UPDATE password_setup_tokens SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
  }

  static async create(executor, { userId, token, expiresAt }) {
    const result = await executor.query(
      `INSERT INTO password_setup_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING token_id, user_id, expires_at`,
      [userId, token, expiresAt]
    );
    return result.rows[0];
  }

  static async findByToken(executor, token) {
    const result = await executor.query(
      `SELECT token_id, user_id, token, expires_at, used_at
         FROM password_setup_tokens WHERE token = $1`,
      [token]
    );
    return result.rows[0] || null;
  }

  /**
   * Atomically marks a token used only if it is still valid, returning the
   * linked user_id (or null). Doing the check and the write in one
   * statement closes the race window a plain "find, then update" would
   * leave between two concurrent submissions of the same token.
   */
  static async consumeIfValid(executor, token) {
    const result = await executor.query(
      `UPDATE password_setup_tokens SET used_at = NOW()
        WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
        RETURNING user_id`,
      [token]
    );
    return result.rows[0] || null;
  }
}

module.exports = PasswordSetupToken;
