# Sprint 5 Prep — Summary
## Backend Deploy Automation, Frontend Hosting, HTTPS-Safe Wiring

---

## What Was Implemented

Closes the two items Sprint 4 explicitly deferred (`sprint-4-summary.md`'s "Deliberately out of
scope" / "Still genuinely open" sections): ECR + an SSM-based pull-and-restart rollout mechanism for
the backend, and S3 + CloudFront frontend hosting — plus the application-level wiring needed to make
the two work together over HTTPS without hitting browser mixed-content blocking.

Full design rationale: `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md`.
Implementation plan: `docs/superpowers/plans/2026-07-30-post-sprint4-deploy-and-frontend-hosting.md`.

---

## Mixed content — resolved via one CloudFront distribution, two origins

`modules/frontend`'s CloudFront distribution serves the React build (S3 origin, OAC) as its default
behavior and proxies `/api/*` to the ALB as a second origin. The browser's view of the whole app is
therefore a single HTTPS origin — confirmed necessary, not just convenient, by re-reading the actual
code: `src/frontend/src/lib/api.ts`'s relative `/api` baseURL and
`src/backend/src/utils/session.js`'s `sameSite: 'strict'` auth cookie both only work when the
frontend and API are same-origin from the browser's perspective. Zero frontend code changes.

---

## Backend deployment automation

New `modules/ecr` (IMMUTABLE tags, KMS-encrypted, `scan_on_push`, lifecycle policy capping stored
images at 10). A single `deploy.sh`, rendered via `templatefile()` and written to disk by the
launch template's `user_data`, runs at instance boot and again on-demand via SSM
`AWS-RunShellScript` from `.github/workflows/deploy.yml`'s new `publish-backend-image` job.

**Rollback**: health-check-before-swap on every instance independently — a broken image never gets
swapped in anywhere (every instance detects the same failure identically, so the fleet-wide result
of a bad deploy is "still running the last version everywhere," not a partial outage). For a subtly
broken image that passes the shallow `/health` check, CI records the previous tag to
`/pdms/prod/app/previous_image_tag` before overwriting `image_tag`, giving an explicit manual
rollback lever.

**Bug found and fixed, unrelated to but blocking this work**: `variables.tf`'s `health_check_path`
defaulted to `/api/health`, which does not exist anywhere in `src/backend/src/routes/` — only
`app.js:26`'s root-mounted `/health`. Invisible in Sprint 4 because no application was ever actually
running against it; would have kept the ASG unhealthy forever regardless of how correctly the rest
of this rollout worked.

**SSM parameter encryption correction (found during Task 4)**: the plan as originally written
specified plain `String` type for the two rollout-control SSM parameters, `image_tag` and
`previous_image_tag`. Running checkov against the real HCL during implementation flagged both with
`CKV2_AWS_34` (unencrypted SSM parameter). Rather than suppress the finding with a `checkov:skip`,
the controller switched both to `SecureString` — matching `modules/rds`'s own established precedent
of using `SecureString` even for values that aren't secrets — and updated the two places that
touch them: `deploy.sh.tpl`'s `image_tag` read now passes `--with-decryption` (see
`infrastructure/terraform/modules/ec2/templates/deploy.sh.tpl:25`), and `deploy.yml`'s CI write step
now uses `--type SecureString --key-id ...`. This cost no new IAM — both the EC2 instance role and
the CI deploy role already had the KMS permissions needed for unrelated reasons, so the fix was pure
correction, not new scope.

**CI/CD**: `security-scan.yml`'s `container-scan` job is unchanged (still `push: false` — it has no
AWS credentials by design, and stays that way). `deploy.yml` gained `publish-backend-image` (rebuild
+ push + SSM rollout, blocking on result with a bounded 8-minute poll — flagged as a required
follow-up during spec review, not present in the original draft) and `publish-frontend` (build +
`aws s3 sync` + CloudFront invalidation), both gated on `needs: [scan, terraform-apply]` and
`environment: production`, same OIDC trust boundary as the existing `terraform-apply` job.

---

## Frontend hosting

