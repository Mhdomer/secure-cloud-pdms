
tags: [fyp, psm1, chapter-4, requirement-analysis, design, vpc, database, interface]
phase: 4
status: complete
created: 2026-05-02
related: [[FYP/PSM 1 SECRH/docs/PHASES]], [[chapter-3-methodology]], [[docs/design/architecture/README]]


# CHAPTER 4

## REQUIREMENT ANALYSIS AND DESIGN

---

### 4.1 Introduction

This chapter translates the requirements established in Chapter 3 into a complete system design. It presents the detailed use case analysis that governs the behaviour of each user role, followed by the full architectural design of the proposed system — covering the AWS network topology, security control configuration, IAM policy structure, and DevSecOps pipeline design. The database schema is then defined, including the PostgreSQL table structures and row-level security policies that enforce data isolation at the storage layer. The chapter concludes with the interface design, presenting the wireframe layouts for each user role's primary interaction screens.

Section 4.2 presents the detailed requirement analysis through user stories and use case descriptions. Section 4.3 presents the complete project design covering the system architecture. Section 4.4 defines the database design including the entity-relationship model and schema. Section 4.5 presents the interface design for the three user roles. Section 4.6 summarises the chapter.

---

### 4.2 Requirement Analysis

This section documents the functional requirements of the proposed system as derived from the stakeholder discussions conducted at Alamin Clinic, described in Section 2.2.3. The requirements are presented through three complementary representations: a use case diagram that maps the relationships between each actor and the operations they are authorised to perform, a set of user stories that express requirements from each actor's perspective in Agile format, and detailed use case specifications that define the precise interaction behaviour expected at each system entry point.

#### 4.2.1 Use Case Overview

The system serves three user roles — Doctor, Admin, and Patient — each with a distinct set of permitted operations. Figure 4.1 presents the use case diagram showing all actors and their authorised interactions with the system.

> 📎 **ATTACH:** `Figure 4.1` — Use case diagram. Three actor stick figures on the left: Doctor, Admin, Patient. System boundary box in the centre containing labelled use case ovals. Doctor connects to: Login, View Assigned Patients, Create Medical Record, Update Medical Record, View Medical History, View Appointments. Admin connects to: Login, Register Patient, Schedule Appointment, Update Appointment, Deactivate User Account. Patient connects to: Login, View Own Medical Records, View Own Appointments. Draw clean connecting lines — no overlapping use cases between roles except Login, which all three share.

#### 4.2.2 User Stories

User stories capture the system's functional requirements from the perspective of each actor, following the Agile format: *"As a [role], I want to [action], so that [benefit]."* Table 4.1 presents all eighteen user stories, organised by module. These stories were derived directly from the stakeholder interviews conducted in Section 2.2.3 and informed the use case design in Section 4.2.3.

**Table 4.1** — User Stories by Module (Representative Sample)

A representative sample of five user stories is presented below, one per functional module. The complete set of eighteen user stories is provided in Appendix B, Table B.1.

| ID    | Role                     | User Story                                                                                                                                       | Module          |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| US-01 | Doctor / Admin / Patient | As a user, I want to log in with my username and password, so that I can securely access my role-specific dashboard.                             | Auth            |
| US-06 | Admin                    | As an Admin, I want to register new patients and assign them a treating doctor, so that their records can be managed securely from registration. | Patient Mgmt    |
| US-10 | Doctor                   | As a Doctor, I want to create medical records for my assigned patients, so that I can document diagnoses and prescriptions in a secure system.   | Medical Records |
| US-14 | Admin                    | As an Admin, I want to schedule appointments linking a patient to a doctor at a specific date and time, so that consultations are conflict-free. | Appointments    |
| US-16 | Patient                  | As a Patient, I want to view my upcoming appointments in read-only mode, so that I am informed of my scheduled consultations.                    | Appointments    |

---

#### 4.2.3 Use Case Descriptions

Table 4.2 lists all eighteen use cases for the proposed system, organised by functional module. Full specifications — including preconditions, main flow, alternative flow, and postcondition — are provided in Appendix B.

**Table 4.2** — Use Case Summary

