-- PDMS Local Development Schema
-- Run once: psql -U postgres -d pdms -f schema.sql
-- Production schema is managed via Terraform/migrations
--
-- IMPORTANT — Row-Level Security only works if the application connects
-- with a role that is NOT the table owner and does NOT have BYPASSRLS.
-- The `postgres`/master RDS user used to run this script is a superuser
-- and always bypasses RLS. Create a dedicated least-privilege role for the
-- Express app (see "APPLICATION ROLE" section at the bottom of this file)
-- and configure DB_USER in .env / SSM to that role, never the master user.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  visit_type      VARCHAR(20) DEFAULT 'consultation'
                    CHECK (visit_type IN ('consultation','follow_up','emergency','checkup'))
);

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
                   CHECK (status IN ('scheduled','confirmed','completed','cancelled')),
  type           VARCHAR(20) DEFAULT 'consultation'
                   CHECK (type IN ('consultation','follow_up','emergency','checkup')),
  notes          TEXT,
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes  INT DEFAULT 30,
  cancelled_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  cancellation_note TEXT
);

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
CREATE INDEX IF NOT EXISTS idx_availability_doctor          ON doctor_availability(doctor_id);

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

-- FORCE ensures RLS applies even to a connection role that happens to own
-- these tables — defence in depth against a future role/ownership mistake.
ALTER TABLE medical_records FORCE ROW LEVEL SECURITY;
ALTER TABLE patients        FORCE ROW LEVEL SECURITY;

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
  USING (doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID);

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
  USING (assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID);

-- Admin: full read access for registration, profile lookups, reassignment.
DROP POLICY IF EXISTS admin_select_patients ON patients;
CREATE POLICY admin_select_patients ON patients
  FOR SELECT
  USING (current_setting('app.current_role', true) = 'admin');

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

-- ── APPLICATION ROLE — least-privilege connection role for the Express app ──
-- The Express app must NEVER connect as the master/superuser: superusers
-- and table owners bypass RLS entirely regardless of the policies above,
-- which silently defeats the whole two-layer authorization model. This
-- block creates a dedicated low-privilege role and is safe to re-run.
--
-- Local dev: run this file as the postgres superuser (as the header
-- comment instructs), then point DB_USER/DB_PASSWORD in .env at pdms_app
-- instead of postgres, so RLS is actually exercised during local testing.
--
-- Production: the RDS master user is never used by the running app either
-- — Terraform/SSM provisions this same role with a generated secret. Change
-- the placeholder password below before using it anywhere but a local
-- throwaway database.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pdms_app') THEN
    CREATE ROLE pdms_app LOGIN PASSWORD 'change_me_local_dev_only';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO pdms_app;
GRANT SELECT, INSERT, UPDATE ON users, doctors, patients, medical_records, appointments, doctor_availability, otp_verifications TO pdms_app;
GRANT SELECT, INSERT ON audit_log TO pdms_app; -- append-only: no UPDATE/DELETE grant, even to the app role
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pdms_app;

-- Ensure the app role is never the table owner (owners bypass RLS just
-- like superusers do) — these tables are created by whichever role runs
-- this script, so this is a no-op unless that ever changes.
ALTER TABLE medical_records OWNER TO CURRENT_USER;
ALTER TABLE patients        OWNER TO CURRENT_USER;
