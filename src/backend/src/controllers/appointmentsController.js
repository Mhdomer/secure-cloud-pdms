'use strict';

const { withTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');
const { parsePagination } = require('../utils/pagination');

const SERIALIZATION_FAILURE = '40001';

function isSerializationFailure(err) {
  return err && err.code === SERIALIZATION_FAILURE;
}

/**
 * Resolves doctor/patient full names for a batch of appointment rows using
 * the RLS-scoped transaction client, so a doctor's own appointment list
 * only ever resolves names for patients they're actually allowed to see.
 */
async function attachNames(client, appointments) {
  const doctorIds = [...new Set(appointments.map((a) => a.doctor_id).filter(Boolean))];
  const patientIds = [...new Set(appointments.map((a) => a.patient_id).filter(Boolean))];

  const [doctorRows, patientRows] = await Promise.all([
    doctorIds.length
      ? client.query('SELECT doctor_id, full_name FROM doctors WHERE doctor_id = ANY($1)', [doctorIds])
      : { rows: [] },
    patientIds.length
      ? client.query('SELECT patient_id, full_name FROM patients WHERE patient_id = ANY($1)', [patientIds])
      : { rows: [] },
  ]);

  const doctorNames = new Map(doctorRows.rows.map((d) => [d.doctor_id, d.full_name]));
  const patientNames = new Map(patientRows.rows.map((p) => [p.patient_id, p.full_name]));

  return appointments.map((a) => ({
    appointmentId: a.appointment_id,
    patientId: a.patient_id,
    doctorId: a.doctor_id,
    patientName: patientNames.get(a.patient_id) || null,
    doctorName: doctorNames.get(a.doctor_id) || null,
    scheduledAt: a.scheduled_at,
    status: a.status,
    type: a.type,
  }));
}

/** UC-14 / Figure 4.12 — Schedule Appointment (Admin only). Serializable transaction to prevent double-booking races. */
async function scheduleAppointment(req, res) {
  const { patient_id: patientId, doctor_id: doctorId, scheduled_at: scheduledAt, type, notes } = req.body;

  try {
    const result = await withTransaction(
      req.rlsSession,
      async (client) => {
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

        const conflict = await Appointment.findConflict(client, doctorId, scheduledAt);
        if (conflict) {
          const err = new Error('Doctor already has an appointment at this time');
          err.statusCode = 409;
          err.conflictingAppointmentId = conflict.appointment_id;
          throw err;
        }

        const appointment = await Appointment.create(client, {
          patientId,
          doctorId,
          scheduledAt,
          type,
          notes,
          createdBy: req.user.userId,
        });

        await AuditLog.log(client, {
          userId: req.user.userId,
          action: AUDIT_ACTIONS.SCHEDULE_APPOINTMENT,
          resource: 'appointments',
          recordId: appointment.appointment_id,
          ipAddress: req.ip,
        });

        return appointment;
      },
      { isolationLevel: 'SERIALIZABLE' }
    );

    return res.status(201).json({
      appointmentId: result.appointment_id,
      patientId,
      doctorId,
      scheduledAt: result.scheduled_at,
      status: result.status,
      message: 'Appointment scheduled successfully',
    });
  } catch (err) {
    if (isSerializationFailure(err)) {
      return res.status(409).json({ error: 'Scheduling conflict detected, please retry' });
    }
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, conflictingAppointmentId: err.conflictingAppointmentId });
    }
    throw err;
  }
}

/** UC-15/UC-16 — View Appointment Schedule. Scope is always derived from the session, never from query params (IDOR-proof by construction). */
async function listAppointments(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { role, doctorId, patientId } = req.rlsSession;

  const result = await withTransaction(req.rlsSession, async (client) => {
    let rows;
    if (role === ROLES.ADMIN) {
      rows = await Appointment.listForAdmin(client, { limit, offset });
    } else if (role === ROLES.DOCTOR) {
      rows = await Appointment.listForDoctor(client, doctorId, { limit, offset });
    } else {
      rows = await Appointment.listForPatient(client, patientId, { limit, offset });
    }
    return attachNames(client, rows);
  });

  return res.status(200).json({ appointments: result, page, limit });
}

