
tags: [fyp, psm1, chapter-2, literature-review, case-study, alamin-clinic]
phase: 2
status: complete
created: 2026-05-01
updated: 2026-05-08
related: [[PHASES]], [[chapter-1-introduction]], [[chapter-3-methodology]]


# CHAPTER 2

## LITERATURE REVIEW

---

### 2.1 Introduction

The design of a secure cloud-based patient data management system requires grounding in several converging bodies of knowledge: the threat landscape facing healthcare information systems, the architectural principles that underpin modern cloud deployments, the regulatory frameworks governing patient data, and the DevSecOps practices that embed security into the software delivery lifecycle. This chapter surveys each of these areas systematically, moving from the specific context of the case study organisation to the broader technological and academic literature that informs the design decisions made in subsequent chapters.

Section 2.2 introduces the case study organisation — Alamin Clinic — examining its organisational structure, current manual system of operation, and the findings of an interview conducted with key clinic stakeholders. It further presents a side-by-side workflow analysis comparing the current system process against the proposed system process. Section 2.3 provides a structured analysis of the existing system's deficiencies using the 5W 1H problem framework. Section 2.4 compares the proposed system against representative existing healthcare management systems and explicitly identifies the features adopted from each. Section 2.5 reviews the core technologies employed in the proposed solution, supported by academic and industry literature. Section 2.6 summarises the key findings of the review.

---

### 2.2 Case Study: Alamin Clinic (Saudi Arabia)

Alamin Clinic is a private healthcare provider operating in Saudi Arabia. It serves as the primary stakeholder and case study for this project, providing a concrete operational context that shapes the system requirements, security constraints, and design priorities. The clinic's experience of a ransomware attack on its on-premise infrastructure is the central motivating incident for this project.

The clinic's patient population includes individuals seeking general medical consultations, follow-up appointments, and routine health record management. Its key user categories — doctors, administrative staff, and patients — each interact with the patient data system in distinct ways, with correspondingly distinct access and security requirements. This diversity of roles makes the design of a Role-Based Access Control (RBAC) model a fundamental requirement of the proposed system.

#### 2.2.1 Organisation Structure

Alamin Clinic operates with a three-tier organisational hierarchy that broadly mirrors the structure of most small private healthcare providers in the region.

At the clinical level, the clinic employs a team of general practitioners and specialist physicians who are responsible for patient consultation, diagnosis, and the creation and maintenance of medical records. Doctors require read and write access to patient records assigned to their care, but should have no access to administrative data such as billing accounts or staff payroll.

At the administrative level, a team of administrative staff manages patient registration, appointment scheduling, and general clinic operations. Administrative staff require access to appointment and registration data but should not have access to clinical record content — a separation of concerns that is critical for patient privacy and that the proposed IAM policy structure enforces explicitly.

At the patient level, registered patients interact with the system to view their own medical records and upcoming appointments. Patient access is strictly read-only and scoped to their own records, with no visibility into other patients' data or any administrative information.

Supporting these three operational tiers, the clinic maintains a minimal IT function that, prior to the proposed migration, consisted of a single on-premise server maintained by IT staff without a formal security policy or patch management process. This IT limitation is the root cause of the vulnerability that the proposed cloud migration addresses.

The organizational structure is illustrated in Figure 2.1.

> 📎 **ATTACH:** `Figure 2.1` — Alamin Clinic Organisational Structure. Hierarchical org chart: Top box — Clinic Director. Second level (three boxes): Clinical Department (Doctors) | Administrative Department (Admin Staff) | IT Department (Server Admin). Third level under Clinical: Patients. Third level under Administrative: Patient Registration, Appointment Scheduling.

#### 2.2.2 Manual Operation

Prior to the proposed system, Alamin Clinic managed its patient data through a conventional on-premise workflow that can be characterised by four defining characteristics: manual server configuration, manual deployment, local hosting, and reactive security.

**Manual Server Configuration.** The clinic's physical server is set up and maintained by IT staff on-site. Configuration is performed manually, without version-controlled infrastructure definitions or automated provisioning. This approach is inherently error-prone: configuration drift occurs over time as individual changes are applied without documentation, and there is no reliable mechanism to reproduce a clean server state in the event of failure (Paidy & Chaganti, 2024).

**Manual Deployment.** Application code is transferred from the development environment to the production server manually, using either an FTP client or physical media such as a USB drive. This approach introduces significant delays between development and deployment, removes any automated quality or security gate from the deployment process, and creates a direct pathway for compromised or untested code to reach the production environment.

**Local Hosting.** The web frontend, application backend, and patient database are co-hosted on a single physical server. There is no network segmentation between these components: a compromise of any one layer provides immediate access to all others. This flat network architecture is identified in the literature as a primary enabler of ransomware propagation within healthcare systems, as it allows malicious software to traverse from an internet-exposed entry point directly to the database layer without encountering any internal network boundary (Argaw et al., 2019).

