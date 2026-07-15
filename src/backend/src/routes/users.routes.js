'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const usersController = require('../controllers/usersController');
const { ROLES } = require('../config/constants');

const router = Router();

// Superadmin's staff/doctor account directory — patients are never listed
// here (see User.listStaffAndDoctors). Backs the "how many staff/doctor
// accounts do I have" view on the User Management page.
router.get('/', authenticateJWT, authorizeRole(ROLES.SUPERADMIN), asyncHandler(usersController.listUsers));

// UC-04 — Superadmin Creates Staff Account (doctor or admin).
// Regular admin/staff cannot create other elevated accounts.
router.post(
  '/',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/),
    body('tempPassword')
      .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 })
      .withMessage('tempPassword must be at least 8 characters with uppercase, lowercase, and a number'),
    body('role').isIn([ROLES.DOCTOR, ROLES.ADMIN]),
    body('fullName')
      .if(body('role').equals(ROLES.DOCTOR))
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('fullName is required for doctor accounts'),
    body('specialisation').optional({ nullable: true }).trim().isLength({ max: 100 }),
  ],
  validateRequest,
  asyncHandler(usersController.createUser)
);

// UC-05 — Admin Deactivates User Account
router.patch(
  '/:userId/deactivate',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [param('userId').isUUID()],
  validateRequest,
  asyncHandler(usersController.deactivateUser)
);

// Account unlock — counterpart to UC-03 Account Lockout / UC-05 deactivation.
// Without this, a 3-strikes lockout is permanent and unrecoverable.
router.patch(
  '/:userId/reactivate',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [param('userId').isUUID()],
  validateRequest,
  asyncHandler(usersController.reactivateUser)
);

// Self-service password change — available to every authenticated role,
// not just admin. Required so admin-issued / seeded temp passwords can be
// rotated by their owner instead of being permanently known by the admin.
router.patch(
  '/me/password',
  authenticateJWT,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 0,
    }).withMessage('New password must be at least 8 characters with uppercase, lowercase, and a number'),
  ],
  validateRequest,
  asyncHandler(usersController.changeOwnPassword)
);

module.exports = router;
