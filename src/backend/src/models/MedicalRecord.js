'use strict';

/**
 * medical_records table — RLS ENABLED (doctor_select/insert/update_records,
 * patient_select_records, admin_blocked_records). Every method here MUST be
 * called with a transaction client from withTransaction(session, ...).
 */
class MedicalRecord {
  static async create(client, { patientId, doctorId, diagnosis, prescription, notes }) {
    const result = await client.query(
      `INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING record_id, created_at`,
      [patientId, doctorId, diagnosis, prescription || null, notes || null]
    );
    return result.rows[0];
  }

  static async findById(client, recordId) {
    const result = await client.query(
      `SELECT record_id, patient_id, doctor_id, diagnosis, prescription, notes, created_at, updated_at
         FROM medical_records WHERE record_id = $1`,
      [recordId]
    );
    return result.rows[0] || null;
  }

  static async listByDoctor(client, doctorId, { limit, offset }) {
    const result = await client.query(
      `SELECT record_id, patient_id, diagnosis, created_at, updated_at
         FROM medical_records
        WHERE doctor_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [doctorId, limit, offset]
    );
    return result.rows;
  }

  static async listByPatient(client, patientId, { limit, offset }) {
    const result = await client.query(
      `SELECT record_id, patient_id, diagnosis, created_at, updated_at
         FROM medical_records
        WHERE patient_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );
    return result.rows;
  }

  /** Doctor's history for one specific assigned patient (UC-13). */
  static async listByPatientAndDoctor(client, patientId, doctorId, { limit, offset }) {
    const result = await client.query(
      `SELECT record_id, diagnosis, prescription, notes, created_at, updated_at
         FROM medical_records
        WHERE patient_id = $1 AND doctor_id = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4`,
      [patientId, doctorId, limit, offset]
    );
    return result.rows;
  }

  static async countByDoctor(client, doctorId) {
    const result = await client.query('SELECT COUNT(*)::int AS total FROM medical_records WHERE doctor_id = $1', [doctorId]);
    return result.rows[0].total;
  }

  static async countByPatient(client, patientId) {
    const result = await client.query('SELECT COUNT(*)::int AS total FROM medical_records WHERE patient_id = $1', [patientId]);
    return result.rows[0].total;
  }

  static async countByPatientAndDoctor(client, patientId, doctorId) {
    const result = await client.query(
      'SELECT COUNT(*)::int AS total FROM medical_records WHERE patient_id = $1 AND doctor_id = $2',
      [patientId, doctorId]
    );
    return result.rows[0].total;
  }

  static async update(client, recordId, { diagnosis, prescription, notes }) {
    const result = await client.query(
      `UPDATE medical_records
          SET diagnosis = COALESCE($2, diagnosis),
              prescription = COALESCE($3, prescription),
              notes = COALESCE($4, notes),
              updated_at = NOW()
        WHERE record_id = $1
        RETURNING record_id, updated_at`,
      // `?? null`, not `|| null` — an explicit empty string (clearing
      // prescription/notes, which validation allows unlike diagnosis) must
      // reach COALESCE as '' so it actually clears the column, not get
      // coerced into NULL, which COALESCE would then treat as "keep the old
      // value" and silently no-op the clear.
      [recordId, diagnosis ?? null, prescription ?? null, notes ?? null]
    );
    // rowCount is 0 both when the record doesn't exist AND when the RLS
    // UPDATE policy rejects it (doctor_id mismatch) — callers must treat
    // both cases identically (404) to avoid leaking existence information.
    return result.rows[0] || null;
  }
}

module.exports = MedicalRecord;
