---
tags: [fyp, psm1, figures, attachments, todo]
status: active
created: 2026-05-02
---

# Figures & Attachments Checklist

All diagrams, wireframes, and tables that need to be produced and inserted into the final report. Work through these before submitting to your supervisor.

Recommended tools: **draw.io** (free, exports PNG/SVG), **Lucidchart**, or **Microsoft Visio**.

---

## Chapter 2 — Literature Review

### Figure 2.1 — Alamin Clinic Organizational Structure
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Org chart  
**Tool suggestion:** draw.io

**What to draw:**  
Hierarchical org chart with three levels:
- Top: Clinic Director
- Second level (three boxes side by side): Clinical (Doctors) | Administrative (Admin Staff) | IT (Server Admin)
- Third level under Clinical: Patients
- Third level under Administrative: Patient Registration, Appointment Scheduling

**Why it matters:** The template requires a company organisation structure figure in section 2.2.1. The examiner expects to see it.

---

### Figure 2.2 — Current System Workflow Flowchart ⭐ HIGH PRIORITY
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Flowchart  
**Tool suggestion:** draw.io

**What to draw:**  
Top-to-bottom flowchart of the manual clinic workflow:

START → Patient Arrives → (Diamond) Patient registered? → NO: Admin manually types patient details into desktop app → YES: Admin searches for record → Doctor called → Doctor opens desktop application → (Diamond) Record accessible? → YES: Doctor retrieves record → Doctor writes consultation notes on paper → Admin types notes into system → Data saved to local server → (Diamond) Backup performed? → NO (→ "Data at risk — no backup") → END

Mark these steps in RED to highlight risk points:
- "Single server — no isolation between web/app/DB"
- "Manual note entry — error prone, no validation"
- "No backup policy — data permanently at risk"
- "FTP/USB deployment — no security gate"

Use standard flowchart symbols: rounded rectangles for Start/End, rectangles for process steps, diamonds for decisions.

**Why it matters:** The supervisor specifically asked for current workflow flowchart. Side-by-side with Figure 2.3 it makes the before/after comparison visual and concrete.

---

### Figure 2.3 — Proposed System Workflow Flowchart ⭐ HIGH PRIORITY
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Flowchart  
**Tool suggestion:** draw.io

**What to draw:**  
Top-to-bottom flowchart of the proposed secure workflow:

START → User opens browser (HTTPS) → Login page → (Diamond) Credentials valid? → NO: Log failed attempt → (Diamond) 3 failed attempts? → YES: Lock account + notify Admin → NO: Return to login → YES (credentials valid): Issue JWT token with role → (Diamond) Role? →

ADMIN branch: Admin Dashboard → Register patient / Schedule appointment → Encrypted RDS write → Audit log entry → END

DOCTOR branch: Doctor Dashboard → Select assigned patient → (Diamond) RLS check: doctor owns patient? → YES: View/Create medical record → Encrypted RDS write → Audit log entry → END → NO: Access denied

PATIENT branch: Patient Portal → View own records (read-only) → RLS filters to own records → END

Add annotation boxes in GREEN:
- "KMS — AES-256 encryption at rest"
- "TLS 1.2+ — encryption in transit"  
- "CloudTrail — logs all API calls"
- "GitHub Actions — security scan before every deploy"

**Why it matters:** Shows the examiner exactly how each security problem in the current workflow is fixed. The before/after pair (Figures 2.2 + 2.3) is the visual core of the supervisor's requirement.

---

## Chapter 3 — System Development Methodology

### Figure 3.1 — Agile + DevSecOps Sprint Cycle
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Process cycle diagram  
**Tool suggestion:** draw.io

**What to draw:**  
A circular Agile loop with five stages: Plan → Develop → Test → Review → Release → (back to Plan). Overlay DevSecOps security gates at three points:
- Between Develop and Test: "SonarQube SAST Scan"
- Between Test and Review: "Trivy Container Scan + Checkov IaC Scan"
- Between Review and Release: "AWS Security Hub Posture Check"

Each gate should have a small red "BLOCK" indicator showing it can stop the cycle if a critical finding is detected.

