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
// qty capped at 1000 (finding L-1) — unbounded before, so an absurd
// quantity could overflow invoice_items' DECIMAL(10,2) columns server-side
// and surface as a generic 500 instead of a clean validation error.
router.post('/items',
  authenticateJWT, authorizeRole(ROLES.DOCTOR),
  [
    body('service_id').optional({ nullable: true }).isUUID(),
    body('qty').optional().isInt({ min: 1, max: 1000 }),
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
  [param('itemId').isUUID(), body('qty').isInt({ min: 1, max: 1000 })],
  validateRequest, setupRLSContext, asyncHandler(ctrl.updateQty));

// Doctor only — mark consultation done
router.patch('/complete',
  authenticateJWT, authorizeRole(ROLES.DOCTOR),
  [
    body('prescription_notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 2000 }),
  ],
  validateRequest, setupRLSContext, asyncHandler(ctrl.markDone));

// Admin/superadmin — apply discount per item. Was admin-only (finding
// L-3) while GET / already includes superadmin — widened for consistency
// with the rest of the app's "superadmin is admin-equivalent-or-greater"
// principle (see DELTA-017's admin_select_patients fix for the same
// reasoning), so superadmin can fix a billing mistake directly rather than
// needing an admin account to do it.
router.patch('/items/:itemId/discount',
  authenticateJWT, authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  [param('itemId').isUUID(), body('discount_pct').isFloat({ min: 0, max: 100 })],
  validateRequest, setupRLSContext, asyncHandler(ctrl.updateDiscount));

// Admin/superadmin — collect payment. amount_paid must be > 0 (a payInvoice
// call now records one ledger entry per call — see billingController.js —
// so a 0 or negative "payment" is meaningless, not a valid partial state).
router.patch('/pay',
  authenticateJWT, authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  [
    body('payment_method').isIn(['cash','card','insurance']),
    body('amount_paid').isFloat({ gt: 0 }),
    body('insurance_co').optional({ nullable: true }).trim().isLength({ max: 100 }),
  ],
  validateRequest, setupRLSContext, asyncHandler(ctrl.payInvoice));

// Admin/superadmin — void an invoice created by mistake (finding H-2).
// Only draft/pending_billing can be cancelled; the controller itself
// enforces that (see cancelInvoice's comment for why).
router.patch('/cancel',
  authenticateJWT, authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  setupRLSContext, asyncHandler(ctrl.cancelInvoice));

module.exports = router;
