'use strict';

const { Router } = require('express');
const { body, query } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const asyncHandler = require('../utils/asyncHandler');
const passwordSetupController = require('../controllers/passwordSetupController');

const router = Router();

// Tokens are always exactly 64 lowercase hex chars (crypto.randomBytes(32)) —
// anything else can be rejected before it ever reaches a DB query.
const TOKEN_SHAPE = { min: 64, max: 64 };

// Public — no auth middleware. The token itself is the credential.
router.get(
  '/setup-password',
  [query('token').trim().isLength(TOKEN_SHAPE).isHexadecimal()],
  validateRequest,
  asyncHandler(passwordSetupController.validateToken)
);

// Public — no auth middleware. The token itself is the credential.
router.post(
  '/setup-password',
  [
    body('token').trim().isLength(TOKEN_SHAPE).isHexadecimal(),
    body('password').isString().notEmpty(),
    body('confirmPassword').isString().notEmpty(),
  ],
  validateRequest,
  asyncHandler(passwordSetupController.setPassword)
);

module.exports = router;
