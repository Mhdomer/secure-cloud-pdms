'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const medicalRecordsController = require('../controllers/medicalRecordsController');
const { ROLES, APPOINTMENT_TYPES } = require('../config/constants');

const router = Router();

const paginationValidators = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const soapValidators = [
  body('objective').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('assessment').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('plan').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  body('vital_signs').optional({ nullable: true }).isObject(),
  body('vital_signs.bp').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('vital_signs.temp').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('vital_signs.weight').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('vital_signs.height').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('visit_type').optional({ nullable: true }).isIn(APPOINTMENT_TYPES),
];

// UC-10 — Create Medical Record
router.post(
  '/records',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  [
    body('patient_id').isUUID(),
    body('diagnosis').trim().isLength({ min: 1, max: 2000 }),
    body('prescription').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('chief_complaint').trim().isLength({ min: 1, max: 2000 }),
    ...soapValidators,
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(medicalRecordsController.createRecord)
);

// UC-11 — List Medical Records
router.get(
  '/records',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR, ROLES.PATIENT),
  paginationValidators,
  validateRequest,
  setupRLSContext,
  asyncHandler(medicalRecordsController.listRecords)
);

// UC-11 — View Single Medical Record
router.get(
  '/records/:recordId',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR, ROLES.PATIENT),
  [param('recordId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(medicalRecordsController.viewRecord)
);

// UC-12 — Update Medical Record
router.put(
  '/records/:recordId',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  [
    param('recordId').isUUID(),
    body('diagnosis').optional({ nullable: true }).trim().isLength({ min: 1, max: 2000 }),
    body('prescription').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('chief_complaint').optional({ nullable: true }).trim().isLength({ min: 1, max: 2000 }),
    ...soapValidators,
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(medicalRecordsController.updateRecord)
);

// UC-13 — View Patient Medical History
router.get(
  '/patients/:patientId/records',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  [param('patientId').isUUID(), ...paginationValidators],
  validateRequest,
  setupRLSContext,
  asyncHandler(medicalRecordsController.viewHistory)
);

module.exports = router;
