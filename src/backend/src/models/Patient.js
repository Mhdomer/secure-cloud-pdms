'use strict';

/**
 * patients table — RLS ENABLED (patient_select_own, doctor_select_assigned,
 * admin_select_patients / admin_insert_patients / admin_update_patients —
 * see src/config/schema.sql). Every method here MUST be called with a
 * transaction client obtained from withTransaction(session, ...), never
 * the raw pool, or the RLS session variables will not be in effect and
 * every query will silently return zero rows.
 */
class Patient {
  static async findById(client, patientId) {
    const result = await client.query(
      `SELECT patient_id, user_id, full_name, date_of_birth, gender, contact_number,
              assigned_doctor_id, created_at
         FROM patients WHERE patient_id = $1`,
      [patientId]
    );
    return result.rows[0] || null;
  }

  static async findByUserId(client, userId) {
    const result = await client.query('SELECT patient_id FROM patients WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  }

  static async register(client, { userId, fullName, dateOfBirth, gender, contactNumber, assignedDoctorId }) {
    const result = await client.query(
      `INSERT INTO patients (user_id, full_name, date_of_birth, gender, contact_number, assigned_doctor_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING patient_id, full_name, assigned_doctor_id, created_at`,
      [userId, fullName, dateOfBirth, gender || null, contactNumber || null, assignedDoctorId]
    );
    return result.rows[0];
  }

  static async update(client, patientId, { fullName, dateOfBirth, gender, contactNumber }) {
    const result = await client.query(
      `UPDATE patients
          SET full_name = COALESCE($2, full_name),
              date_of_birth = COALESCE($3, date_of_birth),
              gender = COALESCE($4, gender),
              contact_number = COALESCE($5, contact_number)
        WHERE patient_id = $1
        RETURNING patient_id, full_name, date_of_birth, gender, contact_number`,
      [patientId, fullName || null, dateOfBirth || null, gender || null, contactNumber || null]
    );
    return result.rows[0] || null;
  }

  static async assignDoctor(client, patientId, doctorId) {
    const result = await client.query(
      'UPDATE patients SET assigned_doctor_id = $2 WHERE patient_id = $1 RETURNING patient_id, assigned_doctor_id',
      [patientId, doctorId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Patient;
