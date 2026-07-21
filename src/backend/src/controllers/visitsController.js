'use strict';
const { withTransaction } = require('../config/database');
const AuditLog = require('../models/AuditLog');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const CareTeam = require('../models/CareTeam');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

const SERIALIZATION_FAILURE = '40001';
function isSerializationFailure(err) {
  return err && err.code === SERIALIZATION_FAILURE;
}

/**
 * Start of "today" anchored to the clinic's real timezone (Riyadh, UTC+3,
 * no DST) as an absolute instant — NOT CURRENT_DATE/DATE(), which resolve
 * against whatever the DB session's TimeZone GUC happens to be. Confirmed
 * that matters here: local dev's session defaults to Asia/Kuala_Lumpur, and
 * infrastructure/terraform/modules/rds/main.tf's parameter group sets no
 * timezone at all, so RDS defaults to UTC in production — neither is
 * Riyadh, so CURRENT_DATE would silently roll the queue over hours off
 * from the clinic's actual midnight. `create` (queue numbering) and
 * `listToday` (the queue listing) MUST use the identical boundary or a
 * visit could be numbered under one day but listed under another.
 */
const TODAY_START_SQL = `(date_trunc('day', NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh')`;
const todayRangeCondition = (column) =>
  `${column} >= ${TODAY_START_SQL} AND ${column} < ${TODAY_START_SQL} + INTERVAL '1 day'`;

function toRow(r) {
  return {
    visitId:      r.visit_id,
    patientId:    r.patient_id,
    patientName:  r.patient_name,
    fileNo:       r.file_no,
    doctorId:     r.doctor_id,
    doctorName:   r.doctor_name,
    queueNo:      r.queue_no,
    clinic:       r.clinic,
    status:       r.status,
    notes:        r.notes,
    visitType:    r.visit_type,
    checkedInAt:  r.checked_in_at,
    completedAt:  r.completed_at,
    createdBy:    r.created_by,
  };
}

const VISIT_SELECT = `
  SELECT v.*,
         p.full_name  AS patient_name,
         p.file_no,
         d.full_name  AS doctor_name
    FROM visits v
    JOIN patients p ON p.patient_id = v.patient_id
    JOIN doctors  d ON d.doctor_id  = v.doctor_id
`;

// Only getOne needs the full patient chart (DOB, gender, blood type,
// allergies, contact) — listToday/create's `Visit` type deliberately stays
// slim, so this is a separate SELECT/mapper rather than widening VISIT_SELECT
// (which would leak these columns into every visit-list response too).
const VISIT_DETAIL_SELECT = `
  SELECT v.visit_id, v.patient_id, v.doctor_id, v.queue_no, v.clinic, v.status,
         v.notes, v.visit_type, v.prescription_notes, v.checked_in_at, v.completed_at, v.created_by,
         p.full_name AS patient_name, p.file_no, p.date_of_birth, p.gender,
         p.contact_number, p.blood_type, p.allergies,
         d.full_name AS doctor_name
    FROM visits v
    JOIN patients p ON p.patient_id = v.patient_id
    JOIN doctors  d ON d.doctor_id  = v.doctor_id
`;

function toDetailRow(r) {
  return {
    visitId:           r.visit_id,
    patientId:         r.patient_id,
    patientName:       r.patient_name,
    fileNo:            r.file_no,
    doctorId:          r.doctor_id,
    doctorName:        r.doctor_name,
    queueNo:           r.queue_no,
    clinic:            r.clinic,
    status:            r.status,
    notes:             r.notes,
    visitType:         r.visit_type,
    prescriptionNotes: r.prescription_notes,
    checkedInAt:       r.checked_in_at,
    completedAt:       r.completed_at,
    createdBy:         r.created_by,
    dateOfBirth:       r.date_of_birth,
    gender:            r.gender,
    contactNumber:     r.contact_number,
    bloodType:         r.blood_type,
    allergies:         r.allergies,
  };
}

/**
 * UC — Staff Creates Walk-in Visit (admin only, see visits.routes.js).
 * Runs SERIALIZABLE so two concurrent check-ins for the same doctor can
 * never both read the same MAX(queue_no) and insert the same number —
 * identical pattern to appointmentsController's slot-conflict check; the
 * loser gets a 40001 mapped to 409 below, caller retries.
 */