**Reactive Security.** Firewall rules and antivirus definitions are updated manually by IT staff in response to known threats, rather than on a systematic schedule. This reactive posture means that the clinic's defences are perpetually behind the current threat landscape. Patches for known vulnerabilities are applied late or inconsistently, leaving windows of exposure that sophisticated attackers — and increasingly, automated ransomware campaigns — routinely exploit.

The cumulative effect of these four characteristics was demonstrated when the clinic's system was compromised by a ransomware attack. Attackers encrypted the entire patient database, rendering all clinical records inaccessible and halting clinic operations. The incident confirmed that the existing architecture contained no meaningful barrier between an attacker's initial foothold and the clinic's most sensitive data.

#### 2.2.3 Interview with Clinic Stakeholders

To gather firsthand information about the clinic's operational challenges and system deficiencies, structured interviews were conducted with two key stakeholders at Alamin Clinic: an Administrative Staff member responsible for patient registration and appointment management, and a Clinical Staff member involved in day-to-day clinic operations. The interviews were conducted remotely via video call. In accordance with participants' privacy preferences, audio recording was not carried out; detailed notes were taken by the researcher during each session. The interview instrument comprised eight open-ended questions focused on current system usage patterns, pain points, the ransomware incident experience, and desired improvements.

**Interview Instrument**

The following questions were used to guide each interview:

1. How do you currently access and manage patient records on a daily basis?
2. What are the most significant difficulties you face when using the current system?
3. How was the ransomware incident discovered, and what was the immediate impact on your work?
4. How long was the clinic unable to access patient records, and how was this period managed?
5. What data was lost or inaccessible as a result of the attack?
6. Were there any security policies or backup procedures in place at the time of the incident?
7. What features of a new system would most improve your day-to-day work?
8. What security or privacy concerns do you have about moving patient data to a cloud system?

**Interview Findings**

The responses from the two stakeholder interviews are summarised in Table 2.1.

**Table 2.1** — Summary of Stakeholder Interview Findings

| Question Theme             | Administrative Staff                                                                                                                                                                                                                                                                                                                                                           | Clinical Staff                                                                                                                                                                                                                                                                | System Design Implication                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily system access        | Each user holds an individual login for a third-party desktop application managed by an external vendor. Remote access exists through a separate linked application but is limited in functionality and scope.                                                                                                                                                                 | Access is through the same vendor-provided desktop application. System operations and maintenance are handled entirely by the external provider; the clinic has no in-house IT capability to intervene or diagnose issues.                                                    | A web-based interface replaces the desktop application, so users can log in from any browser without installing anything. Remote access is supported by default, not added as a workaround.                                                                                                                                                         |
| Main difficulties          | The system assigns no unique patient identifier, causing data duplication when the same patient registers more than once. Insurance billing processing is slow compared to purpose-built billing tools. Appointment notifications are tracked manually in a separate Excel spreadsheet, creating a disconnected workflow with no integration into the main system.             | Receptionists enter patient names inconsistently, compounding the duplication problem — multiple records exist for the same individual under different name variations. The server and application are maintained manually with no automated monitoring or alerting in place. | Each patient is assigned a UUID at registration, enforced as the primary key at the database level — duplicate records cannot form. Appointment scheduling is built directly into the system, removing the Excel dependency. CloudWatch monitors the system and raises alerts automatically.                                                        |
| Ransomware discovery       | The attack rendered all data completely inaccessible with no read, write, or modify operations possible. Business operations halted immediately. Paper forms were used as an emergency fallback for patient registration.                                                                                                                                                      | All clinic departments froze simultaneously. Doctors could not access any patient files. All appointments were cancelled. The clinic came to a complete operational standstill with no means of continuing patient care.                                                      | The database sits in a private subnet with no internet route. Even if the web layer is breached, an attacker cannot reach the database directly — each tier has its own security group and Network ACL rules that block cross-tier traffic.                                                                                                         |
| Downtime duration          | Approximately 72 hours of complete system blackout. When restoration was attempted, the recovered data was found to be incomplete or corrupted — effectively as though it had never existed.                                                                                                                                                                                   | Full operational recovery took approximately 5 days, during which a significant backlog of patient appointments accumulated. Clinical operations could not resume until data access was partially restored.                                                                   | The full infrastructure is written in Terraform and can be rebuilt from a clean AWS account in under 15 minutes. RDS snapshots handle data recovery separately, so the infrastructure and the data can be restored independently of each other.                                                                                                     |
| Data lost                  | All patient data was rendered inaccessible. The recovery attempt failed to produce a usable restore; records from the period preceding the attack were permanently lost with no clean backup to fall back on.                                                                                                                                                                  | Appointment records and patient files from the weeks prior to the attack were unrecoverable. Medical record access remained unavailable throughout the recovery window.                                                                                                       | Daily RDS snapshots allow recovery to any point within the retention window. A standby replica runs in a second Availability Zone and promotes automatically if the primary fails — there is no single point of failure as there was in the on-premise setup.                                                                                       |
| Security measures in place | Basic antivirus software with manual updates was present; no formal backup policy existed. Security measures were reactive and undocumented, with no evidence of scheduled review or testing.                                                                                                                                                                                  | No formal security policy had been communicated to operational staff. No awareness of any backup or recovery procedure existed at the staff level, indicating a systemic procedural gap beyond the technical deficiency.                                                      | Security Hub continuously checks the environment against HIPAA controls and raises findings when configuration drifts. All security configuration — IAM policies, security groups, encryption keys — is stored in Terraform, so it is version-controlled and auditable rather than informal and undocumented.                                       |
| Desired improvements       | A modern web-based interface to replace the outdated desktop application. An automated appointment notification system integrated into the platform. Remote access to patient records from outside the clinic. Automated backup and recovery. Clean patient registration with unique identification. A public-facing clinic website for promotions and department information. | Department-specific modules for clinical departments including specialist areas. Automated workflows to reduce manual data entry. Faster system performance and simplified access for clinical staff during consultations.                                                    | A React web interface with role-based dashboards replaces the desktop application — each user only sees the screens relevant to their role. Patient UUIDs enforce clean registration from the first visit. The public-facing website and specialist department modules fall outside the current scope and are noted for future development.         |
| Cloud migration concerns   | Data sovereignty and the reliability of internet connectivity in the clinic's operating region were identified as the primary concerns around moving to a cloud environment.                                                                                                                                                                                                   | Patient data privacy and clarity on access control in a cloud environment were the main concerns. Ease of use and the training requirements for staff transitioning from a familiar desktop application were also raised.                                                     | Data is hosted in the AWS Singapore region. Row-level security at the database means each user can only read records they are authorised for — even with infrastructure-level access, one user cannot see another patient's data. The role-based interface limits what appears on screen, which also reduces the training needed during onboarding. |

