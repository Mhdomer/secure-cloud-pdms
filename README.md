# Design and Deployment of a Secure Cloud-Based Patient Data Management System

**UTM Final Year Project (PSM) | A23CS4014 — Mohamed Omar Makhlouf**
**Supervisor: Johan Mohamad Sharif | Session 2025/2026**

---

## Project Overview

A secure, three-tier cloud infrastructure for **Alamin Clinic (Saudi Arabia)**, designed to replace a vulnerable on-premise system that was compromised by a ransomware attack. The system is built on AWS using Infrastructure as Code (Terraform), with DevSecOps CI/CD pipelines enforcing shift-left security.

### Core Architecture
```
Internet → ALB (Public Subnet)
              ↓
         EC2 Backend (Private App Subnet)
              ↓
         RDS Database (Isolated Private DB Subnet)
```

### Technology Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React |
| Backend | Flask / Node.js on EC2 |
| Database | MySQL/PostgreSQL on RDS |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| Security Scanning | Trivy, SonarQube, Checkov |
| Monitoring | CloudWatch, CloudTrail, Prometheus, Grafana |
| Compliance | HIPAA via AWS Security Hub |

---

## Repository Structure

```
├── docs/
│   ├── proposal/        # Approved PSM1 proposal artifacts
│   ├── architecture/    # VPC, subnet, and service design diagrams + docs
│   ├── security/        # IAM policies, security group rules, threat model
│   └── literature/      # Literature review and comparison tables
├── linkedin/
│   └── posts/           # LinkedIn progress posts (Markdown drafts)
├── blog/                # Jekyll blog (GitHub Pages)
│   ├── _posts/          # Blog entries
│   └── _config.yml
└── README.md
```

---

## Progress

### PSM1 — Design & Documentation (April 2026 – Present)
- [x] Proposal approved (15 April 2026)
- [ ] System architecture document
- [ ] Network design (VPC, subnets, routing)
- [ ] IAM policy structure
- [ ] Security design document (threat model, controls)
- [ ] Literature review writeup

### PSM2 — Implementation (Next Semester)
- [ ] Terraform infrastructure provisioning
- [ ] Application development (React + Flask/Node.js)
- [ ] DevSecOps pipeline setup
- [ ] Security evaluation and testing
- [ ] Final report

---

## Security Evaluation Metrics

1. IAM/RBAC access control validation
2. Network isolation across private subnets
3. Encryption at rest (AES-256/KMS) and in transit (TLS 1.3)
4. Vulnerability scan results (SonarQube, Trivy, OWASP)
5. Monitoring and audit logging coverage
6. HIPAA compliance score via AWS Security Hub
7. Recovery Time Objective (RTO) after simulated ransomware wipe

---

*Project blog: [linked in blog/_config.yml]*
*LinkedIn updates: [linkedin/posts/](linkedin/posts/)*
