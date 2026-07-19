'use strict';
const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/departmentsController');
const { ROLES } = require('../config/constants');

const router = Router();

// Every authenticated role reads — dropdowns/labels need this everywhere
// (doctor creation, services catalog, billing report, walk-in display,
// patient booking's doctor picker).
router.get('/',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT),
  [query('active').optional().isBoolean()],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.list)
);

router.post('/',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [
    body('name_en').trim().isLength({ min: 1, max: 100 }),
    body('name_ar').trim().isLength({ min: 1, max: 100 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.create)
);

router.patch('/:key',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [
    param('key').trim().isLength({ min: 1, max: 50 }),
    body('name_en').optional().trim().isLength({ min: 1, max: 100 }),
    body('name_ar').optional().trim().isLength({ min: 1, max: 100 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.update)
);

// Deactivate/reactivate — never a hard delete, same reasoning as
// clinic_services' toggle endpoint (preserve integrity of every row that
// already references this department).
router.patch('/:key/toggle',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [param('key').trim().isLength({ min: 1, max: 50 })],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.toggle)
);

module.exports = router;
