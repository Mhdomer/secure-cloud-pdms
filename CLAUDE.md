# CLAUDE.md — Secure Cloud PDMS (PSM2 Implementation)

## Project Overview
Secure Cloud-Based Patient Data Management System for Alamin Clinic (Saudi Arabia).
Motivated by a real ransomware attack on the clinic's on-premise server.
PSM1 (analysis & design) is complete and submitted. This repo is now in PSM2 — implementation.

Student: Mohamed Omar Makhlouf | A23CS4014 | SECRH, UTM
Supervisor: Dr. Johan Mohamad Sharif

---

## Architecture (3-Tier on AWS)

```
Internet → ALB (public subnet)
         → EC2/Node.js (private app subnet)
         → RDS/PostgreSQL (private DB subnet)

All in a single VPC across 2 Availability Zones (6 subnets total)
```

Full design specs: `docs/report/chapter-4-requirement-design.md`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React → built to static, deployed to S3 + CloudFront |
| Backend | Node.js / Express on EC2 (Docker container) |
| Database | PostgreSQL on Amazon RDS (row-level security enabled) |
| IaC | Terraform (HashiCorp HCL) |
| CI/CD | GitHub Actions (6-stage pipeline) |
| Auth | JWT + RBAC (3 roles: Doctor, Admin, Patient) |
| Scanning | Trivy (containers), SonarQube (SAST), Checkov (IaC) |
| Monitoring | CloudWatch + CloudTrail |
| Compliance | AWS Security Hub (HIPAA standard) |
| Encryption | KMS (AES-256 at rest), TLS/HTTPS in transit |

---

## Repository Structure

```
src/
  backend/          Node.js/Express API
  frontend/         React app
infrastructure/
  terraform/        All AWS infrastructure as code
.github/
  workflows/        GitHub Actions CI/CD pipeline
docs/
  report/           Chapter files (PSM1 design — read-only reference)
  psm1-submission/  Submitted PSM1 report and signed forms
  references/       Research materials and stakeholder letters
scripts/
  figures/          Python scripts that generated report diagrams
```

---

## Sprint Plan (PSM2)

| Sprint | Scope | Status |
|---|---|---|
| Sprint 1 | Requirements & design | Complete (PSM1) |
| Sprint 2 | Terraform: VPC, subnets, SGs, NACLs, RDS, KMS | Complete |
| Sprint 3a | Backend: Node.js/Express API, JWT auth, two-layer RBAC (middleware + PostgreSQL RLS) | Complete |
| Sprint 3b | Frontend: React app, RBAC-aware UI, English/Arabic RTL localization | Complete |
| Sprint 3c | UI visual overhaul (screen-by-screen, see `docs/psm2/sprint-3c-ui-overhaul.md`) + patient self-registration/self-booking (see `docs/psm2/self-registration-design.md`) | **Complete** — all 17 screens done + major feature additions (glassmorphism, billing engine, clinical tools, queue system); i18n gate passed 2026-07-26 (1,305 keys across 11 namespaces, 0 diffs, tsc 0 errors) |
| Sprint 4 | DevSecOps: GitHub Actions pipeline + CloudWatch + CloudTrail | **Complete** — full pipeline (OIDC deploy role, security-scan/ci/deploy workflows, all 5 GitHub secrets, `production` environment required-reviewer rule) live-verified end-to-end via a real `terraform apply` on 2026-07-28 (110/110 resources, 0 drift); infra torn down afterward to stop free-tier cost, redeployable on demand — see `docs/psm2/sprints/sprint-4-summary.md`. Not covered by this sprint: HTTPS (`enable_https` deliberately `false` pending a domain). ECR/SSM rollout and frontend hosting, both originally tracked separately here, were built as a follow-up — see the References entry below |
| Sprint 5 | Security evaluation: scans, RTO test, Security Hub, UAT | **In progress** — coverage check, Checkov (399/0/46), Trivy (filesystem + a real CI-built container image, 0 vulnerabilities both), and a real CI-triggered SonarQube run (clean on security/reliability/maintainability/duplication/hotspots; fails only on new-code test coverage, since this repo has no automated test suite yet) all done; white-box + local black-box pentest found and fixed 1 CRITICAL cross-tenant IDOR (`sick_leaves` had no RLS) plus 4 smaller findings, CRITICAL fix live-verified against real fixture data; HIPAA §164.312 posture assessed against the IaC design (a proxy, not a live score) — see `docs/psm2/sprints/sprint-5-security-evaluation.md`. Not done: the RTO test, a live AWS Security Hub HIPAA posture score, and UAT with 3+ human participants all remain as ready-to-execute plans (`docs/psm2/sprints/sprint-5-rto-test-plan.md`, `sprint-5-security-hub-plan.md`, `sprint-5-uat-plan.md`) pending a live-AWS-spend or human-coordination decision — infra stays torn down from Sprint 4 until that's given |

