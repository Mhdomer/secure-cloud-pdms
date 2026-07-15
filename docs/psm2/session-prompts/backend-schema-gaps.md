# Session Prompt — Backend: Apply Schema Gap Fixes

Paste this entire block into a new Claude Code chat session.

---

```
You are working on the backend of a clinic PDMS (Alamin Clinic, Jeddah).
Node.js / Express / PostgreSQL. The app DB user is `pdms_app` (least-privilege — RLS enforced).

Before doing anything, read:
  - src/backend/src/config/schema.sql          ← current schema
  - docs/psm2/schema-additions.sql             ← the additions to apply
  - src/backend/src/config/constants.js        ← ROLES and other constants

## Your tasks in order:

### 1. Apply schema additions to the live local DB
Run the SQL in docs/psm2/schema-additions.sql against the local PostgreSQL database.
Connection: host=localhost port=5432 dbname=pdms user=postgres password=2013
Confirm each ALTER TABLE and CREATE TABLE succeeded.

### 2. Update schema.sql to include the new columns/tables
Merge the additions from docs/psm2/schema-additions.sql into src/backend/src/config/schema.sql
so the file stays the single source of truth. Do not duplicate — integrate cleanly.

### 3. Update the patients controller/routes to accept new fields

**Key principle: UUID is internal plumbing. Staff never types or sees a UUID.**
- national_id / iqama / passport is the user-facing patient identifier
- Staff registers a patient by entering their national ID first
- System checks if that national_id already exists before creating a new record
- URLs use UUID (/patients/:uuid) internally — staff navigates via search, not URLs

File: src/backend/src/controllers/patientsController.js (or wherever patient create/update lives)

New fields to accept in POST /patients:
  - national_id (required), id_type (national_id | iqama | passport)
  - blood_type (A+/A-/B+/B-/AB+/AB-/O+/O-)
  - allergies (free text)
  - nationality, address
  - emergency_contact_name, emergency_contact_phone
  - insurance_provider, insurance_number

GET /patients?q=<search> should search across:
  - national_id (exact match — primary search method)
  - full_name (ILIKE %term%)
  - contact_number (starts-with)
Return matches as a list. Staff clicks the correct patient to navigate to their profile.

Add input validation for blood_type and id_type enums.
national_id uniqueness error: "A patient with this ID number is already registered"
Show the existing patient's name in the error so staff can navigate to them directly.

### 3b. Doctor assignment — never via UUID input
When staff assigns a doctor to a patient, the flow is:
  GET /doctors → returns [{ doctor_id, full_name, specialisation, is_active }]
  The frontend shows this as a dropdown. Staff picks a name. Frontend sends doctor_id.

Ensure GET /doctors exists and returns only is_active=true doctors.
The doctor_id in the assign request is a UUID — but that UUID comes from the dropdown
selection, never from a staff member typing it manually.

### 4. Update the medical records controller to accept SOAP fields
File: src/backend/src/controllers/recordsController.js (or similar)
New fields to accept in POST /records:
  - chief_complaint (required)
  - objective (optional)
  - assessment (optional — replaces free-text diagnosis for the narrative)
  - plan (optional)
  - vital_signs (optional JSONB: { bp, temp, weight, height })
  - visit_type (consultation | follow_up | emergency | checkup)
  - diagnosis stays as a short summary line (required)

### 5. Update appointments controller for new status + cancellation
File: src/backend/src/controllers/appointmentsController.js (or similar)
- PATCH /appointments/:id/confirm → sets status to 'confirmed' (staff or doctor only)
- PATCH /appointments/:id/cancel → sets status to 'cancelled', records cancelled_by (user_id from JWT) and optional cancellation_note
- Validate duration_minutes is a positive integer when creating appointments

### 6. Add doctor_availability routes
Create routes and controller for doctor availability:
  GET    /doctors/:doctorId/availability         → list availability for a doctor
  POST   /doctors/:doctorId/availability         → create/update availability slot (superadmin or the doctor themselves)
  DELETE /doctors/:doctorId/availability/:dayOfWeek → remove a day slot

Add a utility function: isSlotAvailable(doctorId, scheduledAt, durationMinutes) → boolean
  Uses doctor_availability to check if the requested time falls within working hours
  Uses appointments table to check for overlapping booked slots
  Call this before inserting any new appointment.

### 7. Run security gate before finishing
At the end, confirm:
  - No raw SQL string interpolation (use parameterized queries everywhere)
  - No new route bypasses the existing auth middleware
  - audit_log INSERT is called for: patient create, patient update, record create, appointment cancel
```
