# Design — Vercel Demo Build (companion artifact, never merged to `main`)

Status: **Approved, not yet implemented.** Implementation lives on the branch
`demo/vercel-do-not-merge` and must never reach `main`. See "Merge guards" below — this is a
hard constraint, not a preference.

## Why this exists

The AWS stack is deliberately torn down to a zero-cost state, so there is nothing running to
show or to test against. That blocks four things at once:

1. **UAT with three participants** — the only fully unexecuted Sprint 5 deliverable, and the
   input Chapter 5 says will "form the main part" of the PSM2 report. Currently it requires
   every participant to clone the repo and run Postgres locally, which is why it has not
   happened.
2. **Chapter 5 §5.3 figures** — eight screenshot placeholders awaiting a running instance.
3. **A live viva demonstration**, rather than describing a system that is switched off.
4. **A portfolio link.**

A hosted build addresses all four. It is a *companion artifact*, not a replacement for the AWS
deployment — see "What this deliberately does not demonstrate".

## Scope

A single branch deploying to two Vercel projects backed by two Neon Postgres databases:

| Project | Purpose | Data lifecycle | URL |
| --- | --- | --- | --- |
| `pdms-demo` | Public portfolio, viva demonstration | Auto-reset nightly | Public |
| `pdms-uat` | UAT participants | Manual reset between sessions | Unlisted |

Both deploy from the same branch and the same build; they differ only by environment variables
and database. Two deployments rather than one because the requirements genuinely conflict: UAT
needs participant data to persist through a session, while a public unattended link needs
regular resets to stay presentable and resist accumulated junk.

**Explicitly not in scope:** any change to the AWS deployment path, Terraform, the Dockerfile,
or `deploy.yml`; real SMS or WhatsApp delivery; file upload/download; per-visitor data
isolation.

---

## What this deliberately does not demonstrate

Stated plainly because it matters for how the artifact is presented in the report and at the
viva. The Vercel build exercises the **application layer only**: authentication, four-role
RBAC, PostgreSQL row-level security, the bilingual interface, and the clinical, billing and
queue workflows.

It does **not** demonstrate the thesis's infrastructure contribution — VPC isolation, NACLs,
security groups, KMS encryption at rest, CloudTrail, the DevSecOps pipeline, or the recovery
objective. Those are most of Chapters 4 and 5.

The report should therefore describe it as: *"the system as evaluated runs on AWS as described
in Chapter 4; a reduced demonstration build is additionally hosted at <URL> for convenience."*
Presenting a Vercel link while the report describes a three-tier AWS VPC, without saying so,
would be a gap an examiner is entitled to press on.

Row-level security is the one security property that **does** survive the move intact, because
it is a PostgreSQL feature rather than an AWS one. This is worth preserving carefully: a demo
that quietly dropped RLS would misrepresent the project's central claim.

---

## Architecture

### Topology

Each Vercel project is a single origin:

```
https://<project>.vercel.app/          → React static build (Vite output)
https://<project>.vercel.app/api/*     → Express app as a serverless function
                                        → Neon PostgreSQL (pooled endpoint)
```

Single origin is a requirement, not a convenience. The session cookie is `httpOnly` with
`SameSite=Strict`. Splitting the front end and API across origins would force `SameSite=None`,
weakening the cross-site protection the design specifically chose. Keeping one origin means the
cookie configuration needs no change at all.

### Serverless entry point

`api/index.js` (additive, new file) imports the Express app from `src/backend/src/app.js` and
exports it as the handler. This works because `app.js` already exports the app and `server.js`
separately calls `listen()` — the separation serverless requires already exists.

**Connection pooling.** Serverless invocations must not each open a fresh pool, or Neon's
connection limit is exhausted on cold starts. The entry point caches the pool on the module
scope (which persists across warm invocations) and Neon's *pooled* endpoint is used.

Neon's pooler runs in transaction mode. This is compatible with the RLS design — but only
because `withTransaction` wraps every query in an explicit `BEGIN`/`COMMIT`, which pins the
server connection for the transaction's duration, so `set_config(..., true)` applies correctly.
A session-mode assumption would be wrong here. This is a load-bearing detail and must not be
"simplified" later by removing the transaction wrapper.

---

## Changes to production code

Three guarded changes: two configuration modules (`database.js`, `upload.js`) and the OTP
response path. Each is guarded so that **absent environment variables mean current behaviour**.
The new variables are absent on AWS, so the AWS path executes exactly the same lines it does
today. The fail-safe direction is deliberate: missing configuration yields production
semantics, never demo semantics.

Of the three, only the `upload.js` change is unconditionally required — the other two are
inert without their environment variables.

### 1. `src/backend/src/config/database.js` — TLS mode

Neon requires TLS but presents a publicly-trusted certificate, whereas RDS chains to a private
AWS root and needs the bundled CA file.

Add an optional `DB_SSL_MODE`. When set to `standard`, use `{ rejectUnauthorized: true }`
without a custom CA. When unset, the existing `DB_SSL` branch runs unchanged.

**No implicit fallback.** If the RDS bundle is missing the code must still fail rather than
silently downgrading to a different trust configuration — a silent TLS weakening is exactly the
class of defect this project exists to avoid.

### 2. `src/backend/src/middleware/upload.js` — upload directory

This change is mandatory regardless of demo mode. The module calls `fs.mkdirSync` at require
time against a path inside the application bundle, which is read-only on Vercel. The backend
would crash at startup before serving any request.

Read the directory from `UPLOAD_DIR`, defaulting to the current path. On Vercel it points at
`/tmp`, which is writable but ephemeral — acceptable because upload endpoints are disabled in
demo mode anyway (below).

