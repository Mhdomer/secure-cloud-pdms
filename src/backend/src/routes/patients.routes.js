'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const patientsController = require('../controllers/patientsController');
const { ROLES } = require('../config/constants');

const router = Router();

function notFutureDate(value) {
  if (new Date(value) >= new Date()) {
    throw new Error('date_of_birth cannot be in the future');
  }
  return true;
}

// UC-06 — Register New Patient
router.post(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [
    body('full_name').trim().isLength({ min: 1, max: 100 }),
    body('date_of_birth').isISO8601().custom(notFutureDate),
    body('gender').optional({ nullable: true }).isIn(['male', 'female']),
    body('contact_number').optional({ nullable: true }).trim().isLength({ min: 7, max: 20 }),
    body('assigned_doctor_id').isUUID(),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.registerPatient)
);

// UC-07 — View Patient Profile
router.get(
  '/:patientId',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR, ROLES.ADMIN),
  [param('patientId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.viewPatient)
);

// UC-08 — Update Patient Information
router.put(
  '/:patientId',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [
    param('patientId').isUUID(),
    body('full_name').optional({ nullable: true }).trim().isLength({ min: 1, max: 100 }),
    body('date_of_birth').optional({ nullable: true }).isISO8601().custom(notFutureDate),
    body('gender').optional({ nullable: true }).isIn(['male', 'female']),
    body('contact_number').optional({ nullable: true }).trim().isLength({ min: 7, max: 20 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.updatePatient)
);

// UC-09 — Assign Doctor to Patient
router.patch(
  '/:patientId/assign-doctor',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [param('patientId').isUUID(), body('doctor_id').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.assignDoctor)
);

module.exports = router;
