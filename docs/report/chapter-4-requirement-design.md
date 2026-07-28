
tags: [fyp, psm1, chapter-4, requirement-analysis, design, vpc, database, interface]
phase: 4
status: complete
created: 2026-05-02
updated: 2026-07-28
related: [[FYP/PSM 1 SECRH/docs/PHASES]], [[chapter-3-methodology]], [[docs/design/architecture/README]]


# CHAPTER 4

## REQUIREMENT ANALYSIS AND DESIGN

---

### 4.1 Introduction

This chapter describes the system design that has been developed based on the requirements from Chapter 3. It starts with the use case analysis that defines how users of each role will behave in the system. The next step involves describing the architecture design for the system, which includes such aspects as the network topology within AWS, security control setting, IAM policy design, and DevSecOps pipeline design. Next comes the database schema design that includes PostgreSQL table design and row-level security policies that ensure proper data isolation at the storage level.

The requirement analysis is described by user stories and use cases in Section 4.2. The design of the whole project involving system architecture is provided in Section 4.3. Database design and its schema will be provided in Section 4.4. Interface design for all users is given in Section 4.5. Finally, Section 4.6 provides a summary of the chapter.

---

### 4.2 Requirement Analysis

This section documents the functional requirements of the proposed system as derived from the stakeholder discussions conducted at Alamin Clinic, described in Section 2.2.3. The requirements are presented through three complementary representations: a use case diagram that maps the relationships between each actor and the operations they are authorised to perform, a set of user stories that express requirements from each actor's perspective in Agile format, and detailed use case specifications that define the precise interaction behaviour expected at each system entry point.

#### 4.2.1 Use Case Overview

The system supports three types of users including: Doctor, Admin, and Patient, each with their own set of allowable operations. Figure 4.1 illustrates the use case diagram that includes all actors along with their allowable operations in the system.

> 📎 **ATTACH:** `Figure 4.1` — UML Use Case Diagram: Secure Patient Data Management System. Three actor stick figures on the left: Doctor, Admin, Patient. System boundary box in the centre containing labelled use case ovals. Doctor connects to: Login, View Assigned Patients, Create Medical Record, Update Medical Record, View Medical History, View Appointments. Admin connects to: Login, Register Patient, Schedule Appointment, Update Appointment, Deactivate User Account. Patient connects to: Login, View Own Medical Records, View Own Appointments.

#### 4.2.2 User Stories

User stories capture the system's functional requirements from the perspective of each actor, following the Agile format: *"As a [role], I want to [action], so that [benefit]."* Table B.1 presents all eighteen user stories, organized by module. These stories were derived directly from the stakeholder interviews conducted in Section 2.2.3 and informed the use case design in Section 4.2.3.

Table 4.1 presents a representative sample of the user stories derived from the stakeholder requirements, organized by functional module. Each story follows the Agile format: *"As a [role], I want to [action], so that [benefit]."*

**Table 4.1** — User Stories by Module (Representative Sample)

| ID | Role | User Story | Module |
| --- | --- | --- | --- |
| US-05 | Admin | As an Admin, I want to deactivate user accounts, so that former staff or inactive patients can no longer access the system. | Auth |
| US-06 | Admin | As an Admin, I want to register new patients and assign them a treating doctor, so that their records can be managed securely from the point of registration. | Patient Mgmt |
| US-10 | Doctor | As a Doctor, I want to create medical records for my assigned patients, so that I can document diagnoses and prescriptions in a secure, auditable system. | Medical Records |
| US-11 | Doctor / Patient | As a Doctor, I want to view records of my assigned patients; as a Patient, I want to view my own records in read-only mode to ensure data is accessible. | Medical Records |
| US-14 | Admin | As an Admin, I want to schedule appointments linking a patient to a doctor at a specific date and time, so that consultations are organised. | Appointments |

The complete set of eighteen user stories covering all four modules is provided in Appendix B, Table B.1.

#### 4.2.3 Use Case Descriptions

Table 4.2 lists all eighteen use cases for the proposed system, organised by functional module.

**Table 4.2** — System Use Case Directory

