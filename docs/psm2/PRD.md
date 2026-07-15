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

Four roles as of Sprint 3 (`superadmin` added — see `report-delta.md` DELTA-001; this section
was not updated at the time, corrected here as of Sprint 3c).

| Role | Can Do | Cannot Do |
|---|---|---|
| Superadmin | Create/deactivate/reactivate Doctor and Admin accounts | Access clinical data or patient records |
| Doctor | View/create/update medical records for own assigned patients; view own appointment schedule; confirm own appointments; manage own `doctor_availability` | Access other doctors' patients; create/deactivate accounts; view patient demographics beyond their own patients |
| Admin (displayed as "Staff") | Register patients; search patients; schedule/update/cancel appointments; assign/reassign doctors | Read or write medical record content (clinical data); create/deactivate accounts |
| Patient | Self-register (OTP-verified, UC-19); view own medical records (read-only); **book and cancel own appointments** (UC-20/21 — as of Sprint 3c, no longer read-only here); update own password | Create/edit medical records; see other patients' data; edit their own demographics (that stays Admin-only, UC-08) |

---

## 3. Use Cases (21 total)

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
| UC-19 | Patient Self-Registration | Patient (unauthenticated) | Phone OTP (6-digit, 5-min TTL, single-use, rate-limited); national ID duplicate check before OTP send; patient sets own password; username = national ID |
| UC-20 | Patient Books Own Appointment | Patient | `patient_id` always derived from session, never request body; same working-hours/overlap check as Admin booking; auto-assigns doctor on first booking if unassigned |
| UC-21 | Patient Cancels Own Appointment | Patient | Ownership check (`existing.patient_id === session.patientId`) since `appointments` has no RLS |

Sprint 3c also added: UC-06's `assigned_doctor_id` is now selected from a `GET /doctors`
directory (never typed as a UUID); `national_id` is now required at UC-06 registration with a
duplicate check that surfaces the existing patient's name; UC-07's patient lookup is a live
search for Admin (`GET /patients?q=`) rather than a UUID paste for that role.

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
| FR-13 | Patient self-registration | Patient | OTP-verified phone + national ID/DOB identity check; own password; no admin involvement |
| FR-14 | Patient self-booking/cancel | Patient | Patient books/cancels own appointments only; same conflict/working-hours checks as Admin path |
| FR-15 | Patient search | Admin | National ID exact match, name substring, phone prefix; results within a debounce, no page reload |
| FR-16 | Doctor directory | Admin, Doctor, Superadmin, Patient (via self-booking) | Doctor is always picked by name from `GET /doctors`, never typed as a UUID |

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

Verified directly against the current route files as of Sprint 3c — this table previously had
several stale/incorrect paths (e.g. `/api/patients/:id/doctor` never existed; the real route is
`/assign-doctor`); corrected here rather than perpetuated.

### Auth (`auth.routes.js`)
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/auth/login | Public | Authenticate; returns JWT cookie |
| POST | /api/auth/logout | All | Clear JWT cookie; write audit log |
| POST | /api/auth/register/request-otp | Public | UC-19 step 1 — identity + phone, sends OTP (rate-limited by phone) |
| POST | /api/auth/register/verify-otp | Public | UC-19 step 2 — verifies OTP, returns a short-lived `registrationToken` |
| POST | /api/auth/register/complete | Public (requires `registrationToken`) | UC-19 step 3 — profile + own password; creates account, logs in |

### Users (`users.routes.js`)
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/users | **Superadmin** | Create Doctor/Admin account (corrected from "Admin" per DELTA-001/004) |
| PATCH | /api/users/:id/deactivate | Superadmin | Soft-delete (is_active = false) |
| PATCH | /api/users/:id/reactivate | Superadmin | Clears failed_attempts, reactivates |
| PATCH | /api/users/me/password | All authenticated | Self-service password change |

### Doctors (`doctors.routes.js`, `doctorAvailability.routes.js` — new in Sprint 3c)
| Method | Route | Role | Description |
|---|---|---|---|
| GET | /api/doctors | Superadmin, Admin, Doctor | Active-doctor directory (id, name, specialisation) — backs every doctor-picker in the UI |
| GET | /api/doctors/:doctorId/availability | Any authenticated role | Weekly working-hours schedule |
| POST | /api/doctors/:doctorId/availability | Superadmin, or the doctor themselves | Create/update one day's slot |
| DELETE | /api/doctors/:doctorId/availability/:dayOfWeek | Superadmin, or the doctor themselves | Remove a day's slot |