| UC ID | Use Case Name                  | Actor                  | Description                                                                                                                                     |
| ----- | ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-01 | User Login                     | Doctor, Admin, Patient | User authenticates with username and password; system issues a JWT token in an httpOnly cookie and redirects to the role-appropriate dashboard. |
| UC-02 | User Logout                    | Doctor, Admin, Patient | User terminates their session; system clears the JWT cookie and writes an audit log entry.                                                      |
| UC-03 | Account Lockout                | System / Admin         | After three consecutive failed login attempts the account is locked and the admin is notified via CloudWatch.                                   |
| UC-04 | Admin Creates User Account     | Admin                  | Admin creates a new user account with an assigned role (Doctor, Admin, or Patient); system creates the corresponding profile record.            |
| UC-05 | Admin Deactivates User Account | Admin                  | Admin sets a user account to inactive; the record is retained but all login attempts are rejected.                                              |
| UC-06 | Register New Patient           | Admin                  | Admin registers a new patient with demographic details and an assigned doctor; system generates temporary login credentials.                    |
| UC-07 | View Patient Profile           | Doctor, Admin          | Authenticated user views a patient's demographic profile; Doctors are restricted to their assigned patients only.                               |
| UC-08 | Update Patient Information     | Admin                  | Admin updates a patient's demographic details; all changes are recorded in the audit log.                                                       |
| UC-09 | Assign Doctor to Patient       | Admin                  | Admin assigns or reassigns a treating doctor to a patient; PostgreSQL RLS enforces the new boundary immediately.                                |
| UC-10 | Create Medical Record          | Doctor                 | Doctor creates a clinical record for an assigned patient; system enforces assignment ownership and writes an audit log entry.                   |
| UC-11 | View Medical Record            | Doctor, Patient        | Doctor views records for their assigned patients; Patient views only their own records — enforced by PostgreSQL RLS at the database layer.      |
| UC-12 | Update Medical Record          | Doctor                 | Doctor updates a record they created; PostgreSQL RLS prevents updating records belonging to other doctors.                                      |
| UC-13 | View Patient Medical History   | Doctor                 | Doctor views the chronological list of all records they have created for an assigned patient.                                                   |
| UC-14 | Schedule Appointment           | Admin                  | Admin schedules an appointment linking a patient to a doctor; system checks for scheduling conflicts before confirming.                         |
| UC-15 | View Appointment Schedule      | Doctor                 | Doctor views their own upcoming appointment schedule; querying another doctor's schedule is rejected server-side.                               |
| UC-16 | View Own Appointments          | Patient                | Patient views their own upcoming appointments in read-only mode; no create, edit, or cancel controls are available.                             |
| UC-17 | Update Appointment             | Admin                  | Admin updates the details of a scheduled appointment; conflict check is re-run against the new slot before confirming.                          |
| UC-18 | Cancel Appointment             | Admin                  | Admin cancels a scheduled appointment; the record is retained with `status = 'cancelled'` for audit purposes.                                   |

---
#### 4.2.4 Sequence Diagrams

Sequence diagrams illustrate the dynamic interaction between system components for the four core use cases described in Section 4.2.3. Each diagram traces the full request path from the user's browser through the React frontend, the Express API, and the PostgreSQL database, showing the exact API endpoint, JWT validation step, and audit log write at each operation. Together these four diagrams demonstrate how authentication, authorisation, and audit controls are exercised on every sensitive transaction.

---

**Figure 4.10 — Sequence Diagram: User Login (UC-04)**

> 📎 **ATTACH:** `Figure 4.10` — Sequence Diagram: User Login. Participants (left to right): `User (Browser)` | `React Frontend` | `Express API (/api/auth/login)` | `PostgreSQL (users)` | `JWT Service`. Draw vertical lifelines for each. Sequence of numbered messages:
> 1. User → React: Enters username + password, clicks Login
> 2. React → Express: `POST /api/auth/login { username, password }`
> 3. Express → PostgreSQL: `SELECT * FROM users WHERE username = $1`
> 4. PostgreSQL → Express: Returns user row (or null)
> 5. Express → JWT Service: `bcrypt.compare(password, hash)`
> 6. JWT Service → Express: true / false
> 7. Express → JWT Service: `jwt.sign({ userId, role }, secret, { expiresIn: '8h' })`
> 8. JWT Service → Express: Returns signed token
> 9. Express → PostgreSQL: `INSERT INTO audit_log (userId, action='LOGIN', ipAddress, timestamp)`
> 10. Express → React: HTTP 200 + `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict`
> 11. React → User: Redirect to role dashboard
> Add an `alt` fragment box covering steps 4–6: `[alt] if user not found OR bcrypt mismatch → HTTP 401, increment failed_attempts; if failed_attempts = 3 → set is_active = false`.

