'use strict';

/** doctors table — no RLS; a staff directory, not patient data. */
class Doctor {
  static async findById(executor, doctorId) {
    const result = await executor.query(
      'SELECT doctor_id, user_id, full_name, specialisation FROM doctors WHERE doctor_id = $1',
      [doctorId]
    );
    return result.rows[0] || null;
  }

  static async findByUserId(executor, userId) {
    const result = await executor.query('SELECT doctor_id FROM doctors WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  /** Only returns the doctor if their linked user account is active. */
  static async findActiveById(executor, doctorId) {
    const result = await executor.query(
      `SELECT d.doctor_id, d.full_name, d.specialisation
         FROM doctors d
         JOIN users u ON u.user_id = d.user_id
        WHERE d.doctor_id = $1 AND u.is_active = true`,
      [doctorId]
    );
    return result.rows[0] || null;
  }

  static async create(executor, { userId, fullName, specialisation }) {
    const result = await executor.query(
      'INSERT INTO doctors (user_id, full_name, specialisation) VALUES ($1, $2, $3) RETURNING doctor_id',
      [userId, fullName, specialisation || null]
    );
    return result.rows[0];
  }
}

module.exports = Doctor;