### Patients (`patients.routes.js`)
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/patients | Admin | Register new patient; `national_id` required, `assigned_doctor_id` required |
| GET | /api/patients?q= | Admin | **New Sprint 3c** — search by national ID (exact) / name (substring) / phone (prefix) |
| GET | /api/patients/:patientId | Doctor, Admin | View patient profile (Doctor: own assigned patients only, RLS) |
| PUT | /api/patients/:patientId | Admin | Update demographics |
| PATCH | /api/patients/:patientId/assign-doctor | Admin | Reassign treating doctor |

### Medical Records (`medicalRecords.routes.js` — mounted at API root, no `/records` prefix on the router itself)
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/records | Doctor | Create record (ownership check + RLS INSERT policy). SOAP fields as of Sprint 3c: `chief_complaint`, `objective`, `assessment`, `plan`, `vital_signs` (JSONB), `visit_type` |
| GET | /api/records | Doctor, Patient | List — scope (own records / assigned patients' records) derived from session, no query param |
| GET | /api/records/:recordId | Doctor, Patient | View one record (RLS-filtered) |
| PUT | /api/records/:recordId | Doctor | Update own record only |
| GET | /api/patients/:patientId/records | Doctor | Chronological history for one assigned patient |

### Appointments (`appointments.routes.js`)
| Method | Route | Role | Description |
|---|---|---|---|
| POST | /api/appointments | Admin | Schedule for any patient; checks `isSlotAvailable` (working hours + overlap) |
| POST | /api/appointments/mine | Patient | **New Sprint 3c (UC-20)** — `patient_id` always from session; auto-assigns doctor if patient unassigned |
| GET | /api/appointments | Admin, Doctor, Patient | Scope always derived from session, never a query param |
| PUT | /api/appointments/:appointmentId | Admin | Update; re-checks conflict + availability |
| PATCH | /api/appointments/:appointmentId/confirm | Admin, Doctor | Sets status to `confirmed` |
| PATCH | /api/appointments/:appointmentId/cancel | Admin, Patient | **Sprint 3c: Patient added (UC-21)** — Admin cancels any, Patient only their own (ownership checked in the controller, `appointments` has no RLS) |

### Middleware Chain (every request)
```
CORS → Helmet → Rate Limiter → JSON Parser → JWT Verifier → Role Checker → Route Handler
```
Sprint 3c added two additional rate limiters scoped to the OTP endpoints only
(`otpRequestLimiter` keyed on phone number, `otpVerifyLimiter` keyed on `requestId`) —
these run in addition to, not instead of, the global limiter above.

---

## 7. Database Schema

**This section is illustrative — `src/backend/src/config/schema.sql` is the single source of
truth and must be checked directly for anything schema-critical.** Column lists below are
accurate as of Sprint 3c but will drift again; don't trust this file blindly for a future sprint.

### users
```sql
CREATE TABLE users (
  user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(50)  UNIQUE NOT NULL,   -- Sprint 3c: patients' username = their national_id
  password_hash   VARCHAR(255) NOT NULL,          -- bcrypt cost 12
  role            VARCHAR(12)  NOT NULL CHECK (role IN ('superadmin','doctor','admin','patient')),
  is_active       BOOLEAN      DEFAULT true,
  failed_attempts INT          DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);
```

### doctors
```sql
CREATE TABLE doctors (
  doctor_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
  full_name      VARCHAR(100) NOT NULL,
  specialisation VARCHAR(100),
  license_number VARCHAR(50),    -- Sprint 3c
  phone          VARCHAR(20),    -- Sprint 3c
  is_active      BOOLEAN DEFAULT true   -- Sprint 3c — GET /doctors only returns is_active=true
);
```

### patients
```sql
CREATE TABLE patients (
  patient_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(user_id) ON DELETE SET NULL,
  full_name          VARCHAR(100) NOT NULL,
  date_of_birth      DATE         NOT NULL,
  gender             VARCHAR(10)  CHECK (gender IN ('male','female')),
  contact_number     VARCHAR(20),
  assigned_doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE SET NULL,  -- nullable: self-registered patients start unassigned
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  -- Sprint 3c — identity + patient safety fields:
  id_type            VARCHAR(15) DEFAULT 'national_id' CHECK (id_type IN ('national_id','iqama','passport')),
  national_id        VARCHAR(20) UNIQUE,           -- the user-facing identifier; patient_id (UUID) is internal-only
  blood_type         VARCHAR(5)  CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies          TEXT,
  nationality        VARCHAR(50),
  address            TEXT,
  emergency_contact_name  VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  insurance_provider      VARCHAR(100),
  insurance_number        VARCHAR(50),
  email                   VARCHAR(255),                                    -- Sprint 3c
  preferred_language      VARCHAR(2) DEFAULT 'en' CHECK (preferred_language IN ('en','ar'))  -- Sprint 3c
);
```

### medical_records
```sql
CREATE TABLE medical_records (
  record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id    UUID REFERENCES doctors(doctor_id)   ON DELETE SET NULL,
  diagnosis    TEXT NOT NULL,       -- short summary line, kept as-is
  prescription TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  -- Sprint 3c — SOAP structure, alongside the original flat fields above:
  chief_complaint TEXT,
  objective       TEXT,             -- examination findings
  assessment      TEXT,             -- full clinical narrative (diagnosis stays the short summary)
  plan            TEXT,             -- treatment plan
  vital_signs     JSONB,            -- { bp, temp, weight, height }
  visit_type      VARCHAR(20) DEFAULT 'consultation' CHECK (visit_type IN ('consultation','follow_up','emergency','checkup'))
);
-- RLS enabled — see Section 8
```

### appointments
```sql
CREATE TABLE appointments (
  appointment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
  doctor_id      UUID REFERENCES doctors(doctor_id)   ON DELETE SET NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','completed','cancelled')),  -- 'confirmed' added Sprint 3c
  type           VARCHAR(20) DEFAULT 'consultation' CHECK (type IN ('consultation','follow_up','emergency','checkup')),
  notes          TEXT,
  created_by     UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  -- Sprint 3c:
  duration_minutes  INT DEFAULT 30,
  cancelled_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  cancellation_note TEXT
);
-- No RLS — access boundaries are application-layer only (see rbacMiddleware.js + ownership
-- checks in appointmentsController.js), a deliberate scope decision from Sprint 3a.
```

### doctor_availability (new, Sprint 3c)
```sql
CREATE TABLE doctor_availability (
  availability_id UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       UUID    REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday..6=Saturday; Saudi work week 0-4
  start_time      TIME    NOT NULL,
  end_time        TIME    NOT NULL,
  slot_minutes    INT     DEFAULT 30,
  is_active       BOOLEAN DEFAULT true,
  UNIQUE (doctor_id, day_of_week)
);
```

### otp_verifications (new, Sprint 3c)
```sql
CREATE TABLE otp_verifications (
  otp_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(20) NOT NULL,
  national_id   VARCHAR(20) NOT NULL,
  id_type       VARCHAR(15) NOT NULL DEFAULT 'national_id' CHECK (id_type IN ('national_id','iqama','passport')),
  date_of_birth DATE NOT NULL,
  otp_hash      VARCHAR(255) NOT NULL,   -- bcrypt, same cost as passwords
  purpose       VARCHAR(20) NOT NULL DEFAULT 'registration' CHECK (purpose IN ('registration')),
  attempts      INT NOT NULL DEFAULT 0,  -- max 5, see utils/otp.js
  expires_at    TIMESTAMPTZ NOT NULL,    -- 5-minute TTL
  verified_at   TIMESTAMPTZ,             -- single-use: set once, never cleared
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
-- No RLS — pre-authentication data, no user_id to key policies on.
```

### audit_log
```sql
CREATE TABLE audit_log (
  log_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(user_id),
  action     VARCHAR(50) NOT NULL,   -- includes Sprint 3c: PATIENT_SELF_REGISTER, CONFIRM_APPOINTMENT
  resource   VARCHAR(50),            -- table name
  record_id  UUID,                   -- affected record
  ip_address INET,
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);
-- Append-only: application role has SELECT/INSERT only, no UPDATE/DELETE grant.
```

---

## 8. Row-Level Security Policies

**The SQL block that used to be here was from the original pre-Sprint-3a scaffold and was
already known-broken** (`doctor_id`/`patient_id` compared directly against
`app.current_user_id`, a different UUID space entirely — see `schema.sql`'s own "Drop
legacy/broken policies" comment). Replaced below with what's actually deployed. Authoritative
source is always `src/backend/src/config/schema.sql`.

Four session variables, set via `set_config(..., true)` (SET LOCAL semantics) inside every
RLS-scoped transaction (`config/database.js#withTransaction`), never leaking across pooled
connections:
```sql
app.current_user_id     -- users.user_id from the verified JWT
app.current_role        -- 'superadmin' | 'doctor' | 'admin' | 'patient' | 'system' (Sprint 3c, see below)
app.current_doctor_id   -- doctors.doctor_id, resolved server-side (doctor sessions only)
app.current_patient_id  -- patients.patient_id, resolved server-side (patient sessions only)
```

### medical_records (RLS + FORCE ROW LEVEL SECURITY)
| Policy | Type | Rule |
|---|---|---|
| `doctor_select_records` / `doctor_insert_records` / `doctor_update_records` | PERMISSIVE | `doctor_id = app.current_doctor_id` |
| `patient_select_records` | PERMISSIVE | `patient_id = app.current_patient_id` (read-only) |
| `admin_blocked_records` | **RESTRICTIVE** | `app.current_role <> 'admin'` — AND-combined with every other policy, so this can't be defeated by a permissive OR |

### patients (RLS + FORCE ROW LEVEL SECURITY)
| Policy | Type | Rule |
|---|---|---|
| `patient_select_own` | PERMISSIVE | `user_id = app.current_user_id` (keyed on user_id, not patient_id — this is the query that resolves patient_id in the first place) |
| `doctor_select_assigned` | PERMISSIVE | `assigned_doctor_id = app.current_doctor_id` |
| `admin_select_patients` / `admin_insert_patients` / `admin_update_patients` | PERMISSIVE | `app.current_role = 'admin'` |
| `system_check_national_id` (SELECT) / `system_insert_patients` (INSERT) — **new Sprint 3c** | PERMISSIVE | `app.current_role = 'system'` — narrow carve-out, set only inside `patientRegistrationController.js` for UC-19 (self-registration happens before any real session exists); `setupRLSContext` never produces this role |
| `patient_self_assign_doctor` (UPDATE) — **new Sprint 3c** | PERMISSIVE | `user_id = app.current_user_id AND assigned_doctor_id IS NULL` — lets a patient self-assign a doctor exactly once, on their first self-booked appointment (UC-20); once set, this policy's `USING` clause no longer matches, so it can never be used to change an existing assignment (that stays Admin-only, UC-09) |

### appointments, doctors, doctor_availability, otp_verifications, users, audit_log
No RLS — access boundaries are entirely application-layer (`rbacMiddleware.js` +
ownership checks in the relevant controller), a deliberate Sprint 3a scope decision that
Sprint 3c's `otp_verifications`/`doctor_availability` additions followed rather than revisited.

---

## 9. UI Screens

| Screen | Role | Key Elements |
|---|---|---|
| **Landing Page** (`/`, public) | Unauthenticated visitors | 10 sections: Hero (gradient, no external images) + Quick Access cards (Book/Find Doctor/Emergency/Departments) + decorative search bar (shows "sign in" toast, no silent redirect) + Trust statistics (15+ physicians, 30+ years, 50,000+ patients, 8 specialties) + 6-service grid (family clinic scope only — no Cardiology/Surgery/Neurology) + Featured Doctors (4 cards, initials avatars, no photos) + Testimonials (3 authored quotes) + Emergency Banner (click-to-call) + FAQ accordion (5 questions) + 3-column Footer. Static content — zero backend API calls from this page. |
| Login | All | Username + password fields; login button; redirect to role dashboard on success; "New patient? Create an account" link to Register (Sprint 3c) |
| **Register** (`/register`, new Sprint 3c) | Patient (unauthenticated) | 3-step wizard: identity+phone → OTP code → profile+password. Public route, no auth guard. |
| Doctor Dashboard | Doctor | Patient list (name, last visit, "View Records" button); appointment schedule sidebar |
| Patient Detail | Doctor | Medical record history (chronological); "New Record" button; form now includes SOAP fields (Sprint 3c) |
| Admin Dashboard | Admin | Appointment calendar; patient registration form; user management table |
| Patient Lookup (Sprint 3c: split by role) | Admin, Doctor | Admin: live search (national ID/name/phone, debounced) → result list → profile. Doctor: unchanged UUID-paste lookup + "recently treated" widget (`GET /patients?q=` is Admin-only server-side). |
| Appointment Scheduler | Admin | Patient selector (still UUID text — not yet unified, see `sprint-3c-summary.md`); doctor selector (Sprint 3c: name dropdown via `GET /doctors`, no longer a UUID field); date/time picker; conflict error on HTTP 409 |
| Patient Portal | Patient | Own records (read-only); own appointments — **Sprint 3c: no longer read-only** — "Book appointment" dialog (doctor dropdown + date/time) and a Cancel action on own upcoming appointments |

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
