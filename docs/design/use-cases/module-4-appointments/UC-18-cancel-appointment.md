---
tags: [fyp, use-case, UC-18, appointments]
module: Module 4 — Appointment Scheduling
uc_id: UC-18
actor: Admin
status: draft
---

# UC-18: Cancel Appointment

## Use Case Description

| Field | Description |
|-------|-------------|
| Use Case ID | UC-18 |
| Use Case Name | Cancel Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. The appointment exists with `status = 'scheduled'`. |
| Main Flow | 1. Admin locates the appointment in the appointments list. 2. Admin clicks "Cancel Appointment". 3. System displays a confirmation dialog: "Cancel appointment for [patient name] on [date]?" 4. Admin confirms. 5. React sends `PATCH /api/appointments/:id/cancel`. 6. Express validates JWT role = 'admin'. 7. Express verifies the appointment's current `status = 'scheduled'`. 8. Express sets `appointments.status = 'cancelled'`. 9. Express writes an audit log entry with the admin's user ID, appointment ID, and cancellation timestamp. 10. System confirms the cancellation. |
| Alternative Flow | If the appointment is already cancelled or completed, Express returns HTTP 409 with the current status. |
| Postcondition | Appointment `status = 'cancelled'`. The record is not deleted — it remains for audit purposes. The time slot is freed for rebooking. |

---

## Sequence Diagram

> 📎 **ATTACH:** Sequence Diagram: Cancel Appointment. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/appointments/:id/cancel)` | `PostgreSQL (appointments / audit_log)`. Sequence:
> 1. Admin → React: Clicks Cancel, confirms dialog
> 2. React → Express: `PATCH /api/appointments/:id/cancel` (with JWT)
> 3. Express → Express: Validate JWT role = 'admin'
> 4. Express → PostgreSQL: `SELECT status FROM appointments WHERE appointment_id = $1`
> 5. [alt status != 'scheduled'] Express → React: HTTP 409 "Appointment is already [status]"
> 6. Express → PostgreSQL: `UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1`
> 7. Express → PostgreSQL: `INSERT INTO audit_log (action='CANCEL_APPOINTMENT', record_id=appointment_id, user_id=admin_id, ...)`
> 8. Express → React: HTTP 200 `{ message: 'Appointment cancelled' }`
> 9. React → Admin: Appointment row shows "Cancelled" status; greyed out in list

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-21 | Only an authenticated Admin shall be able to cancel appointments via `PATCH /api/appointments/:id/cancel`. | High |
| FR-21a | Cancellation shall set `status = 'cancelled'`; it shall not delete the appointment record. | High |
| FR-21b | Only appointments with `status = 'scheduled'` may be cancelled; attempting to cancel a completed or already-cancelled appointment shall return HTTP 409. | High |
| FR-21c | All cancellation events shall be recorded in the `audit_log`. | Medium |

---

## Non-Functional Requirements

| ID | Requirement | Category | Measure |
|----|-------------|----------|---------|
| NFR-41 | Cancellation shall complete within 1 second. | Performance | ≤ 1000 ms |
| NFR-42 | Cancelled appointment records shall be retained for a minimum of 12 months for audit and compliance purposes. | Auditability | Retention ≥ 12 months |
