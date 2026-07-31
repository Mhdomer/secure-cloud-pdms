-- PDMS Local Development Schema
-- Run once: psql -U postgres -d pdms -f schema.sql
-- Production schema is managed via Terraform/migrations
--
-- IMPORTANT — Row-Level Security only works if the application connects
-- with a role that is NOT the table owner and does NOT have BYPASSRLS.
-- The `postgres`/master RDS user used to run this script is a superuser
-- and always bypasses RLS. Create a dedicated least-privilege role for the
-- Express app (see "APPLICATION ROLE" section right below, before the tables)
-- and configure DB_USER in .env / SSM to that role, never the master user.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── APPLICATION ROLE — least-privilege connection role for the Express app ──
-- Created here, before any table/GRANT statement below, deliberately: this
-- file GRANTs to pdms_app as each table is created (e.g. "GRANT ... ON
-- departments TO pdms_app" right after CREATE TABLE departments), so the
-- role must already exist by the time execution reaches the first of those
-- — it cannot be created lazily near the end of the file the way an
-- otherwise-unrelated bootstrap step could be. Running this file straight
-- through with psql's per-statement error-continue behavior never surfaced
-- this: each individual GRANT failure was silently skipped, table creation
-- and the later app-role creation still succeeded, and nobody noticed the
-- role was actually missing every grant issued before it existed — until
-- this file was run as a single batched multi-statement query (Node's
-- `pg` driver, one implicit transaction, first error aborts and rolls back
-- everything), which fails hard immediately instead of limping through.
--
-- The Express app must NEVER connect as the master/superuser: superusers
-- and table owners bypass RLS entirely regardless of the policies defined
-- throughout this file, which silently defeats the whole two-layer
-- authorization model.
--
-- Local dev: run this file as the postgres superuser (as the header
-- comment instructs), then point DB_USER/DB_PASSWORD in .env at pdms_app
-- instead of postgres, so RLS is actually exercised during local testing.
--
-- Production: the RDS master user is never used by the running app either
-- — Terraform/SSM provisions this same role with a generated secret, so
-- this block never runs against a production database.
--
-- No literal password is written here (a fixed string in this file would be
-- permanent in git history the moment it's committed, and a known password
-- for a role that bypasses every RLS policy is a standing risk regardless).
-- On a fresh database, this generates a random password and prints it once
-- via RAISE NOTICE — copy it into DB_PASSWORD in your local .env. Re-running
-- this file against a database that already has the role is a no-op, same
-- as before; it does not rotate an existing role's password.
DO $$
DECLARE
  generated_password TEXT;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pdms_app') THEN
    generated_password := encode(gen_random_bytes(24), 'base64');
    EXECUTE format('CREATE ROLE pdms_app LOGIN PASSWORD %L', generated_password);
    RAISE NOTICE 'Created pdms_app with a generated password: %', generated_password;
    RAISE NOTICE 'Copy it into DB_USER=pdms_app / DB_PASSWORD=<above> in src/backend/.env — it is not stored anywhere else.';
  END IF;
END
$$;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(50)  UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(12)  NOT NULL CHECK (role IN ('superadmin','doctor','admin','patient')),
  is_active       BOOLEAN      DEFAULT true,
  failed_attempts INT          DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ── departments ────────────────────────────────────────────────────────────
-- Clinic/department taxonomy. A doctor belongs to exactly one department
-- (doctors.specialisation below); a department can have many doctors — the
-- same taxonomy also classifies billing items (clinic_services.category).
-- Rows are only ever deactivated, never deleted, so historical doctors,
-- services, and visits that reference a key never go stale. `key` is
-- generated once at creation (see departmentsController.slugify) and is
-- immutable after that — it's the value stored in every referencing row, so
-- renaming a department only ever touches name_en/name_ar, never key.
CREATE TABLE IF NOT EXISTS departments (
  department_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(50)  UNIQUE NOT NULL,
  name_en       VARCHAR(100) NOT NULL,
  name_ar       VARCHAR(100) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed the departments that previously lived only as a hardcoded frontend
-- array (SERVICE_CATEGORIES) — existing doctors/services already carry these
-- exact key values, so the FK constraints added below attach immediately
-- without needing a data backfill.
INSERT INTO departments (key, name_en, name_ar) VALUES
  ('laboratory',  'Laboratory',       'المختبر'),
  ('dental',      'Dental',           'الأسنان'),
  ('dermatology', 'Dermatology',      'الجلدية'),
  ('general',     'General Medicine', 'الطب العام'),
  ('pediatrics',  'Pediatrics',       'طب الأطفال'),
  ('gynecology',  'Gynecology',       'النساء والولادة'),
  ('other',       'Other',            'أخرى')
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON departments TO pdms_app;

-- ── doctors ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
  full_name      VARCHAR(100) NOT NULL,
  specialisation VARCHAR(100),
  license_number VARCHAR(50),   -- SCFHS license (ترخيص مزاولة المهنة)
  phone          VARCHAR(20),
  is_active      BOOLEAN DEFAULT true
);

-- A doctor's specialisation must be a real, known department — enforced here
-- (not just by the frontend dropdown) so a stray value can never desync the
-- billing/report grouping from the doctor directory. `DROP ... IF EXISTS`
-- first makes this ALTER safe to re-run against a DB that already had
-- `doctors` before this change, same idiom as the appointments status
-- CHECK constraint above.
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_specialisation_fkey;
ALTER TABLE doctors ADD CONSTRAINT doctors_specialisation_fkey
  FOREIGN KEY (specialisation) REFERENCES departments(key);

-- ── patients ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  patient_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(user_id) ON DELETE SET NULL,
  full_name          VARCHAR(100) NOT NULL,
  date_of_birth      DATE         NOT NULL,
  gender             VARCHAR(10)  CHECK (gender IN ('male','female')),
  contact_number     VARCHAR(20),
  assigned_doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  id_type            VARCHAR(15) DEFAULT 'national_id'
                       CHECK (id_type IN ('national_id','iqama','passport')),
  national_id        VARCHAR(20) UNIQUE,
  blood_type         VARCHAR(5)
                       CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies          TEXT,        -- free-text for now; upgrade to JSONB/table later
  nationality        VARCHAR(50),
  address            TEXT,
  emergency_contact_name  VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  insurance_provider      VARCHAR(100),
  insurance_number        VARCHAR(50),
  email                   VARCHAR(255),
  preferred_language      VARCHAR(2) DEFAULT 'en' CHECK (preferred_language IN ('en','ar'))
);

