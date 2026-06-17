# DevSecOps CI/CD Pipeline

**Status: PSM 2 — Not yet implemented**

## 6-Stage Pipeline (GitHub Actions)

```
[1] Code Checkout
      ↓
[2] SonarQube SAST
      → Blocks on CRITICAL finding
      ↓
[3] Docker Build
      ↓
[4] Trivy Image Scan
      → Blocks on CRITICAL CVE
      ↓
[5] Checkov IaC Scan
      → Blocks on HIGH or CRITICAL misconfiguration
      ↓
[6] Terraform Apply
      → Only runs if ALL 3 scans pass
```

No manual deployment is ever allowed. Every commit to `main` goes through all 6 stages.

## Planned Workflow Files

| File | Purpose |
|---|---|
| `ci.yml` | Checkout → SAST → Docker Build → Trivy |
| `security.yml` | Checkov IaC scan on Terraform changes |
| `deploy.yml` | Terraform Apply → EC2 deploy via SSM (no SSH) |

Deployment to EC2 uses AWS SSM RunShellScript — port 22 is never open.