**Why it matters:** Makes the methodology concrete. Without this diagram, section 3.2 is words only — the examiner needs to see the cycle.

---

### Figure 3.2 — Project Sprint Timeline (Gantt Chart)
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Gantt chart  
**Tool suggestion:** draw.io, Excel, or Google Sheets

**What to draw:**  
Horizontal Gantt chart. Rows = 5 sprints. Columns = project calendar months.

| Sprint | Description | Semester |
|--------|-------------|----------|
| Sprint 1 | Requirements & Architecture Design | PSM1 |
| Sprint 2 | Network Infrastructure & Database Layer | PSM2 |
| Sprint 3 | Application Layer & Authentication | PSM2 |
| Sprint 4 | DevSecOps Pipeline & Monitoring | PSM2 |
| Sprint 5 | Security Evaluation & Compliance Testing | PSM2 |

Mark PSM1 and PSM2 as distinct calendar blocks. Label each sprint bar with its key deliverable.

**Why it matters:** Shows the examiner you have a real project schedule, not just a list of phases.

---

### Figure 3.3 — Technology Stack Diagram
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Architecture / stack diagram  
**Tool suggestion:** draw.io

**What to draw:**  
Two zones side by side:

**Left zone — CI/CD Pipeline:**  
GitHub repo → GitHub Actions → (three parallel scanners: SonarQube, Trivy, Checkov) → Amazon ECR

**Right zone — Deployed Stack (inside VPC boundary box):**  
Top to bottom: React (browser) → ALB (public subnet) → Node.js/Express on EC2 (private app subnet) → PostgreSQL on RDS (private DB subnet)

Connect ECR to EC2 with a dashed "pull image" arrow. Label each component with the AWS service name or technology name.

**Why it matters:** Ties all of section 3.4 into one visual. Without it, the technology list is just a wall of text.

---

### Figure 3.4 — Use Case Diagram (Overview)
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Use Case diagram  
**Tool suggestion:** draw.io, Lucidchart, or StarUML

**What to draw:**  
Three actor stick figures on the left: Doctor, Admin, Patient. System boundary rectangle labelled "Secure Cloud PDMS".

Inside the boundary, use case ovals:
- Doctor → Login, View Assigned Patients, Create Medical Record, Update Medical Record, View Medical History, View Appointments
- Admin → Login, Register Patient, Schedule Appointment, Update Appointment, Deactivate User Account
- Patient → Login, View Own Medical Records, View Own Appointments

Login oval is shared — draw connecting lines from all three actors to it.

**Why it matters:** UTM standard — examiners expect a use case diagram. This is placed in Chapter 3 as an overview; a more detailed version appears in Chapter 4 (Figure 4.1).

---

## Chapter 4 — Requirement Analysis and Design

### Figure 4.1 — Detailed Use Case Diagram
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Use Case diagram  
**Tool suggestion:** draw.io, Lucidchart, or StarUML

**What to draw:**  
Same structure as Figure 3.4 but with `<<include>>` and `<<extend>>` relationships added where applicable:
- Login `<<include>>` Validate JWT Token
- Create Medical Record `<<include>>` Generate Audit Log Entry
- View Own Medical Records `<<include>>` Filter by Patient ID (RLS)

This version is more detailed and appears in the Requirement Analysis section of Chapter 4.

**Why it matters:** Chapter 4.2 is specifically about requirement analysis — the detailed use case diagram with dependency relationships shows the examiner you have thought through the system behaviour, not just listed functions.

---

### Figure 4.2 — Full AWS System Architecture Diagram ⭐ MOST IMPORTANT
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** AWS architecture diagram  
**Tool suggestion:** draw.io (has built-in AWS icon set) or AWS Architecture Icons (official free download)

**What to draw:**  
Full AWS VPC diagram. Top to bottom:

1. Internet (cloud icon) → Internet Gateway
2. Public Subnets (AZ-a: 10.0.1.0/24, AZ-b: 10.0.2.0/24): Application Load Balancer + NAT Gateway
3. Private App Subnets (AZ-a: 10.0.3.0/24, AZ-b: 10.0.4.0/24): EC2 instances (Docker containers inside)
4. Private DB Subnets (AZ-a: 10.0.5.0/24, AZ-b: 10.0.6.0/24): RDS Primary (AZ-a) + RDS Standby (AZ-b)