The login sequence is the security entry point for the entire system. The critical design decisions visible in this diagram are: (1) the password is never compared in plaintext — bcrypt.compare() operates on the hash only; (2) the JWT is delivered as an httpOnly cookie so JavaScript cannot read it; (3) both success and failure paths write to the audit log, creating a complete authentication history.

---

**Figure 4.11 — Sequence Diagram: Create Medical Record (UC-01)**

> 📎 **ATTACH:** `Figure 4.11` — Sequence Diagram: Create Medical Record. Participants: `Doctor (Browser)` | `React Frontend` | `Express API (/api/records)` | `RBACMiddleware` | `PostgreSQL (patients / medical_records / audit_log)`. Sequence:
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

This diagram shows the three-layer authorisation model applied to the most sensitive write operation in the system. The RBAC middleware (step 3) blocks non-Doctors at the API layer. The ownership check (step 5) ensures the doctor is assigned to this patient at the application layer. The RLS annotation on step 7 shows the database-layer enforcement — the record cannot be written even if both previous checks were bypassed.

---

**Figure 4.12 — Sequence Diagram: Schedule Appointment (UC-02)**

> 📎 **ATTACH:** `Figure 4.12` — Sequence Diagram: Schedule Appointment. Participants: `Admin (Browser)` | `React Frontend` | `Express API (/api/appointments)` | `RBACMiddleware` | `PostgreSQL (appointments / audit_log)`. Sequence:
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

The scheduling sequence introduces the conflict detection logic. The system queries for any existing appointment with the same doctor at the same time slot before writing, returning HTTP 409 if a conflict is found. Steps 9 and 10 execute within a single serialisable transaction to prevent a race condition where two admins schedule the same slot simultaneously.

---

**Figure 4.13 — Sequence Diagram: Patient Views Own Medical Records (UC-03)**

> 📎 **ATTACH:** `Figure 4.13` — Sequence Diagram: Patient Views Own Medical Records. Participants: `Patient (Browser)` | `React Frontend` | `Express API (/api/records)` | `RBACMiddleware` | `PostgreSQL (medical_records) [RLS]`. Sequence:
> 1. Patient → React: Navigates to "My Records" section
> 2. React → Express: `GET /api/records` with JWT cookie
> 3. Express → RBACMiddleware: Validate JWT; check role = 'patient'; extract patient_id
> 4. RBACMiddleware → Express: Authorised / HTTP 403
> 5. Express → PostgreSQL: `SELECT * FROM medical_records WHERE patient_id = $1 ORDER BY created_at DESC`
> 6. PostgreSQL (RLS) → Express: Returns only records where patient_id matches session user — cross-patient rows are silently filtered by RLS policy
> 7. Express → React: HTTP 200 `{ records: [ { recordId, diagnosis, createdAt, doctorName }, ... ] }`
> 8. React → Patient: Displays chronological read-only list of own records
> Add annotation note on step 6: "PostgreSQL RLS policy: SELECT permitted only where patient_id = current_setting('app.current_user_id') — even a tampered patientId query parameter cannot return another patient's records".

This sequence demonstrates the read-path security model for the Patient role. The RLS annotation on step 6 is the key point: even if an attacker modifies the API request to include a different patient_id, the PostgreSQL RLS policy silently filters any row that does not belong to the authenticated session user. No application-level filtering is relied upon as the sole safeguard.

---

### 4.3 Project Design

This section presents the complete design of the proposed Secure Cloud-Based Patient Data Management System. The design is organised across five components: the overall three-tier system architecture deployed within an AWS Virtual Private Cloud, the VPC network topology and subnet configuration, the security controls applied at the network and identity layers, the six-stage DevSecOps CI/CD pipeline, and the user interface wireframes for each of the three user roles. Together, these components constitute the full technical blueprint that will guide implementation in PSM2.

