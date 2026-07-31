# Sprint 5 — Security Evaluation

Scope per chapter-3 methodology Section 3.3.5 / chapter-5 Section 5.3: automated vulnerability
assessments (Trivy, SonarQube, Checkov), black-box and white-box penetration testing, an RTO stress
test, and an AWS Security Hub HIPAA posture assessment.

**What was actually executed in this session** vs. **what remains a live-AWS or human-coordination
decision**:

| Deliverable | Status |
|---|---|
| Full requirement coverage check (all sprints) | Done — see below |
| Checkov IaC scan | Done — clean |
| Trivy filesystem + container-image scan | Done — clean |
| SonarQube SAST | Done (real CI run, not simulated) — quality gate fails on one non-security metric, see below |
| White-box pentest | Done — 1 CRITICAL + 4 other findings, all fixed and live-verified except 1 documented design decision |
| Black-box pentest (local) | Done — auth/RBAC/JWT/lockout/rate-limit/injection probes against a live local instance |
| HIPAA §164.312 technical-safeguard posture | Done, but explicitly an **IaC-level design proxy**, not a live Security Hub score |
| RTO test | **Not executed** — plan ready at `docs/psm2/sprints/sprint-5-rto-test-plan.md`, needs a live-AWS-spend decision |
| AWS Security Hub live posture score | **Not executed** — plan ready at `docs/psm2/sprints/sprint-5-security-hub-plan.md`, needs the same live-AWS decision |
| UAT (3+ human participants) | **Not executed** — plan ready at `docs/psm2/sprints/sprint-5-uat-plan.md`, needs human coordination (no AWS cost) |

---

## 1. Coverage check across all sprints (psm2-checker)

