# Sprint 4 — Summary
## DevSecOps Pipeline: GitHub Actions + CloudWatch + CloudTrail

---

## What Was Implemented

Built via the `orchestrator` agent per CLAUDE.md's Sprint 4 scope. Spawned `cloud-fortress` twice
(pre-build checklist from chapter-4 §4.3.6/§4.3.8.6, then a post-build audit of the actual files),
`code-griller` once (pipeline-logic review — race conditions, failure handling, trigger events), fixed
every finding, then ran the checkov/trivy security gates before committing.

CloudTrail was already complete from Sprint 2 (`infrastructure/terraform/modules/cloudtrail`); this
sprint's CloudWatch work is the alarm/dashboard wiring that module's own comments already flagged as
deferred to Sprint 4 ("alarms wired in Sprint 4").

---

## GitHub Actions Pipeline

Three workflow files, implementing the 6-stage design from chapter-4 §4.3.6:

| File | Trigger | Purpose |
|---|---|---|
| `.github/workflows/security-scan.yml` | `workflow_call` (reusable) | Stages 2-5: SonarQube SAST, Docker build, Trivy image scan, Checkov IaC scan |
| `.github/workflows/ci.yml` | `pull_request` → `main` | Calls security-scan.yml. Never deploys. |
| `.github/workflows/deploy.yml` | `push` → `main` | Calls security-scan.yml, then `terraform-apply` gated on `needs: scan` |

Both `ci.yml` and `deploy.yml` call the same reusable `security-scan.yml` so the two can never drift
out of sync — deploy can't skip a scan just because it wasn't triggered by a reviewed PR.

Every scan step is a hard gate (no `continue-on-error: true` anywhere):
- **SonarQube** — `sonarqube-scan-action` + `sonarqube-quality-gate-action`, fails the job on a
  non-OK quality gate (covers hardcoded-secret and SQL-injection rule sets per chapter-3 §3.4.5).
  Config: `sonar-project.properties` (repo root).
- **Trivy** — builds the backend image locally (`load: true`, never pushed anywhere), scans it with
  `severity: CRITICAL` + `exit-code: '1'`, matching CLAUDE.md's documented gate exactly.
- **Checkov** — `soft_fail: false` against `infrastructure/terraform`, no severity filter, matching
  this project's existing convention of managing accepted exceptions via inline
  `# checkov:skip=...` comments in the `.tf` files rather than a CI severity threshold.

`deploy.yml`'s `terraform-apply` job runs `terraform init/validate/plan/apply` against
`infrastructure/terraform` using OIDC AWS credentials (`role-to-assume`, no long-lived keys), with
Terraform's no-default input variables (`kms_key_administrator_arns`, `acm_certificate_arn`,
`ec2_ami_id`) supplied as `TF_VAR_*` from GitHub secrets rather than a committed tfvars file — exactly
what `terraform.tfvars.example` already noted was coming in Sprint 4. `concurrency: group: deploy-main`
serializes the whole workflow (scan + apply together) so two rapid merges can't interleave applies;
combined with the existing S3+DynamoDB state lock (`backend.tf`), double-protected against concurrent
state corruption.

**Deliberately out of scope:** pushing the built image to a registry (ECR) and rolling it out to the
EC2 Auto Scaling Group via SSM. Chapter-3/chapter-5's Sprint 4 scope is the CI/CD pipeline plus
CloudWatch and CloudTrail, not container registry provisioning — this is documented as a follow-up in
`.github/workflows/README.md`, not silently implied as done.

**Not verified live**: no AWS account, no Terraform CLI, and no Docker daemon were available in this
environment, so the `terraform-apply` and `container-scan` jobs could not be run end-to-end here. The
YAML was reviewed by `cloud-fortress` (secrets hygiene, gating correctness, trigger events — all PASS)
and `code-griller` (race conditions, failure-handling semantics, trigger-event edge cases), and the
CLAUDE.md-mandated local gates (`checkov`, `trivy fs`) both ran clean against the actual source. One
`code-griller` finding was fixed before commit: `ci.yml`'s `pull_request` trigger was missing the
`edited` event type, which would leave a PR stuck if its base branch were retargeted to `main`.

---

## CloudWatch Monitoring — `infrastructure/terraform/modules/monitoring`

New module, thresholds taken verbatim from chapter-4 §4.3.8.6:

