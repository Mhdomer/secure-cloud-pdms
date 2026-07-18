'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const { uploadSingle } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const labResultsController = require('../controllers/labResultsController');
const { ROLES } = require('../config/constants');

const router = Router();

// Upload a lab result file (doctor only, must be assigned to the patient)
router.post(
  '/patients/:patientId/lab-results',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  uploadSingle,
  [
    param('patientId').isUUID(),
    body('test_name').trim().isLength({ min: 1, max: 255 }),
    body('result_date').optional({ nullable: true }).isISO8601(),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(labResultsController.uploadLabResult)
);

// List lab results for a patient (doctor only; RLS scopes to assigned patients)
router.get(
  '/patients/:patientId/lab-results',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  [param('patientId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(labResultsController.getLabResults)
);

// List the signed-in patient's own released lab results — patientId is
// derived from the session, never a route param.
router.get(
  '/lab-results/mine',
  authenticateJWT,
  authorizeRole(ROLES.PATIENT),
  validateRequest,
  setupRLSContext,
  asyncHandler(labResultsController.getMyLabResults)
);

// Doctor releases a result to the patient (must be assigned to the patient)
router.patch(
  '/lab-results/:resultId/release',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  [param('resultId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(labResultsController.releaseLabResult)
);

// Download a lab result file (doctor: must be assigned; patient: only their
// own, and only once released — enforced by RLS + the controller) — auth is
// checked before any file access; this is never served as a static route.
router.get(
  '/lab-results/:resultId/file',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR, ROLES.PATIENT),
  [param('resultId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(labResultsController.downloadLabResult)
);

module.exports = router;