The interview findings corroborate the four operational deficiencies identified in Section 2.2.2, and surface three additional dimensions not captured by technical analysis alone. First, the human cost of the attack: five days of complete operational disruption, permanent data loss, and a clinical standstill that affected every department simultaneously. Second, a procedural gap: no security policy or backup procedure had been communicated to operational staff, meaning the deficiency extends beyond the technical architecture into organisational practice. Third, a data quality problem: the absence of unique patient identifiers causes duplicate records to accumulate over time, which compounds the recovery challenge — when records cannot be reliably attributed to a single patient, data restoration becomes an additional problem on top of the infrastructure failure.

These findings collectively inform the system requirements and design decisions developed in the chapters that follow.

#### 2.2.4 Current System Workflow

The current patient data management workflow at Alamin Clinic is entirely manual and unautomated. Figure 2.2 presents the flowchart of the current system's primary patient record management process, from patient arrival through to record storage.

> 📎 **ATTACH:** `Figure 2.2` — Current System Workflow Flowchart. Draw a top-to-bottom flowchart with the following steps and decision points:
> START → Patient Arrives at Clinic → Admin checks paper register: [Patient registered? YES/NO] → If NO: Admin manually types patient details into desktop application → If YES: Admin searches for patient record → Doctor called → Doctor opens application on clinic desktop → Doctor retrieves patient record (if accessible) → Doctor writes consultation notes on paper → After consultation: Admin types doctor's notes into system → Data saved to local server (single flat file store) → [Backup performed? NO → END (data at risk)] → END. 
> Highlight risk points in red: "Single flat server — no isolation", "Manual typing — error prone", "No backup policy". Use standard flowchart symbols: rounded rectangles for start/end, rectangles for process, diamonds for decisions.

The current workflow reveals five critical process vulnerabilities. First, all data entry is performed manually by administrative staff, introducing transcription errors and delays. Second, there is no separation between the application accessing the data and the database storing it — they share the same server process and file system. Third, there is no authentication differentiation between roles: the same application login is used by both doctors and administrative staff, with role enforcement relying solely on trust. Fourth, the workflow has no automated backup step — data persistence depends entirely on the physical server remaining operational. Fifth, there is no audit record of who accessed or modified which patient record.

#### 2.2.5 Proposed System Workflow

The proposed system replaces each manual, insecure step in the current workflow with an automated, security-enforced equivalent. Figure 2.3 presents the flowchart of the proposed system's patient record management process.