### 3. OTP surfacing under `DEMO_MODE`

`sendOtp` is **already a stub** — no SMS provider is wired up; it logs and returns
`{ delivered: false, stub: true }`. This is a pre-existing documented decision, not something
this work introduces.

The problem for a hosted demo is that logs are not visible to a participant, and the OTP is
stored hashed so it cannot be read back afterwards. Surfacing must therefore happen at
generation.

When `DEMO_MODE=true`, the OTP request response includes the code, and the interface displays
it behind a demo banner. Everything else about the OTP is untouched: generation, hashing,
attempt counting, and expiry all run exactly as in production, so UAT still exercises UC-19 and
UC-20 properly. Only the delivery channel is substituted.

### Disabled in demo mode

- **File upload and download** (2 endpoints: invoice, lab result). Vercel's filesystem is
  ephemeral, and object storage is out of scope. These return an explicit "unavailable in the
  demonstration build" response rather than a 500. Note the consequence: uploading a scanned
  document and retrieving it is not demonstrable. Structured lab results and the generated
  bilingual invoice are unaffected, as neither involves an upload.
- **WhatsApp appointment reminders.** No change needed — `whatsapp.js` already checks for
  Twilio credentials and returns early when absent, and never throws.

---

## Data

### Schema

`schema.sql` is applied to each Neon database. One adjustment: the file creates the `pdms_app`
role with a randomly generated password and prints it as a notice, which is unworkable for an
automated deploy. The seed procedure creates the role explicitly with a known password supplied
from the environment, then applies the remainder of the schema unchanged.

The RLS policies apply identically. This must be verified after seeding rather than assumed —
see Testing.

### Seed data

`scripts/seed-demo.js` (additive) creates a plausible but unmistakably synthetic clinic: a few
doctors across departments, roughly twenty patients, appointments, walk-in visits, invoices,
and released lab results, sufficient for every dashboard to look populated rather than empty.

**All data is obviously fictional.** Invented names, reserved-range phone numbers, and
non-valid national identifiers. No real patient data ever enters this system — it is a public
deployment of a patient-records application, and that constraint is absolute.

### Reset

- **Public instance:** a reset endpoint, guarded by a shared secret, truncates and re-seeds.
  Invoked nightly by Vercel Cron.
- **UAT instance:** the same endpoint, invoked manually between sessions. Never scheduled, so a
  participant's session cannot be wiped mid-task.

---

## Safety for a public patient-records demonstration

1. A persistent banner on every screen identifying the build as a demonstration with synthetic
   data.
2. Demo credentials displayed on the login page. Concealing them protects nothing and makes the
   demo useless to a visitor.
3. `noindex` so the deployment does not surface in search results.
4. Never branded to imply it is Alamin Polyclinic's live system.
5. Existing rate limiting carries over unchanged.

---

## Merge guards

The branch must never reach `main`. Four layers, deliberately mechanical rather than advisory,
because a comment is only as good as the attention of whoever reads it next — human or agent.

1. **Branch name** — `demo/vercel-do-not-merge`.
2. **`DO-NOT-MERGE.md`** at the repository root *on that branch*, stating what the branch is,
   why it exists, and why it must not be merged.
3. **A `CLAUDE.md` entry on `main`** recording the branch's existence and status. This is the
   file coding agents read before working in this repository, so it is the guard most likely to
   be seen.
4. **A CI guard on `main`** that fails if `vercel.json`, `api/index.js`, or `DO-NOT-MERGE.md`
   appear there. If the branch is merged despite the first three layers, the build fails
   immediately with an explicit message rather than silently shipping demo configuration into
   the production path.

A corresponding entry is also written to project memory, so future assistant sessions do not
independently decide the branches should be reconciled.

**If the demo needs a fix that belongs in the real system** — a genuine application bug found
during UAT, for instance — the fix is made on `main` first and the branch rebased onto it.
Never the reverse.

---

## Testing

1. **The existing 206 tests must pass unchanged on the branch.** They are the regression net
   and already cover authentication, the RBAC matrix, and RLS. Any modification to them is a
   signal that a guard has leaked into production behaviour.
2. **New tests asserting the production default.** For both guarded modules, a test that with
   the new environment variables absent the production path is selected — the invariant this
   entire design rests on.
3. **RLS verified against Neon.** The live isolation suite is re-pointed at the Neon database
   and must pass there. Row-level security surviving the move is an assumption until it is
   executed, and it is the project's central security claim.
4. **A UAT dry run** performed personally before inviting participants, following the existing
   protocol, to confirm every task in the script is completable on the hosted build.

---

## Risks

| Risk | Handling |
| --- | --- |
| Demo concerns leak into production behaviour | Every change guarded and defaulted to production; asserted by test; the AWS deploy path untouched |
| Branch drifts from `main` over the remaining project timeline | Rebase onto `main` before each UAT session; fixes flow `main` → branch only |
| Neon's pooler breaks RLS session variables | Transaction-mode pooling with explicit `BEGIN`/`COMMIT` is correct; verified by running the isolation suite against Neon |
| Someone merges the branch | Four guards, one of them a failing CI check |
| A viewer mistakes the demo for a real clinic system | Banner, synthetic data, no clinic branding, `noindex` |
| UAT results reflect a build that differs from the thesis artifact | Only the two guarded differences exist, both documented here and reported in Chapter 5 alongside the UAT results |

---

## Open questions for the implementer

- Whether the UAT instance should be genuinely access-controlled (a shared password) rather
  than merely unlisted. Unlisted is the current assumption.
- Whether the nightly reset time should avoid a fixed hour that might coincide with a
  demonstration.