#### 4.3.1 System Architecture Overview

The proposed system is deployed as a three-tier web application within an AWS Virtual Private Cloud. The three tiers — presentation, application, and data — are hosted in physically separated subnet layers with distinct access policies. No direct communication path exists between the presentation tier and the database tier; all data access is mediated through the application tier.

Figure 4.2 presents the complete system architecture diagram.

> 📎 **ATTACH:** `Figure 4.2` — Full system architecture diagram. This is the most important diagram in the entire report. Draw the following, from top to bottom: Internet → Internet Gateway → ALB in Public Subnets (AZ-a and AZ-b) → EC2 instances in Private App Subnets (AZ-a and AZ-b) → RDS Primary + Standby in Private DB Subnets (AZ-a and AZ-b). Add NAT Gateway in the public subnet with an arrow showing EC2 outbound traffic. Show the VPC boundary box around everything. Label all CIDR ranges. On the right side, show the CI/CD pipeline (GitHub → GitHub Actions → ECR → EC2). Add a security layer annotation showing: Security Groups on EC2 and RDS, NACLs on subnet boundaries, KMS on RDS, CloudTrail logging everything. Use colour to distinguish the three tiers.

#### 4.3.2 VPC Network Design

The system is deployed within a single AWS VPC with the CIDR block `10.0.0.0/16`. The VPC is divided into six subnets across two Availability Zones — three subnet tiers per AZ — to achieve high availability and fault isolation.

**Table 4.1** — VPC Subnet Configuration

| Subnet          | CIDR        | Availability Zone | Tier     | Purpose                         |
| --------------- | ----------- | ----------------- | -------- | ------------------------------- |
| public-subnet-a | 10.0.1.0/24 | ap-southeast-1a   | Public   | ALB, NAT Gateway                |
| public-subnet-b | 10.0.2.0/24 | ap-southeast-1b   | Public   | ALB (multi-AZ)                  |
| app-subnet-a    | 10.0.3.0/24 | ap-southeast-1a   | Private  | EC2 application instances       |
| app-subnet-b    | 10.0.4.0/24 | ap-southeast-1b   | Private  | EC2 application instances       |
| db-subnet-a     | 10.0.5.0/24 | ap-southeast-1a   | Isolated | RDS primary instance            |
| db-subnet-b     | 10.0.6.0/24 | ap-southeast-1b   | Isolated | RDS standby instance (Multi-AZ) |

**Routing configuration.** Public subnets are associated with a route table that directs `0.0.0.0/0` traffic to the Internet Gateway, enabling inbound internet access to the ALB and outbound internet access for NAT. Private application subnets are associated with a route table that directs `0.0.0.0/0` to the NAT Gateway, enabling EC2 instances to make outbound calls (e.g., to the AWS API, package repositories) without being directly reachable from the internet. Database subnets have no route to the internet — their route table contains only the local VPC route (`10.0.0.0/16`), making them completely isolated from all external traffic.

#### 4.3.3 Security Group Configuration

Security Groups act as virtual firewalls at the instance level, enforcing allow-list rules for inbound and outbound traffic. Three Security Groups are defined.

**Table 4.2** — Security Group Rules

| Security Group | Direction | Protocol | Port | Source / Destination | Purpose                  |
| -------------- | --------- | -------- | ---- | -------------------- | ------------------------ |
| alb-sg         | Inbound   | TCP      | 443  | 0.0.0.0/0            | HTTPS from internet      |
| alb-sg         | Inbound   | TCP      | 80   | 0.0.0.0/0            | HTTP (redirected to 443) |
| alb-sg         | Outbound  | TCP      | 5000 | ec2-sg               | Forward to application   |
| ec2-sg         | Inbound   | TCP      | 5000 | alb-sg               | Accept only from ALB     |
| ec2-sg         | Outbound  | TCP      | 5432 | rds-sg               | Connect to database      |
| ec2-sg         | Outbound  | TCP      | 443  | 0.0.0.0/0            | AWS API / NAT outbound   |
| rds-sg         | Inbound   | TCP      | 5432 | ec2-sg               | Accept only from EC2     |
| rds-sg         | Outbound  | —        | —    | None                 | No outbound permitted    |