| UC ID | Use Case Name | Actor | Summary Description |
| --- | --- | --- | --- |
| UC-01 | User Login | Doctor, Admin, Patient | Authenticate via credentials; issue JWT via `httpOnly` cookie. |
| UC-02 | User Logout | Doctor, Admin, Patient | Terminate session; clear JWT cookie and write audit log. |
| UC-03 | Account Lockout | System, Admin | Automatic lock after 3 failed logins; emit CloudWatch alert. |
| UC-04 | Admin Creates User | Admin | Create user with role and link corresponding profile row. |
| UC-05 | Admin Deactivates User | Admin | Soft-delete user via active flag; preserve records, block login. |
| UC-06 | Register New Patient | Admin | Register demographics and doctor; generate temp credentials. |
| UC-07 | View Patient Profile | Doctor, Admin | View demographics; Doctors restricted to assigned patients. |
| UC-08 | Update Patient Info | Admin | Update demographic details and record changes to audit log. |
| UC-09 | Assign Doctor to Patient | Admin | Reassign doctor; changes visibility boundary via PostgreSQL RLS. |
| UC-10 | Create Medical Record | Doctor | Doctor writes clinical record for assigned patient; logs action. |
| UC-11 | View Medical Record | Doctor, Patient | Doctor views assigned patients; Patient views own data via RLS. |
| UC-12 | Update Medical Record | Doctor | Doctor modifies record they authored; RLS blocks cross-updates. |
| UC-13 | View Medical History | Doctor | Doctor views chronological clinical history of assigned patient. |
| UC-14 | Schedule Appointment | Admin | Book appointment; run conflict validation checks before confirmation. |
| UC-15 | View Doctor Schedule | Doctor | Doctor views own upcoming schedule; cross-doctor requests rejected. |
| UC-16 | View Own Appointments | Patient | Read-only patient access to own appointments; actions disabled. |
| UC-17 | Update Appointment | Admin | Edit appointment; rerun conflict validation checks on new time slot. |
| UC-18 | Cancel Appointment | Admin | Set appointment status to 'cancelled'; retain row for auditing. |

#### 4.2.4 Sequence Diagrams

Sequence diagrams for the four primary use cases are presented in Appendix H (Figures H.1–H.4). Each diagram traces the complete request path from the user's browser through the React frontend, Express API, and PostgreSQL database. Figure H.1 (UC-04 Login) illustrates the bcrypt verification and JWT issuance flow. Figure H.2 (UC-01 Create Medical Record) shows the three-layer authorisation chain: RBAC middleware, application-layer ownership check, and PostgreSQL RLS. Figure H.3 (UC-02 Schedule Appointment) demonstrates the conflict detection logic. Figure H.4 (UC-03 Patient Views Records) shows the RLS read-path enforcement.

---

### 4.3 Project Design

This section presents the complete design of the proposed Secure Cloud-Based Patient Data Management System. The design is organised across five components: the overall three-tier system architecture deployed within an AWS Virtual Private Cloud, the VPC network topology and subnet configuration, the security controls applied at the network and identity layers, the six-stage DevSecOps CI/CD pipeline, and the user interface wireframes for each of the three user roles. Together, these components constitute the full technical blueprint that will guide implementation of the system.

#### 4.3.1 System Architecture Overview

The designed architecture for the system uses a three-tiered web application running on the AWS Virtual Private Cloud network. The presentation layer, application layer, and data layer of the system have been designed to be present in separate layers of subnets with their respective access policies. There is no direct connection between the presentation layer and the data layer. Figure 4.2 shows the system architecture.

> 📎 **ATTACH:** `Figure 4.2` — AWS Three-Tier System Architecture for the Patient Data Management System (PDMS). Draw the following, from top to bottom: Internet → Internet Gateway → ALB in Public Subnets (AZ-a and AZ-b) → EC2 instances in Private App Subnets (AZ-a and AZ-b) → RDS Primary + Standby in Private DB Subnets (AZ-a and AZ-b). Add NAT Gateway in the public subnet with an arrow showing EC2 outbound traffic. Show the VPC boundary box around everything. Label all CIDR ranges. On the right side, show the CI/CD pipeline (GitHub → GitHub Actions → EC2). Add a security layer annotation showing: Security Groups on EC2 and RDS, NACLs on subnet boundaries, KMS on RDS, CloudTrail logging everything.

