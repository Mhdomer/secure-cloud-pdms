'use strict';

/**
 * users table — no RLS (Chapter 4 §4.4.3 scopes RLS to patients and
 * medical_records only). Every method accepts an `executor` — either the
 * shared pool or a transaction client from withTransaction() — so callers
 * can compose these queries into a larger atomic operation when needed
 * (e.g. user creation + doctor/patient profile insert).
 */
class User {
  static async findByUsername(executor, username) {
    const result = await executor.query(
      'SELECT user_id, username, password_hash, role, is_active, failed_attempts FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  static async findById(executor, userId) {
    const result = await executor.query(
      'SELECT user_id, username, role, is_active, created_at FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  static async usernameExists(executor, username) {
    const result = await executor.query('SELECT 1 FROM users WHERE username = $1', [username]);
    return result.rowCount > 0;
  }

  static async create(executor, { username, passwordHash, role }) {
    const result = await executor.query(
      'INSERT INTO users (username, password_hash, role, is_active) VALUES ($1, $2, $3, true) RETURNING user_id, username, role',
      [username, passwordHash, role]
    );
    return result.rows[0];
  }

  static async resetFailedAttempts(executor, userId) {
    await executor.query('UPDATE users SET failed_attempts = 0 WHERE user_id = $1', [userId]);
  }

  static async incrementFailedAttempts(executor, userId) {
    const result = await executor.query(
      'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE user_id = $1 RETURNING failed_attempts',
      [userId]
    );
    return result.rows[0]?.failed_attempts ?? 0;
  }

  static async setActive(executor, userId, isActive) {
    const result = await executor.query(
      'UPDATE users SET is_active = $2 WHERE user_id = $1 RETURNING user_id, role, is_active',
      [userId, isActive]
    );
    return result.rows[0] || null;
  }

  /** Reactivates a locked/deactivated account and clears the failed-attempt counter atomically. */
  static async reactivate(executor, userId) {
    const result = await executor.query(
      'UPDATE users SET is_active = true, failed_attempts = 0 WHERE user_id = $1 RETURNING user_id, role, is_active',
      [userId]
    );
    return result.rows[0] || null;
  }

  static async findCredentialsById(executor, userId) {
    const result = await executor.query('SELECT user_id, password_hash FROM users WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  static async updatePassword(executor, userId, passwordHash) {
    await executor.query('UPDATE users SET password_hash = $2 WHERE user_id = $1', [userId, passwordHash]);
  }
}

module.exports = User;
