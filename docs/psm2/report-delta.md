# Report Delta — Changes That Need Report Updates

Every time a design decision, role, UI element, use case, or rule changes during PSM2
implementation, it gets logged here with the exact report section that needs to be edited.

**Format per entry:**
- **What changed** — short description
- **Category** — Role | UI | Functionality | Security | DB Schema | API | Use Case
- **Report section** — chapter + section title
- **What to update in the report** — specific edit instructions

---

## Sprint 3 — Backend + Frontend Implementation

---

### [DELTA-001] 4th role added: `superadmin`

| Field | Value |
|---|---|
| **Category** | Role / Security / Functionality |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
The system originally had 3 roles (Doctor, Admin, Patient). A 4th role `superadmin` was added because admin (reception staff) should not be able to create or deactivate user accounts — that is a security violation. Superadmin exclusively manages system accounts.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Only Superadmin may create, deactivate, or reactivate Doctor and Admin accounts" |
| Chapter 3 | §3.5.1 Functional Requirements | Update the user role list from 3 roles to 4 roles |
| Chapter 3 | User Role table (if exists) | Add Superadmin row with its permissions |
| Chapter 4 | §4.x RBAC / Access Control Design | Add Superadmin to the role-permission matrix |
| Chapter 4 | §4.x Use Case Diagram | Add Superadmin actor and its use cases (Manage User Accounts UC) |
| Chapter 4 | §4.x ER Diagram | Update `role` column type note: `VARCHAR(12) CHECK IN ('superadmin','doctor','admin','patient')` |
| Chapter 4 | §4.x System Architecture | Mention 4-role RBAC in the auth/security design description |

---

### [DELTA-002] Admin role renamed to "Staff" in UI

| Field | Value |
|---|---|
| **Category** | Role / UI |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
The `admin` role database value stays `'admin'` but the display label everywhere in the UI is now **"Staff"** (English) / **"موظف"** (Arabic). This better reflects the role — reception/registration counter staff, not a system administrator.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Replace "Admin" with "Staff" in role descriptions where it refers to reception staff |
| Chapter 4 | Role table / RBAC matrix | Update display name from "Admin" to "Staff" |
| Chapter 4 | Use Case Diagram | Rename the Admin actor to "Staff" |

---

### [DELTA-003] Public landing page added at `/`

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
A public marketing homepage was added at the root route `/`. Unauthenticated users see this page instead of being redirected to `/login`. Authenticated users are still redirected to their dashboard. The page covers: clinic branding, services overview, trust statistics, how-it-works flow, contact info.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "The system shall display a public landing page for unauthenticated users describing clinic services" |
| Chapter 4 | §4.x UI Design / Screen Designs | Add landing page wireframe or screenshot + description of its sections |
| Chapter 4 | Navigation / Routing design | Document that `/` is public (no auth required) and routes unauthenticated visitors to LandingPage |

---

### [DELTA-004] Role hierarchy enforcement — staff cannot create accounts

| Field | Value |
|---|---|
| **Category** | Security / Functionality / Use Case |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
In the original design it was not explicitly stated who creates user accounts. Implementation revealed that Admin (Staff) was incorrectly able to create Doctor and Admin accounts — a privilege escalation risk. The rule is now enforced at both the API layer (route requires `superadmin` role) and the frontend (User Management page is only in the Superadmin nav).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.2 Non-Functional Requirements (Security) | Add NFR: "The system shall enforce the principle of least privilege — Staff accounts shall not have account management capabilities" |
| Chapter 4 | §4.x Use Case — Manage User Accounts | Change actor from Admin to Superadmin |
| Chapter 4 | RBAC matrix | Explicitly show that `admin` role has NO permission for Create/Deactivate User |

---

## How to use this file

1. After each sprint ends, check this file before editing the report.
2. Each DELTA entry tells you exactly which section to open and what to change.
3. Mark entries `Done` in the Status field once the report chapter is updated.
4. New implementation decisions go here first — then into the sprint, then into the report.

---

*Last updated: Sprint 3 (2026-07-14)*
