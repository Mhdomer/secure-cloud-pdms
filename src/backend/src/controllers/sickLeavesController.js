'use strict';

const { withTransaction } = require('../config/database');

exports.createSickLeave = async (req, res) => {
  const { patient_id: patientId, visit_id: visitId, start_date: startDate, days_count: daysCount, diagnosis, work_restrictions: workRestrictions } = req.body;
  const doctorId = req.rlsSession.doctorId;

  if (!patientId || !startDate || !daysCount || !diagnosis) {
    return res.status(400).json({ error: 'patient_id, start_date, days_count, and diagnosis are required' });
  }

  const result = await withTransaction(req.rlsSession, async (client) => {
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
