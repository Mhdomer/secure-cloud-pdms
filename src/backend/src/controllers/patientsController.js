'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const { withTransaction } = require('../config/database');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const CareTeam = require('../models/CareTeam');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');
const { parsePagination } = require('../utils/pagination');
const { generateSetupToken } = require('../lib/generateSetupToken');

const BCRYPT_COST = 12;
const UNIQUE_VIOLATION = '23505';
const DUPLICATE_NATIONAL_ID_MESSAGE = 'A patient with this ID number is already registered';

/**
 * Placeholder password hashed into the new account so password_hash (NOT
 * NULL) is never empty before the patient sets their own via the QR/setup-
 * token flow. Never returned to the client and never logged — the account
 * is unusable until setPassword overwrites this hash.
 */
function generateTempPassword() {
  return crypto.randomBytes(16).toString('base64url');
}

/** True for a violation of the patients_national_id_key unique constraint. */
function isNationalIdConflict(err) {
  return err && err.code === UNIQUE_VIOLATION && err.constraint === 'patients_national_id_key';
}

/** True for a violation of the users_username_key unique constraint. */
function isUsernameConflict(err) {
  return err && err.code === UNIQUE_VIOLATION && err.constraint === 'users_username_key';
}

/** Throws a 409 carrying the existing patient's identity so staff can navigate to them directly. */
function throwDuplicateNationalId(existingPatient) {
  const err = new Error(DUPLICATE_NATIONAL_ID_MESSAGE);
  err.statusCode = 409;
  err.existingPatient = { patientId: existingPatient.patient_id, fullName: existingPatient.full_name };
  throw err;
}

function extractPatientFields(body) {
  return {
    fullName: body.full_name,
    dateOfBirth: body.date_of_birth,
    gender: body.gender,
    contactNumber: body.contact_number,
    idType: body.id_type,
    nationalId: typeof body.national_id === 'string' ? body.national_id.trim() : body.national_id,
    bloodType: body.blood_type,
    allergies: body.allergies,
    nationality: body.nationality,
    address: body.address,
    emergencyContactName: body.emergency_contact_name,
    emergencyContactPhone: body.emergency_contact_phone,
    insuranceProvider: body.insurance_provider,
    insuranceNumber: body.insurance_number,
    email: body.email,
    preferredLanguage: body.preferred_language,
  };
}

/**
 * UC-06 — Register New Patient (Admin only).
 * The patient's login username is their national_id/iqama/passport number —
 * something they already carry and have memorized — rather than a random
 * generated string. No password is ever generated for staff to relay: a
 * one-time setup token is issued instead, rendered as a QR code the patient
 * scans to choose their own password (see lib/generateSetupToken.js and
 * passwordSetupController.js).
 */
async function registerPatient(req, res) {
  const { assigned_doctor_id: assignedDoctorId } = req.body;
  const fields = extractPatientFields(req.body);

  const username = fields.nationalId;
  const tempPassword = generateTempPassword();

  let result;
  try {
    result = await withTransaction(req.rlsSession, async (client) => {
      // Proactive duplicate check — staff registers a patient by national ID
      // first, so a collision should be caught and reported by name before
      // any user account or patient row is created, not surfaced as a raw
      // constraint violation after the fact.
      const existing = await Patient.findByNationalId(client, fields.nationalId);
      if (existing) {
        throwDuplicateNationalId(existing);
      }

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
        ...fields,
        assignedDoctorId,
      });

      await AuditLog.log(client, {
        userId: req.user.userId,
        action: AUDIT_ACTIONS.REGISTER_PATIENT,
        resource: 'patients',
        recordId: patient.patient_id,
        ipAddress: req.ip,
      });

      // Same transaction as the account/patient insert — if anything above
      // rolls back, the token never gets committed as an orphan either.
      const setupToken = await generateSetupToken(client, user.user_id, process.env.FRONTEND_URL);

      return { patient, setupToken };
    });
  } catch (err) {
    if (err.existingPatient) {
      return res.status(409).json({ error: err.message, existingPatient: err.existingPatient });
    }
    // Fallback for the rare race where two requests pass the pre-check
    // concurrently — the unique constraint is the backstop, just without
    // the existing patient's name attached.
    if (isNationalIdConflict(err)) {
      return res.status(409).json({ error: DUPLICATE_NATIONAL_ID_MESSAGE });
    }
    // Username now equals national_id, so this only fires if that exact
    // string was already taken as a staff/doctor username — practically
    // never, but a raw 500 would be a confusing dead end for the admin.
    if (isUsernameConflict(err)) {
      return res
        .status(409)
        .json({ error: 'This ID number is already in use as a login username by another account' });
    }
    throw err;
  }

  const { patient, setupToken } = result;

  return res.status(201).json({
    patientId: patient.patient_id,
    fullName: patient.full_name,
    fileNo: patient.file_no,
    assignedDoctorId: patient.assigned_doctor_id,
    username,
    qrCode: setupToken.qrDataUrl,
    setupUrl: setupToken.setupUrl,
    expiresAt: setupToken.expiresAt,
    message: 'Patient registered successfully. Show this QR code to the patient so they can set their own password.',
  });
}

