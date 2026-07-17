'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const { uploadSingle } = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const invoicesController = require('../controllers/invoicesController');
const { ROLES } = require('../config/constants');

const router = Router();

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
  ],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.uploadInvoice)
);

// List invoices for a patient (staff + doctors)
router.get(
  '/patients/:patientId/invoices',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.DOCTOR),
  [param('patientId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.getInvoices)
);

// Download an invoice file (staff + doctors) — auth is checked before any
// file access; this is never served as a static route.
router.get(
  '/invoices/:invoiceId/file',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.DOCTOR),
  [param('invoiceId').isUUID()],
  validateRequest,
  setupRLSContext,
  asyncHandler(invoicesController.downloadInvoice)
);

module.exports = router;
