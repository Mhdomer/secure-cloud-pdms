---
tags: [fyp, use-case, UC-16, appointments]
module: Module 4 — Appointment Scheduling
uc_id: UC-16
actor: Patient
status: draft
---

# UC-16: View Own Appointments (Patient)

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-16 |
| Use Case Name | View Own Appointments |
| Actor | Patient |
| Precondition | Patient is authenticated. |
| Main Flow | 1. Patient navigates to "My Appointments" on the Patient Portal. 2. React sends `GET /api/appointments?patientId=<current_patient_id>`. 3. Express validates JWT role = 'patient' and enforces that the `patientId` query parameter matches the JWT's `patient_id` claim. 4. Express queries `appointments` for rows where `patient_id = current_patient_id` and `status = 'scheduled'`, ordered by `scheduled_at ASC`. 5. System returns the list. 6. React renders the appointments list with date, time, and doctor name. No edit or cancel controls are present — Patient view is read-only. |
| Alternative Flow | If no upcoming appointments exist, React displays "No upcoming appointments." |
| Postcondition | Patient views only their own upcoming appointments. No other patient's appointment data is visible. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Patient Views Appointments. Participants: `Patient (Browser)` | `React Frontend` | `Express API (/api/appointments)` | `PostgreSQL (appointments)`. Sequence:
> 1. Patient → React: Navigates to My Appointments
> 2. React → Express: `GET /api/appointments?patientId=X` (with JWT)
> 3. Express → Express: Validate JWT role = 'patient'; verify patientId = JWT.patient_id
> 4. Express → PostgreSQL: `SELECT a.scheduled_at, a.status, d.firstName AS doctorFirstName, d.lastName AS doctorLastName FROM appointments a JOIN doctors d ON a.doctor_id = d.doctor_id WHERE a.patient_id = $1 AND a.status = 'scheduled' ORDER BY a.scheduled_at ASC`
> 5. PostgreSQL → Express: Array of appointment rows (with doctor names)
> 6. Express → React: HTTP 200 `[ { scheduledAt, status, doctorName }, ... ]`
> 7. React → Patient: Renders read-only appointments list (no edit/cancel buttons visible)

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-19 | A Patient shall be able to view only their own upcoming appointments; querying another patient's appointments shall return HTTP 403. | High |
| FR-19a | The Patient appointments view shall be strictly read-only; no create, update, or cancel actions shall be available to the Patient role. | High |
| FR-19b | The appointment list shall display the doctor's name and the appointment date and time. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-37 | Appointments list shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-38 | Patient query parameter must match JWT claim — enforced server-side to prevent IDOR (Insecure Direct Object Reference). | Security | Server-side JWT claim validation |