> 📎 **ATTACH:** `Figure 2.3` — Proposed System Workflow Flowchart. Draw a top-to-bottom flowchart with the following steps:
> START → User opens browser → HTTPS login page (TLS encrypted) → [Credentials valid? YES/NO] → If NO: Login failed, attempt logged → [3 failed attempts? YES → Account locked, Admin notified] → If YES: JWT token issued with role → [Role? ADMIN / DOCTOR / PATIENT] →
> ADMIN path: Admin Dashboard → Register patient / Schedule appointment → Data written to encrypted RDS → Audit log entry created → END
> DOCTOR path: Doctor Dashboard → Select assigned patient → View/Create medical record → RLS verifies doctor owns record → Data written to encrypted RDS → Audit log entry created → END
> PATIENT path: Patient Portal → View own records (read-only) → RLS filters to own records only → END
> Add annotation boxes: "KMS encrypts all data at rest", "TLS encrypts all data in transit", "CloudTrail logs all API calls", "GitHub Actions scans every deployment". Use colour coding: green for security controls, blue for process steps.

The proposed workflow eliminates each of the five vulnerabilities identified in the current process. Manual data entry is replaced by a structured web interface with input validation. The flat server architecture is replaced by a three-tier VPC in which the database is physically isolated in a private subnet with no internet access path. Role enforcement is replaced by JWT-based authentication combined with PostgreSQL row-level security, which enforces data access boundaries at both the application and database layers. Backup dependency on physical hardware is replaced by automated RDS snapshots and Terraform-based infrastructure redeployment. The absence of audit records is replaced by CloudTrail API logging and an application-level audit log table that records every data access event.

Table 2.2 presents a side-by-side comparison of the current and proposed workflows across the five identified vulnerability dimensions.

**Table 2.2** — Current Workflow vs Proposed Workflow

| Dimension           | Current System                                   | Proposed System                                              |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Data entry          | Manual typing by admin, error-prone              | Structured web forms with validation                         |
| Architecture        | Single flat server, all tiers co-hosted          | Three-tier VPC — presentation, app, DB isolated              |
| Authentication      | Single shared login, trust-based role separation | JWT tokens + RBAC enforced at application and DB layers      |
| Backup and recovery | No backup policy; full data loss risk            | Automated RDS snapshots + Terraform redeploy in < 15 min     |
| Audit trail         | None                                             | CloudTrail API logs + application audit_log table            |
| Deployment          | Manual FTP/USB, no security gate                 | GitHub Actions CI/CD with Trivy, SonarQube, Checkov blocking |
| Encryption          | None at rest; inconsistent in transit            | KMS AES-256 at rest; TLS 1.2+ in transit                     |

---

### 2.3 Current System Analysis

#### 2.3.1 Problem Analysis Using the 5W 1H Framework

The 5W 1H framework — Who, What, When, Where, Why, and How — provides a structured approach to problem decomposition that ensures all dimensions of the issue are addressed before a solution is designed. Table 2.3 applies this framework to the Alamin Clinic problem.

**Table 2.3** — 5W 1H Problem Analysis

| Dimension                              | Analysis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who** is affected?                   | Doctors cannot access patient records or create diagnoses. Administrative staff cannot manage appointments or registrations. Patients cannot receive care during outages. IT staff have no tools to detect, contain, or recover from an attack. The clinic director faces operational, reputational, and potential legal liability for patient data loss.                                                                                                                                                                                                                                                                                                           |
| **What** is the problem?               | A ransomware attack encrypted the entire patient database on the clinic's on-premise server. All patient records, appointment data, and medical histories were rendered inaccessible. The clinic had no recovery capability and no backup to restore from. Beyond the immediate incident, the systemic problem is an infrastructure designed without security controls at any layer.                                                                                                                                                                                                                                                                                |
| **When** does the vulnerability exist? | At all times. The server is internet-exposed with no isolation layer. Patches are applied reactively, so known vulnerabilities remain open for extended periods. Every FTP deployment is an opportunity to introduce compromised code. The absence of monitoring means attacks are not detected until their impact is already severe.                                                                                                                                                                                                                                                                                                                               |
| **Where** does the problem originate?  | In the flat network architecture of the on-premise server, which provides no barrier to lateral movement. In the absence of network segmentation between the web, application, and database layers. In the manual, undocumented configuration process that creates undetected drift. In the absence of any formal data protection or recovery policy.                                                                                                                                                                                                                                                                                                               |
| **Why** does the problem persist?      | Small private healthcare providers lack the budget for enterprise security platforms and the IT staffing to implement manual security controls consistently. The gap between the cost of doing security well (enterprise tools) and the cost of doing it manually (under-resourced IT staff) has no current solution at accessible cost. This is the fundamental market gap that the proposed system addresses.                                                                                                                                                                                                                                                     |
| **How** will it be solved?             | Through a security-by-design cloud architecture that automates the controls that manual maintenance consistently fails to sustain: (1) Three-tier VPC network isolation eliminates flat network risk. (2) Terraform IaC eliminates manual configuration drift and enables redeployment in minutes. (3) DevSecOps pipeline with Trivy, SonarQube, and Checkov blocks vulnerable code before it reaches production. (4) IAM/RBAC with PostgreSQL row-level security enforces access control at three independent layers. (5) KMS encryption protects data at rest; TLS protects data in transit. (6) AWS Security Hub measures HIPAA compliance posture continuously. |

