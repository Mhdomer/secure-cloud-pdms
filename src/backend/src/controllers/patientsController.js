'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { withTransaction } = require('../config/database');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

const BCRYPT_COST = 12;

function generateTempCredentials() {
  const username = `patient_${crypto.randomBytes(4).toString('hex')}`;
  // 16 random bytes, base64url — well above the 8-char minimum and never
  // logged; returned exactly once in the registration response.
  const tempPassword = crypto.randomBytes(16).toString('base64url');
  return { username, tempPassword };
}

/** UC-06 — Register New Patient (Admin only). */
async function registerPatient(req, res) {
  const { full_name: fullName, date_of_birth: dateOfBirth, gender, contact_number: contactNumber, assigned_doctor_id: assignedDoctorId } = req.body;

  const { username, tempPassword } = generateTempCredentials();

  const result = await withTransaction(req.rlsSession, async (client) => {
    const doctor = await Doctor.findActiveById(client, assignedDoctorId);
    if (!doctor) {
      const err = new Error('Assigned doctor not found or inactive');
      err.statusCode = 404;
      throw err;
    }

    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);
    const user = await User.create(client, { username, passwordHash, role: ROLES.PATIENT });

    const patient = await Patient.register(client, {
      userId: user.user_id,
      fullName,
      dateOfBirth,
      gender,
      contactNumber,
      assignedDoctorId,
    });

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.REGISTER_PATIENT,
      resource: 'patients',
      recordId: patient.patient_id,
      ipAddress: req.ip,
    });

    return patient;
  });

  return res.status(201).json({
    patientId: result.patient_id,
    fullName: result.full_name,
    assignedDoctorId: result.assigned_doctor_id,
    tempUsername: username,
    tempPassword,
    message:
      'Patient registered successfully. These temporary credentials are shown once — relay them to the patient out-of-band.',
  });
}

/** UC-07 — View Patient Profile (Doctor: own assigned patients only; Admin: any). */
async function viewPatient(req, res) {
  const { patientId } = req.params;

  const patient = await withTransaction(req.rlsSession, (client) => Patient.findById(client, patientId));

  // RLS (doctor_select_assigned / admin_select_patients) already filtered
  // this query — a null result here means either the patient does not
  // exist or the caller is not authorised to see it. Returning a single
  // generic 404 for both avoids leaking which case occurred.
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  return res.status(200).json({
    patientId: patient.patient_id,
    fullName: patient.full_name,
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender,
    contactNumber: patient.contact_number,
    assignedDoctorId: patient.assigned_doctor_id,
    createdAt: patient.created_at,
  });
}

/** UC-08 — Update Patient Information (Admin only). */
async function updatePatient(req, res) {
  const { patientId } = req.params;
  const { full_name: fullName, date_of_birth: dateOfBirth, gender, contact_number: contactNumber } = req.body;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const updated = await Patient.update(client, patientId, { fullName, dateOfBirth, gender, contactNumber });
    if (!updated) {
      const err = new Error('Patient not found');
      err.statusCode = 404;
      throw err;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.UPDATE_PATIENT,
      resource: 'patients',
      recordId: patientId,
      ipAddress: req.ip,
    });

    return updated;
  });

  return res.status(200).json({
    patientId: result.patient_id,
    fullName: result.full_name,
    dateOfBirth: result.date_of_birth,
    gender: result.gender,
    contactNumber: result.contact_number,
    message: 'Patient updated successfully',
  });
}

/** UC-09 — Assign Doctor to Patient (Admin only). */
async function assignDoctor(req, res) {
  const { patientId } = req.params;
  const { doctor_id: doctorId } = req.body;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const existing = await Patient.findById(client, patientId);
    if (!existing) {
      const err = new Error('Patient not found');
      err.statusCode = 404;
      throw err;
    }

    const doctor = await Doctor.findActiveById(client, doctorId);
    if (!doctor) {
      const err = new Error('Doctor not found or inactive');
      err.statusCode = 404;
      throw err;
    }

    const updated = await Patient.assignDoctor(client, patientId, doctorId);

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.ASSIGN_DOCTOR,
      resource: 'patients',
      recordId: patientId,
      ipAddress: req.ip,
    });

    return { updated, previousDoctorId: existing.assigned_doctor_id };
  });

  return res.status(200).json({
    patientId: result.updated.patient_id,
    newDoctorId: result.updated.assigned_doctor_id,
    previousDoctorId: result.previousDoctorId,
    message: 'Doctor assignment updated successfully',
  });
}

module.exports = { registerPatient, viewPatient, updatePatient, assignDoctor };