#### 4.3.2 VPC Network Design

The system is deployed within a single AWS VPC with the CIDR block `10.0.0.0/16`. The VPC is divided into six subnets across two Availability Zones with three subnet tiers per AZ to achieve high availability and fault isolation. Table 4.3 presents the six subnets provisioned within the VPC, distributed across two Availability Zones to achieve high availability and fault isolation.

**Table 4.3** — VPC Subnet Configuration

| Subnet | CIDR | Availability Zone | Tier | Purpose |
| --- | --- | --- | --- | --- |
| public-subnet-a | 10.0.1.0/24 | ap-southeast-1a | Public | ALB, NAT Gateway |
| public-subnet-b | 10.0.2.0/24 | ap-southeast-1b | Public | ALB (multi-AZ) |
| app-subnet-a | 10.0.3.0/24 | ap-southeast-1a | Private | EC2 application instances |
| app-subnet-b | 10.0.4.0/24 | ap-southeast-1b | Private | EC2 application instances |
| db-subnet-a | 10.0.5.0/24 | ap-southeast-1a | Isolated | RDS primary instance |
| db-subnet-b | 10.0.6.0/24 | ap-southeast-1b | Isolated | RDS standby instance (Multi-AZ) |

**Routing configuration**. The public subnets are bound to the route table which sends the traffic destined for `0.0.0.0/0` through the Internet Gateway, thus allowing internet traffic directed to the ALB and outbound internet traffic from NAT. The application subnets are bound to the route table which sends the traffic destined for `0.0.0.0/0` via the NAT Gateway, thus allowing EC2 instances to establish outbound connections (to AWS API, package repositories, etc.), but not being accessible from the internet itself. Database subnets have no connectivity to the internet at all — their route table consists of only one route which is the local VPC route (`10.0.0.0/16`).

#### 4.3.3 Security Group Configuration

Security Groups act as virtual firewalls at the instance level, enforcing allow-list rules for inbound and outbound traffic. the complete inbound and outbound rule definitions for all three Security Groups are provided in Appendix G, Table G.1.

#### 4.3.4 Network Access Control List (NACL) Configuration

Network ACLs provide a stateless secondary security boundary at the subnet level, complementing Security Groups. Three NACLs are defined, one per subnet tier. The full NACL rule sets for all three subnet tiers are provided in Appendix G, Table G.2.

#### 4.3.5 IAM Policy Design

The three IAM roles and their associated permission boundaries are defined in full in Appendix G, Table G.3. The governing principle across all three roles is least privilege.

#### 4.3.6 DevSecOps Pipeline Design

The CI/CD pipeline is implemented in GitHub Actions and is triggered on every push to the `main` branch. The pipeline executes six stages in sequence. A failure at any stage with a critical finding terminates the pipeline and the deployment does not proceed. Figure 4.3 shows the pipeline flow diagram, furthermore, Table 4.4 details how a failure at any scan stage blocks the pipeline and prevents the deployment from proceeding.

> 📎 **ATTACH:** `Figure 4.3` — CI/CD Pipeline with Shift-Left Security Gates (GitHub Actions). Draw a horizontal left-to-right pipeline with six labelled boxes connected by arrows: (1) Code Checkout → (2) SonarQube SAST Scan → (3) Build → (4) Trivy Image Scan → (5) Checkov IaC Scan → (6) Terraform Apply. Add a red "BLOCK" branch dropping down from boxes 2, 4, and 5 labelled "Critical finding → pipeline fails, no deploy". Add a green "DEPLOY" arrow coming out of box 6.

**Table 4.4** — DevSecOps Pipeline Stages Summary

| Stage | Stage Name | Core Tool | Target Artifact | Failure / Gate Condition |
| --- | --- | --- | --- | --- |
| 1 | Code Checkout | GitHub Actions | Source Code | Dependency resolution or fetch failure |
| 2 | SonarQube SAST | SonarQube Scanner | Application Code | Quality Gate failure (Critical/Blocker) |
| 3 | Build | Docker / npm | Container / Static | Compilation or image assembly failure |
| 4 | Trivy Image Scan | Trivy | Backend Image | Any `CRITICAL` severity CVE finding |
| 5 | Checkov IaC Scan | Checkov | Terraform Files | Any `HIGH` or `CRITICAL` policy violation |
| 6 | Terraform Apply | Terraform CLI | AWS Infrastructure | Cloud provider API or syntax execution error |

