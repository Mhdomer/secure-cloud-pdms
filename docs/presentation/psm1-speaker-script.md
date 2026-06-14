# PSM 1 Viva — Speaker Script
**Project:** Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS
**Student:** Mohamed Omar | SECRH | UTM Johor Bahru
**Target duration:** 12–14 minutes

> **How to use this script:**
> Read it out loud several times before the viva. Do not memorise it word-for-word — understand it, then speak naturally. The timings are targets, not strict limits.

---

## SLIDE 1 — Title Slide
**⏱ Target: 30 seconds**

> *Stand, make eye contact with the panel, then begin.*

"Assalamualaikum and good morning to the panel. My name is Mohamed Omar, and I am a student from the SECRH programme here at Universiti Teknologi Malaysia, Johor Bahru.

Today I will be presenting my PSM 1 project, titled: *Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS.*

This project is currently at the analysis and design phase, and I will walk you through the problem, my proposed solution, and everything I have completed so far."

---

## SLIDE 2 — Background & Problem Statement
**⏱ Target: 2 minutes**

> *Point to each box as you describe it.*

"Let me begin with the problem that motivated this project.

**Box 1 — The Clinic.**
Alamin Clinic is a private clinic in Saudi Arabia that was running a fully manual, server-based patient record system. There was no role-based access control — all staff used shared credentials. There was no encryption, no backup policy, and no audit trail.

**Box 2 — The Incident.**
In May 2023, the clinic suffered a ransomware attack. All patient data was encrypted and became completely inaccessible for five days. Records were permanently lost. The clinic's operations were fully halted.

---


**Box 3 — Root Cause.**
When I analysed the incident, I found three critical gaps. First, no role-based access control — any staff member could access any record. Second, no audit log — so after the attack, there was no way to investigate what happened or who was responsible. Third, no disaster recovery plan — no backup, no documented recovery procedure.

**Box 4 — Research Motivation.**
This project directly addresses all three gaps. I am proposing a secure, cloud-based replacement system that enforces role-based access at three independent layers, maintains a complete audit trail, and achieves infrastructure recovery in under 15 minutes using Terraform."

---

## SLIDE 3 — Aim, Objectives & Scope
**⏱ Target: 1 minute 30 seconds**

"Based on that problem analysis, I defined the following aim and four objectives.

**The aim** is to design and deploy a secure, three-tier AWS system that eliminates all three gaps identified from the Alamin Clinic case study.

**Objective 1** is to design a three-tier AWS VPC architecture with isolated public, private application, and private database subnets.

**Objective 2** is to implement Role-Based Access Control enforced at three independent layers — JWT at the application level, AWS IAM at the infrastructure level, and PostgreSQL Row-Level Security at the database level.

**Objective 3** is to build a DevSecOps CI/CD pipeline with automated security scanning at every stage — SonarQube for static analysis, Trivy for container scanning, and Checkov for infrastructure scanning.

**Objective 4** is to achieve a recovery time objective of under 15 minutes using Terraform infrastructure-as-code.

In terms of scope, the system supports three user roles: Doctor, Admin, and Patient. It is deployed on AWS, and it targets HIPAA Security Rule compliance. PSM 1 covers the design phase — implementation will follow in PSM 2."

---

## SLIDE 4 — Literature Review & Research Gap
**⏱ Target: 1 minute 30 seconds**

> *Reference each column as you speak.*

"I reviewed three existing systems and frameworks to understand what already exists and where the gaps are.

**OpenEMR** is the most widely used open-source electronic medical record system. It has basic role-based access, but no audit trail, and it is designed for on-premise deployment only. There is no infrastructure-as-code or disaster recovery capability.

**Epic Systems** is an enterprise-grade platform used in large hospitals. It has strong RBAC and audit logging, but it runs on private cloud infrastructure, uses proprietary disaster recovery tools, and has no DevSecOps pipeline.

**AWS Well-Architected Framework** provides cloud-native security guidance and CloudTrail for API logging, but it does not cover application-layer RBAC — it leaves that to the developer.

**The research gap** is this: no existing system combines three-layer RBAC enforcement, a full DevSecOps CI/CD pipeline, and Terraform-based disaster recovery with an RTO under 15 minutes — all in a single cloud-native deployment that is appropriate for a Malaysian clinic context. That gap is what this project fills."

---

## SLIDE 5 — Methodology
**⏱ Target: 1 minute 30 seconds**

"For methodology, I am using an Agile approach with DevSecOps integrated throughout.

I chose Agile over Waterfall because the security requirements were not fully clear at the start — they evolved through stakeholder interviews with the clinic's admin and clinical staff. Agile allows me to refine requirements iteratively across sprints.

DevSecOps is overlaid on top of Agile, meaning security scanning is automated at every pipeline stage — it is not added at the end as an afterthought.

The project is structured into **five sprints**.

Sprint 1 covered requirements elicitation and architecture design — this is where I conducted the stakeholder interviews, identified the 12 functional requirements and 11 non-functional requirements, and produced the VPC blueprint and database schema.

Sprint 2 will cover the network and database layer — deploying the VPC, RDS PostgreSQL, and IAM policies using Terraform.

Sprint 3 will cover the application layer — the Node.js backend, React frontend, and JWT authentication.

Sprints 4 and 5 cover security integration, testing, and final documentation.

Currently, I have completed Sprint 1 in full, which is everything you will see for the rest of this presentation."

---

## SLIDE 6 — System Architecture
**⏱ Target: 2 minutes**

> *Point to the architecture diagram on the left as you describe each tier.*

"This is the proposed system architecture. It is a three-tier deployment inside an AWS Virtual Private Cloud, which provides full network isolation between tiers.

