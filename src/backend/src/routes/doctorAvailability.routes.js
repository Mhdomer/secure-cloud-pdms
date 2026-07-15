'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const doctorAvailabilityController = require('../controllers/doctorAvailabilityController');
const { ROLES } = require('../config/constants');

const router = Router();

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM, 24-hour

// GET /doctors/:doctorId/availability — any authenticated role may view a doctor's working hours
router.get(
  '/:doctorId/availability',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT),
  [param('doctorId').isUUID()],
  validateRequest,
  asyncHandler(doctorAvailabilityController.listAvailability)
);

// POST /doctors/:doctorId/availability — superadmin or the doctor themselves
router.post(
  '/:doctorId/availability',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN, ROLES.DOCTOR),
  [
    param('doctorId').isUUID(),
    body('day_of_week').isInt({ min: 0, max: 6 }),
    body('start_time').matches(TIME_FORMAT).withMessage('start_time must be in HH:MM 24-hour format'),
    body('end_time').matches(TIME_FORMAT).withMessage('end_time must be in HH:MM 24-hour format'),
    body('slot_minutes').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(doctorAvailabilityController.upsertAvailability)
);

// DELETE /doctors/:doctorId/availability/:dayOfWeek — superadmin or the doctor themselves
router.delete(
  '/:doctorId/availability/:dayOfWeek',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN, ROLES.DOCTOR),
  [param('doctorId').isUUID(), param('dayOfWeek').isInt({ min: 0, max: 6 })],
  validateRequest,
  setupRLSContext,
  asyncHandler(doctorAvailabilityController.removeAvailability)
);

module.exports = router;
