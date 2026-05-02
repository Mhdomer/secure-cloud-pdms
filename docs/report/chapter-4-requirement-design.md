---
tags: [fyp, psm1, chapter-4, requirement-analysis, design, vpc, database, interface]
phase: 4
status: complete
created: 2026-05-02
related: [[PHASES]], [[chapter-3-methodology]], [[docs/design/architecture/README]]
---

# CHAPTER 4

## REQUIREMENT ANALYSIS AND DESIGN

---

### 4.1 Introduction

This chapter translates the requirements established in Chapter 3 into a complete system design. It presents the detailed use case analysis that governs the behaviour of each user role, followed by the full architectural design of the proposed system — covering the AWS network topology, security control configuration, IAM policy structure, and DevSecOps pipeline design. The database schema is then defined, including the PostgreSQL table structures and row-level security policies that enforce data isolation at the storage layer. The chapter concludes with the interface design, presenting the wireframe layouts for each user role's primary interaction screens.

Section 4.2 presents the detailed requirement analysis through use case descriptions. Section 4.3 presents the complete project design covering the system architecture. Section 4.4 defines the database design including the entity-relationship model and schema. Section 4.5 presents the interface design for the three user roles. Section 4.6 summarises the chapter.

---

### 4.2 Requirement Analysis

#### 4.2.1 Use Case Overview

The system serves three user roles — Doctor, Admin, and Patient — each with a distinct set of permitted operations. Figure 4.1 presents the use case diagram showing all actors and their authorised interactions with the system.

> 📎 **ATTACH:** `Figure 4.1` — Use case diagram. Three actor stick figures on the left: Doctor, Admin, Patient. System boundary box in the centre containing labelled use case ovals. Doctor connects to: Login, View Assigned Patients, Create Medical Record, Update Medical Record, View Medical History, View Appointments. Admin connects to: Login, Register Patient, Schedule Appointment, Update Appointment, Deactivate User Account. Patient connects to: Login, View Own Medical Records, View Own Appointments. Draw clean connecting lines — no overlapping use cases between roles except Login, which all three share.

#### 4.2.2 Use Case Descriptions

The following tables describe the primary use cases in detail, specifying the actor, preconditions, main flow, and exception handling for each.

---

**Use Case UC-01: Doctor Creates Medical Record**

| Field | Description |
|-------|-------------|
| Use Case ID | UC-01 |
| Use Case Name | Create Medical Record |
| Actor | Doctor |
| Precondition | Doctor is authenticated. Patient is registered and assigned to this doctor. |
| Main Flow | 1. Doctor selects patient from assigned patient list. 2. Doctor selects "New Medical Record". 3. System displays record creation form. 4. Doctor enters diagnosis, prescription, and clinical notes. 5. Doctor submits the record. 6. System validates input and writes the record to the database with the doctor's ID and a timestamp. 7. System generates an audit log entry recording the creation event. 8. System confirms successful save to the doctor. |
| Alternative Flow | If the patient is not assigned to this doctor, the system returns an authorisation error and the record is not created. |
| Postcondition | A new medical record is stored in the database, associated with the patient and the treating doctor. An audit log entry exists for the event. |

---

**Use Case UC-02: Admin Schedules Appointment**

| Field | Description |
|-------|-------------|
| Use Case ID | UC-02 |
| Use Case Name | Schedule Appointment |
| Actor | Admin |
| Precondition | Admin is authenticated. Patient and doctor are both registered in the system. |
| Main Flow | 1. Admin navigates to the appointment scheduling screen. 2. Admin selects the patient and the assigned doctor. 3. Admin selects date and time slot from available slots. 4. System checks for scheduling conflicts. 5. Admin confirms the booking. 6. System creates the appointment record and associates it with both the patient and doctor. 7. System confirms successful scheduling to the admin. |
| Alternative Flow | If a scheduling conflict exists, the system notifies the admin and returns to step 3. |
| Postcondition | An appointment record is stored in the database, visible to the relevant doctor, admin, and patient. |

---

**Use Case UC-03: Patient Views Own Medical Records**

| Field | Description |
|-------|-------------|
| Use Case ID | UC-03 |
| Use Case Name | View Own Medical Records |
| Actor | Patient |
| Precondition | Patient is authenticated. |
| Main Flow | 1. Patient navigates to the medical records section. 2. System queries the database for records where `patient_id` matches the authenticated user. 3. System returns a list of the patient's records ordered by date. 4. Patient selects a record to view the details. |
| Alternative Flow | If no records exist, the system displays an empty state message. |
| Postcondition | Patient views their own records only. No other patient's data is returned at any point. |