`modules/frontend`: private, KMS-encrypted, versioned S3 bucket; CloudFront with Origin Access
Control (not a public bucket policy — confirmed via the AWS CloudFront skill that OAC, unlike the
legacy OAI, supports SSE-KMS origins); SPA routing via a CloudFront Function on the default behavior
(extension-less URIs rewritten to `/index.html`); the managed `SecurityHeadersPolicy` on the default
behavior.

SPA routing was originally implemented with a `custom_error_response` pair (403 and 404 → 200
`/index.html`) and replaced during the final whole-branch review: `custom_error_response` belongs to
the distribution config as a whole, not to one behavior, so it also fired on the `/api/*` → ALB
origin and rewrote every backend 403 (RBAC denial) and 404 into a 200 with an HTML body. A
`function_association` is per-behavior and therefore cannot reach `/api/*` at all.

**KMS**: the CloudFront service-principal grant in `modules/kms` is scoped via `aws:SourceAccount`
(this account), not an exact distribution ARN — CloudFront distribution IDs are AWS-generated at
creation time, unlike the CloudTrail statement's human-chosen, precomputable trail name, so there is
no equivalent deterministic string to reference without creating a module cycle. Narrower than the
general service-usage statement, without fabricating a precision the module graph can't back up.

---

## Items flagged during spec review, carried forward as still-open

Not fixed here — genuinely require a live account to resolve, consistent with this project's
existing "verify empirically, don't assume" pattern from Sprint 4's own live-deployment bug list:

1. **ECR's KMS encryption** is assumed sufficient via the existing generic `AllowServiceUsage`
   statement (`ecr.amazonaws.com` is not one of the three services — CloudWatch Logs, SNS,
   CloudTrail — that needed a dedicated `EncryptionContext` statement last time). Unverified until
   the first real `docker push`. If it fails with a KMS access-denied-style error, add a dedicated
   `AllowEcrUsage` statement to `modules/kms/main.tf` the same way the other three were added.
2. **The `ssm:resourceTag/Name` condition** on the deploy role's tag-scoped `ssm:SendCommand`
   statement is unverified against a live `ssm:SendCommand` call until the first real rollout. (The
   statement has since been split in two — an unconditioned one for the `AWS-RunShellScript`
   document, a tag-conditioned one for the instances — per AWS's documented Run Command tag pattern;
   the condition itself is still unproven against a live call.)
3. **`/health` does not prove the database is reachable.** `src/backend/src/app.js:26`'s `/health`
   route returns 200 from the Node process alone — it never touches PostgreSQL. So `deploy.sh`'s
   health-check-before-swap cannot catch a DB connectivity failure: a container with an unusable
   database connection still passes the check and gets swapped in, and the deploy reports success
   while every real API request 500s. This matters more now than it did, because this plan is what
   turns on `DB_SSL=true` for the first time (local dev runs `DB_SSL=false`, so the TLS path had
   never been exercised) — the RDS CA bundle now baked into the image
   (`src/backend/Dockerfile` + `src/backend/src/config/database.js`) is itself unverified against a
   live RDS endpoint. The real fix is a deeper readiness route (`/health/ready` doing a `SELECT 1`)
   wired to the ALB target group's `health_check_path`; that is out of this plan's scope to build,
   and is flagged here as still open the same way the WAF and CloudFront-access-logging gaps are.
4. **The SPA-routing CloudFront Function keys off "does the URI contain a dot".**
   `modules/frontend`'s `aws_cloudfront_function.spa_fallback` rewrites any request whose URI has no
   `.` in it to `/index.html`, which is the standard heuristic for separating client-side routes from
   static asset requests. It has one edge: a client-side route with a literal dot in a path segment
   (something shaped like `/patients/j.doe`) would be read as a file request and served from S3,
   which returns 403 for a missing key instead of falling through to `index.html`. No route in
   `src/frontend` has that shape today, and that holds structurally rather than by luck: the only five
   path parameters in the whole route table are `:doctorId` / `:patientId` / `:recordId` / `:visitId`,
   all `UUID PRIMARY KEY DEFAULT gen_random_uuid()` columns in `schema.sql`, and `:slug`, which
   `departmentsController.slugify()` builds with `.replace(/[^a-z0-9]+/g, '_')` — a dot cannot survive
   either one. So this is a latent constraint on future routing, not a live bug. Worth remembering if a
   route ever starts taking a filename, email address, or version string as a path segment.

