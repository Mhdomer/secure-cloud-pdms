'use strict';

const { Router } = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const patientsRoutes = require('./patients.routes');
const appointmentsRoutes = require('./appointments.routes');
const medicalRecordsRoutes = require('./medicalRecords.routes');
const doctorsRoutes = require('./doctors.routes');
const doctorAvailabilityRoutes = require('./doctorAvailability.routes');
const invoicesRoutes = require('./invoices.routes');
const labResultsRoutes = require('./labResults.routes');
const passwordSetupRoutes = require('./passwordSetup.routes');

const router = Router();

router.use('/auth', authRoutes);
// passwordSetupRoutes defines /setup-password (GET + POST), public — mounted
// alongside authRoutes since both live under /api/auth.
router.use('/auth', passwordSetupRoutes);
router.use('/users', usersRoutes);
router.use('/patients', patientsRoutes);
router.use('/appointments', appointmentsRoutes);
// doctorsRoutes defines GET / (the directory listing); doctorAvailabilityRoutes
// defines the /:doctorId/availability sub-paths — both mounted at /doctors.
router.use('/doctors', doctorsRoutes);
router.use('/doctors', doctorAvailabilityRoutes);
// medicalRecordsRoutes defines its own full sub-paths (/records,
// /records/:recordId, /patients/:patientId/records), so it is mounted at
// the API root rather than under a single fixed prefix.
router.use('/', medicalRecordsRoutes);
// Same pattern — invoicesRoutes/labResultsRoutes each define their own full
// sub-paths (/patients/:patientId/invoices, /invoices/:invoiceId/file, etc.).
router.use('/', invoicesRoutes);
router.use('/', labResultsRoutes);

module.exports = router;
