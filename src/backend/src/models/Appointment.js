'use strict';

/**
 * appointments table — NO RLS (Chapter 4 §4.4.3 scopes RLS to patients and
 * medical_records only). All access boundaries for this table are enforced
 * at the application layer (rbacMiddleware + explicit ownership checks in
 * appointmentsController.js). Every method accepts a generic `executor`
 * (pool or transaction client).
 */
class Appointment {
  static async findConflict(executor, doctorId, scheduledAt, excludeAppointmentId = null) {
    const result = await executor.query(
      `SELECT appointment_id, scheduled_at
         FROM appointments
        WHERE doctor_id = $1
          AND scheduled_at = $2
          AND status = 'scheduled'
          AND appointment_id IS DISTINCT FROM $3`,
      [doctorId, scheduledAt, excludeAppointmentId]
    );
    return result.rows[0] || null;
  }

  static async create(executor, { patientId, doctorId, scheduledAt, type, notes, createdBy }) {
    const result = await executor.query(
      `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, type, notes, created_by, created_at)
       VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, NOW())
       RETURNING appointment_id, scheduled_at, status`,
      [patientId, doctorId, scheduledAt, type || 'consultation', notes || null, createdBy]
    );
    return result.rows[0];
  }

  static async findById(executor, appointmentId) {
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type, notes, created_by, created_at
         FROM appointments WHERE appointment_id = $1`,
      [appointmentId]
    );
    return result.rows[0] || null;
  }

  static async listForAdmin(executor, { limit, offset }) {
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type
         FROM appointments
        ORDER BY scheduled_at ASC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  static async listForDoctor(executor, doctorId, { limit, offset }) {
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type
         FROM appointments
        WHERE doctor_id = $1 AND status = 'scheduled'
        ORDER BY scheduled_at ASC
        LIMIT $2 OFFSET $3`,
      [doctorId, limit, offset]
    );
    return result.rows;
  }

  static async listForPatient(executor, patientId, { limit, offset }) {
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type
         FROM appointments
        WHERE patient_id = $1 AND status = 'scheduled'
        ORDER BY scheduled_at ASC
        LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );
    return result.rows;
  }

  static async update(executor, appointmentId, { doctorId, patientId, scheduledAt, type, notes }) {
    const result = await executor.query(
      `UPDATE appointments
          SET doctor_id = COALESCE($2, doctor_id),
              patient_id = COALESCE($3, patient_id),
              scheduled_at = COALESCE($4, scheduled_at),
              type = COALESCE($5, type),
              notes = COALESCE($6, notes)
        WHERE appointment_id = $1 AND status = 'scheduled'
        RETURNING appointment_id, scheduled_at, status`,
      [appointmentId, doctorId || null, patientId || null, scheduledAt || null, type || null, notes || null]
    );
    return result.rows[0] || null;
  }

  static async cancel(executor, appointmentId) {
    const result = await executor.query(
      `UPDATE appointments SET status = 'cancelled'
        WHERE appointment_id = $1 AND status = 'scheduled'
        RETURNING appointment_id, status`,
      [appointmentId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Appointment;
