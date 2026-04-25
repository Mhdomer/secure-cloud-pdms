# Security Design

## Status: In Progress

This section documents the security architecture, IAM structure, and threat model for the Secure Cloud PDMS.

## Planned Documents

- [ ] `iam-policy-design.md` — Role definitions and least-privilege policies
- [ ] `threat-model.md` — STRIDE analysis of the system
- [ ] `security-controls.md` — Full control mapping (network, identity, data, audit)
- [ ] `encryption-design.md` — KMS key hierarchy, TLS configuration

## Security Layers

### 1. Identity & Access Management (IAM / RBAC)
Three application roles with least-privilege policies:
- **Doctor** — read/write patient records assigned to them
- **Admin** — manage appointments, user accounts (no access to clinical data)
- **Patient** — read-only access to own records

### 2. Network Security
- Public subnet: ALB only (ports 80/443)
- App subnet: EC2 reachable only from ALB security group
- DB subnet: RDS reachable only from App security group
- Network ACLs as a secondary layer on top of security groups

### 3. Data Protection
- **At rest:** AES-256 via AWS KMS (RDS storage encryption + EBS volumes)
- **In transit:** TLS 1.3 enforced end-to-end (HTTPS on ALB, encrypted DB connections)

### 4. DevSecOps (Shift-Left)
- **Trivy** — container image vulnerability scanning
- **SonarQube** — SAST (static code analysis)
- **Checkov** — Terraform IaC misconfiguration scanning
- Pipeline blocks deployment on critical findings

### 5. Observability & Audit
- **CloudWatch** — metric alarms and log aggregation
- **CloudTrail** — API call audit trail
- **AWS Security Hub** — HIPAA compliance posture dashboard
