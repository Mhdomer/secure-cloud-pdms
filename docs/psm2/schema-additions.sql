-- PDMS Schema Additions — Sprint 3c Gap Fixes
-- These ALTER TABLE statements add the fields identified as missing
-- after the initial schema was implemented. Run as postgres superuser.
-- Each block is safe to re-run (uses IF NOT EXISTS / DO $$ patterns).

-- ── 1. patients — identity & safety fields ──────────────────────────────────
--
-- Two-layer identity model:
--   UUID (patient_id)  — DB primary key, internal only, never shown in UI
--   national_id        — user-facing identifier: Saudi national ID (10 digits),
--                        Iqama for residents, or passport for visitors.
--                        This is what staff type to find a patient, what insurance
--                        requires, and what patients already carry in their wallet.
--
-- No MRN: a single-clinic system with national ID already unique per person
-- does not need a third identifier layer.

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS id_type       VARCHAR(15) DEFAULT 'national_id'
    CHECK (id_type IN ('national_id','iqama','passport')),
  ADD COLUMN IF NOT EXISTS national_id   VARCHAR(20) UNIQUE,
  ADD COLUMN IF NOT EXISTS blood_type    VARCHAR(5)
    CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  ADD COLUMN IF NOT EXISTS allergies     TEXT,
  ADD COLUMN IF NOT EXISTS nationality   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address       TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS insurance_provider      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS insurance_number        VARCHAR(50);

-- Search indexes — staff searches by national_id (primary), name, or phone
CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);
CREATE INDEX IF NOT EXISTS idx_patients_full_name   ON patients USING gin(to_tsvector('simple', full_name));
CREATE INDEX IF NOT EXISTS idx_patients_contact     ON patients(contact_number);

-- ── 2. doctors — professional & operational fields ─────────────────────────

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS license_number VARCHAR(50),   -- SCFHS license (ترخيص مزاولة المهنة)
  ADD COLUMN IF NOT EXISTS phone          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true;

-- ── 3. appointments — missing status + cancellation tracking ───────────────

-- Add 'confirmed' to the status enum (drop + recreate constraint)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled','confirmed','completed','cancelled'));

-- Cancellation tracking
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS duration_minutes  INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS cancelled_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_note TEXT;

-- ── 4. medical_records — SOAP structure ────────────────────────────────────
-- Current: diagnosis (TEXT) + prescription (TEXT) + notes (TEXT)
-- Problem: too flat — no structured clinical workflow
--
-- We keep the existing columns intact (data is already there in dev).
-- Add the missing SOAP fields alongside them.
-- The API and frontend will write to these new columns going forward.

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS objective       TEXT,   -- objective findings / examination
  ADD COLUMN IF NOT EXISTS assessment      TEXT,   -- assessment / diagnosis narrative (replaces free-text diagnosis)
  ADD COLUMN IF NOT EXISTS plan            TEXT,   -- treatment plan
  ADD COLUMN IF NOT EXISTS vital_signs     JSONB,  -- { bp: "120/80", temp: "37.1", weight: "75kg", height: "175cm" }
  ADD COLUMN IF NOT EXISTS visit_type      VARCHAR(20) DEFAULT 'consultation'
    CHECK (visit_type IN ('consultation','follow_up','emergency','checkup'));

-- Note: the existing `diagnosis` column stays — it's the short summary line
-- shown in the patient profile timeline. assessment is the full narrative.

-- ── 5. doctor_availability — schedule/working hours ────────────────────────
-- Without this table the system can book appointments at 3am on a Sunday.
-- This is a simple weekly schedule: which day of week + start/end time.

CREATE TABLE IF NOT EXISTS doctor_availability (
  availability_id UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID    REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                                   -- 0=Sunday, 1=Monday … 6=Saturday
                                   -- Saudi work week: Sun–Thu (0–4)
  start_time      TIME    NOT NULL,
  end_time        TIME    NOT NULL,
  slot_minutes    INT     DEFAULT 30,  -- appointment slot length for this doctor on this day
  is_active       BOOLEAN DEFAULT true,
  UNIQUE (doctor_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_doctor ON doctor_availability(doctor_id);

-- Grant app role access to the new table
GRANT SELECT, INSERT, UPDATE ON doctor_availability TO pdms_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pdms_app;