---

## Final whole-branch review — found and fixed 3 Critical, 4 Important cross-task defects

Every one of the 9 tasks above was individually implemented and reviewed clean against its own diff.
A final whole-branch review (reading the entire ~94KB diff at once, on the most capable available
model) then caught defects that only exist as an interaction *between* two tasks' work — invisible to
any single task's own review because neither half of the problem was in that task's diff. All were
fixed in one consolidated pass and independently re-verified (re-run `terraform validate`/`fmt`/
`checkov`, not just re-reading the fix):

- **CloudFront's `custom_error_response` is distribution-wide, not per-behavior** (see "Frontend
  hosting" above) — silently rewrote every backend 403/404 into a 200. Fixed with a CloudFront
  Function scoped to only the default (S3) behavior.
- **The CI deploy role had runtime IAM (ECR push, CloudFront invalidate, SSM read/write) but no
  *management* IAM** — nothing let `terraform apply` actually create the ECR repository, the
  CloudFront distribution, or the new SSM parameters. `terraform-apply` would have AccessDenied on
  its first real run. Fixed by adding `ManageProjectEcr`/`ManageProjectCloudFront`/
  `ManageProjectSsmParameters` statements to the deploy role (`modules/github-oidc/main.tf`) — the
  same pattern already used for KMS/S3/RDS/Logs/SNS/CloudTrail in that file. This also incidentally
  closed a pre-existing gap: the deploy role never had SSM management permission for `modules/rds`'s
  own `/pdms/prod/db/*` parameters either (Sprint 4's live apply used operator credentials, so this
  never surfaced).
- **`health_check_grace_period = 60` was set when instance boot did nothing** (see the "Two Minor
  findings" section below) — now that boot pulls and runs a real container, 60s isn't enough time and
  the ASG would terminate instances mid-boot forever. Raised to 600.
- **`ssm:SendCommand`'s tag condition was on the wrong resource** — a single IAM statement listed both
  the `AWS-RunShellScript` document and the tagged EC2 instances under one tag-based condition; AWS's
  own documentation for this exact pattern requires two separate statements (the document
  unconditioned, the instances tag-conditioned), because the document itself carries no tag and fails
  the same condition. Split into two statements.
- **`DB_SSL=true` is turned on for the first time by this plan** (local dev always runs
  `DB_SSL=false`), and Node's default trust store does not include RDS's regional CA — every DB
  connection from the deployed container would likely have failed TLS verification. Fixed by bundling
  RDS's global CA bundle into the Docker image and passing it as the `ca` option.
- **The ALB was still fully open to the internet on both ports**, bypassing CloudFront (and its
  future-facing WAF-consolidation potential) entirely, undermining the "one HTTPS origin" premise this
  whole plan is built on. Restricted to CloudFront's AWS-managed origin-facing IP prefix list. (This
  surfaced its own follow-up: that prefix list has a documented AWS "weight" of 55 against a
  security group's default 60-rule quota, so putting it on both the :80 and :443 rules
  simultaneously — 110 — would itself have failed apply. Resolved by gating the :443 rule on
  `var.enable_https`, since nothing listens on 443 while it's `false`; a Service Quotas increase to
  ≥110 becomes a real prerequisite whenever `enable_https` is flipped to `true`, alongside its other
  already-documented prerequisites in `infrastructure/terraform/variables.tf`.)
- **Unquoted bash array expansion** (`deploy.sh.tpl`) — `modules/rds`'s generated master password's
  character set includes glob metacharacters (`*?[]`), and an unquoted `${ENV_ARGS[@]}` is subject to
  pathname expansion. Quoted.

