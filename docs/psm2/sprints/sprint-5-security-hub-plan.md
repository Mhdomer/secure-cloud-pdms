# Sprint 5 — AWS Security Hub HIPAA Posture Assessment Plan (Ready to Execute, Not Yet Run)

Status: **drafted, not executed**. Security Hub evaluates the actual deployed configuration and
runtime state of live AWS resources — it cannot produce a real finding against infrastructure that
doesn't exist. Infra was deliberately torn down after Sprint 4 (2026-07-28) to stop free-tier cost
accrual and is not currently live (verified 2026-07-31 — no resources matching this project exist in
`ap-southeast-1`, per the same verification battery Sprint 4's teardown used). Enabling Security Hub
and generating a real HIPAA posture score therefore requires the same live-deployment decision as the
RTO test plan (`docs/psm2/sprints/sprint-5-rto-test-plan.md`) — this document is the runbook for the
moment that sign-off is given, not a substitute for actually running it.

**What this document is not**: a Security Hub score. `docs/psm2/reports/checkov-report.txt` and
cloud-fortress's independent HIPAA §164.312 read of the Terraform source (summarized below and in the
consolidated `sprint-5-security-evaluation.md`) are a code-level design proxy — useful for catching
misconfigurations before they're ever deployed, but not the same instrument as Security Hub, which
checks the live account against AWS's own managed HIPAA control mappings and can catch drift between
what Terraform says and what's actually running (manual console changes, partially-applied resources,
IAM changes made outside Terraform, etc.) that a source-code read structurally cannot see.

---

## Procedure

### Step 1 — Prerequisite: live infrastructure

Security Hub findings are meaningless against an empty account. Run this only once the RTO test plan
(or an equivalent live-deployment decision) has already put the stack up, ideally in the same live
session so the AWS spend is shared across both Sprint 5 deliverables rather than paid for twice.

### Step 2 — Enable Security Hub with the HIPAA standard

```bash
aws securityhub enable-security-hub --region ap-southeast-1
aws securityhub batch-enable-standards \
  --standards-subscription-requests '[{"StandardsArn":"arn:aws:securityhub:ap-southeast-1::standards/hipaa-security-2022"}]'
```

Confirm the exact current ARN for the HIPAA standard via
`aws securityhub describe-standards --region ap-southeast-1` before running the enable command — AWS
periodically revises standard ARNs/versions, and pinning a stale one from documentation would silently
enable nothing.

### Step 3 — Wait for the initial scan

Security Hub's first full evaluation of a newly-enrolled account is not instantaneous — AWS's own
guidance is to allow up to 2 hours for the first complete pass, though individual checks typically
start reporting well before that. Budget for this explicitly if the same live-deployment session is
also being used for the RTO test — do not tear down the infrastructure before this window has
completed, or the posture score will be built on an incomplete first pass.

### Step 4 — Pull the posture score and findings

```bash
aws securityhub get-findings \
  --filters '{"ComplianceStatus":[{"Value":"FAILED","Comparison":"EQUALS"}],"RecordState":[{"Value":"ACTIVE","Comparison":"EQUALS"}]}' \
  --region ap-southeast-1 > docs/psm2/reports/security-hub-findings.json

aws securityhub get-insight-results \
  --insight-arn arn:aws:securityhub:ap-southeast-1::insight/securityhub/default/hipaa-compliance-summary \
  --region ap-southeast-1
```

(The exact insight ARN/console path for the aggregate HIPAA compliance percentage should be confirmed
against the live Security Hub console at run time — insight ARNs and the summary-widget structure have
changed across Security Hub console versions.)

Save the raw findings JSON to `docs/psm2/reports/security-hub-findings.json` (do not commit if it
contains account-identifying detail beyond what's already public in this repo — resource ARNs
containing the account ID `730077843716` are already public via this project's own commit history, so
this is a judgment call at the time, not a hard rule to pre-decide here).

### Step 5 — Triage and remediate CRITICAL findings before Sprint 5 sign-off

Chapter-3 §3.3.5's security gate is explicit: *"The critical findings from Security Hub should be
remediated before sprint completion."* Triage order:

1. **CRITICAL** severity findings — must be remediated (or have a documented, justified exception —
   same discipline this project already uses for Checkov's `# checkov:skip` comments) before Sprint 5
   can be marked complete.
2. **HIGH** severity findings — remediate where the fix is low-risk and well-understood; document as
   a tracked follow-up otherwise, same "adjudicate and move on" discipline the post-Sprint-4 work
   already established for its own residual Minor findings.
3. **MEDIUM/LOW** — document in the evaluation report; not a completion blocker.

### Step 6 — Findings already anticipated from the static/IaC-level review

cloud-fortress's independent HIPAA §164.312 read of the Terraform source (full detail in
`docs/psm2/sprints/sprint-5-security-evaluation.md`) already flagged two gaps that Security Hub should
also surface once live, so they are not expected to be surprises:

- **§164.312(e) Transmission Security — `enable_https = false`.** Security Hub's HIPAA standard
  includes checks equivalent to Checkov's `CKV_AWS_2`/`CKV_AWS_103`/`CKV2_AWS_20` (ALB not using
  HTTPS/TLS1.2/redirect) — expect these to surface as FAILED, almost certainly at HIGH or CRITICAL
  severity given this control's direct relevance to ePHI transmission. This is the one already-known
  gap most likely to actually block "zero CRITICAL findings" at Step 5 — remediating it means
  registering a domain and an ACM certificate and flipping `enable_https` back to `true`
  (`infrastructure/terraform/variables.tf`), which is exactly the pending, budget-gated decision
  CLAUDE.md's "Key Design Decisions" section already documents. If this is the blocking CRITICAL
  finding, the remediation path is already designed and ready — it just needs the domain/cert
  prerequisite satisfied first.
- **§164.312(d) Person or Entity Authentication — no MFA anywhere in the login path.** Security Hub's
  HIPAA standard does not have a direct per-application-login-MFA check (it evaluates AWS IAM/root
  account MFA, not this project's own JWT-based application auth), so this specific gap will likely
  **not** appear as a Security Hub finding even though it's real — flagging here so it isn't
  mistakenly treated as "cleared" just because Security Hub has nothing to say about it. This is
  tracked as an application-layer recommendation in the evaluation report regardless of what Security
  Hub reports.

### Step 7 — Write the posture summary into the evaluation report

Record: standard enabled, overall percentage score (as displayed in the Security Hub console/API at
the time), count of findings by severity, which were remediated vs. documented as accepted exceptions,
and the final CRITICAL-findings-remaining count (must be zero to close this gate per chapter-3
§3.3.5).

### Step 8 — Decide whether to disable Security Hub before teardown

Security Hub itself has an ongoing per-check cost once enabled (small, but not zero, and separate from
the compute/networking cost the RTO test plan already accounts for). If the live session is ending
with a teardown (per the RTO plan's Phase 4), disable Security Hub explicitly rather than assuming
`terraform destroy` handles it — Security Hub is an account-level, not Terraform-managed, AWS setting
in this project (it was never added to `infrastructure/terraform/` since it's an evaluation tool for
this project, not part of the application's own required infrastructure):

```bash
aws securityhub disable-security-hub --region ap-southeast-1
```

---

## What still needs a human decision before this can run

Same gate as the RTO test plan: this requires live AWS infrastructure and incurs both the shared
compute cost of that deployment and Security Hub's own small ongoing per-check cost for however long
it stays enabled. This document does not authorize itself.
