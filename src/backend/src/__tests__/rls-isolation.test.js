'use strict';

/**
 * Cross-tenant isolation, asserted against a real PostgreSQL.
 *
 * This is the regression test for the CRITICAL IDOR found in Sprint 5:
 * `sick_leaves` shipped with no RLS at all, so any authenticated patient
 * could read any other patient's sick-leave certificates by id.
 *
 * Everything runs as `pdms_app` — the same unprivileged role the API uses —
 * through the same app.current_* session variables withTransaction sets. No
 * superuser connection is involved, so what passes here is what the running
 * application actually gets.
 *
 * The whole suite runs inside ONE transaction that is rolled back in
 * afterAll, and each test is fenced with a SAVEPOINT. Nothing is ever
 * committed, so the dev database is left byte-identical and the suite is
 * re-runnable. That also means it needs no DELETE grant, which `pdms_app`
 * deliberately does not have on users/patients/medical_records.
 *
 * Set SKIP_DB_TESTS=1 to skip when no local PostgreSQL is available.
 */

require('dotenv').config();
const { Pool } = require('pg');

const describeDb = process.env.SKIP_DB_TESTS === '1' ? describe.skip : describe;
const uniq = () => Math.random().toString(36).slice(2, 10);

describeDb('cross-tenant isolation (live PostgreSQL RLS)', () => {
  let pool;
  let client;
  const fx = {};

  /** Applies a session exactly as withTransaction does, then runs a query. */
  async function asSession(session, sql, params = []) {
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', session.userId || '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_role', session.role || '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_doctor_id', session.doctorId || '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_patient_id', session.patientId || '']);
    return client.query(sql, params);
  }

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      // Mirrors config/database.js so this suite can run against a managed
      // provider (Neon, Supabase) as well as local Postgres. Unset DB_SSL
      // means false, which is what local dev uses — unchanged.
      ssl:
        process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: true }
          : false,
      connectionTimeoutMillis: 5000,
    });

    client = await pool.connect();
    await client.query('BEGIN');

    const who = await client.query('SELECT current_user AS role');
    expect(who.rows[0].role).toBe('pdms_app');

    // Two existing doctors — `doctors` has no RLS, so this reads normally.
    // user_id comes along because app.current_user_id is cast to ::uuid by
    // some policies, so a session needs a real one, not a placeholder.
    const docs = await client.query(
      'SELECT doctor_id, user_id FROM doctors WHERE user_id IS NOT NULL ORDER BY doctor_id LIMIT 2'
    );
    expect(docs.rows.length).toBe(2);
    fx.doctorA = docs.rows[0].doctor_id;
    fx.doctorB = docs.rows[1].doctor_id;
    fx.doctorAUser = docs.rows[0].user_id;
    fx.doctorBUser = docs.rows[1].user_id;

    const admin = { userId: '00000000-0000-0000-0000-000000000001', role: 'admin' };
    const tag = uniq();

    // users has no RLS.
    const users = await client.query(
      `INSERT INTO users (username, password_hash, role) VALUES
         ($1, 'x', 'patient'), ($2, 'x', 'patient')
       RETURNING user_id`,
      ['rlstest.a.' + tag, 'rlstest.b.' + tag]
    );
    fx.userA = users.rows[0].user_id;
    fx.userB = users.rows[1].user_id;

    // patients: admin_insert_patients requires role = 'admin'.
    const patients = await asSession(
      admin,
      `INSERT INTO patients (user_id, full_name, date_of_birth, gender, assigned_doctor_id, national_id)
       VALUES ($1, 'RLS Test Patient A', '1990-01-01', 'male',   $3, $5),
              ($2, 'RLS Test Patient B', '1991-02-02', 'female', $4, $6)
       RETURNING patient_id, user_id`,
      [fx.userA, fx.userB, fx.doctorA, fx.doctorB, 'RLSA' + tag, 'RLSB' + tag]
    );
    fx.patientA = patients.rows.find((r) => r.user_id === fx.userA).patient_id;
    fx.patientB = patients.rows.find((r) => r.user_id === fx.userB).patient_id;

    // medical_records: each doctor may only insert rows carrying their own id.
    const recA = await asSession(
      { userId: fx.doctorAUser, role: 'doctor', doctorId: fx.doctorA },
      `INSERT INTO medical_records (patient_id, doctor_id, diagnosis)
       VALUES ($1, $2, 'Patient A private diagnosis') RETURNING record_id`,
      [fx.patientA, fx.doctorA]
    );
    fx.recordA = recA.rows[0].record_id;

    const recB = await asSession(
      { userId: fx.doctorBUser, role: 'doctor', doctorId: fx.doctorB },
      `INSERT INTO medical_records (patient_id, doctor_id, diagnosis)
       VALUES ($1, $2, 'Patient B private diagnosis') RETURNING record_id`,
      [fx.patientB, fx.doctorB]
    );
    fx.recordB = recB.rows[0].record_id;

    // sick_leaves: the table that shipped with no RLS at all.
    const leaves = await asSession(
      admin,
      `INSERT INTO sick_leaves (patient_id, doctor_id, reference_no, start_date, days_count, diagnosis)
       VALUES ($1, $3, $5, '2026-01-10', 3, 'Patient A sick leave'),
              ($2, $4, $6, '2026-01-12', 5, 'Patient B sick leave')
       RETURNING leave_id, patient_id`,
      [fx.patientA, fx.patientB, fx.doctorA, fx.doctorB, 'SL-A-' + tag, 'SL-B-' + tag]
    );
    fx.leaveA = leaves.rows.find((r) => r.patient_id === fx.patientA).leave_id;
    fx.leaveB = leaves.rows.find((r) => r.patient_id === fx.patientB).leave_id;

    // appointments + patient_invoices: RLS added 2026-09-15. Both were
    // app-layer-only before that.
    fx.slotA = '2026-11-03T09:00:00.000Z';
    fx.slotB = '2026-11-03T11:00:00.000Z';
    const appts = await asSession(
      admin,
      `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, type, duration_minutes)
       VALUES ($1, $3, $5, 'scheduled', 'consultation', 30),
              ($2, $4, $6, 'scheduled', 'consultation', 30)
       RETURNING appointment_id, patient_id`,
      [fx.patientA, fx.patientB, fx.doctorA, fx.doctorB, fx.slotA, fx.slotB]
    );
    fx.apptA = appts.rows.find((r) => r.patient_id === fx.patientA).appointment_id;
    fx.apptB = appts.rows.find((r) => r.patient_id === fx.patientB).appointment_id;

    const invoices = await asSession(
      admin,
      `INSERT INTO patient_invoices (patient_id, uploaded_by, file_path, original_filename, category)
       VALUES ($1, $3, '/tmp/a.pdf', 'patient-a-invoice.pdf', 'invoice'),
              ($2, $3, '/tmp/b.pdf', 'patient-b-invoice.pdf', 'invoice')
       RETURNING invoice_id, patient_id`,
      [fx.patientA, fx.patientB, fx.doctorAUser]
    );
    fx.invoiceA = invoices.rows.find((r) => r.patient_id === fx.patientA).invoice_id;
    fx.invoiceB = invoices.rows.find((r) => r.patient_id === fx.patientB).invoice_id;

    await client.query('SAVEPOINT seeded');
  }, 30000);

  afterEach(async () => {
    // Undo anything a test did, including its session variables, so tests
    // cannot leak state into each other.
    if (client) await client.query('ROLLBACK TO SAVEPOINT seeded');
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    if (pool) await pool.end();
  });

  // app.current_user_id is cast to ::uuid by several policies, so even a
  // session that never matches a real row needs a well-formed UUID.
  const ADMIN = { userId: '00000000-0000-0000-0000-000000000001', role: 'admin' };

  const patientSession = (which) => ({
    userId: which === 'A' ? fx.userA : fx.userB,
    role: 'patient',
    patientId: which === 'A' ? fx.patientA : fx.patientB,
  });

  describe('RLS is switched on at all', () => {
    // The Sprint 5 CRITICAL was not a bad policy — it was a table that
    // shipped with no RLS whatsoever. This catches that class of regression
    // directly, before any row-level assertion gets a chance to pass
    // vacuously against a table nobody protected.
    const PROTECTED = [
      'patients', 'medical_records', 'lab_results', 'sick_leaves',
      'visits', 'visit_invoices', 'invoice_items', 'invoice_payments',
      'patient_care_team', 'appointments', 'patient_invoices',
    ];

    it.each(PROTECTED)('%s has row level security enabled and forced', async (table) => {
      const res = await client.query(
        'SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1',
        [table]
      );
      expect(res.rows[0].relrowsecurity).toBe(true);
      expect(res.rows[0].relforcerowsecurity).toBe(true);
    });

    it('sick_leaves carries a patient-scoped SELECT policy', async () => {
      const res = await client.query(
        `SELECT polname FROM pg_policy WHERE polrelid = 'sick_leaves'::regclass`
      );
      expect(res.rows.map((r) => r.polname)).toContain('patient_own_sick_leaves');
    });
  });

  describe('sick_leaves — the Sprint 5 CRITICAL IDOR', () => {
    it('shows patient A only their own sick leave', async () => {
      const res = await asSession(patientSession('A'), 'SELECT leave_id, diagnosis FROM sick_leaves');
      const ids = res.rows.map((r) => r.leave_id);
      expect(ids).toContain(fx.leaveA);
      expect(ids).not.toContain(fx.leaveB);
    });

    it('returns nothing when patient A asks for patient B’s sick leave by id', async () => {
      // The exact exploit: the id is known, and it still yields no row.
      const res = await asSession(
        patientSession('A'),
        'SELECT leave_id, diagnosis FROM sick_leaves WHERE leave_id = $1',
        [fx.leaveB]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('holds in the other direction too — B cannot read A', async () => {
      const res = await asSession(
        patientSession('B'),
        'SELECT leave_id FROM sick_leaves WHERE leave_id = $1',
        [fx.leaveA]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('never leaks patient B’s diagnosis text to patient A by any predicate', async () => {
      const res = await asSession(
        patientSession('A'),
        "SELECT diagnosis FROM sick_leaves WHERE diagnosis LIKE '%Patient B%'"
      );
      expect(res.rows).toHaveLength(0);
    });

    it('is not passing vacuously — an admin session sees both rows', async () => {
      // Guards every "expect 0 rows" above. If the seed had silently failed,
      // or RLS were hiding these rows from everyone, those assertions would
      // pass while proving nothing. Both rows exist and are readable here,
      // so the patient-scoped empty results are genuine filtering.
      const res = await asSession(ADMIN, 'SELECT leave_id FROM sick_leaves WHERE leave_id = ANY($1)', [
        [fx.leaveA, fx.leaveB],
      ]);
      expect(res.rows.map((r) => r.leave_id).sort()).toEqual([fx.leaveA, fx.leaveB].sort());
    });

    it('lets patient B read their own sick leave', async () => {
      const res = await asSession(
        patientSession('B'),
        'SELECT leave_id FROM sick_leaves WHERE leave_id = $1',
        [fx.leaveB]
      );
      expect(res.rows.map((r) => r.leave_id)).toEqual([fx.leaveB]);
    });

    it('confines a doctor to sick leaves for their own patients', async () => {
      const res = await asSession(
        { userId: fx.doctorAUser, role: 'doctor', doctorId: fx.doctorA },
        'SELECT leave_id FROM sick_leaves WHERE leave_id = ANY($1)',
        [[fx.leaveA, fx.leaveB]]
      );
      expect(res.rows.map((r) => r.leave_id)).toEqual([fx.leaveA]);
    });
  });

  describe('medical_records', () => {
    it('shows patient A only their own records', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT record_id FROM medical_records WHERE record_id = ANY($1)',
        [[fx.recordA, fx.recordB]]
      );
      expect(res.rows.map((r) => r.record_id)).toEqual([fx.recordA]);
    });

    it('is not passing vacuously — patient B can read their own record', async () => {
      const res = await asSession(
        patientSession('B'),
        'SELECT record_id FROM medical_records WHERE record_id = $1',
        [fx.recordB]
      );
      expect(res.rows.map((r) => r.record_id)).toEqual([fx.recordB]);
    });

    it('returns nothing when patient A asks for patient B’s record by id', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT diagnosis FROM medical_records WHERE record_id = $1',
        [fx.recordB]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('separates one doctor from another', async () => {
      const res = await asSession(
        { userId: fx.doctorAUser, role: 'doctor', doctorId: fx.doctorA },
        'SELECT record_id FROM medical_records WHERE record_id = ANY($1)',
        [[fx.recordA, fx.recordB]]
      );
      expect(res.rows.map((r) => r.record_id)).toEqual([fx.recordA]);
    });

    it('blocks admin from clinical content entirely (RESTRICTIVE policy)', async () => {
      const res = await asSession(
        ADMIN,
        'SELECT record_id FROM medical_records WHERE record_id = ANY($1)',
        [[fx.recordA, fx.recordB]]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('refuses an admin write to clinical content', async () => {
      await expect(
        asSession(
          ADMIN,
          `INSERT INTO medical_records (patient_id, doctor_id, diagnosis)
           VALUES ($1, $2, 'admin should not be able to write this')`,
          [fx.patientA, fx.doctorA]
        )
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe('patients', () => {
    it('shows patient A only their own demographic row', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT patient_id FROM patients WHERE patient_id = ANY($1)',
        [[fx.patientA, fx.patientB]]
      );
      expect(res.rows.map((r) => r.patient_id)).toEqual([fx.patientA]);
    });

    it('shows a doctor only the patients assigned to them', async () => {
      const res = await asSession(
        { userId: fx.doctorAUser, role: 'doctor', doctorId: fx.doctorA },
        'SELECT patient_id FROM patients WHERE patient_id = ANY($1)',
        [[fx.patientA, fx.patientB]]
      );
      expect(res.rows.map((r) => r.patient_id)).toEqual([fx.patientA]);
    });

    it('lets admin see both, since registration needs the full directory', async () => {
      const res = await asSession(
        ADMIN,
        'SELECT patient_id FROM patients WHERE patient_id = ANY($1)',
        [[fx.patientA, fx.patientB]]
      );
      expect(res.rows).toHaveLength(2);
    });
  });

  describe('appointments (RLS added 2026-09-15)', () => {
    it('is not passing vacuously — an admin session sees both appointments', async () => {
      const res = await asSession(
        ADMIN,
        'SELECT appointment_id FROM appointments WHERE appointment_id = ANY($1)',
        [[fx.apptA, fx.apptB]]
      );
      expect(res.rows).toHaveLength(2);
    });

    it('shows patient A only their own appointment', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT appointment_id FROM appointments WHERE appointment_id = ANY($1)',
        [[fx.apptA, fx.apptB]]
      );
      expect(res.rows.map((r) => r.appointment_id)).toEqual([fx.apptA]);
    });

    it('returns nothing when patient A asks for patient B’s appointment by id', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT appointment_id FROM appointments WHERE appointment_id = $1',
        [fx.apptB]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('shows a doctor only their own clinic list', async () => {
      const res = await asSession(
        { userId: fx.doctorAUser, role: 'doctor', doctorId: fx.doctorA },
        'SELECT appointment_id FROM appointments WHERE appointment_id = ANY($1)',
        [[fx.apptA, fx.apptB]]
      );
      expect(res.rows.map((r) => r.appointment_id)).toEqual([fx.apptA]);
    });

    it('refuses to let a patient book an appointment in someone else’s name', async () => {
      // The WITH CHECK half of patient_insert_appointments: even a tampered
      // request body cannot write a row pinned to another patient_id.
      await expect(
        asSession(
          patientSession('A'),
          `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, type, duration_minutes)
           VALUES ($1, $2, '2026-11-04T09:00:00.000Z', 'scheduled', 'consultation', 30)`,
          [fx.patientB, fx.doctorB]
        )
      ).rejects.toThrow(/row-level security/i);
    });

    it('lets a patient book in their own name', async () => {
      const res = await asSession(
        patientSession('A'),
        `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, type, duration_minutes)
         VALUES ($1, $2, '2026-11-05T09:00:00.000Z', 'scheduled', 'consultation', 30)
         RETURNING appointment_id`,
        [fx.patientA, fx.doctorA]
      );
      expect(res.rows).toHaveLength(1);
    });

    it('refuses to let a patient reassign their appointment to another patient', async () => {
      await expect(
        asSession(
          patientSession('A'),
          'UPDATE appointments SET patient_id = $2 WHERE appointment_id = $1',
          [fx.apptA, fx.patientB]
        )
      ).rejects.toThrow(/row-level security/i);
    });

    it('silently affects no rows when a patient tries to cancel someone else’s appointment', async () => {
      // USING filters the row out entirely, so this is a no-op rather than
      // an error — the important part is that B's appointment is untouched.
      const res = await asSession(
        patientSession('A'),
        "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1",
        [fx.apptB]
      );
      expect(res.rowCount).toBe(0);
    });
  });

  describe('double-booking protection survives RLS', () => {
    // The trap this design had to avoid: appointments became RLS-protected,
    // but self-booking's conflict check runs inside the PATIENT's session.
    // A direct query would see an empty table, find no clash, and let two
    // patients book the same doctor at the same moment — RLS turning a
    // security fix into a correctness bug. The SECURITY DEFINER helpers are
    // what keep that from happening.

    it('a patient cannot see another patient’s appointment row directly', async () => {
      // Establishes the premise for the two assertions below.
      const res = await asSession(
        patientSession('A'),
        'SELECT appointment_id FROM appointments WHERE doctor_id = $1 AND scheduled_at = $2',
        [fx.doctorB, fx.slotB]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('but appointment_conflict_id() still detects that doctor B’s slot is taken', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT appointment_conflict_id($1, $2) AS id',
        [fx.doctorB, fx.slotB]
      );
      expect(res.rows[0].id).toBe(fx.apptB);
    });

    it('and doctor_slot_taken() still reports the overlap', async () => {
      const res = await asSession(patientSession('A'), 'SELECT doctor_slot_taken($1, $2, $3) AS taken', [
        fx.doctorB,
        fx.slotB,
        30,
      ]);
      expect(res.rows[0].taken).toBe(true);
    });

    it('reports a genuinely free slot as free', async () => {
      const res = await asSession(patientSession('A'), 'SELECT doctor_slot_taken($1, $2, $3) AS taken', [
        fx.doctorB,
        '2027-01-01T09:00:00.000Z',
        30,
      ]);
      expect(res.rows[0].taken).toBe(false);
    });

    it('discloses only that the slot is taken, never whose it is', async () => {
      // The helper returns an appointment id and a boolean. It must not
      // become a side channel onto another patient's identity.
      const res = await asSession(
        patientSession('A'),
        'SELECT appointment_conflict_id($1, $2) AS id',
        [fx.doctorB, fx.slotB]
      );
      expect(Object.keys(res.rows[0])).toEqual(['id']);

      // And knowing that id still buys nothing.
      const followUp = await asSession(
        patientSession('A'),
        'SELECT patient_id FROM appointments WHERE appointment_id = $1',
        [res.rows[0].id]
      );
      expect(followUp.rows).toHaveLength(0);
    });
  });

  describe('the real booking modules, not just the SQL', () => {
    // Everything above drives SQL directly. These drive the actual
    // production modules the self-booking controller calls, against the same
    // live policies, so a refactor that reverts either module back to a
    // direct table read fails here rather than in production.
    const Appointment = require('../models/Appointment');
    const { isSlotAvailable } = require('../utils/availability');

    it('Appointment.findConflict finds doctor B’s clash from patient A’s session', async () => {
      await asSession(patientSession('A'), 'SELECT 1');
      const conflict = await Appointment.findConflict(client, fx.doctorB, fx.slotB);
      expect(conflict).not.toBeNull();
      expect(conflict.appointment_id).toBe(fx.apptB);
    });

    it('Appointment.findConflict returns null for a free slot', async () => {
      await asSession(patientSession('A'), 'SELECT 1');
      const conflict = await Appointment.findConflict(client, fx.doctorB, '2027-01-01T09:00:00.000Z');
      expect(conflict).toBeNull();
    });

    it('Appointment.findConflict honours the exclude argument on reschedule', async () => {
      await asSession(patientSession('B'), 'SELECT 1');
      const conflict = await Appointment.findConflict(client, fx.doctorB, fx.slotB, fx.apptB);
      expect(conflict).toBeNull();
    });

    it('isSlotAvailable reports doctor B’s taken slot as unavailable to patient A', async () => {
      // Needs working hours to exist, otherwise the function short-circuits
      // on the availability check before it ever reaches the overlap query.
      await asSession(ADMIN, 'SELECT 1');
      await client.query(
        `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1, EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE 'Asia/Riyadh'))::smallint,
                 '00:00', '23:59', true)
         ON CONFLICT (doctor_id, day_of_week)
         DO UPDATE SET start_time = '00:00', end_time = '23:59', is_active = true`,
        [fx.doctorB, fx.slotB]
      );

      await asSession(patientSession('A'), 'SELECT 1');
      await expect(isSlotAvailable(client, fx.doctorB, fx.slotB, 30)).resolves.toBe(false);
    });

    it('isSlotAvailable reports a free slot inside working hours as available', async () => {
      const freeSlot = '2026-11-03T15:00:00.000Z';
      await asSession(ADMIN, 'SELECT 1');
      await client.query(
        `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_active)
         VALUES ($1, EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE 'Asia/Riyadh'))::smallint,
                 '00:00', '23:59', true)
         ON CONFLICT (doctor_id, day_of_week)
         DO UPDATE SET start_time = '00:00', end_time = '23:59', is_active = true`,
        [fx.doctorB, freeSlot]
      );

      await asSession(patientSession('A'), 'SELECT 1');
      await expect(isSlotAvailable(client, fx.doctorB, freeSlot, 30)).resolves.toBe(true);
    });
  });

  describe('patient_invoices (RLS added 2026-09-15)', () => {
    it('is not passing vacuously — an admin session sees both invoices', async () => {
      const res = await asSession(ADMIN, 'SELECT invoice_id FROM patient_invoices WHERE invoice_id = ANY($1)', [
        [fx.invoiceA, fx.invoiceB],
      ]);
      expect(res.rows).toHaveLength(2);
    });

    it('shows patient A only their own billing documents', async () => {
      const res = await asSession(
        patientSession('A'),
        'SELECT invoice_id FROM patient_invoices WHERE invoice_id = ANY($1)',
        [[fx.invoiceA, fx.invoiceB]]
      );
      expect(res.rows.map((r) => r.invoice_id)).toEqual([fx.invoiceA]);
    });

    it('returns nothing when patient A asks for patient B’s invoice by id', async () => {
      // Backs up invoicesController.downloadInvoice's hand-written check,
      // which used to be the only thing guarding this.
      const res = await asSession(
        patientSession('A'),
        'SELECT file_path FROM patient_invoices WHERE invoice_id = $1',
        [fx.invoiceB]
      );
      expect(res.rows).toHaveLength(0);
    });

    it('keeps clinic-wide read for doctors, matching existing behaviour', async () => {
      const res = await asSession(
        { userId: fx.doctorAUser, role: 'doctor', doctorId: fx.doctorA },
        'SELECT invoice_id FROM patient_invoices WHERE invoice_id = ANY($1)',
        [[fx.invoiceA, fx.invoiceB]]
      );
      expect(res.rows).toHaveLength(2);
    });

    it('refuses a patient write — the table is upload-only for reception', async () => {
      await expect(
        asSession(
          patientSession('A'),
          `INSERT INTO patient_invoices (patient_id, uploaded_by, file_path, original_filename)
           VALUES ($1, $2, '/tmp/forged.pdf', 'forged.pdf')`,
          [fx.patientA, fx.doctorAUser]
        )
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe('the empty-string-to-::uuid guard', () => {
    // An admin session carries doctorId = '' and patientId = ''. Every
    // policy that casts those GUCs must NULLIF them first or the query dies
    // with 22P02 invalid_text_representation. See
    // docs/psm2/rls-policy-guidelines.md — this already broke local dev once.
    const RLS_TABLES = [
      'patients', 'medical_records', 'lab_results', 'sick_leaves',
      'visits', 'visit_invoices', 'invoice_items', 'invoice_payments',
      'patient_care_team', 'appointments', 'patient_invoices',
    ];

    it.each(RLS_TABLES)('an admin session can query %s without a uuid cast error', async (table) => {
      await expect(
        asSession(ADMIN, 'SELECT count(*) FROM ' + table)
      ).resolves.toBeDefined();
    });

    it.each(RLS_TABLES)('a session with no variables set can query %s without erroring', async (table) => {
      // The hardest case: every GUC is '' at once.
      await expect(asSession({}, 'SELECT count(*) FROM ' + table)).resolves.toBeDefined();
    });

    it('returns zero rows rather than erroring when the session is empty', async () => {
      // Fail closed, not open: no session means no data, not all data.
      const res = await asSession({}, 'SELECT count(*)::int AS n FROM sick_leaves');
      expect(res.rows[0].n).toBe(0);
    });
  });

  describe('session variables are transaction-scoped', () => {
    it('does not leak a patient session onto the next transaction on the same connection', async () => {
      // set_config(..., true) is SET LOCAL semantics. If it were session
      // scoped, a pooled connection would carry one patient's identity into
      // the next request — a cross-tenant read by construction.
      await asSession(patientSession('A'), 'SELECT 1');
      const before = await client.query(
        "SELECT current_setting('app.current_patient_id', true) AS v"
      );
      expect(before.rows[0].v).toBe(fx.patientA);

      await client.query('ROLLBACK TO SAVEPOINT seeded');

      const after = await client.query(
        "SELECT current_setting('app.current_patient_id', true) AS v"
      );
      expect(after.rows[0].v === '' || after.rows[0].v === null).toBe(true);
    });
  });
});