/** UC-17 — Update Appointment (Admin only). Serializable to re-validate conflicts atomically. */
async function updateAppointment(req, res) {
  const { appointmentId } = req.params;
  const { doctor_id: doctorId, patient_id: patientId, scheduled_at: scheduledAt, type, notes } = req.body;

  try {
    const result = await withTransaction(
      req.rlsSession,
      async (client) => {
        const existing = await Appointment.findById(client, appointmentId);
        if (!existing) {
          const err = new Error('Appointment not found');
          err.statusCode = 404;
          throw err;
        }

        if (existing.status !== 'scheduled') {
          const err = new Error(`Cannot edit an appointment that is ${existing.status}`);
          err.statusCode = 409;
          throw err;
        }

        // Mirror scheduleAppointment's referential/active-status checks —
        // without these, a well-formed but nonexistent UUID falls through
        // to a raw FK violation at the DB (a 500, not a clean 404/400), and
        // a reassignment to a deactivated doctor would otherwise succeed
        // silently.
        if (doctorId) {
          const doctor = await Doctor.findActiveById(client, doctorId);
          if (!doctor) {
            const err = new Error('Doctor not found or inactive');
            err.statusCode = 404;
            throw err;
          }
        }
        if (patientId) {
          const patient = await Patient.findById(client, patientId);
          if (!patient) {
            const err = new Error('Patient not found');
            err.statusCode = 404;
            throw err;
          }
        }

        if (scheduledAt || doctorId) {
          const conflict = await Appointment.findConflict(
            client,
            doctorId || existing.doctor_id,
            scheduledAt || existing.scheduled_at,
            appointmentId
          );
          if (conflict) {
            const err = new Error('Doctor already has an appointment at this time');
            err.statusCode = 409;
            err.conflictingAppointmentId = conflict.appointment_id;
            throw err;
          }
        }

        const updated = await Appointment.update(client, appointmentId, { doctorId, patientId, scheduledAt, type, notes });

        await AuditLog.log(client, {
          userId: req.user.userId,
          action: AUDIT_ACTIONS.UPDATE_APPOINTMENT,
          resource: 'appointments',
          recordId: appointmentId,
          ipAddress: req.ip,
        });

        return updated;
      },
      { isolationLevel: 'SERIALIZABLE' }
    );

    return res.status(200).json({
      appointmentId: result.appointment_id,
      scheduledAt: result.scheduled_at,
      status: result.status,
      message: 'Appointment updated successfully',
    });
  } catch (err) {
    if (isSerializationFailure(err)) {
      return res.status(409).json({ error: 'Scheduling conflict detected, please retry' });
    }
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, conflictingAppointmentId: err.conflictingAppointmentId });
    }
    throw err;
  }
}

/**
 * UC-18 — Cancel Appointment (Admin only).
 * Runs SERIALIZABLE so two concurrent cancel requests for the same
 * appointment (e.g. a double-click) cannot both pass the status check
 * before either commits — the loser gets a 40001 mapped to 409 below,
 * exactly like scheduleAppointment/updateAppointment. `Appointment.cancel`'s
 * result is explicitly checked before it is used or audit-logged, so a
 * request that changed nothing never produces a false CANCEL_APPOINTMENT
 * audit entry.
 */
async function cancelAppointment(req, res) {
  const { appointmentId } = req.params;

  try {
    const result = await withTransaction(
      req.rlsSession,
      async (client) => {
        const existing = await Appointment.findById(client, appointmentId);
        if (!existing) {
          const err = new Error('Appointment not found');
          err.statusCode = 404;
          throw err;
        }
        if (existing.status !== 'scheduled') {
          const err = new Error(`Appointment is already ${existing.status}`);
          err.statusCode = 409;
          throw err;
        }

        const cancelled = await Appointment.cancel(client, appointmentId);
        if (!cancelled) {
          // Status flipped between the read above and this UPDATE (lost the
          // race to a concurrent request) — do not log a CANCEL_APPOINTMENT
          // audit entry for a write that did not actually happen.
          const err = new Error('Appointment was already cancelled');
          err.statusCode = 409;
          throw err;
        }

        await AuditLog.log(client, {
          userId: req.user.userId,
          action: AUDIT_ACTIONS.CANCEL_APPOINTMENT,
          resource: 'appointments',
          recordId: appointmentId,
          ipAddress: req.ip,
        });

        return cancelled;
      },
      { isolationLevel: 'SERIALIZABLE' }
    );

    return res.status(200).json({
      appointmentId: result.appointment_id,
      status: result.status,
      message: 'Appointment cancelled successfully',
    });
  } catch (err) {
    if (isSerializationFailure(err)) {
      return res.status(409).json({ error: 'This appointment was just modified, please retry' });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}

module.exports = { scheduleAppointment, listAppointments, updateAppointment, cancelAppointment };