-- ── medical_records ────────────────────────────────────────────────────────
-- diagnosis/prescription/notes are the original flat fields, kept intact.
-- chief_complaint/objective/assessment/plan/vital_signs/visit_type add the
-- SOAP structure alongside them — assessment is the full narrative that
-- replaces free-text diagnosis going forward; diagnosis stays as the short
-- summary line shown in the patient profile timeline.
CREATE TABLE IF NOT EXISTS medical_records (
  record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id    UUID REFERENCES doctors(doctor_id)   ON DELETE SET NULL,
  diagnosis    TEXT        NOT NULL,
  prescription TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  chief_complaint TEXT,
  objective       TEXT,   -- objective findings / examination
  assessment      TEXT,   -- assessment / diagnosis narrative
  plan            TEXT,   -- treatment plan
  vital_signs     JSONB,  -- { bp: "120/80", temp: "37.1", weight: "75kg", height: "175cm" }
  prescriptions_data JSONB, -- SFDA structured e-prescription array [{ drug_code, name, strength, dosage, frequency, duration, instructions }]
  visit_type      VARCHAR(20) DEFAULT 'consultation'
                    CHECK (visit_type IN ('consultation','follow_up','emergency','checkup'))
);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS prescriptions_data JSONB;

-- ── appointments ───────────────────────────────────────────────────────────
-- No RLS on this table (Chapter 4 Section 4.4.3 scopes RLS to medical_records
-- and patients only). Access boundaries are enforced entirely at the
-- application layer — see src/middleware/rbacMiddleware.js and the
-- ownership checks in appointmentsController.js.
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id      UUID REFERENCES doctors(doctor_id)   ON DELETE SET NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','confirmed','arrived','completed','cancelled')),
  type           VARCHAR(20) DEFAULT 'consultation'
                   CHECK (type IN ('consultation','follow_up','emergency','checkup')),
  notes          TEXT,
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes  INT DEFAULT 30,
  cancelled_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  cancellation_note TEXT,
  updated_at        TIMESTAMPTZ
);

-- Quick Check-In (Feature E, Sprint 3c feature audit): staff marks a patient
-- as physically present ("arrived") between confirmation and the doctor
-- actually seeing them. This is the lightweight, no-infrastructure stand-in
-- for a real-time queue dispatch (Feature G) — the doctor dashboard polls
-- the same GET /appointments it already calls and highlights 'arrived' rows,
-- no WebSockets needed. Re-declaring the full constraint (not just adding
-- 'arrived') because Postgres has no ADD-VALUE-TO-CHECK shorthand — this
-- DROP+ADD pair is idempotent and safe to re-run, matching the pattern
-- schema-additions.sql already used to introduce 'confirmed'.
-- Deliberately NOT adding 'pending'/'no_show' here — neither exists anywhere
-- else in this codebase (APPOINTMENT_STATUS in constants.js, or any
-- controller); 'scheduled' is this app's actual initial status.
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled','confirmed','arrived','completed','cancelled'));
-- The `updated_at` column above only takes effect on a fresh install —
-- `CREATE TABLE IF NOT EXISTS` is a no-op against an already-existing
-- table, so this explicit ALTER is what actually adds it to any DB that
-- already had `appointments` before this change.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ── doctor_availability ───────────────────────────────────────────────────
-- Weekly working-hours schedule. Without this table the system can book
-- appointments at 3am on a Sunday. Saudi work week: Sun–Thu (day_of_week 0–4).
CREATE TABLE IF NOT EXISTS doctor_availability (
  availability_id UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID    REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                                   -- 0=Sunday, 1=Monday … 6=Saturday
  start_time      TIME    NOT NULL,
  end_time        TIME    NOT NULL,
  slot_minutes    INT     DEFAULT 30,  -- appointment slot length for this doctor on this day
  is_active       BOOLEAN DEFAULT true,
  UNIQUE (doctor_id, day_of_week)
);

-- ── otp_verifications ───────────────────────────────────────────────────────
-- Backs UC-19 patient self-registration (docs/psm2/self-registration-design.md).
-- No RLS — this is pre-authentication data with no user_id to key policies on.
-- id_type/date_of_birth are captured here at request-otp time so step 3
-- (complete registration) never has to re-trust those fields from the client.
CREATE TABLE IF NOT EXISTS otp_verifications (
  otp_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(20) NOT NULL,
  national_id   VARCHAR(20) NOT NULL,
  id_type       VARCHAR(15) NOT NULL DEFAULT 'national_id'
                  CHECK (id_type IN ('national_id','iqama','passport')),
  date_of_birth DATE NOT NULL,
  otp_hash      VARCHAR(255) NOT NULL,
  purpose       VARCHAR(20) NOT NULL DEFAULT 'registration'
                  CHECK (purpose IN ('registration')),
  attempts      INT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone_number);

