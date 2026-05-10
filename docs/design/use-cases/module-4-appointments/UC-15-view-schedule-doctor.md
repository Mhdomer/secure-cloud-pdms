---
tags: [fyp, use-case, UC-15, appointments]
module: Module 4 — Appointment Scheduling
uc_id: UC-15
actor: Doctor
status: draft
---

# UC-15: View Appointment Schedule (Doctor)

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-15 |
| Use Case Name | View Appointment Schedule |
| Actor | Doctor |
| Precondition | Doctor is authenticated. |
| Main Flow | 1. Doctor navigates to "Appointments" on the Doctor Dashboard. 2. React sends `GET /api/appointments?doctorId=<current_doctor_id>`. 3. Express validates JWT role = 'doctor' and enforces that the `doctorId` query parameter matches the JWT's `doctor_id` claim (a doctor cannot query another doctor's schedule). 4. Express queries `appointments` for rows where `doctor_id = current_doctor_id` and `status = 'scheduled'`, ordered by `scheduled_at ASC`. 5. System returns the list. 6. React renders the appointment table with date, time, patient name, and status. |
| Alternative Flow | If no upcoming appointments exist, the system returns an empty array and React displays "No upcoming appointments." |
| Postcondition | Doctor views only their own upcoming appointments. No other doctor's schedule is visible. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: View Doctor Appointment Schedule. Participants: `Doctor (Browser)` | `React Frontend` | `Express API (/api/appointments)` | `PostgreSQL (appointments)`. Sequence:
> 1. Doctor → React: Navigates to Appointments tab
> 2. React → Express: `GET /api/appointments?doctorId=X` (with JWT)
> 3. Express → Express: Validate JWT role = 'doctor'; verify query doctorId = JWT.doctor_id
> 4. Express → PostgreSQL: `SELECT a.*, p.firstName, p.lastName FROM appointments a JOIN patients p ON a.patient_id = p.patient_id WHERE a.doctor_id = $1 AND a.status = 'scheduled' ORDER BY a.scheduled_at ASC`
> 5. PostgreSQL → Express: Array of appointment rows
> 6. Express → React: HTTP 200 `[ { appointmentId, scheduledAt, patientName, status }, ... ]`
> 7. React → Doctor: Renders appointment table

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-18 | A Doctor shall be able to view their own upcoming appointments only; the system shall prevent querying another doctor's schedule. | High |
| FR-18a | The appointment list shall include patient name and appointment date/time. | Medium |
| FR-18b | Completed and cancelled appointments shall be excluded from the default view; a separate "History" filter may show them. | Low |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-35 | Appointment list retrieval shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-36 | Doctor query parameter must match JWT claim — enforced server-side to prevent IDOR. | Security | Server-side claim validation |
