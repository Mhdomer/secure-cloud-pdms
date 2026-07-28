---
tags: [fyp, psm1, appendices]
phase: appendix
status: complete
created: 2026-05-30
updated: 2026-07-28
related: [[chapter-3-methodology]], [[chapter-4-requirement-design]]
---

# APPENDICES

---

## APPENDIX A — PROJECT GANTT CHART

> 📎 **ATTACH:** `Figure A.1` — FYP 1 Gantt Chart.

> 📎 **ATTACH:** `Figure A.2` — FYP 2 Sprints Gantt Chart.

---

## APPENDIX B — COMPLETE USE CASE SPECIFICATIONS

**Table B.1** — User Stories by Module

| ID | Role | User Story | Module |
| --- | --- | --- | --- |
| US-01 | Doctor / Admin / Patient | As a user, I want to log in with my username and password, so that I can securely access my role-specific dashboard. | Auth |
| US-02 | All roles | As a logged-in user, I want to log out, so that my session is terminated and my account is protected on shared devices. | Auth |
| US-03 | System | As a user, I want the system to lock my account after three consecutive failed login attempts, so that brute-force attacks are prevented and the admin is alerted. | Auth |
| US-04 | Admin | As an Admin, I want to create user accounts with assigned roles, so that doctors, staff, and patients can access the system with the correct permissions. | Auth |
| US-05 | Admin | As an Admin, I want to deactivate user accounts, so that former staff or inactive patients can no longer access the system. | Auth |
| US-06 | Admin | As an Admin, I want to register new patients and assign them a treating doctor, so that their records can be managed securely from the point of registration. | Patient Mgmt |
| US-07 | Doctor / Admin | As a Doctor or Admin, I want to view a patient's profile, so that I can review their details before providing care or scheduling an appointment. | Patient Mgmt |
| US-08 | Admin | As an Admin, I want to update patient demographic information, so that the system holds accurate and current patient details. | Patient Mgmt |
| US-09 | Admin | As an Admin, I want to assign or reassign a treating doctor to a patient, so that the correct doctor has access to that patient's records. | Patient Mgmt |
| US-10 | Doctor | As a Doctor, I want to create medical records for my assigned patients, so that I can document diagnoses and prescriptions in a secure, auditable system. | Medical Records |
| US-11 | Doctor / Patient | As a Doctor, I want to view records of my assigned patients; as a Patient, I want to view my own records in read-only mode, so that clinical data is accessible only to authorised parties. | Medical Records |
| US-12 | Doctor | As a Doctor, I want to update a record I created, so that I can correct or supplement clinical documentation after the initial consultation. | Medical Records |
| US-13 | Doctor | As a Doctor, I want to view the complete chronological medical history of my assigned patients, so that I can make informed clinical decisions. | Medical Records |
| US-14 | Admin | As an Admin, I want to schedule appointments linking a patient to a doctor at a specific date and time, so that consultations are organised and conflict-free. | Appointments |
| US-15 | Doctor | As a Doctor, I want to view my appointment schedule, so that I know which patients I will be seeing and can prepare for each consultation. | Appointments |
| US-16 | Patient | As a Patient, I want to view my upcoming appointments in read-only mode, so that I am informed of when and with whom my consultations are scheduled. | Appointments |
| US-17 | Admin | As an Admin, I want to update appointment details, so that changes in scheduling requirements are reflected accurately in the system. | Appointments |
| US-18 | Admin | As an Admin, I want to cancel appointments, so that unavailable time slots are freed and appointment records remain accurate for audit purposes. | Appointments |

---

## APPENDIX C — STAKEHOLDER REQUIREMENTS VALIDATION CORRESPONDENCE

This appendix presents the stakeholder requirements validation correspondence conducted between the student, the project supervisor, and Al Amin clinic. The system requirements were initially gathered through direct verbal discussions with clinic staff, including administrative staff, clinic management, and nursing staff. To formally document and validate these requirements, a structured written confirmation process was initiated. A formal request letter was prepared by the project supervisor, Dr Johan Mohamed Sharif, on official UTM Faculty of Computing letterhead, and submitted to the clinic. The clinic subsequently responded with a signed confirmation letter on their official letterhead, verified by the Head Manager and stamped with the clinic's official seal. The complete emails, the clinic's email reply, the supervisor's signed request letter, and the clinic's signed confirmation letter is presented in Figures C.1 through C.6.

Figure C.1 shows the email sent to Alamin Medical Clinic on 4 July 2026. The email introduces the purpose of the correspondence, references the attached UTM supervisor letter, and requests the clinic to review, sign, and return the enclosed reply letter confirming the system requirements discussed with their staff.

> 📎 **ATTACH:** `Figure C.1` — Email sent by Mohamed Omar Makhlouf to Alamin Medical Clinic.

Figure C.2 shows the clinic's email reply, received on 7 July 2026 from Alamin Medical Clinic. The reply formally confirms the clinic's support for the student's Final Year Project and references the attached signed confirmation letter (Ref: AMC/FYP/2026/01), in which the clinic verifies that the system requirements documented by the student accurately reflect their operational needs.

> 📎 **ATTACH:** `Figure C.2` — Reply email from Alamin Medical Clinic.

Figures C.3 and C.4 present the formal request letter issued on UTM Faculty of Computing official letterhead (Ref: UTM.FC/SECRH/FYP.PSM1/2026/01), dated 3 July 2026. The letter was authored and signed by the project supervisor, Dr Johan Mohamed Sharif, and addressed to the Clinic Manager of Alamin Medical Clinic. It lists the six categories of system requirements gathered from stakeholder discussions and formally requests the clinic's written confirmation that these requirements accurately reflect their operational needs.

> 📎 **ATTACH:** `Figure C.3` — Official request letter (Ref: UTM.FC/SECRH/FYP.PSM1/2026/01) - Page 1.

> 📎 **ATTACH:** `Figure C.4` — Official request letter (Ref: UTM.FC/SECRH/FYP.PSM1/2026/01) - Page 2.

Figures C.5 and C.6 present the signed confirmation letter from Al Amin clinic (Ref: AMC/FYP/2026/01), issued on the clinic's official letterhead. The letter was signed by Ibrahim Shaheel Al Quad, Head Manager, and bears the clinic's official stamp. It confirms the conducted discussions with administrative staff, clinic management, and nursing staff, and that the five categories of system requirements documented, that cover role-based access control, patient records management, audit trail, data security and recovery, and cloud-based deployment which reflect the clinic's operational needs.

> 📎 **ATTACH:** `Figure C.5` — Official requirements confirmation letter (Ref: AMC/FYP/2026/01) - Page 1.

> 📎 **ATTACH:** `Figure C.6` — Official requirements confirmation letter (Ref: AMC/FYP/2026/01) - Page 2.

---

## APPENDIX D — SYSTEM REQUIREMENTS

**Table D.1** — Functional Requirements

