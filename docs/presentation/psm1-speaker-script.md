# PSM 1 Viva — Speaker Script
**Project:** Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS
**Student:** Mohamed Omar Makhlouf | SECRH | UTM Johor Bahru
**Target duration:** 12–14 minutes · 14 slides

> **How to use this script:**
> Read it out loud several times before the viva. Do not memorise it word-for-word — understand it, then speak naturally. The timings are targets, not strict limits.

---

## SLIDE 1 — Title Slide
**⏱ Target: 30 seconds**

> *Stand, make eye contact with the panel, then begin.*

"Assalamualaikum and good morning to the panel. My name is Mohamed Omar Makhlouf, and I am a student from the SECRH programme here at Universiti Teknologi Malaysia, Johor Bahru.

Today I will be presenting my PSM 1 project, titled: *Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS.*

This project is at the analysis and design phase, and I will walk you through the problem, the proposed solution, and everything completed so far."

---

## SLIDE 2 — Chapter 1 | Introduction
**⏱ Target: 1 minute**

> *Point to each box as you describe it.*

"Let me begin with the context that motivated this project.

**The Clinic.**
Alamin Clinic is a private clinic in Saudi Arabia that was running a fully manual, server-based patient record system. All staff shared the same credentials — there was no access control, no encryption, and no backup policy.

**The Incident.**
In May 2023, the clinic suffered a ransomware attack. All patient data was encrypted and became completely inaccessible for five days. Records were permanently lost and operations were fully halted. Forensic investigation was impossible because there were no logs.

**This project proposes** a secure, three-tier cloud-based patient data management system on AWS that eliminates the three structural gaps exposed by that attack — through layered access control, a full audit trail, and Terraform-driven recovery."

---

## SLIDE 3 — Chapter 1.2 | Problem Statement
**⏱ Target: 1 minute**

> *Point to each card — left to right.*

"From the Alamin Clinic case study, I identified three root-cause gaps that directly define my objectives.

**P1 — No Role-Based Access Control.**
Shared credentials meant any staff member could access any patient record, regardless of their role. There was no isolation between doctors, admin, and patients.

**P2 — No Audit Trail.**
There was no logging of who accessed or modified records. After the ransomware attack, forensic investigation was completely impossible — there was nothing to trace.

**P3 — No Disaster Recovery.**
There was no backup, no infrastructure-as-code, and no documented recovery plan. Full recovery took five days, with permanent data loss.

Each of these three gaps maps directly to one of my four project objectives."

---

## SLIDE 4 — Chapter 1.3–1.4 | Project Aim and Objectives
**⏱ Target: 1 minute 30 seconds**

"Based on that problem analysis, I defined the following aim and four objectives.

**The aim** is to design and deploy a secure, three-tier cloud-based patient data management system on AWS that directly eliminates all three gaps identified from the Alamin Clinic ransomware case study.

**Objective 1** is to design a three-tier AWS VPC with isolated public, private application, and private database subnets.

**Objective 2** is to implement Role-Based Access Control enforced at three independent layers — JWT at the application level, AWS IAM at the infrastructure level, and PostgreSQL Row-Level Security at the database level.

**Objective 3** is to build a DevSecOps CI/CD pipeline with automated security gates — SonarQube for static code analysis, Trivy for container scanning, and Checkov for infrastructure scanning — each one blocking the pipeline on failure.

**Objective 4** is to achieve a ransomware recovery RTO of under 15 minutes using Terraform infrastructure-as-code. For reference, Alamin Clinic took five days."

---

## SLIDE 5 — Chapter 1.5 | Project Scope
**⏱ Target: 45 seconds**

"In terms of scope, the system supports three user roles.

Doctors can view and create medical records, but only for patients assigned to them. Admins manage patients, appointments, and user accounts — but have no access to clinical data at all. Patients can view their own records and appointments in read-only mode.

The system is deployed on AWS in the ap-southeast-1 Singapore region, which satisfies Malaysia's PDPA 2010 data residency requirements.

PSM 1 covers analysis and design. PSM 2, starting June 2026, covers implementation and testing.

Out of scope: mobile application, payment processing, and third-party EHR integration."

