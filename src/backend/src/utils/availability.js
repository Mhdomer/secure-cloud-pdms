'use strict';

/**
 * Checks whether [scheduledAt, scheduledAt + durationMinutes) falls inside
 * the doctor's configured working hours (doctor_availability) and does not
 * overlap an existing scheduled/confirmed appointment for that doctor.
 *
 * Day-of-week and time-of-day are computed in Asia/Riyadh local time (the
 * clinic's timezone), not server/UTC time, so a request stored as
 * "2026-07-16T21:30:00Z" is correctly evaluated as after-hours Thursday
 * night in Jeddah rather than against whatever timezone the app server
 * happens to run in.
 *
 * Must be called with the same transaction client used for the appointment
 * INSERT/UPDATE it guards, so the availability check and the write observe
 * a consistent snapshot.
 *
 * @param {import('pg').PoolClient} client
 * @param {string} doctorId
 * @param {string} scheduledAt - ISO 8601 timestamp
 * @param {number} durationMinutes
 * @param {string|null} [excludeAppointmentId] - omit this appointment from the overlap check (for updates)
 * @returns {Promise<boolean>}
 */
async function isSlotAvailable(client, doctorId, scheduledAt, durationMinutes, excludeAppointmentId = null) {
  const withinHours = await client.query(
    `SELECT 1
       FROM doctor_availability
      WHERE doctor_id = $1
        AND is_active = true
        AND day_of_week = EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE 'Asia/Riyadh'))::smallint
        AND start_time <= ($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::time
        AND end_time >= (($2::timestamptz AT TIME ZONE 'Asia/Riyadh') + ($3 || ' minutes')::interval)::time`,
    [doctorId, scheduledAt, durationMinutes]
  );
  if (withinHours.rows.length === 0) {
    return false;
  }

  const overlap = await client.query(
    `SELECT 1
       FROM appointments
      WHERE doctor_id = $1
        AND status IN ('scheduled', 'confirmed')
        AND appointment_id IS DISTINCT FROM $4
        AND scheduled_at < ($2::timestamptz + ($3 || ' minutes')::interval)
        AND (scheduled_at + (duration_minutes || ' minutes')::interval) > $2::timestamptz`,
    [doctorId, scheduledAt, durationMinutes, excludeAppointmentId]
  );
  return overlap.rows.length === 0;
}

module.exports = { isSlotAvailable };