Surrounding services (outside VPC, connected with dashed lines):
- AWS KMS (points to RDS — encryption at rest)
- AWS CloudTrail (points to whole VPC — audit logging)
- AWS CloudWatch (points to EC2 — monitoring)
- AWS Security Hub (points to whole account — HIPAA posture)

On the right side: GitHub → GitHub Actions → ECR → EC2 (deployment flow)

Use colour coding: blue = public tier, orange = private app tier, red = database tier.

**Why it matters:** This is the centrepiece of the entire report. Every design decision in Chapter 4 traces back to this diagram. It must be clear, accurate, and properly labelled.

---

### Figure 4.3 — CI/CD Pipeline Flow Diagram
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Flowchart  
**Tool suggestion:** draw.io

**What to draw:**  
Left-to-right horizontal pipeline with six numbered boxes connected by arrows:

(1) Code Push to GitHub → (2) SonarQube SAST → (3) Docker Build → (4) Trivy Image Scan → (5) Checkov IaC Scan → (6) Terraform Apply → DEPLOYED ✓

From boxes 2, 4, and 5: add a downward red arrow branching off labelled "Critical finding detected → Pipeline BLOCKED, no deploy"

**Why it matters:** Makes the shift-left security argument visual. The examiner needs to see where the blocks happen, not just read about them.

---

