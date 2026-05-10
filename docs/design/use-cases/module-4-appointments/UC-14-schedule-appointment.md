---
tags: [fyp, use-case, UC-14, appointments]
module: Module 4 — Appointment Scheduling
uc_id: UC-14
actor: Admin
status: draft
---

# UC-14: Schedule Appointment

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-14 |
| Use Case Name | Schedule Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. Patient and target doctor both exist and are active. |
| Main Flow | 1. Admin navigates to "Appointments" and clicks "New Appointment". 2. System displays the scheduling form: patient selector, doctor selector, date picker, time slot selector, and optional notes. 3. Admin completes the form and submits. 4. React sends `POST /api/appointments` with the payload. 5. Express validates JWT role = 'admin' and validates all required fields. 6. Express queries the `appointments` table to check for scheduling conflicts: any `status = 'scheduled'` appointment for the same doctor at the same date and time. 7. If no conflict, Express inserts the new appointment row with `status = 'scheduled'` and `created_by = admin_user_id`. 8. Express writes an audit log entry. 9. System confirms successful scheduling. |
| Alternative Flow | If a scheduling conflict is detected, Express returns HTTP 409 Conflict with the conflicting appointment details. The form remains open for the admin to choose a different slot. |
| Postcondition | Appointment exists in the `appointments` table. It is visible to the relevant doctor (UC-15) and patient (UC-16). |

---

## Sequence Diagram

> 📎 **ATTACH:** `Figure 4.14` — Sequence Diagram: Schedule Appointment. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/appointments)` | `PostgreSQL (appointments / audit_log)`. Sequence:
> 1. Admin → React: Fills appointment form (patient, doctor, date/time), submits
> 2. React → Express: `POST /api/appointments { patientId, doctorId, scheduledAt, notes }` (with JWT)
> 3. Express → Express: Validate JWT role = 'admin'; validate required fields
> 4. Express → PostgreSQL: `SELECT appointment_id FROM appointments WHERE doctor_id=$1 AND scheduled_at=$2 AND status='scheduled'` (conflict check)
> 5. PostgreSQL → Express: null (no conflict) or existing row
> 6. [alt conflict] Express → React: HTTP 409 `{ conflictingAppointmentId, scheduledAt }`
> 7. Express → PostgreSQL: `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status='scheduled', notes, created_by=admin_id)`
> 8. Express → PostgreSQL: `INSERT INTO audit_log (action='SCHEDULE_APPOINTMENT', ...)`
> 9. Express → React: HTTP 201 `{ appointmentId, scheduledAt }`
> 10. React → Admin: "Appointment scheduled" confirmation

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-16 | Only an authenticated Admin shall be able to create appointments via `POST /api/appointments`. | High |
| FR-17 | The system shall detect scheduling conflicts (same doctor, same date/time, status = 'scheduled') and return HTTP 409 before creating a conflicting appointment. | High |
| FR-16a | The `created_by` field shall be set from the server-side JWT admin ID, not from the client request body. | High |
| FR-16b | All new appointments shall have initial `status = 'scheduled'`. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-33 | Appointment scheduling shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-34 | The conflict check and appointment insert shall execute within a single serialisable transaction to prevent race conditions when two admins schedule simultaneously. | Reliability | Serialisable transaction isolation |