| ID | Requirement | User Role | Priority |
| --- | --- | --- | --- |
| FR-01 | The system shall allow new patients to be registered with a unique identifier, personal details, and assigned doctor. | Admin | High |
| FR-02 | The system shall allow authenticated doctors to create, read, and update medical records for patients assigned to their care. | Doctor | High |
| FR-03 | The system shall allow authenticated doctors to read the medical history of their assigned patients. | Doctor | High |
| FR-04 | The system shall allow authenticated administrators to create, update, and cancel patient appointments. | Admin | High |
| FR-05 | The system shall allow authenticated patients to view their own upcoming and past appointments. | Patient | High |
| FR-06 | The system shall allow authenticated patients to view their own medical records in read-only mode. | Patient | High |
| FR-07 | The system shall authenticate all users with a unique username and password before granting access to any system function. | All | High |
| FR-08 | The system shall enforce role-based access control, ensuring that each user role can only access the data and functions authorised for that role. | All | High |
| FR-09 | The system shall log all patient data access events, including the user identity, timestamp, and action performed. | System | High |
| FR-10 | The system shall allow administrators to create, deactivate, and reassign user accounts. | Admin | Medium |
| FR-11 | The system shall transmit all data between the client browser and the server over HTTPS. | System | High |
| FR-12 | The system shall store all patient records in an encrypted database with no direct internet access path. | System | High |

**Table D.2** — Non-Functional Requirements

| ID | Category | Requirement | Metric / Verification Method |
| --- | --- | --- | --- |
| NFR-01 | Security | All data stored in the RDS database shall be encrypted at rest using AES-256 via AWS KMS. | AWS Console, RDS encryption status |
| NFR-02 | Security | All data in transit between the client and ALB shall be encrypted using TLS 1.2 or higher. | SSL Labs scan, ALB listener configuration |
| NFR-03 | Security | All IAM roles shall be configured with least-privilege policies, granting only the permissions required for the role's function. | IAM policy review, AWS IAM Access Analyzer |
| NFR-04 | Security | The CI/CD pipeline shall block deployment on any critical or high-severity finding from Trivy, SonarQube, or Checkov. | GitHub Actions pipeline log |
| NFR-05 | Availability | The system shall maintain 99.9% uptime through multi-AZ EC2 and RDS deployment. | CloudWatch availability metric |
| NFR-06 | Recovery | The system shall be fully redeployable from a clean Terraform state within 15 minutes of a complete infrastructure wipe. | RTO stress test, measured recovery time |
| NFR-07 | Compliance | The system shall achieve and maintain a passing HIPAA posture score as measured by AWS Security Hub. | Security Hub HIPAA standard findings report |
| NFR-08 | Auditability | All AWS API calls and patient data access events shall be logged in CloudTrail with a minimum retention period of 90 days. | CloudTrail configuration, S3 log bucket |
| NFR-09 | Performance | The system shall respond to authenticated API requests within 3 seconds under normal load (up to 50 concurrent users). | Load test results |
| NFR-10 | Scalability | The application tier shall support horizontal scaling through EC2 Auto Scaling to accommodate increased patient load. | Auto Scaling group configuration |
| NFR-11 | Maintainability | All infrastructure shall be defined as version-controlled Terraform code, with no manually provisioned resources in the production environment. | Terraform state file audit |

**Tables D.1 and D.2 are the requirements as submitted in the PSM1 report.** Tables D.3 and D.4 below are additions raised during PSM2 Sprint 3/3c implementation — each traces back to an entry in `docs/psm2/report-delta.md` (cited in the Source column) and was not part of the original PSM1 design.

**Table D.3** — Functional Requirements (PSM2 Sprint 3 / 3c Additions)

| ID | Requirement | User Role | Priority | Source |
| --- | --- | --- | --- | --- |
| FR-13 | Only Superadmin may create, deactivate, or reactivate Doctor and Admin accounts. | Superadmin | High | DELTA-001 |
| FR-14 | The system shall display a public landing page for unauthenticated users describing clinic services. | System | Medium | DELTA-003 |
| FR-15 | A patient shall be able to self-register via phone-OTP verification, providing national ID and date of birth for identity confirmation, and set their own password. | Patient | High | DELTA-010 |
| FR-16 | A self-registered patient shall be able to book their own first appointment; the system auto-assigns the patient to the selected doctor. | Patient | High | DELTA-010 |
| FR-17 | A patient shall be able to cancel their own upcoming appointment. | Patient | Medium | DELTA-010 |
| FR-18 | Staff shall search for patients by national ID, Iqama/passport number, name, or phone number; the system shall prevent duplicate registration for the same ID number. | Admin | High | DELTA-005 |
| FR-19 | The system shall capture patient safety information: blood type, allergies, emergency contact, insurance provider/number, nationality, and address. | Admin | High | DELTA-006 |
| FR-20 | Doctors shall document consultations using a structured SOAP format (chief complaint, objective, assessment, plan) plus vital signs. | Doctor | High | DELTA-007 |
| FR-21 | Appointment status shall follow the lifecycle scheduled → confirmed → completed / cancelled, with cancellation reason and cancelling user recorded. | Admin | High | DELTA-008 |
| FR-22 | The system shall enforce doctor availability; appointments cannot be booked outside a doctor's defined weekly working hours. | System | High | DELTA-009 |
| FR-23 | Staff and patients shall select a doctor or patient by name from a searchable directory, never by raw database ID. | All | Medium | DELTA-012, DELTA-013, DELTA-018 |
| FR-24 | Patient registration shall not disclose a password to staff; the system shall issue a one-time QR code / link the patient uses to set their own password. | System | High | DELTA-017 |
| FR-25 | Superadmin shall be able to create, edit, and remove a doctor's weekly working hours. | Superadmin | Medium | DELTA-019 |
| FR-26 | A patient shall be able to view their own billing invoices, and their own lab results once released by their doctor. | Patient | High | DELTA-020 |
| FR-27 | Superadmin shall manage the clinic's service/price catalogue; Staff and Doctor roles may view it read-only. | Superadmin | Medium | DELTA-025 |
| FR-28 | Staff shall be able to check in a walk-in patient against an assigned doctor and receive a daily sequential queue number. | Admin | High | DELTA-026 |
| FR-29 | Only the treating doctor may transition a walk-in visit between waiting, in-progress, and completed status. | Doctor | High | DELTA-026 |
| FR-30 | During a walk-in consultation, a doctor shall record billable services and clinical notes; staff shall apply discounts, collect payment, and the system shall generate a print-ready bilingual tax invoice. | Doctor, Admin | High | DELTA-027 |
| FR-31 | A patient shall be able to view and print their own billing history; staff/doctor shall be able to view a specific patient's billing history from their profile. | All | Medium | DELTA-028, DELTA-033 |
| FR-32 | The system shall record which staff member collected each payment. | System | High | DELTA-031, DELTA-033 |
| FR-33 | Superadmin shall have access to a real-time operational dashboard showing user counts, active doctors, and daily activity metrics. | Superadmin | Medium | DELTA-032 |
| FR-34 | Staff shall be able to trigger an SMS appointment reminder to a patient directly from the appointment list. | Admin | Medium | DELTA-034 |
| FR-35 | A doctor shall be able to view all medical records for any patient with whom they have a treatment relationship, regardless of which doctor wrote each record. | Doctor | High | DELTA-035 |
| FR-36 | Patients shall be able to export or print their medical records and prescriptions as PDFs from their portal. | Patient | Low | DELTA-036 |
| FR-37 | The system shall provide a keyboard-first command palette, a visual walk-in queue board, a dental/body clinical annotation tool, a structured electronic prescription form, consultation-room status tracking, and an insurance co-pay calculator. | Admin, Doctor | Medium | DELTA-037 |
| FR-38 | Superadmin/management shall have access to financial analytics (revenue by date, doctor, and payment method) and an end-of-day cashier reconciliation (Z-Report). | Superadmin | Medium | DELTA-038 |
| FR-39 | The system shall warn a doctor of a potential drug-allergy interaction when prescribing, support voice dictation of clinical notes, support barcode patient lookup, and provide a self-service lobby kiosk for queue check-in. | Doctor, Admin | Medium | DELTA-038 |
| FR-40 | Doctors shall be able to pre-fill SOAP notes from a template library for common conditions. | Doctor | Low | DELTA-039 |
| FR-41 | Patients shall be able to check their real-time queue position from a public URL without logging in. | System | Medium | DELTA-039 |
| FR-42 | The system shall allow a doctor to generate an official MOH Seha-compliant sick leave certificate during a consultation, bound to the authenticated doctor's identity. | Doctor | High | DELTA-041 |
| FR-43 | The system shall display structured lab results (CBC, Lipid Profile, Renal Function, Chest X-Ray) with automated reference-range status indicators. | Doctor, Patient | Medium | DELTA-042 |
| FR-44 | Staff shall select appointment time slots from a visual 30-minute grid showing real-time slot availability per doctor per date. | Admin | Medium | DELTA-043 |
| FR-45 | Each medical record shall display the attending doctor's name. | System | Low | DELTA-044 |
| FR-46 | A patient who forgets their password shall be able to reset it via phone OTP verification without staff intervention. Staff accounts are explicitly out of scope, as they have no verified contact channel to build self-service on. | Patient | High | DELTA-047 |

