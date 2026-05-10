---
tags: [fyp, design, use-cases, index]
status: active
created: 2026-05-09
---

# Use Case Documentation — Secure Cloud PDMS

This folder contains the detailed use case specifications for all 4 modules of the system. Each use case file includes the UC description table, sequence diagram draw instructions, functional requirements, and non-functional requirements.

These documents feed directly into Chapter 4 of the PSM1 report.

---

## Module Summary

| Module | Folder | Use Cases | Key Actor(s) |
|--------|--------|-----------|--------------|
| Module 1 — Authentication & User Management | [module-1-auth/](module-1-auth/) | UC-01 to UC-05 | Doctor, Admin, Patient, System |
| Module 2 — Patient Registration & Profile Management | [module-2-patient-management/](module-2-patient-management/) | UC-06 to UC-09 | Admin, Doctor, Patient |
| Module 3 — Medical Records Management | [module-3-medical-records/](module-3-medical-records/) | UC-10 to UC-13 | Doctor, Patient |
| Module 4 — Appointment Scheduling | [module-4-appointments/](module-4-appointments/) | UC-14 to UC-18 | Admin, Doctor, Patient |

**Total: 18 Use Cases across 4 Modules**

---

## Functional Requirements Index

| ID | UC | Requirement Summary |
|----|-----|---------------------|
| FR-01 | UC-01 | Authenticate user via username + password |
| FR-02 | UC-01 | Issue JWT token with role on success |
| FR-03 | UC-02 | Invalidate JWT on logout |
| FR-04 | UC-03 | Lock account after 3 consecutive failed logins |
| FR-05 | UC-04 | Admin creates user account with assigned role |
| FR-06 | UC-05 | Admin deactivates user account |
| FR-07 | UC-06 | Admin registers new patient with demographic info |
| FR-08 | UC-07 | Doctor/Admin views patient profile (RLS-enforced) |
| FR-09 | UC-08 | Admin updates patient information |
| FR-10 | UC-09 | Admin assigns/reassigns treating doctor to patient |
| FR-11 | UC-10 | Doctor creates medical record for assigned patient |
| FR-12 | UC-11 | Doctor views records for assigned patients; patient views own only |
| FR-13 | UC-12 | Doctor updates medical record they created |
| FR-14 | UC-13 | Doctor views chronological medical history for assigned patient |
| FR-15 | UC-10/11/12/13 | PostgreSQL RLS enforces doctor_id / patient_id boundary at DB layer |
| FR-16 | UC-14 | Admin schedules appointment linking patient to doctor |
| FR-17 | UC-14 | System detects and prevents scheduling conflicts |
| FR-18 | UC-15 | Doctor views their own appointment schedule |
| FR-19 | UC-16 | Patient views their own upcoming appointments |
| FR-20 | UC-17 | Admin updates appointment details |
| FR-21 | UC-18 | Admin cancels appointment |

---

## Diagrams to Include in Chapter 4 (Report)

The following sequence diagrams from this folder are selected for inclusion in the Chapter 4 report (one per module):

| Figure | UC | Title |
|--------|----|-------|
| Figure 4.11 | UC-01 | Sequence Diagram — User Login |
| Figure 4.12 | UC-06 | Sequence Diagram — Register New Patient |
| Figure 4.13 | UC-10 | Sequence Diagram — Create Medical Record |
| Figure 4.14 | UC-14 | Sequence Diagram — Schedule Appointment |

Additional required Chapter 4 diagrams (not UC-specific):

| Figure | Type | Title |
|--------|------|-------|
| Figure 4.9 | Activity Diagram | System-wide workflow (login → role → action → audit) |
| Figure 4.10 | Class Diagram | Node.js model classes with attributes and methods |
