'use strict';

const { Router } = require('express');

const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const doctorsController = require('../controllers/doctorsController');
const { ROLES } = require('../config/constants');

const router = Router();

// GET /doctors — active doctor directory backing the assign-doctor dropdown
// (staff/superadmin) and the patient-facing booking dialog's doctor picker
// (patient). Non-sensitive (name/specialisation only, see doctorsController).
router.get(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT),
  asyncHandler(doctorsController.listActiveDoctors)
);

module.exports = router;
