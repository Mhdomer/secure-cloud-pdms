---
tags: [fyp, design, use-cases, user-stories, agile]
status: complete
created: 2026-05-09
---

# User Stories — Secure Cloud PDMS

All 18 user stories, one per use case, following Agile format:  
**"As a [role], I want to [action], so that [benefit]."**

These feed into Chapter 4, Section 4.2.2 of the PSM1 report.

---

## Module 1 — Authentication & User Management

| ID | User Story | UC |
|----|------------|-----|
| US-01 | As a **Doctor**, **Admin**, or **Patient**, I want to log in with my username and password, so that I can securely access my role-specific dashboard without exposing any other user's data. | UC-01 |
| US-02 | As a **logged-in user**, I want to log out of the system, so that my session is terminated and my account is protected from unauthorised access on shared devices. | UC-02 |
| US-03 | As a **user**, I want the system to automatically lock my account after three consecutive failed login attempts, so that brute-force attacks on my credentials are prevented and the admin is alerted. | UC-03 |
| US-04 | As an **Admin**, I want to create new user accounts and assign each account a role, so that doctors, administrative staff, and patients can access the system with the correct permissions from their first login. | UC-04 |
| US-05 | As an **Admin**, I want to deactivate user accounts, so that former staff or inactive patients can no longer access the system and the security boundary remains intact. | UC-05 |

---

## Module 2 — Patient Registration & Profile Management

| ID | User Story | UC |
|----|------------|-----|
| US-06 | As an **Admin**, I want to register new patients with their demographic information and assign them a treating doctor, so that their clinical records can be managed securely within the system from the point of registration. | UC-06 |
| US-07 | As a **Doctor** or **Admin**, I want to view a patient's profile, so that I can review their personal details before providing care or scheduling an appointment. | UC-07 |
| US-08 | As an **Admin**, I want to update patient demographic information, so that the system always holds accurate and current patient details. | UC-08 |
| US-09 | As an **Admin**, I want to assign or reassign a treating doctor to a patient, so that the correct doctor has access to that patient's records and continuity of care is maintained when doctor assignments change. | UC-09 |

---

## Module 3 — Medical Records Management

| ID | User Story | UC |
|----|------------|-----|
| US-10 | As a **Doctor**, I want to create medical records for my assigned patients, so that I can document diagnoses, prescriptions, and clinical notes in a secure, auditable system that replaces paper-based record-keeping. | UC-10 |
| US-11 | As a **Doctor**, I want to view the medical records of my assigned patients, and as a **Patient**, I want to view my own medical records in read-only mode, so that clinical information is accessible to those authorised to see it and to no one else. | UC-11 |
| US-12 | As a **Doctor**, I want to update a medical record I created, so that I can correct or supplement clinical documentation after the initial consultation without creating a duplicate record. | UC-12 |
| US-13 | As a **Doctor**, I want to view the complete chronological medical history of my assigned patients, so that I can make informed clinical decisions based on prior diagnoses, prescriptions, and treatment outcomes. | UC-13 |

---

## Module 4 — Appointment Scheduling

| ID | User Story | UC |
|----|------------|-----|
| US-14 | As an **Admin**, I want to schedule appointments linking a patient to a doctor at a specific date and time, so that consultations are organised, conflict-free, and visible to all relevant parties. | UC-14 |
| US-15 | As a **Doctor**, I want to view my appointment schedule, so that I know which patients I will be seeing and when, allowing me to prepare for each consultation in advance. | UC-15 |
| US-16 | As a **Patient**, I want to view my upcoming appointments in read-only mode, so that I am informed of when and with whom my consultations are scheduled without being able to modify them. | UC-16 |
| US-17 | As an **Admin**, I want to update appointment details such as date, time, or assigned doctor, so that changes in availability or scheduling requirements are reflected accurately in the system. | UC-17 |
| US-18 | As an **Admin**, I want to cancel appointments, so that unavailable time slots are freed for rebooking and the appointment records remain accurate for audit purposes. | UC-18 |
