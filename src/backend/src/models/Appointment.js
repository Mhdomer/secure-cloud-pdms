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
          AND status IN ('scheduled', 'confirmed')
          AND appointment_id IS DISTINCT FROM $3`,
      [doctorId, scheduledAt, excludeAppointmentId]
    );
    return result.rows[0] || null;
  }

  static async create(executor, { patientId, doctorId, scheduledAt, type, notes, createdBy, durationMinutes }) {
    const result = await executor.query(
      `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, type, notes, created_by, created_at, duration_minutes)
       VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, NOW(), COALESCE($7, 30))
       RETURNING appointment_id, scheduled_at, status, duration_minutes`,
      [patientId, doctorId, scheduledAt, type || 'consultation', notes || null, createdBy, durationMinutes || null]
    );
    return result.rows[0];
  }

  static async findById(executor, appointmentId) {
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type, notes, created_by, created_at,
              duration_minutes, cancelled_by, cancellation_note
         FROM appointments WHERE appointment_id = $1`,
      [appointmentId]
    );
    return result.rows[0] || null;
  }

  /**
   * `from`/`to` are optional ISO8601 bounds on `scheduled_at` (inclusive/exclusive).
   * Without them, `ORDER BY scheduled_at ASC LIMIT` alone silently returns the
   * *oldest* rows once the table has more than `limit` appointments ever
   * recorded — a "today's schedule" caller with no date bound would eventually
   * see only stale, long-past appointments and never reach today's date.
   */
  static async listForAdmin(executor, { limit, offset, from, to }) {
    const conditions = [];
    const params = [];
    if (from) {
      params.push(from);
      conditions.push(`scheduled_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`scheduled_at < $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type, duration_minutes
         FROM appointments
         ${where}
        ORDER BY scheduled_at ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  static async listForDoctor(executor, doctorId, { limit, offset, from, to }) {
    // 'arrived' included so a checked-in patient doesn't vanish from the
    // doctor's queue the moment staff checks them in — the doctor dashboard
    // relies on seeing this exact row to render its "here" highlight.
    const conditions = ['doctor_id = $1', `status IN ('scheduled', 'confirmed', 'arrived')`];
    const params = [doctorId];
    if (from) {
      params.push(from);
      conditions.push(`scheduled_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`scheduled_at < $${params.length}`);
    }
    params.push(limit, offset);
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type, duration_minutes
         FROM appointments
        WHERE ${conditions.join(' AND ')}
        ORDER BY scheduled_at ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  static async listForPatient(executor, patientId, { limit, offset, from, to }) {
    // Same reasoning as listForDoctor — a patient who has been checked in
    // should still see their own appointment, not have it disappear.
    const conditions = ['patient_id = $1', `status IN ('scheduled', 'confirmed', 'arrived')`];
    const params = [patientId];
    if (from) {
      params.push(from);
      conditions.push(`scheduled_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`scheduled_at < $${params.length}`);
    }
    params.push(limit, offset);
    const result = await executor.query(
      `SELECT appointment_id, patient_id, doctor_id, scheduled_at, status, type, duration_minutes
         FROM appointments
        WHERE ${conditions.join(' AND ')}
        ORDER BY scheduled_at ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return result.rows;
  }

  static async update(executor, appointmentId, { doctorId, patientId, scheduledAt, type, notes, durationMinutes }) {
    const result = await executor.query(
      `UPDATE appointments
          SET doctor_id = COALESCE($2, doctor_id),
              patient_id = COALESCE($3, patient_id),
              scheduled_at = COALESCE($4, scheduled_at),
              type = COALESCE($5, type),
              notes = COALESCE($6, notes),
              duration_minutes = COALESCE($7, duration_minutes)
        WHERE appointment_id = $1 AND status IN ('scheduled', 'confirmed')
        RETURNING appointment_id, scheduled_at, status, duration_minutes`,
      // notes uses `?? null`, not `|| null` — validation allows an explicit
      // empty string to clear it (unlike doctorId/patientId/scheduledAt/type,
      // which are always UUID/date/enum-shaped and never legitimately ''),
      // and `|| null` would coerce that '' into NULL, which COALESCE then
      // treats as "keep the old value", silently no-oping the clear.
      [
        appointmentId,
        doctorId || null,
        patientId || null,
        scheduledAt || null,
        type || null,
        notes ?? null,
        durationMinutes || null,
      ]
    );
    return result.rows[0] || null;
  }

  /** Staff/doctor marks a scheduled appointment as confirmed. */
  static async confirm(executor, appointmentId) {
    const result = await executor.query(
      `UPDATE appointments SET status = 'confirmed'
        WHERE appointment_id = $1 AND status = 'scheduled'
        RETURNING appointment_id, status`,
      [appointmentId]
    );
    return result.rows[0] || null;
  }

  /** Staff marks a scheduled/confirmed appointment as arrived (Quick Check-In, Feature E). */
  static async checkin(executor, appointmentId) {
    const result = await executor.query(
      `UPDATE appointments SET status = 'arrived', updated_at = NOW()
        WHERE appointment_id = $1 AND status IN ('scheduled', 'confirmed')
        RETURNING appointment_id, status`,
      [appointmentId]
    );
    return result.rows[0] || null;
  }

  static async cancel(executor, appointmentId, { cancelledBy, cancellationNote }) {
    const result = await executor.query(
      `UPDATE appointments
          SET status = 'cancelled',
              cancelled_by = $2,
              cancellation_note = $3
        WHERE appointment_id = $1 AND status IN ('scheduled', 'confirmed')
        RETURNING appointment_id, status`,
      [appointmentId, cancelledBy, cancellationNote || null]
    );
    return result.rows[0] || null;
  }
}

module.exports = Appointment;