Each sprint has a security gate that must pass before the next sprint starts.
Sprint details: `docs/report/chapter-5-conclusion.md` Section 5.3

---

## Security Gates (Non-Negotiable)

Before committing any Terraform:
```bash
checkov -d infrastructure/terraform --framework terraform
# Must report zero CRITICAL findings
```

Before pushing any Docker image:
```bash
trivy fs src/backend --severity CRITICAL
# Must report zero CRITICAL CVEs
```

**Never commit:**
- Hardcoded credentials or API keys
- `.env` files
- `*.tfvars` files
- `*.tfstate` or `*.tfstate.backup`
- AWS Access Key IDs or Secret Access Keys

Before committing any change to `src/backend/src/config/schema.sql` that adds
or edits an RLS policy: every `app.current_user_id` / `app.current_doctor_id`
/ `app.current_patient_id` cast to `::uuid` MUST be guarded with
`NULLIF(..., '')` first, or admin/superadmin sessions 500 on that table
(empty-string session GUC → invalid uuid cast). See
`docs/psm2/rls-policy-guidelines.md` — this already broke local dev once.

---

## User Roles & Permissions

| Role | Can Access |
|---|---|
| Doctor | Own patients' medical records + appointments |
| Admin | Patient registration + appointment scheduling (no clinical data) |
| Patient | Own records and appointments only (read-only) |

RBAC enforced at two layers: JWT middleware (application) + PostgreSQL row-level security (database).

---

## Key Design Decisions (from PSM1)

