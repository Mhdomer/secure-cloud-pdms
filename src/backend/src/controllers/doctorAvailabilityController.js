'use strict';

const { pool } = require('../config/database');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const { ROLES } = require('../config/constants');

/** Only a superadmin or the doctor themselves may manage a doctor's own availability. */
function assertCanManage(req, doctorId) {
  if (req.user.role === ROLES.SUPERADMIN) {
    return;
  }
  if (req.user.role === ROLES.DOCTOR && req.rlsSession.doctorId === doctorId) {
    return;
  }
  const err = new Error('You do not have permission to manage this doctor\'s availability');
  err.statusCode = 403;
  throw err;
}

/** List a doctor's weekly working-hours schedule. */
async function listAvailability(req, res) {
  const { doctorId } = req.params;

  const doctor = await Doctor.findById(pool, doctorId);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  const rows = await DoctorAvailability.listByDoctor(pool, doctorId);

  return res.status(200).json({
    doctorId,
    availability: rows.map((r) => ({
      availabilityId: r.availability_id,
      dayOfWeek: r.day_of_week,
      startTime: r.start_time,
      endTime: r.end_time,
      slotMinutes: r.slot_minutes,
      isActive: r.is_active,
    })),
  });
}

/** Create or replace one day's working-hours slot for a doctor. */
async function upsertAvailability(req, res) {
  const { doctorId } = req.params;
  const { day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, slot_minutes: slotMinutes } = req.body;

  assertCanManage(req, doctorId);

  const doctor = await Doctor.findById(pool, doctorId);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  // end_time < start_time is a real shift (e.g. 20:00-01:00) that runs past
  // midnight into the next calendar day — isSlotAvailable (utils/availability.js)
  // knows how to check bookings against that wraparound. Only reject the
  // genuinely ambiguous case: a zero-length/all-day shift.
  if (startTime === endTime) {
    return res.status(422).json({ error: 'start_time and end_time cannot be the same' });
  }

  const result = await DoctorAvailability.upsert(pool, doctorId, { dayOfWeek, startTime, endTime, slotMinutes });

  return res.status(200).json({
    availabilityId: result.availability_id,
    doctorId: result.doctor_id,
    dayOfWeek: result.day_of_week,
    startTime: result.start_time,
    endTime: result.end_time,
    slotMinutes: result.slot_minutes,
    message: 'Availability saved successfully',
  });
}

/** Remove a doctor's working-hours slot for one day of the week. */
async function removeAvailability(req, res) {
  const { doctorId, dayOfWeek } = req.params;

  assertCanManage(req, doctorId);

  const removed = await DoctorAvailability.remove(pool, doctorId, dayOfWeek);
  if (!removed) {
    return res.status(404).json({ error: 'No availability configured for that day' });
  }

  return res.status(200).json({ message: 'Availability removed successfully' });
}

module.exports = { listAvailability, upsertAvailability, removeAvailability };