#### 4.3.7 Application Layer Class Design

Figure 4.4 presents the class diagram for the Node.js/Express application layer, showing the six data model classes and the two service classes that together form the backend of the system.

The six model classes (`User`, `Patient`, `Doctor`, `MedicalRecord`, `Appointment`, and `AuditLog`) correspond to the database schema provided in Section 4.4. They represent their respective database tables in the application with static methods for table query and manipulation. The two service classes (`AuthController` and `RBACMiddleware`) are implemented at the request handler level. `AuthController` is responsible for managing the processes of logging in, logging out, and validating the JWT token. `RBACMiddleware` handles all incoming requests and ensures the caller meets RBAC requirements before reaching the handler.

> 📎 **ATTACH:** `Figure 4.4` — UML Class Diagram of the Patient Data Management System. Show eight classes in two colour groups. Group 1 — Models (blue): User, Patient, Doctor, MedicalRecord, Appointment, AuditLog. Group 2 — Services (purple): AuthController, RBACMiddleware. Relationships: User 1--0..1 Patient; User 1--0..1 Doctor; Doctor 1--* Patient; Doctor 1--* MedicalRecord; Patient 1--* MedicalRecord; Patient 1--* Appointment; Doctor 1--* Appointment; User 1--* AuditLog; AuthController uses RBACMiddleware.

#### 4.3.8 Security Design

This system utilizes a layered security approach spanning five layers. Authentication uses bcrypt hashing for passwords (with cost of 12) and the generation of JSON Web Tokens as cookies which have the attributes httpOnly, Secure, and SameSite=Strict, with account lockout after three failed attempts. Two independent layers of authorization are used, which include the RBACMiddleware class at the API layer and Row-Level Security in PostgreSQL at the database layer; such that bypassing one layer does not lead to access. API hardening includes rate limiting, input validation with express-validator, parameterized queries to prevent SQL injection attacks, and security headers with Helmet.js. Isolation of network traffic is performed by using Security Groups, Network Access Control Lists (NACLs), and VPC subnet isolation as described in Sections 4.3.3 and 4.3.4. At-rest encryption of all data is performed by AWS KMS (AES-256 with RDS), and transit encryption is performed using TLS 1.2 on the Application Load Balancer. An audit log is created by using the audit_log table at the application level and AWS CloudTrail. The full security control specifications and HIPAA compliance mapping are provided in Appendix G.

---

### 4.4 Database Design

This section presents the relational database schema designed for the proposed system. The design specifies the entity relationships, table structures, column definitions, and row-level security policies that enforce the access control requirements defined in Section 4.2. The schema comprises six tables — `users`, `patients`, `doctors`, `medical_records`, `appointments`, and `audit_log` — each documented with its purpose, inter-table relationships, and the PostgreSQL row-level security policies that restrict data access to authorized users only.

#### 4.4.1 Entity-Relationship Model

The database schema consists of six tables: `users`, `patients`, `doctors`, `medical_records`, `appointments`, and `audit_log`. Figure 4.5 presents the entity-relationship diagram.

> 📎 **ATTACH:** `Figure 4.5` — Entity-Relationship Diagram of the Patient Data Management System Database Schema. Draw the six entities as rectangles with their attributes listed inside. Show the following relationships with cardinality notation: users (1) — (1) patients; users (1) — (1) doctors; doctors (1) — (many) patients [assigned_doctor_id FK]; doctors (1) — (many) medical_records; patients (1) — (many) medical_records; patients (1) — (many) appointments; doctors (1) — (many) appointments. Underline primary keys. Mark foreign keys with FK.

#### 4.4.2 Database Schema