-- Password reset (forgot-password flow, phone OTP) — reuses the UC-19 OTP
-- infrastructure. purpose widened to cover this second use; user_id links a
-- password_reset row to the existing account it's resetting (NULL for
-- registration rows, since no account exists yet at that point). ON DELETE
-- SET NULL (not the column's default NO ACTION) since this is ephemeral,
-- short-lived tracking data — a deleted user should never be blocked by a
-- dangling reference from an old OTP row.
ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check
  CHECK (purpose IN ('registration', 'password_reset'));
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- ── patient_invoices ─────────────────────────────────────────────────────────
-- Billing documents uploaded by staff. No RLS — access is role-gated only
-- (admin/superadmin upload; admin/superadmin/doctor view any patient's;
-- patient views only their own, enforced in the app layer via the session's
-- own patient_id rather than a client-supplied :patientId — see
-- invoicesController.getMyInvoices), not scoped per-doctor like lab_results.
CREATE TABLE IF NOT EXISTS patient_invoices (
  invoice_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  uploaded_by       UUID NOT NULL REFERENCES users(user_id),
  file_path         TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size         INTEGER,
  mime_type         VARCHAR(100),
  amount            DECIMAL(10,2),
  description       TEXT,
  invoice_date      DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Digital Consent Forms (Feature I, Sprint 3c feature audit): a consent form
-- is just a scanned PDF/image per patient, same shape as a billing invoice —
-- reuses this table with a category column rather than a parallel table.
-- 'other' exists for future document types without another migration.
ALTER TABLE patient_invoices ADD COLUMN IF NOT EXISTS
  category VARCHAR(50) NOT NULL DEFAULT 'invoice'
  CHECK (category IN ('invoice','consent','other'));

CREATE INDEX IF NOT EXISTS idx_patient_invoices_category ON patient_invoices(category);

-- Scale-proofing indexes for dashboard queries and patient vitals lookups
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_latest ON medical_records (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_doctors_is_active ON doctors (is_active);

-- ── lab_results ──────────────────────────────────────────────────────────────
-- Lab result files uploaded by doctors. RLS-protected (see the RLS section
-- below) — only the patient's assigned doctor may see or upload results.
CREATE TABLE IF NOT EXISTS lab_results (
  result_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  uploaded_by       UUID NOT NULL REFERENCES users(user_id),
  file_path         TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size         INTEGER,
  mime_type         VARCHAR(100),
  test_name         VARCHAR(255),
  result_date       DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctor-controlled patient visibility: a result is invisible to the patient
-- until their doctor explicitly releases it (NULL released_at = not yet
-- released) — results shouldn't surface before a doctor has had a chance to
-- explain them, and this also lets a doctor hold back an abnormal result
-- pending a follow-up call rather than the patient finding out cold.
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES users(user_id);

CREATE INDEX IF NOT EXISTS idx_patient_invoices_patient ON patient_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient      ON lab_results(patient_id);

-- ── password_setup_tokens ────────────────────────────────────────────────────
-- Backs the QR-based first-password flow: staff registers a patient with no
-- password disclosed to them, the patient scans a QR / opens a link carrying
-- this token, and sets their own password. No RLS — like otp_verifications,
-- this exists precisely to bootstrap a session before one exists, so there's
-- no authenticated app.current_* context to key a policy on; single-use
-- (used_at) and a 256-bit token are what protect it instead.
CREATE TABLE IF NOT EXISTS password_setup_tokens (
  token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token       VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pst_token ON password_setup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pst_user  ON password_setup_tokens(user_id);

-- Distinguishes the QR-based first-password flow from a forgot-password
-- reset issued through the same table — setPassword (passwordSetupController.js)
-- uses this to decide whether to log PASSWORD_RESET_COMPLETED.
ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS
  purpose VARCHAR(20) NOT NULL DEFAULT 'initial_setup'
  CHECK (purpose IN ('initial_setup', 'password_reset'));

-- ── audit_log ──────────────────────────────────────────────────────────────
-- Append-only. No UPDATE/DELETE grants are given to the application role
-- (see APPLICATION ROLE section) so a compromised API cannot tamper with
-- its own audit trail.
CREATE TABLE IF NOT EXISTS audit_log (
  log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  resource   VARCHAR(50),
  record_id  UUID,
  ip_address INET,
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_doctors_user_id            ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_user_id            ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_assigned_doctor_id ON patients(assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_patients_national_id        ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_patients_full_name          ON patients USING gin(to_tsvector('simple', full_name));
CREATE INDEX IF NOT EXISTS idx_patients_contact            ON patients(contact_number);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_id   ON medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id  ON medical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_slot    ON appointments(doctor_id, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id     ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id           ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp         ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_availability_doctor          ON doctor_availability(doctor_id);

-- ── visits (CREATE TABLE only — see the "visits" section further down for
-- its indexes, grant, and later column additions) ───────────────────────
-- Walk-in patient encounters. NOT the same as appointments (which are
-- pre-booked slots for dentistry/dermatology). This is the first-come
-- first-served flow for general medicine, pediatrics, lab, etc. Moved here,
-- ahead of its own full section below, because several RLS policies in the
-- section immediately following this one subquery visits(patient_id,
-- doctor_id) — the table has to exist before those policies are defined,
-- and its FKs (patients, doctors, users) are all already available by this
-- point in the file.
CREATE TABLE IF NOT EXISTS visits (
  visit_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID        NOT NULL REFERENCES patients(patient_id)  ON DELETE RESTRICT,
  doctor_id     UUID        NOT NULL REFERENCES doctors(doctor_id)    ON DELETE RESTRICT,
  queue_no      INTEGER     NOT NULL,
  clinic        VARCHAR(50),
  status        VARCHAR(20) NOT NULL DEFAULT 'waiting'
                  CHECK (status IN ('waiting','in_progress','completed','billed')),
  notes         TEXT,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  created_by    UUID        REFERENCES users(user_id) ON DELETE SET NULL
);

-- ── Row-Level Security ───────────────────────────────────────────────────
-- Session variables set per request by src/config/database.js#withTransaction:
--   app.current_user_id    -- users.user_id from the verified JWT (always set)
--   app.current_role       -- 'doctor' | 'admin' | 'patient'          (always set)
--   app.current_doctor_id  -- doctors.doctor_id, resolved server-side  (doctor sessions only)
--   app.current_patient_id -- patients.patient_id, resolved server-side (patient sessions only)
--
-- All four are set with set_config(..., true) inside an explicit
-- transaction (SET LOCAL semantics) so they never leak across pooled
-- connections or requests. Unset variables resolve to '' via the `missing_ok`
-- flag on current_setting(); NULLIF(...,'') converts that to SQL NULL before
-- the ::UUID cast so an unrelated role never trips an "invalid UUID" error.

ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results     ENABLE ROW LEVEL SECURITY;

-- FORCE ensures RLS applies even to a connection role that happens to own
-- these tables — defence in depth against a future role/ownership mistake.
ALTER TABLE medical_records FORCE ROW LEVEL SECURITY;
ALTER TABLE patients        FORCE ROW LEVEL SECURITY;
ALTER TABLE lab_results     FORCE ROW LEVEL SECURITY;

-- Drop legacy/broken policies from the original scaffold (these compared
-- doctor_id/patient_id, which are their own surrogate keys, directly
-- against app.current_user_id, which holds users.user_id — a different
-- UUID space entirely, so the policies could never match).
DROP POLICY IF EXISTS doctor_records      ON medical_records;
DROP POLICY IF EXISTS patient_own_records ON medical_records;
DROP POLICY IF EXISTS admin_no_records    ON medical_records;
DROP POLICY IF EXISTS patient_own_profile ON patients;

-- ── medical_records policies ─────────────────────────────────────────────
-- Doctor: full CRUD, restricted to records they own.
DROP POLICY IF EXISTS doctor_select_records ON medical_records;
CREATE POLICY doctor_select_records ON medical_records
  FOR SELECT
  USING (
    doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    OR patient_id IN (
      SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
      UNION
      SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    )
  );

DROP POLICY IF EXISTS doctor_insert_records ON medical_records;
CREATE POLICY doctor_insert_records ON medical_records
  FOR INSERT
  WITH CHECK (doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID);

DROP POLICY IF EXISTS doctor_update_records ON medical_records;
CREATE POLICY doctor_update_records ON medical_records
  FOR UPDATE
  USING (doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID)
  WITH CHECK (doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID);

-- Patient: read-only access to their own records.
DROP POLICY IF EXISTS patient_select_records ON medical_records;
CREATE POLICY patient_select_records ON medical_records
  FOR SELECT
  USING (patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::UUID);

-- Admin: explicitly denied all access to clinical content. This is a
-- RESTRICTIVE policy (AND-combined with every other policy on the table),
-- not PERMISSIVE — a PERMISSIVE "role <> admin" policy would itself grant
-- blanket access to every non-admin session and defeat the doctor/patient
-- filters above, since permissive policies are OR-combined.
DROP POLICY IF EXISTS admin_blocked_records ON medical_records;
CREATE POLICY admin_blocked_records ON medical_records
  AS RESTRICTIVE
  USING (current_setting('app.current_role', true) <> 'admin')
  WITH CHECK (current_setting('app.current_role', true) <> 'admin');

-- ── patients policies ─────────────────────────────────────────────────────
-- Patient: read their own demographic row, matched on user_id. This is
-- deliberately keyed on user_id (known immediately from the JWT) rather
-- than patient_id, because it IS the query the app uses to resolve
-- patient_id -> app.current_patient_id at the start of a patient session —
-- keying it on patient_id would create a circular dependency.
DROP POLICY IF EXISTS patient_select_own ON patients;
CREATE POLICY patient_select_own ON patients
  FOR SELECT
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);

-- Doctor: read only the patients assigned to them.
DROP POLICY IF EXISTS doctor_select_assigned ON patients;
CREATE POLICY doctor_select_assigned ON patients
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'doctor' AND (
      assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
      OR patient_id IN (
        SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
        UNION
        SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
      )
    )
  );

-- Admin/superadmin: full read access for registration, profile lookups,
-- reassignment, and QR regeneration (regenerateQR needs to resolve
-- patient_id -> user_id under a superadmin session, same as an admin one).
DROP POLICY IF EXISTS admin_select_patients ON patients;
CREATE POLICY admin_select_patients ON patients
  FOR SELECT
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

-- Admin: register new patients.
DROP POLICY IF EXISTS admin_insert_patients ON patients;
CREATE POLICY admin_insert_patients ON patients
  FOR INSERT
  WITH CHECK (current_setting('app.current_role', true) = 'admin');

-- Admin: update demographics / reassign doctor.
DROP POLICY IF EXISTS admin_update_patients ON patients;
CREATE POLICY admin_update_patients ON patients
  FOR UPDATE
  USING (current_setting('app.current_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_role', true) = 'admin');

-- System: narrow carve-out for UC-19 patient self-registration
-- (docs/psm2/self-registration-design.md) — the only place app.current_role
-- is ever set to 'system' is patientRegistrationController.js, checking a
-- national_id for an existing account and inserting the new patient row,
-- both before any authenticated session exists. setupRLSContext (the normal
-- per-request RLS bootstrap) never produces this role.
DROP POLICY IF EXISTS system_check_national_id ON patients;
CREATE POLICY system_check_national_id ON patients
  FOR SELECT
  USING (current_setting('app.current_role', true) = 'system');

DROP POLICY IF EXISTS system_insert_patients ON patients;
CREATE POLICY system_insert_patients ON patients
  FOR INSERT
  WITH CHECK (current_setting('app.current_role', true) = 'system');

-- Patient: self-assign a doctor, but only once — the USING clause only
-- matches while assigned_doctor_id is still NULL, so this can never be used
-- to change an existing assignment (that stays an admin-only UC-09 action).
-- Backs UC-20 self-booking auto-assigning the doctor from a self-registered
-- patient's first appointment — without this, appointmentsController's
-- Patient.assignDoctor call would silently affect zero rows under RLS.
DROP POLICY IF EXISTS patient_self_assign_doctor ON patients;
CREATE POLICY patient_self_assign_doctor ON patients
  FOR UPDATE
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID AND assigned_doctor_id IS NULL)
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID);

-- ── lab_results policies ─────────────────────────────────────────────────
-- Two RESTRICTIVE gates instead of one blanket "doctor only": patients now
-- need SELECT access to their own released results, but must never be able
-- to write to this table under any circumstance. Each RESTRICTIVE policy is
-- AND-combined with every PERMISSIVE policy that applies to the same
-- command, so these are what actually keep admin/superadmin out entirely
-- and keep patient to read-only, not just the absence of a permissive policy.
DROP POLICY IF EXISTS doctor_only_lab_results ON lab_results;

DROP POLICY IF EXISTS doctor_or_patient_read_lab_results ON lab_results;
CREATE POLICY doctor_or_patient_read_lab_results ON lab_results
  AS RESTRICTIVE
  FOR SELECT
  USING (current_setting('app.current_role', true) IN ('doctor', 'patient'));

-- `FOR ALL` here would be a bug, not a simplification: a RESTRICTIVE policy
-- with no command-specific FOR clause applies to SELECT too, and would
-- silently AND itself against doctor_or_patient_read_lab_results above,
-- blocking every patient SELECT regardless of the permissive policy below
-- (found by testing the release flow end-to-end — the patient saw released_at
-- set in the row but still got an empty list). INSERT/UPDATE only, one
-- policy each since a single CREATE POLICY takes exactly one FOR command.
DROP POLICY IF EXISTS doctor_only_write_lab_results ON lab_results;

DROP POLICY IF EXISTS doctor_only_insert_lab_results ON lab_results;
CREATE POLICY doctor_only_insert_lab_results ON lab_results
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (current_setting('app.current_role', true) = 'doctor');

DROP POLICY IF EXISTS doctor_only_update_lab_results ON lab_results;
CREATE POLICY doctor_only_update_lab_results ON lab_results
  AS RESTRICTIVE
  FOR UPDATE
  USING (current_setting('app.current_role', true) = 'doctor')
  WITH CHECK (current_setting('app.current_role', true) = 'doctor');

-- Doctor: only results for patients currently assigned to them. The
-- subquery against `patients` runs under the same session and is itself
-- filtered by doctor_select_assigned, so this stays correct even if this
-- policy's own logic is ever copy-pasted somewhere without that context.
DROP POLICY IF EXISTS doctor_select_lab_results ON lab_results;
CREATE POLICY doctor_select_lab_results ON lab_results
  FOR SELECT
  USING (patient_id IN (
    SELECT patient_id FROM patients WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM medical_records WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

DROP POLICY IF EXISTS doctor_insert_lab_results ON lab_results;
CREATE POLICY doctor_insert_lab_results ON lab_results
  FOR INSERT
  WITH CHECK (patient_id IN (
    SELECT patient_id FROM patients WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM medical_records WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

DROP POLICY IF EXISTS doctor_release_lab_results ON lab_results;
CREATE POLICY doctor_release_lab_results ON lab_results
  FOR UPDATE
  USING (patient_id IN (
    SELECT patient_id FROM patients WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM medical_records WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ))
  WITH CHECK (patient_id IN (
    SELECT patient_id FROM patients WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM medical_records WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

-- Patient: only their own results, and only once a doctor has released them.
DROP POLICY IF EXISTS patient_select_released_lab_results ON lab_results;
CREATE POLICY patient_select_released_lab_results ON lab_results
  FOR SELECT
  USING (
    patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::UUID
    AND released_at IS NOT NULL
  );

-- ── Admin bootstrap ─────────────────────────────────────────────────────────
-- There is deliberately NO seeded admin user in this file. A hardcoded
-- username/password/hash committed to version control is a permanent,
-- un-rotatable credential the moment it lands in git history. Create the
-- first admin account out-of-band instead:
--
--   ADMIN_USERNAME=admin ADMIN_PASSWORD='<a real secret>' npm run seed:admin
--
-- See scripts/seed-admin.js — it hashes the password with bcrypt (cost 12)
-- and upserts the row directly; the plaintext password is never persisted
-- or logged, and never appears in this repository.

-- pdms_app itself is created near the top of this file, right after
-- CREATE EXTENSION — see the comment there for why it has to happen before
-- any of the per-table GRANTs above, not here.
GRANT USAGE ON SCHEMA public TO pdms_app;
GRANT SELECT, INSERT, UPDATE ON users, doctors, patients, medical_records, appointments, otp_verifications TO pdms_app;
-- doctor_availability gets its own DELETE grant — DoctorAvailability.remove()
-- issues a real DELETE (one row per doctor_id+day_of_week, not a soft-delete
-- flag), which the combined grant above never covered. Found via a live
-- "remove a day's hours" smoke test 500'ing with "permission denied for
-- table doctor_availability" — the DELETE route/controller/model all
-- existed already but had never actually been exercised end-to-end.
GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_availability TO pdms_app;
GRANT SELECT, INSERT ON audit_log TO pdms_app; -- append-only: no UPDATE/DELETE grant, even to the app role
GRANT SELECT, INSERT ON patient_invoices TO pdms_app; -- upload-only: no UPDATE/DELETE, files are immutable once uploaded
GRANT SELECT, INSERT, UPDATE ON lab_results TO pdms_app; -- UPDATE needed for the doctor-release-to-patient action
GRANT SELECT, INSERT, UPDATE ON password_setup_tokens TO pdms_app; -- UPDATE needed to mark used_at
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pdms_app;

-- Ensure the app role is never the table owner (owners bypass RLS just
-- like superusers do) — these tables are created by whichever role runs
-- this script, so this is a no-op unless that ever changes.
ALTER TABLE medical_records OWNER TO CURRENT_USER;
ALTER TABLE patients        OWNER TO CURRENT_USER;
ALTER TABLE lab_results     OWNER TO CURRENT_USER;

-- ── patient_care_team ─────────────────────────────────────────────────────
-- Multi-doctor patient model: one row per doctor–patient assignment.
-- assigned_doctor_id on patients still marks the "primary/registration" doctor;
-- every doctor in this table has access to the patient's records.
CREATE TABLE IF NOT EXISTS patient_care_team (
  assignment_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID        NOT NULL REFERENCES patients(patient_id)  ON DELETE CASCADE,
  doctor_id     UUID        NOT NULL REFERENCES doctors(doctor_id)    ON DELETE CASCADE,
  speciality    VARCHAR(100),
  is_primary    BOOLEAN     NOT NULL DEFAULT false,
  assigned_by   UUID        REFERENCES users(user_id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_care_team_patient ON patient_care_team(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_team_doctor  ON patient_care_team(doctor_id);

-- One-time data migration: backfill existing single-doctor assignments.
-- Safe to re-run (ON CONFLICT DO NOTHING) — idempotent.
INSERT INTO patient_care_team (patient_id, doctor_id, is_primary, speciality)
SELECT patient_id, assigned_doctor_id, true, 'General'
  FROM patients
 WHERE assigned_doctor_id IS NOT NULL
ON CONFLICT (patient_id, doctor_id) DO NOTHING;

-- Grant the app role access to the new table.
-- UPDATE is required here (not just SELECT/INSERT/DELETE) because
-- CareTeam.add uses ON CONFLICT (patient_id, doctor_id) DO UPDATE to upsert
-- speciality/is_primary when a doctor is re-added to a care team; Postgres
-- enforces UPDATE privilege on the target table for the DO UPDATE branch of
-- an upsert even though the statement is syntactically an INSERT.
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_care_team TO pdms_app;

-- ── Update RLS: doctors now see patients in their care team ───────────────
-- Replaces the single assigned_doctor_id check with a care team lookup.
-- The OR keeps working even before the data migration runs.
DROP POLICY IF EXISTS doctor_select_assigned ON patients;
CREATE POLICY doctor_select_assigned ON patients
  FOR SELECT
  USING (
    assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    OR
    patient_id IN (
      SELECT patient_id FROM patient_care_team
       WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    )
  );

-- Update medical_records: doctor sees all records for any care team patient,
-- not only the records they personally wrote.
DROP POLICY IF EXISTS doctor_select_records ON medical_records;
CREATE POLICY doctor_select_records ON medical_records
  FOR SELECT
  USING (
    doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    OR
    patient_id IN (
      SELECT patient_id FROM patient_care_team
       WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    )
  );

-- Update lab_results: care team doctors can select/insert/release results.
DROP POLICY IF EXISTS doctor_select_lab_results ON lab_results;
CREATE POLICY doctor_select_lab_results ON lab_results
  FOR SELECT
  USING (patient_id IN (
    SELECT patient_id FROM patient_care_team
     WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM patients
     WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

DROP POLICY IF EXISTS doctor_insert_lab_results ON lab_results;
CREATE POLICY doctor_insert_lab_results ON lab_results
  FOR INSERT
  WITH CHECK (patient_id IN (
    SELECT patient_id FROM patient_care_team
     WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM patients
     WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

DROP POLICY IF EXISTS doctor_release_lab_results ON lab_results;
CREATE POLICY doctor_release_lab_results ON lab_results
  FOR UPDATE
  USING (patient_id IN (
    SELECT patient_id FROM patient_care_team
     WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM patients
     WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ))
  WITH CHECK (patient_id IN (
    SELECT patient_id FROM patient_care_team
     WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM patients
     WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

-- ── Patient File Number ───────────────────────────────────────────────────
-- Human-readable sequential patient identifier printed on all clinic
-- documents (invoices, lab results, etc.). Auto-assigned, never typed
-- by staff. Sequence starts at 10001 so demo data looks realistic.
CREATE SEQUENCE IF NOT EXISTS patient_file_no_seq START WITH 10001 INCREMENT BY 1;

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS file_no INTEGER UNIQUE DEFAULT nextval('patient_file_no_seq');

-- Backfill any existing patients in order of registration
UPDATE patients
   SET file_no = nextval('patient_file_no_seq')
 WHERE file_no IS NULL;

ALTER TABLE patients ALTER COLUMN file_no SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_file_no ON patients(file_no);

GRANT USAGE, SELECT ON SEQUENCE patient_file_no_seq TO pdms_app;

-- ── clinic_services ──────────────────────────────────────────────────────
-- Price catalog for billing. Admin/superadmin manage this list.
-- Prices are editable; nothing is hardcoded. Deactivation not deletion
-- preserves billing history integrity.
CREATE TABLE IF NOT EXISTS clinic_services (
  service_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code_no     VARCHAR(20)  NOT NULL UNIQUE,
  name_en     VARCHAR(255) NOT NULL,
  name_ar     VARCHAR(255),
  base_price  DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
  category    VARCHAR(50),
  vat_pct     DECIMAL(5,2) NOT NULL DEFAULT 15,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_by  UUID         REFERENCES users(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_code     ON clinic_services(code_no);
CREATE INDEX IF NOT EXISTS idx_services_active   ON clinic_services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_category ON clinic_services(category);

GRANT SELECT, INSERT, UPDATE ON clinic_services TO pdms_app;

-- Same department FK as doctors.specialisation above — one shared taxonomy
-- for both "what clinic is this doctor in" and "what clinic is this billing
-- item under".
ALTER TABLE clinic_services DROP CONSTRAINT IF EXISTS clinic_services_category_fkey;
ALTER TABLE clinic_services ADD CONSTRAINT clinic_services_category_fkey
  FOREIGN KEY (category) REFERENCES departments(key);

-- visits' CREATE TABLE itself now lives earlier in this file, right before
-- the "Row-Level Security" section — several RLS policies there subquery
-- visits (patient_id, doctor_id), so the table has to exist before those
-- policies are defined. Its indexes, grant, and later column additions stay
-- here since none of those are needed for the RLS policies to compile.

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor  ON visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_status  ON visits(status);
-- Plain index on the timestamptz column itself, not DATE(checked_in_at) —
-- date(timestamptz) is STABLE, not IMMUTABLE (its result depends on the
-- session's TimeZone setting), so Postgres rejects it as an index
-- expression outright ("functions in index expression must be marked
-- IMMUTABLE" — confirmed against this project's local DB). A plain index
-- on the raw column supports the same "today's queue" lookup just fine via
-- a checked_in_at >= start_of_day AND checked_in_at < start_of_day + 1 day
-- range predicate, which is the standard sargable pattern anyway.
CREATE INDEX IF NOT EXISTS idx_visits_date    ON visits(checked_in_at);

GRANT SELECT, INSERT, UPDATE ON visits TO pdms_app;

-- ── prescription_notes on visits ─────────────────────────────────────────
ALTER TABLE visits ADD COLUMN IF NOT EXISTS prescription_notes TEXT;

-- ── visit_type on visits ─────────────────────────────────────────────────
-- Reason for the walk-in (staff picks this at check-in so the doctor sees
-- why the patient is here before calling them in). Reuses the exact same
-- vocabulary as appointments.type (APPOINTMENT_TYPES) instead of a second,
-- parallel taxonomy — nullable since staff won't always know at check-in.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_type VARCHAR(20)
  CHECK (visit_type IN ('consultation','follow_up','emergency','checkup'));

-- ── visit_invoices ────────────────────────────────────────────────────────
-- Status flow:
--   draft          → doctor is adding items (auto-created on first item add)
--   pending_billing→ doctor marked done, staff can now bill
--   paid           → patient paid in full
--   partial        → partial payment taken
--   cancelled      → voided

CREATE SEQUENCE IF NOT EXISTS invoice_no_seq START WITH 900001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS visit_invoices (
  invoice_id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  inv_no         VARCHAR(20)   NOT NULL UNIQUE DEFAULT nextval('invoice_no_seq')::TEXT,
  visit_id       UUID          NOT NULL UNIQUE REFERENCES visits(visit_id) ON DELETE RESTRICT,
  patient_id     UUID          NOT NULL REFERENCES patients(patient_id),
  doctor_id      UUID          NOT NULL REFERENCES doctors(doctor_id),
  payment_method VARCHAR(20)   CHECK (payment_method IN ('cash','card','insurance')),
  insurance_co   VARCHAR(100),
  subtotal       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_total      DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_vat      DECIMAL(10,2) NOT NULL DEFAULT 0,
  grand_total    DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  status         VARCHAR(20)   NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','pending_billing','paid','partial','cancelled')),
  created_by     UUID          REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS approval_code VARCHAR(50);
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS policy_number VARCHAR(50);
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS coverage_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS co_pay_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS patient_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(10,2) DEFAULT 0;

-- ── clinic_rooms — removed 2026-07-24 ─────────────────────────────────────
-- The Room & Equipment Allocation Module was built (this table,
-- roomsController.js/rooms.routes.js, RoomStatusGrid.tsx) but never wired
-- into any screen — `rooms.routes.js` was never `require`'d/mounted in
-- routes/index.js, and RoomStatusGrid.tsx was never imported anywhere.
-- Removed rather than left as dead weight once confirmed genuinely unused
-- end-to-end (backend route unreachable, frontend component orphaned,
-- visits.room_id never read anywhere outside the dead controller).
-- DROP statements (not just omitting the CREATE) so re-running this file
-- against a DB that already has the table actually removes it there too.
ALTER TABLE visits DROP COLUMN IF EXISTS room_id;
DROP TABLE IF EXISTS clinic_rooms;

CREATE TABLE IF NOT EXISTS invoice_items (
  item_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID          NOT NULL REFERENCES visit_invoices(invoice_id) ON DELETE CASCADE,
  service_id      UUID          REFERENCES clinic_services(service_id) ON DELETE SET NULL,
  code_no         VARCHAR(20),
  name_en         VARCHAR(255),
  name_ar         VARCHAR(255),
  qty             INTEGER       NOT NULL DEFAULT 1 CHECK (qty > 0),
  unit_price      DECIMAL(10,2) NOT NULL,
  discount_pct    DECIMAL(5,2)  NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_price       DECIMAL(10,2) NOT NULL,
  vat_pct         DECIMAL(5,2)  NOT NULL DEFAULT 15,
  vat_amount      DECIMAL(10,2) NOT NULL,
  total_with_vat  DECIMAL(10,2) NOT NULL,
  sort_order      INTEGER       NOT NULL DEFAULT 0
);

-- No index on visit_invoices(visit_id) here — the UNIQUE constraint above
-- already makes Postgres create visit_invoices_visit_id_key automatically
-- (confirmed against this project's local DB); a second explicit index on
-- the same column would just duplicate it, costing storage and write time
-- for zero benefit.
CREATE INDEX IF NOT EXISTS idx_visit_invoices_patient  ON visit_invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice   ON invoice_items(invoice_id);

GRANT SELECT, INSERT, UPDATE    ON visit_invoices TO pdms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_items TO pdms_app;
GRANT USAGE, SELECT ON SEQUENCE invoice_no_seq TO pdms_app;

-- ── RLS on operational tables (HIGH-03 audit fix) ────────────────────────
-- visits, visit_invoices, invoice_items, and patient_care_team were missing
-- database-level RLS. These policies mirror the application-layer RBAC so
-- a rogue query outside the app layer cannot leak encounter or billing data.

ALTER TABLE visits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_invoices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_care_team ENABLE ROW LEVEL SECURITY;

-- Same owner-bypass hardening as medical_records/patients/lab_results above
-- (line ~345) — pdms_app is never the owner of these tables today, so this
-- is defense-in-depth, not a fix for an active bypass.
ALTER TABLE visits            FORCE ROW LEVEL SECURITY;
ALTER TABLE visit_invoices    FORCE ROW LEVEL SECURITY;
ALTER TABLE invoice_items     FORCE ROW LEVEL SECURITY;
ALTER TABLE patient_care_team FORCE ROW LEVEL SECURITY;

-- visits -------------------------------------------------------------------
-- Admin/superadmin see all visits; doctor sees only their own patients'
-- visits (by direct assignment or via care team); patient sees their own.

DROP POLICY IF EXISTS admin_all_visits ON visits;
CREATE POLICY admin_all_visits ON visits
  FOR ALL
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

-- Public, unauthenticated queue-tracker endpoint (visits.routes.js
-- GET /:visitId/tracker, visitsController.getPublicQueueTracker) — reached
-- via a raw visit_id in an SMS link, no JWT. 'public_tracker' is a fixed
-- string only ever set by that one controller (never derived from client
-- input), so this cannot be reached by any real authenticated role.
-- SELECT-only, and the controller itself never selects patient/doctor name
-- columns for this role — see the comment in getPublicQueueTracker.
DROP POLICY IF EXISTS public_tracker_visits ON visits;
CREATE POLICY public_tracker_visits ON visits
  FOR SELECT
  USING (current_setting('app.current_role', true) = 'public_tracker');

DROP POLICY IF EXISTS doctor_own_visits ON visits;
CREATE POLICY doctor_own_visits ON visits
  FOR ALL
  USING (
    current_setting('app.current_role', true) = 'doctor'
    AND doctor_id = (
      SELECT doctor_id FROM doctors
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS patient_own_visits ON visits;
CREATE POLICY patient_own_visits ON visits
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'patient'
    AND patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::uuid
  );

-- visit_invoices -----------------------------------------------------------
DROP POLICY IF EXISTS admin_all_invoices ON visit_invoices;
CREATE POLICY admin_all_invoices ON visit_invoices
  FOR ALL
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS doctor_own_invoices ON visit_invoices;
CREATE POLICY doctor_own_invoices ON visit_invoices
  FOR ALL
  USING (
    current_setting('app.current_role', true) = 'doctor'
    AND doctor_id = (
      SELECT doctor_id FROM doctors
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

DROP POLICY IF EXISTS patient_own_invoices ON visit_invoices;
CREATE POLICY patient_own_invoices ON visit_invoices
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'patient'
    AND patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::uuid
  );

-- invoice_items ------------------------------------------------------------
-- Access through the parent invoice: if you can read the invoice you can
-- read its items. The JOIN to visit_invoices enforces the same scope.

DROP POLICY IF EXISTS admin_all_items ON invoice_items;
CREATE POLICY admin_all_items ON invoice_items
  FOR ALL
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS doctor_own_items ON invoice_items;
CREATE POLICY doctor_own_items ON invoice_items
  FOR ALL
  USING (
    current_setting('app.current_role', true) = 'doctor'
    AND invoice_id IN (
      SELECT invoice_id FROM visit_invoices
      WHERE doctor_id = (
        SELECT doctor_id FROM doctors
        WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

DROP POLICY IF EXISTS patient_own_items ON invoice_items;
CREATE POLICY patient_own_items ON invoice_items
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'patient'
    AND invoice_id IN (
      SELECT invoice_id FROM visit_invoices
      WHERE patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::uuid
    )
  );

-- patient_care_team --------------------------------------------------------
DROP POLICY IF EXISTS admin_all_care_team ON patient_care_team;
CREATE POLICY admin_all_care_team ON patient_care_team
  FOR ALL
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS doctor_own_care_team ON patient_care_team;
CREATE POLICY doctor_own_care_team ON patient_care_team
  FOR ALL
  USING (
    current_setting('app.current_role', true) = 'doctor'
    AND doctor_id = (
      SELECT doctor_id FROM doctors
      WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- ── invoice_payments (QA-2026-07-24 fix: partial-payment ledger) ──────────
-- Fixes a real stuck-state bug: `visit_invoices.amount_paid` used to be
-- SET (not accumulated) by every payInvoice call, and BillVisitPage only
-- rendered the payment form for status='pending_billing' — once an invoice
-- took a partial payment (status='partial'), there was no screen anywhere
-- that could ever collect the rest, and a second collection attempt would
-- have silently overwritten (erased) the first payment's amount. This
-- ledger is the source of truth for what's actually been collected;
-- `visit_invoices.amount_paid` is now always derived as SUM(this table),
-- never written directly. Append-only, same as `audit_log` — a payment
-- once recorded is never edited or deleted, only ever added to.
CREATE TABLE IF NOT EXISTS invoice_payments (
  payment_id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID          NOT NULL REFERENCES visit_invoices(invoice_id) ON DELETE CASCADE,
  amount         DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20)   NOT NULL CHECK (payment_method IN ('cash','card','insurance')),
  collected_by   UUID          REFERENCES users(user_id) ON DELETE SET NULL,
  collected_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

GRANT SELECT, INSERT ON invoice_payments TO pdms_app; -- append-only ledger: no UPDATE/DELETE, same reasoning as audit_log

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments FORCE ROW LEVEL SECURITY;

-- Same three-way split as invoice_items: admin/superadmin see everything,
-- doctor/patient see only payments on invoices they're scoped to (via the
-- parent visit_invoices row), read-only for both since only admin ever
-- calls payInvoice.
DROP POLICY IF EXISTS admin_all_payments ON invoice_payments;
CREATE POLICY admin_all_payments ON invoice_payments
  FOR ALL
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS doctor_own_payments ON invoice_payments;
CREATE POLICY doctor_own_payments ON invoice_payments
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'doctor'
    AND invoice_id IN (
      SELECT invoice_id FROM visit_invoices
      WHERE doctor_id = (
        SELECT doctor_id FROM doctors
        WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    )
  );

DROP POLICY IF EXISTS patient_own_payments ON invoice_payments;
CREATE POLICY patient_own_payments ON invoice_payments
  FOR SELECT
  USING (
    current_setting('app.current_role', true) = 'patient'
    AND invoice_id IN (
      SELECT invoice_id FROM visit_invoices
      WHERE patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::uuid
    )
  );

-- ── visits.status gains 'cancelled' (QA-2026-07-24 fix: void workflow) ────
-- A wrong-patient/duplicate walk-in check-in had no way to ever be removed
-- once created — visits had no 'cancelled' status at all. Admin/superadmin
-- can now cancel a visit that's still 'waiting' (nothing charted yet) via
-- PATCH /visits/:visitId/cancel (visitsController.cancelVisit).
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check
  CHECK (status IN ('waiting','in_progress','completed','billed','cancelled'));

-- ── visits status transition trigger (2026-07-24 feature-request follow-up) ─
-- Enforces the exact same transition matrix visitsController.updateStatus's
-- comment already documents as the intended workflow (waiting -> in_progress
-- -> completed -> billed, or waiting -> cancelled) at the database layer
-- too — previously only the application layer's role checks stood between
-- a request and an out-of-scope status jump, and even those didn't check
-- the *current* status (billingController.markDone in particular set
-- status='completed' unconditionally, with no precondition, so a direct
-- API call — or a doctor navigating straight to a visit's /consult URL
-- without ever clicking "start" — could jump 'waiting' straight to
-- 'completed', or resurrect an already-'billed'/'cancelled' visit).
-- Same-value updates (status unchanged) are always allowed — this only
-- fires on an actual transition. A rejected transition raises a plain
-- exception (SQLSTATE P0001), which middleware/errorHandler.js maps to a
-- clean 409 rather than a generic 500.
CREATE OR REPLACE FUNCTION enforce_visit_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF (OLD.status, NEW.status) IN (
    ('waiting', 'in_progress'),
    ('waiting', 'cancelled'),
    ('in_progress', 'completed'),
    ('completed', 'billed')
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid visit status transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_visit_status_transition ON visits;
CREATE TRIGGER trg_enforce_visit_status_transition
  BEFORE UPDATE OF status ON visits
  FOR EACH ROW
  EXECUTE FUNCTION enforce_visit_status_transition();

-- ── medical_records.updated_at (QA-2026-07-24 fix H-5) ────────────────────
-- Column existed but nothing ever wrote to it (no DEFAULT, no UPDATE
-- statement touched it) — every row's updated_at was NULL, which the
-- frontend rendered as "Jan 1, 1970" (new Date(null) → Unix epoch) on every
-- single medical record, for every role. DEFAULT here covers INSERT;
-- medicalRecordsController.updateRecord now also sets it explicitly on
-- UPDATE (see that file).
ALTER TABLE medical_records ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE medical_records SET updated_at = created_at WHERE updated_at IS NULL;

-- ── sick_leaves RLS (Sprint 5 pentest finding — CRITICAL cross-tenant IDOR) ─
-- sick_leaves was originally created by scripts/apply-feature-additions.js
-- with no RLS at all — the table definition is repeated here (idempotent,
-- IF NOT EXISTS) so this fix applies whether or not that script has already
-- run. Without RLS, GET /sick-leaves/patient/:patientId (authorized for
-- DOCTOR, ADMIN, SUPERADMIN, and PATIENT) returned every row matching the
-- URL's patientId regardless of who asked — any authenticated patient could
-- read any other patient's diagnosis and work restrictions by substituting
-- a different patientId, and any doctor could read (and, via
-- sickLeavesController.createSickLeave, forge an official SEHA-SL-######
-- certificate for) a patient never under their care. Mirrors the same
-- admin/doctor(care-team)/patient(own) three-way split already used for
-- lab_results and visits above.
CREATE TABLE IF NOT EXISTS sick_leaves (
  leave_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id          UUID REFERENCES visits(visit_id) ON DELETE SET NULL,
  patient_id        UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id         UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  reference_no      VARCHAR(50) NOT NULL UNIQUE,
  start_date        DATE NOT NULL,
  days_count        INTEGER NOT NULL DEFAULT 1,
  diagnosis         TEXT NOT NULL,
  work_restrictions TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sick_leaves_patient ON sick_leaves(patient_id);
CREATE INDEX IF NOT EXISTS idx_sick_leaves_doctor  ON sick_leaves(doctor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON sick_leaves TO pdms_app;

ALTER TABLE sick_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE sick_leaves FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_sick_leaves ON sick_leaves;
CREATE POLICY admin_all_sick_leaves ON sick_leaves
  FOR ALL
  USING (current_setting('app.current_role', true) IN ('admin', 'superadmin'));

-- Doctor: sees/creates sick leaves only for patients directly assigned to
-- them or on their care team — same union labResultsController's RLS uses.
DROP POLICY IF EXISTS doctor_select_sick_leaves ON sick_leaves;
CREATE POLICY doctor_select_sick_leaves ON sick_leaves
  FOR SELECT
  USING (patient_id IN (
    SELECT patient_id FROM patients
     WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM patient_care_team
     WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

DROP POLICY IF EXISTS doctor_insert_sick_leaves ON sick_leaves;
CREATE POLICY doctor_insert_sick_leaves ON sick_leaves
  FOR INSERT
  WITH CHECK (patient_id IN (
    SELECT patient_id FROM patients
     WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
    UNION
    SELECT patient_id FROM patient_care_team
     WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
  ));

-- Patient: only their own sick leaves, read-only.
DROP POLICY IF EXISTS patient_own_sick_leaves ON sick_leaves;
CREATE POLICY patient_own_sick_leaves ON sick_leaves
  FOR SELECT
  USING (patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::UUID);

-- Apply the new RLS policies to the running database ----------------------
-- Run this block manually once on the live DB after deploying schema changes:
--
--   psql -U postgres -d pdms -f schema.sql
--
-- Existing data is unaffected; policies only control future query results.