---

## SLIDE 6 — Chapter 2 | Literature Review and Existing Systems
**⏱ Target: 1 minute 30 seconds**

> *Reference each column in the table as you speak.*

"I reviewed three existing systems to understand what already exists and where the gaps are.

**OpenEMR** is the most widely used open-source electronic medical record system. It has basic role-based access, but no audit trail, and it is designed for on-premise deployment only. There is no infrastructure-as-code and no disaster recovery capability.

**Epic Systems** is an enterprise-grade platform used in large hospitals. It has strong RBAC and audit logging, but it runs on private cloud, uses proprietary disaster recovery tools, and has no DevSecOps pipeline.

**AWS Well-Architected Framework** provides cloud-native security guidance and CloudTrail for API logging, but it does not cover application-layer RBAC — that is left entirely to the developer.

**The research gap** is this: no existing system combines three-layer RBAC, a full DevSecOps CI/CD pipeline, and Terraform-based disaster recovery with an RTO under 15 minutes — all in a single cloud-native deployment suitable for Malaysian healthcare. That gap is exactly what this project fills."

---

## SLIDE 7 — Chapter 3 | Methodology
**⏱ Target: 1 minute 30 seconds**

"For methodology, I am using an Agile approach with DevSecOps integrated throughout.

I chose Agile over Waterfall because the security requirements were not fully clear at the start — they evolved through stakeholder interviews with the clinic's admin and clinical staff. Agile allows requirements to be refined iteratively across sprints.

DevSecOps is overlaid on top of Agile, meaning security scanning is automated at every pipeline stage — it is not added at the end as an afterthought.

The project is structured into five sprints.

Sprint 1 covered requirements elicitation and architecture design — this is where I conducted the two stakeholder interviews, identified 12 functional requirements and 11 non-functional requirements, and produced the VPC blueprint and database schema. Sprint 1 is complete. That is everything you will see for the rest of this presentation.

Sprints 2 through 5, which cover network deployment, application development, security integration, and testing, are all planned for PSM 2."

---

## SLIDE 8 — Chapter 4.3.1 | System Architecture — Three-Tier AWS VPC
**⏱ Target: 2 minutes**

> *Point to the architecture diagram on the right as you describe each tier.*

"This is the proposed system architecture — a three-tier deployment inside an AWS Virtual Private Cloud, which provides full network isolation between tiers.

**The Public Tier** is the only tier directly accessible from the internet. It contains the Application Load Balancer, which accepts only HTTPS traffic on port 443, and the NAT Gateway, which allows the private subnets to make outbound calls without being exposed directly.

**The Private Application Tier** sits behind the load balancer and is never reachable from the internet. This is where the Node.js Express REST API runs on EC2. The React frontend is served separately via Amazon S3 and CloudFront, which handles global delivery and caching.

**The Private Database Tier** is completely isolated. The RDS PostgreSQL instance only accepts connections from the application subnet's security group — nothing else can reach it. All data is encrypted at rest using AES-256, and Row-Level Security policies are active.

**Across all tiers**, there are four cross-cutting controls: Security Groups and Network ACLs enforce traffic rules at instance and subnet level. AWS IAM applies least-privilege roles to every service. CloudTrail logs every API call made in the account. And Terraform codifies the entire infrastructure, so recovery from a ransomware event is as simple as running one command from a clean AWS account."

---

## SLIDE 9 — Chapter 4.3–4.4 | System and Database Design
**⏱ Target: 1 minute 30 seconds**

"Moving into the system design, I will cover the use case model and the database design.

**Use Cases.** I identified 18 use cases across five functional modules — Authentication, Patient Management, Medical Records, Appointments, and Audit. There are three actors: Doctor, Admin, and Patient. Each actor can only trigger the use cases their role permits.

**Database Design.** The database consists of six PostgreSQL tables: users, patients, doctors, medical_records, appointments, and audit_log. All tables use UUID primary keys, which prevents sequential ID enumeration attacks.

The most critical design decision is Row-Level Security. On the medical_records table, an RLS policy ensures a doctor can only SELECT or UPDATE records where their doctor ID matches. This is enforced at the database engine level — even if the application layer is bypassed, the database itself will reject the query.