#### 2.3.2 Security Domain Analysis

A structured analysis of the Alamin Clinic system prior to the proposed migration reveals deficiencies across four security domains: network architecture, access control, data protection, and operational resilience.

**Network Architecture.** The clinic's server hosts all three application tiers — web, application, and database — on a single machine with a single network interface. There are no internal network boundaries, no demilitarised zone (DMZ) for internet-facing components, and no mechanism to restrict lateral movement once an attacker has gained initial access. This architecture directly contradicts the principle of defence in depth, which requires that multiple independent security controls exist such that the failure of any single control does not result in a complete compromise (Al-Issa et al., 2019).

**Access Control.** User access to the system is managed through a single application-level authentication mechanism with no integration of identity management at the infrastructure level. Role distinctions between doctors, administrative staff, and patients exist within the application code but are not enforced at the network or storage layer. An attacker with access to the underlying server is therefore not constrained by these application-level controls.

**Data Protection.** Patient records stored in the clinic's database are not encrypted at rest. Data transmitted between the user's browser and the server is not consistently protected with TLS, as the clinic's HTTP configuration has not been systematically reviewed. This means that both stored data and data in transit are exposed to interception and exfiltration in addition to the ransomware encryption threat.

**Operational Resilience.** The clinic maintains no formal backup policy for its database. No tested recovery procedure exists. When the ransomware attack encrypted the database, the clinic had no clean backup to restore from, and no documented process to guide recovery. This absence of resilience planning is consistent with findings across the small healthcare provider sector: Argaw et al. (2019) identified the lack of backup and recovery planning as a consistent factor in cases where ransomware attacks caused prolonged operational disruption.

Taken together, these deficiencies indicate that the existing system does not meet the minimum security requirements for a healthcare information system, and that a fundamental architectural redesign — rather than incremental patching — is required to bring the clinic's patient data management to an acceptable security posture.

---

### 2.4 Comparison between Existing Systems

To contextualise the proposed system within the landscape of existing healthcare management solutions, Table 2.4 presents a structured comparison of four representative systems: a traditional on-premise Hospital Management System (HMS), OpenEMR (an open-source solution), Epic Systems (a leading commercial platform), and the proposed Secure Cloud PDMS.

**Table 2.4** — Comparison of Existing Healthcare Management Systems

| System                              | Key Features                                                             | Security Model                                                                         | Main Limitations                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Traditional On-Premise HMS          | Full data control, no internet dependency, customisable                  | Reactive — manual patches, perimeter-only firewall                                     | High ransomware risk, hardware maintenance cost, no network isolation, poor scalability |
| OpenEMR (Open Source)               | Patient portal, appointment scheduling, billing, EHR                     | Reactive — community patches, server-dependent                                         | Requires self-managed server, manual security updates, no automated deployment          |
| Epic Systems (Commercial)           | Comprehensive clinical suite, professional support, HL7/FHIR integration | Proactive — vendor-managed updates, enterprise IAM                                     | Prohibitive licensing cost for small clinics, complex deployment, vendor lock-in        |
| **Proposed System (Alamin Clinic)** | Patient records, appointment scheduling, role-based access, cloud-native | Proactive, shift-left — automated scanning, IAM/RBAC, encrypted at rest and in transit | Focused on infrastructure security; billing and pharmacy modules are out of scope       |

The comparison reveals a clear gap in the market for small healthcare providers. Traditional on-premise systems and open-source alternatives like OpenEMR offer flexibility but place the full burden of security management on the clinic's IT staff — a burden that Alamin Clinic's experience has shown to be unsustainable in practice. Commercial solutions like Epic Systems provide robust security but at a cost and complexity level that is inaccessible to small private providers.

The proposed system addresses this gap by combining the cost accessibility of a self-managed cloud deployment with the security automation capabilities previously available only to enterprise-grade commercial platforms. By encoding the infrastructure in Terraform and integrating security scanning into the CI/CD pipeline, the system reduces the dependency on manual IT operations that is the fundamental vulnerability of the clinic's current approach.

#### 2.4.1 Features Adopted from Existing Systems