The critical security property enforced by this configuration is that the RDS instance accepts connections exclusively from the EC2 Security Group. There is no rule that permits any other source — including direct developer access, the ALB, or any internet address — to reach the database port.

#### 4.3.4 Network Access Control List (NACL) Configuration

Network ACLs provide a stateless secondary security boundary at the subnet level, complementing Security Groups. Three NACLs are defined, one per subnet tier.

**Table 4.3** — NACL Rules Summary

| NACL        | Applies To     | Key Inbound Rules                                                                                                                      | Key Outbound Rules                                                                     |
| ----------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| public-nacl | Public subnets | Allow TCP 443 from 0.0.0.0/0; Allow TCP 80 from 0.0.0.0/0; Allow ephemeral ports (1024–65535) from 0.0.0.0/0                           | Allow all to 0.0.0.0/0                                                                 |
| app-nacl    | App subnets    | Allow TCP 5000 from 10.0.1.0/24 and 10.0.2.0/24 (public subnets); Allow ephemeral ports from 10.0.5.0/24 and 10.0.6.0/24 (DB response) | Allow TCP 5432 to 10.0.5.0/24 and 10.0.6.0/24; Allow ephemeral ports to public subnets |
| db-nacl     | DB subnets     | Allow TCP 5432 from 10.0.3.0/24 and 10.0.4.0/24 (app subnets) only; Deny all other inbound                                             | Allow ephemeral ports to 10.0.3.0/24 and 10.0.4.0/24 only                              |

The database NACL provides defence in depth: even if a Security Group rule were misconfigured or accidentally modified, the NACL would independently block any traffic to port 5432 that did not originate from the application subnets.

#### 4.3.5 IAM Policy Design

Three IAM roles are defined, mapping to the three operational user roles of the system. Each role is granted the minimum permissions required to perform its function, implementing the principle of least privilege.

**Table 4.4** — IAM Role Definitions

| Role    | AWS Permissions         | Application Permissions                                                                          | Scope Restriction                                       |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Doctor  | CloudWatch:PutLogEvents | Read/write own assigned patient records; read appointment schedule                               | Records filtered by `assigned_doctor_id = current_user` |
| Admin   | CloudWatch:PutLogEvents | Create/update patient registrations; create/update/cancel appointments; deactivate user accounts | No access to medical record content                     |
| Patient | CloudWatch:PutLogEvents | Read own medical records (read-only); read own appointments (read-only)                          | Records filtered by `patient_id = current_user`         |

In addition to user-facing roles, the EC2 instances are assigned an instance profile with a dedicated IAM role that grants: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (to write application logs to CloudWatch), and `ssm:GetParameter` (to retrieve database credentials from AWS Systems Manager Parameter Store). The EC2 role explicitly has no permissions to access RDS directly through IAM — database access is controlled at the network layer through Security Groups and at the application layer through the connection string.

#### 4.3.6 DevSecOps Pipeline Design

The CI/CD pipeline is implemented in GitHub Actions and is triggered on every push to the `main` branch. The pipeline executes six stages in sequence. A failure at any stage with a critical finding terminates the pipeline and the deployment does not proceed.

Figure 4.3 shows the pipeline flow diagram.

> 📎 **ATTACH:** `Figure 4.3` — CI/CD pipeline flow diagram. Draw a horizontal left-to-right pipeline with six labelled boxes connected by arrows: (1) Code Checkout → (2) SonarQube SAST Scan → (3) Docker Build → (4) Trivy Image Scan → (5) Checkov IaC Scan → (6) Terraform Apply. Add a red "BLOCK" branch dropping down from boxes 2, 4, and 5 labelled "Critical finding → pipeline fails, no deploy". Add a green "DEPLOY" arrow coming out of box 6. This diagram makes the shift-left argument visual.




#### 4.3.7 Application Layer Class Design

Figure 4.4 presents the class diagram for the Node.js/Express application layer, showing the six data model classes and the two service/middleware classes that together form the backend of the system.

