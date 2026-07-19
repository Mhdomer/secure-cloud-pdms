'use strict';

const { withTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');
const { parsePagination } = require('../utils/pagination');
const { isSlotAvailable } = require('../utils/availability');
const { sendAppointmentConfirmation } = require('../services/whatsapp');

const DEFAULT_DURATION_MINUTES = 30;

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
    durationMinutes: a.duration_minutes,
  }));
}

/** UC-14 / Figure 4.12 — Schedule Appointment (Admin only). Serializable transaction to prevent double-booking races. */
async function scheduleAppointment(req, res) {
  const {
    patient_id: patientId,
    doctor_id: doctorId,
    scheduled_at: scheduledAt,
    type,
    notes,
    duration_minutes: durationMinutes,
  } = req.body;
  const effectiveDuration = durationMinutes || DEFAULT_DURATION_MINUTES;

  let confirmationContext = null;

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

        const available = await isSlotAvailable(client, doctorId, scheduledAt, effectiveDuration);
        if (!available) {
          const err = new Error(
            "Requested time is outside the doctor's working hours or overlaps another appointment"
          );
          err.statusCode = 409;
          throw err;
        }

        const appointment = await Appointment.create(client, {
          patientId,
          doctorId,
          scheduledAt,
          type,
          notes,
          createdBy: req.user.userId,
          durationMinutes: effectiveDuration,
        });

        await AuditLog.log(client, {
          userId: req.user.userId,
          action: AUDIT_ACTIONS.SCHEDULE_APPOINTMENT,
          resource: 'appointments',
          recordId: appointment.appointment_id,
          ipAddress: req.ip,
        });

        confirmationContext = { patient, doctor };
        return appointment;
      },
      { isolationLevel: 'SERIALIZABLE' }
    );

    // Fire-and-forget — not awaited, so a slow/failed WhatsApp send never
    // delays or fails the API response. See src/services/whatsapp.js.
    if (confirmationContext) {
      sendAppointmentConfirmation({
        appointmentId: result.appointment_id,
        patientName: confirmationContext.patient.full_name,
        patientPhone: confirmationContext.patient.contact_number,
        doctorName: confirmationContext.doctor.full_name,
        scheduledAt: result.scheduled_at,
      });
    }

    return res.status(201).json({
      appointmentId: result.appointment_id,
      patientId,
      doctorId,
      scheduledAt: result.scheduled_at,
      status: result.status,
      durationMinutes: result.duration_minutes,
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

/**
 * UC-20 — Patient Books Own Appointment (Patient only).
 * `patient_id` is always `req.rlsSession.patientId`, never trusted from the
 * request body — same IDOR-proof-by-construction principle as
 * listAppointments below. If the patient is still unassigned (e.g.
 * self-registered via UC-19), this auto-assigns them to the doctor they're
 * booking with — see docs/psm2/self-registration-design.md §5: without
 * this, the treating doctor could never chart the visit, since
 * doctor_select_assigned RLS blocks the lookup for an unassigned patient.
 * The `patient_self_assign_doctor` RLS policy only allows this while
 * assigned_doctor_id is still NULL, so it can only ever happen once.
 */
async function bookOwnAppointment(req, res) {
  const { doctor_id: doctorId, scheduled_at: scheduledAt, type, notes, duration_minutes: durationMinutes } = req.body;
  const patientId = req.rlsSession.patientId;
  const effectiveDuration = durationMinutes || DEFAULT_DURATION_MINUTES;

  let confirmationContext = null;

  try {
    const result = await withTransaction(
      req.rlsSession,
      async (client) => {
        const patient = await Patient.findById(client, patientId);
        if (!patient) {
          const err = new Error('Patient profile not found');
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

        const available = await isSlotAvailable(client, doctorId, scheduledAt, effectiveDuration);
        if (!available) {
          const err = new Error(
            "Requested time is outside the doctor's working hours or overlaps another appointment"
          );
          err.statusCode = 409;
          throw err;
        }

        const appointment = await Appointment.create(client, {
          patientId,
          doctorId,
          scheduledAt,
          type,
          notes,
          createdBy: req.user.userId,
          durationMinutes: effectiveDuration,
        });

        if (!patient.assigned_doctor_id) {
          await Patient.assignDoctor(client, patientId, doctorId);
        }

        await AuditLog.log(client, {
          userId: req.user.userId,
          action: AUDIT_ACTIONS.SCHEDULE_APPOINTMENT,
          resource: 'appointments',
          recordId: appointment.appointment_id,
          ipAddress: req.ip,
        });

        confirmationContext = { patient, doctor };
        return appointment;
      },
      { isolationLevel: 'SERIALIZABLE' }
    );

    // Fire-and-forget — not awaited, so a slow/failed WhatsApp send never
    // delays or fails the API response. See src/services/whatsapp.js.
    if (confirmationContext) {
      sendAppointmentConfirmation({
        appointmentId: result.appointment_id,
        patientName: confirmationContext.patient.full_name,
        patientPhone: confirmationContext.patient.contact_number,
        doctorName: confirmationContext.doctor.full_name,
        scheduledAt: result.scheduled_at,
      });
    }

    return res.status(201).json({
      appointmentId: result.appointment_id,
      doctorId,
      scheduledAt: result.scheduled_at,
      status: result.status,
      durationMinutes: result.duration_minutes,
      message: 'Appointment booked successfully',
    });
  } catch (err) {
    if (isSerializationFailure(err)) {
      return res.status(409).json({ error: 'Scheduling conflict detected, please retry' });
    }
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, conflictingAppointmentId: err.conflictingAppointmentId });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}

/** UC-15/UC-16 — View Appointment Schedule. Scope is always derived from the session, never from query params (IDOR-proof by construction). */
async function listAppointments(req, res) {
  const { page, limit, offset } = parsePagination(req.query);
  const { from, to } = req.query;
  const { role, doctorId, patientId } = req.rlsSession;

  const result = await withTransaction(req.rlsSession, async (client) => {
    // See Appointment.sweepExpired's own comment — this is the one place
    // that runs on every appointments read (dashboards, /appointments,
    // patient's own view), so it's the natural spot for the sweep rather
    // than a separate background job.
    await Appointment.sweepExpired(client);
    let rows;
    if (role === ROLES.ADMIN) {
      rows = await Appointment.listForAdmin(client, { limit, offset, from, to });
    } else if (role === ROLES.DOCTOR) {
      rows = await Appointment.listForDoctor(client, doctorId, { limit, offset, from, to });
    } else {
      rows = await Appointment.listForPatient(client, patientId, { limit, offset, from, to });
    }
    return attachNames(client, rows);
  });

  return res.status(200).json({ appointments: result, page, limit });
}

/** UC-17 — Update Appointment (Admin only). Serializable to re-validate conflicts atomically. */
async function updateAppointment(req, res) {
  const { appointmentId } = req.params;
  const {
    doctor_id: doctorId,
    patient_id: patientId,
    scheduled_at: scheduledAt,
    type,
    notes,
    duration_minutes: durationMinutes,
  } = req.body;

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

        if (existing.status !== 'scheduled' && existing.status !== 'confirmed') {
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

        if (scheduledAt || doctorId || durationMinutes) {
          const available = await isSlotAvailable(
            client,
            doctorId || existing.doctor_id,
            scheduledAt || existing.scheduled_at,
            durationMinutes || existing.duration_minutes,
            appointmentId
          );
          if (!available) {
            const err = new Error(
              "Requested time is outside the doctor's working hours or overlaps another appointment"
            );
            err.statusCode = 409;
            throw err;
          }
        }

        const updated = await Appointment.update(client, appointmentId, {
          doctorId,
          patientId,
          scheduledAt,
          type,
          notes,
          durationMinutes,
        });

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
      durationMinutes: result.duration_minutes,
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

/** UC-17b — Confirm Appointment (Admin or the assigned Doctor). */
async function confirmAppointment(req, res) {
  const { appointmentId } = req.params;
  const { role, doctorId } = req.rlsSession;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const existing = await Appointment.findById(client, appointmentId);
    if (!existing) {
      const err = new Error('Appointment not found');
      err.statusCode = 404;
      throw err;
    }

    // Application-layer ownership check — appointments has no RLS, so a
    // doctor confirming their own appointment must be verified here rather
    // than relying on a database policy.
    if (role === ROLES.DOCTOR && existing.doctor_id !== doctorId) {
      const err = new Error('You are not assigned to this appointment');
      err.statusCode = 403;
      throw err;
    }

    if (existing.status !== 'scheduled') {
      const err = new Error(`Cannot confirm an appointment that is ${existing.status}`);
      err.statusCode = 409;
      throw err;
    }

    const confirmed = await Appointment.confirm(client, appointmentId);
    if (!confirmed) {
      const err = new Error('Appointment status changed before it could be confirmed');
      err.statusCode = 409;
      throw err;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CONFIRM_APPOINTMENT,
      resource: 'appointments',
      recordId: appointmentId,
      ipAddress: req.ip,
    });

    return confirmed;
  });

  return res.status(200).json({
    appointmentId: result.appointment_id,
    status: result.status,
    message: 'Appointment confirmed successfully',
  });
}

/**
 * Complete Appointment — assigned Doctor only. Deliberately doctor-only,
 * not admin: whether a visit actually happened is a clinical judgment call,
 * the same reasoning ConsultationPage's "Complete Visit" is doctor-only for
 * walk-ins. Admin's role here stays limited to schedule/reschedule/cancel/
 * check-in (logistics). Allowed from scheduled/confirmed too, not just
 * arrived — staff sometimes forgets Quick Check-In, and that shouldn't
 * block a doctor who genuinely saw the patient from closing it out.
 */
async function completeAppointment(req, res) {
  const { appointmentId } = req.params;
  const { doctorId } = req.rlsSession;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const existing = await Appointment.findById(client, appointmentId);
    if (!existing) {
      const err = new Error('Appointment not found');
      err.statusCode = 404;
      throw err;
    }

    // Application-layer ownership check — appointments has no RLS, same
    // pattern as confirmAppointment/cancelAppointment above.
    if (existing.doctor_id !== doctorId) {
      const err = new Error('You are not assigned to this appointment');
      err.statusCode = 403;
      throw err;
    }

    if (!['scheduled', 'confirmed', 'arrived'].includes(existing.status)) {
      const err = new Error(`Cannot complete an appointment that is ${existing.status}`);
      err.statusCode = 409;
      throw err;
    }

    const completed = await Appointment.complete(client, appointmentId);
    if (!completed) {
      const err = new Error('Appointment status changed before it could be completed');
      err.statusCode = 409;
      throw err;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.COMPLETE_APPOINTMENT,
      resource: 'appointments',
      recordId: appointmentId,
      ipAddress: req.ip,
    });

    return completed;
  });

  return res.status(200).json({
    appointmentId: result.appointment_id,
    status: result.status,
    message: 'Appointment marked as completed',
  });
}

