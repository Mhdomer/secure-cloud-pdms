---
tags: [fyp, use-case, UC-07, patient-management]
module: Module 2 — Patient Registration & Profile Management
uc_id: UC-07
actor: Doctor, Admin
status: draft
---

# UC-07: View Patient Profile

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-07 |
| Use Case Name | View Patient Profile |
| Actor | Doctor, Admin |
| Precondition | Actor is authenticated. For a Doctor: the patient must be assigned to that doctor (`assigned_doctor_id` matches). For Admin: any patient profile is accessible. |
| Main Flow | 1. Actor navigates to the patient list. 2. Actor selects a patient. 3. React sends `GET /api/patients/:id`. 4. Express validates the JWT and determines the actor's role. 5. If the actor is a Doctor, the middleware checks that `patients.assigned_doctor_id = current_user.doctor_id`. If not, HTTP 403 is returned. 6. Express queries the `patients` table for the profile. 7. System returns the patient's demographic information. 8. React renders the patient profile view. |
| Alternative Flow | If the Doctor is not assigned to this patient, Express returns HTTP 403 Forbidden. The patient profile is never returned. |
| Postcondition | Actor views the requested patient's demographic profile. No medical record content is returned by this endpoint — records are retrieved separately via UC-11. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: View Patient Profile. Participants: `Actor (Doctor/Admin)` | `React Frontend` | `Express API (/api/patients/:id)` | `PostgreSQL (patients)`. Sequence:
> 1. Actor → React: Clicks on patient name in list
> 2. React → Express: `GET /api/patients/:id` (with JWT cookie)
> 3. Express → Express: Validate JWT; extract role + userId
> 4. [alt box "Doctor"] Express → PostgreSQL: `SELECT * FROM patients WHERE patient_id = $1 AND assigned_doctor_id = $2`
> 4b. [alt box "Admin"] Express → PostgreSQL: `SELECT * FROM patients WHERE patient_id = $1`
> 5. PostgreSQL → Express: Patient row or null
> 6. [opt: null] Express → React: HTTP 403 Forbidden
> 7. Express → React: HTTP 200 `{ patientId, firstName, lastName, DOB, contactNumber, assignedDoctorId }`
> 8. React → Actor: Renders patient profile card

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-08 | The system shall enforce that a Doctor may only view profiles of patients where `assigned_doctor_id` matches their own `doctor_id`; any other access shall return HTTP 403. | High |
| FR-08a | An Admin may view any patient profile without restriction. | High |
| FR-08b | The patient profile endpoint shall not return medical record content; demographic data only. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-18 | Patient profile retrieval shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-19 | Access control for the Doctor role shall be enforced at the database query level (filtered WHERE clause), not only in application logic. | Security | DB-layer enforcement |
