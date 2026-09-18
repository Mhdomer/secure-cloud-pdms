'use strict';

/**
 * Seeds a plausible, unmistakably-fake clinic into the Vercel demo database
 * so every dashboard (superadmin/admin/doctor/patient) has something to show
 * instead of an empty screen.
 *
 * Connection model (two different roles, on purpose):
 *
 *   - seed() writes as `pdms_app` over the POOLED Neon URL. pdms_app has
 *     BYPASSRLS = false, so every INSERT below is actually filtered by the
 *     same row-level-security policies the running app relies on. Writing
 *     as the database owner instead would bypass RLS entirely and prove
 *     nothing about whether the demo data is reachable through the app's
 *     own security model.
 *
 *   - truncateAll() runs as the database owner over the DIRECT (non-pooled)
 *     Neon URL. This is not a style choice: schema.sql never grants
 *     TRUNCATE to pdms_app, and only grants DELETE on a handful of tables
 *     (doctor_availability, invoice_items, patient_care_team, sick_leaves).
 *     Verified live against this database (2026-09-19) — `TRUNCATE users`
 *     and `DELETE FROM patients` as pdms_app both fail with "permission
 *     denied". TRUNCATE is Postgres DDL, and .env.demo.local's own comment
 *     says the direct URL is "needed for DDL" — this is that case.
 *
 * The RLS session variables (app.current_user_id / app.current_role /
 * app.current_doctor_id / app.current_patient_id) fail SILENTLY when unset:
 * the policies just filter the INSERT down to zero rows, the query still
 * "succeeds", and you get an empty clinic with no error. Every insert below
 * is checked against result.rowCount for exactly this reason.
 */

const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.join(__dirname, '..', 'src', 'backend', '.env.demo.local') });

const BCRYPT_COST = 10;

// ── connection builders ─────────────────────────────────────────────────────

/**
 * pdms_app over the pooled URL. Host/database come from DEMO_POOLED_URL;
 * the URL's own embedded user/password (the database owner) are deliberately
 * discarded and replaced with pdms_app + PDMS_APP_PASSWORD.
 */
function appRoleConnectionConfig() {
  const pooledUrl = process.env.DEMO_POOLED_URL;
  const appPassword = process.env.PDMS_APP_PASSWORD;
  if (!pooledUrl) throw new Error('DEMO_POOLED_URL is not set (see src/backend/.env.demo.local)');
  if (!appPassword) throw new Error('PDMS_APP_PASSWORD is not set (see src/backend/.env.demo.local)');

  const u = new URL(pooledUrl);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    database: u.pathname.replace(/^\//, ''),
    user: 'pdms_app',
    password: appPassword,
    ssl: { rejectUnauthorized: true },
  };
}

/** Database owner over the direct URL — administrative reset only, see header comment. */
function ownerConnectionConfig() {
  const directUrl = process.env.DEMO_DIRECT_URL;
  if (!directUrl) throw new Error('DEMO_DIRECT_URL is not set (see src/backend/.env.demo.local)');
  return { connectionString: directUrl, ssl: { rejectUnauthorized: true } };
}

/** Applies an RLS session exactly as src/backend/src/config/database.js's withTransaction does. */
async function asRole(client, role, { userId = '', doctorId = '', patientId = '' } = {}) {
  await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
  await client.query('SELECT set_config($1, $2, true)', ['app.current_role', role]);
  await client.query('SELECT set_config($1, $2, true)', ['app.current_doctor_id', doctorId]);
  await client.query('SELECT set_config($1, $2, true)', ['app.current_patient_id', patientId]);
}

/** Throws if RLS silently filtered an INSERT/UPDATE down to zero rows. Returns the first row. */
function mustWrite(result, label) {
  if (result.rowCount === 0) {
    throw new Error(
      `${label}: 0 rows written — RLS filtered this write. Check the session role/ids set just before it.`
    );
  }
  return result.rows[0];
}

// ── fixed demo content ──────────────────────────────────────────────────────

const DEPARTMENTS = {
  general: 'general',
  dental: 'dental',
  pediatrics: 'pediatrics',
};

const DOCTOR_DEFS = [
  { username: 'demo.doctor', fullName: 'Dr. Ahmad Al-Fahad', specialisation: DEPARTMENTS.general, license: 'SCFHS-DEMO-0001', phone: '+966500000101' },
  { username: 'demo.doctor2', fullName: 'Dr. Layla Al-Zahrani', specialisation: DEPARTMENTS.dental, license: 'SCFHS-DEMO-0002', phone: '+966500000102' },
  { username: 'demo.doctor3', fullName: 'Dr. Yousef Al-Qahtani', specialisation: DEPARTMENTS.pediatrics, license: 'SCFHS-DEMO-0003', phone: '+966500000103' },
];