- VPC CIDR: 10.0.0.0/16, 6 subnets across 2 AZs
- RDS: never publicly accessible, KMS-encrypted, automated backups on
- ALB: only internet-facing entry point, HTTPS only (temporarily overridden to HTTP-only via `enable_https = false` — no domain/ACM cert registered yet, pending presentation budget / stakeholder go-no-go; see `infrastructure/terraform/variables.tf`'s `enable_https` comment and `docs/psm2/sprints/sprint-4-summary.md`. Must flip back to `true` before this system ever holds real patient data.)
- EC2: private subnet, no direct internet access (outbound via NAT Gateway)
- CloudTrail: all API calls logged, 90-day retention
- RTO target: ≤ 15 minutes (full Terraform redeployment from wipe)

---

## Autonomous Sprint Orchestration

To start any sprint, run `/sprint-start` — it will ask which sprint and spawn the `orchestrator` agent.

The orchestrator handles everything autonomously in this order for each sprint:
- Reads CLAUDE.md + design specs
- Plans tasks with TodoWrite
- Spawns the correct sub-agents (see below)
- Runs security gates between steps
- Commits only when all gates pass

**Do not manually direct sub-agents — let the orchestrator do it.**

### Agent Roster

| Agent | Role | Auto-used in |
|---|---|---|
| `orchestrator` | Master sprint driver — spawns all others | Every sprint via `/sprint-start` |
| `frontend-designer` | React UI, RTL, Thmanyah font, Arabic/English toggle | Sprint 3b, 3c |
| `cloud-fortress` | AWS VPC audits, IAM, pipeline YAML security | Sprint 2, 4 |
| `code-griller` | Brutal code review — bugs, race conditions, edge cases | Sprint 3a, 3b, 3c, 4, 5 |
| `terraform-reviewer` | HIPAA-specific Terraform checks | Sprint 2 |
| `api-designer` | Full route spec from design docs before coding | Sprint 3a |
| `psm2-checker` | Coverage check — code vs design requirements | Sprint 3a, 5 |

### Skill Roster

| Skill | Auto-used in |
|---|---|
| `/security-gate` | Every sprint before commit |
| `/rtl-check` | Sprint 3b after each component; Sprint 3c after each rebuilt screen |
| `/i18n-check` | Sprint 3b after all pages |
| `/font-audit` | Sprint 3b after font setup |
| `/ui-review` | Sprint 3b after each page; Sprint 3c after each rebuilt screen |
| `/grill-me` | Sprint 5 final check |
| `/sprint-end` | Every sprint after gates pass |

---

## Git Commit Rules

- Max 3 commits per day
- Human-style messages — no AI attribution, no "Co-authored-by"
- Never use `git add .` — stage specific files only
- Commit message format: `verb + what changed` (e.g. `provision VPC and subnet configuration`)

---

## Arabic Font — Thmanyah

Custom Arabic font for the polyclinic UI. Files go in:
`src/frontend/public/fonts/thmanyah/` (self-hosted, not CDN — patient data privacy)

Required weights: Regular (400), Medium (500), Bold (700) in .woff2 + .woff format.

If files are not yet available, use **Noto Sans Arabic** from Google Fonts as placeholder.
Claude should swap automatically to Thmanyah once files are present in the fonts directory.

CSS rules when applied:
- font-family: 'Thmanyah', 'Noto Sans Arabic', sans-serif — on [lang="ar"] selector only
- line-height: 1.7 minimum for Arabic (Arabic script is taller than Latin)
- letter-spacing: 0 always for Arabic — never use letter-spacing with Arabic script
- font-size: bump Arabic body text to 17–18px (Arabic at 16px looks visually smaller than English)

Apply font family switch as part of the same language toggle that sets dir="rtl" — both must change together.

---

## References

- Full design: `docs/report/chapter-4-requirement-design.md`
- Methodology & sprint plan: `docs/report/chapter-3-methodology.md`
- NFRs (including RTO ≤15min, 99.9% uptime): Chapter 3 Section 3.5.2
- Functional requirements: Chapter 3 Section 3.5.1
- Workflow guide for Claude sessions: `claude-sessions/psm2-workflow.md`
- Sprint 3c UI overhaul plan + screen-by-screen status: `docs/psm2/sprint-3c-ui-overhaul.md`
- Sprint 3c self-registration (OTP) + self-booking design: `docs/psm2/self-registration-design.md`
- Report edits still owed for Sprint 3c work: `docs/psm2/report-delta.md`
- RLS policy gotcha (empty-string UUID cast) + rules for writing new RLS policies: `docs/psm2/rls-policy-guidelines.md`
- Security audit findings fixed 2026-07-24 (per-file changes + workflow, incl. the public-tracker RLS breakage and its fix): `docs/psm2/security-audit-fixes-2026-07-24.md`
- Full-site QA pass 2026-07-24 (billing/invoice bugs incl. stuck partial payments, StrictMode query bug, feature recommendations per role): `docs/psm2/qa-audit-2026-07-24.md`
- QA audit fixes applied 2026-07-24 (invoice_payments ledger, payment locking, cancel/void workflow, per-file changes + live verification): `docs/psm2/qa-fixes-2026-07-24.md`
- Feature additions 2026-07-24 (rooms feature removed, visit status transition trigger, patient appointment reschedule UC-21b): `docs/psm2/feature-additions-2026-07-24.md`
- Forgot-password flow (patient self-service, phone OTP) added 2026-07-25 — design rationale: `docs/superpowers/specs/2026-07-24-forgot-password-design.md`; report delta: `docs/psm2/report-delta.md` DELTA-047; UI tracker: `docs/psm2/sprint-3c-ui-overhaul.md` Screen 18
- Sprint 4 DevSecOps pipeline + GitHub OIDC deploy role + temporary HTTP-only `enable_https` override (2026-07-26): `docs/psm2/sprints/sprint-4-summary.md`
- Backend deploy automation (ECR/SSM rollout) + frontend hosting (S3/CloudFront) + HTTPS-safe API wiring, built as a Sprint 4 follow-up (2026-07-30): `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md`, `docs/psm2/sprints/sprint-5-prep-summary.md`
- Sprint 5 security evaluation (2026-07-31) — scan results, HIPAA §164.312 IaC-level posture, pentest findings/fixes/live-verification, grill-me score: `docs/psm2/sprints/sprint-5-security-evaluation.md`. Ready-to-execute (not yet run) plans for the pieces needing a live-AWS-spend or human-coordination decision: `docs/psm2/sprints/sprint-5-rto-test-plan.md`, `sprint-5-security-hub-plan.md`, `sprint-5-uat-plan.md`
