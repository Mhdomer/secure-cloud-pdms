'use strict';

const { Router } = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const patientsRoutes = require('./patients.routes');
const appointmentsRoutes = require('./appointments.routes');
const medicalRecordsRoutes = require('./medicalRecords.routes');
const doctorsRoutes = require('./doctors.routes');
const doctorAvailabilityRoutes = require('./doctorAvailability.routes');
const departmentsRoutes = require('./departments.routes');
const invoicesRoutes = require('./invoices.routes');
const labResultsRoutes = require('./labResults.routes');
const passwordSetupRoutes = require('./passwordSetup.routes');
const clinicServicesRoutes = require('./clinicServices.routes');
const visitsRoutes = require('./visits.routes');
const billingRoutes = require('./billing.routes');
const billingHistoryRoutes = require('./billingHistory.routes');
const roomsRoutes = require('./rooms.routes');

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
router.use('/departments', departmentsRoutes);
// medicalRecordsRoutes defines its own full sub-paths (/records,
// /records/:recordId, /patients/:patientId/records), so it is mounted at
// the API root rather than under a single fixed prefix.
router.use('/', medicalRecordsRoutes);
// Same pattern — invoicesRoutes/labResultsRoutes each define their own full
// sub-paths (/patients/:patientId/invoices, /invoices/:invoiceId/file, etc.).
router.use('/', invoicesRoutes);
router.use('/', labResultsRoutes);
router.use('/services', clinicServicesRoutes);
router.use('/visits', visitsRoutes);
// mergeParams on billingRoutes picks up :visitId from this mount path — see
// billing.routes.js. Mounted after visitsRoutes, though order doesn't
// actually matter: none of visitsRoutes' own patterns (/, /today,
// /:visitId, /:visitId/status) can match a path with a literal /invoice
// segment, so there's no route-precedence conflict between the two either way.
router.use('/visits/:visitId/invoice', billingRoutes);
// billingHistoryRoutes defines its own full sub-paths (/patients/:patientId/billing,
// /billing/mine) — mounted at root, same pattern as invoicesRoutes above.
router.use('/', billingHistoryRoutes);
router.use('/rooms', roomsRoutes);

module.exports = router;
