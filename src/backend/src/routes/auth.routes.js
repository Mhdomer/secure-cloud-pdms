'use strict';

const { Router } = require('express');
const { body } = require('express-validator');

const validateRequest = require('../middleware/validateRequest');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const { authenticateJWT } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const authController = require('../controllers/authController');
const patientRegistrationController = require('../controllers/patientRegistrationController');

const router = Router();

const ID_TYPES = ['national_id', 'iqama', 'passport'];

function notFutureDate(value) {
  if (new Date(value) >= new Date()) {
    throw new Error('date_of_birth cannot be in the future');
  }
  return true;
}

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

// UC-19 step 1 — request an OTP for self-registration (public).
router.post(
  '/register/request-otp',
  otpRequestLimiter,
  [
    body('phone_number').isMobilePhone('any', { strictMode: true }).withMessage('Enter a phone number in international format, e.g. +966501234567'),
    body('national_id').trim().isLength({ min: 1, max: 20 }),
    body('id_type').isIn(ID_TYPES),
    body('date_of_birth').isISO8601().custom(notFutureDate),
  ],
  validateRequest,
  asyncHandler(patientRegistrationController.requestOtp)
);

// UC-19 step 2 — verify the OTP (public).
router.post(
  '/register/verify-otp',
  otpVerifyLimiter,
  [body('requestId').isUUID(), body('otp_code').trim().isLength({ min: 6, max: 6 }).isNumeric()],
  validateRequest,
  asyncHandler(patientRegistrationController.verifyOtp)
);

// UC-19 step 3 — complete registration: profile + own password (public,
// requires the registrationToken issued by step 2).
router.post(
  '/register/complete',
  [
    body('registrationToken').notEmpty(),
    body('full_name').trim().isLength({ min: 1, max: 100 }),
    body('gender').optional({ nullable: true }).isIn(['male', 'female']),
    body('nationality').optional({ nullable: true }).trim().isLength({ max: 50 }),
    body('preferred_language').optional({ nullable: true }).isIn(['en', 'ar']),
    body('email').optional({ nullable: true }).trim().isEmail().isLength({ max: 255 }),
    body('address').optional({ nullable: true }).trim().isLength({ max: 500 }),
    body('password').isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 0 }).withMessage(
      'Password must be at least 8 characters with uppercase, lowercase, and a number'
    ),
  ],
  validateRequest,
  asyncHandler(patientRegistrationController.completeRegistration)
);

module.exports = router;
