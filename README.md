# Design and Deployment of a Secure Cloud-Based Patient Data Management System

**UTM Final Year Project (PSM) | A23CS4014 — Mohamed Omar Makhlouf**  
**Supervisor: Dr. Johan Mohamad Sharif | Session 2025/2026**

---

## Project Overview

A secure, three-tier cloud infrastructure for **Alamin Clinic (Saudi Arabia)**, designed to replace a vulnerable on-premise system that was compromised by a ransomware attack that encrypted the entire patient database. The system is built on AWS using Infrastructure as Code (Terraform), with a DevSecOps CI/CD pipeline enforcing automated security scanning at every commit.

### Core Architecture
```
Internet → ALB (Public Subnet)
              ↓
    Node.js/Express on EC2 (Private App Subnet)
              ↓
    PostgreSQL on RDS (Isolated Private DB Subnet — no internet route)
```

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React (Vite) | SPA, React Router |
| Backend | Node.js / Express | REST API, JWT + bcrypt auth |
| Database | PostgreSQL 16 on Amazon RDS | Row-level security, KMS encrypted |
| IaC | Terraform | Full environment in code, ~35 resources |
| CI/CD | GitHub Actions | 3 workflow files: ci, security, deploy |
| Container | Docker + Amazon ECR | Multi-stage builds, non-root user |
| Security Scanning | Trivy, SonarCloud, Checkov | Block on CRITICAL findings |
| Secrets | AWS Secrets Manager | No hardcoded credentials |
| Encryption | AWS KMS | RDS at rest, EBS, Secrets Manager |
| HTTPS | AWS ACM + ALB | TLS 1.2+, HTTP redirected to HTTPS |
| Deploy method | AWS SSM RunShellScript | No SSH, no port 22 |
| Monitoring | CloudWatch + CloudTrail | Logs, metrics, alarms, API audit trail |
| Compliance | AWS Security Hub (HIPAA) | Primary evaluation metric |

---

## Repository Structure

```
├── docs/
│   ├── report/
│   │   ├── chapter-1-introduction.md
│   │   ├── chapter-2-literature-review.md
│   │   ├── chapter-3-methodology.md
│   │   ├── chapter-4-requirement-design.md
│   │   └── front-matter/
│   │       └── abstract.md
│   ├── design/
│   │   ├── architecture/    # VPC, subnet, and service design docs
│   │   ├── security/        # IAM policies, security group rules
│   │   ├── literature/      # Literature review references
│   │   └── proposal/        # Approved PSM1 proposal artifacts
│   ├── attachments/
│   │   ├── FIGURES.md       # All diagram instructions + checklist
│   │   ├── AWS_COMPONENTS.md # AWS diagram component reference
│   │   └── TECH_STACK.md    # Confirmed technology decisions
│   └── references/          # UTM template, handbook, reference files
├── linkedin/
│   └── posts/               # LinkedIn progress post drafts
├── blog/
│   ├── _posts/              # Blog entries (Jekyll)
│   └── _config.yml
└── README.md
```

---

## Progress

### PSM1 — Design & Documentation ✅ Complete

| Chapter | Title | Status |
|---------|-------|--------|
| Chapter 1 | Introduction | ✅ Complete |
| Chapter 2 | Literature Review | ✅ Complete |
| Chapter 3 | System Development Methodology | ✅ Complete |
| Chapter 4 | Requirement Analysis and Design | ✅ Complete |
| Front Matter | Abstract (English + Bahasa Melayu) | ✅ Complete |

**Pending before submission:** 15 diagrams/wireframes (see [docs/attachments/FIGURES.md](docs/attachments/FIGURES.md))

### PSM2 — Implementation (Next Semester)

- [ ] Terraform infrastructure provisioning (VPC, EC2, RDS, ALB, KMS, CloudTrail)
- [ ] Application development (React frontend + Node.js/Express backend)
- [ ] PostgreSQL schema + row-level security policies
- [ ] DevSecOps pipeline (GitHub Actions: Trivy, SonarCloud, Checkov)
- [ ] HTTPS setup (ACM + Route 53)
- [ ] Security evaluation (scan reports, HIPAA posture score)
- [ ] Recovery Time Objective test (Terraform wipe and redeploy)
- [ ] Final report (Chapters 5 + 6)

---

## Security Evaluation Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Container CVEs | Zero CRITICAL in production images | Trivy scan report |
| Source code security | Zero Critical/High findings | SonarCloud dashboard |
| IaC misconfigurations | Zero FAILED Checkov checks | Checkov pipeline output |
| Encryption at rest | AES-256 via KMS on RDS + EBS | AWS Console confirmation |
| Encryption in transit | TLS 1.2+ on all traffic | SSL Labs / ALB config |
| HIPAA compliance | Passing posture score | AWS Security Hub HIPAA standard |
| Recovery Time Objective | < 15 minutes | Terraform destroy + apply timer |

---

*Project blog: [linked in blog/_config.yml]*  
*LinkedIn updates: [linkedin/posts/](linkedin/posts/)*  
*Tech stack reference: [docs/attachments/TECH_STACK.md](docs/attachments/TECH_STACK.md)*