The audit_log table is append-only. It accepts only INSERT operations — no UPDATE, no DELETE. This means the forensic trail cannot be tampered with from the application side."

---

## SLIDE 10 — Chapter 4.2 + 4.5 | Security Design and DevSecOps Pipeline
**⏱ Target: 1 minute 30 seconds**

> *Point to each layer card, then to the pipeline flow.*

"The security design has two components — the three-layer RBAC model, and the DevSecOps pipeline.

**Layer 1 — JWT at the application layer.** Every request must carry a valid JSON Web Token stored in an httpOnly, Secure, SameSite=Strict cookie. The token contains the user's role, and all API endpoints validate both the token and the role. Passwords are hashed using bcrypt with a cost factor of 12.

**Layer 2 — AWS IAM at the infrastructure layer.** Each service has its own least-privilege IAM role. The EC2 instance cannot reach the RDS database directly through IAM — it must go through the application layer. The S3 bucket has public access blocked at the bucket policy level.

**Layer 3 — PostgreSQL RLS at the database layer.** This is the deepest layer. Even if both the application and IAM layers are bypassed, the database will reject any query that violates the Row-Level Security policy. Bypassing it requires a schema change.

**The DevSecOps pipeline** has six stages: Code Checkout, SonarQube SAST — blocks on CRITICAL, Docker Build, Trivy Image Scan — blocks on CRITICAL CVE, Checkov IaC Scan — blocks on HIGH or CRITICAL, and finally Terraform Apply — which only runs if all three scans pass. No manual deployment is ever allowed.

The HIPAA Section 164.312 compliance mapping is shown at the bottom of this slide."

---

## SLIDE 11 — Appendix E | Interface Wireframes — Role-Based Design
**⏱ Target: 1 minute**

"I designed four user-facing screens — one for each role plus the shared login.

**Figure E.1 — The Login Screen** is the single entry point for all three roles. After JWT validation, the system redirects each user to their role-specific dashboard. There is no self-registration — all accounts are created by the Admin only.

**Figure E.2 — The Doctor Dashboard** shows today's appointments and the doctor's assigned patient list. The New Record button only appears for patients assigned to that specific doctor.

**Figure E.3 — The Admin Dashboard** provides patient registration, appointment scheduling, and user management. Crucially, there is no clinical data visible anywhere in the Admin interface.

**Figure E.4 — The Patient Portal** is entirely read-only. The patient can view their own records and appointments, but there are no edit or delete controls anywhere on the screen.

The key principle here is that role isolation is enforced visually — each screen surfaces only what that role is permitted to access."

---

## SLIDE 12 — Chapter 4.9 | Evaluation Plan
**⏱ Target: 1 minute**

"Before I conclude, let me outline how the system will be evaluated in PSM 2.

There are five test categories.

**Functional testing** — test cases for all 18 use cases, covering both positive and negative scenarios, mapped against all 12 functional requirements.

**Security testing** — penetration testing to validate that the three-layer RBAC holds under attack, and to confirm that PostgreSQL RLS cannot be bypassed from the application layer.

**Pipeline testing** — confirming that each security gate correctly blocks the pipeline on CRITICAL findings, and that Terraform Apply only runs when all three scans pass.

**Recovery testing** — destroying the test environment completely, then running terraform apply and measuring the actual recovery time. The target is under 15 minutes.

**Compliance audit** — formal validation against HIPAA Section 164.312 and Malaysia's Personal Data Protection Act 2010.

All of these are planned for PSM 2. The system has not yet been implemented."

---

## SLIDE 13 — Chapter 5 | PSM 1 Achievements and PSM 2 Plan
**⏱ Target: 1 minute**

"Let me summarise what has been completed in PSM 1 and what is planned for PSM 2.

**PSM 1 — Completed.** I have completed the full analysis and design phase. This includes the ransomware root cause analysis of Alamin Clinic, two structured stakeholder interviews, 18 use cases, 12 functional requirements, 11 non-functional requirements, the three-tier AWS VPC architecture, the three-layer RBAC model, the six-stage DevSecOps pipeline design, the six-table database schema with Row-Level Security policies, four interface wireframes, and a full mapping to HIPAA Section 164.312 technical safeguards.

