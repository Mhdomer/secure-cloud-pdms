'use strict';

const { Router } = require('express');
const { body } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { loginLimiter } = require('../middleware/rateLimiter');
const { authenticateJWT } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/authController');

const router = Router();

router.post(
  '/login',
  loginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required').isLength({ max: 50 }),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  asyncHandler(authController.login)
);

router.post('/logout', authenticateJWT, asyncHandler(authController.logout));

module.exports = router;