Plus 8 Minor fixes bundled into the same pass: a guard against re-running a failed `publish-backend-image`
job into ECR's `IMMUTABLE`-tag conflict, a corrected (less overclaiming) comment on what Trivy actually
scanned versus what gets pushed, documentation of why three separate GitHub `production` environment
approvals are expected per merge (not a broken pipeline), removing two more hardcoded literals from
`deploy.yml` in favor of Terraform outputs, reordering the frontend's S3 sync so a browser is never
served a stale `index.html` referencing already-deleted chunks, a `flock` guard against concurrent
`deploy.sh` invocations, explicit failure handling on `deploy.sh`'s six SSM parameter reads, and fixing
the zero-instances silent-success case described below.

**Residual Minor findings from the re-review of this fix wave** (checked, judged non-blocking, not
further looped on — consistent with this plan's "don't chase every finding to zero, adjudicate and
move on" discipline):
- `ssm:DescribeParameters` has no resource-level ARN in the AWS API; the new ARN-scoped
  `ManageProjectSsmParameters` statement may not actually grant it, and Terraform's own
  `aws_ssm_parameter` read path calls `DescribeParameters` to populate several attributes — so
  `terraform apply` could still AccessDeny on this specific call despite the fix above. Unverifiable
  without a live apply; if it happens, the fix is a fourth statement granting `ssm:DescribeParameters`
  on `Resource: "*"` (same documented API-limitation shape as this file's other wildcard statements).
- The ALB-lockdown fix narrows the bypass but doesn't fully close it: CloudFront's managed
  origin-facing prefix list is shared by every AWS customer's CloudFront distributions, so the
  residual risk becomes "someone else's CloudFront distribution fronts your ALB DNS name" rather than
  a full close. AWS's documented complete fix is a secret custom origin header validated at the ALB
  (or moving to VPC origins) — a real hardening step, out of this plan's scope.
- The new `flock` guard around `deploy.sh` (preventing the boot-time and CI-triggered invocations from
  racing) has a narrow window where a CI-triggered run can report success while the boot-time run
  (which read `image_tag` slightly earlier) is what actually won the lock — a "green pipeline, one
  instance quietly still on the previous tag" outcome. The no-lock alternative (two invocations racing
  on the same container name) was strictly worse; this is a known, accepted trade rather than a full
  fix.
- The `docker manifest inspect` re-run guard assumes the GitHub Actions runner's Docker CLI has
  experimental commands enabled; if not, the guard silently falls through to the old push behavior
  (safe direction — the push still happens — just without the intended re-run protection).

### Blocking gap found during this review, NOT fixed here — out of this plan's scope

**The CI deploy role has zero `wafv2:*` IAM permission anywhere, but `modules/alb` (untouched by any
of this plan's 9 tasks or its fix wave) creates `aws_wafv2_web_acl.alb`, its association, and its
logging configuration.** This is the *exact same failure class* the deploy-role IAM fix above just
closed for ECR/CloudFront/SSM — `terraform apply` under the deploy role will AccessDeny on these three
WAF resources on the next real run. It surfaced only as a byproduct of this review's rigor; `modules/alb`
was never in scope for any task in this plan, so it wasn't fixed here rather than being silently
patched outside the plan's stated boundaries. **Needs its own small IAM fix (add a `wafv2:*`
statement to the deploy role, scoped to the WAF ACL's resources, following the same pattern as the ECR/
CloudFront/SSM statements above) before the next live `terraform apply` is attempted.** A related,
smaller issue: the WAF's CloudWatch log group is named `aws-waf-logs-pdms-prod` (AWS mandates that
literal prefix), but the existing `ManageProjectLogs` statement is scoped to `log-group:/pdms/prod*` —
never matches, same root cause.

---

## Two Minor findings deferred during task review — both since fixed

Both were disclosed during execution and closed in the final whole-branch review fix wave:

1. `modules/ec2/main.tf`'s `aws_autoscaling_group.app` `wait_for_capacity_timeout` comment was stale
   — it still said the instance's `user_data` "only bootstraps Docker," which stopped being true at
   Task 4 (it now also pulls and runs the backend image). Comment rewritten to describe the actual
   current reason `"0"` is still correct (`image_tag` starts at `"none"`, so nothing ever starts and
   nothing can pass the ELB health check yet). The same review also raised
   `health_check_grace_period` from 60s to 600s — 60s was set when boot did nothing, and would now
   terminate instances mid-boot once a real image tag exists.