**The Public Tier** is the only tier directly accessible from the internet. It contains the Application Load Balancer, which accepts only HTTPS traffic, and the NAT Gateway, which allows the private subnets to make outbound requests without exposing them directly.

**The Private Application Tier** sits behind the load balancer and is never directly reachable from the internet. This is where the Node.js Express REST API runs on EC2. The React frontend is served separately via Amazon S3 and CloudFront, which handles global delivery and caching efficiently.

**The Private Database Tier** is completely isolated. The RDS PostgreSQL instance only accepts connections from the application subnet's security group — nothing else can reach it. All data is encrypted at rest using AES-256.

**Across all tiers**, there are four cross-cutting security controls: Security Groups and Network ACLs enforce traffic rules at instance and subnet level respectively. AWS IAM applies least-privilege roles to every service. CloudTrail logs every API call made in the account. And Terraform codifies the entire infrastructure, so recovery from a ransomware event is as simple as running one command against a clean AWS account."

---

## SLIDE 7 — System Design
**⏱ Target: 1 minute 30 seconds**

"Moving into the system design, I will cover three components: the use case model, the entity-relationship diagram, and the database design.

**Use Cases.** I identified 18 use cases across five functional modules — Authentication, Patient Management, Medical Records, Appointments, and Audit. There are three actors: Doctor, Admin, and Patient. Each actor can only access the use cases their role permits.

**ER Diagram.** The database consists of six tables: users, patients, doctors, medical_records, appointments, and audit_log. All tables use UUID primary keys, which prevents sequential ID enumeration attacks.

**Database Design.** The most important design decision is Row-Level Security. On the medical_records table, a Row-Level Security policy ensures that a doctor can only SELECT or UPDATE records where their doctor ID matches. This is enforced at the database layer — even if the application layer is bypassed, the database will reject the query.

The audit_log table is append-only. It only accepts INSERT operations — no UPDATE, no DELETE. This means the forensic trail cannot be tampered with from the application side."

---

## SLIDE 8 — Interface Design
**⏱ Target: 1 minute**

"I designed four user-facing screens — one per role plus the shared login.

**The Login Screen** is the single entry point for all three roles. After JWT validation, the system redirects each user to their role-specific dashboard. There is no self-registration link — all accounts are created by the Admin only.

**The Doctor Dashboard** shows today's appointments and the doctor's assigned patient list. The New Record button only appears for patients assigned to that specific doctor — it is not visible for other patients.

**The Admin Dashboard** provides patient registration, appointment scheduling, and user management. Crucially, there is no clinical data visible anywhere in the Admin interface — the Admin can manage logistics but cannot read medical records.

**The Patient Portal** is entirely read-only. The patient can view their own records and appointments, but there are no edit or delete controls anywhere on the screen.

The wireframes for all four screens are provided in Appendix E of the report."

---

## SLIDE 9 — Security Design & DevSecOps Pipeline
**⏱ Target: 1 minute 30 seconds**

> *Point to each box as you explain.*

"The security design has two main components — the three-layer RBAC model, and the DevSecOps pipeline.

**Layer 1 — JWT at the application layer.** Every request must carry a valid JSON Web Token stored in an httpOnly, Secure, SameSite=Strict cookie. The token contains the user's role, and all API endpoints validate the token and the role before processing any request. Passwords are hashed using bcrypt with a cost factor of 12.

**Layer 2 — AWS IAM at the infrastructure layer.** Each service has its own least-privilege IAM role. The EC2 instance cannot reach the RDS database directly through IAM — it must go through the application layer. The S3 bucket has public access blocked at the bucket policy level.

**Layer 3 — PostgreSQL RLS at the database layer.** This is the deepest layer. Even if someone bypasses the application and IAM layers entirely, the database itself will reject any query that violates the Row-Level Security policy.

**The DevSecOps pipeline** has six stages. First, SonarQube scans the source code for security vulnerabilities — it blocks the pipeline on any critical finding. Then Docker builds the container image. Trivy scans the image for known CVEs and blocks on critical severity. Checkov scans the Terraform code for infrastructure misconfigurations and blocks on high or critical severity. Only if all three scans pass does Terraform Apply run and deploy to AWS. No manual deployment is ever allowed."

---

## SLIDE 10 — PSM 1 Achievements & PSM 2 Roadmap
**⏱ Target: 1 minute**

"Let me summarise what has been completed in PSM 1 and what is planned for PSM 2.

**PSM 1 — Completed.** I have completed the full analysis and design phase. This includes the ransomware root cause analysis, two structured stakeholder interviews, 18 use cases, 12 functional requirements, 11 non-functional requirements, the three-tier AWS architecture design, the three-layer RBAC model, the six-stage DevSecOps pipeline design, the database schema with Row-Level Security policies, four interface wireframes, and a full mapping of the design to the HIPAA Security Rule Section 164.312 technical safeguards.

**PSM 2 — Planned.** In PSM 2, I will implement all of this design using Terraform for the infrastructure, Node.js and React for the application, and activate the full DevSecOps pipeline. The final sprint will include penetration testing, a formal security audit, and a PDPA 2010 Malaysia compliance review.

The PSM 2 timeline runs from June to November 2026."

---

## SLIDE 11 — Conclusion & Thank You
**⏱ Target: 30 seconds**

"To conclude —

This project proposes a secure, cloud-based patient data management system that directly eliminates all three critical gaps identified from the Alamin Clinic ransomware case study.

The three-layer RBAC ensures that only the right person can access the right data. The audit trail ensures that every action is recorded and cannot be tampered with. And Terraform infrastructure-as-code ensures that if the worst happens — a ransomware attack — the entire system can be rebuilt in under 15 minutes, compared to the five days it took Alamin Clinic.

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