**Table D.4** — Non-Functional Requirements (PSM2 Sprint 3 / 3c Additions)

| ID | Category | Requirement | Metric / Verification Method | Source |
| --- | --- | --- | --- | --- |
| NFR-12 | Security | The system shall enforce the principle of least privilege — Staff (Admin role) accounts shall not have account management capabilities. | RBAC + route-level middleware review | DELTA-004 |
| NFR-13 | Patient Safety | Blood type and allergy information shall be visible to the treating doctor at a glance during consultation. | UI review — Patient Summary card / Vitals Highlight Bar | DELTA-006, DELTA-030 |
| NFR-14 | Performance | The system shall maintain sub-second query response on patient timeline and appointment schedule queries under concurrent clinic load. | Composite index review; query timing under load | DELTA-031 |
| NFR-15 | Security | Every RLS policy that casts a session variable to `::uuid` shall guard the empty-string case with `NULLIF(..., '')` before casting. | `schema.sql` review against `rls-policy-guidelines.md` | DELTA-029 |
| NFR-16 | Privacy | The public queue-status endpoint shall return only position counts and numbers, never patient names or other identifying information. | Endpoint response review (unauthenticated) | DELTA-039 |

---

## APPENDIX E — DATABASE SCHEMA

**`users`**: Stores authentication credentials and role assignment for all system users. Passwords are stored as bcrypt hashes, hence the plaintext password is never persisted.

**Table E.1** — Database Table: `users`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `user_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `username` | `VARCHAR(50)` | UNIQUE, NOT NULL | Login username |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt hash of password |
| `role` | `ENUM('doctor', 'admin', 'patient')` | NOT NULL | Assigned role |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Account active status |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | Account creation timestamp |
| `last_login` | `TIMESTAMP` | NULLABLE | Last successful login |

**`patients`**: Stores patient demographic information. Linked to the `users` table for authentication and to the `doctors` table for the assigned doctor relationship.

**Table E.2** — Database Table: `patients`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `patient_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `user_id` | `UUID` | FK → `users.user_id` | Authentication account |
| `first_name` | `VARCHAR(100)` | NOT NULL | Patient first name |
| `last_name` | `VARCHAR(100)` | NOT NULL | Patient last name |
| `date_of_birth` | `DATE` | NOT NULL | Date of birth |
| `contact_number` | `VARCHAR(20)` | NULLABLE | Phone number |
| `assigned_doctor_id` | `UUID` | FK → `doctors.doctor_id` | Assigned treating doctor |
| `registered_at` | `TIMESTAMP` | DEFAULT NOW() | Registration timestamp |

**`doctors`**: Stores clinical staff information, linked to the `users` table for authentication.

**Table E.3** — Database Table: `doctors`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `doctor_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `user_id` | `UUID` | FK → `users.user_id` | Authentication account |
| `first_name` | `VARCHAR(100)` | NOT NULL | Doctor first name |
| `last_name` | `VARCHAR(100)` | NOT NULL | Doctor last name |
| `specialisation` | `VARCHAR(100)` | NULLABLE | Medical specialisation |

**`medical_records`**: Stores clinical records created by doctors. Each record is linked to exactly one patient and one creating doctor.

**Table E.4** — Database Table: `medical_records`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `record_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `patient_id` | `UUID` | FK → `patients.patient_id` | Associated patient |
| `doctor_id` | `UUID` | FK → `doctors.doctor_id` | Creating doctor |
| `diagnosis` | `TEXT` | NOT NULL | Clinical diagnosis |
| `prescription` | `TEXT` | NULLABLE | Prescribed treatment |
| `notes` | `TEXT` | NULLABLE | Additional clinical notes |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | DEFAULT NOW() | Last update timestamp |

**`appointments`**: Stores scheduled appointments linking patients to doctors at a defined time.

**Table E.5** — Database Table: `appointments`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `appointment_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `patient_id` | `UUID` | FK → `patients.patient_id` | Attending patient |
| `doctor_id` | `UUID` | FK → `doctors.doctor_id` | Attending doctor |
| `scheduled_at` | `TIMESTAMP` | NOT NULL | Appointment date and time |
| `status` | `ENUM('scheduled', 'completed', 'cancelled')` | DEFAULT 'scheduled' | Current status |
| `notes` | `TEXT` | NULLABLE | Admin notes |
| `created_by` | `UUID` | FK → `users.user_id` | Admin who created booking |

**`audit_log`**: An append-only table recording every significant data access event. This table satisfies the HIPAA audit control requirement and the CloudTrail complement at the application data level.

**Table E.6** — Database Table: `audit_log`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `log_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `user_id` | `UUID` | FK → `users.user_id` | User who performed the action |
| `action` | `VARCHAR(50)` | NOT NULL | Action type (CREATE, READ, UPDATE, DELETE) |
| `table_name` | `VARCHAR(50)` | NOT NULL | Target table |
| `record_id` | `UUID` | NOT NULL | Target record identifier |
| `ip_address` | `INET` | NULLABLE | Client IP address |
| `performed_at` | `TIMESTAMP` | DEFAULT NOW() | Event timestamp |

