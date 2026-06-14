Now do the exact same thing for my FYP presentation. Use the exact same template, layout style, visual design, font sizes, chapter labels, and slide format you just used. Just replace all the content with mine below. Keep the same number of slides (12–14). Include speaker notes for every slide exactly like you did for my friend.

---

**My project details:**

**Title:** Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS

**Student:** Mohamed Omar Makhlouf
**Programme:** SECRH — Universiti Teknologi Malaysia, Johor Bahru
**Supervisor:** Johan Mohamed Sharif
**Stage:** PSM 1 — Analysis and Design Phase only. System has NOT been implemented yet.

---

## SLIDE 1 — TITLE SLIDE
Same layout as the first slide.

- Title: Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS
- Student: Mohamed Omar Makhlouf
- Programme: SECRH
- University: Universiti Teknologi Malaysia, Johor Bahru
- Label: PSM 1 — Final Viva Presentation · 2026

---

## SLIDE 2 — CHAPTER 1 | Introduction / Background
**Background:**
Alamin Clinic is a Saudi Arabian private clinic running a fully manual, server-based patient record system with shared credentials, no access control, no encryption, and no backup policy. In May 2023, the clinic suffered a ransomware attack that rendered all patient data inaccessible for 5 days, with records permanently lost and operations fully halted. This incident exposed three critical security gaps: no role-based access control, no audit trail, and no disaster recovery capability.

---

## SLIDE 3 — CHAPTER 1.2 | Problem Statement
Three root-cause gaps identified from the ransomware case study:

- **P1 — No Role-Based Access Control:** Shared credentials allow any staff member to access any patient record regardless of their role. No data isolation between doctors, admin, and patients.
- **P2 — No Audit Trail:** No logging of who accessed or modified records. Post-incident forensic investigation was impossible.
- **P3 — No Disaster Recovery:** No backup, no infrastructure-as-code, no documented recovery plan. Full recovery took 5 days with permanent data loss.

---

## SLIDE 4 — CHAPTER 1.3–1.4 | Aim and Objectives
**AIM:** Design and deploy a secure, three-tier cloud-based patient data management system on AWS that directly eliminates all three gaps identified from the Alamin Clinic ransomware case study.

**Objectives:**
1. Design a three-tier AWS VPC architecture with isolated Public, Private Application, and Private Database subnets
2. Implement Role-Based Access Control enforced at three independent layers: JWT (application), AWS IAM (infrastructure), and PostgreSQL Row-Level Security (database)
3. Build a DevSecOps CI/CD pipeline integrating SonarQube SAST, Trivy container scanning, and Checkov IaC scanning — with automated security gates that block deployment on failure
4. Achieve a ransomware recovery RTO of under 15 minutes using Terraform infrastructure-as-code

---

## SLIDE 5 — CHAPTER 1.5 | Project Scope

| Role | Permissions |
|---|---|
| Doctor | View/create medical records for assigned patients only |
| Admin | Register patients, manage appointments, manage users |
| Patient | View own records and appointments (read-only) |

- Platform: AWS (ap-southeast-1 — Singapore region)
- Backend: Node.js / Express REST API on EC2
- Frontend: React served via S3 + CloudFront
- Database: Amazon RDS PostgreSQL
- PSM 1 = Analysis and Design Phase
- PSM 2 = Implementation and Testing
- Not in scope: mobile app, payment, third-party EHR integration

---

## SLIDE 6 — CHAPTER 2 | Literature Review and Existing Systems
Compare three systems against the proposed system:

| Feature | OpenEMR | Epic Systems | Proposed System |
|---|---|---|---|
| RBAC | Basic | Enterprise | 3-layer (JWT + IAM + RLS) |
| Audit Trail | None | Yes | CloudTrail + audit_log |
| Cloud | On-premise | Private cloud | AWS public cloud |
| IaC / DR | None | Proprietary | Terraform (RTO < 15 min) |
| DevSecOps Pipeline | None | None | 6-stage automated |

**Research Gap:** No existing system combines three-layer RBAC, a full DevSecOps pipeline, and Terraform-based disaster recovery in a single open-source cloud-native deployment targeting Malaysian healthcare.

---

## SLIDE 7 — CHAPTER 3 | Methodology
Agile + DevSecOps — 5 Sprints

- Requirements gathered through 2 structured stakeholder interviews (admin staff + clinical staff)
- 12 Functional Requirements and 11 Non-Functional Requirements identified
- Agile chosen because security requirements evolved iteratively through interviews
- DevSecOps overlaid on Agile: security scanning automated at every pipeline stage

Sprint timeline:
1. Sprint 1: Requirements & Architecture Design ← COMPLETED (PSM 1)
2. Sprint 2: Network & Database Layer (VPC, RDS, IAM)
3. Sprint 3: Application Layer (Node.js, React, JWT)
4. Sprint 4: Security Integration (Pipeline, RLS, RBAC)
5. Sprint 5: Testing, Audit & Documentation

---

## SLIDE 8 — CHAPTER 4.3.1 | System Architecture
Three-Tier AWS VPC Architecture:

**PUBLIC TIER:**
- Application Load Balancer (HTTPS only — port 443)
- NAT Gateway (private subnet outbound traffic)

**PRIVATE APPLICATION TIER:**
- EC2 — Node.js / Express REST API
- S3 + CloudFront — React static frontend

