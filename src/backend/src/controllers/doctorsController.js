'use strict';

const { pool } = require('../config/database');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../config/constants');

/**
 * Doctor directory for the assign-doctor dropdown — staff pick a name, the
 * frontend sends back the doctor_id; a UUID is never typed manually.
 * `doctors` carries no RLS (staff directory, not patient data), so this is
 * a plain pool query.
 */
async function listActiveDoctors(req, res) {
  const doctors = await Doctor.listActive(pool);

  return res.status(200).json({
    doctors: doctors.map((d) => ({
      doctorId: d.doctor_id,
      fullName: d.full_name,
      specialisation: d.specialisation,
      isActive: d.is_active,
    })),
  });
}

/**
 * GET /doctors/me — Doctor only, resolved from the caller's own user_id
 * (never a route param). Added to fix the doctor dashboard's greeting
 * showing the raw login username ("Good afternoon, Dr. drmohamed")
 * instead of the doctor's actual name (QA-2026-07-24 finding M-6) — the
 * client-side auth store deliberately only ever holds
 * userId/username/role (see authStore.ts), so the frontend had no way to
 * know the signed-in doctor's real name without a dedicated endpoint.
 * `doctors` carries no RLS (staff directory, not patient data), so this is
 * a plain pool query, same as listActiveDoctors above.
 */
async function getMyProfile(req, res) {
  const { rows } = await pool.query(
    'SELECT doctor_id, full_name, specialisation FROM doctors WHERE user_id = $1',
    [req.user.userId]
  );
  if (!rows.length) {
    return res.status(404).json({ error: 'Doctor profile not found' });
  }
  return res.status(200).json({
    doctorId: rows[0].doctor_id,
    fullName: rows[0].full_name,
    specialisation: rows[0].specialisation,
  });
}

/**
 * Reassigns an existing doctor to a different department. Superadmin only
 * (see doctors.routes.js) — a doctor's own department was previously only
 * ever set once, at account-creation time, with no way to change it
 * afterward anywhere in the app.
 */
async function updateDoctor(req, res) {
  const { doctorId } = req.params;
  const { specialisation } = req.body;

  const department = await Department.findByKey(pool, specialisation);
  if (!department || !department.is_active) {
    return res.status(400).json({ error: 'Unknown or inactive department' });
  }

  const doctor = await Doctor.updateSpecialisation(pool, doctorId, specialisation);
  if (!doctor) {
    return res.status(404).json({ error: 'Doctor not found' });
  }

  await AuditLog.log(pool, {
    userId: req.user.userId,
    action: AUDIT_ACTIONS.UPDATE_DOCTOR,
    resource: 'doctors',
    recordId: doctorId,
    ipAddress: req.ip,
  });

  return res.status(200).json({
    doctorId: doctor.doctor_id,
    fullName: doctor.full_name,
    specialisation: doctor.specialisation,
  });
}

module.exports = { listActiveDoctors, getMyProfile, updateDoctor };
