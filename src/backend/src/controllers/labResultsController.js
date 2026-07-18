'use strict';

const fs = require('fs');

const { withTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const LabResult = require('../models/LabResult');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

/** Doctor uploads a lab result file for a patient assigned to them. */
async function uploadLabResult(req, res) {
  if (!req.file) {
    const err = new Error('A file is required');
    err.statusCode = 400;
    throw err;
  }

  const { patientId } = req.params;
  const { test_name: testName, result_date: resultDate, notes } = req.body;

  try {
    const result = await withTransaction(req.rlsSession, async (client) => {
      // RLS (doctor_select_assigned) already narrows this to patients
      // assigned to the caller; a null result means "not assigned to me".
      const patient = await Patient.findById(client, patientId);
      if (!patient) {
        const err = new Error('Patient not found');
        err.statusCode = 404;
        throw err;
      }

      const created = await LabResult.create(client, {
        patientId,
        uploadedBy: req.user.userId,
        filePath: req.file.path,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        testName,
        resultDate,
        notes,
      });

      await AuditLog.log(client, {
        userId: req.user.userId,
        action: AUDIT_ACTIONS.UPLOAD_LAB_RESULT,
        resource: 'lab_results',
        recordId: created.result_id,
        ipAddress: req.ip,
      });

      return created;
    });

    return res.status(201).json({
      resultId: result.result_id,
      patientId: result.patient_id,
      originalFilename: result.original_filename,
      testName: result.test_name,
      resultDate: result.result_date,
      notes: result.notes,
      createdAt: result.created_at,
      uploadedBy: result.uploaded_by,
    });
  } catch (err) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw err;
  }
}

/**
 * Doctor: lab results for one patient. RLS (doctor_select_lab_results)
 * scopes rows to patients assigned to the caller — an unassigned patient_id
 * yields [], not a 403, so this never leaks which patients exist.
 */
async function getLabResults(req, res) {
  const { patientId } = req.params;

  const results = await withTransaction(req.rlsSession, (client) => LabResult.listByPatient(client, patientId));

  return res.status(200).json({
    results: results.map((r) => ({
      resultId: r.result_id,
      originalFilename: r.original_filename,
      testName: r.test_name,
      resultDate: r.result_date,
      notes: r.notes,
      createdAt: r.created_at,
      uploadedBy: r.uploaded_by,
      releasedAt: r.released_at,
    })),
  });
}

/**
 * Patient: their own lab results. RLS (patient_select_released_lab_results)
 * scopes this to their own patient_id AND released_at IS NOT NULL — a
 * result their doctor hasn't released yet simply doesn't appear, same
 * "absence, not a 403" principle as the doctor-facing list above.
 */
async function getMyLabResults(req, res) {
  const { patientId } = req.rlsSession;

  const results = await withTransaction(req.rlsSession, (client) => LabResult.listByPatient(client, patientId));

  return res.status(200).json({
    results: results.map((r) => ({
      resultId: r.result_id,
      originalFilename: r.original_filename,
      testName: r.test_name,
      resultDate: r.result_date,
      notes: r.notes,
      createdAt: r.created_at,
      releasedAt: r.released_at,
    })),
  });
}

/**
 * Doctor: release a result to the patient. RLS (doctor_release_lab_results)
 * scopes the UPDATE to patients assigned to the caller — 0 rows affected
 * (result missing or not assigned to this doctor) maps to the same 404
 * either way, so this never confirms whether a given result_id exists.
 */
async function releaseLabResult(req, res) {
  const { resultId } = req.params;

  const released = await withTransaction(req.rlsSession, async (client) => {
    const row = await LabResult.release(client, resultId, req.user.userId);
    if (!row) {
      return null;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.RELEASE_LAB_RESULT,
      resource: 'lab_results',
      recordId: resultId,
      ipAddress: req.ip,
    });

    return row;
  });

  if (!released) {
    return res.status(404).json({ error: 'Lab result not found' });
  }

  return res.status(200).json({
    resultId: released.result_id,
    releasedAt: released.released_at,
    message: 'Lab result released to the patient.',
  });
}

/**
 * Download a lab result file. Doctor: only if assigned to that patient.
 * Patient: only their own, and only once released — RLS
 * (patient_select_released_lab_results) already enforces both for the
 * findById below, so a patient session simply gets null (→ 404) for an
 * unreleased or not-their-own result without any extra check needed here.
 */
async function downloadLabResult(req, res) {
  const { resultId } = req.params;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const row = await LabResult.findById(client, resultId);
    if (!row) {
      return null;
    }

    if (req.user.role === ROLES.DOCTOR) {
      // Explicit re-check alongside RLS (doctor_select_lab_results already
      // scopes findById to assigned patients) — mirrors the belt-and-suspenders
      // pattern medicalRecordsController uses for ownership checks.
      const patient = await Patient.findById(client, row.patient_id);
      if (!patient || patient.assigned_doctor_id !== req.rlsSession.doctorId) {
        return null;
      }
    }

    return row;
  });

  if (!result) {
    return res.status(404).json({ error: 'Lab result not found' });
  }

  return res.download(result.file_path, result.original_filename);
}

module.exports = { uploadLabResult, getLabResults, getMyLabResults, releaseLabResult, downloadLabResult };
