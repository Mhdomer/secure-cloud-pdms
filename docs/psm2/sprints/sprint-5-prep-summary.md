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
checkov -d infrastructure/terraform --framework terraform
  → Passed checks: 404, Failed checks: 1, Skipped checks: 45

terraform plan (Task 6, full stack, against the live account) → 0 errors, 125 to add / 0 to change / 0 to destroy
```

The single failed check is `CKV_AWS_252` on `module.cloudtrail.aws_cloudtrail.main` — pre-existing,
predating this plan's first task, and unrelated to any of this plan's work.

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
  `infrastructure/terraform/modules/kms/main.tf`, `infrastructure/terraform/{main,variables,outputs}.tf`
- Modified: `.github/workflows/deploy.yml`, `.github/workflows/security-scan.yml` (comment only)
- Modified: `.github/workflows/README.md`, `infrastructure/terraform/README.md`, `CLAUDE.md`

---

## Explicitly out of scope for this plan (unchanged from the spec)

HTTPS/ACM for the ALB (`enable_https` stays `false`), Twilio/WhatsApp secrets, the `uploads/` → S3
migration, and any actual `terraform apply`/`destroy`/live GitHub Actions run — all deferred pending
separate, explicit sign-off.
