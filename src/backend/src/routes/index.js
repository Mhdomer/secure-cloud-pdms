'use strict';

const { Router } = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const patientsRoutes = require('./patients.routes');
const appointmentsRoutes = require('./appointments.routes');
const medicalRecordsRoutes = require('./medicalRecords.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/patients', patientsRoutes);
router.use('/appointments', appointmentsRoutes);
// medicalRecordsRoutes defines its own full sub-paths (/records,
// /records/:recordId, /patients/:patientId/records), so it is mounted at
// the API root rather than under a single fixed prefix.
router.use('/', medicalRecordsRoutes);

module.exports = router;