The six model classes — `User`, `Patient`, `Doctor`, `MedicalRecord`, `Appointment`, and `AuditLog` — map directly to the database schema defined in Section 4.4. Each model class encapsulates the attributes of its corresponding database table and exposes static methods for querying and mutating that table. The two service classes — `AuthController` and `RBACMiddleware` — operate at the request-handling layer. `AuthController` manages login, logout, and JWT token validation. `RBACMiddleware` intercepts every incoming request and enforces the role-based access control policy by verifying the caller's role against the required permission before the request reaches the route handler.

> 📎 **ATTACH:** `Figure 4.4` — Class diagram. Show eight classes in two colour groups. Group 1 — Models (blue): User (userId, username, passwordHash, role, isActive, createdAt / findById(), findByUsername(), create(), deactivate()), Patient (patientId, userId, fullName, dateOfBirth, contactNumber, assignedDoctorId / findById(), findByDoctor(), register(), update()), Doctor (doctorId, userId, fullName, specialisation / findById(), getPatients()), MedicalRecord (recordId, patientId, doctorId, diagnosis, prescription, notes, createdAt / create(), findByPatient(), update()), Appointment (appointmentId, patientId, doctorId, dateTime, status / schedule(), findByDoctor(), findByPatient(), update(), cancel()), AuditLog (logId, userId, action, resource, ipAddress, timestamp / log()). Group 2 — Services (purple): AuthController (login(), logout(), validateToken()), RBACMiddleware (checkRole(), authorise()). Relationships: User 1--0..1 Patient; User 1--0..1 Doctor; Doctor 1--* Patient; Doctor 1--* MedicalRecord; Patient 1--* MedicalRecord; Patient 1--* Appointment; Doctor 1--* Appointment; User 1--* AuditLog; AuthController uses RBACMiddleware. Standard UML three-section boxes.

#### 4.3.8 Security Design

Security is a first-class design concern throughout this system, not an afterthought. This section describes the security controls implemented at each layer of the stack — authentication, authorisation, API hardening, network isolation, data encryption, and audit monitoring — and maps each control to its corresponding HIPAA Security Rule requirement.

##### 4.3.8.1 Authentication

Passwords are hashed with bcrypt at cost factor 12 and never stored in plaintext. On successful login, the server issues a JWT signed with HMAC-SHA256 and delivers it exclusively as an `httpOnly`, `Secure`, `SameSite=Strict` cookie, eliminating XSS token-theft risk. Access tokens expire after 15 minutes. After three consecutive failed login attempts the account is locked (`is_active = false`) and the admin is notified (§164.312(d)).

##### 4.3.8.2 Authorisation

Authorisation is enforced at two independent layers. The `RBACMiddleware` class validates the JWT role claim on every request and returns HTTP 403 if the caller's role is not permitted for the target route. PostgreSQL Row-Level Security policies enforce the same boundaries at the database layer — even a compromised API endpoint cannot return rows that the authenticated session is not authorised to see. The full role-permission matrix is provided in Appendix C, Table C.3.

##### 4.3.8.3 API Security

Rate limiting restricts each IP to 100 requests per 15 minutes (10 per 15 minutes on the login endpoint). All request bodies are validated with `express-validator` before any database interaction occurs. All queries use the `node-postgres` parameterised query API, making SQL injection structurally impossible. Helmet.js sets Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy on every response. CORS accepts requests only from the clinic's CloudFront origin.

##### 4.3.8.4 Network Security

The three-tier VPC ensures no path exists from the internet to EC2 or RDS without passing through the ALB. Security Groups enforce a strict ingress chain: the ALB accepts TCP 443 from the internet; EC2 accepts only from the ALB security group; RDS accepts only from the EC2 security group. The ALB enforces TLS 1.2+ (`ELBSecurityPolicy-TLS13-1-2-2021-06`). All instance maintenance uses SSM Session Manager — no inbound SSH port is open.

##### 4.3.8.5 Data Encryption

All PHI is encrypted at rest using an AWS KMS Customer Managed Key (CMK) on the RDS volume (AES-256); backups, replicas, and snapshots share the same CMK with annual automatic rotation. The S3 bucket uses SSE-S3 with all public access blocked. All data in transit is protected by TLS at the ALB and forced SSL on the EC2-to-RDS connection (`rds.force_ssl = 1`), satisfying §164.312(a)(2)(iv) and §164.312(e)(2)(ii).