Full FR-01–FR-12 / NFR-01–NFR-11 table run against the current implementation. Summary: **~95% of
designed requirements implemented and operational.** FR-01 through FR-10 and FR-12 fully implemented.
FR-11 (HTTPS) and NFR-02 (TLS in transit) are the one already-known gap (`enable_https = false`,
tracked in CLAUDE.md's "Key Design Decisions" since Sprint 4, pending a domain/ACM certificate).
NFR-06 (RTO), NFR-07 (HIPAA Security Hub), and NFR-09 (load test) are the three requirements this
sprint's live-AWS items (above) would close out. No previously-undiscovered functional gaps were
found — the PSM2-added FR-13 through FR-46 requirements (spot-checked, not exhaustively) are
extensively implemented (self-registration, walk-in queue, billing, clinical documentation, MFA-free
auth). Full requirement-by-requirement table available in the psm2-checker sub-agent transcript this
session produced; not duplicated here to keep this report navigable — the gap list below is the
actionable subset.

---

## 2. Automated scans

### Checkov — `docs/psm2/reports/checkov-report.txt`

```
checkov -d infrastructure/terraform --framework terraform
Passed checks: 399, Failed checks: 0, Skipped checks: 46
```

Zero failed checks across all 11 modules. Every one of the 46 skips was individually verified
(cloud-fortress read every inline `# checkov:skip` justification against the actual `.tf` source, not
just the report's truncated preview) — none is a bare suppression hiding a real problem. They group
into 10 themes: self-referential log-bucket logging (3), cross-region replication explicitly
out-of-scope for a single-region pilot (6), CloudWatch's 90-day retention vs. Checkov's 1-year default
(5), NACL/SG cross-module attachment false positives (7), genuine AWS API `Resource: "*"` limitations
in IAM (18 — the largest cluster, individually checked for hidden `iam:*`/`sts:*`/credential-read
grants: none found), intentional network design (3), RDS IAM-auth architecture choice (1), CloudFront
hardening deferred on cost/no-domain grounds (9), and the `enable_https = false` cluster (4 — worth
presenting as one line item, not four, since they're all downstream of the same root cause).

### Trivy — `docs/psm2/reports/trivy-report.txt` (filesystem) + live CI (container image)

```
trivy fs src/ --severity CRITICAL,HIGH
backend/package-lock.json: 0 vulnerabilities
frontend/package-lock.json: 0 vulnerabilities
```

Additionally, the real CI run (`Security Gate / Docker Build & Trivy Image Scan`, both PR runs) built
the actual backend Docker image and scanned it — **0 vulnerabilities** in the built image too (Alpine
OS packages + Node dependencies combined), a stronger result than the filesystem-only scan alone
since it covers the OS layer the lockfile scan can't see.

### SonarQube SAST — real CI run, not simulated

Two live runs against `sonar.projectKey=Mhdomer_secure-cloud-pdms` on SonarCloud, triggered via PR #1
(`sprint5-security-evaluation` branch — opened specifically to exercise this gate for real, since
`ci.yml`'s `pull_request` trigger had never actually fired before this sprint despite the pipeline
being live-verified for `deploy.yml` since Sprint 4):

- **Run 1** (docs-only commit, `d8cd7bf`): Quality Gate **PASSED**.
- **Run 2** (this sprint's code fixes, `5236b0a`): Quality Gate **FAILED** — but only on one metric.
  Queried directly via `GET /api/qualitygates/project_status`:

  | Metric | Threshold | Actual | Status |
  |---|---|---|---|
  | New reliability rating | ≤ A | A | OK |
  | New security rating | ≤ A | A | OK |
  | New maintainability rating | ≤ A | A | OK |
  | New duplicated lines density | < 3% | 0.0% | OK |
  | New security hotspots reviewed | 100% | 100.0% | OK |
  | **New code coverage** | **≥ 80%** | **0.0%** | **ERROR** |

  Every security- and quality-relevant metric passed cleanly — **0 new bugs, 0 new vulnerabilities,
  0 duplicated code, every security hotspot reviewed.** The sole failure is test coverage, and it
  fails because **this codebase has no automated test suite at all** (`src/backend/package.json` has
  no `test` script; no coverage report was ever generated or wired into `sonar-project.properties`).
  This is a pre-existing structural gap, not something introduced by this sprint's fixes — it simply
  never surfaced before because Run 1's diff was two `.txt` report files, which SonarQube's
  new-code-coverage gate doesn't apply to. **This is a disclosed, real finding, not a security defect
  disguised as one**: recommending a Jest/Supertest backend suite and a Vitest/RTL frontend suite,
  wired into `security-scan.yml` with a coverage report path added to `sonar-project.properties`, as
  a concrete Sprint 5+ follow-up. Not attempted in this session — bootstrapping a test harness from
  zero is its own multi-day scope, not a fit for the time remaining in this sprint, and chapter-3
  §3.3.5 doesn't list "add a test suite" as this sprint's deliverable.

---

## 3. Penetration testing

### White-box (code-griller, full source review)

Findings, in the order fixed:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **CRITICAL** | `sick_leaves` had zero RLS and no ownership check — any patient could read any other patient's diagnosis by swapping the `patientId` in the URL; any doctor could issue an official sick-leave certificate for a patient they never treated | **Fixed.** Added RLS mirroring the proven `lab_results`/`visits` pattern (`src/backend/src/config/schema.sql`) plus an app-layer ownership check on create (`src/backend/src/controllers/sickLeavesController.js`). **Live-verified** — see below. |
| 2 | HIGH | Patient full name logged via `console.log` in the queue-ticket SMS stub, contradicting this project's own no-PHI-logging convention (ships to CloudWatch, 90-day retention) | **Fixed** — switched to the structured logger with no PHI (`src/backend/src/controllers/visitsController.js`) |
| 3 | HIGH | Doctors can view/download any patient's billing/consent documents, not scoped to assigned/care-team patients like every sibling clinical table | **Not code-changed — documented as an accepted, pre-existing, explicitly-commented design decision** (`schema.sql`'s own comment on `patient_invoices` already states this is intentional, "not scoped per-doctor like lab_results"). Flagged here as a HIPAA "minimum necessary" consideration worth a deliberate, recorded risk-acceptance decision by the project owner rather than an unreviewed silent change to established billing-visibility behavior under sprint time pressure. |
| 4 | MEDIUM | A newly-reassigned doctor's care-team row was never synced, so their medical-history view for that patient stayed silently empty until a second, separate admin action | **Fixed** — `assignDoctor` now also calls `CareTeam.add` in the same transaction, mirroring the pattern `visitsController.create` already uses for walk-ins (`src/backend/src/controllers/patientsController.js`) |
| 5 | MEDIUM | Account lockout after 3 failed attempts is a self-service DoS vector against a guessable username (national ID) | **Documented, not changed** — a genuine design tradeoff (graduated lockout vs. immediate permanent lock) needing a deliberate product decision, not a quick code fix |
| 6 | MEDIUM | Upload MIME/extension check is 100% client-supplied metadata, no content (magic-byte) verification | **Documented, not fixed** — would need a new dependency (`file-type` or equivalent); flagged as a follow-up rather than rushed in under time pressure |
| 7 | MEDIUM | `PATCH /users/me/password` has no dedicated brute-force limiter independent of login lockout | **Documented, not fixed** — flagged as a follow-up |
| 8 | LOW | Forgot-password/QR-setup password policy was weaker (8 chars + 1 digit) than every other password-setting path in the app | **Fixed** — aligned to the same policy (`isStrongPassword`-equivalent regex) used everywhere else (`src/backend/src/controllers/passwordSetupController.js`) |
| 9 | LOW | SMS appointment reminders had no doctor-ownership check, unlike every sibling mutation in the same controller | **Fixed** — added the same `existing.doctor_id !== doctorId` check `confirmAppointment`/`completeAppointment`/`cancelAppointment` already use (`src/backend/src/controllers/appointmentsController.js`) |
| 10 | LOW | Stub SMS provider logged the phone number unconditionally, including in production | **Fixed** — production branch no longer logs the phone number (`src/backend/src/utils/smsProvider.js`) |

Prior audit fixes (timing side-channel mitigation, `NULLIF(...)::uuid` RLS guards, bcrypt cost 12,
CORS single-origin allowlist, cookie flags, JWT-placeholder rejection at boot) were spot-checked and
confirmed still intact — no regressions found.

**Live verification of Finding 1** (the CRITICAL fix), following this project's own established
"exercise the fix as the specific role most likely to break it" discipline
(`docs/psm2/qa-fixes-2026-07-24.md`): two throwaway patient accounts were created against the local
dev database, each assigned to a different doctor.

- Doctor A creates a sick leave for their own assigned patient → `201 Created`.
- Doctor A attempts to create a sick leave for a patient assigned to a *different* doctor →
  **`404 Not Found`** (previously would have succeeded).
- Doctor B (the correctly-assigned doctor) creates a sick leave for their patient, diagnosis text
  deliberately marked `CONFIDENTIAL-PatientB-Diagnosis` → `201 Created`.
- Patient A logs in and fetches their own sick-leave list → correctly sees their own "Flu" record.
- **Patient A substitutes Patient B's UUID in the URL** (`GET /api/sick-leaves/patient/<patientB_id>`)
  → **`{"sickLeaves":[]}`** — empty, not the confidential diagnosis. Before the fix, this exact
  request would have returned Patient B's full record.

All test fixtures (throwaway users, patients, sick-leave rows) were deleted after verification; no
demo/dev accounts referenced in `DEV_CREDENTIALS.md` were left in a different state than found
(`dr.fahad` and the sample patient account's passwords were reset to their documented values, having
been found already stale/rotated at the start of this session — a minor pre-existing documentation
drift, not a security issue).

### Black-box (local, live HTTP against a running instance)

Local PostgreSQL was already running; the backend was started against it
(`node src/server.js`, `localhost:5000`) and probed with `curl` — no AWS infrastructure or cost
involved. Full battery and results:

| Probe | Result |
|---|---|
| Unauthenticated request to a protected route (`GET /api/patients`) | `401` |
| Security response headers (Helmet) | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, COOP/CORP all present |
| SQL injection payload in login username (`admin' OR '1'='1`) | `401` — parameterized queries hold, no bypass, no error leakage |
| RBAC boundary: patient → superadmin-only `/api/users` | `403` |
| RBAC boundary: doctor → superadmin-only `/api/users` | `403` |
| RBAC boundary: patient → staff-only `/api/patients` | `403` |
| Self-scoped access: patient → own `/api/appointments`, `/api/patients/me` | `200` |
| JWT tampering — role claim flipped `patient` → `superadmin`, original signature kept | `401` (signature verification holds) |
| JWT `alg: none` attack — signature stripped entirely | `401` (`algorithms: ['HS256']` is explicitly pinned on verify, closing the classic bypass) |
| Account lockout — 3 wrong-password attempts, then the *correct* password on the 4th try | `401` — locked regardless of correct credentials, same generic error message (no lockout-state leak) |
| Login rate limiting | `RateLimit-Policy: 10;w=900` enforced and observed hitting `0` remaining during testing |
| Cookie flags | `HttpOnly`, `SameSite=Strict`, 15-minute `Max-Age` confirmed on the `Set-Cookie` header |

No finding from this battery required a code change — every control tested as designed. This is a
**local-only** black-box test; it cannot exercise the network/edge layer (ALB, CloudFront, WAF) since
that requires live infrastructure — see the RTO/Security Hub plans for what a live-instance black-box
pass would add (e.g., confirming the CloudFront↔ALB origin-header/prefix-list scoping actually behaves
as designed under a real request).

---

## 4. HIPAA §164.312 technical-safeguard posture — IaC-level design proxy

**This is not a live AWS Security Hub score.** Security Hub evaluates actual deployed resource state;
this is an independent read of the Terraform source plus targeted application code, useful for
catching design-level gaps before anything is ever deployed, but structurally unable to see runtime
drift. See `docs/psm2/sprints/sprint-5-security-hub-plan.md` for the live-assessment runbook.

| Control | Status | Key evidence |
|---|---|---|
| §164.312(a) Access Control | **Met** | RLS + app-layer RBAC, RDS/EBS/SSM encryption via the project KMS CMK, 15-min hard session expiry (`src/backend/src/utils/session.js`) |
| §164.312(b) Audit Controls | **Partially Met** | CloudTrail control-plane logging complete (90-day retention, log-file validation); `audit_log` table is append-only at the DB-grant level (strong tamper-resistance), but whether *every* ePHI-reading route actually calls it wasn't verified from IaC alone — needs an application-code audit pass |
| §164.312(c) Integrity | **Met** | S3 versioning on all 3 project buckets, RDS automated backups, CloudTrail log-file validation, append-only `audit_log`/`invoice_payments` |
| §164.312(d) Person or Entity Authentication | **Partially Met** | Strong JWT engineering (KMS-backed secret, short TTL, httpOnly/SameSite cookie) but **no MFA anywhere in the login path for any role**, including Admin and Doctor accounts with the broadest ePHI access. **Newly surfaced by this review** — not previously tracked in CLAUDE.md. Given this project's own ransomware-driven motivation, this is arguably more actionable than the HTTPS gap, since it isn't blocked on a domain/budget decision. |
| §164.312(e) Transmission Security | **Not Met (known, already-documented gap)** | `enable_https = false` — already tracked in CLAUDE.md. This review's specific contribution: the exposure is narrower than "plaintext ePHI on the public internet" — the ALB only accepts ingress from CloudFront's managed prefix list (not `0.0.0.0/0`), and CloudFront terminates real TLS at the browser edge, so the plaintext leg is specifically CloudFront↔ALB *inside AWS's own private network*. Still a real §164.312(e) violation on paper and the system must not hold real patient data in this state, but a materially different (lower) severity than an internet-facing plaintext claim would be. |

**New recommendation from this sprint**: prioritize MFA for Admin/Doctor logins alongside (not
necessarily after) the HTTPS/domain fix — it doesn't share HTTPS's budget/domain blocker.

---

## 5. Grill-me score

Applying the project's own `/grill-me` rubric (security, correctness, design-vs-chapter-4, RTL/i18n,
performance) to `src/`, synthesizing everything above:

**Score: 8/10 — SHIP IT (with the documented follow-ups below tracked, not silently dropped).**

Reasoning:
- **Security (the dominant weight for a Sprint 5 evaluation)**: the one CRITICAL finding this sprint
  surfaced is fixed and live-verified with concrete before/after evidence, not just re-read as fixed.
  RBAC/RLS boundaries held under active black-box probing (JWT tampering, `alg:none`, IDOR, SQLi
  payload). Checkov and Trivy both clean. SonarQube's security/reliability/maintainability ratings
  all A with zero new bugs or vulnerabilities.
- **Why not 9–10**: two real, unresolved gaps keep this from a higher score — no MFA anywhere in the
  login path (newly surfaced, not yet remediated), and zero automated test coverage (a genuine
  engineering gap, disclosed via the SonarQube quality-gate result rather than hidden). Both are
  documented, neither is a silent omission.
- **Why not below 7**: no CRITICAL or unresolved HIGH finding remains open without either a fix or an
  explicit, reasoned, recorded decision (Finding 3's billing-visibility design choice). The
  RTO/Security Hub/UAT items are legitimately deferred pending a live-AWS-spend or human-coordination
  decision, not gaps in the code itself.

---

## 6. What still needs a human decision

1. **RTO test** — plan ready at `docs/psm2/sprints/sprint-5-rto-test-plan.md`. Requires a live
   `terraform destroy` + `terraform apply` cycle: real AWS spend, briefly re-exposes the account.
2. **AWS Security Hub live HIPAA posture score** — plan ready at
   `docs/psm2/sprints/sprint-5-security-hub-plan.md`. Requires the same live infrastructure as #1
   (ideally run in the same session to share the cost) plus Security Hub's own small ongoing
   per-check cost while enabled.
3. **UAT with 3+ human participants** — plan ready at `docs/psm2/sprints/sprint-5-uat-plan.md`. No
   AWS cost — purely needs the project owner to schedule real people.
4. **MFA for Admin/Doctor accounts** — newly surfaced by this sprint's HIPAA review; a real feature
   addition (TOTP or equivalent), not something to bolt on under a sprint's time pressure without
   dedicated design.
5. **Finding 3** (`patient_invoices` cross-doctor visibility) — needs a recorded risk-acceptance
   decision or a deliberate tightening pass, not a silent code change.
6. **Automated test suite** — the SonarQube coverage-gate finding's real remediation; scoped as its
   own follow-up, not attempted in this session.

This document is committed alongside the code fixes above and the three ready-to-execute plans it
references — nothing here was silently left undone without a next step recorded.
