'use strict';
const { Router } = require('express');
const { body, param } = require('express-validator');
const validateRequest     = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole }   = require('../middleware/rbacMiddleware');
const { setupRLSContext }  = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/billingController');
const { ROLES } = require('../config/constants');

const router = Router({ mergeParams: true });

// Admin/doctor can read any (assigned) invoice; patient can read their own
// (assertOwnVisit in the controller enforces the patient-ownership check).
// Superadmin reads any invoice too — the only way they reach this route is
// via the billing report's "View Invoices" drill-down (superadmin-only),
// which links straight here.
router.get('/',
  authenticateJWT, authorizeRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PATIENT, ROLES.SUPERADMIN),
  setupRLSContext, asyncHandler(ctrl.getInvoice));

// Doctor only — add/remove items during consultation
router.post('/items',
  authenticateJWT, authorizeRole(ROLES.DOCTOR),
  [
    body('service_id').optional({ nullable: true }).isUUID(),
    body('qty').optional().isInt({ min: 1 }),
    body('unit_price').isFloat({ min: 0 }),
  ],
  validateRequest, setupRLSContext, asyncHandler(ctrl.addItem));

router.delete('/items/:itemId',
  authenticateJWT, authorizeRole(ROLES.DOCTOR),
  [param('itemId').isUUID()],
  validateRequest, setupRLSContext, asyncHandler(ctrl.removeItem));

// Doctor only — adjust an already-added item's quantity directly
router.patch('/items/:itemId/qty',
  authenticateJWT, authorizeRole(ROLES.DOCTOR),
  [param('itemId').isUUID(), body('qty').isInt({ min: 1 })],
  validateRequest, setupRLSContext, asyncHandler(ctrl.updateQty));

// Doctor only — mark consultation done
router.patch('/complete',
  authenticateJWT, authorizeRole(ROLES.DOCTOR),
  [
    body('prescription_notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  ],
  validateRequest, setupRLSContext, asyncHandler(ctrl.markDone));

// Admin only — apply discount per item
router.patch('/items/:itemId/discount',
  authenticateJWT, authorizeRole(ROLES.ADMIN),
  [param('itemId').isUUID(), body('discount_pct').isFloat({ min: 0, max: 100 })],
  validateRequest, setupRLSContext, asyncHandler(ctrl.updateDiscount));

// Admin only — collect payment, finalize invoice
router.patch('/pay',
  authenticateJWT, authorizeRole(ROLES.ADMIN),
  [
    body('payment_method').isIn(['cash','card','insurance']),
    body('amount_paid').isFloat({ min: 0 }),
    body('insurance_co').optional({ nullable: true }).trim().isLength({ max: 100 }),
  ],
  validateRequest, setupRLSContext, asyncHandler(ctrl.payInvoice));

module.exports = router;