##### 4.3.8.6 Monitoring and Audit

Every CRUD operation on patient data writes to the `audit_log` table, recording `userId`, action type, resource ID, source IP, and timestamp (§164.312(b)). AWS CloudTrail records all AWS API calls to an MFA-delete-protected S3 bucket. CloudWatch alarms fire on ≥5 failed logins in 5 minutes, HTTP 5xx rate above 1%, and RDS CPU above 80% for 5 minutes. Security Hub aggregates GuardDuty and Inspector findings into a single HIPAA posture dashboard.

**Table 4.3** — HIPAA Security Rule Compliance Mapping

| HIPAA Requirement               | Reference           | Implementation                                          |
| ------------------------------- | ------------------- | ------------------------------------------------------- |
| Access Control                  | §164.312(a)(1)      | RBAC middleware + PostgreSQL RLS                        |
| Unique User Identification      | §164.312(a)(2)(i)   | UUID per user, bcrypt passwords                         |
| Automatic Logoff                | §164.312(a)(2)(iii) | JWT 15-minute access token expiry                       |
| Encryption / Decryption         | §164.312(a)(2)(iv)  | KMS CMK at rest, TLS 1.2+ in transit                    |
| Audit Controls                  | §164.312(b)         | `audit_log` table + AWS CloudTrail                      |
| Integrity Controls              | §164.312(c)(1)      | PostgreSQL FK constraints + RLS policies                |
| Person or Entity Authentication | §164.312(d)         | bcrypt cost 12 + account lockout after 3 failures       |
| Transmission Security           | §164.312(e)(1)      | HTTPS-only ALB, httpOnly JWT cookie, TLS RDS connection |

---

### 4.4 Database Design

This section presents the relational database schema designed for the proposed system. The design specifies the entity relationships, table structures, column definitions, and row-level security policies that enforce the access control requirements defined in Section 4.2. The schema comprises six tables — `users`, `patients`, `doctors`, `medical_records`, `appointments`, and `audit_log` — each documented with its purpose, inter-table relationships, and the PostgreSQL row-level security policies that restrict data access to authorised users only.

#### 4.4.1 Entity-Relationship Model

The database schema consists of six tables: `users`, `patients`, `doctors`, `medical_records`, `appointments`, and `audit_log`. Figure 4.5 presents the entity-relationship diagram.

> 📎 **ATTACH:** `Figure 4.5` — Entity-Relationship (ER) diagram. Draw the six entities as rectangles with their attributes listed inside. Show the following relationships with cardinality notation: users (1) — (1) patients; users (1) — (1) doctors; doctors (1) — (many) patients [assigned_doctor_id FK]; doctors (1) — (many) medical_records; patients (1) — (many) medical_records; patients (1) — (many) appointments; doctors (1) — (many) appointments. Use crow's foot notation (standard for UTM reports). Underline primary keys. Mark foreign keys with FK.

#### 4.4.2 Database Schema

The complete column-level schema for all six tables is provided in Appendix B. Brief descriptions of each table's purpose are as follows:

- **`users`** — Authentication credentials and role assignment. Passwords stored as bcrypt hashes only; plaintext is never persisted.
- **`patients`** — Patient demographic data and `assigned_doctor_id` foreign key linking each patient to their treating doctor.
- **`doctors`** — Clinical staff records linked to `users` for authentication.
- **`medical_records`** — Clinical records with `doctor_id` and `patient_id` foreign keys; PostgreSQL RLS policies applied to this table.
- **`appointments`** — Scheduling records linking patients to doctors, with a status field (`scheduled`, `completed`, `cancelled`) used for conflict detection.
- **`audit_log`** — Append-only HIPAA audit trail. Records `userId`, action type, target table, record ID, source IP, and timestamp for every data access event.

#### 4.4.3 Row-Level Security Policy

PostgreSQL row-level security (RLS) is enabled on the `medical_records` and `patients` tables to enforce data isolation at the database layer, independent of application-level access controls. Three policies are defined.

**Policy 1 — Doctor access to medical records:** A doctor may only select, insert, or update records where `doctor_id` matches the current database session user. Records assigned to other doctors are invisible and inaccessible.

