'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
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

// GET /doctors/me — the signed-in doctor's own name/specialisation.
// Registered before /:doctorId-shaped routes for the same "don't shadow
// a literal path with a param route" reason as patients.routes.js's /me.
router.get(
  '/me',
  authenticateJWT,
  authorizeRole(ROLES.DOCTOR),
  asyncHandler(doctorsController.getMyProfile)
);

// PATCH /doctors/:doctorId — superadmin only, reassigns a doctor's
// department. Deliberately narrow (specialisation only) rather than a
// general doctor-update endpoint, matching the actual gap this closes —
// see the Departments page's per-row reassignment control.
router.patch(
  '/:doctorId',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [
    param('doctorId').isUUID(),
    body('specialisation').trim().isLength({ min: 1, max: 100 }),
  ],
  validateRequest,
  asyncHandler(doctorsController.updateDoctor)
);

module.exports = router;