The comparison in Table 2.4 informed a deliberate selection of features from existing systems that are appropriate for the proposed solution's scope and security objectives. Table 2.5 identifies the features adopted from each existing system, their source justification, and the adaptation made for the proposed system.

**Table 2.5** — Features Adopted from Existing Systems

| Feature                                      | Adopted From | Justification                                                                                                                                   | Adaptation in Proposed System                                                                                               |
| -------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Patient registration and record management   | OpenEMR      | Core clinical workflow requirement confirmed by stakeholder interviews; directly addresses the data loss experienced in the ransomware incident | Implemented with PostgreSQL RLS enforcement — records are accessible only to the assigned doctor and the patient themselves |
| Appointment scheduling                       | OpenEMR      | Operational necessity confirmed by admin staff interview; appointment data was among the most disruptive data lost                              | Implemented with role-restricted access — only admin can create/modify; doctors and patients can view                       |
| Patient portal (self-service record viewing) | OpenEMR      | Addresses patient autonomy requirement; reduces administrative load on clinic staff                                                             | Implemented as strictly read-only; no self-registration — all accounts created by admin only                                |
| Role-Based Access Control model              | Epic Systems | Enterprise-grade access control pattern validated for healthcare environments by Singh & Chatterjee (2015)                                      | Implemented at three layers: JWT tokens (application), AWS IAM policies (infrastructure), PostgreSQL RLS (database)         |
| Audit logging of data access                 | Epic Systems | HIPAA Security Rule requirement; absence of audit trail was a key finding from the clinic's incident review                                     | Implemented through two independent mechanisms: AWS CloudTrail (API level) and application audit_log table (data level)     |
| HIPAA compliance framework                   | Epic Systems | Internationally recognised benchmark for healthcare data security; adopted as the primary compliance measurement standard                       | Measured continuously via AWS Security Hub HIPAA standard rather than point-in-time audit                                   |

Features explicitly **not adopted** from existing systems include: hospital billing and insurance management (OpenEMR, Epic), pharmacy inventory and dispensing (Epic), emergency room management (Epic), and HL7/FHIR integration (Epic). These are excluded from the proposed system's scope to maintain focus on the core security architecture. Their exclusion is justified in Chapter 1, Section 1.5 (Project Scope).

A further distinguishing characteristic of the proposed system is its comparison against the standard AWS architecture pattern. Table 2.6 contrasts the typical approach to AWS deployment against the proposed security-hardened configuration.

**Table 2.6** — Proposed System vs Standard AWS Architecture

| Feature              | Standard AWS Architecture | Proposed Solution                                    |
| -------------------- | ------------------------- | ---------------------------------------------------- |
| Deployment           | Manual or basic scripts   | Fully automated via Terraform IaC                    |
| Security model       | Added after build         | Shift-left — scanned at every CI/CD stage            |
| Post-attack recovery | Long manual rebuild       | Instant redeployment from Terraform state            |
| Data protection      | Basic private subnets     | Hardened Network ACLs + Private RDS + KMS encryption |
| Compliance           | Ad hoc                    | HIPAA posture measured via AWS Security Hub          |

---

### 2.5 Literature Review of Technology Used

#### 2.5.1 Cloud Computing in Healthcare

The adoption of cloud computing in healthcare has been the subject of sustained academic interest since the early 2010s. Ahuja et al. (2012) provided one of the earliest systematic surveys of cloud computing in healthcare, identifying cost reduction, scalability, and improved data accessibility as the primary drivers of adoption, while flagging data security, regulatory compliance, and vendor reliability as the principal barriers. These findings remain relevant: the specific security concerns identified by Ahuja et al. — particularly around data sovereignty and access control — directly inform the design of the proposed system's IAM policy structure and data residency choices.

Al-Issa et al. (2019) extended this analysis with a focus on security challenges specific to eHealth cloud deployments. Their survey identified unauthorised data access, data integrity violations, and service availability failures as the three dominant threat categories. Each of these threats maps directly to a design requirement of the proposed system: unauthorised access is addressed through IAM/RBAC; integrity is protected through CloudTrail audit logging and KMS encryption; and availability is ensured through the multi-AZ deployment and Terraform-based rapid recovery capability.

The concerns raised by clinic stakeholders regarding cloud data sovereignty and privacy — captured in the Section 2.2.3 interviews — are directly addressed by the proposed system's AWS region selection (ap-southeast-1, Singapore, subject to PDPA-compliant data residency), IAM least-privilege policies, and the PostgreSQL row-level security model that ensures no user can access another's data regardless of infrastructure-level access.

#### 2.5.2 Three-Tier Architecture

The three-tier architectural pattern separates a web application into three physically and logically distinct layers: the presentation tier (frontend), the application tier (business logic), and the data tier (database). This separation provides two primary security benefits: it limits the blast radius of a compromise at any single tier, and it enables independent scaling and access control policies to be applied to each layer.

