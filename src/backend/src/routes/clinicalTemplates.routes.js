'use strict';

const { Router } = require('express');
const { authenticateJWT } = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const clinicalTemplatesController = require('../controllers/clinicalTemplatesController');

const router = Router();

router.use(authenticateJWT);

router.get('/', asyncHandler(clinicalTemplatesController.listTemplates));

module.exports = router;
