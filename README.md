# Design and Deployment of a Secure Cloud-Based Patient Data Management System

**UTM Final Year Project (PSM) | A23CS4014 — Mohamed Omar Makhlouf**  
**Supervisor: Dr. Johan Mohamad Sharif | Session 2025/2026**

---

## Project Overview

A secure, three-tier cloud infrastructure for **Alamin Clinic (Saudi Arabia)**, designed to replace a vulnerable on-premise system that was compromised by a ransomware attack in May 2023 (5-day outage, permanent data loss). The system is built on AWS using Terraform IaC, with a 6-stage DevSecOps CI/CD pipeline enforcing automated security scanning at every commit.

### Core Architecture
```
Internet
  └── ALB (HTTPS) — Public Subnet
        └── Node.js / Express on EC2 — Private App Subnet
              └── PostgreSQL on RDS (Multi-AZ) — Isolated Private DB Subnet
```
React frontend served via S3 + CloudFront (outside VPC).

---

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 18 (Vite) | SPA, React Router v6, S3 + CloudFront |
| Backend | Node.js 20 / Express | REST API, JWT (httpOnly cookie), bcrypt cost 12 |
| Database | PostgreSQL 16 on Amazon RDS | Row-Level Security, KMS encrypted, Multi-AZ |
| IaC | Terraform | ~35 resources, remote state in S3 + DynamoDB |
| CI/CD | GitHub Actions | 3 workflow files: ci, security, deploy |
| Container | Docker + Amazon ECR | Multi-stage builds, non-root user |
| Security Scanning | SonarQube, Trivy, Checkov | Block on CRITICAL/HIGH findings |
| Secrets | AWS Secrets Manager | No hardcoded credentials |
| Encryption | AWS KMS | RDS at rest, EBS, Secrets Manager |
| HTTPS | AWS ACM + ALB | TLS 1.2+, HTTP → HTTPS redirect |
| Deploy | AWS SSM RunShellScript | No SSH, port 22 never open |
| Monitoring | CloudWatch + CloudTrail | Logs, metrics, alarms, full API audit |
| Region | ap-southeast-1 (Singapore) | PDPA 2010 data residency compliance |

---

## Repository Structure

```
├── src/
│   ├── backend/            Node.js / Express REST API (PSM 2)
│   └── frontend/           React SPA (PSM 2)
│
├── infrastructure/
│   └── terraform/          Terraform IaC — all AWS resources (PSM 2)
│
├── .github/
│   └── workflows/          DevSecOps CI/CD pipeline — 6 stages (PSM 2)
│
├── docs/
│   ├── report/             PSM 1 report — all 5 chapters (Markdown source)
│   │   └── front-matter/   Abstract, abbreviations, bibliography
│   ├── design/             Architecture, use cases (UC-01 to UC-18), security
│   ├── attachments/        All figures and diagrams (PNG exports)
│   ├── presentation/       Viva slides (PPTX), speaker script, templates
│   ├── references/         Viva prep, interview prep, UTM docs
│   ├── psm1-submission/    Submitted PDFs and forms (gitignored)
│   └── psm2/               PSM 2 implementation plan and checklist
│
├── Draw.io files/          Editable source diagrams (.drawio)
├── scripts/figures/        Python scripts used to generate report figures
├── blog/_posts/            Jekyll blog entries
└── linkedin/posts/         LinkedIn progress posts
```

---

## Progress

### PSM 1 — Design & Documentation (Complete)

| Item | Status |
|---|---|
| Chapter 1 — Introduction | Done |
| Chapter 2 — Literature Review | Done |
| Chapter 3 — Methodology | Done |
| Chapter 4 — Requirement Analysis and Design | Done |
| Chapter 5 — Conclusion | Done |
| Abstract (English + Bahasa Melayu) | Done |
| Appendices (A–H) | Done |
| Viva Presentation (PPTX) | Done |
| Final report submitted to committee | Done |

**PSM 1 deliverables:** 18 use cases · 12 FR · 11 NFR · 3-tier AWS VPC design · 3-layer RBAC (JWT + IAM + RLS) · 6-stage DevSecOps pipeline design · 6-table DB schema · 4 wireframes · HIPAA §164.312 compliance mapping

### PSM 2 — Implementation (June – November 2026)

See [docs/psm2/README.md](docs/psm2/README.md) for the full checklist.

- [ ] Terraform: VPC, RDS, EC2, ALB, S3, CloudFront, IAM, KMS, CloudTrail
- [ ] Backend: Node.js/Express API (18 use cases)
- [ ] Database: Schema + PostgreSQL Row-Level Security policies
- [ ] Frontend: React SPA (4 role-specific views)
- [ ] Pipeline: GitHub Actions (SonarQube → Trivy → Checkov → Terraform Apply)
- [ ] Testing: Functional, penetration, RTO drill (target: < 15 min)
- [ ] Compliance: HIPAA §164.312 + PDPA 2010 (Malaysia)

---

## Security Design

**3-Layer RBAC:**
- Layer 1 — JWT (application): httpOnly + Secure + SameSite=Strict cookie; role encoded in token
- Layer 2 — AWS IAM (infrastructure): least-privilege per service; EC2 cannot reach RDS directly
- Layer 3 — PostgreSQL RLS (database): doctors see only assigned records; bypassing app layer still blocked at DB

**DevSecOps Pipeline (6 stages):**
```
Checkout → SonarQube SAST → Docker Build → Trivy Image Scan → Checkov IaC Scan → Terraform Apply
             ↑ blocks                           ↑ blocks               ↑ blocks     ↑ only if all pass
```

---

*PSM 1 report source: [docs/report/](docs/report/)*  
*PSM 2 implementation plan: [docs/psm2/README.md](docs/psm2/README.md)*  
*Use case specs: [docs/design/use-cases/](docs/design/use-cases/)*