/**
 * Search — the only way staff or a doctor finds a patient and navigates to
 * them; a patient_id UUID is never typed or shown directly. Reachable by
 * both ROLES.ADMIN and ROLES.DOCTOR (see patients.routes.js), but the query
 * itself has no role-specific filtering — admin_select_patients and
 * doctor_select_assigned (schema.sql) are what actually scope the rows a
 * given session can see, so a doctor calling this only ever gets their own
 * assigned patients back.
 */
async function searchPatients(req, res) {
  const { q } = req.query;
  const { page, limit, offset } = parsePagination(req.query);

  const rows = await withTransaction(req.rlsSession, (client) => Patient.search(client, q, { limit, offset }));

  return res.status(200).json({
    patients: rows.map((p) => ({
      patientId: p.patient_id,
      fullName: p.full_name,
      fileNo: p.file_no,
      nationalId: p.national_id,
      contactNumber: p.contact_number,
      dateOfBirth: p.date_of_birth,
      assignedDoctorId: p.assigned_doctor_id,
    })),
    page,
    limit,
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
    fileNo: patient.file_no,
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender,
    contactNumber: patient.contact_number,
    assignedDoctorId: patient.assigned_doctor_id,
    createdAt: patient.created_at,
    idType: patient.id_type,
    nationalId: patient.national_id,
    bloodType: patient.blood_type,
    allergies: patient.allergies,
    nationality: patient.nationality,
    address: patient.address,
    emergencyContactName: patient.emergency_contact_name,
    emergencyContactPhone: patient.emergency_contact_phone,
    insuranceProvider: patient.insurance_provider,
    insuranceNumber: patient.insurance_number,
    email: patient.email,
    preferredLanguage: patient.preferred_language,
  });
}

/**
 * GET /patients/me — Patient only, patientId derived from the session
 * (never a route param, so there's nothing to spoof — same pattern
 * billingController.listMine already uses for a patient's own invoices).
 * Added to fix dashboards greeting a patient by their raw login username/
 * national ID instead of their actual name (QA-2026-07-24 finding M-6) —
 * the client-side auth store deliberately only ever holds
 * userId/username/role (see authStore.ts), so there was previously no way
 * for the frontend to know the signed-in patient's real name at all.
 */
async function getMyProfile(req, res) {
  const { patientId } = req.rlsSession;
  const patient = await withTransaction(req.rlsSession, (client) => Patient.findById(client, patientId));
  if (!patient) {
    return res.status(404).json({ error: 'Patient profile not found' });
  }
  return res.status(200).json({
    patientId: patient.patient_id,
    fullName: patient.full_name,
    fileNo: patient.file_no,
  });
}