### Schema Extensions (PSM2 Sprint 3 / 3c)

**Tables E.1–E.6 above are the schema as submitted in the PSM1 report.** The tables and columns below were added during PSM2 implementation. Unlike the FR/NFR additions in Appendix D, these are verified directly against `src/backend/src/config/schema.sql` and `src/backend/scripts/apply-feature-additions.js` (not transcribed from `docs/psm2/report-delta.md` alone) — two discrepancies between the delta log and the actual shipped schema were found in the process and are noted where relevant.

**Column additions to existing tables**

| Table | Columns added | Source |
| --- | --- | --- |
| `users` | `role` CHECK widened to `'superadmin', 'doctor', 'admin', 'patient'` | DELTA-001 |
| `patients` | `national_id`, `id_type` CHECK('national_id','iqama','passport') | DELTA-005 |
| `patients` | `blood_type`, `allergies`, `nationality`, `address`, `emergency_contact_name`, `emergency_contact_phone`, `insurance_provider`, `insurance_number` | DELTA-006 |
| `patients` | `email`, `preferred_language` CHECK('en','ar') | DELTA-010 |
| `patients` | `file_no` (INTEGER, UNIQUE, NOT NULL, backed by `patient_file_no_seq` starting at 10001) | DELTA-024 |
| `medical_records` | `chief_complaint`, `objective`, `assessment`, `plan`, `vital_signs` JSONB, `visit_type` CHECK('consultation','follow_up','emergency','checkup') | DELTA-007 |
| `medical_records` | `prescriptions_data` JSONB (structured Wasfaty/SFDA prescription array, separate from the free-text `prescription` column) | DELTA-046 |
| `appointments` | `status` CHECK widened to include `'confirmed'` and `'arrived'`; `duration_minutes`, `cancelled_by` (FK `users`), `cancellation_note`, `updated_at` | DELTA-008 |
| `otp_verifications` | `purpose` CHECK widened to include `'password_reset'`; `user_id` (nullable FK `users`) | DELTA-047 |
| `password_setup_tokens` | `purpose` CHECK('initial_setup','password_reset') | DELTA-017, DELTA-047 |
| `lab_results` | `released_at`, `released_by` (FK `users`) | DELTA-020 |
| `patient_invoices` | `category` CHECK('invoice','consent','other') — the `'consent'` value reuses this table for digital consent-form uploads rather than a parallel table | (schema.sql, not separately logged as a delta) |
| `visit_invoices` | `paid_at`, `paid_by` (FK `users`), `approval_code`, `policy_number`, `coverage_percent`, `co_pay_amount`, `patient_amount`, `insurance_amount` | DELTA-031, DELTA-033, DELTA-037 |

**New entities**

**`doctor_availability`** (DELTA-009) — the doctor's weekly recurring working-hours template.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `availability_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `doctor_id` | `UUID` | FK → `doctors.doctor_id` | Owning doctor |
| `day_of_week` | `SMALLINT` | CHECK 0–6 (Sun–Sat) | Day this row applies to |
| `start_time` / `end_time` | `TIME` | NOT NULL | Working window for that day |
| `slot_minutes` | `INT` | DEFAULT 30 | Appointment slot length |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | — |

**`otp_verifications`** (DELTA-010, widened DELTA-047) — pre-authentication phone OTP state for both self-registration and password reset. No RLS (no session exists yet to key a policy on).

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `otp_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `phone_number`, `national_id`, `id_type`, `date_of_birth` | mixed | NOT NULL | Identity captured at request time so step 2 never re-trusts client input |
| `otp_hash` | `VARCHAR(255)` | NOT NULL | Hashed OTP code |
| `purpose` | `VARCHAR(20)` | CHECK('registration','password_reset') | Distinguishes UC-19 self-registration from the forgot-password flow |
| `user_id` | `UUID` | FK → `users.user_id`, nullable | Set only for password-reset rows |
| `attempts` | `INT` | DEFAULT 0 | Attempt counter |
| `expires_at`, `verified_at`, `created_at` | `TIMESTAMPTZ` | — | — |

**`password_setup_tokens`** (DELTA-017, widened DELTA-047) — single-use token backing both the QR-based first-password flow and password reset.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `token_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `user_id` | `UUID` | FK → `users.user_id` | Account being set up or reset |
| `token` | `VARCHAR(64)` | UNIQUE NOT NULL | 256-bit random token |
| `purpose` | `VARCHAR(20)` | CHECK('initial_setup','password_reset') | Distinguishes registration setup from a later reset |
| `expires_at`, `used_at`, `created_at` | `TIMESTAMPTZ` | — | Single-use: `used_at` set on consumption |

**`clinic_services`** (DELTA-025) — the price/service catalogue.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `service_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `code_no` | `VARCHAR(20)` | UNIQUE NOT NULL | Service code |
| `name_en`, `name_ar` | `VARCHAR` | — | Bilingual service name |
| `base_price` | `DECIMAL(10,2)` | CHECK ≥ 0 | Price before discount/VAT |
| `category` | `VARCHAR(50)` | FK → `departments.key` | Shared taxonomy with `doctors.specialisation` |
| `vat_pct` | `DECIMAL(5,2)` | DEFAULT 15 | — |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Deactivated, never deleted, to preserve billing history |

**`visits`** (DELTA-026) — same-day walk-in encounters, distinct from pre-booked `appointments`.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `visit_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `patient_id`, `doctor_id` | `UUID` | FK, NOT NULL | Attending patient/doctor |
| `queue_no` | `INTEGER` | NOT NULL | Daily sequential queue number |
| `clinic` | `VARCHAR(50)` | nullable | Branch (Namar / Dirab) |
| `status` | `VARCHAR(20)` | CHECK('waiting','in_progress','completed','billed','cancelled') | Enforced server-side by a `BEFORE UPDATE` trigger (see Design Decisions, §4.7) restricting the allowed transitions to `waiting→in_progress→completed→billed` or `waiting→cancelled` |
| `visit_type` | `VARCHAR(20)` | CHECK('consultation','follow_up','emergency','checkup') | Reason for the walk-in |
| `prescription_notes` | `TEXT` | nullable | Free-text notes captured during consultation |
| `checked_in_at`, `completed_at` | `TIMESTAMPTZ` | — | — |
| `created_by` | `UUID` | FK → `users.user_id` | Staff who checked the patient in |

**`visit_invoices`** / **`invoice_items`** / **`invoice_payments`** (DELTA-027, extended DELTA-031/033/037) — the walk-in billing engine.

`visit_invoices`: `invoice_id` PK, `inv_no` (from `invoice_no_seq` starting at 900001), `visit_id` (FK, unique), `patient_id`/`doctor_id` FK, `payment_method` CHECK('cash','card','insurance'), `subtotal`/`total_discount`/`net_total`/`total_vat`/`grand_total`/`amount_paid`/`amount_balance` (`DECIMAL(10,2)`), `status` CHECK('draft','pending_billing','paid','partial','cancelled'), plus the insurance co-pay columns listed in the table above.