The database for the system consists of six tables namely users, patients, doctors, medical_records, appointments, and audit_log. In all the tables, all the primary keys make use of the UUID datatype to avoid enumeration attacks. Referential integrity in all the foreign key relationships is enforced by making sure that there can be no patient data without an existing user account and there is no entry in medical records for a nonexistent patient. All the timestamp fields have NOW() as their default value at the database level to prevent tampering of timestamps on the client side. The complete column-level schema for all six tables is provided in Appendix E.

#### 4.4.3 Row-Level Security Policy

Row-level security on the PostgreSQL database is enabled for the `medicalRecords` table and `patients` table in order to provide data isolation within the database system, independent of application layer permissions. The following three policies are listed:

**Policy 1 Doctor access to medical records**: A doctor may only select, insert, or update records where `doctorId` matches the current database session user. Records assigned to other doctors are invisible and inaccessible.

**Policy 2 Patient access to own records**: A patient may only select rows from `medicalRecords` and `patients` where `patientid` matches their own user identifier. No patient can query another patient's records regardless of application behaviour.

**Policy 3 Admin exclusion from medical content**: Admin database sessions are granted access to the `patients` and `appointments` tables only. Row-level security on `medicalRecords` denies all access to sessions authenticated with the admin role, ensuring that administrative staff cannot view clinical record content even with direct database access.

This gives another level of protection; in case there is any vulnerability in the Node.js/Express application layer, the database will refuse to accept any queries that exceed their roles.

---

### 4.5 Interface Design

There are three unique interface views for the three types of users. These interface views have been made in such a way that there is role segregation, where all functionalities that a user needs to perform and can access are visible to him only.

#### 4.5.1 Login Screen

All users access the system through a single login screen. The screen presents a username field, a password field, and a login button. On successful authentication, the system reads the role from the JWT token and redirects the user to the appropriate dashboard — Doctor Dashboard, Admin Dashboard, or Patient Portal. The wireframe layout for the login screen is shown in Figure 4.6.

> 📎 **ATTACH:** `Figure 4.6` — Login Screen Wireframe. Simple centred card layout: clinic logo at top, "Username" text field, "Password" text field (masked), "Login" button.

#### 4.5.2 Doctor Dashboard

The Doctor Dashboard presents the doctor with their assigned patient list and appointment schedule as the primary views. A navigation sidebar provides access to Patient Records and the appointment calendar. The patient list displays each patient's name, date of last visit, and a "View Records" action button. Selecting a patient opens the patient detail view, showing the full medical record history and a "New Record" button. The new record form presents fields for Diagnosis, Prescription, and Clinical Notes with a Submit button. Figure 4.7 presents the wireframe layout for the Doctor Dashboard.

> 📎 **ATTACH:** `Figure 4.7` — Doctor Dashboard Wireframe. Left sidebar with: Dashboard, My Patients, Appointments, Logout. Main content: patient list (Patient Name, Date of Birth, Last Visit, "View Records" button) and appointment schedule.

#### 4.5.3 Admin Dashboard

The Admin Dashboard centres on appointment management and patient registration. The navigation sidebar provides access to Patient Registration, Appointment Scheduling, and User Management. The appointment scheduling screen presents a calendar view with time slot selection. Admin selects a patient, selects a doctor, picks a date and time, and confirms the booking. The patient registration screen presents a form for new patient demographic details and doctor assignment. Figure 4.8 presents the wireframe layout for the Admin Dashboard.

> 📎 **ATTACH:** `Figure 4.8` — Admin Dashboard Wireframe. Left sidebar with: Dashboard, Register Patient, Appointments, User Management, Logout. Main content: appointment calendar with time slot selection, patient registration form.

#### 4.5.4 Patient Portal

Patient portal is a read-only portal. A patient can access his or her own medical records and appointments. There are no options to create, modify, or delete information within the patient's area. In the records view, user can will a list of records in chronological order that show date, physician, and patient's diagnosis. When a record is clicked on, it gives you full information including any prescribed medication or additional notes from the doctor. In the appointments view, future appointments are listed by date and time. Figure 4.9 presents the wireframe layout for the Patient Portal.

> 📎 **ATTACH:** `Figure 4.9` — Patient Dashboard Wireframe. Left sidebar with: My Records, My Appointments, Logout. Main content: chronological list of records (Date | Doctor | Diagnosis, expandable), upcoming appointments list — all read-only, no edit controls.

