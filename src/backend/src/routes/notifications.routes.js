'use strict';

const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notificationsController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const asyncHandler = require('../utils/asyncHandler');

router.get(
  '/',
  authenticateJWT,
  setupRLSContext,
  asyncHandler(notificationsController.listNotifications)
);

router.post(
  '/read-all',
  authenticateJWT,
  setupRLSContext,
  asyncHandler(notificationsController.markAllRead)
);

module.exports = router;
