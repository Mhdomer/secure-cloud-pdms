# PSM 2 — Implementation Phase

**Timeline: June – November 2026**

PSM 1 (Analysis & Design) is complete. This directory tracks PSM 2 planning.

## Sprint Plan

| Sprint | Focus | Target |
|---|---|---|
| Sprint 2 | Network & Database Layer | VPC, RDS, IAM via Terraform |
| Sprint 3 | Application Layer | Node.js backend + React frontend |
| Sprint 4 | Security Integration | JWT, RLS activation, DevSecOps pipeline |
| Sprint 5 | Testing & Documentation | Pen testing, HIPAA audit, PSM 2 report |

## Key Design Documents (from PSM 1)

- Architecture: [docs/report/chapter-4-requirement-design.md](../report/chapter-4-requirement-design.md)
- Use Cases: [docs/design/use-cases/](../design/use-cases/)
- Database Schema: see Chapter 4 (6 tables: users, patients, doctors, medical_records, appointments, audit_log)
- Security Design: [docs/design/security/](../design/security/)
- Diagrams: [Draw.io files/](../../Draw.io%20files/)

## Implementation Checklist

- [ ] Terraform: VPC + subnets + IGW + NAT Gateway
- [ ] Terraform: RDS PostgreSQL (Multi-AZ) + KMS encryption
- [ ] Terraform: EC2 + ALB + Security Groups + NACLs
- [ ] Terraform: S3 + CloudFront (React frontend)
- [ ] Terraform: IAM roles + instance profile + S3 bucket policy
- [ ] Terraform: CloudTrail + CloudWatch alarms
- [ ] Backend: Node.js/Express REST API (18 use cases)
- [ ] Backend: JWT auth (httpOnly cookie, bcrypt cost 12)
- [ ] Database: PostgreSQL schema migration
- [ ] Database: Row-Level Security policies (medical_records + patients)
- [ ] Database: Audit log (INSERT-only enforcement)
- [ ] Frontend: React SPA (4 role-specific views)
- [ ] Pipeline: GitHub Actions (6 stages — SonarQube, Trivy, Checkov)
- [ ] Testing: Functional tests (all 18 UC, positive + negative)
- [ ] Testing: Penetration testing (RBAC + RLS validation)
- [ ] Testing: RTO drill (target: < 15 min)
- [ ] Compliance: HIPAA §164.312 audit
- [ ] Compliance: PDPA 2010 (Malaysia) review
