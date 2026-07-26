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

These are GitHub repo settings and secrets, not files — none of them are committed:

- **GitHub Environment** named `production` with a required-reviewer protection rule, referenced by `deploy.yml`'s `environment: production`.
- **Secrets**: `SONAR_TOKEN`, `SONAR_HOST_URL`, `AWS_DEPLOY_ROLE_ARN` (OIDC role ARN — no long-lived AWS access keys are ever stored), `TF_KMS_KEY_ADMINISTRATOR_ARNS`, `TF_ACM_CERTIFICATE_ARN`, `TF_EC2_AMI_ID` (map 1:1 to the no-default variables in `infrastructure/terraform/variables.tf`, supplied as `TF_VAR_*` instead of a committed `terraform.tfvars`).
- **AWS IAM**: an OIDC identity provider trusting `token.actions.githubusercontent.com`, and a role scoped to this repository that `AWS_DEPLOY_ROLE_ARN` points at, with least-privilege permissions to run `terraform apply` against this project's resources. Provisioning that role is a bootstrap step outside this pipeline's own Terraform (the pipeline cannot grant itself the permissions it needs to run).

## Deliberately out of scope for Sprint 4

- **Container registry (ECR) and automated EC2 rollout.** `container-scan` builds and Trivy-scans the backend image but never pushes it anywhere — chapter-3/chapter-5's Sprint 4 scope is the CI/CD pipeline plus CloudWatch and CloudTrail, not container registry provisioning. Publishing the scanned image and rolling it out to the EC2 Auto Scaling Group (via SSM `RunShellScript` — port 22 is never open) is a documented follow-up, not implemented here.
- **Live pipeline verification.** The scan/apply steps above are written to run for real once the repository secrets and OIDC role exist, but they have not been executed against a live GitHub Actions runner or a real AWS account from this environment (no AWS credentials, no Terraform CLI, no live SonarQube server available here). `checkov` and `trivy` were run locally against the current source as the Sprint 4 security gate instead — see `docs/psm2/sprints/sprint-4-summary.md`.
