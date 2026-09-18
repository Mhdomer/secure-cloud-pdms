# Hosted demonstration build — deployment record (2026-09-19)

**Live:** https://alamin-clinic.vercel.app
**Branch:** `demo/vercel-do-not-merge` (never merged — see `DO-NOT-MERGE.md`)
**Database:** Neon Postgres 18.6, project `pdms-demo`, region `ap-southeast-1`

Design: `docs/superpowers/specs/2026-09-18-vercel-demo-build-design.md`
Plan: `docs/superpowers/plans/2026-09-18-vercel-demo-build.md`

## Demo accounts

All use the password `DemoPass123!`. Public by design — they appear on the
login page so a visitor can sign in.

| Username | Role |
| --- | --- |
| `demo.superadmin` | Superadmin |
| `demo.staff` | Staff / reception |
| `demo.doctor` | Doctor |
| `demo.patient` | Patient (Sara Al-Qahtani) |

Seed contents: 6 users, 3 doctors, 20 patients, 9 medical records, 6 lab
results (4 released), 24 appointments, 10 visits, 4 visit invoices, 8 invoice
items, 2 payments, 4 sick leaves, 5 patient invoices. All invented names,
reserved-range phone numbers, `DEMO`-prefixed identifiers.

Reset with `node scripts/reset-demo.js`. Deliberately manual — see that file's
header for why it is neither an endpoint nor a scheduled job.

## Verification performed

### Row-level security survives the move to a managed provider

The full isolation suite was run against Neon, not merely against local
Postgres: **75/75 passing**, covering cross-tenant isolation on all eleven
protected tables, `WITH CHECK` enforcement, the `SECURITY DEFINER`
double-booking helpers, and the empty-string UUID guard.

The mechanism differs from AWS and this is worth stating in the report. On AWS
the helpers are owned by a superuser, which bypasses RLS. On Neon they are
owned by `neondb_owner`, which Neon grants the `BYPASSRLS` attribute —
verified directly (`rolbypassrls = true`). In both environments the
application role has `BYPASSRLS = false`, so the policies genuinely bind.
Different route, same guarantee.

### Isolation demonstrated end-to-end on the live deployment

Signed in as `demo.patient` over HTTPS with a browser-shaped request, then
requested another patient's data through an endpoint the patient role **is**
permitted to call:

| Request | Result |
| --- | --- |
| `GET /api/sick-leaves/patient/<own id>` | 200, her own certificate and diagnosis |
| `GET /api/sick-leaves/patient/<another patient's id>` | **200, `{"sickLeaves":[]}`** |
| `GET /api/patients/<any id>` | 403 — route not open to the patient role |

The second row is the important one. The route allowed it, the controller
accepted the identifier, and the database returned nothing. That is the
database layer acting alone, on the same table that carried the Sprint 5
CRITICAL IDOR — before that fix, this request returned another patient's
diagnosis.

The third row is the application layer refusing outright. Both layers are
demonstrable in a single session, which makes this a better artefact for the
viva than any screenshot.

### Session cookie

`HttpOnly; Secure; SameSite=Strict`, confirmed on the live response. Single
origin means the cookie configuration required no change from production.

## Known differences from the AWS deployment

State these rather than let an examiner find them.

| | AWS | Demo |
| --- | --- | --- |
| Postgres | 15 (RDS) | 18.6 (Neon) |
| File upload / download | Works | **Refused with 503** — ephemeral filesystem |
| OTP delivery | Stub provider | Code shown on screen under `DEMO_MODE` |
| WhatsApp reminders | Twilio when configured | Skipped (no credentials) |
| Infrastructure | VPC, NACLs, security groups, KMS, CloudTrail, ALB | None of it |

The last row matters most: the demonstration exercises the **application
layer only**. It does not evidence the infrastructure contribution that
Chapters 4 and 5 are largely about. Describe it as a companion artefact —
*"the system as evaluated runs on AWS as described in Chapter 4; a reduced
demonstration build is additionally hosted at <URL>."*

## Defects found only by deploying

Three, none of which any review or test caught, all found by running the thing:

1. **`NODE_ENV=production` made `npm install` skip devDependencies**, so the
   frontend build had no `vite` and exited 127. The plan's review had assessed
   the install/build pair as sound — and it was, until the environment it runs
   in omits half the packages. Fixed with `--include=dev`.
2. **CORS rejected every browser request with 403** because
   `CLOUDFRONT_ORIGIN` had been set to placeholder text. The initial smoke
   test passed because `curl` sends no `Origin` header, and the validator
   deliberately allows origin-less requests — so the one check that was broken
   was the one the test skipped. A reminder that a smoke test which avoids the
   failure mode proves nothing.
3. **`CLOUDFRONT_ORIGIN` was missing from the deployment checklist entirely.**
   It is required at module load, so its absence returns 500 on every route
   with no hint in the logs. Found by the final code review, before it could
   waste an afternoon.

This is the same pattern as the Minimal AMI missing the SSM agent and the KMS
key policy in Sprint 4: configuration that is syntactically valid, passes
static analysis, and does not work. Worth one paragraph in Chapter 5.

## Operating notes

- Neon scales to zero when idle, so the first request after a quiet period
  takes a few seconds. Load the URL a minute before a demonstration.
- Deployments are made with `vercel deploy --prod` from a local checkout of
  the branch, because the dashboard's production-branch selector would not
  accept the branch. GitHub-triggered builds of this branch also run.
- Environment variables live in `src/backend/.env.vercel.local` (gitignored)
  and are mirrored into the Vercel project for Production and Preview.
- The Vercel project is still named `secure-cloud-pdms`; `alamin-clinic.vercel.app`
  was attached to it as an additional domain. The project's original
  `secure-cloud-pdms.vercel.app` address still resolves but now returns
  `{"error":"Origin not allowed"}` on every API call, because
  `corsValidator.js` allows exactly one origin by exact string match and that
  origin is the new domain. Only one URL can be live at a time — share the
  alamin-clinic one and nothing else.
- `vercel domains inspect` reports "You don't have access to the domain" for
  `.vercel.app` subdomains even when the project owns them. It is not a
  reliable ownership check; hitting the API and recognising the app's own
  response is.
