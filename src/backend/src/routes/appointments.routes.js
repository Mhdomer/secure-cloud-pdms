'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const appointmentsController = require('../controllers/appointmentsController');
const { ROLES, APPOINTMENT_TYPES } = require('../config/constants');

const router = Router();

function futureDate(value) {
  if (new Date(value) <= new Date()) {
    throw new Error('scheduled_at must be in the future');
  }
  return true;
}

// UC-14 — Schedule Appointment
router.post(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [
    body('patient_id').isUUID(),
    body('doctor_id').isUUID(),
    body('scheduled_at').isISO8601().custom(futureDate),
    body('type').optional({ nullable: true }).isIn(APPOINTMENT_TYPES),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(appointmentsController.scheduleAppointment)
);

// UC-15 / UC-16 — View Appointment Schedule (scope always derived from session role)
router.get(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT),
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validateRequest,
  setupRLSContext,
  asyncHandler(appointmentsController.listAppointments)
);

// UC-17 — Update Appointment
router.put(
  '/:appointmentId',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [
    param('appointmentId').isUUID(),
    body('doctor_id').optional({ nullable: true }).isUUID(),
    body('patient_id').optional({ nullable: true }).isUUID(),
    body('scheduled_at').optional({ nullable: true }).isISO8601().custom(futureDate),
    body('type').optional({ nullable: true }).isIn(APPOINTMENT_TYPES),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(appointmentsController.updateAppointment)
);

// UC-18 — Cancel Appointment
router.patch(
  '/:appointmentId/cancel',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [param('appointmentId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(appointmentsController.cancelAppointment)
);

module.exports = router;
