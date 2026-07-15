'use strict';

const { withTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const MedicalRecord = require('../models/MedicalRecord');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');
const { parsePagination } = require('../utils/pagination');

/**
 * UC-10 / Figure 4.11 — Create Medical Record (Doctor only).
 * Ownership is checked explicitly at the application layer (matching the
 * sequence diagram's step 5) in addition to the doctor_insert_records RLS
 * policy that independently re-enforces the same boundary on the INSERT.
 */
async function createRecord(req, res) {
  const {
    patient_id: patientId,
    diagnosis,
    prescription,
    notes,
    chief_complaint: chiefComplaint,
    objective,
    assessment,
    plan,
    vital_signs: vitalSigns,
    visit_type: visitType,
  } = req.body;
  const doctorId = req.rlsSession.doctorId;

  const result = await withTransaction(req.rlsSession, async (client) => {
    // RLS (doctor_select_assigned) already narrows this to patients
    // assigned to the caller; a null result means "not assigned to me".
    const patient = await Patient.findById(client, patientId);
    if (!patient) {
      const err = new Error('You are not assigned to this patient');
      err.statusCode = 403;
      throw err;
    }

    const record = await MedicalRecord.create(client, {
      patientId,
      doctorId,
      diagnosis,
      prescription,
      notes,
      chiefComplaint,
      objective,
      assessment,
      plan,
      vitalSigns,
      visitType,
    });

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CREATE_RECORD,
      resource: 'medical_records',
      recordId: record.record_id,
      ipAddress: req.ip,
    });

    return record;
  });

  return res.status(201).json({
    recordId: result.record_id,
    patientId,
    createdAt: result.created_at,
    message: 'Record created successfully',
  });
}

/** UC-11 — List Medical Records (Doctor: own records; Patient: own records). RLS-filtered. */
async function listRecords(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { role, doctorId, patientId } = req.rlsSession;

  const { records, total } = await withTransaction(req.rlsSession, async (client) => {
    if (role === ROLES.DOCTOR) {
      const rows = await MedicalRecord.listByDoctor(client, doctorId, { limit, offset });
      const count = await MedicalRecord.countByDoctor(client, doctorId);
      return { records: rows, total: count };
    }
    const rows = await MedicalRecord.listByPatient(client, patientId, { limit, offset });
    const count = await MedicalRecord.countByPatient(client, patientId);
    return { records: rows, total: count };
  });

  return res.status(200).json({
    records: records.map((r) => ({
      recordId: r.record_id,
      patientId: r.patient_id,
      diagnosis: r.diagnosis,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total,
    page,
    limit,
  });
}

/** UC-11 (single) — View one medical record. RLS-filtered; 404 covers both "missing" and "unauthorised". */
async function viewRecord(req, res) {
  const { recordId } = req.params;

  const record = await withTransaction(req.rlsSession, (client) => MedicalRecord.findById(client, recordId));

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  return res.status(200).json({
    recordId: record.record_id,
    patientId: record.patient_id,
    diagnosis: record.diagnosis,
    prescription: record.prescription,
    notes: record.notes,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    chiefComplaint: record.chief_complaint,
    objective: record.objective,
    assessment: record.assessment,
    plan: record.plan,
    vitalSigns: record.vital_signs,
    visitType: record.visit_type,
  });
}

/** UC-12 — Update Medical Record (Doctor only; RLS rejects records they don't own). */
async function updateRecord(req, res) {
  const { recordId } = req.params;
  const {
    diagnosis,
    prescription,
    notes,
    chief_complaint: chiefComplaint,
    objective,
    assessment,
    plan,
    vital_signs: vitalSigns,
    visit_type: visitType,
  } = req.body;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const updated = await MedicalRecord.update(client, recordId, {
      diagnosis,
      prescription,
      notes,
      chiefComplaint,
      objective,
      assessment,
      plan,
      vitalSigns,
      visitType,
    });
    if (!updated) {
      const err = new Error('Record not found');
      err.statusCode = 404;
      throw err;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.UPDATE_RECORD,
      resource: 'medical_records',
      recordId,
      ipAddress: req.ip,
    });

    return updated;
  });

  return res.status(200).json({
    recordId: result.record_id,
    updatedAt: result.updated_at,
    message: 'Record updated successfully',
  });
}

/** UC-13 — View Patient Medical History (Doctor only, must be assigned to the patient). */
async function viewHistory(req, res) {
  const { patientId } = req.params;
  const { page, limit, offset } = parsePagination(req.query);
  const doctorId = req.rlsSession.doctorId;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const patient = await Patient.findById(client, patientId);
    if (!patient) {
      const err = new Error('You are not assigned to this patient');
      err.statusCode = 403;
      throw err;
    }

    const rows = await MedicalRecord.listByPatientAndDoctor(client, patientId, doctorId, { limit, offset });
    const total = await MedicalRecord.countByPatientAndDoctor(client, patientId, doctorId);
    return { rows, total };
  });

  return res.status(200).json({
    records: result.rows.map((r) => ({
      recordId: r.record_id,
      diagnosis: r.diagnosis,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    total: result.total,
    page,
    limit,
  });
}

module.exports = { createRecord, listRecords, viewRecord, updateRecord, viewHistory };
