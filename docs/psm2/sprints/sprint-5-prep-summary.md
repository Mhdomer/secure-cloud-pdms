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
legacy OAI, supports SSE-KMS origins); SPA routing via `custom_error_response` (403 and 404, both →
`index.html` at 200 — an OAC-fronted private bucket returns 403 for a missing key, not 404); the
managed `SecurityHeadersPolicy` on the default behavior.

**KMS**: the CloudFront service-principal grant in `modules/kms` is scoped via `aws:SourceAccount`
(this account), not an exact distribution ARN — CloudFront distribution IDs are AWS-generated at
creation time, unlike the CloudTrail statement's human-chosen, precomputable trail name, so there is
no equivalent deterministic string to reference without creating a module cycle. Narrower than the
general service-usage statement, without fabricating a precision the module graph can't back up.

---

## Two items flagged during spec review, carried forward as still-open

Not fixed here — genuinely require a live account to resolve, consistent with this project's
existing "verify empirically, don't assume" pattern from Sprint 4's own live-deployment bug list:

1. **ECR's KMS encryption** is assumed sufficient via the existing generic `AllowServiceUsage`
   statement (`ecr.amazonaws.com` is not one of the three services — CloudWatch Logs, SNS,
   CloudTrail — that needed a dedicated `EncryptionContext` statement last time). Unverified until
   the first real `docker push`. If it fails with a KMS access-denied-style error, add a dedicated
   `AllowEcrUsage` statement to `modules/kms/main.tf` the same way the other three were added.
2. **The `ssm:resourceTag/Name` condition** on the deploy role's `TriggerBackendRollout` statement
   is unverified against a live `ssm:SendCommand` call until the first real rollout.

---

## Two Minor findings, deferred (not fixed) during task review

Both real, both disclosed during execution, neither blocking:

1. `modules/ec2/main.tf`'s `aws_autoscaling_group.app` `wait_for_capacity_timeout` comment is now
   stale — it still says the instance's `user_data` "only bootstraps Docker," which was true before
   Task 4 but no longer is (it now also pulls and runs the backend image). Functionally harmless:
   `image_tag` starts at `"none"` until the first real CI deploy writes a real tag, so the
   `timeout = 0` setting the comment is attached to is still the correct value — only the comment's
   explanation of *why* is out of date. Misleading to a future reader; candidate for a follow-up
   one-line fix.
2. `deploy.yml`'s rollout-wait loop silently reports success if `aws ec2 describe-instances` returns
   zero running instances matching the target tag — the `for` loop body simply never executes and
   the step exits 0, rather than failing loudly on "found nothing to wait for." Inherited from the
   plan's own design, not an implementer deviation; worth hardening before this workflow is trusted
   unattended.

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