/**
 * Quick Check-In (Feature E) — Staff marks a patient as physically present.
 * Admin/superadmin only (appointments has no RLS, so this is the entire
 * access boundary — same pattern as scheduleAppointment/cancelAppointment).
 * Uses 409, not 400, for an already-arrived/completed/cancelled appointment,
 * matching confirmAppointment/cancelAppointment's existing convention for
 * "valid request, wrong resource state" in this file.
 */
async function checkinAppointment(req, res) {
  const { appointmentId } = req.params;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const existing = await Appointment.findById(client, appointmentId);
    if (!existing) {
      const err = new Error('Appointment not found');
      err.statusCode = 404;
      throw err;
    }

    if (existing.status !== 'scheduled' && existing.status !== 'confirmed') {
      const err = new Error(`Cannot check in an appointment that is ${existing.status}`);
      err.statusCode = 409;
      throw err;
    }

    const checkedIn = await Appointment.checkin(client, appointmentId);
    if (!checkedIn) {
      const err = new Error('Appointment status changed before it could be checked in');
      err.statusCode = 409;
      throw err;
    }

    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.PATIENT_CHECKED_IN,
      resource: 'appointments',
      recordId: appointmentId,
      ipAddress: req.ip,
    });

    return checkedIn;
  });

  return res.status(200).json({
    appointmentId: result.appointment_id,
    status: result.status,
    message: 'Patient checked in successfully',
  });
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
  const { cancellation_note: cancellationNote } = req.body;
  const { role, patientId } = req.rlsSession;

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

        // UC-21 — Application-layer ownership check for patient self-cancel:
        // appointments has no RLS, so this must be verified here, same
        // principle as confirmAppointment's doctor ownership check above.
        if (role === ROLES.PATIENT && existing.patient_id !== patientId) {
          const err = new Error('You are not permitted to cancel this appointment');
          err.statusCode = 403;
          throw err;
        }

        if (existing.status !== 'scheduled' && existing.status !== 'confirmed') {
          const err = new Error(`Appointment is already ${existing.status}`);
          err.statusCode = 409;
          throw err;
        }

        const cancelled = await Appointment.cancel(client, appointmentId, {
          cancelledBy: req.user.userId,
          cancellationNote,
        });
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

module.exports = {
  scheduleAppointment,
  bookOwnAppointment,
  listAppointments,
  updateAppointment,
  confirmAppointment,
  completeAppointment,
  checkinAppointment,
  cancelAppointment,
};