In the context of the proposed system, the three-tier model is implemented within an AWS Virtual Private Cloud, with the presentation tier served through an Application Load Balancer in a public subnet, the application tier running on EC2 instances in a private application subnet, and the database tier hosted on Amazon RDS in an isolated private database subnet. This configuration ensures that the database is never directly reachable from the internet — a direct architectural countermeasure to the network flatness that enabled the ransomware attack at Alamin Clinic.

The contrast with the current system's workflow (Section 2.2.4) is explicit: the current system's single-server flat architecture provides zero lateral movement barriers; the proposed three-tier VPC provides three independent tiers each with distinct security group policies, and the database tier has no outbound internet route.

#### 2.5.3 AWS and the Shared Responsibility Model

Amazon Web Services operates under a shared responsibility model that defines the division of security obligations between the cloud provider and the customer. AWS states explicitly:

> "AWS manages security *of* the cloud, you are responsible for security *in* the cloud."

Under this model, AWS is responsible for the physical security of data centres, the hypervisor layer, and the managed service infrastructure. The customer — in this case, the clinic — is responsible for operating system configuration, network security group rules, IAM policy design, application security, and data encryption.

This distinction is critical to the proposed system's design rationale. The shift from an on-premise model to AWS does not eliminate the clinic's security responsibilities; it redistributes them. Importantly, it replaces responsibilities that Alamin Clinic was consistently failing to meet manually (server patching, encryption, access control) with responsibilities that can be met through automated tools (Terraform, KMS, IAM policies) that do not depend on individual IT staff action.

#### 2.5.4 Infrastructure as Code (Terraform)

Infrastructure as Code (IaC) is the practice of defining and provisioning computing infrastructure through machine-readable configuration files rather than through manual processes. Paidy and Chaganti (2024) demonstrated that IaC significantly reduces configuration drift and enables faster, more reliable recovery from infrastructure failures in multi-region AWS deployments — findings directly applicable to the proposed system's self-healing recovery capability.

Terraform, developed by HashiCorp, is the IaC tool selected for this project. Terraform's declarative configuration model allows the entire VPC network topology, EC2 instance configurations, RDS parameter groups, IAM policies, and security group rules to be expressed as version-controlled code. This means that the complete environment can be destroyed and redeployed from a clean state in a matter of minutes — a capability that converts the Recovery Time Objective from an open-ended manual process into a measurable, testable metric.

This directly addresses the most critical finding from the stakeholder interview: when the IT Administrator was asked how long the recovery from the ransomware attack took, the answer was five days. The proposed system's target RTO is under fifteen minutes, achievable specifically because the infrastructure state is encoded in Terraform and can be applied to a clean AWS account with a single command.

Checkov, a static analysis tool for IaC, is integrated into the CI/CD pipeline to scan Terraform configurations for security misconfigurations before they are applied. This prevents common infrastructure security mistakes — such as overly permissive security group rules or unencrypted storage volumes — from reaching the production environment.

#### 2.5.5 DevSecOps and Shift-Left Security

DevSecOps is the practice of integrating security testing and validation throughout the software development and delivery lifecycle, rather than applying it as a final gate before production deployment. The "shift-left" principle refers to moving security checks earlier in the pipeline — towards the development phase — so that vulnerabilities are identified and remediated at the lowest possible cost, before they accumulate into the production codebase (Paidy & Chaganti, 2024).

The current system's deployment workflow (Section 2.2.4) has no security gate at any stage: code is transferred to the production server via FTP without any automated validation. The proposed system replaces this with a GitHub Actions CI/CD pipeline that executes three categories of security scan on every code commit:

- **Trivy** scans Docker container images for known Common Vulnerabilities and Exposures (CVEs) before any image is pushed to the container registry.
- **SonarQube** performs Static Application Security Testing (SAST), analysing the application source code for security anti-patterns, injection vulnerabilities, and code quality issues.
- **Checkov** analyses Terraform configuration files for infrastructure-level security misconfigurations.

A pipeline failure on any critical finding blocks the deployment, ensuring that no code with a known critical vulnerability can reach the production environment. This shift from zero security gates (current) to three automated blocking gates (proposed) directly addresses the reactive security posture identified in Section 2.2.2.

#### 2.5.6 Identity and Access Management and Role-Based Access Control

Identity and Access Management (IAM) is the set of policies, processes, and technologies that control who can access which resources in a system. In the AWS context, IAM provides fine-grained, policy-driven access control at the infrastructure level, complementing the application-level RBAC model.

Singh and Chatterjee (2015) established that multi-tier authentication in cloud environments requires security enforcement at multiple layers — not just at the application login screen but at the network and resource levels as well. The proposed system implements this principle by combining AWS IAM policies (which restrict which AWS API operations each application component can perform) with application-level RBAC (which restricts what data each authenticated user can read or write) and PostgreSQL row-level security (which enforces data isolation at the storage layer, independent of the application).