2. `deploy.yml`'s rollout-wait loop silently reported success if `aws ec2 describe-instances`
   returned zero running instances matching the target tag — the `for` loop body simply never
   executed and the step exited 0. It now fails explicitly on an empty instance list.

---

## Security gate

```
checkov -d infrastructure/terraform --framework terraform (after Tasks 1-9)
  → Passed checks: 404, Failed checks: 1, Skipped checks: 45

checkov -d infrastructure/terraform --framework terraform (after the final-review fix wave)
  → Passed checks: 399, Failed checks: 1, Skipped checks: 45

terraform plan (Task 6, full stack, against the live account, before the fix wave) → 0 errors, 125 to add / 0 to change / 0 to destroy
```

The passed-check count drops from 404 to 399 solely because the ALB's `:443` security-group ingress
rule now only exists when `enable_https = true` (see the SG-quota fix above) — with `enable_https`
at its current default of `false`, that rule (and the 5 checks that used to run against it) simply
doesn't exist to check. Verified directly: temporarily forcing the rule's `count` back to `1` during
review reproduced exactly 404/1/45 again.

The single failed check, in both runs, is `CKV_AWS_252` on `module.cloudtrail.aws_cloudtrail.main` —
pre-existing, predating this plan's first task, and unrelated to any of this plan's work.

**`terraform plan` was re-run against the fixed code** (same read-only, no-sign-off-needed basis as
Task 6) and still shows **0 errors, 125 to add / 0 to change / 0 to destroy** — the same total as
before the fix wave, which checks out arithmetically: the fix wave added one resource
(`aws_cloudfront_function.spa_fallback`) and removed one from the current plan (the ALB's `:443`
security-group rule, now `count = 0` while `enable_https = false`), a net wash. New outputs
`ec2_instance_tag_name` (`"pdms-prod-app"`) and `ssm_app_parameter_prefix` (`"/pdms/prod/app"`) —
added by the fix wave's M4 — both resolve correctly.

**Task 6 note**: unlike Tasks 1–5, 7, and 8, Task 6 (the full-stack `terraform plan` above) was run
directly by the controller rather than through the usual implementer/reviewer subagent loop — it's
pure read-only verification against the live account with no code diff attached, so there was
nothing for a reviewer to review. It's the reason this doc has no corresponding "implementer report"
for Task 6.

**Not yet live-verified**: this plan deliberately never ran `terraform apply`, `terraform destroy`,
or an actual GitHub Actions run against `deploy.yml` — all three require explicit sign-off before
spending AWS budget or provisioning real resources, per this task's own constraints. Static checks
(`checkov`, `terraform validate`, and a real read-only `terraform plan`) all passed; a live apply is
the next step, pending that sign-off.

## Files changed

- New: `infrastructure/terraform/modules/ecr/`, `infrastructure/terraform/modules/frontend/`,
  `infrastructure/terraform/modules/ec2/templates/`
- Modified: `infrastructure/terraform/modules/ec2/{main,variables}.tf`,
  `infrastructure/terraform/modules/github-oidc/{main,variables}.tf`,
  `infrastructure/terraform/modules/kms/main.tf`,
  `infrastructure/terraform/modules/security/{main,variables}.tf` (final-review fix wave —
  CloudFront prefix-list ingress lockdown),
  `infrastructure/terraform/{main,variables,outputs}.tf`
- Modified: `.github/workflows/deploy.yml`, `.github/workflows/security-scan.yml` (comment only)
- Modified: `.github/workflows/README.md`, `infrastructure/terraform/README.md`, `CLAUDE.md`
- Modified (final-review fix wave, application code — see I2 above): `src/backend/Dockerfile`,
  `src/backend/src/config/database.js`

---

## Explicitly out of scope for this plan (unchanged from the spec)

HTTPS/ACM for the ALB (`enable_https` stays `false`), Twilio/WhatsApp secrets, the `uploads/` → S3
migration, and any actual `terraform apply`/`destroy`/live GitHub Actions run — all deferred pending
separate, explicit sign-off.
