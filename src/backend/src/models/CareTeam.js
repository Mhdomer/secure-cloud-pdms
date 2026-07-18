'use strict';

/**
 * patient_care_team table — no RLS of its own; access is gated by the
 * ADMIN/DOCTOR role checks in patients.routes.js (UC-09b), same as
 * doctor_availability. patients/medical_records/lab_results RLS policies
 * (schema.sql) reference this table directly so a doctor's SELECT access
 * there expands automatically as rows are added/removed here.
 */
class CareTeam {
  static async listByPatient(client, patientId) {
    const result = await client.query(
      `SELECT ct.assignment_id, ct.patient_id, ct.doctor_id, ct.speciality, ct.is_primary,
              ct.assigned_by, ct.assigned_at, d.full_name AS doctor_name, d.specialisation
         FROM patient_care_team ct
         JOIN doctors d ON d.doctor_id = ct.doctor_id
        WHERE ct.patient_id = $1
        ORDER BY ct.is_primary DESC, ct.assigned_at ASC`,
      [patientId]
    );
    return result.rows;
  }

  /** Re-adding a doctor already on the team upserts speciality/is_primary rather than 409ing. */
  static async add(client, { patientId, doctorId, speciality, isPrimary, assignedBy }) {
    const result = await client.query(
      `INSERT INTO patient_care_team (patient_id, doctor_id, speciality, is_primary, assigned_by)
       VALUES ($1, $2, $3, COALESCE($4, false), $5)
       ON CONFLICT (patient_id, doctor_id)
         DO UPDATE SET speciality = EXCLUDED.speciality, is_primary = EXCLUDED.is_primary
       RETURNING assignment_id, patient_id, doctor_id, speciality, is_primary, assigned_by, assigned_at`,
      [patientId, doctorId, speciality || null, isPrimary, assignedBy || null]
    );
    return result.rows[0];
  }

  /** The primary/registration doctor can't be removed here — only reassigned via Patient.assignDoctor. */
  static async remove(client, patientId, assignmentId) {
    const result = await client.query(
      `DELETE FROM patient_care_team
        WHERE assignment_id = $1 AND patient_id = $2 AND is_primary = false
       RETURNING assignment_id`,
      [assignmentId, patientId]
    );
    return result.rows[0] || null;
  }
}

module.exports = CareTeam;