**Policy 2 — Patient access to own records:** A patient may only select rows from `medical_records` and `patients` where `patient_id` matches their own user identifier. No patient can query another patient's records regardless of application behaviour.

**Policy 3 — Admin exclusion from medical content:** Admin database sessions are granted access to the `patients` and `appointments` tables only. Row-level security on `medical_records` denies all access to sessions authenticated with the admin role, ensuring that administrative staff cannot view clinical record content even with direct database access.

These policies provide a second enforcement layer: even if the Node.js/Express application layer were bypassed through a vulnerability, the database itself would reject any data access that violates the role boundary.

---

### 4.5 Interface Design

The system provides three distinct interface views, one for each user role. The interfaces are designed for clarity and role isolation — each user sees only the functions and data their role permits, with no visibility into other roles' sections.

#### 4.5.1 Login Screen

All users access the system through a single login screen. The screen presents a username field, a password field, and a login button. On successful authentication, the system reads the role from the JWT token and redirects the user to the appropriate dashboard — Doctor Dashboard, Admin Dashboard, or Patient Portal. The wireframe layout for the login screen is shown in Figure E.1 (Appendix E).

#### 4.5.2 Doctor Dashboard

The Doctor Dashboard presents the doctor with their assigned patient list and appointment schedule as the primary views. A navigation sidebar provides access to Patient Records and the appointment calendar. The patient list displays each patient's name, date of last visit, and a "View Records" action button. Selecting a patient opens the patient detail view, showing the full medical record history and a "New Record" button. The new record form presents fields for Diagnosis, Prescription, and Clinical Notes with a Submit button. Figure E.2 (Appendix E) presents the wireframe layout for the Doctor Dashboard.

#### 4.5.3 Admin Dashboard

The Admin Dashboard centres on appointment management and patient registration. The navigation sidebar provides access to Patient Registration, Appointment Scheduling, and User Management. The appointment scheduling screen presents a calendar view with time slot selection. Admin selects a patient, selects a doctor, picks a date and time, and confirms the booking. The patient registration screen presents a form for new patient demographic details and doctor assignment. Figure E.3 (Appendix E) presents the wireframe layout for the Admin Dashboard.

#### 4.5.4 Patient Portal

The Patient Portal is read-only. The patient can view their own medical records and their upcoming appointments. No create, edit, or delete controls appear anywhere in the patient interface.

The records view displays a chronological list of medical records, each showing the date, attending doctor, and diagnosis. Selecting a record expands it to show the full details including prescription and notes. The appointments view shows upcoming scheduled appointments with date, time, and doctor name. Figure E.4 (Appendix E) presents the wireframe layout for the Patient Portal.

---

### 4.6 Chapter Summary

This chapter has presented the complete requirement analysis and system design for the Secure Cloud-Based Patient Data Management System. The use case analysis defined four primary use cases covering the core interactions for each user role, with preconditions, main flows, and exception handling documented for each.

The system architecture design specified a three-tier deployment within an AWS VPC divided into six subnets across two Availability Zones. Security controls were defined at three independent layers: Security Groups at the instance level, Network ACLs at the subnet boundary, and IAM policies at the AWS resource level. The DevSecOps pipeline design specified six sequential stages with automated blocking on critical security findings at three points in the pipeline, enforcing the shift-left principle established in Chapter 3.

The database design defined six PostgreSQL tables with explicit foreign key relationships, UUID primary keys, and an append-only audit log table for HIPAA compliance. Row-level security policies were specified for the `medical_records` and `patients` tables, providing database-layer enforcement of the RBAC model that is independent of application-level controls. The interface design presented wireframe layouts for four screens — login, doctor dashboard, admin dashboard, and patient portal — each reflecting the role isolation that is the central security principle of the system.

The complete design presented in this chapter provides the specification from which the implementation in Chapter 5 will proceed, with each design decision traceable to a requirement identified in Chapter 3 and a deficiency identified in the case study analysis of Chapter 2.

---

### References

Amazon Web Services. (2023). *AWS Well-Architected Framework — Security Pillar*. Amazon Web Services.

PostgreSQL Global Development Group. (2024). *Row security policies*. PostgreSQL Documentation. https://www.postgresql.org/docs/current/ddl-rowsecurity.html
