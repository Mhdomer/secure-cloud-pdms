# RLS Policy Guidelines — the empty-string UUID gotcha

## Incident (2026-07-20)

Every admin/superadmin request touching `visits`, `visit_invoices`,
`invoice_items`, or `patient_care_team` returned `500 Internal server error`.
Backend logs showed:

```
error: invalid input syntax for type uuid: ""
```

**Root cause:** [`config/database.js`](../../src/backend/src/config/database.js)'s
`withTransaction()` sets RLS session variables via `set_config(...)` for
*every* request, regardless of role:

```js
await client.query('SELECT set_config($1, $2, true)', ['app.current_doctor_id', session.doctorId || '']);
await client.query('SELECT set_config($1, $2, true)', ['app.current_patient_id', session.patientId || '']);
```

An admin/superadmin session has neither a `doctorId` nor a `patientId`, so
both GUCs get set to `''` (empty string) — never `NULL`. The RLS policies
added on `visits`/`visit_invoices`/`invoice_items`/`patient_care_team` cast
that value straight to `uuid`:

```sql
-- BROKEN
patient_id = current_setting('app.current_patient_id', true)::uuid
```

`''::uuid` always throws in Postgres. It does **not** get short-circuited by
the surrounding `AND current_setting('app.current_role', true) = 'patient'`
— Postgres evaluates `current_setting(...)` as a stable-function init-plan
up front, before any per-row boolean short-circuiting happens. So the cast
blows up even for roles the clause was never meant to apply to.

The pre-existing policies on `medical_records`, `patients`, and
`lab_results` already handled this correctly with a `NULLIF` guard — the
newer policies (added when RLS was extended to the billing/visits tables)
just missed it.

**How it actually got introduced:** a prior Claude Code session added these
policies while fixing an unrelated security audit finding (HIGH-03: "missing
RLS on billing/visit tables" from a Gemini-generated review). It wrote the
11 new policies from scratch and verified they applied cleanly (`CREATE
POLICY` succeeded, `pg_policies` showed them, `ENABLE ROW LEVEL SECURITY`
worked) — but never actually exercised an admin-role request against the
newly-protected tables, and never grepped the same file for how the
existing `medical_records`/`patients`/`lab_results` policies handled this
exact session variable. The `NULLIF` guard was sitting less than 500 lines
above in the same file. "It applied without error" and "it works" are
different claims — DDL succeeding says nothing about whether the policy is
semantically correct for every role. **The general lesson: when extending a
file that already has an established pattern for the kind of thing you're
adding — RLS policies, validation middleware, error handling, whatever —
grep for the existing instances and mirror them before writing new logic,
even (especially) when you're heads-down fixing a flagged issue under time
pressure. Don't just confirm the new code runs; exercise it as the specific
role/case most likely to break (here: admin, the one role with every
`app.current_*_id` GUC unset).**

## The rule

**Any RLS policy that casts an `app.current_*_id` session variable to
`uuid` MUST guard it with `NULLIF(..., '')` first:**

```sql
-- CORRECT
patient_id = NULLIF(current_setting('app.current_patient_id', true), '')::uuid
```

`NULLIF('', '')` → `NULL`, and `NULL::uuid` → `NULL` (no error). A `NULL`
comparison just evaluates to unknown/false, which is exactly the desired
behavior for a session that doesn't have that ID set.

This applies to **every** `app.current_user_id`, `app.current_doctor_id`,
and `app.current_patient_id` cast in [`schema.sql`](../../src/backend/src/config/schema.sql)
— not just the four tables above. If a future sprint adds RLS to another
table (e.g. `appointments`, `audit_log`), copy the `NULLIF(...)::uuid`
pattern, not a bare `::uuid` cast.

## Before adding a new RLS policy

1. Grep `schema.sql` for an existing policy on a similar table and copy its
   cast style — don't write `current_setting(...)::uuid` from scratch.
2. Add `DROP POLICY IF EXISTS <name> ON <table>;` before every
   `CREATE POLICY` so the block stays safely re-runnable.
3. Sanity-check with a throwaway query before trusting the policy:
   ```sql
   SELECT NULLIF('', '')::uuid;              -- must return NULL, not error
   ```
4. Test the endpoint as **admin/superadmin** specifically, not just as the
   role the policy targets — admin sessions have every `app.current_*_id`
   GUC unset (`''`), so they're the case most likely to trip this.

## If this happens again on a live dev database

Editing `schema.sql` alone does **not** fix an already-running database —
policies are DB objects, not re-applied automatically. Reconnect as the
migration superuser (`MIGRATION_DB_USER`/`MIGRATION_DB_PASSWORD` in `.env`)
and re-run the corrected `DROP POLICY IF EXISTS` / `CREATE POLICY`
statements directly, e.g. via a throwaway Node script using the `pg`
package already in `src/backend/node_modules`. `psql` is not on PATH in
this dev environment.
