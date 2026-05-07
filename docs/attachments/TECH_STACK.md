---
tags: [fyp, tech-stack, reference]
status: locked
created: 2026-05-08
---

# Confirmed Tech Stack

Single source of truth for all technology decisions. If a chapter, diagram, or code file contradicts this — fix the chapter/diagram/code, not this file.

---

## Application Layer

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | React | 18+ (Vite) | SPA, React Router for client-side routing |
| Backend | Node.js + Express | Node 20 LTS | REST API, same patterns as MindCraft |
| Authentication | JWT (HS256) + bcrypt | — | httpOnly cookies, same MindCraft pattern |
| Database | PostgreSQL | 16 | On Amazon RDS — NOT self-managed on EC2 |
| DB Access | node-postgres (`pg`) or Sequelize | — | Replaces Mongoose from MindCraft |

---

## Infrastructure (AWS)

| Component | Service | Notes |
|-----------|---------|-------|
| Network | Amazon VPC | CIDR 10.0.0.0/16, 6 subnets across 2 AZs |
| Public tier | Application Load Balancer (ALB) | HTTPS only, TLS via ACM, redirects HTTP → HTTPS |
| App tier | Amazon EC2 | Docker containers, private subnet, no port 22 |
| DB tier | Amazon RDS (PostgreSQL) | Private isolated subnet, KMS encrypted, 7-day backups |
| Container registry | Amazon ECR | Trivy-scanned images only |
| Secrets | AWS Secrets Manager | DB credentials, no hardcoded secrets anywhere |
| Encryption keys | AWS KMS | RDS at rest, EBS, Secrets Manager |
| Certificates | AWS ACM | TLS cert on ALB |
| DNS | Amazon Route 53 | Domain required for ACM cert |
| Scaling | EC2 Auto Scaling Group | Horizontal scale on CPU/memory |
| NAT | NAT Gateway | Outbound-only for private subnets |
| Deploy method | SSM RunShellScript | No SSH, no port 22 open |

---

## DevSecOps Pipeline (GitHub Actions)

| Workflow | File | Trigger | What it does |
|----------|------|---------|--------------|
| CI | `ci.yml` | All branches | `npm ci` + build — fast feedback |
| Security | `security.yml` | Push to main | npm audit + Checkov + SonarCloud + Trivy |
| Deploy | `deploy.yml` | After security passes | Trivy gate → ECR push → SSM deploy |

### Security Scanners

| Tool | What it scans | Blocks on |
|------|--------------|-----------|
| **Trivy** | Docker image CVEs | CRITICAL severity |
| **SonarCloud** | Source code (SAST) | Critical/High security issues |
| **Checkov** | Terraform IaC | High/Critical misconfigurations |
| **npm audit** | Node.js dependencies | Critical vulnerabilities |

---

## Infrastructure as Code

| Tool | Version | Module structure |
|------|---------|-----------------|
| Terraform | ~> 5.0 (AWS provider) | `vpc/`, `security-groups/`, `ec2/`, `rds/`, `alb/`, `kms/`, `cloudwatch/`, `secrets/` |
| State backend | S3 + DynamoDB lock | Remote state, never local |

---

## Observability & Compliance

| Tool | Purpose |
|------|---------|
| Amazon CloudWatch | Container logs, CPU/memory metrics, alarms |
| AWS CloudTrail | Every AWS API call logged to S3, tamper-evident |
| AWS Security Hub | HIPAA posture assessment — primary compliance metric |
| Grafana Cloud (optional) | Performance dashboard during load testing |

---

## Containerisation

| Component | Base image | Notes |
|-----------|-----------|-------|
| Frontend | `nginx:alpine` | Multi-stage build — React build served via nginx |
| Backend | `node:20-alpine` | Multi-stage build, non-root user, health check at `GET /health` |
| Local dev DB | `postgres:16-alpine` | Docker Compose only — production uses RDS |

---

## What is NOT in scope

These were evaluated and explicitly excluded:

| Technology | Why excluded |
|-----------|-------------|
| Flask / Python | No prior experience; Node.js carries over directly from MindCraft |
| MongoDB | No row-level security; ACID guarantees needed for medical records |
| MySQL | PostgreSQL chosen for native RLS and better HIPAA alignment |
| Next.js | MindCraft used it; FYP uses plain React — simpler, no SSR needed |
| Self-hosted SonarQube | SonarCloud free tier sufficient for FYP |
| Multi-region AWS | Out of scope; single region (ap-southeast-1) |
| HL7/FHIR integration | Enterprise feature, out of scope for clinic prototype |
| Billing / Pharmacy modules | Out of scope per Chapter 1 Section 1.5 |

---

## MindCraft → FYP Reuse Map

Files that carry over almost directly from the prior MindCraft project:

| MindCraft file | FYP usage |
|---------------|-----------|
| `server/middleware/auth.js` | `requireAuth`, `requireRole` — same JWT cookie pattern |
| `server/config/env.js` | Same env validation pattern |
| `lib/api.js` | Same centralised fetch wrapper for React |
| `terraform/modules/vpc/` | Copy directly — same VPC structure |
| `terraform/modules/security-groups/` | Copy — add `sg-rds` (port 5432) |
| `terraform/modules/alb/` | Copy — update to HTTPS listener |
| `terraform/modules/cloudwatch/` | Copy — update names |
| `.github/workflows/ci.yml` | Copy — update paths |
| `.github/workflows/deploy.yml` | Copy — add Checkov, update for RDS |
| `Dockerfile.api` | Copy — same Node.js multi-stage pattern |

**What must be built from scratch:**
- React frontend (MindCraft used Next.js — different routing, build, serve)
- PostgreSQL schema + `pg`/Sequelize (replaces Mongoose)
- RDS Terraform module (subnet group, parameter group, KMS, backup config)
- KMS Terraform module
- CloudTrail Terraform module
- Checkov + SonarCloud GitHub Actions integration
- ACM + Route 53 HTTPS setup
- Application-level `audit_log` middleware
