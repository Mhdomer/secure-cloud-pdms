# Product Requirements Document (PRD)
## Secure Cloud-Based Patient Data Management System
### Alamin Polyclinic — PSM2 Implementation Reference

> Distilled from Chapter 4 (Requirement Analysis & Design). Read this file instead of the full chapter during implementation sessions.

---

## 1. System Overview

Three-tier web application on AWS. Three user roles: Doctor, Admin, Patient.
No role can access another role's data — enforced at API layer (RBAC middleware) AND database layer (PostgreSQL RLS).

**Stack:** React → ALB → Node.js/Express on EC2 → PostgreSQL on RDS
**Region:** ap-southeast-1 (Singapore)
**Auth:** JWT in httpOnly cookie, 15-minute expiry, bcrypt cost 12

---

## 2. User Roles & Permissions

| Role | Can Do | Cannot Do |
|---|---|---|
| Doctor | View/create/update medical records for own assigned patients; view own appointment schedule | Access other doctors' patients; access admin functions; view patient demographics beyond their own patients |
| Admin | Register patients; schedule/update/cancel appointments; create/deactivate user accounts | Read or write medical record content (clinical data) |
| Patient | View own medical records (read-only); view own appointments (read-only) | Create/edit any data; see other patients' data |

---

## 3. Use Cases (18 total)

| UC ID | Name | Actor | Key Security Control |
|---|---|---|---|
| UC-01 | User Login | All | bcrypt compare; JWT httpOnly cookie; audit log write |
| UC-02 | User Logout | All | Clear JWT cookie; audit log write |
| UC-03 | Account Lockout | System | Lock after 3 failed attempts; CloudWatch alert |
| UC-04 | Admin Creates User Account | Admin | Role assignment; temp credentials |
| UC-05 | Admin Deactivates User | Admin | Soft delete (is_active=false); record retained |
| UC-06 | Register New Patient | Admin | Assign doctor at registration; generate temp login |
| UC-07 | View Patient Profile | Doctor, Admin | Doctor: own assigned patients only (RLS) |
| UC-08 | Update Patient Information | Admin | Audit log on every change |
| UC-09 | Assign Doctor to Patient | Admin | RLS boundary updates immediately |
| UC-10 | Create Medical Record | Doctor | Ownership check + RLS INSERT policy |
| UC-11 | View Medical Record | Doctor, Patient | Doctor: assigned patients only; Patient: own records only (RLS) |
| UC-12 | Update Medical Record | Doctor | RLS prevents updating other doctors' records |
| UC-13 | View Patient Medical History | Doctor | Chronological list, own patients only |
| UC-14 | Schedule Appointment | Admin | Conflict check before INSERT; transaction for race condition |
| UC-15 | View Appointment Schedule | Doctor | Own schedule only; server-side enforcement |
| UC-16 | View Own Appointments | Patient | Read-only; own appointments only |
| UC-17 | Update Appointment | Admin | Conflict re-check on new time slot |
| UC-18 | Cancel Appointment | Admin | Status = 'cancelled'; record retained for audit |

---

## 4. Functional Requirements