---

### 4.6 Chapter Summary

The chapter elaborates on the thorough requirement analysis and design of the Secure Cloud-Based Patient Data Management System, addressing the limitations outlined in the case study discussed in Chapter 2 and requirements described in Chapter 3. The architecture describes a very robust and resilient design, including the implementation of a three-tier architecture with six subnets on AWS VPC across two availability zones, along with layers of security groups, NACLs, and more precise IAM policies. In addition, a DevSecOps pipeline with automatic quality gates is introduced in order to ensure the left-shifted security approach to immediately block any deployment if it is found to be vulnerable. On the data layer, the PostgreSQL database employs a six-table schema with primary keys, foreign keys, an audit tracking table for HIPAA compliance, and separate RLS policy to ensure that role-based access control applies directly on the storage layer. Finally, the UI design defines the four different designs for the Login portal, Doctor Dashboard, Admin Dashboard, and Patient Portal, thus defining the architectural blueprint to support the implementation discussed in Chapter 5.

---

### 4.7 PSM2 Implementation Updates

Sections 4.1–4.6 above are the design as submitted in the PSM1 report. This section documents where PSM2 implementation (Sprint 3 and Sprint 3c) diverged from or extended that design. Every item below traces to a specific entry in `docs/psm2/report-delta.md`; database-schema claims were additionally verified directly against `src/backend/src/config/schema.sql` and `src/backend/scripts/apply-feature-additions.js` rather than taken on the delta log's word alone (see Appendix E, "Schema Extensions", for the two discrepancies this surfaced).

#### 4.7.1 Role Model Update

A fourth role, **Superadmin**, was added to the three-role design in Section 4.3.5 (DELTA-001): the original Admin role — reception/registration staff — was found to be able to create and deactivate Doctor and Admin accounts, which is a privilege-escalation risk rather than a reception-desk function. Superadmin now exclusively manages system accounts, doctor working hours, and the clinic service/price catalogue. The `admin` database role value is unchanged, but its UI display label was renamed to **"Staff"** / **"موظف"** (DELTA-002) to better reflect the role. Table G.3a in Appendix G restates the role-permission matrix with both changes. The rule that Staff cannot manage accounts is enforced at the API route layer, not only hidden from the Staff navigation menu (DELTA-004).

#### 4.7.2 Database Schema Extensions

The six-table schema in Section 4.4 grew substantially during implementation: patient safety fields, a national-ID/file-number identity layer, SOAP-structured clinical notes, a walk-in visit and billing engine, doctor scheduling, and supporting tables for OTP verification, password setup, sick leave, and notifications. The full column-level detail is provided in Appendix E, "Schema Extensions (PSM2 Sprint 3 / 3c)", including two items worth flagging here: the "Room & Equipment Allocation" feature originally planned under this workstream was built and then removed on 2026-07-24 after being confirmed unused end-to-end (never wired into any screen), and the "clinical templates" feature ships as a hardcoded in-memory content library rather than the editable database table originally described — both corrections to what `report-delta.md` states, made after checking the actual code rather than repeating its self-reported status.

#### 4.7.3 API Design

The PSM1 design did not specify a concrete REST endpoint list (Section 4.3 describes the pipeline and network design, not the application route surface). The table below is a representative, not exhaustive, summary of the endpoint groups added during PSM2, verified against `src/backend/src/routes/index.js`.

**Table 4.5** — PSM2 API Endpoint Additions (Representative)

