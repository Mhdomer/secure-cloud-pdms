'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');

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

const ID_TYPES = ['national_id', 'iqama', 'passport'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// national_id is handled separately per route: required on registration
// (staff enters national ID first — see UC-06 below), optional on update.
const patientDemographicValidators = [
  body('id_type').optional({ nullable: true }).isIn(ID_TYPES),
  body('blood_type').optional({ nullable: true }).isIn(BLOOD_TYPES),
  body('allergies').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('nationality').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('address').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('emergency_contact_name').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('emergency_contact_phone').optional({ nullable: true }).trim().isLength({ min: 7, max: 20 }),
  body('insurance_provider').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('insurance_number').optional({ nullable: true }).trim().isLength({ max: 50 }),
  body('email').optional({ nullable: true }).trim().isEmail().isLength({ max: 255 }),
  body('preferred_language').optional({ nullable: true }).isIn(['en', 'ar']),
];

// UC-06 — Register New Patient (staff enters the national ID first; the
// system checks for an existing match before creating a new record)
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
    body('national_id').trim().isLength({ min: 1, max: 20 }),
    ...patientDemographicValidators,
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.registerPatient)
);

// Search — national_id (exact), full_name (substring), contact_number
// (prefix). Staff and doctors both use this instead of typing/pasting a
// patient_id UUID. Reachable by both roles, but RLS (admin_select_patients /
// doctor_select_assigned) still scopes the actual rows returned: an admin
// session sees every patient, a doctor session only their own assigned
// patients — enforced at the database layer, not by this route.
router.get(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
  [
    query('q').trim().isLength({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.searchPatients)
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
    body('national_id').optional({ nullable: true }).trim().isLength({ min: 1, max: 20 }),
    ...patientDemographicValidators,
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

// UC-09b — List care team members for a patient (admin + doctor)
router.get(
  '/:patientId/care-team',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
  [param('patientId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.getCareTeam)
);

// UC-09b — Add a doctor to a patient's care team (admin only)
router.post(
  '/:patientId/care-team',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [
    param('patientId').isUUID(),
    body('doctor_id').isUUID(),
    body('speciality').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('is_primary').optional().isBoolean(),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.addToCareTeam)
);

// UC-09b — Remove a doctor from a patient's care team (admin only)
router.delete(
  '/:patientId/care-team/:assignmentId',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [param('patientId').isUUID(), param('assignmentId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.removeFromCareTeam)
);

// Regenerate a patient's password-setup QR (e.g. lost before scanning)
router.post(
  '/:patientId/regenerate-qr',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  [param('patientId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(patientsController.regenerateQR)
);

module.exports = router;