Three IAM roles are defined for the proposed system, corresponding to the clinic's three user categories: Doctor (read/write access to patient records assigned to their care), Admin (read/write access to scheduling and registration data only), and Patient (read-only access to their own records). Each role is granted the minimum permissions required to perform its function, implementing the principle of least privilege.

The addition of PostgreSQL row-level security as a third enforcement layer is a direct response to the access control deficiency identified in Section 2.3: the current system's application-level role controls provide no protection if the underlying database is accessed directly, which is precisely what a ransomware attacker does.

#### 2.5.7 HIPAA Compliance

The Health Insurance Portability and Accountability Act (HIPAA) is the primary regulatory framework governing the security and privacy of patient health information in the United States and is widely adopted as a benchmark standard for healthcare data security internationally. HIPAA's Security Rule mandates technical safeguards including access control, audit logging, data integrity protection, and transmission security — requirements that map directly onto the proposed system's IAM, CloudTrail, KMS, and TLS configurations.

AWS Security Hub provides a managed compliance posture assessment tool that continuously evaluates the AWS environment against HIPAA security controls and surfaces findings where the configuration deviates from the standard. The proposed system uses Security Hub as the primary mechanism for measuring and reporting HIPAA compliance posture.

The current system satisfies none of HIPAA's technical safeguards: it has no access control enforcement at the infrastructure level, no audit log of data access events, no data integrity protection through encryption, and no consistent transmission security. The proposed system addresses all four categories, making HIPAA posture the measurable compliance target for the evaluation phase in Chapter 5.

---

### 2.6 Chapter Summary

This chapter has established the theoretical, contextual, and comparative foundations for the proposed Secure Cloud-Based Patient Data Management System.

The case study analysis of Alamin Clinic, grounded in structured stakeholder interviews and documentary analysis, identified four systemic deficiencies in the current on-premise system — flat network architecture, weak access control, absent data encryption, and no operational resilience — that collectively created the conditions for a ransomware attack causing five days of operational disruption and permanent data loss. The 5W 1H problem analysis framed these deficiencies across six dimensions, confirming that the solution requires not incremental patching but fundamental architectural redesign.

The workflow analysis demonstrated that the current manual, unprotected process can be replaced step-by-step by the proposed automated, security-enforced workflow: flat architecture by three-tier VPC, manual FTP deployment by DevSecOps CI/CD pipeline, trust-based roles by JWT and row-level security enforcement, no backup by Terraform redeployment in under fifteen minutes, and no audit trail by CloudTrail and application-level logging.

The comparison of existing systems demonstrated that no current off-the-shelf solution adequately addresses the security needs of a small private healthcare provider at an accessible cost. The features adopted from OpenEMR (patient management, appointment scheduling, patient portal) and Epic Systems (RBAC model, audit logging, HIPAA compliance framework) were explicitly identified and justified, with adaptations specific to the security-by-design objectives of this project.

The literature review confirmed academic and industry support for each core technology choice: three-tier VPC architecture for network isolation, Terraform IaC for reproducible and rapid-recovery infrastructure, DevSecOps pipelines for shift-left vulnerability detection, IAM/RBAC with PostgreSQL row-level security for multi-layer access control, and HIPAA via AWS Security Hub for continuous compliance measurement. Chapter 3 proceeds to define the development methodology through which these design principles will be applied.

---

### References

Ahuja, S., Mani, S., & Zambrano, J. (2012). A survey of the state of cloud computing in healthcare. *Network and Communication Technologies*, 1(2). https://doi.org/10.5539/nct.v1n2p12

Al-Issa, Y., Ottom, M. A., & Tamrawi, A. (2019). EHealth cloud security challenges: A survey. *Journal of Healthcare Engineering*, 2019. https://doi.org/10.1155/2019/7516035

Argaw, S., Bempong-Ahun, N., Eshaya-Chauvin, B., & Flahault, A. (2019). The state of research on cyberattacks against hospitals and available best practice recommendations: A scoping review. *BMC Medical Informatics and Decision Making*, 19. https://doi.org/10.1186/s12911-018-0724-5

Paidy, P., & Chaganti, K. (2024). Resilient cloud architecture: Automating security across multi-region AWS deployments. *International Journal of Emerging Trends in Computer Science and Information Technology*, 5(2), 82–93.

Singh, A., & Chatterjee, K. (2015). A secure multi-tier authentication scheme in cloud computing environment. *2015 International Conference on Circuits, Power and Computing Technologies (ICCPCT-2015)*, 1–7. https://doi.org/10.1109/ICCPCT.2015.7159276