exports.create = async (req, res) => {
  const { patient_id, doctor_id, notes, visit_type } = req.body;
  let result;
  try {
    result = await withTransaction(
      req.rlsSession,
      async (client) => {
        // Fail with a clean 404 instead of letting an invalid ID fall
        // through to the INSERT's FK constraint, which would surface as a
        // raw, unmapped 23503 (generic 500) — same existence-check pattern
        // as patientsController.registerPatient / CareTeam.add.
        const patient = await Patient.findById(client, patient_id);
        if (!patient) {
          const err = new Error('Patient not found');
          err.statusCode = 404;
          throw err;
        }
        const doctor = await Doctor.findActiveById(client, doctor_id);
        if (!doctor) {
          const err = new Error('Doctor not found or inactive');
          err.statusCode = 404;
          throw err;
        }

        // A walk-in visit is itself a treating relationship, but `patients`
        // is RLS-protected (schema.sql doctor_select_assigned) on
        // assigned_doctor_id OR patient_care_team membership, while `visits`
        // itself has no RLS. Without this, staff could freely create a
        // walk-in for a doctor who isn't this patient's assigned/primary
        // doctor (the normal case — triage routes to whichever doctor is
        // free) and the visit row would insert fine but then be permanently
        // invisible in that doctor's own listToday queue, since VISIT_SELECT
        // inner-joins patients and RLS silently drops the row. Skipped when
        // the doctor already IS the assigned doctor so CareTeam.add's
        // upsert never overwrites an existing is_primary=true row with false.
        if (doctor_id !== patient.assigned_doctor_id) {
          await CareTeam.add(client, {
            patientId: patient_id,
            doctorId: doctor_id,
            speciality: doctor.specialisation ?? null,
            isPrimary: false,
            assignedBy: req.user.userId,
          });
        }

        // Auto-assign next queue number for this doctor today. Range
        // predicate against the clinic's local day (see TODAY_START_SQL
        // above) so this both uses idx_visits_date and resets at the
        // clinic's actual midnight, not the DB session's.
        const queueResult = await client.query(
          `SELECT COALESCE(MAX(queue_no), 0) + 1 AS next_no
             FROM visits
            WHERE doctor_id = $1
              AND ${todayRangeCondition('checked_in_at')}`,
          [doctor_id]
        );
        const queue_no = queueResult.rows[0].next_no;
        // clinic is derived from the assigned doctor's own specialisation,
        // never accepted from the client — a doctor belongs to exactly one
        // clinic (many doctors per clinic, never the reverse), so which
        // clinic a visit is under isn't an independent choice staff make at
        // check-in, it's implied entirely by which doctor they picked.
        const insert = await client.query(
          `INSERT INTO visits (patient_id, doctor_id, queue_no, clinic, notes, visit_type, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [patient_id, doctor_id, queue_no, doctor.specialisation ?? null, notes ?? null, visit_type ?? null, req.user.userId]
        );
        const visit = insert.rows[0];
        await AuditLog.log(client, {
          userId: req.user.userId,
          action: AUDIT_ACTIONS.CREATE_VISIT,
          resource: 'visits',
          recordId: visit.visit_id,
          ipAddress: req.ip,
        });
        const full = await client.query(`${VISIT_SELECT} WHERE v.visit_id = $1`, [visit.visit_id]);
        return full;
      },
      { isolationLevel: 'SERIALIZABLE' }
    );
  } catch (err) {
    if (isSerializationFailure(err)) {
      return res.status(409).json({ error: 'Queue number conflict, please retry' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
  res.status(201).json(toRow(result.rows[0]));
};

exports.getPendingBillingCount = async (req, res) => {
  const result = await withTransaction(req.rlsSession, async (client) => {
    return client.query(
      `SELECT COUNT(*)::int AS count
         FROM visits
        WHERE status = 'completed'
          AND DATE(checked_in_at) = CURRENT_DATE`
    );
  });
  res.json({ count: result.rows[0].count });
};

/**
 * `visits` has no RLS (see schema.sql — only patients/medical_records/
 * lab_results are RLS-protected), so this controller is the only place a
 * doctor session's queue is scoped to their own patients. A doctor-role
 * session always gets `v.doctor_id = req.rlsSession.doctorId` regardless of
 * any `doctor_id` query param they send — without this, one doctor could
 * view another doctor's full daily patient queue (names, file numbers,
 * notes) just by passing a different doctor_id.
 */
exports.listToday = async (req, res) => {
  const { status, doctor_id } = req.query;
  const { role, doctorId: sessionDoctorId } = req.rlsSession;
  const result = await withTransaction(req.rlsSession, async (client) => {
    const conditions = [todayRangeCondition('v.checked_in_at')];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`v.status = $${params.length}`);
    }
    if (role === ROLES.DOCTOR) {
      params.push(sessionDoctorId);
      conditions.push(`v.doctor_id = $${params.length}`);
    } else if (doctor_id) {
      params.push(doctor_id);
      conditions.push(`v.doctor_id = $${params.length}`);
    }
    const orderBy = status === 'completed' ? 'v.completed_at ASC NULLS LAST' : 'v.queue_no ASC';
    return client.query(
      `${VISIT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
      params
    );
  });
  res.json({ visits: result.rows.map(toRow) });
};


/**
 * Same doctor self-scoping as listToday above — see that comment. Backs the
 * consultation page, so returns the full patient chart (VISIT_DETAIL_SELECT)
 * rather than the slim VISIT_SELECT shape.
 */
exports.getOne = async (req, res) => {
  const { role, doctorId: sessionDoctorId } = req.rlsSession;
  const conditions = ['v.visit_id = $1'];
  const params = [req.params.visitId];
  if (role === ROLES.DOCTOR) {
    params.push(sessionDoctorId);
    conditions.push(`v.doctor_id = $${params.length}`);
  }
  const result = await withTransaction(req.rlsSession, async (client) => {
    return client.query(`${VISIT_DETAIL_SELECT} WHERE ${conditions.join(' AND ')}`, params);
  });
  // A doctor requesting another doctor's visit_id hits the same generic
  // 404 as a nonexistent one — avoids leaking which case occurred, same
  // convention as patientsController.viewPatient.
  if (!result.rows.length) return res.status(404).json({ error: 'Visit not found' });
  res.json(toDetailRow(result.rows[0]));
};

/**
 * Reachable by both admin and doctor (visits.routes.js), but each role may
 * only set the one transition it can actually witness: a doctor marks
 * waiting->in_progress (patient walked into the room) and
 * in_progress->completed (consultation ended) — staff at the front desk
 * have no way to know either of those moments happened. Staff mark
 * completed->billed (patient back at the counter to pay) — the one
 * transition staff actually see. `visits` has no RLS (see schema.sql), so
 * this 403 plus the doctor_id ownership check below are the only
 * enforcement — nothing at the database layer stops a role from setting an
 * out-of-scope status otherwise.
 */
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const { role, doctorId: sessionDoctorId } = req.rlsSession;

  if (role === ROLES.DOCTOR && !['in_progress', 'completed'].includes(status)) {
    return res.status(403).json({ error: 'Doctors may only mark a visit in_progress or completed' });
  }
  if (role === ROLES.ADMIN && status !== 'billed') {
    return res.status(403).json({ error: 'Staff may only mark a visit billed' });
  }

  const conditions = ['visit_id = $2'];
  // $1 is deliberately passed twice (as $1 and $3) rather than reused —
  // reusing the same placeholder in both `SET status = $1` and
  // `CASE WHEN $1 IN (...)` makes Postgres deduce two different types for
  // it (varchar via the column assignment, text via the IN-list) and fail
  // the whole query with "inconsistent types deduced for parameter $1"
  // (confirmed against this project's local DB). Giving each context its
  // own parameter sidesteps that entirely.
  const params = [status, req.params.visitId, status];
  if (role === ROLES.DOCTOR) {
    params.push(sessionDoctorId);
    conditions.push(`doctor_id = $${params.length}`);
  }

  const result = await withTransaction(req.rlsSession, async (client) => {
    return client.query(
      `UPDATE visits
          SET status = $1,
              completed_at = CASE WHEN $3 IN ('completed','billed') THEN NOW() ELSE completed_at END
        WHERE ${conditions.join(' AND ')}
        RETURNING *`,
      params
    );
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Visit not found' });
  res.json({ visitId: result.rows[0].visit_id, status: result.rows[0].status });
};
