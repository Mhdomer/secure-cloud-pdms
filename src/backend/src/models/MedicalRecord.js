'use strict';

/**
 * medical_records table — RLS ENABLED (doctor_select/insert/update_records,
 * patient_select_records, admin_blocked_records). Every method here MUST be
 * called with a transaction client from withTransaction(session, ...).
 */
class MedicalRecord {
  static async create(
    client,
    { patientId, doctorId, diagnosis, prescription, notes, chiefComplaint, objective, assessment, plan, vitalSigns, prescriptionsData, visitType }
  ) {
    const result = await client.query(
      `INSERT INTO medical_records (
         patient_id, doctor_id, diagnosis, prescription, notes, created_at,
         chief_complaint, objective, assessment, plan, vital_signs, prescriptions_data, visit_type
       )
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, COALESCE($12, 'consultation'))
       RETURNING record_id, created_at`,
      [
        patientId,
        doctorId,
        diagnosis,
        prescription || null,
        notes || null,
        chiefComplaint,
        objective || null,
        assessment || null,
        plan || null,
        vitalSigns ? JSON.stringify(vitalSigns) : null,
        prescriptionsData ? JSON.stringify(prescriptionsData) : null,
        visitType || null,
      ]
    );
    return result.rows[0];
  }

  static async findById(client, recordId) {
    const result = await client.query(
      `SELECT mr.record_id, mr.patient_id, mr.doctor_id, mr.diagnosis, mr.prescription, mr.notes, mr.created_at, mr.updated_at,
              mr.chief_complaint, mr.objective, mr.assessment, mr.plan, mr.vital_signs, mr.prescriptions_data, mr.visit_type,
              d.full_name AS doctor_name
         FROM medical_records mr
         LEFT JOIN doctors d ON d.doctor_id = mr.doctor_id
        WHERE mr.record_id = $1`,
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
      `SELECT mr.record_id, mr.patient_id, mr.doctor_id, mr.diagnosis, mr.prescription, mr.notes,
              mr.chief_complaint, mr.objective, mr.assessment, mr.plan, mr.vital_signs, mr.prescriptions_data, mr.visit_type,
              mr.created_at, mr.updated_at,
              d.full_name AS doctor_name
         FROM medical_records mr
         LEFT JOIN doctors d ON d.doctor_id = mr.doctor_id
        WHERE mr.patient_id = $1
        ORDER BY mr.created_at DESC
        LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );
    return result.rows;
  }

  /** Doctor's history for one specific assigned patient (UC-13). */
  static async listByPatientAndDoctor(client, patientId, doctorId, { limit, offset }) {
    const result = await client.query(
      `SELECT record_id, diagnosis, prescription, notes, vital_signs, created_at, updated_at
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

  static async update(
    client,
    recordId,
    { diagnosis, prescription, notes, chiefComplaint, objective, assessment, plan, vitalSigns, visitType }
  ) {
    const result = await client.query(
      `UPDATE medical_records
          SET diagnosis = COALESCE($2, diagnosis),
              prescription = COALESCE($3, prescription),
              notes = COALESCE($4, notes),
              chief_complaint = COALESCE($5, chief_complaint),
              objective = COALESCE($6, objective),
              assessment = COALESCE($7, assessment),
              plan = COALESCE($8, plan),
              vital_signs = COALESCE($9, vital_signs),
              visit_type = COALESCE($10, visit_type),
              updated_at = NOW()
        WHERE record_id = $1
        RETURNING record_id, updated_at`,
      // `?? null`, not `|| null` — an explicit empty string (clearing
      // prescription/notes, which validation allows unlike diagnosis) must
      // reach COALESCE as '' so it actually clears the column, not get
      // coerced into NULL, which COALESCE would then treat as "keep the old
      // value" and silently no-op the clear.
      [
        recordId,
        diagnosis ?? null,
        prescription ?? null,
        notes ?? null,
        chiefComplaint ?? null,
        objective ?? null,
        assessment ?? null,
        plan ?? null,
        vitalSigns ? JSON.stringify(vitalSigns) : null,
        visitType || null,
      ]
    );
    // rowCount is 0 both when the record doesn't exist AND when the RLS
    // UPDATE policy rejects it (doctor_id mismatch) — callers must treat
    // both cases identically (404) to avoid leaking existence information.
    return result.rows[0] || null;
  }
}

module.exports = MedicalRecord;