---

**Use Case UC-04: User Authentication**

| Field | Description |
|-------|-------------|
| Use Case ID | UC-04 |
| Use Case Name | User Login |
| Actor | Doctor, Admin, Patient (all roles) |
| Precondition | User account exists and is active. |
| Main Flow | 1. User navigates to the login screen. 2. User enters username and password. 3. System validates credentials against the hashed password in the database. 4. On success, system issues a JWT token containing the user's role. 5. All subsequent API requests include the JWT token in the Authorization header. 6. System validates the token and enforces role permissions on every request. |
| Alternative Flow | On three consecutive failed login attempts, the account is temporarily locked and the admin is notified. |
| Postcondition | User is authenticated and operating under the permissions of their assigned role. |

---

### 4.3 Project Design

#### 4.3.1 System Architecture Overview

The proposed system is deployed as a three-tier web application within an AWS Virtual Private Cloud. The three tiers — presentation, application, and data — are hosted in physically separated subnet layers with distinct access policies. No direct communication path exists between the presentation tier and the database tier; all data access is mediated through the application tier.

Figure 4.2 presents the complete system architecture diagram.

> 📎 **ATTACH:** `Figure 4.2` — Full system architecture diagram. This is the most important diagram in the entire report. Draw the following, from top to bottom: Internet → Internet Gateway → ALB in Public Subnets (AZ-a and AZ-b) → EC2 instances in Private App Subnets (AZ-a and AZ-b) → RDS Primary + Standby in Private DB Subnets (AZ-a and AZ-b). Add NAT Gateway in the public subnet with an arrow showing EC2 outbound traffic. Show the VPC boundary box around everything. Label all CIDR ranges. On the right side, show the CI/CD pipeline (GitHub → GitHub Actions → ECR → EC2). Add a security layer annotation showing: Security Groups on EC2 and RDS, NACLs on subnet boundaries, KMS on RDS, CloudTrail logging everything. Use colour to distinguish the three tiers.

#### 4.3.2 VPC Network Design

The system is deployed within a single AWS VPC with the CIDR block `10.0.0.0/16`. The VPC is divided into six subnets across two Availability Zones — three subnet tiers per AZ — to achieve high availability and fault isolation.

**Table 4.1** — VPC Subnet Configuration

| Subnet | CIDR | Availability Zone | Tier | Purpose |
|--------|------|------------------|------|---------|
| public-subnet-a | 10.0.1.0/24 | ap-southeast-1a | Public | ALB, NAT Gateway |
| public-subnet-b | 10.0.2.0/24 | ap-southeast-1b | Public | ALB (multi-AZ) |
| app-subnet-a | 10.0.3.0/24 | ap-southeast-1a | Private | EC2 application instances |
| app-subnet-b | 10.0.4.0/24 | ap-southeast-1b | Private | EC2 application instances |
| db-subnet-a | 10.0.5.0/24 | ap-southeast-1a | Isolated | RDS primary instance |
| db-subnet-b | 10.0.6.0/24 | ap-southeast-1b | Isolated | RDS standby instance (Multi-AZ) |

**Routing configuration.** Public subnets are associated with a route table that directs `0.0.0.0/0` traffic to the Internet Gateway, enabling inbound internet access to the ALB and outbound internet access for NAT. Private application subnets are associated with a route table that directs `0.0.0.0/0` to the NAT Gateway, enabling EC2 instances to make outbound calls (e.g., to the AWS API, package repositories) without being directly reachable from the internet. Database subnets have no route to the internet — their route table contains only the local VPC route (`10.0.0.0/16`), making them completely isolated from all external traffic.

#### 4.3.3 Security Group Configuration

Security Groups act as virtual firewalls at the instance level, enforcing allow-list rules for inbound and outbound traffic. Three Security Groups are defined.

**Table 4.2** — Security Group Rules

| Security Group | Direction | Protocol | Port | Source / Destination | Purpose |
|---------------|-----------|----------|------|----------------------|---------|
| alb-sg | Inbound | TCP | 443 | 0.0.0.0/0 | HTTPS from internet |
| alb-sg | Inbound | TCP | 80 | 0.0.0.0/0 | HTTP (redirected to 443) |
| alb-sg | Outbound | TCP | 5000 | ec2-sg | Forward to application |
| ec2-sg | Inbound | TCP | 5000 | alb-sg | Accept only from ALB |
| ec2-sg | Outbound | TCP | 5432 | rds-sg | Connect to database |
| ec2-sg | Outbound | TCP | 443 | 0.0.0.0/0 | AWS API / NAT outbound |
| rds-sg | Inbound | TCP | 5432 | ec2-sg | Accept only from EC2 |
| rds-sg | Outbound | — | — | None | No outbound permitted |

