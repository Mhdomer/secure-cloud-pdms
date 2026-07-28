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

---

## Follow-up (2026-07-26): GitHub Actions OIDC deploy role

Editor diagnostics on `deploy.yml`/`security-scan.yml` surfaced several loose ends from the original
Sprint 4 pass, worked through interactively rather than as a fresh orchestrator run:

- **`environment: production` didn't resolve** — the GitHub Environment referenced by `deploy.yml`
  didn't exist yet. Created via `gh api --method PUT repos/Mhdomer/secure-cloud-pdms/environments/production`.
  The required-reviewer protection rule the workflow comment assumes is **still not configured**
  (`protection_rules: []` on creation) — a manual step in repo Settings → Environments → production,
  not something `gh api`/Terraform did here.
- **`aquasecurity/trivy-action@0.28.0` didn't resolve** — the action's actual release tags are
  `v`-prefixed (confirmed via `gh api repos/aquasecurity/trivy-action/tags`); the pin was missing the
  `v`. Fixed to `@v0.28.0` in `security-scan.yml`. All other action pins in the three workflow files
  were checked against their real tags and were already correct.
- **Every `secrets.*` reference was unresolvable** — `gh secret list` confirmed zero secrets exist on
  the repo yet (`SONAR_TOKEN`, `SONAR_HOST_URL`, `AWS_DEPLOY_ROLE_ARN`,
  `TF_KMS_KEY_ADMINISTRATOR_ARNS`, `TF_ACM_CERTIFICATE_ARN`, `TF_EC2_AMI_ID`). Not fixed here — these
  are credential/ARN values the user sets directly via `gh secret set`, not something to paste into an
  AI conversation.
