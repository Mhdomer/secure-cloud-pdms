'use strict';

const { withTransaction } = require('../config/database');

exports.createSickLeave = async (req, res) => {
  const { patient_id: patientId, visit_id: visitId, start_date: startDate, days_count: daysCount, diagnosis, work_restrictions: workRestrictions } = req.body;
  const doctorId = req.rlsSession.doctorId;

  if (!patientId || !startDate || !daysCount || !diagnosis) {
    return res.status(400).json({ error: 'patient_id, start_date, days_count, and diagnosis are required' });
  }

  const result = await withTransaction(req.rlsSession, async (client) => {
    // Explicit ownership check, same "belt-and-suspenders alongside RLS"
    // pattern as labResultsController.downloadLabResult — the DB-level
    // doctor_insert_sick_leaves RLS policy (schema.sql) would block a
    // cross-patient insert anyway, but re-checking here first returns a
    // clean 404 instead of a raw RLS-violation 500 (Sprint 5 pentest
    // finding: this endpoint previously let any doctor issue an official
    // sick-leave certificate for a patient they had never treated).
    const assignedRes = await client.query(
      `SELECT 1 FROM patients WHERE patient_id = $1 AND assigned_doctor_id = $2
       UNION
       SELECT 1 FROM patient_care_team WHERE patient_id = $1 AND doctor_id = $2`,
      [patientId, doctorId]
    );
    if (assignedRes.rowCount === 0) {
      const err = new Error('Patient not found');
      err.statusCode = 404;
      throw err;
    }

    // Get real doctor details from doctors table
    const doctorRes = await client.query(`SELECT doctor_id, full_name, specialisation FROM doctors WHERE doctor_id = $1`, [doctorId]);
    const doctor = doctorRes.rows[0];

    const refNo = `SEHA-SL-${Math.floor(100000 + Math.random() * 900000)}`;

    const leaveRes = await client.query(
      `INSERT INTO sick_leaves (visit_id, patient_id, doctor_id, reference_no, start_date, days_count, diagnosis, work_restrictions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING leave_id, reference_no, created_at`,
      [visitId || null, patientId, doctorId, refNo, startDate, daysCount, diagnosis, workRestrictions || null]
    );

    return {
      leaveId: leaveRes.rows[0].leave_id,
      referenceNo: leaveRes.rows[0].reference_no,
      createdAt: leaveRes.rows[0].created_at,
      doctorName: doctor ? doctor.full_name : 'Logged-in Physician',
      clinic: doctor ? doctor.specialisation : 'General',
    };
  });

  res.status(201).json(result);
};

/**
 * Doctor/Admin/Superadmin: sick leaves for one patient. Patient: only
 * reachable for their own patientId in practice, since RLS
 * (patient_own_sick_leaves, schema.sql) scopes the result set to
 * app.current_patient_id — requesting another patient's patientId yields
 * [], not a 403, the same "absence, not a 403" principle
 * labResultsController.getLabResults already documents. Doctor scope is
 * similarly narrowed by doctor_select_sick_leaves to assigned/care-team
 * patients only (Sprint 5 pentest finding: this previously had no RLS at
 * all and leaked every patient's sick-leave record to every role).
 */
exports.getPatientSickLeaves = async (req, res) => {
  const { patientId } = req.params;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const resRows = await client.query(
      `SELECT sl.leave_id, sl.reference_no, sl.start_date, sl.days_count, sl.diagnosis, sl.work_restrictions, sl.created_at,
              d.full_name AS doctor_name, d.specialisation AS clinic_name
         FROM sick_leaves sl
         JOIN doctors d ON d.doctor_id = sl.doctor_id
        WHERE sl.patient_id = $1
        ORDER BY sl.created_at DESC`,
      [patientId]
    );

    return resRows.rows.map((r) => ({
      leaveId: r.leave_id,
      referenceNo: r.reference_no,
      startDate: r.start_date,
      daysCount: r.days_count,
      diagnosis: r.diagnosis,
      workRestrictions: r.work_restrictions,
      createdAt: r.created_at,
      doctorName: r.doctor_name,
      clinicName: r.clinic_name,
    }));
  });

  res.json({ sickLeaves: result });
};