**PRIVATE DATABASE TIER:**
- Amazon RDS PostgreSQL (Multi-AZ)
- AES-256 encryption at rest
- Row-Level Security policies active

**Cross-cutting security controls:**
Security Groups · Network ACLs · AWS IAM least-privilege · CloudTrail (all API logs) · Terraform IaC

(Use Figure 4.2 from the report as the architecture diagram)

---

## SLIDE 9 — CHAPTER 4.3–4.4 | System and Database Design

**Use Cases (Figure 4.1):**
- 18 use cases across 5 modules: Authentication, Patient Management, Medical Records, Appointments, Audit
- 3 actors: Doctor, Admin, Patient

**Database — 6 PostgreSQL Tables (Figure 4.5):**
users · patients · doctors · medical_records · appointments · audit_log

**Key design decisions:**
- Row-Level Security on medical_records: doctors see only their assigned records
- Row-Level Security on patients: patients see only their own profile
- audit_log is append-only (INSERT only — no UPDATE or DELETE)
- UUID primary keys throughout

---

## SLIDE 10 — CHAPTER 4.2 | Security Design and DevSecOps Pipeline

**3-Layer RBAC:**
- Layer 1 — JWT: httpOnly + Secure cookie, bcrypt cost 12, role in token, SameSite=Strict
- Layer 2 — AWS IAM: least-privilege per service, EC2 cannot reach RDS directly, S3 blocks public access
- Layer 3 — PostgreSQL RLS: database-layer enforcement, independent of application code

**DevSecOps CI/CD Pipeline (6 stages):**
[1] Code Checkout → [2] SonarQube SAST (blocks on CRITICAL) → [3] Docker Build → [4] Trivy Image Scan (blocks on CRITICAL CVE) → [5] Checkov IaC Scan (blocks on HIGH/CRITICAL) → [6] Terraform Apply (only if all 3 scans pass)

HIPAA Compliance mapping:
- §164.312(a)(1) Access Control → 3-layer RBAC
- §164.312(b) Audit Controls → CloudTrail + audit_log
- §164.312(e)(2) Encryption → TLS 1.2+ (ALB) + AES-256 (RDS)
- §164.312(a)(2)(ii) Emergency Access → Terraform RTO < 15 min

---

## SLIDE 11 — APPENDIX E | Interface Wireframes
4 wireframes (from Appendix E of the report):

- **Figure E.1 — Login Screen:** Single entry for all roles · JWT redirects to role dashboard · No self-registration
- **Figure E.2 — Doctor Dashboard:** Left sidebar (Patients, Appointments) · New Record only for assigned patients · No admin functions
- **Figure E.3 — Admin Dashboard:** Register Patient · Appointments · User Management · No clinical data visible
- **Figure E.4 — Patient Portal:** My Records (read-only) · My Appointments · No edit or delete controls

Key principle: Role isolation is enforced visually — each screen only shows what that role is allowed to access.

---

## SLIDE 12 — CHAPTER 4.9 | Evaluation Plan
Testing will be conducted in PSM 2:

- **Functional Testing:** Test cases covering all 18 use cases, both positive and negative scenarios
- **Security Testing:** Penetration testing to validate RBAC layers and RLS policies
- **Pipeline Testing:** Confirm each security gate correctly blocks on critical findings
- **Recovery Testing:** Destroy test environment → run terraform apply → measure RTO (target: under 15 minutes)
- **Compliance Audit:** Validate against HIPAA §164.312 and Malaysia PDPA 2010

---

## SLIDE 13 — CHAPTER 5 | PSM 1 Achievements and PSM 2 Plan

**PSM 1 — Completed:**
- Ransomware root cause analysis (Alamin Clinic case study)
- 2 stakeholder interviews conducted
- 18 use cases · 12 functional requirements · 11 non-functional requirements
- 3-tier AWS VPC architecture designed
- 3-layer RBAC model defined (JWT + IAM + RLS)
- 6-stage DevSecOps pipeline designed
- Database schema + RLS policies designed (6 tables)
- 4 interface wireframes produced (Appendix E)
- HIPAA §164.312 compliance mapping completed

**PSM 2 — Planned (June–November 2026):**
- VPC + RDS + IAM deployment via Terraform
- Node.js/Express backend + React frontend implementation
- JWT authentication + PostgreSQL RLS activation
- DevSecOps pipeline activation and testing
- Penetration testing + formal security audit
- PDPA 2010 compliance review
- PSM 2 documentation and viva

---

## SLIDE 14 — THANK YOU / Q&A
Same layout as the closing slide.

- Heading: PSM 1 VIVA · 2026
- Subheading: QUESTIONS & DISCUSSION
- Large text: Thank You.
- Project: Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS
- Student: Mohamed Omar · SECRH · UTM Johor Bahru

---

Important reminders:
- This is PSM 1 — never say the system was built or implemented. Always say "designed", "proposed", or "will be implemented in PSM 2".
- Use exactly the same visual template, fonts, colours, spacing, and chapter label format you used for the previous presentation.
- Include detailed speaker notes in the notes panel of every slide.
- Use Figure 4.2 (architecture diagram), Figure 4.1 (use case), Figure 4.5 (ERD), and Appendix E wireframes (E.1–E.4) from the report wherever relevant.