The critical security property enforced by this configuration is that the RDS instance accepts connections exclusively from the EC2 Security Group. There is no rule that permits any other source — including direct developer access, the ALB, or any internet address — to reach the database port.

#### 4.3.4 Network Access Control List (NACL) Configuration

Network ACLs provide a stateless secondary security boundary at the subnet level, complementing Security Groups. Three NACLs are defined, one per subnet tier.

**Table 4.3** — NACL Rules Summary

| NACL | Applies To | Key Inbound Rules | Key Outbound Rules |
|------|-----------|------------------|--------------------|
| public-nacl | Public subnets | Allow TCP 443 from 0.0.0.0/0; Allow TCP 80 from 0.0.0.0/0; Allow ephemeral ports (1024–65535) from 0.0.0.0/0 | Allow all to 0.0.0.0/0 |
| app-nacl | App subnets | Allow TCP 5000 from 10.0.1.0/24 and 10.0.2.0/24 (public subnets); Allow ephemeral ports from 10.0.5.0/24 and 10.0.6.0/24 (DB response) | Allow TCP 5432 to 10.0.5.0/24 and 10.0.6.0/24; Allow ephemeral ports to public subnets |
| db-nacl | DB subnets | Allow TCP 5432 from 10.0.3.0/24 and 10.0.4.0/24 (app subnets) only; Deny all other inbound | Allow ephemeral ports to 10.0.3.0/24 and 10.0.4.0/24 only |

The database NACL provides defence in depth: even if a Security Group rule were misconfigured or accidentally modified, the NACL would independently block any traffic to port 5432 that did not originate from the application subnets.

#### 4.3.5 IAM Policy Design

Three IAM roles are defined, mapping to the three operational user roles of the system. Each role is granted the minimum permissions required to perform its function, implementing the principle of least privilege.

**Table 4.4** — IAM Role Definitions

| Role | AWS Permissions | Application Permissions | Scope Restriction |
|------|----------------|------------------------|-------------------|
| Doctor | CloudWatch:PutLogEvents | Read/write own assigned patient records; read appointment schedule | Records filtered by `assigned_doctor_id = current_user` |
| Admin | CloudWatch:PutLogEvents | Create/update patient registrations; create/update/cancel appointments; deactivate user accounts | No access to medical record content |
| Patient | CloudWatch:PutLogEvents | Read own medical records (read-only); read own appointments (read-only) | Records filtered by `patient_id = current_user` |

