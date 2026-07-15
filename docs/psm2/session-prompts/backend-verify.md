# Session Prompt — Backend: DB Migration Verification + Seed Refresh

Paste this entire block into a new Claude Code chat session.

---

```
You are working on the backend of a clinic PDMS (Alamin PolyClinic, Jeddah).
Node.js / Express / PostgreSQL on localhost:5432, db: pdms, superuser: postgres / 2013.
App role: pdms_app (least-privilege, RLS enforced — never use postgres in application code).

Before doing anything, read:
  - src/backend/src/config/schema.sql      ← the full target schema
  - docs/psm2/schema-additions.sql         ← the ALTER TABLE / CREATE TABLE additions
  - src/backend/src/config/constants.js    ← ROLES and other constants

─────────────────────────────────────────
CONTEXT — what is already done vs. what may still be pending
─────────────────────────────────────────

Already implemented in code (do not rewrite):
  ✓ All route files registered in routes/index.js
  ✓ patientsController.js — handles national_id, id_type, blood_type, allergies, etc.
  ✓ medicalRecordsController.js — handles SOAP fields (chief_complaint, objective, assessment, plan, vital_signs)
  ✓ appointmentsController.js — handles confirmed status, cancelled_by, duration_minutes, isSlotAvailable
  ✓ DoctorAvailability model + availability.js utility
  ✓ doctorAvailability.routes.js + doctors.routes.js — both mounted at /api/doctors

What may still be pending (your job today):
  1. The LOCAL DATABASE may not have the new columns yet — the code supports them but the
     ALTER TABLE statements in docs/psm2/schema-additions.sql may never have been run.
  2. The existing seeded patients may not have national_id set, causing NOT NULL or unique
     constraint errors once that column is active.
  3. Doctor availability slots for dr.fahad may not exist, causing isSlotAvailable() to
     block all appointment creation.

─────────────────────────────────────────
TASK 1 — Check and migrate the local DB
─────────────────────────────────────────

Run this SQL to check which new columns already exist:

  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'patients'
    AND column_name IN ('national_id','id_type','blood_type','allergies','emergency_contact_name','insurance_provider');

  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'medical_records'
    AND column_name IN ('chief_complaint','objective','assessment','plan','vital_signs','visit_type');

  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'appointments'
    AND column_name IN ('duration_minutes','cancelled_by','cancellation_note');

  SELECT table_name
  FROM information_schema.tables
  WHERE table_name IN ('doctor_availability','otp_verifications');

For any missing column or table: run the corresponding block from docs/psm2/schema-additions.sql.
Run each block separately. Confirm success before moving to the next.
Do NOT drop and recreate any table — use the IF NOT EXISTS / ADD COLUMN IF NOT EXISTS patterns
that are already in schema-additions.sql.

─────────────────────────────────────────
TASK 2 — Fix seeded patient data
─────────────────────────────────────────

After the migration, update the 5 seeded patients (dr.fahad's patients) to have national_id values.
They currently have NULL in that column. Run:

  UPDATE patients SET
    national_id = '1000000001', id_type = 'national_id'
  WHERE full_name = 'Fahad Al-Otaibi';

  UPDATE patients SET
    national_id = '1000000002', id_type = 'national_id'
  WHERE full_name LIKE '%Ahmad%' OR full_name LIKE '%أحمد%';

  UPDATE patients SET
    national_id = '1000000003', id_type = 'national_id',
    blood_type  = 'O+',
    allergies   = 'Penicillin'
  WHERE full_name LIKE '%Noura%' OR full_name LIKE '%نورة%';

  UPDATE patients SET
    national_id = '1000000004', id_type = 'national_id',
    blood_type  = 'A+'
  WHERE full_name LIKE '%Sara%' OR full_name LIKE '%سارة%';

  UPDATE patients SET
    national_id = '1000000005', id_type = 'national_id'
  WHERE national_id IS NULL LIMIT 1;

Verify: SELECT patient_id, full_name, national_id, blood_type, allergies FROM patients;

Also update the patient-role user (patient.test → Fahad Al-Otaibi) so their username matches national_id:
  UPDATE users SET username = '1000000001'
  WHERE username = 'patient.test';
  -- NOTE: this breaks the login for patient.test/PatientPass123! — the new credentials are:
  -- username: 1000000001 / password: PatientPass123!
  -- Update the sprint-3c-ui-overhaul.md seed credentials table after doing this.

If you'd rather keep patient.test as a stable login for testing, skip the username update and just
leave national_id filled in the patients table — the username mismatch only matters for self-login.

─────────────────────────────────────────
TASK 3 — Seed doctor_availability for dr.fahad
─────────────────────────────────────────

Get dr.fahad's doctor_id:
  SELECT doctor_id FROM doctors WHERE full_name ILIKE '%fahad%' OR full_name ILIKE '%فهد%' LIMIT 1;

Insert working hours (Saudi work week: Sunday=0 through Thursday=4, 8 AM – 10 PM, 30-min slots):

  INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, slot_minutes)
  VALUES
    ('<doctor_id>', 0, '08:00', '22:00', 30),
    ('<doctor_id>', 1, '08:00', '22:00', 30),
    ('<doctor_id>', 2, '08:00', '22:00', 30),
    ('<doctor_id>', 3, '08:00', '22:00', 30),
    ('<doctor_id>', 4, '08:00', '22:00', 30)
  ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

Replace <doctor_id> with the UUID from the SELECT above.
Verify: SELECT * FROM doctor_availability WHERE doctor_id = '<doctor_id>';

─────────────────────────────────────────
TASK 4 — Verify key endpoints with curl
─────────────────────────────────────────

Start the backend first: cd src/backend && npm run dev
Then test (adjust the JWT cookie value after a real login — or test the login endpoint first):

  # Login as dr.fahad to get a session cookie
  curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"dr.fahad","password":"DoctorPass123!"}'

  # GET /doctors — should return the active doctor list
  curl -b cookies.txt http://localhost:5000/api/doctors

  # GET /doctors/:doctorId/availability
  curl -b cookies.txt http://localhost:5000/api/doctors/<doctor_id>/availability

  # GET /patients?q=fahad — admin only, test with admin.test session
  curl -c admin-cookies.txt -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin.test","password":"AdminPass123!"}'
  curl -b admin-cookies.txt "http://localhost:5000/api/patients?q=fahad"

  # GET /appointments with from/to bounds
  curl -b cookies.txt "http://localhost:5000/api/appointments?from=2026-07-01T00:00:00Z&to=2026-07-31T23:59:59Z"

For each endpoint: confirm it returns 200 with the expected shape. Flag any 500s.

─────────────────────────────────────────
TASK 5 — SOAP fields smoke test
─────────────────────────────────────────

POST a medical record with SOAP fields as dr.fahad:

  curl -b cookies.txt -X POST http://localhost:5000/api/records \
    -H "Content-Type: application/json" \
    -d '{
      "patient_id": "<Fahad_Al-Otaibi_patient_id>",
      "chief_complaint": "Headache for 3 days",
      "objective": "BP 130/85, Temp 37.2C, alert and oriented",
      "assessment": "Tension headache, likely stress-related",
      "plan": "Paracetamol 500mg PRN, follow up in 1 week if persists",
      "vital_signs": {"bp": "130/85", "temp": "37.2", "weight": "78"},
      "visit_type": "consultation",
      "diagnosis": "Tension headache",
      "prescription": "Paracetamol 500mg"
    }'

Confirm: 201 response with the new record including all SOAP fields.

─────────────────────────────────────────
TASK 6 — Security gate before finishing
─────────────────────────────────────────

Confirm:
  - No raw SQL string interpolation found in any controller (all queries use $1/$2 parameters)
  - No new route bypasses the requireAuth middleware
  - audit_log has entries for any actions performed during testing

Run: grep -r "db.query(" src/backend/src/controllers/ | grep -v "\$[0-9]"
  If any match shows a query without parameterized values, flag it as a bug.

─────────────────────────────────────────
IMPORTANT NOTES
─────────────────────────────────────────
- If schema-additions.sql fails on any statement, read the error carefully.
  Most likely cause: column already exists (safe to ignore) OR a CHECK constraint conflict.
  Do NOT drop and recreate tables.
- The app DB user is pdms_app. Never use postgres in application code.
- After Task 2, if you changed patient.test's username, update the seed credentials table
  in docs/psm2/sprint-3c-ui-overhaul.md to reflect the new login username.
```