`invoice_items`: `item_id` PK, `invoice_id` FK, `service_id` FK → `clinic_services` (nullable — line items are copied at time of billing so a later price change never alters a historical invoice), `qty`, `unit_price`, `discount_pct`/`discount_amount`, `net_price`, `vat_pct`/`vat_amount`, `total_with_vat`.

`invoice_payments`: an **append-only payment ledger** added to fix a real stuck-state bug — `visit_invoices.amount_paid` used to be overwritten (not accumulated) by every payment call, so a partially-paid invoice had no way to ever collect the remainder without erasing the first payment. `amount_paid` is now always derived as `SUM(invoice_payments.amount)`. Columns: `payment_id` PK, `invoice_id` FK, `amount` (CHECK > 0), `payment_method`, `collected_by` (FK `users` — the fraud-prevention attribution described in DELTA-031/033), `collected_at`.

**`patient_care_team`** (supports DELTA-035 continuity-of-care) — one row per doctor–patient treatment relationship, replacing the single `assigned_doctor_id` as the sole gate on doctor access to a patient's records.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `assignment_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `patient_id`, `doctor_id` | `UUID` | FK, UNIQUE together | One row per doctor–patient pair |
| `speciality` | `VARCHAR(100)` | nullable | — |
| `is_primary` | `BOOLEAN` | DEFAULT FALSE | Marks the registration/primary doctor |
| `assigned_by`, `assigned_at` | mixed | — | — |