In addition to user-facing roles, the EC2 instances are assigned an instance profile with a dedicated IAM role that grants: `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (to write application logs to CloudWatch), and `ssm:GetParameter` (to retrieve database credentials from AWS Systems Manager Parameter Store). The EC2 role explicitly has no permissions to access RDS directly through IAM — database access is controlled at the network layer through Security Groups and at the application layer through the connection string.

#### 4.3.6 DevSecOps Pipeline Design

The CI/CD pipeline is implemented in GitHub Actions and is triggered on every push to the `main` branch. The pipeline executes six stages in sequence. A failure at any stage with a critical finding terminates the pipeline and the deployment does not proceed.

Figure 4.3 shows the pipeline flow diagram.

> 📎 **ATTACH:** `Figure 4.3` — CI/CD pipeline flow diagram. Draw a horizontal left-to-right pipeline with six labelled boxes connected by arrows: (1) Code Checkout → (2) SonarQube SAST Scan → (3) Docker Build → (4) Trivy Image Scan → (5) Checkov IaC Scan → (6) Terraform Apply. Add a red "BLOCK" branch dropping down from boxes 2, 4, and 5 labelled "Critical finding → pipeline fails, no deploy". Add a green "DEPLOY" arrow coming out of box 6. This diagram makes the shift-left argument visual.

**Stage 1 — Code Checkout:** The repository is checked out and all application dependencies are installed.

**Stage 2 — SonarQube SAST Scan:** The application source code is analysed by SonarQube for security vulnerabilities, injection risks, and code quality issues. A Quality Gate configured for zero critical or blocker-severity security issues must pass before the pipeline advances.

**Stage 3 — Docker Build:** The React frontend and Flask backend are built as Docker container images and tagged with the commit SHA.

**Stage 4 — Trivy Image Scan:** Trivy scans both container images against the NVD vulnerability database. The pipeline is configured to fail on any `CRITICAL` severity CVE finding. Images that pass are pushed to Amazon Elastic Container Registry (ECR).

**Stage 5 — Checkov IaC Scan:** Checkov analyses all Terraform configuration files in the repository against its policy library. Specific policies enforced include: RDS encryption at rest enabled, S3 bucket public access blocked, Security Groups without unrestricted inbound SSH, and CloudTrail enabled. Any policy failure at `HIGH` or `CRITICAL` level blocks the pipeline.

**Stage 6 — Terraform Apply:** If all scan stages pass, Terraform applies the infrastructure configuration to AWS. Only resources that have changed since the last state are modified — unchanged resources are not re-provisioned.

---

### 4.4 Database Design

#### 4.4.1 Entity-Relationship Model

The database schema consists of six tables: `users`, `patients`, `doctors`, `medical_records`, `appointments`, and `audit_log`. Figure 4.4 presents the entity-relationship diagram.

> 📎 **ATTACH:** `Figure 4.4` — Entity-Relationship (ER) diagram. Draw the six entities as rectangles with their attributes listed inside. Show the following relationships with cardinality notation: users (1) — (1) patients; users (1) — (1) doctors; doctors (1) — (many) patients [assigned_doctor_id FK]; doctors (1) — (many) medical_records; patients (1) — (many) medical_records; patients (1) — (many) appointments; doctors (1) — (many) appointments. Use crow's foot notation (standard for UTM reports). Underline primary keys. Mark foreign keys with FK.

#### 4.4.2 Database Schema

**Table: users**

Stores authentication credentials and role assignment for all system users. Passwords are stored as bcrypt hashes — the plaintext password is never persisted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | UUID | PRIMARY KEY | Unique identifier |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash of password |
| role | ENUM('doctor','admin','patient') | NOT NULL | Assigned role |
| is_active | BOOLEAN | DEFAULT TRUE | Account active status |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |
| last_login | TIMESTAMP | NULLABLE | Last successful login |

---

**Table: patients**

Stores patient demographic information. Linked to the `users` table for authentication and to the `doctors` table for the assigned doctor relationship.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| patient_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK → users.user_id | Authentication account |
| first_name | VARCHAR(100) | NOT NULL | Patient first name |
| last_name | VARCHAR(100) | NOT NULL | Patient last name |
| date_of_birth | DATE | NOT NULL | Date of birth |
| contact_number | VARCHAR(20) | NULLABLE | Phone number |
| assigned_doctor_id | UUID | FK → doctors.doctor_id | Assigned treating doctor |
| registered_at | TIMESTAMP | DEFAULT NOW() | Registration timestamp |

---

**Table: doctors**

Stores clinical staff information, linked to the `users` table for authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| doctor_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK → users.user_id | Authentication account |
| first_name | VARCHAR(100) | NOT NULL | Doctor first name |
| last_name | VARCHAR(100) | NOT NULL | Doctor last name |
| specialisation | VARCHAR(100) | NULLABLE | Medical specialisation |

---

**Table: medical_records**

Stores clinical records created by doctors. Each record is linked to exactly one patient and one creating doctor.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| record_id | UUID | PRIMARY KEY | Unique identifier |
| patient_id | UUID | FK → patients.patient_id | Associated patient |
| doctor_id | UUID | FK → doctors.doctor_id | Creating doctor |
| diagnosis | TEXT | NOT NULL | Clinical diagnosis |
| prescription | TEXT | NULLABLE | Prescribed treatment |
| notes | TEXT | NULLABLE | Additional clinical notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

---

**Table: appointments**

Stores scheduled appointments linking patients to doctors at a defined time.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| appointment_id | UUID | PRIMARY KEY | Unique identifier |
| patient_id | UUID | FK → patients.patient_id | Attending patient |
| doctor_id | UUID | FK → doctors.doctor_id | Attending doctor |
| scheduled_at | TIMESTAMP | NOT NULL | Appointment date and time |
| status | ENUM('scheduled','completed','cancelled') | DEFAULT 'scheduled' | Current status |
| notes | TEXT | NULLABLE | Admin notes |
| created_by | UUID | FK → users.user_id | Admin who created booking |

---

**Table: audit_log**

An append-only table recording every significant data access event. This table satisfies the HIPAA audit control requirement and the CloudTrail complement at the application data level.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| log_id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK → users.user_id | User who performed the action |
| action | VARCHAR(50) | NOT NULL | Action type (CREATE, READ, UPDATE, DELETE) |
| table_name | VARCHAR(50) | NOT NULL | Target table |
| record_id | UUID | NOT NULL | Target record identifier |
| ip_address | INET | NULLABLE | Client IP address |
| performed_at | TIMESTAMP | DEFAULT NOW() | Event timestamp |

#### 4.4.3 Row-Level Security Policy

PostgreSQL row-level security (RLS) is enabled on the `medical_records` and `patients` tables to enforce data isolation at the database layer, independent of application-level access controls. Three policies are defined.

**Policy 1 — Doctor access to medical records:** A doctor may only select, insert, or update records where `doctor_id` matches the current database session user. Records assigned to other doctors are invisible and inaccessible.

**Policy 2 — Patient access to own records:** A patient may only select rows from `medical_records` and `patients` where `patient_id` matches their own user identifier. No patient can query another patient's records regardless of application behaviour.

**Policy 3 — Admin exclusion from medical content:** Admin database sessions are granted access to the `patients` and `appointments` tables only. Row-level security on `medical_records` denies all access to sessions authenticated with the admin role, ensuring that administrative staff cannot view clinical record content even with direct database access.

These policies provide a second enforcement layer: even if the Flask application layer were bypassed through a vulnerability, the database itself would reject any data access that violates the role boundary.

---

### 4.5 Interface Design

The system provides three distinct interface views, one for each user role. The interfaces are designed for clarity and role isolation — each user sees only the functions and data their role permits, with no visibility into other roles' sections.

#### 4.5.1 Login Screen

All users access the system through a single login screen. The screen presents a username field, a password field, and a login button. On successful authentication, the system reads the role from the JWT token and redirects the user to the appropriate dashboard — Doctor Dashboard, Admin Dashboard, or Patient Portal.

> 📎 **ATTACH:** `Figure 4.5` — Login screen wireframe. Simple centred card layout: clinic logo at top, "Username" text field, "Password" text field (masked), "Login" button. Below the button, small text: "Contact your administrator if you cannot log in." No self-registration link — all accounts are created by admin only. Keep it minimal.

#### 4.5.2 Doctor Dashboard

The Doctor Dashboard presents the doctor with their assigned patient list and appointment schedule as the primary views. A navigation sidebar provides access to Patient Records and the appointment calendar.

The patient list displays each patient's name, date of last visit, and a "View Records" action button. Selecting a patient opens the patient detail view, showing the full medical record history and a "New Record" button. The new record form presents fields for Diagnosis, Prescription, and Clinical Notes with a Submit button.

> 📎 **ATTACH:** `Figure 4.6` — Doctor Dashboard wireframe. Left sidebar with: Dashboard, My Patients, Appointments, Logout. Main content area split into two panels: top panel "Today's Appointments" (table with columns: Time, Patient Name, Status), bottom panel "My Patients" (table with columns: Patient Name, Date of Birth, Last Visit, Action [View Records button]). Clean tabular layout — no decorative elements needed for the wireframe.

#### 4.5.3 Admin Dashboard

The Admin Dashboard centres on appointment management and patient registration. The navigation sidebar provides access to Patient Registration, Appointment Scheduling, and User Management.

The appointment scheduling screen presents a calendar view with time slot selection. Admin selects a patient, selects a doctor, picks a date and time, and confirms the booking. The patient registration screen presents a form for new patient demographic details and doctor assignment.

> 📎 **ATTACH:** `Figure 4.7` — Admin Dashboard wireframe. Left sidebar with: Dashboard, Register Patient, Appointments, User Management, Logout. Main content area: top section "Upcoming Appointments" (table: Date/Time, Patient, Doctor, Status, Actions [Edit/Cancel]). Below it, a "Quick Register" shortcut card. No medical record content visible anywhere on this screen — the admin interface should visually have no path to clinical data.

#### 4.5.4 Patient Portal

The Patient Portal is read-only. The patient can view their own medical records and their upcoming appointments. No create, edit, or delete controls appear anywhere in the patient interface.

The records view displays a chronological list of medical records, each showing the date, attending doctor, and diagnosis. Selecting a record expands it to show the full details including prescription and notes. The appointments view shows upcoming scheduled appointments with date, time, and doctor name.

> 📎 **ATTACH:** `Figure 4.8` — Patient Portal wireframe. Left sidebar with: My Records, My Appointments, Logout. Main content area for "My Records": timeline-style list (Date | Doctor | Diagnosis | [Expand] button). Expanded record shows: Diagnosis, Prescription, Notes — all read-only, no edit icons present. The visual absence of edit/delete controls is intentional and should be clearly visible in the wireframe.

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