- **`AWS_DEPLOY_ROLE_ARN` had nothing to point at** — no OIDC identity provider or deploy role existed
  in AWS or in Terraform; `deploy.yml` was written assuming infrastructure that was never provisioned.
  Built `infrastructure/terraform/modules/github-oidc`:
  - `aws_iam_openid_connect_provider` for `token.actions.githubusercontent.com` (no `thumbprint_list`
    — confirmed via the `aws-iam` skill and the `terraform-provider-aws` v5.100.0 docs via Context7
    that AWS validates GitHub's cert chain against its own trusted CAs for this issuer).
  - `aws_iam_role.deploy`, trust policy scoped via `StringEquals` on both
    `token.actions.githubusercontent.com:aud` (`sts.amazonaws.com`) and `:sub`
    (`repo:Mhdomer/secure-cloud-pdms:environment:production` — the environment-claim form GitHub emits
    for jobs that declare an `environment:` key, which `deploy.yml`'s `terraform-apply` job is the only
    one across all three workflow files to do).
  - Permissions scoped to resource-level ARNs everywhere the AWS API supports them (KMS: single key
    ARN; S3/RDS/logs/SNS/CloudTrail: `${project}-${environment}-*`-prefixed ARNs, matching every other
    module's actual naming convention); `Resource: "*"` only for EC2/Auto Scaling/ELBv2/CloudWatch
    control-plane APIs that don't support resource-level ARNs at all, with inline
    `# checkov:skip=...` justification per the project's established convention.
  - `iam:PassRole` scoped to an explicit list of the three *other* project roles (EC2, RDS enhanced
    monitoring, CloudTrail→CloudWatch), each paired via `iam:PassedToService` with the one service it's
    actually ever passed to — closing the PassRole-to-compute privilege-escalation path the `aws-iam`
    skill flags. Verified via AWS docs (not assumed) that `iam:PassedToService` matches the *passed
    role's own trust-policy principal* (`monitoring.rds.amazonaws.com` for the RDS role), not the
    calling API's service (`rds.amazonaws.com`) — getting this backwards would have made
    `terraform apply` fail the first time RDS Enhanced Monitoring was touched.
  - **Design correction caught during review, not after**: the deploy role's own name
    (`${project}-${environment}-deploy-role`) matches the same `${project}-${environment}-*` shape used
    for scoping IAM management of the *other* roles. A wildcard `Resource` on that statement would have
    let the deploy role reach its own inline policies via `iam:PutRolePolicy` (never denied — ordinary
    policy iteration has to stay self-service via CI) and, over a couple of `terraform apply` runs,
    rewrite its way to `iam:UpdateAssumeRolePolicy` despite an explicit `Deny` guardrail on that action
    — because the guardrail is itself just another inline policy on the same role. Fixed by switching
    from a wildcard to an explicit `locals.other_project_role_arns` list that structurally excludes the
    deploy role's own ARN, so there's no Allow-granted path to itself at all; the `Deny` guardrail is
    now genuine defense-in-depth against a future accidental wildcard, not the only thing standing
    between the role and self-escalation.
  - **Bootstrap constraint**: this module cannot create the credentials it grants access through — the
    first `terraform apply` that creates these resources must be run manually with the operator's own
    AWS credentials. Documented in the module's header comment and `.github/workflows/README.md`.
  - Wired into root `main.tf` (`module "github_oidc"`, depends on `module.kms.key_arn`),
    `variables.tf` (`github_repository`, `github_oidc_environment`, `terraform_state_bucket`,
    `terraform_state_key`, `terraform_lock_table` — the last three mirror `backend.tf`'s literals since
    Terraform can't read its own backend block), `outputs.tf` (`github_deploy_role_arn`), and
    `terraform.tfvars.example` (documented that the deploy role does *not* need to be added to
    `kms_key_administrator_arns` — it already gets `kms:*` on the CMK via its own identity policy,
    which the key's existing `EnableRootAccountFullAccess` statement turns into usable access).

**Security gate re-run**: `checkov -d infrastructure/terraform --framework terraform` →
Passed checks: 356, Failed checks: 0, Skipped checks: 29 (26 pre-existing + 3 new
`CKV_AWS_287`/`289`/`290` skips, same statement and same justification as the pre-existing
`CKV_AWS_355`/`356` skips on that statement). No AWS credentials were available to run
`terraform plan`/`apply` here — the module was validated by hand-tracing every resource-level ARN
against the actual naming convention each other module uses, not by a live apply.

**Files changed**: `infrastructure/terraform/modules/github-oidc/{main,variables,outputs}.tf` (new),
`infrastructure/terraform/main.tf`/`variables.tf`/`outputs.tf` (wired `module "github_oidc"`),
`infrastructure/terraform/terraform.tfvars.example` (documented new vars),
`infrastructure/terraform/README.md` (module list, status line),
`.github/workflows/security-scan.yml` (trivy-action tag fix),
`.github/workflows/README.md` (IAM bullet updated to reflect the new module).

---

## Follow-up (2026-07-26): temporary HTTP-only override (`enable_https`)

**Why**: chapter-4's design (and CLAUDE.md's "Key Design Decisions") specifies HTTPS-only on the ALB.
An ACM certificate requires DNS validation against a domain, and the user has no budget to register one
until either the July 2027 presentation or the stakeholder's go/no-go decision on continuing the system
— whichever comes first. Rather than silently deploying HTTP-only or hacking around the requirement,
this is implemented as an explicit, reviewed variable with a loud comment trail, so the deviation from
the submitted PSM1 design is visible in the code itself, not hidden.

**What changed**:
- `infrastructure/terraform/modules/alb/variables.tf` — `certificate_arn` now defaults to `""`
  (previously required); new `enable_https` variable, **module-level default `true`** (secure-by-default
  at the reusable-module level).
- `infrastructure/terraform/modules/alb/main.tf` — `aws_lb_listener.https` and `.http_redirect` now
  `count = var.enable_https ? 1 : 0`, with a `lifecycle.precondition` on the HTTPS listener requiring a
  non-empty `certificate_arn`. New `aws_lb_listener.http_forward` (`count = var.enable_https ? 0 : 1`)
  forwards port 80 directly to the target group when HTTPS is off.
- `infrastructure/terraform/variables.tf` — **root-level `enable_https` default is `false`** (the actual
  project override), with a long comment explaining why and pointing back here. This is the one place
  the exception is knowingly opted into — the module's own default stays `true`.
- `infrastructure/terraform/main.tf` — passes `enable_https = var.enable_https` into the `alb` module.
- `infrastructure/terraform/modules/security/main.tf` — updated the port-80 ingress rule's comment,
  which previously asserted "no plaintext app traffic is ever forwarded"; that's no longer true while
  `enable_https = false`, since the same port now carries real application traffic instead of only a
  redirect.
- `infrastructure/terraform/terraform.tfvars.example` — documented both variables and how to flip them
  once a domain/cert exist.
- `CLAUDE.md` — the "ALB: HTTPS only" design-decision bullet now notes the temporary override inline,
  and a new References entry points here.

**Security gate re-run**, both operating modes:
```
enable_https = false (current default): Passed: 353, Failed: 0, Skipped: 33
enable_https = true  (intended state):  Passed: 355, Failed: 0, Skipped: 33
```
Three new findings surfaced only in the `false` path and were each traced to their actual root cause and
skipped with justification, not blanket-suppressed: `CKV2_AWS_20` (ALB doesn't redirect HTTP→HTTPS —
true, on purpose) on `aws_lb.main`; `CKV_AWS_2`/`CKV_AWS_103` (ALB isn't HTTPS / doesn't use TLS 1.2) on
the new `aws_lb_listener.http_forward`; `CKV_AWS_378` (load balancer uses HTTP) on
`aws_lb_target_group.app`, which only fires because `http_forward` connects a client-facing HTTP
listener to it — the target group's own HTTP protocol to the EC2 backend is normal ALB architecture in
*either* mode (TLS terminates at the ALB) and isn't itself the issue.

**Not verified live**: no AWS credentials were available to `terraform plan`/`apply` either mode here;
verified by checkov (both variable states) and by hand-tracing the conditional resource `count`s.

**Carried-forward reminder**: flip `enable_https` to `true` and supply a real `acm_certificate_arn`
before this system ever holds real patient data — this is a demo/no-budget accommodation, not a revised
security posture.

---

## Follow-up (2026-07-28): live deployment — bootstrap, real bugs found, verified end-to-end, then torn down

**Where this picks up**: everything above was written and checkov-verified but never applied — no AWS
credentials, no Terraform CLI, no live account available in that session. This entry covers the actual
bootstrap `terraform apply` (across two Claude Code sessions), the real bugs it surfaced, full live
verification, and a deliberate teardown afterward.

### Bootstrap

- AWS account `730077843716` (`ap-southeast-1`), IAM user `nonlouy` (member of an `AdministratorAccess`
  group — used only for this one-time bootstrap; day-to-day CI/CD uses the OIDC deploy role, never this
  user).
- Terraform CLI installed via `winget install Hashicorp.Terraform` (v1.15.8). If a fresh shell can't find
  `terraform` on PATH, the binary is at
  `C:\Users\md3om\AppData\Local\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe`
  — PATH was updated but not every already-running shell picks that up.
- `infrastructure/terraform/terraform.tfvars` created locally (git-ignored, confirmed via
  `git check-ignore`) with the two real values needed beyond the file's own defaults:
  `kms_key_administrator_arns = ["arn:aws:iam::730077843716:user/nonlouy"]`,
  `ec2_ami_id = "ami-02121f8a41380fb02"` (latest AL2023, `ap-southeast-1`, resolved via
  `aws ssm get-parameters` / `aws ec2 describe-images` at the time). This file is **not** in git and
  will need recreating (same two values, or fresh ones if the AMI/account changed) if it's missing —
  see `terraform.tfvars.example`.

### Real bugs found via actual `terraform apply` (checkov had already passed on all of these — static
analysis doesn't catch cross-service AWS API validation quirks)

Each one below is its own commit on `main`, in the order hit:

1. **`90634ee`** — S3 bucket name `pdms-terraform-state` was already taken by an unrelated AWS account
   (S3 bucket names are globally unique). Renamed to `pdms-terraform-state-730077843716` everywhere it
   appeared (`backend.tf`, both `github-oidc` variable defaults, `infrastructure/README.md`,
   `sprint-2-summary.md`).
2. **`89ef569`** — `aquasecurity/trivy-action@0.28.0` needed a `v` prefix (already covered above), plus
   (found later, same commit) AWS rejects em-dashes in `aws_wafv2_web_acl.description` and
   `aws_security_group`/security-group-rule `description` fields specifically — "Character sets beyond
   ASCII are not supported." Five spots fixed; every other description field in the codebase (KMS,
   CloudWatch alarms, Terraform variable docs) tolerates UTF-8 fine and was left alone.
3. **`bc9cb61`** — RDS `CreateDBInstance` failed twice: `FreeTierRestrictionError` on the module's
   7-day `backup_retention_period` default (this AWS account is Free Tier eligible), and
   `InvalidParameterCombination: Cannot find version 16.4 for postgres` (AWS had deprecated that minor
   version — only 16.9–16.14 were creatable in `ap-southeast-1` as of this date). Added a root-level
   `db_backup_retention_period` override (default 1, same "module stays secure-by-default, root opts
   out with a documented reason" pattern as `enable_https`) and bumped the pinned engine version to
   16.14.
4. **`67eecd8`** — the ASG's `wait_for_capacity_timeout` (default 10 minutes, since
   `health_check_type = "ELB"`) hung on every single apply, because no application is deployed to the
   instances yet (the launch template only bootstraps Docker) — the ALB target-group health check had
   nothing to ever pass. Set to `0` so this reflects reality instead of guaranteeing a 10-minute stall
   before failing anyway.
5. **`1ca4e50`** — the biggest one. A plain "grant the service + `kms:CallerAccount`" KMS statement
   (this project's existing pattern, still correct for RDS/S3/SSM/EC2) was **not** sufficient for
   CloudWatch Logs, SNS, or CloudTrail — each needed its own `EncryptionContext`-scoped statement,
   found one service at a time by testing live against the actual deployed key (push a candidate
   policy via `aws kms put-key-policy`, retest the exact failing call via CLI, iterate — much faster
   than a full `terraform apply` cycle per guess). CloudWatch Logs needed
   `kms:EncryptionContext:aws:logs:arn`; SNS needed `kms:EncryptionContext:aws:sns:topicArn` scoped to
   the exact topic; CloudTrail needed the three statements AWS's own
   [KMS-key-policy-for-CloudTrail doc](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/create-kms-key-policy-for-cloudtrail.html)
   lists as the actual minimum. Separately, CloudTrail's own SNS delivery-notification association
   (`sns_topic_name` on `aws_cloudtrail.main`) turned out to be incompatible specifically with
   `enable_log_file_validation`, even against a KMS policy verified correct — isolated by removing one
   variable at a time (S3 alone: fine; +CloudWatch Logs: fine; +log-file-validation: broke again).
   Dropped that one association rather than the validation feature; CLAUDE.md's actual requirement
   ("all API calls logged, 90-day retention") never depended on it. Also fixed the SNS topic policy,
   which had only ever granted `cloudtrail.amazonaws.com` — the monitoring alarms (the topic's real
   purpose) would have silently failed to publish the first time one fired.

### Result

All 110 resources applied successfully; `terraform plan` showed zero drift. All 5 GitHub secrets set
(`AWS_DEPLOY_ROLE_ARN` from `terraform output github_deploy_role_arn` — the deploy role name is
deterministic, `pdms-prod-deploy-role`, so this value stays valid across future applies as long as
project/environment names don't change). The `production` GitHub environment's required-reviewer rule
was also set — from the terminal, not the web UI, via
`gh api --method PUT repos/Mhdomer/secure-cloud-pdms/environments/production -f 'reviewers[][type]=User' -F 'reviewers[][id]=<numeric-id>'`
(numeric ID from `gh api user --jq .id`, not the username). That closes out every item that was
previously listed as "still open" in this document.

Live-verified but expected and not a bug: hitting the ALB DNS name returns a 503, since no application
is deployed to the EC2 instances yet (see bug #4 above) — publishing the backend image to ECR and
rolling it out via SSM remains a real, separate, not-yet-built piece of work, same as documented earlier
in this file under "Deliberately out of scope."

### Teardown

Torn down the same day via `terraform destroy` to stop cost accrual against the account's free-tier
credit — this was always the plan (verify live, then tear down until actually needed). Both RDS
(`deletion_protection`) and the ALB (`enable_deletion_protection`) have protection enabled in the
Terraform config, which blocks `terraform destroy` outright; disabled both directly via AWS CLI first
(`aws rds modify-db-instance --no-deletion-protection`,
`aws elbv2 modify-load-balancer-attributes ... deletion_protection.enabled=false`) rather than changing
the .tf source, since the *desired* state is still "protected" — re-applying will turn protection back
on automatically, which is correct.

**To bring it back**: `terraform apply -var-file="terraform.tfvars"` from `infrastructure/terraform/`
with valid AWS credentials — the whole path above is proven to work end-to-end now, so a fresh apply
should go straight through without hitting any of the five bugs again (all fixed in source). Confirm
`terraform.tfvars` still exists locally first (git-ignored, see the Bootstrap section above for its
contents if it needs recreating). **Before trusting this section**, verify actual AWS state
(`aws cloudtrail describe-trails`, `aws rds describe-db-instances`, etc.) rather than assuming — this is
a point-in-time record of what was done on 2026-07-28, not a live status dashboard.

### Still genuinely open (not done today, not a regression — same items as before)

- No application deployed to the EC2 instances (ECR + SSM rollout — flagged since the original Sprint 4
  pass, still not built).
- No domain/ACM cert — `enable_https` stays `false` (see the HTTP-only override entry above).
- Sprint 5 (security evaluation: Security Hub, RTO drill, UAT) has not started.
- The report-delta backlog (`docs/psm2/report-delta.md`) is unrelated to Sprint 4 but is the largest
  remaining piece of work overall — see that file for the full list of PSM1 report sections that are
  now out of date against the implementation.