**`sick_leaves`** (DELTA-041) — MOH Seha-compliant sick-leave certificates. Applied via a supplementary migration script (`scripts/apply-feature-additions.js`) rather than the main `schema.sql`.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `leave_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `visit_id` | `UUID` | FK, nullable | Visit the certificate was issued during |
| `patient_id`, `doctor_id` | `UUID` | FK, NOT NULL | — |
| `reference_no` | `VARCHAR(50)` | UNIQUE | `SEHA-SL-XXXXXX` printed reference |
| `start_date`, `days_count` | mixed | NOT NULL | — |
| `diagnosis`, `work_restrictions` | `TEXT` | — | — |

**`doctor_schedules`** (DELTA-043) — the instantiated daily slot grid, distinct from `doctor_availability`'s weekly template. Also applied via `apply-feature-additions.js`.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `schedule_id` | `UUID` | PRIMARY KEY | Unique identifier |
| `doctor_id` | `UUID` | FK | — |
| `slot_date` | `DATE` | NOT NULL | — |
| `slot_time` | `VARCHAR(20)` | NOT NULL | Stored as text, not `TIME` |
| `status` | `VARCHAR(20)` | CHECK('available','booked','break') | — |

**`notifications`** (DELTA-046) — as actually shipped, this differs from the schema first proposed in the delta log: rows are bilingual (`title_en`/`title_ar`/`message_en`/`message_ar`) and carry a free-text `type`/`target_role` rather than a fixed CHECK list or a `metadata` JSONB payload. Columns: `notification_id` PK, `user_id` (FK, nullable), `target_role`, `title_en`, `title_ar`, `message_en`, `message_ar`, `type` (DEFAULT `'general'`), `is_read` (DEFAULT FALSE), `created_at`. Also applied via `apply-feature-additions.js`.

**Departments** — a `departments` table (`department_id`, `key`, `name_en`, `name_ar`, `is_active`) was also added, replacing a previously hardcoded frontend category list; `doctors.specialisation` and `clinic_services.category` both carry a foreign key to `departments.key`. This addition is not tied to a specific `report-delta.md` entry.

**Not part of the persisted schema — verified absent, documented here to prevent overstatement:**

- **Room / equipment allocation** (originally part of DELTA-037) was built (`clinic_rooms` table, `roomsController.js`, `RoomStatusGrid.tsx`) but never wired into any screen — the routes file was never mounted, and the frontend component was never imported anywhere. It was removed outright on 2026-07-24 (`DROP TABLE clinic_rooms`, `visits.room_id` column dropped) once confirmed genuinely unused end-to-end, rather than left as dead code. Chapter 4's design does not include a rooms entity as a result.
- **Clinical templates** (DELTA-039) are a hardcoded, bilingual in-memory content library inside `clinicalTemplatesController.js` (one JS object per condition, keyed by specialty), not a database table — there is no `clinical_templates` table anywhere in the schema. The API serves this static list; nothing about it is editable at runtime, which contradicts DELTA-039's original description of a `POST /templates` superadmin-managed table.
- **Odontogram / body chart annotations** (DELTA-037) have no backend persistence at all — `OdontogramBodyChart.tsx` is a client-side SVG interaction tool with no corresponding column on `medical_records` or elsewhere. Annotations made in the UI are not currently saved.

---

## APPENDIX F — INTERVIEW PROTOCOL

Interview Questions with the Stakeholder

1. How do you currently access and manage patient records on a daily basis?

2. What are the most significant difficulties you face when using the current system?

3. How was the ransomware incident discovered, and what was the immediate impact on your work?

4. How long was the clinic unable to access patient records, and how was this period managed?

5. What data was lost or inaccessible as a result of the attack?

6. Were there any security policies or backup procedures in place at the time of the incident?

7. What features of a new system would most improve your day-to-day work?

8. What security or privacy concerns do you have about moving patient data to a cloud system?

---

## APPENDIX G — SECURITY DESIGN SPECIFICATION

**Table G.1** — Security Group Rules

| Security Group | Direction | Protocol | Port | Source / Destination | Purpose |
| --- | --- | --- | --- | --- | --- |
| alb-sg | Inbound | TCP | 443 | 0.0.0.0/0 | HTTPS from internet |
| alb-sg | Inbound | TCP | 80 | 0.0.0.0/0 | HTTP (redirected to 443) |
| alb-sg | Outbound | TCP | 5000 | ec2-sg | Forward to application |
| ec2-sg | Inbound | TCP | 5000 | alb-sg | Accept only from ALB |
| ec2-sg | Outbound | TCP | 5432 | rds-sg | Connect to database |
| ec2-sg | Outbound | TCP | 443 | 0.0.0.0/0 | AWS API / NAT outbound |
| rds-sg | Inbound | TCP | 5432 | ec2-sg | Accept only from EC2 |
| rds-sg | Outbound | — | — | None | No outbound permitted |

**Table G.2** — NACL Rules Summary

| NACL | Applies To | Key Inbound Rules | Key Outbound Rules |
| --- | --- | --- | --- |
| public-nacl | Public subnets | Allow TCP 443 from 0.0.0.0/0; Allow TCP 80 from 0.0.0.0/0; Allow ephemeral ports (1024–65535) from 0.0.0.0/0 | Allow all to 0.0.0.0/0 |
| app-nacl | App subnets | Allow TCP 5000 from 10.0.1.0/24 and 10.0.2.0/24 (public subnets); Allow ephemeral ports from 10.0.5.0/24 and 10.0.6.0/24 (DB response) | Allow TCP 5432 to 10.0.5.0/24 and 10.0.6.0/24; Allow ephemeral ports to public subnets |
| db-nacl | DB subnets | Allow TCP 5432 from 10.0.3.0/24 and 10.0.4.0/24 (app subnets) only; Deny all other inbound | Allow ephemeral ports to 10.0.3.0/24 and 10.0.4.0/24 only |

#### Authentication Mechanism

Authentication identifies the user before access is granted to any system resources. The system uses a credentials-based process for authentication, whereby bcrypt hash passwords are used for authentication, while sessions are maintained using JWT.

**Password security**: Plaintext user passwords are not retained at any point. During user signup, the password undergoes the bcrypt hashing function with a cost of 12, resulting in a 60 character long hash value. A cost of 12 means that the verification process takes around 250 milliseconds per hash on normal hardware, rendering offline brute force attack attempts computationally impossible. The plaintext password is deleted after the hashing process and never logged anywhere or written into any columns or error messages.

**JWT Access Tokens**: After a successful login process, the server generates a signed JWT that includes `userId`, `role`, and the time of expiration. This token is signed on the server-side using a secret key with the HMAC-SHA256 hashing function, making it impossible to forge on the client side. The access token expires in 15 minutes, whereas the refresh token lasts 7 days.

**Cookie Security**: The cookie containing the JWT will be set on the client side as an `httpOnly`, `Secure`, `SameSite=Strict` cookie. By setting `httpOnly` on the cookie, no JavaScript can access its value, mitigating the risk of XSS attacks which could steal the cookie from the client. By using the `Secure` cookie setting, only secure connections will be able to transfer the cookie from the client to the server.

**Account Lockout Policy**: Following the third unsuccessful login attempt, the flag `isActive` is set to false and all subsequent login attempts will fail with a standard message. The notification of the system alert is sent to the admin role. This policy fulfills the HIPAA security requirements of protection from repeated access attempts.

#### Authorization and Access Control

Authorisation decides what the authenticated user can perform. Authorisation has a two-tiered scheme, which comprises role-based access control (RBAC) in the application layer and row-level security (RLS) in the database layer.

**Role-Based Access Control at Application Layer**: The `RBACMiddleware` class captures every HTTP request sent to the API post-authentication. It fetches the `role` field value from the decoded JWT and matches it with the expected role on the corresponding route. In case the caller does not have the appropriate role assigned to him/her, the HTTP 403 Forbidden status is returned, and the request is not processed by the route handler. Table G.3 highlight the permission rules for each actor.

**Table G.3** — Role-Permission Matrix (as submitted in PSM1 — three roles)

| Operation | Doctor | Admin | Patient |
| --- | --- | --- | --- |
| Login / Logout | ✓ | ✓ | ✓ |
| View assigned patients | ✓ | ✓ | — |
| Register / update patient | — | ✓ | — |
| Assign / reassign doctor | — | ✓ | — |
| Deactivate user account | — | ✓ | — |
| Create medical record | ✓ | — | — |
| View medical record | ✓ (own patients) | — | ✓ (own only) |
| Update medical record | ✓ (own records) | — | — |
| Schedule appointment | — | ✓ | — |
| View appointments | ✓ | ✓ | ✓ (own only) |
| Update / cancel appointment | — | ✓ | — |

**Table G.3a** — Role-Permission Matrix Update (PSM2 Sprint 3 / 3c — four roles)

A fourth role, **Superadmin**, was added during Sprint 3 implementation (DELTA-001) after it was found that the original Admin role — reception/registration counter staff — should never have been able to create or deactivate system accounts; that is a privilege-escalation risk, not a reception-desk function. The `Admin` role's *database* value is unchanged, but its UI display label was renamed to **"Staff"** (English) / **"موظف"** (Arabic) throughout the application, since "Staff" more accurately reflects the role than "Admin" (DELTA-002). The table below restates the matrix with both changes applied; blank Doctor/Staff/Patient cells inherit their PSM1 meaning from Table G.3 above.

| Operation | Doctor | Staff (`admin`) | Patient | Superadmin |
| --- | --- | --- | --- | --- |
| Create / deactivate / reactivate Doctor or Admin account | — | — (explicitly denied — DELTA-004) | — | ✓ |
| Manage a doctor's weekly working hours | — | — | — | ✓ |
| Manage the clinic service/price catalogue | — | view only | — | ✓ (full CRUD) |
| View the real-time operational (system-health) dashboard | — | — | — | ✓ |
| Check in a walk-in patient / assign a queue number | — | ✓ | — | ✓ |
| Transition a walk-in visit's consultation status | ✓ (own visits only, server-enforced) | — | — | — |
| Add billable services / clinical notes during a consultation | ✓ (own visits only) | — | — | — |
| Apply a billing discount / collect payment | — | ✓ | — | ✓ |
| View own billing history | — | ✓ (visits they treated) | ✓ (own, non-draft only) | ✓ (all) |
| View own lab results | — | — | ✓ (own, released only) | — |
| Release a lab result to the patient | ✓ (must be the assigned/care-team doctor) | — | — | — |

The governing principle for all four roles remains least privilege: Superadmin is not a superset convenience role layered on top of Admin, but the only role permitted to perform account-management and system-configuration actions that Staff (Admin) is explicitly barred from — enforced at the API route layer, not just hidden in the UI (DELTA-004).

**Row-Level Security (RLS) Database Layer**: The policies defined using PostgreSQL RLS will enforce restrictions at the storage layer irrespective of any other layer. Hence, despite any circumvention of the application RBAC, such as by way of a hijacked API call, the database itself would not allow any retrieval of data rows that are unauthorized for the authenticated user. Important RLS policies are:

1. medical_records: a Doctor may only SELECT or UPDATE rows where doctor_id matches the session's userId. A Patient may only SELECT rows where patient_id maps to their own user account.

2. patients: a Doctor may only SELECT patients where assigned_doctor_id matches their doctorId.

3. appointments: visibility is scoped to the doctor_id or patient_id matching the session user.

Admin's database user account, on the other hand, operates under policies that grant full row-level permissions to all data in its administrative activities but are limited only to administration-related tables and activities.

#### API Security Controls

The REST API exposed by the Node.js/Express backend is hardened through a layered set of middleware controls applied globally to all routes.

**Rate Limiting**: With the help of `express-rate-limit`, each request from an IP can be limited up to a total of 100 per 15 minutes. The limit for the login endpoint is reduced even further to just 10 in 15 minutes. All those requests which exceed the limit will get a 429 HTTP response status code.

**Input Validity and Sanitization**: All inputs to `POST` and `PUT` requests are validated by `express-validator` prior to execution of the corresponding route handlers. The validation process includes checking the input type, length, and other criteria, including formatting dates according to ISO 8601 and validating phone numbers as purely numeric values. If the input data fails the validation check, it is rejected with an HTTP 400 response and an informative message.

**Parameterised Queries**: All queries made to the database are done using the `node-postgres` library with parameterised queries. None of the queries have any form of SQL statement built up via concatenating user input together. User inputs for the parameterised query statements are passed to the PostgreSQL server where SQL injection is not possible.

**Security Headers**: The `Helmet.js` middleware package sets the following HTTP response headers on all API responses. Table G.4 shows each header and its corresponding value and protection:

**Table G.4** — HTTP Security Headers Configuration

| Header | Value | Protection |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'` | Prevents inline script execution |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframes |
| `Strict-Transport-Security` | `max-age=31536000` | Forces HTTPS for one year |
| `Referrer-Policy` | `no-referrer` | Suppresses referrer header leakage |

