'use strict';
const { Router } = require('express');
const { param, query } = require('express-validator');
const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/billingController');
const { ROLES } = require('../config/constants');

const router = Router();

// Billing history for one patient (staff + doctor) — surfaced on
// PatientProfilePage's "Billing" tab; each row links out to
// GET /visits/:visitId/invoice for the full printable detail.
router.get(
  '/patients/:patientId/billing',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
  [param('patientId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.listForPatient)
);

// Signed-in patient's own billing history — patientId derived from the
// session, never a route param.
router.get(
  '/billing/mine',
  authenticateJWT,
  authorizeRole(ROLES.PATIENT),
  setupRLSContext,
  asyncHandler(ctrl.listMine)
);

// Staff end-of-day billing report — admin + superadmin, not doctor-facing
// (billing/collections is staff's domain, same as BillVisitPage) and not
// patient-facing (patients have their own /invoices page for their own
// history only).
router.get(
  '/billing/report',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  [query('date').optional().isISO8601({ strict: true }).bail().isLength({ min: 10, max: 10 })],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.getDailyReport)
);

// Drill-down from the daily report — "View Invoices" per doctor/clinic row.
router.get(
  '/billing/report/invoices',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  [
    query('date').optional().isISO8601({ strict: true }).bail().isLength({ min: 10, max: 10 }),
    query('doctor_id').optional().isUUID(),
    query('clinic').optional().trim().isLength({ max: 50 }),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.getDailyInvoices)
);

// Staff & superadmin full billing history list
router.get(
  '/invoices/history',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['all', 'paid', 'pending_billing', 'partial', 'cancelled', 'draft']),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(ctrl.getBillingHistory)
);

module.exports = router;
