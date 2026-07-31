# Sprint 5 — RTO Test Plan (Ready to Execute, Not Yet Run)

Status: **drafted, not executed**. This is a runbook, not a result. Running it requires a live
`terraform apply` (and a `terraform destroy` beforehand to simulate the wipe), which spends real AWS
budget and briefly re-exposes the account to whatever risk a live deployment carries — the same
cost/blast-radius category of decision Sprint 4's live deployment needed explicit sign-off for (see
`docs/psm2/sprints/sprint-4-summary.md`, "Live deployment and troubleshooting"). Infra was
deliberately torn down after that session to stop free-tier cost accrual. This plan exists so the
test can be run in a single sitting the moment that sign-off is given, without re-deriving the
procedure from scratch.

---

## What this test measures

Chapter-3 methodology Section 3.3.5 / 3.5.2 (NFR-06): simulate a total infrastructure wipe (the
ransomware scenario that motivated this whole project — Alamin Clinic's on-premise server was down
for five days) and measure how long it takes to get the system back to a healthy, serving state using
nothing but the Terraform configuration already committed to `main`. **Target: ≤ 15 minutes.**

This specifically measures **infrastructure redeployment time** (chapter-5 §5.3's own wording: "time
required for redeployment, compared to NFR-06"), not a full clinical-data point-in-time restore. RDS's
automated backups (`db_backup_retention_period`, currently 1 day per
`infrastructure/terraform/variables.tf` — see the Sprint 4 "FreeTierRestrictionError" bug entry in
`sprint-4-summary.md` for why it isn't the module's secure-by-default 7) are a separate, complementary
control for data durability, not the timer this test is measuring. Noted at the end of this plan as a
secondary check worth doing in the same session, since the infra will already be up.

---

## Why this should go straight through this time

Sprint 4's first-ever live `terraform apply` (2026-07-28) hit 5 real bugs across roughly 2+ hours —
S3 bucket name collision, a UTF-8 character AWS rejects in security-group descriptions, an RDS
free-tier/engine-version mismatch, an ASG timeout misconfigured for an application that wasn't
deployed yet, and a chain of KMS key-policy gaps for CloudWatch/SNS/CloudTrail. **All five are fixed
in the current `main`** (see `sprint-4-summary.md`'s numbered bug list, each with its own commit). The
2026-07-30 follow-up session's live deployment (ECR/SSM rollout, frontend hosting) surfaced five more
bugs on top of that, also all fixed and live-verified end to end. `terraform plan` was re-verified
clean (0 errors, 125 to add / 0 to change / 0 to destroy) after every fix wave. There is no known
outstanding `apply`-blocking bug in the current source — this run should be the first "boring" one.

That said, do not assume — this plan includes explicit timestamps at every stage specifically so a
surprise (AWS API throttling, a fresh AMI ID needing re-resolution, a transient service quota) is
caught and timed honestly rather than glossed over.

---

## Prerequisites (confirm before starting the clock)

1. **AWS credentials** — the bootstrap IAM user (`nonlouy`, `AdministratorAccess` group,
   account `730077843716`, `ap-southeast-1`) or equivalent. Day-to-day CI/CD uses the OIDC deploy
   role, but a `terraform destroy` of this magnitude should be run with the same operator credentials
   Sprint 4's bootstrap used, not the deploy role (the deploy role's IAM is scoped for `apply`, not
   audited here for `destroy` coverage).
2. **Terraform CLI** installed and on `PATH` (v1.15.8 confirmed working in Sprint 4;
   `C:\Users\md3om\AppData\Local\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe`
   if a fresh shell doesn't pick up PATH).
3. **`infrastructure/terraform/terraform.tfvars`** exists locally (git-ignored — confirm via
   `git check-ignore infrastructure/terraform/terraform.tfvars`). If missing, recreate per
   `terraform.tfvars.example` with:
   - `kms_key_administrator_arns = ["arn:aws:iam::730077843716:user/nonlouy"]` (or current operator ARN)
   - `ec2_ami_id` — **re-resolve this, don't reuse the old value blindly.** AL2023 AMIs are
     periodically deprecated (this exact class of failure happened in Sprint 4 bug #3, for the RDS
     engine version, not the AMI — but the same "pinned version may have aged out" risk applies here).
     Resolve fresh via `aws ssm get-parameters --names /aws/service/ami-amazon-linux-latest/al2023-ami-minimal-kernel-default-x86_64`
     or `aws ec2 describe-images` filtered the same way Sprint 4 did. Keep the **Minimal** AMI variant
     — `user_data.sh.tpl` already explicitly installs `amazon-ssm-agent` to compensate (Sprint 4 bug
     #4), so switching to the standard AMI is not needed and would silently drop that fix's coverage.
4. **GitHub secrets already correct** — `AWS_DEPLOY_ROLE_ARN`, `SONAR_HOST_URL`, `SONAR_TOKEN`,
   `TF_EC2_AMI_ID`, `TF_KMS_KEY_ADMINISTRATOR_ARNS` (confirmed present via `gh secret list` as of
   2026-07-31; `TF_EC2_AMI_ID` specifically needs updating if step 3 resolves a new AMI ID).
5. **Explicit go-ahead to spend AWS budget for this session** — this is the sign-off gate this plan
   exists to make fast once given, not something this plan grants on its own.

---

## Procedure

Record a wall-clock timestamp at every numbered step. Use `date -u +%H:%M:%S` (UTC, avoids local
timezone arithmetic errors) before and after each command.

### Phase 0 — Simulate the wipe

```bash
cd infrastructure/terraform
terraform plan -destroy -var-file="terraform.tfvars"   # sanity-check what's about to go, before committing
terraform destroy -var-file="terraform.tfvars"
```

Expect the same two manual pre-steps Sprint 4's real teardown needed (both `aws_rds_instance` and
`aws_lb` have deletion protection **on** by design):

```bash
aws rds modify-db-instance --db-instance-identifier pdms-prod-db --no-deletion-protection --apply-immediately
aws elbv2 modify-load-balancer-attributes --load-balancer-arn <arn> --attributes Key=deletion_protection.enabled,Value=false
```

Both re-enable automatically on the next `apply` (the Terraform source still says `true` — only the
live resource attribute was flipped), which is the deliberately correct behavior, not a gap to fix.

If this is not literally the first teardown after a real deployment window, also expect
`BucketNotEmpty` on `pdms-prod-cloudtrail-logs` / `pdms-prod-alb-access-logs` (both versioned, neither
sets `force_destroy`) — empty via `aws s3api list-object-versions` → `aws s3api delete-objects` before
retrying `destroy`, exactly as documented in `sprint-4-summary.md`'s Teardown section. **Do not count
this manual cleanup time against the RTO clock below** — it's wipe-simulation housekeeping, not part
of the recovery being measured, and a real ransomware event wouldn't leave these buckets in a
"deletion_protection: true, needs to be turned off first" state either (the attacker doesn't
politely ask AWS to unprotect the resources they're about to encrypt).

Record: `T_wipe_start`, `T_wipe_complete`. Independently verify nothing remains
(`aws ec2 describe-vpcs` / `describe-nat-gateways` / `describe-instances`,
`aws rds describe-db-instances`, `aws elbv2 describe-load-balancers`, `aws s3api list-buckets` — same
verification battery Sprint 4's teardown used) before starting the clock in Phase 1. This is the
"confirm the wipe is real" step, not part of the timed recovery either.

### Phase 1 — Timed recovery (this is the number that goes in the report)

```bash
date -u +%H:%M:%S   # T_recovery_start
cd infrastructure/terraform
terraform init                              # re-fetches providers/backend; only needed if this is a fresh clone/shell
terraform apply -var-file="terraform.tfvars" -auto-approve
```

Do not hand-hold this with `-auto-approve` removed and manual confirmation — a real recovery under
time pressure wouldn't pause for a human to type "yes", and NFR-06's 15-minute target implicitly
assumes a scripted, unattended apply. (`-auto-approve` is safe here specifically because Phase 0
already independently verified the account is empty — there is nothing a stray `apply` could
destructively overwrite.)

Record `date -u +%H:%M:%S` the moment `terraform apply` prints `Apply complete!` — call this
`T_terraform_complete`. **This is not yet "recovered"** — the ASG's instances still need to boot,
pull the backend image, and pass the ALB health check before the system is actually serving traffic
again. Continue timing:

```bash
# Poll until both ASG instances are InService AND the ALB target group reports healthy
watch -n 10 'aws elbv2 describe-target-health --target-group-arn <arn> --query "TargetHealthDescriptions[].TargetHealth.State"'
```

Record `T_targets_healthy` the moment both show `healthy`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<cloudfront-domain>/
curl -s -o /dev/null -w "%{http_code}\n" https://<cloudfront-domain>/api/health
```

Record `T_traffic_serving` the moment both return `200`. **This — not `terraform apply`'s own exit —
is the true end of the recovery window**, since a customer/patient hitting the site during the gap
between `terraform apply` finishing and the ALB actually routing healthy traffic would still see an
outage.

### Phase 2 — Compute and record RTO

```
RTO = T_traffic_serving − T_recovery_start
```

Report all four intermediate timestamps (`T_recovery_start`, `T_terraform_complete`,
`T_targets_healthy`, `T_traffic_serving`), not just the final delta — this is what lets the report
show *where* the 15 minutes actually goes (e.g., "9 min Terraform graph apply, 4 min instance
boot + health-check-before-swap, 2 min ALB health-check interval convergence") rather than a single
opaque number.

### Phase 3 — Optional secondary check: data durability (not part of the RTO number)

If this session's wipe included a populated RDS instance (real or seeded test data) rather than an
empty fresh database, note separately whether the restored instance came from an automated backup /
snapshot and how current that data was, as a qualitative note on `db_backup_retention_period`'s
practical adequacy. This is deliberately **not** blended into the RTO timestamp above — chapter-5
§5.3 defines RTO here as redeployment time specifically, and conflating "how long until the
infrastructure exists again" with "how much data was lost" would make the single reported number
answer two different questions badly instead of one question well.

### Phase 4 — Teardown again (unless the go-ahead was to leave it running)

Same procedure as Sprint 4's teardown (disable deletion protection → `terraform destroy` →
empty any non-empty log buckets → retry destroy → independently verify empty). Do this in the same
session as the test, not as a follow-up — leaving the freshly-proven-working infra live past the
point it's needed re-introduces the exact free-tier cost accrual it was torn down to avoid.

---

## Expected timing budget (estimate, not a guarantee — the actual run supersedes this)

| Stage | Rough AWS-typical duration | Notes |
|---|---|---|
| VPC, subnets, IGW, route tables, NACLs, security groups | 1–2 min | Fast, no cross-service dependency chains |
| NAT Gateway | 1–3 min | AWS-side provisioning, not Terraform-side wait |
| KMS CMK + alias | <1 min | |
| RDS instance (`db.t3.micro`, single-AZ per current `terraform.tfvars`) | 5–10 min | Historically the single slowest resource in this stack; Multi-AZ (if ever turned on) would roughly double this |
| ALB + target group + listeners | 1–2 min | |
| ASG launch template + instances reaching `InService` | 2–4 min | Includes cloud-init, Docker install, SSM agent registration, image pull, container health-check-before-swap |
| ALB target-group health check convergence | up to `health_check_grace_period` worth of check intervals | Currently 600s grace period, but convergence is typically much faster than the grace-period ceiling once the container is actually healthy |
| CloudTrail, CloudWatch, monitoring, ECR, frontend (S3/CloudFront) | mostly parallel with the above in Terraform's dependency graph | CloudFront distribution creation is the one AWS-side operation known to sometimes exceed a few minutes even after Terraform reports it "deployed" |

Sum of the median column is comfortably under 15 minutes, but RDS provisioning alone can occasionally
run long enough on its own that the 15-minute target is not a large margin — this is the one stage
worth watching most closely during the actual run, and the one most likely candidate if the target is
ever missed.

---

## Pass/fail criteria

- **Pass**: `T_traffic_serving − T_recovery_start ≤ 15 minutes`, both `/` and `/api/health` returning
  200, both ASG targets `healthy`.
- **Fail (but still a valid, reportable result)**: exceeds 15 minutes. Report the actual number and
  the stage-by-stage breakdown regardless of pass/fail — chapter-5's own methodology asks for "the
  time taken to recover," not a pass/fail gate on this specific number blocking the report from being
  written. (Chapter-3 §3.3.5's security gate is "RTO test is done and documented," not "RTO must be
  ≤15 min or the sprint doesn't complete" — a documented miss is a legitimate finding with a
  remediation recommendation, e.g. Multi-AZ RDS trading recovery speed for durability, or a smaller
  RDS instance class for faster provisioning.)

## What still needs a human decision before this can run

Running this plan spends real AWS budget (NAT Gateway, RDS, ALB, EC2 hours for the duration of the
test) and briefly puts the account back into the same live, billable state Sprint 4 deliberately tore
down. This plan does not authorize itself — it's the runbook ready for whenever that authorization is
given.