**CORS Policy**: The CORS policy is set up such that any request must come from the cloud front origin of the clinic. Wildcards are strictly disallowed. The following methods are allowed for CORS policy: `GET`, `POST`, `PUT`, and `DELETE`.

**Error Handling**: Error handler middleware is used to capture any exceptions that have not been handled. The response to the user contains a simple error message together with an HTTP status code. Information such as stack trace, database error message, and server paths is never exposed since this might be harmful.

#### Network Security Controls

The AWS network architecture enforces isolation between public-facing, application, and database tiers using a layered set of controls that ensure no component is directly reachable unless explicitly permitted.

**VPC and Subnet Isolation**: The whole setup takes place within a private Virtual Private Cloud (VPC). Both EC2 and RDS servers are located in the private subnet and do not have any internet connectivity whatsoever. The Application Load Balancer (ALB) and the NAT Gateway are the only services in the public subnet. In other words, there is no way for anyone from the internet to get access to the application/database tiers unless going through the ALB.

**Security Groups**: AWS Security Groups act as stateful virtual firewalls at the instance level. Three security groups enforce least-privilege ingress rules. Table G.5 explains each security group and which protocol it governs:

**Table G.5** — Network Security Group Configuration Matrix

| Security Group | Inbound Rule | Source |
| --- | --- | --- |
| `ALB-SG` | TCP 443 (HTTPS) | 0.0.0.0/0 |
| `EC2-SG` | TCP 3000 (Node.js) | `ALB-SG` only |
| `RDS-SG` | TCP 5432 (PostgreSQL) | `EC2-SG` only |

Inbound traffic via SSH or any other administrative ports from the internet will not be allowed. Access to the EC2 instance for performing any kind of maintenance tasks can only be accomplished via AWS Systems Manager (SSM) Session Manager where no inbound ports are created.

**ALB HTTPS Termination**: The Application Load Balancer is provided with a listener on HTTPS port 443 that utilizes the SSL policy named `ELBSecurityPolicy-TLS13-1-2-2021-06`, which mandates the use of TLS 1.2 as the minimum protocol but also supports TLS 1.3. The other HTTP listener on port 80 issues an HTTP 301 redirection to its HTTPS counterpart URL. SSL certificates are taken care of by AWS Certificate Manager.

**NAT Gateway**: Outbound internet traffic from the EC2 instance is routed via the NAT Gateway located in the public subnet. The EC2 instance does not have an Elastic IP address or any outbound internet connection path; however, it still maintains the capacity for outgoing internet communications when necessary.

#### Data Encryption

All patient health information (PHI) is encrypted both at rest and in transit, satisfying the HIPAA encryption specification.

**In-Transit Encryption**: The traffic between the client browser and the system is encrypted using TLS 1.2 or above, terminating at the ALB. SSL encryption is used for the network traffic between the EC2 application server and the RDS PostgreSQL server, and it is enabled through the `rds.force_ssl` parameter value as `1`. There is no plaintext communication link anywhere in the data path.

**At-Rest Encryption Database**: The RDS PostgreSQL instance is provisioned via `storage_encrypted = true` through Terraform, where encryption uses an AWS CMK (Customer Managed Key). All data files, automatic backups, read replicas, and database snapshots are encrypted using the same CMK. Automatic key rotation for the CMK takes place once per year. In other words, if the actual storage (EBS volume) is taken off, no one will be able to read anything without having access to the CMK.

**Encryption at Rest Object Storage**: The React static site build stored on the S3 bucket is protected with encryption via server-side encryption (SSE-S3 [AES-256]). The settings for block-public-acls, block-public-policy, ignore-public-acls, and restrict-public-buckets have all been configured to "true", ensuring that the S3 bucket contents cannot be accessed directly from the Internet. The CloudFront distribution has access to the S3 bucket via the OAI (Origin Access Identity).

#### Monitoring, Audit Trail, and Incident Response

Continuous monitoring and a complete audit trail are required to detect security incidents and to demonstrate accountability for all actions taken on patient data.

**Application Audit Log**: All actions, including the creation, reading, updating, and deletion of data, done on patient records will be logged in the `audit_log` table through the `AuditLog` model class. These logs include the `userId`, the type of action performed, the resource ID, the IP address, and timestamp. The logs form an immutable set of data for forensic purposes as per HIPAA audit controls requirements (§164.312(b)).

**CloudTrail**: CloudTrail is available in all AWS regions and logs each and every API request sent to the AWS account, including details such as who initiated it, its IP, and the exact time it was executed. CloudTrail logs are uploaded to an S3 bucket having MFA delete set to "on," and this makes sure that these logs cannot be tampered with.

**AWS CloudWatch**: Application logs from the EC2 instance are streamed to CloudWatch Logs using the CloudWatch agent. CloudWatch alarms are configured for the following conditions:

1. Five or more failed login attempts within a five-minute window → triggers SNS notification to the administrator.

2. HTTP 5xx error rate exceeding 1% of requests → alarm for application layer failures.

3. RDS CPU utilisation exceeding 80% for five consecutive minutes → capacity alert.

**AWS Security Hub**: This service combines findings from AWS GuardDuty (threat detection), Amazon Inspector (vulnerability scanning for EC2 instances), and the Checkov IaC scan in the CI/CD pipeline into one security posture view. Any finding marked as either 'HIGH' or 'CRITICAL' triggers an alert.

**HIPAA Security Rule** The technical architecture aligns directly with the standards to ensure the confidentiality, integrity, and availability of protected health information (PHI). As detailed in Table G.6, specific HIPAA Security Rule requirements are mapped to exact implementation mechanisms across the application and infrastructure layers. This includes the enforcement of granular access controls via Role-Based Access Control (RBAC) and Row-Level Security (RLS), strict transmission security utilizing TLS 1.2+ protocols, and comprehensive audit tracking through AWS CloudTrail and dedicated database logging.

**Table G.6** — HIPAA Security Rule Compliance Mapping

| HIPAA Requirement | Reference | Implementation |
| --- | --- | --- |
| Access Control | §164.312(a)(1) | RBAC middleware + PostgreSQL RLS |
| Unique User Identification | §164.312(a)(2)(i) | UUID per user, bcrypt passwords |
| Automatic Logoff | §164.312(a)(2)(iii) | JWT 15-minute access token expiry |
| Encryption / Decryption | §164.312(a)(2)(iv) | KMS CMK at rest, TLS 1.2+ in transit |
| Audit Controls | §164.312(b) | `audit_log` table + AWS CloudTrail |
| Integrity Controls | §164.312(c)(1) | PostgreSQL FK constraints + RLS policies |
| Person or Entity Authentication | §164.312(d) | bcrypt cost 12 + account lockout after 3 failures |
| Transmission Security | §164.312(e)(1) | HTTPS-only ALB, `httpOnly` JWT cookie, TLS RDS connection |

