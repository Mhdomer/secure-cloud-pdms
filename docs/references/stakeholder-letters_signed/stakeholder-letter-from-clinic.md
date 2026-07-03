



**To:**
Mohamed Omar Makhlouf
Bachelor of Computer Science (Information Security)
School of Computing, Universiti Teknologi Malaysia
Johor Bahru, Malaysia

---

**Subject: Confirmation of System Requirements — Secure Patient Data Management System (PSM 1)**

Dear Mr. Mohamed Omar,

Thank you for your correspondence regarding your Final Year Project at Universiti Teknologi Malaysia. We are pleased to support your project and to provide this written confirmation of the system requirements discussed with our staff.

We confirm that as part of your requirements gathering process, you conducted discussions with the following members of our clinic:

- **Administrative Staff** — to understand the current patient registration and appointment management workflow
- **Clinic Management** — to understand the operational and security concerns following the data security incident in May 2023
- **Nursing Staff** — to understand the clinical workflow for patient record access and medical record documentation

Based on those discussions, we confirm that the following requirements accurately reflect the needs of Alamin Medical Clinic for a secure patient data management system:

**1. Role-Based Access Control**
The system must enforce strict role separation between three categories of users: Doctors, Administrative Staff, and Patients. Each user must have a unique, individual login — shared credential access is no longer acceptable. Staff must be restricted to only the data and functions relevant to their role.

**2. Patient Record Management**
Doctors should only be able to access and create medical records for patients directly assigned to them. Administrative staff should manage patient registration and appointments only, without access to clinical data. Patients should be able to view their own records in a read-only capacity.

**3. Appointment Scheduling**
The system must allow administrative staff to create, update, and cancel patient appointments. Doctors must be able to view their own daily and weekly schedule. Patients must be able to check their upcoming appointments.

**4. Audit Trail and Activity Logging**
All access to and modifications of patient records must be logged automatically, recording the user identity, the action taken, the affected record, and the timestamp. This log must not be editable or deletable by any user, including administrative staff. This is essential to enable forensic investigation in the event of any future security incident.

**5. Data Security and Encryption**
All patient data stored in the system must be encrypted. The system must perform regular automated backups and must be capable of full recovery in the event of a ransomware attack or system failure, with minimal downtime.

**6. Cloud-Based and Remote Access**
The system should be hosted securely in the cloud so that authorised staff can access it from any location without reliance on an on-site server that may be compromised.

We consider these requirements to be a correct and complete representation of the system needs as communicated to you during our discussions. We support this project and hope the proposed system will serve as a viable model for improving data security in clinics of similar scale.

Please do not hesitate to contact us if you require any further information.

Yours sincerely,
