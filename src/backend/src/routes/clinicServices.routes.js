'use strict';
const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validateRequest   = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole }   = require('../middleware/rbacMiddleware');
const { setupRLSContext }  = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/clinicServicesController');
const { ROLES } = require('../config/constants');

const router = Router();

// All authenticated roles can read (needed for billing form)
router.get('/',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.DOCTOR),
  [
    query('q').optional().trim().isLength({ max: 100 }),
    query('category').optional().trim().isLength({ max: 50 }),
    query('active').optional().isBoolean(),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.list)
);

router.post('/',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [
    body('code_no').trim().isLength({ min: 1, max: 20 }),
    body('name_en').trim().isLength({ min: 1, max: 255 }),
    body('name_ar').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('base_price').isFloat({ min: 0 }),
    body('category').optional({ nullable: true }).trim().isLength({ max: 50 }),
    body('vat_pct').optional().isFloat({ min: 0, max: 100 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.create)
);

router.put('/:serviceId',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [
    param('serviceId').isUUID(),
    body('code_no').optional().trim().isLength({ min: 1, max: 20 }),
    body('name_en').optional().trim().isLength({ min: 1, max: 255 }),
    body('name_ar').optional({ nullable: true }).trim().isLength({ max: 255 }),
    body('base_price').optional().isFloat({ min: 0 }),
    body('category').optional({ nullable: true }).trim().isLength({ max: 50 }),
    body('vat_pct').optional().isFloat({ min: 0, max: 100 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.update)
);

// Toggle active/inactive — never hard-delete to preserve billing history
router.patch('/:serviceId/toggle',
  authenticateJWT,
  authorizeRole(ROLES.SUPERADMIN),
  [param('serviceId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.toggle)
);

module.exports = router;
