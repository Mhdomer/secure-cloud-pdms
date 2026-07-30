# Design — Backend Deployment Automation, Frontend Hosting, and HTTPS-Safe Wiring

Status: **Approved, not yet implemented.** Closes the two items Sprint 4 explicitly deferred
(`docs/psm2/sprints/sprint-4-summary.md`'s "Deliberately out of scope" / "Still genuinely open"
sections) — ECR + SSM rollout, and S3 + CloudFront frontend hosting — plus the application-level
wiring needed to make the two actually work together, before Sprint 5 (security evaluation) starts.

## Why this exists

Sprint 4 built the CI/CD pipeline, CloudWatch, CloudTrail, and the GitHub OIDC deploy role, and
live-verified all 110 resources apply cleanly. But the EC2 launch template's `user_data` only ever
bootstraps Docker — it never pulls or runs the backend image — and there is no Terraform for
frontend hosting at all, despite CLAUDE.md's tech-stack table saying "React → built to static,
deployed to S3 + CloudFront." Hitting the live ALB today returns a 503, confirmed during Sprint 4's
live-deployment pass. Sprint 5 (Security Hub, RTO drill, UAT) needs an actual running application to
evaluate — this work is the prerequisite.

## Scope

1. Backend deployment automation — ECR + an SSM-based pull-and-restart rollout mechanism.
2. Frontend hosting — a new `modules/frontend` (S3 + CloudFront + OAC).
3. Application-level wiring — resolving the HTTPS-frontend / HTTP-backend mixed-content problem.

Explicitly **not** in scope: HTTPS/ACM for the ALB itself (`enable_https` stays `false` — no
domain registered, tracked separately per `infrastructure/terraform/variables.tf`), Twilio/WhatsApp
secrets (optional, already no-ops if unset, unrelated to this work), and the `uploads/` → S3
migration (flagged as its own item in `docs/psm2/sprints/sprint-4-summary.md`).

---

## Decision 1 — Mixed content: one CloudFront distribution, two origins

Resolved before touching either piece of Terraform, per the task's own instruction not to discover
this at the end.

**Route `/api/*` through the same CloudFront distribution that serves the frontend, as a second
origin pointed at the ALB.** Not the generic default answer — three pieces of code already in this
repo make it the *only* approach consistent with what's already written, not just a preference:

1. `src/frontend/src/lib/api.ts:99` — axios `baseURL` defaults to `import.meta.env.VITE_API_BASE_URL
   ?? '/api'`, a **relative** path. That only resolves correctly if the API is same-origin with the
   page.
2. `src/backend/src/utils/session.js:22` — the auth cookie is set `sameSite: 'strict'`. A `Strict`
   cookie is never sent on a cross-site request, even a credentialed XHR with correct CORS headers.
   If the frontend and backend were genuinely separate origins, login would appear to succeed but
   every subsequent authenticated request would silently drop the cookie.
3. `src/backend/src/middleware/corsValidator.js`'s header comment describes a cross-origin
   CloudFront↔ALB model (chapter-4 §4.3.8.3) — a model that does not actually work against the
   `sameSite: 'strict'` cookie shipped in Sprint 3a. Confirmed by re-reading both files directly:
   the design intent and the shipped cookie config were never reconciled.

Single-distribution routing makes the browser's view same-origin: no mixed content (the browser
only ever speaks HTTPS to CloudFront), no CORS needed, `sameSite: 'strict'` works unmodified, and
`VITE_API_BASE_URL` needs no override. **Zero frontend code changes.** `corsValidator.js` is left
alone — same-origin CloudFront-proxied requests still carry an `Origin` header equal to
`CLOUDFRONT_ORIGIN`, so it keeps passing as a harmless defense-in-depth layer.

Mechanically: a `/api/*` cache behavior with the managed `CachingDisabled` cache policy and
`AllViewer` origin-request policy (forwards cookies/headers/query strings unmodified to the ALB),
`viewer_protocol_policy = redirect-to-https`. The CloudFront→ALB hop stays HTTP while
`enable_https = false`; the origin's `origin_protocol_policy` and port are wired to
`var.enable_https` so this flips to HTTPS automatically once a real cert exists — no follow-up
change to this module needed later.

