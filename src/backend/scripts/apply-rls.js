'use strict';
require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.MIGRATION_DB_USER,
  password: process.env.MIGRATION_DB_PASSWORD,
});

async function run() {
  await client.connect();
  console.log('Applying non-circular Treatment-Relationship RLS policies...');

  await client.query(`
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

    DROP POLICY IF EXISTS doctor_select_lab_results ON lab_results;
    CREATE POLICY doctor_select_lab_results ON lab_results
      FOR SELECT
      USING (patient_id IN (
        SELECT patient_id FROM patients WHERE assigned_doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
        UNION
        SELECT patient_id FROM appointments WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
        UNION
        SELECT patient_id FROM visits WHERE doctor_id = NULLIF(current_setting('app.current_doctor_id', true), '')::UUID
      ));
  `);

  console.log('RLS POLICIES APPLIED SUCCESSFULLY!');
  await client.end();
}

run().catch((err) => {
  console.error('Error applying RLS policies:', err);
  process.exit(1);
});
