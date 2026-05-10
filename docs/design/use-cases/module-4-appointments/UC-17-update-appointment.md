---
tags: [fyp, use-case, UC-17, appointments]
module: Module 4 — Appointment Scheduling
uc_id: UC-17
actor: Admin
status: draft
---

# UC-17: Update Appointment

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-17 |
| Use Case Name | Update Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. The appointment exists with `status = 'scheduled'`. |
| Main Flow | 1. Admin navigates to the appointment list. 2. Admin locates the appointment and clicks "Edit". 3. System displays the current appointment details in an editable form: date/time, doctor selector, notes. 4. Admin makes changes and submits. 5. React sends `PUT /api/appointments/:id` with the updated fields. 6. Express validates JWT role = 'admin'. 7. Express runs a scheduling conflict check for the new date/time/doctor combination, excluding the current appointment. 8. If no conflict, Express updates the appointment row. 9. Express writes an audit log entry. 10. System confirms the update. |
| Alternative Flow | If the appointment's `status` is not 'scheduled' (e.g., already 'completed'), Express returns HTTP 409 — completed appointments cannot be edited. If a scheduling conflict exists at the new slot, Express returns HTTP 409. |
| Postcondition | Appointment details are updated. Audit log entry exists. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Update Appointment. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/appointments/:id)` | `PostgreSQL (appointments / audit_log)`. Sequence:
> 1. Admin → React: Edits appointment form, submits new date/time or doctor
> 2. React → Express: `PUT /api/appointments/:id { scheduledAt, doctorId, notes }` (with JWT)
> 3. Express → Express: Validate JWT role = 'admin'
> 4. Express → PostgreSQL: Check current status: `SELECT status FROM appointments WHERE appointment_id = $1`
> 5. [alt status != 'scheduled'] Express → React: HTTP 409 "Cannot edit a completed appointment"
> 6. Express → PostgreSQL: Conflict check: `SELECT appointment_id FROM appointments WHERE doctor_id=$1 AND scheduled_at=$2 AND status='scheduled' AND appointment_id != $3`
> 7. [alt conflict] Express → React: HTTP 409 `{ conflictingAppointmentId }`
> 8. Express → PostgreSQL: `UPDATE appointments SET scheduled_at=$1, doctor_id=$2, notes=$3 WHERE appointment_id=$4`
> 9. Express → PostgreSQL: `INSERT INTO audit_log (action='UPDATE_APPOINTMENT', ...)`
> 10. Express → React: HTTP 200 `{ message: 'Appointment updated' }`
> 11. React → Admin: Updated appointment row displayed

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-20 | Only an authenticated Admin shall be able to update appointment details via `PUT /api/appointments/:id`. | High |
| FR-20a | The system shall prevent editing of appointments with `status != 'scheduled'`; only pending appointments may be modified. | High |
| FR-20b | The conflict check shall exclude the appointment being updated (allow updating to the same slot). | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-39 | Appointment update shall complete within 2 seconds. | Performance | ≤ 2000 ms |
| NFR-40 | Conflict check and update shall execute in the same serialisable transaction. | Reliability | Serialisable isolation |
