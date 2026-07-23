'use strict';
const express = require('express');
const router = express.Router();
const roomsController = require('../controllers/roomsController');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { authorizeRole } = require('../middleware/rbacMiddleware');
const { setupRLSContext } = require('../middleware/rlsContext');
const { ROLES } = require('../config/constants');

router.use(authenticateJWT);
router.use(setupRLSContext);

// All authenticated staff (doctor, admin, superadmin) can view rooms
router.get('/', authorizeRole(ROLES.DOCTOR, ROLES.ADMIN, ROLES.SUPERADMIN), roomsController.listRooms);

// Admin / Superadmin / Doctor can update room status / assign visit
router.patch('/:roomId', authorizeRole(ROLES.DOCTOR, ROLES.ADMIN, ROLES.SUPERADMIN), roomsController.updateRoom);

module.exports = router;