---

## APPENDIX H — SEQUENCE DIAGRAMS

> 📎 **ATTACH:** `Figure H.1` — Sequence Diagram: User Login (UC-04). Participants (left to right): `User (Browser)` | `React Frontend` | `Express API (/api/auth/login)` | `PostgreSQL (users)` | `JWT Service`. Sequence of numbered messages:
> 1. User → React: Enters username + password, clicks Login
> 2. React → Express: `POST /api/auth/login { username, password }`
> 3. Express → PostgreSQL: `SELECT * FROM users WHERE username = $1`
> 4. PostgreSQL → Express: Returns user row (or null)
> 5. Express → JWT Service: `bcrypt.compare(password, hash)`
> 6. JWT Service → Express: true / false
> 7. Express → JWT Service: `jwt.sign({ userId, role }, secret, { expiresIn: '15m' })`
> 8. JWT Service → Express: Returns signed token
> 9. Express → PostgreSQL: `INSERT INTO audit_log (userId, action='LOGIN', ipAddress, timestamp)`
> 10. Express → React: HTTP 200 + `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
> 11. React → User: Redirect to role dashboard
> Add an `alt` fragment box covering steps 4–6: `[alt] if user not found OR bcrypt mismatch → HTTP 401, increment failed_attempts; if failed_attempts = 3 → set is_active = false`.

Login is the first security checkpoint for the whole system. Key decisions made in this architecture include: (1) No comparisons of the password are done in clear text; bcrypt.compare() is performed solely on the hashed value; (2) the JWT token is set as an httpOnly cookie so it cannot be accessed via JavaScript; (3) Both successful and unsuccessful authentication writes to the audit log.

> 📎 **ATTACH:** `Figure H.2` — Sequence Diagram: Create Medical Record (UC-01). Participants: `Doctor (Browser)` | `React Frontend` | `Express API (/api/records)` | `RBACMiddleware` | `PostgreSQL (patients / medical_records / audit_log)`. Sequence:
> 1. Doctor → React: Fills record form (diagnosis, prescription, notes), submits
> 2. React → Express: `POST /api/records { patientId, diagnosis, prescription, notes }` with JWT cookie
> 3. Express → RBACMiddleware: Validate JWT; check role = 'doctor'; extract doctor_id
> 4. RBACMiddleware → Express: Authorised / HTTP 403
> 5. Express → PostgreSQL: `SELECT patient_id FROM patients WHERE patient_id = $1 AND assigned_doctor_id = $2` (ownership check)
> 6. PostgreSQL → Express: Patient row (match) or null (→ HTTP 403)
> 7. Express → PostgreSQL: `INSERT INTO medical_records (patient_id, doctor_id, diagnosis, prescription, notes, created_at) RETURNING record_id` [RLS policy enforced]
> 8. Express → PostgreSQL: `INSERT INTO audit_log (userId=doctorUserId, action='CREATE_RECORD', resource='medical_records', recordId, ipAddress)`
> 9. Express → React: HTTP 201 `{ recordId, createdAt }`
> 10. React → Doctor: "Record saved successfully" confirmation
> Add annotation note on step 7: "PostgreSQL RLS: INSERT permitted only when doctor_id = session variable app.current_user_id".

This figure illustrates the use of the three-layer authorization pattern on the most sensitive write transaction in the application. RBAC Middleware in step 3 prevents all other users except Doctors from accessing the application API. Ownership check at step 5 guarantees that the specific doctor is responsible for the particular patient, which is verified in the application layer. RLS on step 7 denotes enforcement in the database layer.

> 📎 **ATTACH:** `Figure H.3` — Sequence Diagram: Schedule Appointment (UC-02). Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/appointments)` | `RBACMiddleware` | `PostgreSQL (appointments / audit_log)`. Sequence:
> 1. Admin → React: Fills appointment form (patient, doctor, date/time), submits
> 2. React → Express: `POST /api/appointments { patientId, doctorId, scheduledAt, notes }` with JWT cookie
> 3. Express → RBACMiddleware: Validate JWT; check role = 'admin'
> 4. RBACMiddleware → Express: Authorised / HTTP 403
> 5. Express → Express: Validate required fields (patientId, doctorId, scheduledAt)
> 6. Express → PostgreSQL: `SELECT appointment_id FROM appointments WHERE doctor_id=$1 AND scheduled_at=$2 AND status='scheduled'` (conflict check)
> 7. PostgreSQL → Express: null (no conflict) or existing row
> 8. [alt conflict] Express → React: HTTP 409 `{ conflictingAppointmentId, scheduledAt }` → React shows conflict error to Admin
> 9. Express → PostgreSQL: `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status='scheduled', notes, created_by=adminId) RETURNING appointment_id`
> 10. Express → PostgreSQL: `INSERT INTO audit_log (userId=adminId, action='SCHEDULE_APPOINTMENT', resource='appointments', appointmentId, ipAddress)`
> 11. Express → React: HTTP 201 `{ appointmentId, scheduledAt }`
> 12. React → Admin: "Appointment scheduled" confirmation
> Show steps 6–7 and the `alt` box clearly: one branch for conflict (409), one for success (insert).

The scheduling sequence introduces the conflict detection logic. The database will check whether there exists any appointment for that doctor in the same time slot prior to saving, and return an HTTP 409 response upon finding any conflict. Step 9 and Step 10 are executed in a serializable transaction to avoid any race condition between two admins scheduling the same slot.

> 📎 **ATTACH:** `Figure H.4` — Sequence Diagram: Patient Views Own Medical Records (UC-03). Participants: `Patient (Browser)` | `React Frontend` | `Express API (/api/records)` | `RBACMiddleware` | `PostgreSQL (medical_records) [RLS]`. Sequence:
> 1. Patient → React: Navigates to "My Records" section
> 2. React → Express: `GET /api/records` with JWT cookie
> 3. Express → RBACMiddleware: Validate JWT; check role = 'patient'; extract patient_id
> 4. RBACMiddleware → Express: Authorised / HTTP 403
> 5. Express → PostgreSQL: `SELECT * FROM medical_records WHERE patient_id = $1 ORDER BY created_at DESC`
> 6. PostgreSQL (RLS) → Express: Returns only records where patient_id matches session user — cross-patient rows are silently filtered by RLS policy
> 7. Express → React: HTTP 200 `{ records: [ { recordId, diagnosis, createdAt, doctorName }, ... ] }`
> 8. React → Patient: Displays chronological read-only list of own records
> Add annotation note on step 6: "PostgreSQL RLS policy: SELECT permitted only where patient_id = current_setting('app.current_user_id') — even a tampered patientId query parameter cannot return another patient's records".

This is the example of how the read-path security approach works for the Patient role. Step 6 here, where RLS is annotated, is the critical step because even when the hacker attempts to manipulate the API request using the altered patient_id, the RLS feature automatically filters out all the records that do not belong to the authenticated session user in the database layer.
