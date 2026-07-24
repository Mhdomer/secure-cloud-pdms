'use strict';
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pdms',
  user: process.env.MIGRATION_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
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

    -- Room & Equipment Allocation Table — removed 2026-07-24, never wired
    -- into any screen (see schema.sql's clinic_rooms section for the full
    -- removal note). Left out of this historical migration script too so
    -- re-running it doesn't resurrect the table schema.sql just dropped.

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
  `);

  console.log('FEATURE SCHEMA ADDITIONS APPLIED SUCCESSFULLY!');
  await client.end();
}

run().catch((err) => {
  console.error('Error applying feature schema additions:', err);
  process.exit(1);
});
