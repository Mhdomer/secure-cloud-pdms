'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const { uploadSingle } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const invoicesController = require('../controllers/invoicesController');
const { ROLES } = require('../config/constants');

const router = Router();

// Matches patient_invoices' `category` CHECK constraint in schema.sql exactly.
const INVOICE_CATEGORIES = ['invoice', 'consent', 'other'];

// Upload a billing invoice (staff only)
router.post(
  '/patients/:patientId/invoices',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  uploadSingle,
  [
    param('patientId').isUUID(),
    body('amount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('description').optional({ nullable: true }).trim().isLength({ max: 2000 }),
    body('invoice_date').optional({ nullable: true }).isISO8601(),
    body('category').optional({ nullable: true }).isIn(INVOICE_CATEGORIES),
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.uploadInvoice)
);

// List invoices for a patient (staff + doctors) — ?category= optionally narrows the results
router.get(
  '/patients/:patientId/invoices',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.DOCTOR),
  [param('patientId').isUUID(), query('category').optional({ nullable: true }).isIn(INVOICE_CATEGORIES)],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.getInvoices)
);

// List the signed-in patient's own invoices — patientId is derived from the
// session, never a route param, so a patient can never request another
// patient's invoices by changing a URL.
router.get(
  '/invoices/mine',
  authenticateJWT,
  authorizeRole(ROLES.PATIENT),
  [query('category').optional({ nullable: true }).isIn(INVOICE_CATEGORIES)],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.getMyInvoices)
);

// Download an invoice file (staff + doctors: any patient's; patient: only
// their own, checked in the controller) — auth is checked before any file
// access; this is never served as a static route.
router.get(
  '/invoices/:invoiceId/file',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.DOCTOR, ROLES.PATIENT),
  [param('invoiceId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.downloadInvoice)
);

module.exports = router;