| Endpoint(s) | Roles | Purpose | Source |
| --- | --- | --- | --- |
| `POST /auth/register/request-otp`, `POST /auth/register/verify-otp` | Public | Patient self-registration (UC-19) | DELTA-010 |
| `POST /auth/setup-password`, `GET /auth/setup-password` | Public (valid token only) | QR/link-based first-password setup | DELTA-017 |
| `POST /auth/forgot-password/request-otp`, `POST /auth/forgot-password/verify-otp` | Public, rate-limited | Patient self-service password reset | DELTA-047 |
| `GET /doctors` | Superadmin, Admin, Doctor | Active-doctor directory (name-based picker) | DELTA-012 |
| `GET/POST/DELETE /doctors/:doctorId/availability` | Superadmin, or the doctor themselves | Weekly working-hours management | DELTA-009, DELTA-019 |
| `GET /patients?q=` | Admin, Superadmin | Debounced patient search (national ID / name / phone / file number) | DELTA-005, DELTA-013, DELTA-024 |
| `GET /patients/:patientId/billing`, `GET /billing/mine` | Doctor (own-treated), Admin, Patient (own, non-draft) | Billing history | DELTA-028, DELTA-033 |
| `GET /invoices/mine`, `GET /lab-results/mine` | Patient | Patient self-view of billing documents and released lab results | DELTA-020 |
| `PATCH /lab-results/:resultId/release` | Doctor (assigned/care-team only) | Release a lab result to the patient | DELTA-020 |
| `GET/POST/DELETE /services` | Superadmin full CRUD; Admin, Doctor read-only | Clinic service/price catalogue | DELTA-025 |
| `POST /visits`, `GET /visits/today`, `PATCH /visits/:visitId/status`, `PATCH /visits/:visitId/cancel` | Admin (check-in/cancel), Doctor (status transitions, server-enforced) | Walk-in visit queue | DELTA-026 |
| `GET /visits/queue-status`, `GET /visits/:visitId/tracker` | Public, unauthenticated | Non-PII queue position for the lobby kiosk / SMS link tracker | DELTA-039 |
| `POST/PATCH /visits/:visitId/invoice` (billing routes) | Doctor (add/remove items, mark done), Admin (discount, pay) | Consultation-time billing | DELTA-027 |
| `GET /billing/history` | Admin, Superadmin | Date/status-filtered billing report | DELTA-033 |
| `GET /billing/analytics`, `GET /billing/z-report` | Superadmin | Revenue analytics and end-of-day cashier reconciliation | DELTA-038 (path corrected in DELTA-038 CORRECTION) |
| `POST /appointments/:appointmentId/reminder-sms` | Admin, Superadmin | SMS appointment reminder (fire-and-forget) | DELTA-034 (path corrected in DELTA-034 CORRECTION) |
| `POST /sick-leaves`, `GET /sick-leaves/patient/:patientId` | Doctor (create), Doctor + Admin (view) | MOH Seha sick-leave certificates | DELTA-041 |
| `GET /clinical-templates` | Doctor, Admin | Static SOAP template library (read-only; not superadmin-editable, see §4.7.2) | DELTA-039 |
| `GET /notifications`, `PATCH /notifications/read-all` | Own authenticated user | Notification drawer | DELTA-046 |
| `GET /users/system-health` | Superadmin | 60-second TTL-cached operational KPI snapshot | DELTA-032 |

#### 4.7.4 UI Design — New Screens

Beyond the four screens presented in Section 4.5, PSM2 implementation added a substantially larger set of user-facing screens:

- **Public site** — a landing page at `/`, later split into four routes (`/`, `/services`, `/facilities`, `/patient-info`) with a mega-menu navigation, plus `/specialties/:slug` detail pages, `/setup-password`, `/forgot-password`, a public `/queue-tracker`, and a lobby `PatientKioskPage` (DELTA-003, DELTA-014 through DELTA-016, DELTA-021, DELTA-030, DELTA-017, DELTA-047, DELTA-039, DELTA-038).
- **Patient-facing** — self-registration and self-booking flows (DELTA-010); a tabbed Medical Records / Invoices / Lab Results view and a dedicated `/invoices` page (DELTA-020, DELTA-028); PDF export of records and prescriptions (DELTA-036).
- **Staff (Admin)** — a live patient search replacing UUID lookups (DELTA-013); a walk-in check-in and queue screen (`TodaysVisitsPage`) with a Kanban board alternative view (DELTA-026, DELTA-037); a billing review/payment screen (`BillVisitPage`) and printable bilingual invoice (`InvoicePage`) (DELTA-027); a billing history report (DELTA-033); a service catalogue screen (DELTA-025).
- **Doctor** — a working-hours self-service entry point is defined at the API layer but has no frontend screen yet (Superadmin-only UI exists; see Appendix E note); a 4-tab consultation workspace — SOAP documentation, Wasfaty e-prescription and MOH Seha sick leave, dental/body charting, and services & billing — replacing the single-scroll design (DELTA-040, corrected by DELTA-040 CORRECTION); a lab results viewer with reference-range badges (DELTA-042).
- **Superadmin** — a system-health KPI dashboard and a financial analytics page at `/financial-analytics` (path corrected in DELTA-038 CORRECTION).
- **Cross-cutting** — a keyboard-first command palette (DELTA-037); a doctor/patient picker pattern reused across every "select a person" form in the system, replacing raw UUID text fields entirely (DELTA-012, DELTA-013, DELTA-018); a shared `DashboardHeroBanner`/`DashboardStatCard` treatment and a site-wide colour rebrand from a generic teal to the clinic's actual gold/charcoal branding (DELTA-022, DELTA-023).

