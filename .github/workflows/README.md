# DevSecOps CI/CD Pipeline

**Status: PSM 2 Sprint 4 — implemented**

## 6-Stage Pipeline (GitHub Actions)

```
[1] Code Checkout
      |
[2] SonarQube SAST          -- security-scan.yml: job "sast"
      -> Blocks on failed Quality Gate (incl. hardcoded secrets, SQLi rules)
      |
[3] Docker Build            -- security-scan.yml: job "container-scan"
      |
[4] Trivy Image Scan        -- security-scan.yml: job "container-scan"
      -> Blocks on CRITICAL CVE
      |
[5] Checkov IaC Scan        -- security-scan.yml: job "iac-scan"
      -> Blocks on any unsuppressed finding (this project accepts specific,
         justified exceptions via inline `# checkov:skip=...` comments in
         the .tf files themselves, not a CI severity filter)
      |
[6] Terraform Apply         -- deploy.yml: job "terraform-apply"
      -> Only runs if ALL 3 scan jobs above passed (needs: scan)
```

No manual deployment is ever allowed. Every pull request against `main` runs stages 1-5. Every push to `main` (i.e. every merge) runs stages 1-6.

## Workflow Files

| File | Trigger | Purpose |
|---|---|---|
| `security-scan.yml` | `workflow_call` (reusable) | Stages 2-5: SonarQube SAST, Docker build, Trivy image scan, Checkov IaC scan. Called by both `ci.yml` and `deploy.yml` so the two never drift out of sync. |
| `ci.yml` | `pull_request` → `main` | Calls `security-scan.yml`. Never deploys. |
| `deploy.yml` | `push` → `main` | Calls `security-scan.yml`, then — only if that job succeeds — runs `terraform init/validate/plan/apply` against `infrastructure/terraform` using OIDC-derived AWS credentials. |

## Required repository configuration (out-of-band, not in this directory)

These are GitHub repo settings and secrets, not files — none of them are committed. **All fully
configured as of 2026-07-28** — see `docs/psm2/sprints/sprint-4-summary.md`'s "live deployment" entry
for how/when each one was set:

- **GitHub Environment** named `production`, with a required-reviewer protection rule (you —
  `Mhdomer`), referenced by `deploy.yml`'s `environment: production`. Set via `gh api`, not the web UI.

  **Expect three approval prompts per merge, not one.** Three jobs in `deploy.yml` declare
  `environment: production` — `terraform-apply`, `publish-backend-image`, and `publish-frontend` — and
  GitHub evaluates the environment's protection rules per job, so each one pauses for its own
  approval. This is intended, not a broken pipeline: each job independently re-authenticates via OIDC,
  and the `sub` claim GitHub mints for it is the `repo:OWNER/REPO:environment:production` form that
  `modules/github-oidc`'s trust policy accepts — the environment declaration is what puts all three
  inside the same trust boundary in the first place. Dropping it from two of them to get a single
  prompt would also drop their ability to assume the deploy role at all.
- **Secrets, all 5 set**: `SONAR_TOKEN`, `SONAR_HOST_URL`, `AWS_DEPLOY_ROLE_ARN`
  (`arn:aws:iam::730077843716:role/pdms-prod-deploy-role` — OIDC role ARN, no long-lived AWS access
  keys are ever stored), `TF_KMS_KEY_ADMINISTRATOR_ARNS`, `TF_EC2_AMI_ID` (map 1:1 to `infrastructure/terraform/variables.tf`'s no-default variables, supplied as `TF_VAR_*` instead of a
  committed `terraform.tfvars`). `TF_ACM_CERTIFICATE_ARN` is deliberately **not** set —
  `acm_certificate_arn` now defaults to `""` and `enable_https` defaults to `false` (no domain
  registered yet; see `infrastructure/terraform/variables.tf`'s `enable_https` comment), so it isn't
  needed until that changes.
- **AWS IAM**: the OIDC identity provider + deploy role (`infrastructure/terraform/modules/github-oidc`)
  were bootstrapped via a real, manual `terraform apply` against AWS account `730077843716` on
  2026-07-28 — the deploy role exists (name is deterministic:
  `${project_name}-${environment}-deploy-role`, currently `pdms-prod-deploy-role`) even though the rest
  of that same apply's infrastructure was torn down afterward to stop cost accrual. Re-running
  `terraform apply` recreates everything identically, deploy role included.

## Deliberately out of scope for Sprint 4

- ~~Container registry (ECR) and automated EC2 rollout~~ — **built**, see
  `docs/superpowers/specs/2026-07-30-post-sprint4-deploy-and-frontend-hosting-design.md` and
  `docs/psm2/sprints/sprint-5-prep-summary.md`. `deploy.yml`'s `publish-backend-image` job pushes to
  ECR and rolls out via SSM `RunShellScript` (port 22 still never open) after this workflow's scans
  pass and `terraform-apply` succeeds.
- **Triggering `deploy.yml` through an actual GitHub Actions run.** The underlying `terraform init/validate/plan/apply` sequence this job runs has now been verified for real (see `docs/psm2/sprints/sprint-4-summary.md`) — run manually, locally, with the same AWS account and Terraform config this workflow uses. What hasn't been exercised yet is the workflow *file* itself actually firing on a real push to `main` (OIDC token exchange from within an Actions runner, the `production` environment's approval gate stopping the job, etc.) — that still needs a real push to confirm end-to-end, since no GitHub Actions runner was available to trigger from this environment.
