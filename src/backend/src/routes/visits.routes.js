'use strict';
const { Router } = require('express');
const { body, param, query } = require('express-validator');
const validateRequest     = require('../middleware/validateRequest');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole }   = require('../middleware/rbacMiddleware');
const { setupRLSContext }  = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/visitsController');
const { ROLES, APPOINTMENT_TYPES } = require('../config/constants');

const router = Router();

router.post('/',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN),
  [
    body('patient_id').isUUID(),
    body('doctor_id').isUUID(),
    // No `clinic` field here — it's derived server-side from the assigned
    // doctor's own specialisation (visitsController.create), never accepted
    // from the client.
    body('notes').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('visit_type').optional({ nullable: true }).isIn(APPOINTMENT_TYPES),
  ],
  validateRequest, setupRLSContext,
  asyncHandler(ctrl.create)
);

router.get('/pending-count',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.SUPERADMIN),
  setupRLSContext,
  asyncHandler(ctrl.getPendingBillingCount)
);

router.get('/today',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
  [
    query('status').optional().isIn(['waiting','in_progress','completed','billed']),
    query('doctor_id').optional().isUUID(),
  ],
  validateRequest, setupRLSContext,
  asyncHandler(ctrl.listToday)
);

router.get('/:visitId',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
  [param('visitId').isUUID()],
  validateRequest, setupRLSContext,
  asyncHandler(ctrl.getOne)
);

// Both roles reach this endpoint, but only for the transition each can
// actually witness — doctor: waiting->in_progress / in_progress->completed
// (present in the room); admin: completed->billed (present at the
// counter). ctrl.updateStatus enforces exactly which status each role may
// set; this route-level check only gates who may call the endpoint at all.
router.patch('/:visitId/status',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR),
  [
    param('visitId').isUUID(),
    body('status').isIn(['waiting','in_progress','completed','billed']),
  ],
  validateRequest, setupRLSContext,
  asyncHandler(ctrl.updateStatus)
);

router.post('/:visitId/send-ticket-sms',
  authenticateJWT,
  authorizeRole(ROLES.ADMIN, ROLES.DOCTOR, ROLES.SUPERADMIN),
  [param('visitId').isUUID()],
  validateRequest, setupRLSContext,
  asyncHandler(ctrl.sendTicketSms)
);

module.exports = router;
