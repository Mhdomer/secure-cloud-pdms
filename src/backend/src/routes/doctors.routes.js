'use strict';

const { Router } = require('express');

const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const doctorsController = require('../controllers/doctorsController');
const { ROLES } = require('../config/constants');

const router = Router();

// GET /doctors — active doctor directory backing the assign-doctor dropdown
router.get(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.DOCTOR),
  asyncHandler(doctorsController.listActiveDoctors)
);

module.exports = router;
