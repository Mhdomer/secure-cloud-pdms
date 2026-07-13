-- PDMS Local Development Schema
-- Run once: psql -U postgres -d pdms -f schema.sql
-- Production schema is managed via Terraform/migrations

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(50)  UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(10)  NOT NULL CHECK (role IN ('doctor','admin','patient')),
  is_active       BOOLEAN      DEFAULT true,
  failed_attempts INT          DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ── doctors ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
  full_name      VARCHAR(100) NOT NULL,
  specialisation VARCHAR(100)
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
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- ── medical_records ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_records (
  record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id    UUID REFERENCES doctors(doctor_id)   ON DELETE SET NULL,
  diagnosis    TEXT        NOT NULL,
  prescription TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── appointments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id      UUID REFERENCES doctors(doctor_id)   ON DELETE SET NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','completed','cancelled')),
  type           VARCHAR(20) DEFAULT 'consultation'
                   CHECK (type IN ('consultation','follow_up','emergency','checkup')),
  notes          TEXT,
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── audit_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  resource   VARCHAR(50),
  record_id  UUID,
  ip_address INET,
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS (Row-Level Security) ───────────────────────────────────────────────
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients        ENABLE ROW LEVEL SECURITY;

-- Doctor: own patients' records only
DROP POLICY IF EXISTS doctor_records ON medical_records;
CREATE POLICY doctor_records ON medical_records
  USING (doctor_id = current_setting('app.current_user_id', true)::UUID);

-- Patient: own records only (read)
DROP POLICY IF EXISTS patient_own_records ON medical_records;
CREATE POLICY patient_own_records ON medical_records
  FOR SELECT USING (patient_id = current_setting('app.current_user_id', true)::UUID);

-- Admin: blocked from medical_records
DROP POLICY IF EXISTS admin_no_records ON medical_records;
CREATE POLICY admin_no_records ON medical_records
  USING (current_setting('app.current_role', true) != 'admin');

-- Patient: own profile only (read)
DROP POLICY IF EXISTS patient_own_profile ON patients;
CREATE POLICY patient_own_profile ON patients
  FOR SELECT USING (patient_id = current_setting('app.current_user_id', true)::UUID);

-- ── Seed: admin user (password = Admin@2024) ───────────────────────────────
INSERT INTO users (username, password_hash, role)
VALUES (
  'admin',
  '$2b$12$LKRx3v/8Q1E2M.NfuJzK7OT.BXAM8cX6vCZbF9oWQiP5yYekXJbFe',
  'admin'
) ON CONFLICT (username) DO NOTHING;