/** UC-08 — Update Patient Information (Admin only). */
async function updatePatient(req, res) {
  const { patientId } = req.params;
  const fields = extractPatientFields(req.body);

  let result;
  try {
    result = await withTransaction(req.rlsSession, async (client) => {
      if (fields.nationalId) {
        const existing = await Patient.findByNationalId(client, fields.nationalId);
        if (existing && existing.patient_id !== patientId) {
          throwDuplicateNationalId(existing);
        }
      }

      const updated = await Patient.update(client, patientId, fields);
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
  } catch (err) {
    if (err.existingPatient) {
      return res.status(409).json({ error: err.message, existingPatient: err.existingPatient });
    }
    if (isNationalIdConflict(err)) {
      return res.status(409).json({ error: DUPLICATE_NATIONAL_ID_MESSAGE });
    }
    throw err;
  }

  return res.status(200).json({
    patientId: result.patient_id,
    fullName: result.full_name,
    fileNo: result.file_no,
    dateOfBirth: result.date_of_birth,
    gender: result.gender,
    contactNumber: result.contact_number,
    idType: result.id_type,
    nationalId: result.national_id,
    bloodType: result.blood_type,
    allergies: result.allergies,
    nationality: result.nationality,
    address: result.address,
    emergencyContactName: result.emergency_contact_name,
    emergencyContactPhone: result.emergency_contact_phone,
    insuranceProvider: result.insurance_provider,
    insuranceNumber: result.insurance_number,
    email: result.email,
    preferredLanguage: result.preferred_language,
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

    // Sprint 5 pentest finding: this used to only update
    // patients.assigned_doctor_id, which the *current* doctor_select_records
    // RLS policy on medical_records (schema.sql) does not fall back to — a
    // newly-reassigned doctor could see the patient's demographic profile
    // (admin_select_patients / doctor_select_assigned do check
    // assigned_doctor_id directly) but got a silently empty medical-history
    // list until an admin separately ran UC-09b. Mirrors the same
    // CareTeam.add call visitsController.create already makes for walk-ins,
    // so a reassignment behaves the same as any other route onto this
    // patient's care team. Upsert (ON CONFLICT DO UPDATE), so re-running
    // this for an already-primary doctor is a no-op, not an error.
    await CareTeam.add(client, {
      patientId,
      doctorId,
      isPrimary: true,
      assignedBy: req.user.userId,
    });

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

/**
 * Regenerates a patient's password-setup QR (Admin/superadmin) — for a
 * patient who lost the original before scanning it. generateSetupToken
 * invalidates the previous unused token itself, so at most one setup token
 * is ever live for a given account.
 */
async function regenerateQR(req, res) {
  const { patientId } = req.params;

  const setupToken = await withTransaction(req.rlsSession, async (client) => {
    const patient = await Patient.findById(client, patientId);
    if (!patient) {
      const err = new Error('Patient not found');
      err.statusCode = 404;
      throw err;
    }
    if (!patient.user_id) {
      const err = new Error('This patient has no linked user account');
      err.statusCode = 409;
      throw err;
    }

    const token = await generateSetupToken(client, patient.user_id, process.env.FRONTEND_URL);

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.REGENERATE_SETUP_QR,
      resource: 'patients',
      recordId: patientId,
      ipAddress: req.ip,
    });

    return token;
  });

  return res.status(200).json({
    qrCode: setupToken.qrDataUrl,
    setupUrl: setupToken.setupUrl,
    expiresAt: setupToken.expiresAt,
  });
}

/** UC-09b — List a patient's care team (Admin: any; Doctor: own assigned/care-team patients only, via RLS). */
async function getCareTeam(req, res) {
  const { patientId } = req.params;

  const patient = await withTransaction(req.rlsSession, (client) => Patient.findById(client, patientId));
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const rows = await withTransaction(req.rlsSession, (client) => CareTeam.listByPatient(client, patientId));

  return res.status(200).json({
    patientId,
    careTeam: rows.map((row) => ({
      assignmentId: row.assignment_id,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      specialisation: row.specialisation,
      speciality: row.speciality,
      isPrimary: row.is_primary,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
    })),
  });
}

/** UC-09b — Add a doctor to a patient's care team (Admin only). */
async function addToCareTeam(req, res) {
  const { patientId } = req.params;
  const { doctor_id: doctorId, speciality, is_primary: isPrimary } = req.body;

  const assignment = await withTransaction(req.rlsSession, async (client) => {
    const patient = await Patient.findById(client, patientId);
    if (!patient) {
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

    const created = await CareTeam.add(client, {
      patientId,
      doctorId,
      speciality,
      isPrimary,
      assignedBy: req.user.userId,
    });

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.ADD_CARE_TEAM_MEMBER,
      resource: 'patient_care_team',
      recordId: created.assignment_id,
      ipAddress: req.ip,
    });

    return created;
  });

  return res.status(201).json({
    assignmentId: assignment.assignment_id,
    patientId: assignment.patient_id,
    doctorId: assignment.doctor_id,
    speciality: assignment.speciality,
    isPrimary: assignment.is_primary,
    assignedBy: assignment.assigned_by,
    assignedAt: assignment.assigned_at,
    message: 'Doctor added to care team successfully',
  });
}

/** UC-09b — Remove a doctor from a patient's care team (Admin only). */
async function removeFromCareTeam(req, res) {
  const { patientId, assignmentId } = req.params;

  await withTransaction(req.rlsSession, async (client) => {
    const removed = await CareTeam.remove(client, patientId, assignmentId);
    if (!removed) {
      const err = new Error('Assignment not found or cannot remove the primary doctor');
      err.statusCode = 404;
      throw err;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.REMOVE_CARE_TEAM_MEMBER,
      resource: 'patient_care_team',
      recordId: assignmentId,
      ipAddress: req.ip,
    });
  });

  return res.status(200).json({ message: 'Doctor removed from care team successfully' });
}

module.exports = {
  registerPatient,
  searchPatients,
  viewPatient,
  getMyProfile,
  updatePatient,
  assignDoctor,
  regenerateQR,
  getCareTeam,
  addToCareTeam,
  removeFromCareTeam,
};
