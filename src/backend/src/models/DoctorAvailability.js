'use strict';

/**
 * doctor_availability table — no RLS (staff scheduling data, not patient
 * data). All methods accept a generic `executor` (pool or transaction
 * client).
 */
class DoctorAvailability {
  static async listByDoctor(executor, doctorId) {
    const result = await executor.query(
      `SELECT availability_id, doctor_id, day_of_week, start_time, end_time, slot_minutes, is_active
         FROM doctor_availability
        WHERE doctor_id = $1
        ORDER BY day_of_week ASC`,
      [doctorId]
    );
    return result.rows;
  }

  /** One row per (doctor_id, day_of_week) — creates or replaces that day's slot. */
  static async upsert(executor, doctorId, { dayOfWeek, startTime, endTime, slotMinutes }) {
    const result = await executor.query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_minutes, is_active)
       VALUES ($1, $2, $3, $4, COALESCE($5, 30), true)
       ON CONFLICT (doctor_id, day_of_week)
       DO UPDATE SET start_time   = EXCLUDED.start_time,
                     end_time     = EXCLUDED.end_time,
                     slot_minutes = EXCLUDED.slot_minutes,
                     is_active    = true
       RETURNING availability_id, doctor_id, day_of_week, start_time, end_time, slot_minutes, is_active`,
      [doctorId, dayOfWeek, startTime, endTime, slotMinutes || null]
    );
    return result.rows[0];
  }

  static async remove(executor, doctorId, dayOfWeek) {
    const result = await executor.query(
      `DELETE FROM doctor_availability WHERE doctor_id = $1 AND day_of_week = $2 RETURNING availability_id`,
      [doctorId, dayOfWeek]
    );
    return result.rows[0] || null;
  }
}

module.exports = DoctorAvailability;