### Figure 4.4 — Entity-Relationship (ER) Diagram ⭐ HIGH PRIORITY
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** ER diagram (crow's foot notation)  
**Tool suggestion:** draw.io, dbdiagram.io (free, very quick for ER diagrams)

**What to draw:**  
Six entity rectangles with attributes listed inside. Relationships with crow's foot cardinality:

Entities and key attributes:
- **users**: user_id (PK), username, password_hash, role, is_active
- **patients**: patient_id (PK), user_id (FK), first_name, last_name, date_of_birth, assigned_doctor_id (FK)
- **doctors**: doctor_id (PK), user_id (FK), first_name, last_name, specialisation
- **medical_records**: record_id (PK), patient_id (FK), doctor_id (FK), diagnosis, prescription, created_at
- **appointments**: appointment_id (PK), patient_id (FK), doctor_id (FK), scheduled_at, status
- **audit_log**: log_id (PK), user_id (FK), action, table_name, record_id, performed_at

Relationships:
- users (1) ——< patients (one user has one patient profile)
- users (1) ——< doctors (one user has one doctor profile)
- doctors (1) ——< patients (one doctor assigned to many patients)
- patients (1) ——< medical_records (one patient has many records)
- doctors (1) ——< medical_records (one doctor creates many records)
- patients (1) ——< appointments (one patient has many appointments)
- doctors (1) ——< appointments (one doctor has many appointments)

Underline PKs. Mark FKs. Use crow's foot notation on the "many" end.

**Why it matters:** Database design section requires an ER diagram. This is non-negotiable for UTM reports.

---

### Figure 4.5 — Login Screen Wireframe
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UI wireframe (low-fidelity)  
**Tool suggestion:** draw.io, Figma (free tier), or even pencil sketch scanned

**What to draw:**  
Centred card on a plain background:
- Clinic name / logo at top
- "Username" label + text input box
- "Password" label + masked text input box
- "Login" blue button (full width of card)
- Small text below button: "Contact your administrator if you cannot access your account"
- No "Sign Up" or "Forgot Password" link — all accounts are admin-created only

**Why it matters:** Shows the examiner that account self-registration is intentionally absent — this is a security design decision, not an oversight.

---

### Figure 4.6 — Doctor Dashboard Wireframe
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UI wireframe (low-fidelity)  
**Tool suggestion:** draw.io, Figma (free tier)

**What to draw:**  
Two-panel layout:
- **Left sidebar** (narrow): Dashboard | My Patients | Appointments | Logout
- **Main area top half**: "Today's Appointments" — table with columns: Time | Patient Name | Status
- **Main area bottom half**: "My Patients" — table with columns: Patient Name | Date of Birth | Last Visit | [View Records] button

No admin functions visible. No other patients' records accessible.

---

### Figure 4.7 — Admin Dashboard Wireframe
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UI wireframe (low-fidelity)  
**Tool suggestion:** draw.io, Figma (free tier)

**What to draw:**  
Two-panel layout:
- **Left sidebar**: Dashboard | Register Patient | Appointments | User Management | Logout
- **Main area top**: "Upcoming Appointments" — table: Date/Time | Patient | Doctor | Status | Edit | Cancel
- **Main area bottom**: "Quick Register" shortcut card with [Register New Patient] button

Critically: NO medical record content anywhere on this screen. No "View Records" button. The visual absence of clinical data access is the security point.

---

### Figure 4.8 — Patient Portal Wireframe
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UI wireframe (low-fidelity)  
**Tool suggestion:** draw.io, Figma (free tier)

**What to draw:**  
Two-panel layout:
- **Left sidebar**: My Records | My Appointments | Logout
- **Main area**: "My Medical Records" — timeline list: Date | Doctor | Diagnosis | [View Details] expand button
- Expanded record view shows: Diagnosis (read-only), Prescription (read-only), Notes (read-only)

Critically: NO edit button, NO delete button, NO create button anywhere on the screen. Every field is visually read-only (greyed out or labelled as display-only).

---

### Figure 4.9 — Activity Diagram ⭐ REQUIRED BY COORDINATOR
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Activity Diagram  
**Tool suggestion:** draw.io, Lucidchart, or StarUML

**What to draw:**  
A top-to-bottom UML activity diagram showing the full system workflow (bird's-eye view).

Start → User opens browser → [HTTPS enforced — TLS redirect] → Login Page → (Fork: valid credentials? YES/NO)

**NO path:** Log failed attempt → (Diamond: 3 attempts?) → YES: Lock account + CloudWatch alert → END  
**NO path continued:** NO: Return to login page

**YES path (fork into 3 swim lanes by role):**

**Admin swim lane:** Admin Dashboard → (choice: Register Patient / Schedule Appointment / Manage Users) → Write to RDS → Write to audit_log → END

**Doctor swim lane:** Doctor Dashboard → Select assigned patient → (Diamond: RLS passes?) → YES: View/Create/Update medical record → Write to RDS → Write to audit_log → END → NO: Access denied → END

**Patient swim lane:** Patient Portal → View own records (read-only) → RLS filter applied → Display records → END

**Shared bottom:** All paths merge at → CloudTrail logs API call → END

Use swim lanes (vertical partitions) for the three roles. Add a note box: "Every database write is KMS-encrypted at rest". Use standard UML activity notation: rounded rectangles for actions, diamonds for decisions, thick bars for forks/merges, filled circle for Start, circle-in-circle for End.

**Why it matters:** Coordinator explicitly required an Activity Diagram. This is currently missing from Chapter 4 and must be added before final submission.

---

### Figure 4.10 — Class Diagram ⭐ REQUIRED BY COORDINATOR
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Class Diagram  
**Tool suggestion:** draw.io, Lucidchart, or StarUML

**What to draw:**  
Six class rectangles, each with three compartments (Class Name | Attributes | Methods). Show associations between classes.

**Class: UserModel**
- Attributes: `-userId: UUID`, `-username: String`, `-passwordHash: String`, `-role: Enum(doctor|admin|patient)`, `-isActive: Boolean`, `-failedAttempts: Integer`
- Methods: `+findByUsername(username): UserModel`, `+create(data): UserModel`, `+deactivate(userId): void`, `+incrementFailedAttempts(userId): void`

**Class: PatientModel**
- Attributes: `-patientId: UUID`, `-userId: UUID`, `-firstName: String`, `-lastName: String`, `-dateOfBirth: Date`, `-assignedDoctorId: UUID`
- Methods: `+register(data): PatientModel`, `+findByDoctor(doctorId): PatientModel[]`, `+update(patientId, data): PatientModel`, `+assignDoctor(patientId, doctorId): void`

**Class: DoctorModel**
- Attributes: `-doctorId: UUID`, `-userId: UUID`, `-firstName: String`, `-lastName: String`, `-specialisation: String`
- Methods: `+findById(doctorId): DoctorModel`, `+getAssignedPatients(doctorId): PatientModel[]`

**Class: MedicalRecordModel**
- Attributes: `-recordId: UUID`, `-patientId: UUID`, `-doctorId: UUID`, `-diagnosis: String`, `-prescription: String`, `-notes: String`, `-createdAt: DateTime`, `-updatedAt: DateTime`
- Methods: `+create(data): MedicalRecordModel`, `+findByDoctor(doctorId): MedicalRecordModel[]`, `+findByPatient(patientId): MedicalRecordModel[]`, `+update(recordId, data): MedicalRecordModel`

**Class: AppointmentModel**
- Attributes: `-appointmentId: UUID`, `-patientId: UUID`, `-doctorId: UUID`, `-scheduledAt: DateTime`, `-status: Enum(scheduled|completed|cancelled)`, `-createdBy: UUID`
- Methods: `+schedule(data): AppointmentModel`, `+cancel(appointmentId): void`, `+update(appointmentId, data): AppointmentModel`, `+findByDoctor(doctorId): AppointmentModel[]`, `+findByPatient(patientId): AppointmentModel[]`

**Class: AuditLogModel**
- Attributes: `-logId: UUID`, `-userId: UUID`, `-action: String`, `-tableName: String`, `-recordId: UUID`, `-ipAddress: String`, `-performedAt: DateTime`
- Methods: `+log(data): void`

**Associations (draw lines between classes):**
- UserModel `1` — `0..1` PatientModel (composition)
- UserModel `1` — `0..1` DoctorModel (composition)
- DoctorModel `1` — `*` PatientModel (assigned patients)
- PatientModel `1` — `*` MedicalRecordModel
- DoctorModel `1` — `*` MedicalRecordModel
- PatientModel `1` — `*` AppointmentModel
- DoctorModel `1` — `*` AppointmentModel
- UserModel `1` — `*` AuditLogModel

Use standard UML class notation: `-` for private, `+` for public.

**Why it matters:** Coordinator explicitly required a Class Diagram. Currently missing from Chapter 4.

---

### Figure 4.11 — Sequence Diagram: User Login ⭐ REQUIRED BY COORDINATOR
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Sequence Diagram  
**Tool suggestion:** draw.io, Lucidchart, or SequenceDiagram.org (free)  
**Source:** Full draw instructions in [docs/design/use-cases/module-1-auth/UC-01-login.md](../design/use-cases/module-1-auth/UC-01-login.md)

---

### Figure 4.12 — Sequence Diagram: Register New Patient ⭐ REQUIRED BY COORDINATOR
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Sequence Diagram  
**Source:** Full draw instructions in [docs/design/use-cases/module-2-patient-management/UC-06-register-patient.md](../design/use-cases/module-2-patient-management/UC-06-register-patient.md)

---

### Figure 4.13 — Sequence Diagram: Create Medical Record ⭐ REQUIRED BY COORDINATOR
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Sequence Diagram  
**Source:** Full draw instructions in [docs/design/use-cases/module-3-medical-records/UC-10-create-record.md](../design/use-cases/module-3-medical-records/UC-10-create-record.md)

---

### Figure 4.14 — Sequence Diagram: Schedule Appointment ⭐ REQUIRED BY COORDINATOR
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** UML Sequence Diagram  
**Source:** Full draw instructions in [docs/design/use-cases/module-4-appointments/UC-14-schedule-appointment.md](../design/use-cases/module-4-appointments/UC-14-schedule-appointment.md)

---

---

## Appendix A — Project Activity Schedule (Gantt Chart) ⭐ MANDATORY
**Status:** ⬜ Not produced  
**Inserted into report:** ⬜  
**Type:** Gantt chart  
**Tool suggestion:** Excel, Google Sheets, or draw.io  
**Location in report:** Appendix A (after References section)  
**Page limit:** One page

**What to draw:**  
Horizontal Gantt chart. Rows = tasks grouped by semester. Columns = weeks.

Use two colours: one for PSM1 weeks, one for PSM2 weeks (projected).

**PSM1 rows (completed — shade as done):**

| Task | Approx weeks |
|------|-------------|
| Proposal preparation and approval | Week 1–2 |
| Chapter 1: Introduction | Week 3–4 |
| Chapter 2: Literature Review | Week 4–6 |
| Chapter 3: System Development Methodology | Week 6–7 |
| Chapter 4: Requirement Analysis and Design | Week 7–8 |
| Abstract (English + Bahasa Melayu) | Week 8 |
| Diagram production (Figures 2.1–4.8) | Week 8–9 |
| Progress 1 submission | Week 9 (9 May 2026) |
| Final formatting and submission | Week 10–14 |

**PSM2 rows (projected — shade differently):**

| Task | Approx weeks |
|------|-------------|
| Sprint 2: Network infrastructure (VPC, RDS, EC2) | Week 1–3 |
| Sprint 3: Application layer (React + Node.js, Auth) | Week 3–6 |
| Sprint 4: DevSecOps pipeline (GitHub Actions, scanners) | Week 6–8 |
| Sprint 5: Security evaluation and HIPAA testing | Week 8–10 |
| Chapter 5: Implementation and Testing | Week 9–11 |
| Chapter 6: Conclusion | Week 11–12 |
| Final report compilation and submission | Week 12–14 |

**Mark these milestones with a diamond or vertical line:**
- Progress 1 submission: 9 May 2026
- PSM2 start
- Final submission date (check academic calendar)

**Why it matters:** Mandatory per PSM coordinator guidelines. Shows the examiner the full project timeline across both semesters. One chart, one page.

---

## Summary Checklist

| Figure | Chapter | Type | Status |
|--------|---------|------|--------|
| Figure 2.1 | Ch2 | Org chart | ⬜ |
| Figure 2.2 | Ch2 | Current workflow flowchart ⭐ | ⬜ |
| Figure 2.3 | Ch2 | Proposed workflow flowchart ⭐ | ⬜ |
| Figure 3.1 | Ch3 | Process cycle | ⬜ |
| Figure 3.2 | Ch3 | Gantt chart | ⬜ |
| Figure 3.3 | Ch3 | Stack diagram | ⬜ |
| Figure 3.4 | Ch3 | Use case (overview) | ⬜ |
| Figure 4.1 | Ch4 | Use case (detailed) | ⬜ |
| Figure 4.2 | Ch4 | AWS architecture ⭐ | ⬜ |
| Figure 4.3 | Ch4 | Pipeline flowchart | ⬜ |
| Figure 4.4 | Ch4 | ER diagram ⭐ | ⬜ |
| Figure 4.5 | Ch4 | Login wireframe | ⬜ |
| Figure 4.6 | Ch4 | Doctor wireframe | ⬜ |
| Figure 4.7 | Ch4 | Admin wireframe | ⬜ |
| Figure 4.8 | Ch4 | Patient wireframe | ⬜ |
| Figure 4.9 | Ch4 | Activity diagram ⭐ NEW | ⬜ |
| Figure 4.10 | Ch4 | Class diagram ⭐ NEW | ⬜ |
| Figure 4.11 | Ch4 | Sequence: Login ⭐ NEW | ⬜ |
| Figure 4.12 | Ch4 | Sequence: Register Patient ⭐ NEW | ⬜ |
| Figure 4.13 | Ch4 | Sequence: Create Medical Record ⭐ NEW | ⬜ |
| Figure 4.14 | Ch4 | Sequence: Schedule Appointment ⭐ NEW | ⬜ |
| Appendix A | Appendix | Gantt chart ⭐ MANDATORY | ⬜ |

**Priority order for Progress 1 submission:** Figure 2.2 → Figure 2.3 → Figure 2.1 → Figure 4.2 → Figure 4.4 → rest  
**Priority order for final submission (PSM2):** Figure 4.9 (Activity) → Figure 4.10 (Class) → Figures 4.11–4.14 (Sequence) → Appendix A (Gantt) → all remaining figures
