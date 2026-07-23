'use strict';

const express = require('express');
const router = express.Router();
const sickLeavesController = require('../controllers/sickLeavesController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');

router.post(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  setupRLSContext,
  asyncHandler(sickLeavesController.createSickLeave)
);

router.get(
  '/patient/:patientId',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR, ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.PATIENT),
  setupRLSContext,
  asyncHandler(sickLeavesController.getPatientSickLeaves)
);

module.exports = router;
