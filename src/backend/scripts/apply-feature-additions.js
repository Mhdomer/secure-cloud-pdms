'use strict';
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pdms',
  user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD || '2013',
});

async function run() {
  await client.connect();
  console.log('Applying Database Schema Additions for UI & Feature Enhancements...');

  await client.query(`
    -- 1. E-Prescription JSONB column
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS prescriptions_data JSONB;

    -- 2. Insurance Billing Columns on visit_invoices
    ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS approval_code VARCHAR(50);
    ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS policy_number VARCHAR(50);
    ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS coverage_percent DECIMAL(5,2) DEFAULT 0;
    ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS co_pay_amount DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS patient_amount DECIMAL(10,2) DEFAULT 0;
    ALTER TABLE visit_invoices ADD COLUMN IF NOT EXISTS insurance_amount DECIMAL(10,2) DEFAULT 0;

    -- 3. Room & Equipment Allocation Table
    CREATE TABLE IF NOT EXISTS clinic_rooms (
      room_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      room_number    VARCHAR(20) UNIQUE NOT NULL,
      name_en        VARCHAR(100) NOT NULL,
      name_ar        VARCHAR(100) NOT NULL,
      department_key VARCHAR(50) REFERENCES departments(key),
      status         VARCHAR(20) NOT NULL DEFAULT 'available'
                       CHECK (status IN ('available','occupied','cleaning','maintenance')),
      assigned_visit_id UUID REFERENCES visits(visit_id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE visits ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES clinic_rooms(room_id) ON DELETE SET NULL;

    INSERT INTO clinic_rooms (room_number, name_en, name_ar, department_key) VALUES
      ('101', 'General Clinic 1',     'عيادة الطب العام ١',     'general'),
      ('102', 'General Clinic 2',     'عيادة الطب العام ٢',     'general'),
      ('201', 'Dental Surgery 1',     'عيادة الأسنان ١',        'dental'),
      ('202', 'Dental Surgery 2',     'عيادة الأسنان ٢',        'dental'),
      ('301', 'Dermatology & Laser',  'عيادة الجلدية والتجميل', 'dermatology'),
      ('401', 'Pediatrics Room',      'عيادة طب الأطفال',      'pediatrics'),
      ('501', 'Phlebotomy & Sample',  'سحب العينات والمختبر',   'laboratory')
    ON CONFLICT (room_number) DO NOTHING;

    GRANT SELECT, INSERT, UPDATE, DELETE ON clinic_rooms TO pdms_app;

    -- 4. Sick Leaves Table
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON sick_leaves TO pdms_app;

    -- 5. Doctor Schedules Table
    CREATE TABLE IF NOT EXISTS doctor_schedules (
      schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      doctor_id   UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
      slot_date   DATE NOT NULL,
      slot_time   VARCHAR(20) NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'break')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_schedules TO pdms_app;

    -- 6. Notifications Table
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID REFERENCES users(user_id) ON DELETE CASCADE,
      target_role     VARCHAR(50),
      title_en        VARCHAR(255) NOT NULL,
      title_ar        VARCHAR(255) NOT NULL,
      message_en      TEXT NOT NULL,
      message_ar      TEXT NOT NULL,
      type            VARCHAR(50) NOT NULL DEFAULT 'general',
      is_read         BOOLEAN NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO pdms_app;

    -- 7. Forgot Password (phone OTP reset) — widens otp_verifications for
    -- reuse by the new password-reset flow, and tags password_setup_tokens
    -- rows so the shared setPassword controller can tell a reset apart from
    -- a first-time QR setup. See docs/superpowers/specs/2026-07-24-forgot-password-design.md.
    ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
    ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check
      CHECK (purpose IN ('registration', 'password_reset'));
    ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS
      user_id UUID REFERENCES users(user_id) ON DELETE SET NULL;

    ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS
      purpose VARCHAR(20) NOT NULL DEFAULT 'initial_setup'
      CHECK (purpose IN ('initial_setup', 'password_reset'));
  `);

  console.log('FEATURE SCHEMA ADDITIONS APPLIED SUCCESSFULLY!');
  await client.end();
}

run().catch((err) => {
  console.error('Error applying feature schema additions:', err);
  process.exit(1);
});