#### 4.7.5 Design Decisions Log

A selection of implementation-level design decisions, each made in response to a specific constraint surfaced during Sprint 3c:

- **No password ever shown to staff.** Patient registration issues a single-use, 72-hour QR/link token rather than a temporary password relayed verbally by staff — removing an error-prone, insecure handoff step that PSM1 design had not anticipated (DELTA-017).
- **RLS empty-string session-variable guard.** Every Row-Level Security policy that casts a session variable to `::uuid` must first wrap it in `NULLIF(..., '')`, because Admin/Superadmin sessions leave the doctor/patient session GUC as an empty string rather than NULL, and PostgreSQL evaluates `''::uuid` as an error regardless of the surrounding role check. This was independently rediscovered twice during implementation (once for `medical_records`/`patients`, again for the billing/visit tables), which is why it is now a documented rule in `docs/psm2/rls-policy-guidelines.md` rather than left as tribal knowledge (DELTA-029; see also Appendix G, `NULLIF` usage throughout the RLS policies).
- **RESTRICTIVE policies require an opposite-role read test.** A `lab_results` policy written as `FOR ALL` (rather than separate `INSERT`/`UPDATE` policies) silently blocked every patient `SELECT` even though a separate permissive policy was meant to allow it, because RESTRICTIVE policies are AND-combined across all commands. The write succeeded in testing; only a patient-side read test caught the bug (DELTA-020).
- **Client-side safety checks are not network-dependent.** The drug-allergy interaction checker and the lab-result reference-range status badges are evaluated entirely client-side against data already loaded in the session, rather than via a round-trip API call — a safety-relevant warning should not be delayed by network latency (DELTA-038, DELTA-042).
- **Same-browser real-time over new infrastructure.** Cross-tab synchronisation between the doctor's consultation view and the staff queue view uses the browser's `BroadcastChannel` API rather than introducing WebSocket infrastructure, since the clinic's actual operating context (a single front-desk machine, multiple tabs) does not require cross-device real-time. True cross-device sync is listed as future work (DELTA-040).
- **Payment attribution as a fraud-prevention control.** Every collected payment records the authenticated staff member's `user_id` (`visit_invoices.paid_by`, later normalised into the append-only `invoice_payments` ledger), independent of the application-level audit log — an accountability layer specific to financial transactions (DELTA-031, DELTA-033).
- **Physician identity is always session-derived, never form input.** The MOH Seha sick-leave certificate binds the issuing doctor's name, specialty, and licence number from the authenticated session (`req.rlsSession.doctorId` → database lookup), never from an editable form field, closing an obvious regulatory-fraud vector (DELTA-041).
- **Graceful degradation over broken controls.** The voice-dictation button (Web Speech API) is hidden rather than shown-disabled on unsupported browsers, and a vitals section with no recorded data renders "Not recorded" rather than crashing — a UI element that fails visibly is worse than one that is simply absent (DELTA-036, DELTA-038).

---

### References

Amazon Web Services. (2023). *AWS Well-Architected Framework — Security Pillar*. Amazon Web Services.

PostgreSQL Global Development Group. (2024). *Row security policies*. PostgreSQL Documentation. https://www.postgresql.org/docs/current/ddl-rowsecurity.html