**PSM 2 — Planned, June to November 2026.** I will implement the full infrastructure using Terraform, build the Node.js backend and React frontend, activate JWT authentication and PostgreSQL RLS, and activate the full DevSecOps pipeline. The final sprint includes penetration testing, a formal security audit, and PDPA 2010 compliance review."

---

## SLIDE 14 — Thank You / Q&A
**⏱ Target: 30 seconds**

"To conclude —

This project proposes a secure, cloud-based patient data management system that directly eliminates all three critical gaps identified from the Alamin Clinic ransomware case study.

The three-layer RBAC ensures only the right person accesses the right data. The audit trail ensures every action is recorded and cannot be tampered with. And Terraform infrastructure-as-code ensures that if the worst happens, the entire system can be rebuilt in under 15 minutes — compared to the five days it took Alamin Clinic.

PSM 1 is complete. Implementation follows in PSM 2.

Thank you very much for your time. I am happy to answer any questions."

---

---

# EXAMINER Q&A — PREPARED ANSWERS

> Speak calmly. If you do not know an answer, say "That is a good question. In PSM 2, I plan to investigate that further." Do not guess.

---

**Q: Why AWS and not Azure or Google Cloud?**

"AWS was chosen for three reasons. First, AWS has the largest market share in Malaysian enterprise cloud, which means better local support and documentation. Second, the ap-southeast-1 region in Singapore satisfies Malaysia's PDPA 2010 data residency requirements for sensitive personal data. Third, the AWS Well-Architected Framework Healthcare Lens provides specific HIPAA guidance that is directly applicable to this project."

---

**Q: Why PostgreSQL and not MySQL?**

"PostgreSQL is the only open-source RDBMS that implements native Row-Level Security at the database engine level. MySQL does not have this feature — you would need to simulate it in the application layer, which is weaker because it can be bypassed if the application is compromised. Since RLS is central to my three-layer RBAC design, PostgreSQL was the natural choice."

---

**Q: How does your system handle a doctor being reassigned from a patient?**

"Use Case 9 covers this — the Admin updates the doctor_id foreign key on the patients table. As soon as that update is committed, the PostgreSQL RLS policy automatically takes effect. The previous doctor loses SELECT access to that patient's records immediately, with no application code change required. It is enforced at the database layer."

---

**Q: Is this HIPAA compliant?**

"The design maps to HIPAA Security Rule Section 164.312 technical safeguards. Specifically: access control through the three-layer RBAC maps to 164.312(a)(1), the audit trail maps to 164.312(b), encryption in transit and at rest maps to 164.312(e)(2) and 164.312(a)(2)(iv), and Terraform-based recovery maps to 164.312(a)(2)(ii) emergency access. A formal compliance audit will be conducted in PSM 2."

---

**Q: What happens if a pipeline scan fails?**

"The pipeline exits with a non-zero code at the failing stage. The Docker image is not pushed to ECR. Terraform Apply does not run. The AWS environment is not changed at all. The developer must fix the finding, commit the fix, and trigger a new pipeline run. This means no vulnerable code or misconfigured infrastructure can reach production — the security gate is mandatory, not optional."

---

**Q: How do you validate the RTO of under 15 minutes?**

"In PSM 2, I will conduct a formal recovery drill. I will destroy the test environment completely, then start a timer and run terraform apply from a clean AWS account. The timer stops when the system passes a health check — meaning the load balancer returns HTTP 200. I will repeat this three times and record the average. The 15-minute target is feasible because all infrastructure state is in Terraform code — there are no manual steps."

---

**Q: What is the difference between CloudTrail and your audit_log table?**

"CloudTrail operates at the AWS infrastructure level — it records every API call made to AWS services, such as who started or stopped an EC2 instance, who modified a security group, or who accessed an S3 bucket. The application audit_log table operates at the data level — it records every read and write operation on patient records, who did it, when, and which record was affected. Together they give two independent layers of audit — one for infrastructure actions and one for patient data operations."

---

*End of script.*