// full_name, gender — invented, generic Saudi-style names. Patient 0 is
// wired to the demo.patient login below.
const PATIENT_DEFS = [
  { name: 'Sara Al-Qahtani', gender: 'female' },
  { name: 'Faisal Al-Otaibi', gender: 'male' },
  { name: 'Noura Al-Harbi', gender: 'female' },
  { name: 'Abdullah Al-Shehri', gender: 'male' },
  { name: 'Maha Al-Dosari', gender: 'female' },
  { name: 'Khalid Al-Ghamdi', gender: 'male' },
  { name: 'Reem Al-Anzi', gender: 'female' },
  { name: 'Turki Al-Malki', gender: 'male' },
  { name: 'Hind Al-Subaie', gender: 'female' },
  { name: 'Saad Al-Amri', gender: 'male' },
  { name: 'Aisha Al-Zahrani', gender: 'female' },
  { name: 'Mohammed Al-Harthi', gender: 'male' },
  { name: 'Lama Al-Rashidi', gender: 'female' },
  { name: 'Bandar Al-Enezi', gender: 'male' },
  { name: 'Ghada Al-Mutairi', gender: 'female' },
  { name: 'Omar Al-Sulami', gender: 'male' },
  { name: 'Fatimah Al-Qarni', gender: 'female' },
  { name: 'Nasser Al-Juhani', gender: 'male' },
  { name: 'Wafa Al-Balawi', gender: 'female' },
  { name: 'Sultan Al-Shamrani', gender: 'male' },
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ── seed ─────────────────────────────────────────────────────────────────

async function seed() {
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error('DEMO_PASSWORD is not set (see src/backend/.env.demo.local)');

  const client = new Client(appRoleConnectionConfig());
  await client.connect();

  const counts = {
    users: 0,
    doctors: 0,
    patients: 0,
    medical_records: 0,
    lab_results: 0,
    lab_results_released: 0,
    appointments: 0,
    visits: 0,
    visit_invoices: 0,
    invoice_items: 0,
    invoice_payments: 0,
    sick_leaves: 0,
    patient_invoices: 0,
  };

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(demoPassword, BCRYPT_COST);

    // ── users + doctors — no RLS, insert directly ──────────────────────────
    const superadmin = mustWrite(
      await client.query(
        `INSERT INTO users (username, password_hash, role, is_active, failed_attempts)
         VALUES ($1, $2, 'superadmin', true, 0) RETURNING user_id`,
        ['demo.superadmin', passwordHash]
      ),
      'users(demo.superadmin)'
    );
    counts.users++;

    const staff = mustWrite(
      await client.query(
        `INSERT INTO users (username, password_hash, role, is_active, failed_attempts)
         VALUES ($1, $2, 'admin', true, 0) RETURNING user_id`,
        ['demo.staff', passwordHash]
      ),
      'users(demo.staff)'
    );
    counts.users++;

    const patientUser = mustWrite(
      await client.query(
        `INSERT INTO users (username, password_hash, role, is_active, failed_attempts)
         VALUES ($1, $2, 'patient', true, 0) RETURNING user_id`,
        ['demo.patient', passwordHash]
      ),
      'users(demo.patient)'
    );
    counts.users++;

    const doctors = [];
    for (const def of DOCTOR_DEFS) {
      const doctorUser = mustWrite(
        await client.query(
          `INSERT INTO users (username, password_hash, role, is_active, failed_attempts)
           VALUES ($1, $2, 'doctor', true, 0) RETURNING user_id`,
          [def.username, passwordHash]
        ),
        `users(${def.username})`
      );
      counts.users++;

      const doctorRow = mustWrite(
        await client.query(
          `INSERT INTO doctors (user_id, full_name, specialisation, license_number, phone, is_active)
           VALUES ($1, $2, $3, $4, $5, true) RETURNING doctor_id`,
          [doctorUser.user_id, def.fullName, def.specialisation, def.license, def.phone]
        ),
        `doctors(${def.fullName})`
      );
      counts.doctors++;

      doctors.push({ ...def, userId: doctorUser.user_id, doctorId: doctorRow.doctor_id });
    }

    // ── patients — RLS-protected, admin_insert_patients requires this role ──
    await asRole(client, 'admin');

    const patients = [];
    for (let i = 0; i < PATIENT_DEFS.length; i++) {
      const def = PATIENT_DEFS[i];
      const idx = i + 1;
      const doctor = doctors[Math.floor(i / 7) % doctors.length] || doctors[i % doctors.length];
      const isDemoPatient = i === 0;
      const dobYear = 1958 + ((i * 7) % 45); // spread of adult ages
      const dob = `${dobYear}-${String(((i % 12) + 1)).padStart(2, '0')}-${String(((i % 27) + 1)).padStart(2, '0')}`;
      const phone = `+9665000000${String(idx).padStart(2, '0')}`;
      const nationalId = `DEMO${String(idx).padStart(6, '0')}`;

      const row = mustWrite(
        await client.query(
          `INSERT INTO patients
             (user_id, full_name, date_of_birth, gender, contact_number,
              assigned_doctor_id, id_type, national_id, blood_type, nationality, preferred_language)
           VALUES ($1, $2, $3, $4, $5, $6, 'national_id', $7, $8, 'Saudi', $9)
           RETURNING patient_id`,
          [
            isDemoPatient ? patientUser.user_id : null,
            def.name,
            dob,
            def.gender,
            phone,
            doctor.doctorId,
            nationalId,
            BLOOD_TYPES[i % BLOOD_TYPES.length],
            i % 3 === 0 ? 'ar' : 'en',
          ]
        ),
        `patients(${def.name})`
      );
      counts.patients++;
      patients.push({ ...def, patientId: row.patient_id, doctorId: doctor.doctorId });
    }

    // ── medical_records + lab_results — doctor role, own doctor_id ─────────
    const labTests = ['Complete Blood Count (CBC)', 'Lipid Panel', 'Urinalysis', 'Blood Glucose (Fasting)', 'Thyroid Panel (TSH)'];
    let labSeq = 0;

    for (const doctor of doctors) {
      await asRole(client, 'doctor', { doctorId: doctor.doctorId, userId: doctor.userId });

      const ownPatients = patients.filter((p) => p.doctorId === doctor.doctorId);
      const recordTargets = ownPatients.slice(0, 3);

      for (const patient of recordTargets) {
        mustWrite(
          await client.query(
            `INSERT INTO medical_records
               (patient_id, doctor_id, diagnosis, prescription, notes,
                chief_complaint, objective, assessment, plan, vital_signs, visit_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'consultation')
             RETURNING record_id`,
            [
              patient.patientId,
              doctor.doctorId,
              'Routine check-up, no acute findings',
              'Paracetamol 500mg as needed',
              'Patient reports feeling well overall.',
              'Follow-up for general wellness',
              'Vitals within normal range',
              'Stable, no new concerns',
              'Continue current regimen, review in 3 months',
              JSON.stringify({ bp: '120/80', temp: '37.0', weight: '72kg', height: '170cm' }),
            ]
          ),
          `medical_records(${patient.name})`
        );
        counts.medical_records++;
      }

      const labTargets = ownPatients.slice(0, 2);
      for (const patient of labTargets) {
        labSeq++;
        const resultRow = mustWrite(
          await client.query(
            `INSERT INTO lab_results
               (patient_id, uploaded_by, file_path, original_filename, file_size, mime_type, test_name, result_date, notes)
             VALUES ($1, $2, $3, $4, $5, 'application/pdf', $6, CURRENT_DATE - INTERVAL '2 days', $7)
             RETURNING result_id`,
            [
              patient.patientId,
              doctor.userId,
              `/demo/seed/lab-result-${labSeq}.pdf`,
              `lab-result-${labSeq}.pdf`,
              102400,
              labTests[labSeq % labTests.length],
              'Results within reference range.',
            ]
          ),
          `lab_results(${patient.name})`
        );
        counts.lab_results++;

        // Release two of every three — leaves a couple pending so the
        // release action itself is still demonstrable, not just its result.
        if (labSeq % 3 !== 0) {
          mustWrite(
            await client.query(
              `UPDATE lab_results SET released_at = NOW(), released_by = $1 WHERE result_id = $2 RETURNING result_id`,
              [doctor.userId, resultRow.result_id]
            ),
            `lab_results.release(${patient.name})`
          );
          counts.lab_results_released++;
        }
      }
    }

    // ── appointments, visits, invoices, sick leaves — admin role ───────────
    await asRole(client, 'admin');

    const APPT_TYPES = ['consultation', 'follow_up', 'checkup', 'emergency'];
    const APPT_STATUSES = ['scheduled', 'scheduled', 'confirmed', 'scheduled', 'cancelled'];
    let apptSeq = 0;
    for (let day = 1; day <= 14; day++) {
      const apptsToday = day % 3 === 0 ? 1 : 2;
      for (let slot = 0; slot < apptsToday; slot++) {
        const patient = patients[(day * 3 + slot) % patients.length];
        const doctor = doctors[(day + slot) % doctors.length];
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + day);
        scheduledAt.setHours(9 + slot * 2, 0, 0, 0);

        mustWrite(
          await client.query(
            `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, type, notes, created_by, duration_minutes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 30)
             RETURNING appointment_id`,
            [
              patient.patientId,
              doctor.doctorId,
              scheduledAt,
              APPT_STATUSES[apptSeq % APPT_STATUSES.length],
              APPT_TYPES[apptSeq % APPT_TYPES.length],
              'Demo appointment',
              staff.user_id,
            ]
          ),
          `appointments(day ${day})`
        );
        counts.appointments++;
        apptSeq++;
      }
    }

    // Walk-in visits — two of each status. The status-transition trigger
    // only fires on UPDATE, so inserting straight into a terminal status is
    // fine here (no transition is happening).
    const VISIT_STATUSES = ['waiting', 'in_progress', 'completed', 'billed', 'cancelled'];
    const visits = [];
    let queueNo = 0;
    for (const status of VISIT_STATUSES) {
      for (let rep = 0; rep < 2; rep++) {
        queueNo++;
        const patient = patients[(queueNo * 5) % patients.length];
        const doctor = doctors[queueNo % doctors.length];
        const isPast = status === 'completed' || status === 'billed' || status === 'cancelled';
        const checkedInAt = isPast ? new Date(Date.now() - (queueNo + 1) * 3600 * 1000) : new Date();
        const completedAt = status === 'completed' || status === 'billed' ? new Date(checkedInAt.getTime() + 25 * 60 * 1000) : null;

        const row = mustWrite(
          await client.query(
            `INSERT INTO visits (patient_id, doctor_id, queue_no, clinic, status, notes, checked_in_at, completed_at, created_by, visit_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'consultation')
             RETURNING visit_id`,
            [
              patient.patientId,
              doctor.doctorId,
              queueNo,
              doctor.specialisation,
              status,
              'Demo walk-in visit',
              checkedInAt,
              completedAt,
              staff.user_id,
            ]
          ),
          `visits(status=${status})`
        );
        counts.visits++;
        visits.push({ visitId: row.visit_id, patient, doctor, status });
      }
    }

    // Bill the 'completed' and 'billed' visits — mixed paid/unpaid states.
    const billable = visits.filter((v) => v.status === 'completed' || v.status === 'billed');
    let billIdx = 0;
    for (const visit of billable) {
      billIdx++;
      const items = [
        { name: 'Consultation Fee', unitPrice: 150 },
        { name: 'Follow-up Medication', unitPrice: 50 },
      ];
      const netTotal = items.reduce((sum, it) => sum + it.unitPrice, 0);
      const vatTotal = Math.round(netTotal * 0.15 * 100) / 100;
      const grandTotal = netTotal + vatTotal;

      // completed -> not yet billed (pending_billing). billed -> alternate
      // between fully paid and partially paid, so both states are visible.
      let status;
      let amountPaid;
      if (visit.status === 'completed') {
        status = 'pending_billing';
        amountPaid = 0;
      } else if (billIdx % 2 === 0) {
        status = 'paid';
        amountPaid = grandTotal;
      } else {
        status = 'partial';
        amountPaid = 100;
      }
      const amountBalance = Math.round((grandTotal - amountPaid) * 100) / 100;

      const invoiceRow = mustWrite(
        await client.query(
          `INSERT INTO visit_invoices
             (visit_id, patient_id, doctor_id, payment_method, subtotal, total_discount, net_total,
              total_vat, grand_total, amount_paid, amount_balance, status, created_by, paid_at, paid_by)
           VALUES ($1, $2, $3, $4, $5, 0, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING invoice_id`,
          [
            visit.visitId,
            visit.patient.patientId,
            visit.doctor.doctorId,
            amountPaid > 0 ? 'cash' : null,
            netTotal,
            vatTotal,
            grandTotal,
            amountPaid,
            amountBalance,
            status,
            staff.user_id,
            status === 'paid' ? new Date() : null,
            status === 'paid' ? staff.user_id : null,
          ]
        ),
        `visit_invoices(visit ${visit.visitId})`
      );
      counts.visit_invoices++;

      let sortOrder = 0;
      for (const item of items) {
        sortOrder++;
        const itemVat = Math.round(item.unitPrice * 0.15 * 100) / 100;
        mustWrite(
          await client.query(
            `INSERT INTO invoice_items
               (invoice_id, code_no, name_en, name_ar, qty, unit_price, discount_pct, discount_amount,
                net_price, vat_pct, vat_amount, total_with_vat, sort_order)
             VALUES ($1, $2, $3, $4, 1, $5, 0, 0, $5, 15, $6, $7, $8)
             RETURNING item_id`,
            [
              invoiceRow.invoice_id,
              `SVC-${String(sortOrder).padStart(3, '0')}`,
              item.name,
              item.name,
              item.unitPrice,
              itemVat,
              item.unitPrice + itemVat,
              sortOrder,
            ]
          ),
          `invoice_items(${item.name})`
        );
        counts.invoice_items++;
      }

      if (amountPaid > 0) {
        mustWrite(
          await client.query(
            `INSERT INTO invoice_payments (invoice_id, amount, payment_method, collected_by)
             VALUES ($1, $2, 'cash', $3) RETURNING payment_id`,
            [invoiceRow.invoice_id, amountPaid, staff.user_id]
          ),
          `invoice_payments(invoice ${invoiceRow.invoice_id})`
        );
        counts.invoice_payments++;
      }
    }

    // Sick leaves — a handful, tied to a few of the walk-in visits.
    const sickLeaveTargets = visits.slice(0, 4);
    let leaveSeq = 0;
    for (const visit of sickLeaveTargets) {
      leaveSeq++;
      mustWrite(
        await client.query(
          `INSERT INTO sick_leaves (visit_id, patient_id, doctor_id, reference_no, start_date, days_count, diagnosis, work_restrictions)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7)
           RETURNING leave_id`,
          [
            visit.visitId,
            visit.patient.patientId,
            visit.doctor.doctorId,
            `SEHA-SL-${String(leaveSeq).padStart(6, '0')}`,
            2 + (leaveSeq % 3),
            'Upper respiratory tract infection',
            'Avoid strenuous activity for the leave period',
          ]
        ),
        `sick_leaves(${visit.patient.name})`
      );
      counts.sick_leaves++;
    }

    // Uploaded billing documents (patient_invoices) — separate from the
    // visit_invoices billing engine above; these are scanned files reception
    // attaches to a patient's record.
    for (let i = 0; i < 5; i++) {
      const patient = patients[i * 4];
      const isConsent = i === 4;
      mustWrite(
        await client.query(
          `INSERT INTO patient_invoices
             (patient_id, uploaded_by, file_path, original_filename, file_size, mime_type, amount, description, invoice_date, category)
           VALUES ($1, $2, $3, $4, $5, 'application/pdf', $6, $7, CURRENT_DATE - INTERVAL '1 day' * $8, $9)
           RETURNING invoice_id`,
          [
            patient.patientId,
            staff.user_id,
            `/demo/seed/patient-invoice-${i + 1}.pdf`,
            `patient-invoice-${i + 1}.pdf`,
            51200,
            isConsent ? null : 250 + i * 50,
            isConsent ? 'Signed consent form' : 'Clinic invoice',
            i,
            isConsent ? 'consent' : 'invoice',
          ]
        ),
        `patient_invoices(${patient.name})`
      );
      counts.patient_invoices++;
    }

    await client.query('COMMIT');
    return counts;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

// ── truncateAll ──────────────────────────────────────────────────────────

/**
 * Clears every table seed() writes, in dependency order, so seed() can be
 * re-run cleanly. Runs as the database owner over the direct URL — see the
 * header comment for why pdms_app cannot do this itself.
 *
 * Deliberately does NOT touch `departments` (pre-seeded reference data, not
 * written by seed()). CASCADE will also empty a few small auxiliary tables
 * that reference these but that seed() never writes (otp_verifications,
 * password_setup_tokens, audit_log, patient_care_team, doctor_availability)
 * — all ephemeral/derived data in this demo database, so that's accepted
 * rather than worked around.
 */
async function truncateAll() {
  const client = new Client(ownerConnectionConfig());
  await client.connect();
  try {
    await client.query(`
      TRUNCATE TABLE
        invoice_payments,
        invoice_items,
        visit_invoices,
        sick_leaves,
        lab_results,
        patient_invoices,
        medical_records,
        appointments,
        visits,
        patients,
        doctors,
        users
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await client.end();
  }
}

module.exports = { seed, truncateAll };

if (require.main === module) {
  seed()
    .then((counts) => {
      console.log('seeded demo clinic successfully:');
      for (const [table, n] of Object.entries(counts)) {
        console.log(`  ${table}: ${n}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('seed failed:', err);
      process.exit(1);
    });
}
