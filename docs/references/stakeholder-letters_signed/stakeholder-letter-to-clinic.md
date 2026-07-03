# Letter — Mohamed Omar to Alamin Clinic
## Requirements Confirmation Request

---

**Mohamed Omar Makhlouf**
Bachelor of Computer Science (Information Security)
School of Computing, Universiti Teknologi Malaysia
Johor Bahru, Malaysia
Email: md.3omer@gmail.com

**Date:** [Insert date you send this]

---

**To:**
The Clinic Manager / Administration
Alamin Medical Clinic
Saudi Arabia

---

**Subject: Confirmation of Requirements for Academic Research — Secure Patient Data Management System**

Dear Sir / Madam,

I am a final year computer science student at Universiti Teknologi Malaysia (UTM), currently completing my Final Year Project (PSM 1) under the supervision of Mr. Johan Mohamed Sharif. My project is titled:

*"Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS"*

As part of my research, I conducted discussions with your clinic's administrative and clinical staff to understand the existing patient data management workflow and to gather the functional requirements for a proposed secure system. I am writing to formally request a written confirmation of the key requirements and system needs that were identified during our discussions, so that I may include this as documented evidence in my academic report.

Based on our discussions, the following requirements were identified:

**System Access and Security:**
- The system requires role-based access control separating three user roles: Doctor, Admin, and Patient
- Each user must have individual login credentials — shared credential access is not acceptable
- The system must prevent any staff member from accessing records outside their designated role
- Three failed login attempts should result in account lockout

**Patient Records:**
- Doctors must be able to view and create medical records only for patients assigned to them
- The admin must be able to register new patients and assign them to doctors
- Patients must be able to view their own medical history and upcoming appointments in read-only mode
- No staff member other than the treating doctor should be able to modify a patient's medical record

**Appointments:**
- The admin must be able to schedule, update, and cancel patient appointments
- Doctors must be able to view their own appointment schedule
- Patients must be able to view their upcoming appointments

**Audit and Security:**
- Every access and modification to patient records must be logged with a timestamp and user identity
- The audit log must not be editable or deletable by any user
- The system must be recoverable in the event of a cyber-attack or ransomware incident

**Data Storage:**
- All patient data must be stored securely and must be encrypted
- Regular automated backups must be in place
- The system should be accessible from anywhere without requiring on-premise infrastructure

These requirements were gathered to directly address the security gaps identified following the ransomware incident experienced by the clinic, which resulted in the loss of patient data and a significant disruption to clinical operations.

I kindly request that a representative of the clinic review the above requirements and provide a written confirmation — either by signing the attached reply template or by sending a brief official response on clinic letterhead — confirming that these requirements accurately reflect the clinic's needs.

Your support is greatly appreciated and will contribute significantly to the academic integrity of this research.

Thank you for your time and cooperation.

Yours sincerely,

**Mohamed Omar Makhlouf**
Student ID: A23CS4014
BSc Computer Science (SECRH)
Universiti Teknologi Malaysia, Johor Bahru
