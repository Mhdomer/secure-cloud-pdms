# RLS extended to `appointments` and `patient_invoices` (2026-09-15)

## Why

Chapter 4 §4.4.3 originally scoped row-level security to `patients` and
`medical_records`. It grew from there — `lab_results`, `visits`,
`visit_invoices`, `invoice_items`, `invoice_payments`, `patient_care_team`,
and (after the Sprint 5 CRITICAL) `sick_leaves`. That left 9 of 19 tables
protected and two tables holding patient data with no database-layer defence
at all:

| Table | What it holds | Guarded by |
|---|---|---|
| `appointments` | patient_id, doctor_id, scheduled times, notes | `authorizeRole` + hand-written ownership checks |
| `patient_invoices` | billing documents and consent forms per patient | `authorizeRole` + one ownership check in `downloadInvoice` |

Those application-layer checks were audited and found **correct** — all six
`Appointment.findById` call sites either verify ownership explicitly or are
admin-only. This change was not a bug fix. It was about the gap between what
the report claims and what the database enforces:

> RBAC enforced at two layers: JWT middleware (application) + PostgreSQL
> row-level security (database)

For these two tables that was one layer, and the code said so in its own
comments — `appointmentsController.js` carried "appointments has no RLS, so
this is the entire access boundary" in six places, and
`invoicesController.js` described its ownership check as "the only thing
standing between a patient session and someone else's invoice."

One layer is exactly how `sick_leaves` shipped exploitable in Sprint 5.

The other eight RLS-free tables were left alone deliberately:
`otp_verifications` and `password_setup_tokens` are pre-authentication and
keyed by the secret itself; `users`, `doctors`, `departments`,
`clinic_services`, `doctor_availability` and `audit_log` are staff/reference
data rather than per-patient records.

## The trap this had to avoid

Self-booking (UC-20) and patient reschedule (UC-21b) run their
double-booking checks **inside the patient's own transaction**. The moment
`appointments` became RLS-protected, those checks could no longer see other
patients' rows — so:

1. Patient A asks to book Dr. B at 11:00.
2. `findConflict` queries `appointments`. RLS correctly hides Patient C's
   existing 11:00 booking, because it belongs to someone else.
3. The check finds nothing, reports the slot free, and the booking succeeds.
4. Dr. B is now double-booked, and nothing in the system noticed.

RLS would have converted a security improvement into a correctness bug, and
it would have been invisible: no error, no log line, just two patients in one
slot. `isSlotAvailable`'s overlap query had the identical problem.

## The fix: two SECURITY DEFINER helpers

`appointment_conflict_id()` and `doctor_slot_taken()`, defined in
`schema.sql`. Both run as their owner (the superuser that applies the schema)
and therefore bypass RLS, but they are deliberately narrow:

- They take a doctor, a timestamp, a duration and an optional exclusion.
- They return a `uuid` and a `boolean` respectively — never a `patient_id`,
  a name, or a reason.
- `SET search_path = public, pg_temp` is mandatory, not cosmetic: without it
  a caller could prepend their own schema and hijack the unqualified table
  reference inside a definer-rights function.
- `EXECUTE` is revoked from `PUBLIC` and granted only to `pdms_app`.

The security property this buys is worth stating plainly: **a patient learns
that a slot is taken, never who holds it.** That is strictly less disclosure
than the pre-RLS behaviour, where the conflict query read the raw table.

`Appointment.findConflict` and `isSlotAvailable` now call these helpers
instead of reading `appointments` directly.

## Policies added

`appointments` (grants are SELECT/INSERT/UPDATE — no DELETE, so no DELETE
policy):

| Policy | Role | Effect |
|---|---|---|
| `admin_all_appointments` | admin, superadmin | Full access — reception schedules clinic-wide, and superadmin's health panel counts today's appointments |
| `doctor_select_appointments` | doctor | Own clinic list only — mirrors `Appointment.listForDoctor` |
| `doctor_update_appointments` | doctor | Confirm/complete their own |
| `patient_select_appointments` | patient | Own appointments only |
| `patient_insert_appointments` | patient | Self-booking, pinned to their own `patient_id` by `WITH CHECK` |
| `patient_update_appointments` | patient | Reschedule/cancel their own; `WITH CHECK` blocks reassigning the row to another patient |

`patient_invoices` (grants are SELECT/INSERT only — files are immutable once
uploaded):

| Policy | Role | Effect |
|---|---|---|
| `admin_all_patient_invoices` | admin, superadmin | Full access |
| `doctor_select_patient_invoices` | doctor | Clinic-wide read |
| `patient_select_own_invoices` | patient | Own documents only |

### One deliberate non-change

`doctor_select_patient_invoices` grants doctors clinic-wide read rather than
scoping them to their own patients. That **mirrors existing behaviour** —
`downloadInvoice` already let any doctor fetch any invoice, and only the
patient branch was ownership-checked. Narrowing it would be a behaviour
change smuggled in under a security fix. It is a legitimate
minimum-necessary tightening and is left as a flagged follow-up, not done
quietly here.

## The NULLIF rule, again

Every `app.current_*_id` cast in the new policies is `NULLIF(..., '')`
guarded, per `rls-policy-guidelines.md`. An admin session has neither a
`doctorId` nor a `patientId`, so both arrive as `''`, and Postgres evaluates
`current_setting()` as an init-plan before per-row short-circuiting — a bare
`''::UUID` throws for *every* role, not just the one the clause targets.

No policy here references another RLS-protected table. That is deliberate:
`patients.doctor_select_assigned` already subqueries `appointments`, so a
policy pointing back would be mutual recursion and Postgres would abort with
"infinite recursion detected in policy".

## Verification

`src/backend/src/__tests__/rls-isolation.test.js`, against a live PostgreSQL
as the unprivileged `pdms_app` role:

- Cross-tenant isolation on both new tables, including by-id lookups — the
  IDOR shape.
- `WITH CHECK` enforcement: a patient cannot book in another patient's name,
  and cannot reassign an appointment to them.
- Double-booking protection: a patient provably cannot see another patient's
  appointment row, and both helpers still detect the clash.
- Non-disclosure: the helper returns only an id, and holding that id still
  yields nothing from the table.
- The real `Appointment.findConflict` and `isSlotAvailable` modules driven
  under a patient session — so a refactor back to a direct table read fails
  the suite rather than production.
- The NULLIF guard: an admin session, and a session with every GUC empty,
  can query all 11 protected tables without a `22P02` cast error.

The suite seeds and asserts inside one transaction that is rolled back, so
the dev database is left byte-identical (verified: zero leftover rows).

## Applying to a running database

Editing `schema.sql` does not change a live database — policies are DB
objects. Re-run the block as the migration superuser, as
`rls-policy-guidelines.md` describes. Applied to the local dev DB on
2026-09-15; **not yet applied to RDS**, which is currently torn down and will
pick it up on the next `terraform apply` + schema load.