---

## Decision 2 — Backend deployment automation

### `modules/ecr` (new)

One repository, name `${var.project_name}-${var.environment}-backend` (`pdms-prod-backend`):
- `image_tag_mutability = "IMMUTABLE"` — matches this project's audit-trail posture; the tag that
  was Trivy-scanned in CI is the exact tag that ever gets deployed, never silently replaced.
- `encryption_configuration { encryption_type = "KMS", kms_key = var.kms_key_arn }` — the project
  CMK, no new key. Plain SSE-KMS via a standard AWS service principal grant; already covered by the
  existing `AllowServiceUsage` statement in `modules/kms` (`s3.amazonaws.com`-style generic grant is
  sufficient here — ECR's KMS integration doesn't have the EncryptionContext quirks CloudWatch
  Logs/SNS/CloudTrail turned out to need in Sprint 4's live-deployment pass, since ECR is not one of
  those three services).
- `image_scanning_configuration { scan_on_push = true }` — defense in depth alongside CI's Trivy
  scan (catches drift between CI scan time and pull time).
- Lifecycle policy: expire untagged images after 1 day, keep the most recent 10 tagged images (cost
  control on a free-tier account, same motivation as the RDS backup-retention override).

### SSM parameters (new) — owned by `modules/ec2`

Under a new prefix `/${project_name}/${environment}/app` (sibling to the existing
`/${project_name}/${environment}/db` prefix, same `modules/rds`-style "module that consumes a value
also owns creating it" pattern):

| Parameter | Type | Written by | Read by |
|---|---|---|---|
| `/pdms/prod/app/jwt_secret` | SecureString (KMS) | Terraform (`random_password`, mirrors `modules/rds`'s `db_password` exactly, including `lifecycle { ignore_changes = [value] }`) | EC2 role |
| `/pdms/prod/app/image_tag` | String | GitHub Actions deploy role, Terraform sets only the initial value | EC2 role |
| `/pdms/prod/app/previous_image_tag` | String | GitHub Actions deploy role, Terraform sets only the initial value | GitHub Actions deploy role (manual rollback only — EC2 role never reads this one) |

`image_tag` and `previous_image_tag` both need `lifecycle { ignore_changes = [value] }` too, for the
same reason as `db_password`: CI mutates them outside Terraform via `aws ssm put-parameter`, and
without `ignore_changes` the very next `terraform-apply` job (which runs on *every* merge to main,
including ones that never touch Terraform) would silently reset the running app back to whichever
tag Terraform's own default declares — an accidental rollback on every deploy. Both default to the
literal string `"none"` at first apply; `deploy.sh` treats `"none"` as "nothing deployed yet, skip"
so a fresh `terraform apply` before any CI push behaves exactly like today (instances boot, Docker
bootstraps, ALB returns 503 until the first real deploy) rather than crashing on a nonexistent tag.

### IAM

**EC2 instance role** (`modules/ec2/main.tf`) gains two new statements, read-only throughout —
matches this role's existing least-privilege posture (no write access to anything it doesn't own):
- `PullBackendImageFromEcr` — `ecr:GetAuthorizationToken` (`Resource: "*"`, unavoidable: this
  action has no resource-level ARN in the AWS API, same category of gap the github-oidc module
  already documents and `checkov:skip`s for EC2/ASG control-plane actions) plus
  `ecr:BatchGetImage`/`GetDownloadUrlForLayer`/`BatchCheckLayerAvailability` scoped to the one ECR
  repo ARN.
- `ReadAppConfigFromSsm` — `ssm:GetParameter`/`GetParameters` scoped to an explicit two-entry list
  (`.../app/jwt_secret`, `.../app/image_tag`), not a `.../app/*` prefix wildcard — `deploy.sh` never
  reads `previous_image_tag` (that one exists solely for the CI-side manual-rollback path in
  Decision 2's rollback note), and an explicit list is what this codebase already reaches for when a
  wildcard would grant more than is actually used (see `modules/github-oidc`'s
  `local.other_project_role_arns` doing the same thing for a stronger reason). Separate Sid from the
  existing `ReadOwnDbCredentialsFromSsm` — different concern, same least-privilege-per-concern
  pattern already used in this file.

**GitHub OIDC deploy role** (`modules/github-oidc/main.tf`) gains, following that module's existing
pattern of resource-scoped statements with an explanatory comment per statement:
- `PublishBackendImageToEcr` — push-side ECR actions
  (`PutImage`/`InitiateLayerUpload`/`UploadLayerPart`/`CompleteLayerUpload`/
  `BatchCheckLayerAvailability`) scoped to the repo ARN, plus the same unavoidable
  `ecr:GetAuthorizationToken` on `Resource: "*"`.
- `ManageAppDeploySsmParameters` — `ssm:GetParameter`/`PutParameter` scoped to exactly the
  `image_tag` and `previous_image_tag` parameter ARNs (never `jwt_secret` — CI has no business
  reading or writing that one).
- `TriggerBackendRollout` — `ssm:SendCommand` scoped to the AWS-owned `AWS-RunShellScript` document
  ARN plus an EC2 instance ARN pattern *conditioned* on `ssm:resourceTag/Name` = the exact tag
  (`${project}-${environment}-app`) the launch template already applies to every instance —
  narrower than `Resource: "*"`, and consistent with the project's convention of conditioning
  broad-shaped grants rather than leaving them unconditioned. `ssm:GetCommandInvocation` (polls
  rollout success/failure) needs `Resource: "*"` — this API has no resource-level ARN either,
  `checkov:skip`ped with the same justification style as the existing EC2/ASG statement.
- `PublishFrontendInvalidation` — see Decision 3; grouped here since it's the same deploy role.

### Rollout mechanism — `deploy.sh`

One script, written to disk by the launch template's `user_data`, invoked in exactly two places —
once at instance boot (so a freshly-launched or ASG-replaced instance always comes up running
whatever was last successfully deployed, never a stale baked-in version) and again on-demand via
SSM `AWS-RunShellScript` from the CI pipeline. One script, not duplicated logic in two places.

Responsibilities, in order:
1. Read the target tag from `/pdms/prod/app/image_tag`. If `"none"`, log and exit 0 (nothing to do
   yet — see the bootstrap note above).
2. `aws ecr get-login-password | docker login` — uses the instance's own IAM role via IMDS, no new
   credentials to manage.
3. `docker pull` that exact tag.
4. Assemble the container's env: `DB_*` from `/pdms/prod/db/*` (already-existing parameters),
   `JWT_SECRET` from `/pdms/prod/app/jwt_secret`, and non-secret values baked into the script at
   `terraform apply` time via `templatefile()` — `NODE_ENV=production`, `DB_SSL=true`,
   `COOKIE_SECURE=true`, `LOG_LEVEL=info`, `AWS_REGION`, and
   `CLOUDFRONT_ORIGIN`/`FRONTEND_URL=https://${module.frontend.distribution_domain_name}` (this is
   why `modules/ec2` gains a dependency on `modules/frontend`'s output — one-directional, no cycle).
5. **Health-check-before-swap, no orchestration across instances needed.** Run the pulled image as
   a throwaway container (`pdms-backend-candidate`) bound to `127.0.0.1:5001`, poll its `/health`
   for up to 30s — a flat, deliberately-simple local timeout, not a value derived from the ALB
   target group's own health-check cadence (that one polls every 30s over 3 consecutive
   checks — a materially different, unrelated timer for a different purpose). If it never turns
   healthy: remove the candidate, leave the currently-running `pdms-backend` container untouched,
   exit 1. SSM reports the command as Failed; the triggering CI job (which blocks on the result —
   see Decision 2's CI wiring below) fails loudly.
   If healthy: stop and remove the old `pdms-backend` container, remove the candidate, start the
   same image for real as `pdms-backend` bound to the real app port.

**Rollback.** Because every instance runs this exact same script independently, a genuinely broken
image (crashes, fails `/health`) never gets swapped in anywhere — the fleet-wide result of a bad
deploy is "still running the last-good version everywhere," not a partial or fleet-wide outage. This
is deliberately *not* a staged/canary rollout (unnecessary orchestration for a 2-instance ASG where
the failure mode is deterministic and identical on every instance) — it's a cheap, sufficient safety
net for the case the automated health check catches.

For the case a bad image passes the shallow `/health` check but is broken in some way that check
doesn't catch (a business-logic regression, not a crash): the CI deploy step, before overwriting
`image_tag`, first reads its current value and writes it to `previous_image_tag`. An operator (or a
follow-up CI run) can manually roll back by setting `image_tag` back to `previous_image_tag`'s value
and re-sending the same SSM command — `deploy.sh` has no separate "rollback mode"; it always just
pulls-and-health-checks whatever tag it's told, so rolling backward is handled by the identical code
path as rolling forward.

### CI/CD wiring

**Not** modifying `security-scan.yml`'s `container-scan` job. That job is called by both `ci.yml`
(every pull request) and `deploy.yml` (every merge), and deliberately has no AWS credentials today —
`modules/github-oidc/main.tf`'s trust policy only accepts a token from a job that declares
`environment: production`, and `container-scan` is not that job by design (documented in that
module's own comment: the terraform-apply job is "the ONLY job... that requests AWS credentials").
Making `container-scan` conditionally push would mean punching a hole in that documented invariant
for marginal benefit. `security-scan.yml`'s header comment ("out of this sprint's scope... tracked
as a follow-up") is now stale and gets updated to point at where publishing actually happens.

Instead, `deploy.yml` gains two new jobs, both `needs: [scan, terraform-apply]` (infrastructure —
the ECR repo, the IAM statements above, the tagged EC2 instances — must exist before anything can
push to it or target it) and both declaring `environment: production` + `id-token: write`, same
OIDC pattern as `terraform-apply`:

- **`publish-backend-image`** — rebuilds the identical image (same Dockerfile/context/`github.sha`
  tag that `container-scan` already scanned earlier in this same run — deterministic, no artifact
  passing between jobs), pushes to ECR, reads-then-overwrites the SSM tag parameters as described
  above, sends the SSM RunCommand, and **blocks on the result** via `aws ssm get-command-invocation`
  polling — matching this pipeline's existing zero-`continue-on-error` posture. A failed rollout
  fails the job.
- **`publish-frontend`** — independent of the job above, runs in parallel. `npm ci && npm run
  build` in `src/frontend`, `aws s3 sync dist/ s3://pdms-prod-frontend --delete`, then
  `aws cloudfront create-invalidation --paths '/*'`. Wildcard invalidation is the simple choice at
  this traffic scale; not worth the added complexity of content-hashed filenames for a pilot with
  ≤50 concurrent users.

### Bug found and fixed: `health_check_path`

`infrastructure/terraform/variables.tf`'s `health_check_path` defaults to `/api/health` — but
`src/backend/src/app.js:26` only ever mounts a health endpoint at root (`app.get('/health', ...)`,
no `/api` prefix; confirmed no `/api/health` route exists anywhere in
`src/backend/src/routes/`). The ALB target group's health check would 404 forever, so the ASG would
never register healthy no matter how correctly the rollout mechanism above works. Invisible in
Sprint 4 because no application was ever actually running against it at the time. Fixing the
default to `/health`.

---

## Decision 3 — Frontend hosting (`modules/frontend`, new)

- **S3 bucket** `pdms-prod-frontend` — already covered by the github-oidc deploy role's existing
  `pdms-prod-*` S3 wildcard grant, no IAM change needed there. SSE-KMS with the project CMK, full
  public-access block, versioned (matches every other bucket in this project).
- **OAC** (`aws_cloudfront_origin_access_control`), not a public bucket policy. Confirmed via the
  AWS CloudFront skill: OAC, unlike the legacy OAI, supports SSE-KMS origins — the bucket's own
  encryption doesn't need to be weakened to AES256 the way the ALB access-log bucket's had to be
  (that was a different, ELB-log-delivery-specific AWS limitation, not a CloudFront one).
- **KMS key-policy statement**, new, in `modules/kms/main.tf`: grants `cloudfront.amazonaws.com`
  `kms:Decrypt` scoped via `aws:SourceAccount` (this account), **not** `aws:SourceArn` to the exact
  distribution. The existing CloudTrail statement avoids the same kms→cloudtrail module cycle by
  computing the trail's ARN algorithmically from a human-chosen, deterministic name
  (`${project}-${environment}-trail`) — CloudFront distribution IDs are AWS-generated at creation
  time, so there is no equivalent deterministic string to precompute ahead of the distribution
  actually existing. Account-scoping is narrower than the general `AllowServiceUsage` statement
  (still requires the request to originate from a CloudFront distribution in this account) without
  fabricating a precision the module dependency graph can't actually back up.
- **SPA routing**: `custom_error_response` maps both 403 and 404 → `/index.html` at 200 (an
  OAC-fronted private bucket returns 403, not 404, for a missing key, so both must be mapped) plus
  `default_root_object = index.html`.
- **Security headers**: the managed `SecurityHeadersPolicy` response-headers policy (HSTS,
  X-Content-Type-Options, X-Frame-Options, etc.) on the default (SPA) behavior.
- **`/api/*` behavior**: see Decision 1.

**One more IAM addition, on the github-oidc deploy role** (`PublishFrontendInvalidation`, grouped
with Decision 2's IAM changes above): `cloudfront:CreateInvalidation`/`GetInvalidation` scoped to
`module.frontend.cloudfront_distribution_arn` directly — no precomputation problem here, unlike the
KMS statement above, because this is an *identity* policy on a role that has no dependency ordering
conflict with `modules/frontend` (github-oidc doesn't need to exist before frontend does, so it can
simply depend on frontend's real output ARN).

---

## Files touched (for the implementation plan)

New:
- `infrastructure/terraform/modules/ecr/{main,variables,outputs}.tf`
- `infrastructure/terraform/modules/frontend/{main,variables,outputs}.tf`
- `src/backend/deploy.sh` (or embedded via `templatefile()` directly in `modules/ec2` — implementation detail for the plan)

Modified:
- `infrastructure/terraform/modules/ec2/main.tf` — user_data (writes + invokes `deploy.sh` at
  boot), new IAM statements, new SSM parameters + `random_password.jwt_secret`, `variables.tf` for
  the new `ecr_repository_url`/`frontend_distribution_domain_name` inputs.
- `infrastructure/terraform/modules/github-oidc/main.tf` — new IAM statements (ECR push, SSM
  app-config, SSM SendCommand, CloudFront invalidation).
- `infrastructure/terraform/modules/kms/main.tf` — new CloudFront KMS statement.
- `infrastructure/terraform/variables.tf` — fix `health_check_path` default.
- `infrastructure/terraform/main.tf` / `outputs.tf` — wire `module "ecr"`, `module "frontend"`.
- `.github/workflows/deploy.yml` — `publish-backend-image`, `publish-frontend` jobs.
- `.github/workflows/security-scan.yml` — update stale scope-boundary comment only, no behavior
  change.
- `.github/workflows/README.md`, `infrastructure/terraform/README.md` — module list, status lines.
- `docs/psm2/sprints/sprint-5-prep-summary.md` (or similar name — new doc, same pattern as
  `sprint-4-summary.md`) once implemented.

## Verification plan

Static-checkable, no sign-off needed before running: `checkov -d infrastructure/terraform
--framework terraform` (zero unsuppressed findings), `terraform validate`/`plan` (no AWS
credentials needed for `validate`; `plan` needs credentials but not apply-level budget spend),
`trivy fs src/backend --severity CRITICAL`.

Anything that actually provisions or tears down real AWS resources (a live `terraform apply`, live
`terraform destroy`, an actual GitHub Actions run against `deploy.yml`) requires explicit sign-off
first, per this task's own constraints.
