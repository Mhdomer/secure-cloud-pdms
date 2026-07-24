'use strict';

const { Router } = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../utils/asyncHandler');
const clinicalTemplatesController = require('../controllers/clinicalTemplatesController');

const router = Router();

router.use(authMiddleware);

router.get('/', asyncHandler(clinicalTemplatesController.listTemplates));

module.exports = router;