| Alarm | Threshold | Mechanism |
|---|---|---|
| Failed logins | ≥5 in 5 minutes | Metric filter on a new app log group, pattern `{ $.event = "LOGIN_FAILED" }` |
| ALB 5xx rate | >1% (a rate, not a raw count) | Metric-math alarm: `IF(m2 > 0, (m1/m2)*100, 0)` over `HTTPCode_Target_5XX_Count` / `RequestCount`, divide-by-zero guarded |
| RDS CPU | >80% for 5 minutes | `AWS/RDS` `CPUUtilization`, dimension `DBInstanceIdentifier` |

All three notify the SNS topic already provisioned by `modules/cloudtrail` (`aws_sns_topic.trail`) —
no second topic was created. A `aws_cloudwatch_dashboard` ties all three metrics together plus a
CloudTrail log-delivery-volume widget, satisfying chapter-3's "CloudWatch dashboard configuration"
Sprint 4 deliverable.

**Blocking gap found and fixed**: `src/backend/src/controllers/authController.js` only logged a
structured line via `logger.warn` on account lockout (3rd failed attempt), never on an individual
failed login — the `audit_log` Postgres table got a row on every attempt, but that's invisible to a
CloudWatch Logs metric filter (only stdout is shipped to CloudWatch). Without this fix the failed-login
alarm's metric filter would never have anything to match. Added `logger.warn('Failed login attempt',
{ event: 'LOGIN_FAILED', ipAddress[, userId] })` to both failure branches (unknown/inactive user, and
wrong password including the lockout path) — never the username or password, per `logger.js`'s
existing no-PHI-in-logs constraint. `code-griller` confirmed this doesn't introduce a timing
side-channel or change the response path.

**IAM tightening found and fixed during `code-griller` review**: the EC2 instance role originally
granted `logs:CreateLogGroup` on the app log-group ARN pattern. Since the new log group is now
exclusively Terraform-managed, an instance that somehow wrote a log line before the `monitoring` module
had been applied could auto-create the group and collide with a later `terraform apply`
(`ResourceAlreadyExistsException`, group exists outside state). Removed `logs:CreateLogGroup` from
`modules/ec2/main.tf`'s IAM policy — the role now only has `CreateLogStream`/`PutLogEvents`, a
least-privilege reduction with no functional loss (Terraform always creates the group as part of the
same `apply` that provisions the EC2 module).

Also added: `alb_arn_suffix` / `target_group_arn_suffix` outputs to `modules/alb` (the CloudWatch
`AWS/ApplicationELB` metric dimensions need the short ARN suffix, not the full ARN) and wired
`module "monitoring"` into the root `main.tf`/`outputs.tf`.

---

## Security Gate

```
checkov -d infrastructure/terraform --framework terraform
  → Passed checks: 326, Failed checks: 0, Skipped checks: 25 (all pre-existing, documented via
    inline # checkov:skip comments — same convention Sprint 2 established, no new skips added)

trivy fs src/backend --severity CRITICAL
  → 0 vulnerabilities, 0 secrets (package-lock.json)
```

Both gates ran clean with zero findings — no exceptions needed for this sprint's changes.

---

## Files changed

- `.github/workflows/security-scan.yml`, `ci.yml`, `deploy.yml` (new), `README.md` (updated)
- `sonar-project.properties` (new)
- `infrastructure/terraform/modules/monitoring/main.tf`, `variables.tf`, `outputs.tf` (new)
- `infrastructure/terraform/modules/alb/outputs.tf` (arn_suffix outputs)
- `infrastructure/terraform/modules/ec2/main.tf` (removed `logs:CreateLogGroup`)
- `infrastructure/terraform/main.tf`, `outputs.tf` (wired `module "monitoring"`)
- `infrastructure/terraform/README.md` (module list, status line)
- `src/backend/src/controllers/authController.js` (structured failed-login log line)

## Known gap carried forward (not this sprint's scope)

`.gitignore` already notes `src/backend/uploads/` as "dev local storage — Sprint 4 moves this to S3."
That migration was not done here — chapter-3/chapter-5 define Sprint 4 as the CI/CD pipeline plus
CloudWatch/CloudTrail, not file-storage migration, and pulling that in would have been unrelated scope
expansion. Flagged here so it isn't silently lost track of; candidate for Sprint 5 or a dedicated pass.

CLAUDE.md's Sprint Plan table was intentionally left untouched by this sprint's commits — the working
tree already had an uncommitted edit marking Sprint 4 "In progress" from a prior session, and per
explicit instruction that file was left alone rather than folding a further edit into someone else's
pending change. The line still needs a manual one-word update (`In progress` → `Complete`) alongside
whatever else is pending in that file.
