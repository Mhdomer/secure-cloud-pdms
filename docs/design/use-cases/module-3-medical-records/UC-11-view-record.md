---
tags: [fyp, use-case, UC-11, medical-records]
module: Module 3 — Medical Records Management
uc_id: UC-11
actor: Doctor, Patient
status: draft
---

# UC-11: View Medical Record

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-11 |
| Use Case Name | View Medical Record |
| Actor | Doctor (assigned), Patient (own records only) |
| Precondition | Actor is authenticated. For Doctor: patient is assigned to them. For Patient: the record belongs to them. |
| Main Flow | 1. Actor navigates to the medical records section. 2. Actor selects a specific record. 3. React sends `GET /api/records/:id`. 4. Express validates the JWT and sets the session variable `app.current_user_id` and `app.current_role` on the PostgreSQL connection. 5. PostgreSQL RLS evaluates the row against the active policy: Doctor policy (`doctor_id = app.current_user_id`) or Patient policy (`patient_id = app.current_user_id`). 6. If the policy passes, the row is returned. If not, PostgreSQL returns zero rows (no 403 — the record appears not to exist). 7. Express returns the record data to React. 8. React renders the record detail view. |
| Alternative Flow | If RLS returns zero rows (wrong doctor or wrong patient), Express returns HTTP 404. The actor is not informed whether the record exists but is inaccessible or simply does not exist. |
| Postcondition | Actor sees the record content appropriate to their role. No cross-role data leakage occurs at any layer. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: View Medical Record. Participants: `Actor (Doctor/Patient)` | `React Frontend` | `Express API (/api/records/:id)` | `PostgreSQL RLS (medical_records)`. Sequence:
> 1. Actor → React: Selects record from list
> 2. React → Express: `GET /api/records/:id` (with JWT cookie)
> 3. Express → Express: Validate JWT; extract userId + role
> 4. Express → PostgreSQL: `SET LOCAL app.current_user_id = $1; SET LOCAL app.current_role = $2`
> 5. Express → PostgreSQL: `SELECT * FROM medical_records WHERE record_id = $1`
> 6. PostgreSQL RLS: Evaluates policy for the active role
>    [alt "Doctor"] `WHERE doctor_id = current_setting('app.current_user_id')` → pass or filter
>    [alt "Patient"] `WHERE patient_id = current_setting('app.current_user_id')` → pass or filter
> 7. PostgreSQL → Express: Record row or empty result
> 8. [opt empty] Express → React: HTTP 404 "Record not found"
> 9. Express → React: HTTP 200 `{ recordId, diagnosis, prescription, notes, createdAt, doctorName }`
> 10. React → Actor: Record detail view
> Add annotation: "RLS returns empty — not an error — when policy doesn't match. Actor cannot distinguish 'not found' from 'not authorised'."

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12 | The system shall enforce PostgreSQL RLS such that a Doctor may only retrieve records where `doctor_id` matches their session ID, and a Patient may only retrieve records where `patient_id` matches their session ID. | High |
| FR-12a | When RLS filters out a record, the system shall return HTTP 404, not HTTP 403, to prevent disclosure that the record exists. | Medium |
| FR-12b | Admin role shall have no access to `medical_records` via the API; the Admin API does not expose a records endpoint. | High |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-27 | Record retrieval shall respond within 1 second. | Performance | ≤ 1000 ms |
| NFR-28 | The RLS policy evaluation shall occur at the PostgreSQL layer and shall not be bypassable by modifying the application query. | Security | DB-enforced, app-agnostic |
