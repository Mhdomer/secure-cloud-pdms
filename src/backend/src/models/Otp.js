'use strict';

/**
 * otp_verifications table — no RLS (pre-authentication data, no user_id to
 * key policies on). Every method accepts a generic `executor` (pool or
 * transaction client).
 */
class Otp {
  static async create(executor, { phoneNumber, nationalId, idType, dateOfBirth, otpHash, expiresAt }) {
    const result = await executor.query(
      `INSERT INTO otp_verifications (phone_number, national_id, id_type, date_of_birth, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING otp_id, expires_at`,
      [phoneNumber, nationalId, idType, dateOfBirth, otpHash, expiresAt]
    );
    return result.rows[0];
  }

  static async findById(executor, otpId) {
    const result = await executor.query(
      `SELECT otp_id, phone_number, national_id, id_type, date_of_birth, otp_hash, attempts, expires_at, verified_at
         FROM otp_verifications WHERE otp_id = $1`,
      [otpId]
    );
    return result.rows[0] || null;
  }

  static async incrementAttempts(executor, otpId) {
    const result = await executor.query(
      'UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = $1 RETURNING attempts',
      [otpId]
    );
    return result.rows[0]?.attempts ?? 0;
  }

  /** Single-use: only flips verified_at the first time, so a replayed correct code can't re-verify. */
  static async markVerified(executor, otpId) {
    const result = await executor.query(
      'UPDATE otp_verifications SET verified_at = NOW() WHERE otp_id = $1 AND verified_at IS NULL RETURNING otp_id',
      [otpId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Otp;