| ID | Requirement | Role | Acceptance Criteria |
|---|---|---|---|
| FR-01 | Patient registration | Admin | Admin can register patient with full demographics + assigned doctor; system generates temp credentials |
| FR-02 | Create medical record | Doctor | Doctor can create record for own assigned patient only; blocked for unassigned patients |
| FR-03 | Update medical record | Doctor | Doctor can update own-created records only; HTTP 403 on others |
| FR-04 | Schedule appointment | Admin | Admin creates appointment with conflict check; HTTP 409 if slot taken |
| FR-05 | Update/cancel appointment | Admin | Admin can update or cancel; conflict re-checked on update |
| FR-06 | View medical history | Doctor | Doctor sees chronological records for assigned patients only |
| FR-07 | User authentication | All | Login with username + password; JWT issued; redirect to role dashboard |
| FR-08 | Account management | Admin | Create, deactivate users; assign roles |
| FR-09 | Account lockout | System | Lock after 3 failed attempts; admin notification via CloudWatch |
| FR-10 | Logout | All | JWT cookie cleared; audit log entry written |
| FR-11 | Audit logging | System | Every CRUD on patient data writes to audit_log table |
| FR-12 | Role-based data isolation | System | Doctor sees assigned patients only; Patient sees own data only; Admin blocked from clinical content |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Measurable Target | Test Method |
|---|---|---|---|---|
| NFR-01 | Security | Encryption at rest | AES-256 via KMS CMK on RDS | AWS Console: RDS encryption enabled |
| NFR-02 | Security | Encryption in transit | TLS 1.2+ on all connections | ALB policy: TLS13-1-2-2021-06; RDS force_ssl=1 |
| NFR-03 | Security | Least-privilege IAM | No wildcard (*) in IAM policies | Manual IAM policy review |
| NFR-04 | Security | Pipeline security gate | Critical finding = pipeline blocked, no deploy | Test: inject deliberate CVE, confirm pipeline fails |
| NFR-05 | Availability | Uptime | 99.9% (≤8.7 hours downtime/year) | CloudWatch uptime metric |
| NFR-06 | Recovery | RTO | ≤15 minutes from wipe to working | Timed Terraform destroy + apply test |
| NFR-07 | Compliance | HIPAA posture | Security Hub HIPAA standard enabled | Security Hub dashboard score |
| NFR-08 | Compliance | Audit log retention | 90 days minimum | CloudTrail S3 lifecycle policy |
| NFR-09 | Performance | API response time | ≤3 seconds at 50 concurrent users | Load test with Artillery/k6 |
| NFR-10 | Scalability | Auto scaling | EC2 Auto Scaling group configured | AWS Console verification |
| NFR-11 | Maintainability | IaC coverage | 100% of infrastructure in Terraform | No manually created AWS resources |

---

## 6. API Endpoints

### Auth
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/auth/login | Public | Authenticate; returns JWT cookie |
| POST | /api/auth/logout | All | Clear JWT cookie; write audit log |

### Users
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/users | Admin | Create user account with role |
| PATCH | /api/users/:id/deactivate | Admin | Soft-delete (is_active = false) |

### Patients
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/patients | Admin | Register new patient + assign doctor |
| GET | /api/patients/:id | Doctor, Admin | View patient profile (Doctor: own patients only) |
| PATCH | /api/patients/:id | Admin | Update patient demographics |
| PATCH | /api/patients/:id/doctor | Admin | Reassign treating doctor |

### Medical Records
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/records | Doctor | Create record (ownership check + RLS) |
| GET | /api/records?patientId=X | Doctor, Patient | View records (RLS filters automatically) |
| PATCH | /api/records/:id | Doctor | Update own record only (RLS) |

### Appointments
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/appointments | Admin | Schedule (conflict check required) |
| GET | /api/appointments | Doctor, Patient | View own schedule/appointments (role-filtered) |
| PATCH | /api/appointments/:id | Admin | Update (conflict re-check) |
| PATCH | /api/appointments/:id/cancel | Admin | Cancel (status = 'cancelled', record retained) |

### Middleware Chain (every request)
```
CORS → Helmet → Rate Limiter → JSON Parser → JWT Verifier → Role Checker → Route Handler
```

---

## 7. Database Schema

