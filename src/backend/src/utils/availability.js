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
 * A doctor_availability row with end_time <= start_time (e.g. 20:00-01:00)
 * represents a shift that runs past midnight into the next calendar day —
 * real overnight clinic shifts exist and doctorAvailabilityController no
 * longer rejects them at save time. Each row is anchored to two possible
 * calendar days here: the day it's stored under (day_of_week), where it
 * covers the evening portion up to midnight-and-beyond, and the following
 * day, where an appointment landing in the early-morning hours must still
 * match yesterday's overnight row. A normal same-day row (end_time >
 * start_time) only ever matches via the first anchor.
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
    `SELECT 1 FROM (
       -- Anchored to the appointment's own calendar day — covers ordinary
       -- same-day shifts, and the evening portion of a shift that starts
       -- today and runs past midnight.
       SELECT
         (($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::date + da.start_time) AS shift_start,
         (CASE WHEN da.end_time > da.start_time
               THEN ($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::date + da.end_time
               ELSE ($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::date + INTERVAL '1 day' + da.end_time
          END) AS shift_end
         FROM doctor_availability da
        WHERE da.doctor_id = $1
          AND da.is_active = true
          AND da.day_of_week = EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE 'Asia/Riyadh'))::smallint

       UNION ALL

       -- Anchored to yesterday — only usable when yesterday's row is itself
       -- an overnight shift spilling into today.
       SELECT
         (($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::date - INTERVAL '1 day' + da.start_time) AS shift_start,
         (($2::timestamptz AT TIME ZONE 'Asia/Riyadh')::date + da.end_time) AS shift_end
         FROM doctor_availability da
        WHERE da.doctor_id = $1
          AND da.is_active = true
          AND da.end_time <= da.start_time
          AND da.day_of_week = (EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE 'Asia/Riyadh'))::smallint + 6) % 7
     ) shifts
     WHERE shifts.shift_start <= ($2::timestamptz AT TIME ZONE 'Asia/Riyadh')
       AND shifts.shift_end   >= (($2::timestamptz AT TIME ZONE 'Asia/Riyadh') + ($3 || ' minutes')::interval)`,
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