### users
```sql
CREATE TABLE users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt cost 12
  role          VARCHAR(10) NOT NULL CHECK (role IN ('doctor','admin','patient')),
  is_active     BOOLEAN DEFAULT true,
  failed_attempts INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### patients
```sql
CREATE TABLE patients (
  patient_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(user_id),
  full_name          VARCHAR(100) NOT NULL,
  date_of_birth      DATE NOT NULL,
  contact_number     VARCHAR(20),
  assigned_doctor_id UUID REFERENCES doctors(doctor_id),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

### doctors
```sql
CREATE TABLE doctors (
  doctor_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(user_id),
  full_name      VARCHAR(100) NOT NULL,
  specialisation VARCHAR(100)
);
```

### medical_records
```sql
CREATE TABLE medical_records (
  record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID REFERENCES patients(patient_id),
  doctor_id    UUID REFERENCES doctors(doctor_id),
  diagnosis    TEXT NOT NULL,
  prescription TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
-- RLS enabled — see Section 8
```

### appointments
```sql
CREATE TABLE appointments (
  appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(patient_id),
  doctor_id      UUID REFERENCES doctors(doctor_id),
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  notes          TEXT,
  created_by     UUID REFERENCES users(user_id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_log
```sql
CREATE TABLE audit_log (
  log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id),
  action     VARCHAR(50) NOT NULL,   -- e.g. 'LOGIN', 'CREATE_RECORD', 'SCHEDULE_APPOINTMENT'
  resource   VARCHAR(50),            -- table name
  record_id  UUID,                   -- affected record
  ip_address INET,
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Row-Level Security Policies

```sql
-- Enable RLS
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Doctor: own patients' records only
CREATE POLICY doctor_records ON medical_records
  USING (doctor_id = current_setting('app.current_user_id')::UUID);

-- Patient: own records only
CREATE POLICY patient_own_records ON medical_records
  FOR SELECT USING (patient_id = current_setting('app.current_user_id')::UUID);

-- Admin: blocked from medical_records entirely
CREATE POLICY admin_no_records ON medical_records
  USING (current_setting('app.current_role') != 'admin');

-- Patient: own profile only
CREATE POLICY patient_own_profile ON patients
  FOR SELECT USING (patient_id = current_setting('app.current_user_id')::UUID);
```

Set session variable on every request:
```sql
SET app.current_user_id = '<userId>';
SET app.current_role = '<role>';
```

---

## 9. UI Screens

| Screen | Role | Key Elements |
|---|---|---|
| Login | All | Username + password fields; login button; redirect to role dashboard on success |
| Doctor Dashboard | Doctor | Patient list (name, last visit, "View Records" button); appointment schedule sidebar |
| Patient Detail | Doctor | Medical record history (chronological); "New Record" button; form: Diagnosis, Prescription, Notes |
| Admin Dashboard | Admin | Appointment calendar; patient registration form; user management table |
| Appointment Scheduler | Admin | Patient selector; doctor selector; date/time picker; conflict error on HTTP 409 |
| Patient Portal | Patient | Read-only: own records (date, doctor, diagnosis); own appointments (date, time, doctor) |

**Language toggle:** visible on every screen, switches between English (LTR) and Arabic (RTL) instantly without page reload.

---

## 10. HIPAA Compliance Mapping (Implementation Checklist)

| Control | HIPAA Reference | Implementation |
|---|---|---|
| Access Control | §164.312(a)(1) | RBAC middleware + PostgreSQL RLS |
| Unique User ID | §164.312(a)(2)(i) | UUID per user; bcrypt passwords |
| Auto Logoff | §164.312(a)(2)(iii) | JWT 15-minute expiry |
| Encryption at rest | §164.312(a)(2)(iv) | KMS CMK on RDS |
| Audit Controls | §164.312(b) | audit_log table + CloudTrail |
| Integrity | §164.312(c)(1) | FK constraints + RLS |
| Authentication | §164.312(d) | bcrypt + lockout after 3 failures |
| Transmission Security | §164.312(e)(1) | HTTPS-only ALB; httpOnly JWT; TLS RDS |

---

## 11. Infrastructure Summary (Sprint 2 Target State)

```
VPC: 10.0.0.0/16 (ap-southeast-1)
├── public-subnet-a  10.0.1.0/24  AZ-a  → ALB, NAT Gateway
├── public-subnet-b  10.0.2.0/24  AZ-b  → ALB (multi-AZ)
├── app-subnet-a     10.0.3.0/24  AZ-a  → EC2 (Node.js)
├── app-subnet-b     10.0.4.0/24  AZ-b  → EC2 (Node.js)
├── db-subnet-a      10.0.5.0/24  AZ-a  → RDS Primary
└── db-subnet-b      10.0.6.0/24  AZ-b  → RDS Standby

Security Groups:
  alb-sg:  inbound 443/80 from 0.0.0.0/0; outbound 5000 to ec2-sg
  ec2-sg:  inbound 5000 from alb-sg; outbound 5432 to rds-sg
  rds-sg:  inbound 5432 from ec2-sg only; no outbound

RDS: db.t3.micro, PostgreSQL, encrypted (KMS), publicly_accessible=false, backup 7 days
EC2: t3.small, private subnet, SSM Session Manager (no SSH port open)
ALB: HTTPS only, TLS policy TLS13-1-2-2021-06
```

---

## 12. DevSecOps Pipeline (Sprint 4 Target State)

```
Trigger: push to main

Stage 1: Code Checkout
Stage 2: SonarQube SAST → BLOCK on critical finding
Stage 3: Docker Build
Stage 4: Trivy Image Scan → BLOCK on critical CVE
Stage 5: Checkov IaC Scan → BLOCK on critical misconfiguration
Stage 6: Terraform Apply → runs ONLY if stages 2, 4, 5 all pass
```

Files: `.github/workflows/ci.yml` (stages 1–5, runs on every PR)
       `.github/workflows/deploy.yml` (stage 6, runs on merge to main only)
