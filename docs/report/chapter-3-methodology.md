---
tags: [fyp, psm1, chapter-3, methodology, agile, devsecops]
phase: 3
status: complete
created: 2026-05-02
related: [[PHASES]], [[chapter-2-literature-review]], [[chapter-4-requirement-design]]
---

# CHAPTER 3

## SYSTEM DEVELOPMENT METHODOLOGY

---

### 3.1 Introduction

This chapter defines the development methodology adopted for the Secure Cloud-Based Patient Data Management System and justifies the selection of that methodology in the context of the project's requirements. The design and deployment of a security-hardened cloud infrastructure presents a distinct set of methodological challenges: the system must be developed iteratively to allow security requirements to be validated at each stage, the pipeline must integrate security tools that execute on every code change, and the infrastructure must be structured so that it can be incrementally built, tested, and hardened without requiring a complete rebuild between phases.

Section 3.2 presents the chosen methodology — Agile development integrated with DevSecOps practices — and justifies this choice against alternative approaches. Section 3.3 describes the phases of the methodology as applied to this specific project, mapping each phase to its deliverables. Section 3.4 provides a technical description of each tool and technology used in the system. Section 3.5 presents the complete system requirement analysis, covering both functional and non-functional requirements. Section 3.6 summarises the chapter.

---

### 3.2 Methodology Choice and Justification

#### 3.2.1 Overview of Candidate Methodologies

Three development methodologies were considered for this project: the Waterfall model, Scrum (Agile), and a DevSecOps-integrated Agile approach.

**Waterfall** follows a strictly sequential process — requirements, design, implementation, testing, and deployment — in which each phase must be fully completed before the next begins. This model is appropriate for projects with stable, well-understood requirements and no anticipated need for iterative revision. However, it is poorly suited to cloud security projects, where requirements — particularly security requirements — frequently emerge from the findings of one phase and must inform the design of the next. In a Waterfall model, a security misconfiguration discovered during the testing phase would require revisiting the design phase, incurring significant rework.

**Scrum** is an Agile framework that organises development into fixed-duration sprints, each producing a potentially shippable increment. Scrum's iterative structure is well-matched to complex system development projects but does not, in its standard form, prescribe when or how security validation should occur within the sprint cycle. Without explicit integration of security practices, Scrum risks treating security as a separate concern to be addressed after functional development is complete — the reactive posture that this project is specifically designed to replace.

**Agile with DevSecOps integration** extends the Scrum framework by embedding security testing, vulnerability scanning, and compliance checks directly into the sprint workflow and the CI/CD pipeline. This approach ensures that security is not a phase that follows development but a property of every increment produced. Bass et al. (2015) characterise this integration as the natural extension of Agile principles into the security domain: just as Agile eliminated the hard boundary between requirements and implementation, DevSecOps eliminates the hard boundary between development and security.

#### 3.2.2 Justification for Agile with DevSecOps

The Agile with DevSecOps methodology is selected for this project on the basis of four alignment criteria.

**Iterative security validation.** The system's security architecture — VPC network topology, IAM policy structure, encryption configuration, and CI/CD pipeline — must be validated at each stage of construction, not only at the end. Agile sprints allow each infrastructure component to be built, scanned, and verified before the next component depends on it. This prevents the accumulation of undetected security debt across phases.

**Shift-left security integration.** The DevSecOps principle of shifting security checks to the earliest possible point in the development lifecycle is directly applicable to this project. By integrating Trivy, SonarQube, and Checkov into the GitHub Actions CI/CD pipeline, every code commit triggers automated security validation. Vulnerabilities are caught at the commit stage rather than the deployment stage, at the lowest possible remediation cost.

**Infrastructure as Code compatibility.** Terraform's declarative infrastructure model aligns naturally with Agile iterative development: each sprint produces a tested, version-controlled increment of the infrastructure configuration. The complete environment can be rebuilt from any point in the version history, supporting both sprint-level rollback and the post-incident recovery scenario that motivates the entire project.

**Measurable compliance.** The HIPAA compliance objective requires that security posture be continuously measured, not assessed once at the end of development. AWS Security Hub provides this continuous posture assessment, and its findings can be tracked sprint-by-sprint as new infrastructure components are added. This creates a measurable, auditable compliance trail aligned with Agile's emphasis on working, validated deliverables at each iteration.

Table 3.1 summarises the comparison of the three candidate methodologies against the project's key requirements.

**Table 3.1** — Methodology Comparison

| Criteria | Waterfall | Scrum (Agile) | Agile + DevSecOps |
|----------|-----------|---------------|-------------------|
| Iterative development | ✗ | ✓ | ✓ |
| Security integrated at each stage | ✗ | ✗ | ✓ |
| Supports IaC incremental build | Partial | ✓ | ✓ |
| Automated pipeline compatibility | ✗ | Partial | ✓ |
| Continuous compliance measurement | ✗ | ✗ | ✓ |
| Suited for changing security requirements | ✗ | ✓ | ✓ |

> 📎 **ATTACH:** `Figure 3.1` — Agile + DevSecOps sprint cycle diagram. Show the standard Agile loop (Plan → Develop → Test → Review → Release) with DevSecOps security gates overlaid: SAST scan (SonarQube) during Develop, container scan (Trivy) and IaC scan (Checkov) during Test, Security Hub posture check during Release. This makes the methodology tangible rather than abstract.

---

### 3.3 Phases of the Chosen Methodology

The project is organised into five sprints. Each sprint has a defined scope, a set of deliverables, and a security gate that must pass before the sprint is considered complete. The sprint structure covers both the PSM1 design phase and the PSM2 implementation phase, providing a continuous methodology across both semesters.

> 📎 **ATTACH:** `Figure 3.2` — Project Gantt chart or sprint timeline. Show all five sprints across the full project calendar (PSM1 months and PSM2 months), with each sprint's key deliverable labelled. This gives the examiner a clear view of the project timeline and confirms that the methodology phases map to real calendar milestones.

#### Sprint 1 — Requirements and Architecture Design (PSM1)

**Scope:** Elicit and document all functional and non-functional system requirements. Produce the complete system architecture design, including the three-tier VPC network diagram, IAM policy structure, and DevSecOps pipeline specification.

**Deliverables:** System requirements document (Chapter 3.5), VPC network architecture diagram, IAM policy matrix, CI/CD pipeline design.

**Security gate:** Architecture review against HIPAA Security Rule technical safeguard requirements. All identified control gaps must be documented and addressed in the design before Sprint 2 proceeds.

#### Sprint 2 — Network Infrastructure and Database Layer (PSM2)

**Scope:** Provision the AWS VPC using Terraform, including the public subnet (Application Load Balancer), private application subnet (EC2), and isolated database subnet (RDS). Configure Security Groups, Network ACLs, NAT Gateway, and Internet Gateway. Deploy and configure the Amazon RDS database instance with KMS encryption at rest.

**Deliverables:** Terraform configuration files for VPC, subnets, routing tables, security groups, and RDS instance. Checkov scan report for all IaC configurations.

**Security gate:** Checkov scan must report zero critical misconfigurations. RDS instance must be confirmed as unreachable from the public internet. Encryption at rest must be verified in the AWS Console.

#### Sprint 3 — Application Layer and Authentication (PSM2)

**Scope:** Deploy the Docker-containerised application — React frontend and Flask backend — to EC2 instances in the private application subnet. Implement the RBAC authentication system with three roles (Doctor, Admin, Patient). Configure the Application Load Balancer with HTTPS termination and TLS certificate.

**Deliverables:** Dockerfiles for frontend and backend, application deployment Terraform modules, IAM role definitions, Trivy scan report for container images.

**Security gate:** Trivy scan must report zero critical CVEs in deployed container images. TLS termination must be verified at the ALB. Application-level RBAC must be confirmed to enforce role boundaries through test cases covering each user role.

#### Sprint 4 — DevSecOps Pipeline and Monitoring (PSM2)

**Scope:** Build and configure the complete GitHub Actions CI/CD pipeline, integrating Trivy, SonarQube, and Checkov as automated pipeline stages. Configure Amazon CloudWatch log groups and metric alarms. Configure AWS CloudTrail for audit logging of all API calls and data access events.

**Deliverables:** GitHub Actions workflow YAML files, SonarQube configuration, CloudWatch dashboard configuration, CloudTrail trail configuration.

**Security gate:** Pipeline must demonstrate that a commit containing a deliberate critical vulnerability (test CVE injection) is blocked before reaching the deployment stage. CloudTrail must be confirmed to capture patient data access events.

#### Sprint 5 — Security Evaluation and Compliance Testing (PSM2)

**Scope:** Execute the full security evaluation framework: automated vulnerability scan reports from Trivy, SonarQube, and Checkov; black-box and white-box penetration testing of the application; Recovery Time Objective stress test simulating a ransomware wipe-and-redeploy scenario; and HIPAA compliance posture assessment via AWS Security Hub.

**Deliverables:** Security scan reports, penetration testing results, RTO test log with measured recovery time, AWS Security Hub HIPAA findings report.

**Security gate:** RTO must be measured and documented. Security Hub HIPAA posture score must be recorded as the primary compliance metric. All critical Security Hub findings must be remediated before the sprint is closed.

---

### 3.4 Technology Used Description

This section provides a technical description of each tool and service used in the proposed system, organised by functional category.

#### 3.4.1 Cloud Infrastructure — Amazon Web Services (AWS)

Amazon Web Services provides the cloud infrastructure platform for the proposed system. The following AWS services are employed:

**Amazon Virtual Private Cloud (VPC)** provides logically isolated network environments within the AWS cloud. The proposed system deploys a single VPC containing three subnet tiers — public, private application, and private database — each in multiple Availability Zones for high availability. The VPC is the primary mechanism for implementing network segmentation, replacing the flat single-server architecture at Alamin Clinic.

**Amazon EC2 (Elastic Compute Cloud)** provides the virtual server instances on which the application backend runs. EC2 instances are deployed within the private application subnet, accessible only through the Application Load Balancer, and are not directly reachable from the internet.

**Amazon RDS (Relational Database Service)** provides the managed relational database service for the patient data store. RDS is deployed in the isolated private database subnet with no internet-facing route. KMS encryption is enabled at rest and automated backups are configured to support point-in-time recovery.

**Application Load Balancer (ALB)** distributes incoming HTTPS traffic across EC2 instances. The ALB terminates TLS, ensuring that all traffic entering the application layer is encrypted in transit. It is the only entry point to the application from the public internet.

**AWS Key Management Service (KMS)** provides managed cryptographic keys for encrypting the RDS database and any sensitive data stored in Amazon S3. AES-256 encryption is applied at rest.

**Amazon CloudWatch** provides monitoring and alerting for the deployed infrastructure. Log groups capture application logs and system metrics; alarms are configured to trigger notifications on anomalous patterns such as repeated authentication failures or unusual API call volumes.

**AWS CloudTrail** records every AWS API call made within the account, creating an immutable audit log of all infrastructure changes and data access events. This satisfies the HIPAA requirement for audit logging and provides forensic capability in the event of a security incident.

**AWS Security Hub** aggregates security findings from multiple AWS services and evaluates the account's security posture against the HIPAA Security Standard. Security Hub is used as the primary compliance measurement tool for this project.

#### 3.4.2 Infrastructure as Code — Terraform

Terraform, developed by HashiCorp, is the Infrastructure as Code tool used to define, provision, and manage all AWS resources in this project. Terraform uses a declarative configuration language (HCL — HashiCorp Configuration Language) in which the desired end state of the infrastructure is specified, and Terraform determines the sequence of API calls required to achieve that state.

The entire system — VPC configuration, subnet routing, security group rules, EC2 instance specifications, RDS parameter groups, IAM policies, and ALB listener rules — is expressed as version-controlled Terraform configuration files. This approach provides three security-relevant capabilities: it creates a verifiable record of every infrastructure change through git history; it enables complete environment destruction and redeployment from a clean state within minutes (directly addressing the ransomware recovery objective); and it allows Checkov to statically analyse the configuration for security misconfigurations before any resource is provisioned.

#### 3.4.3 Containerisation — Docker

Docker is used to package the application frontend and backend as portable container images. Containerisation ensures that the application runtime environment is consistent across development, testing, and production stages, eliminating configuration drift between environments. Docker images are built during the CI/CD pipeline and scanned by Trivy before being pushed to the container registry.

#### 3.4.4 CI/CD Pipeline — GitHub Actions

GitHub Actions is the CI/CD platform used to automate the build, scan, and deployment pipeline. A workflow defined in YAML is triggered on every push to the repository's main branch. The pipeline executes the following stages in sequence:

1. Code checkout and dependency installation
2. SonarQube SAST scan of application source code
3. Trivy container image vulnerability scan
4. Checkov IaC misconfiguration scan of Terraform files
5. Terraform plan and apply (deployment) — only if all scan stages pass

A failure at any scan stage with a critical or high-severity finding terminates the pipeline and blocks deployment. This enforces the shift-left principle: no code with a known critical vulnerability can reach the production environment.

#### 3.4.5 Security Scanning Tools

**Trivy** (Aqua Security) is an open-source vulnerability scanner for container images, file systems, and Git repositories. In this project, Trivy scans Docker images against the National Vulnerability Database (NVD) to identify known CVEs in base images and application dependencies before the image is pushed to the registry.

**SonarQube** is a Static Application Security Testing (SAST) platform that analyses source code for security vulnerabilities, code quality issues, and injection risks. SonarQube integration in the pipeline ensures that insecure coding patterns — such as SQL injection vulnerabilities, hardcoded credentials, or improper input validation — are flagged before the code is deployed.

**Checkov** is a static analysis tool for Infrastructure as Code that evaluates Terraform, CloudFormation, and Kubernetes configurations against a library of security and compliance policies. In this project, Checkov enforces policies such as: RDS instances must have encryption at rest enabled; S3 buckets must not be publicly accessible; Security Groups must not permit unrestricted inbound SSH access; and CloudTrail must be enabled.

#### 3.4.6 Application Stack

**React** is the JavaScript framework used for the system's web frontend, providing the patient portal, appointment scheduling interface, and administrative dashboards. The React application is served as a static bundle through the Application Load Balancer.

**Flask** (Python) is the web framework used for the application backend, providing the RESTful API layer that handles authentication, role enforcement, and data access logic. Flask was selected for its lightweight footprint, compatibility with Docker containerisation, and extensive library support for JWT-based authentication and database ORM integration.

**PostgreSQL** is the relational database management system deployed on Amazon RDS. PostgreSQL was selected for its robust support for row-level security policies, which complement the RBAC model by allowing database-level access restrictions to be defined per user role.

> 📎 **ATTACH:** `Figure 3.3` — Technology stack diagram. Show the full stack in one visual: React → ALB → Flask on EC2 → PostgreSQL on RDS, all within the VPC, with the CI/CD pipeline (GitHub Actions + scanners) feeding into it from the left. This gives the examiner a single diagram that ties all the technologies in section 3.4 together.

---

### 3.5 System Requirement Analysis

System requirements are divided into two categories: functional requirements, which define what the system must do, and non-functional requirements, which define the quality constraints under which it must operate. Both categories are derived directly from the deficiencies identified in the Alamin Clinic case study (Chapter 2) and from the HIPAA Security Rule technical safeguard requirements.

#### 3.5.1 Functional Requirements

Functional requirements specify the behaviours and operations the system must support. Table 3.2 lists the functional requirements for the proposed system.

**Table 3.2** — Functional Requirements

| ID | Requirement | User Role | Priority |
|----|------------|-----------|----------|
| FR-01 | The system shall allow new patients to be registered with a unique identifier, personal details, and assigned doctor. | Admin | High |
| FR-02 | The system shall allow authenticated doctors to create, read, and update medical records for patients assigned to their care. | Doctor | High |
| FR-03 | The system shall allow authenticated doctors to read the medical history of their assigned patients. | Doctor | High |
| FR-04 | The system shall allow authenticated administrators to create, update, and cancel patient appointments. | Admin | High |
| FR-05 | The system shall allow authenticated patients to view their own upcoming and past appointments. | Patient | High |
| FR-06 | The system shall allow authenticated patients to view their own medical records in read-only mode. | Patient | High |
| FR-07 | The system shall authenticate all users with a unique username and password before granting access to any system function. | All | High |
| FR-08 | The system shall enforce role-based access control, ensuring that each user role can only access the data and functions authorised for that role. | All | High |
| FR-09 | The system shall log all patient data access events, including the user identity, timestamp, and action performed. | System | High |
| FR-10 | The system shall allow administrators to create, deactivate, and reassign user accounts. | Admin | Medium |
| FR-11 | The system shall transmit all data between the client browser and the server over HTTPS. | System | High |
| FR-12 | The system shall store all patient records in an encrypted database with no direct internet access path. | System | High |

> 📎 **ATTACH:** `Figure 3.4` — Use case diagram. Draw three actors (Doctor, Admin, Patient) each connected to their authorised use cases from the FR table above. This is standard UTM requirement — examiners expect a use case diagram in the requirements section. Keep it clean: one diagram, all three roles, all FRs represented as labelled ovals.

#### 3.5.2 Non-Functional Requirements

Non-functional requirements define the performance, security, reliability, and compliance constraints that the system must satisfy. Table 3.3 lists the non-functional requirements.

**Table 3.3** — Non-Functional Requirements

| ID | Category | Requirement | Metric / Verification Method |
|----|----------|-------------|------------------------------|
| NFR-01 | Security | All data stored in the RDS database shall be encrypted at rest using AES-256 via AWS KMS. | AWS Console — RDS encryption status |
| NFR-02 | Security | All data in transit between the client and ALB shall be encrypted using TLS 1.2 or higher. | SSL Labs scan / ALB listener configuration |
| NFR-03 | Security | All IAM roles shall be configured with least-privilege policies, granting only the permissions required for the role's function. | IAM policy review / AWS IAM Access Analyzer |
| NFR-04 | Security | The CI/CD pipeline shall block deployment on any critical or high-severity finding from Trivy, SonarQube, or Checkov. | GitHub Actions pipeline log |
| NFR-05 | Availability | The system shall maintain 99.9% uptime through multi-AZ EC2 and RDS deployment. | CloudWatch availability metric |
| NFR-06 | Recovery | The system shall be fully redeployable from a clean Terraform state within 15 minutes of a complete infrastructure wipe. | RTO stress test — measured recovery time |
| NFR-07 | Compliance | The system shall achieve and maintain a passing HIPAA posture score as measured by AWS Security Hub. | Security Hub HIPAA standard findings report |
| NFR-08 | Auditability | All AWS API calls and patient data access events shall be logged in CloudTrail with a minimum retention period of 90 days. | CloudTrail configuration / S3 log bucket |
| NFR-09 | Performance | The system shall respond to authenticated API requests within 3 seconds under normal load (up to 50 concurrent users). | Load test results |
| NFR-10 | Scalability | The application tier shall support horizontal scaling through EC2 Auto Scaling to accommodate increased patient load. | Auto Scaling group configuration |
| NFR-11 | Maintainability | All infrastructure shall be defined as version-controlled Terraform code, with no manually provisioned resources in the production environment. | Terraform state file audit |

---

### 3.6 Chapter Summary

This chapter defined the Agile with DevSecOps methodology adopted for the project and justified its selection over Waterfall and standard Scrum approaches on the basis of four criteria: iterative security validation, shift-left pipeline integration, Infrastructure as Code compatibility, and measurable compliance tracking.

The project is structured into five sprints. Sprint 1 covers requirements and architecture design (PSM1). Sprints 2 through 5 cover network infrastructure, application layer, pipeline integration, and security evaluation respectively (PSM2). Each sprint is bounded by a security gate that must be cleared before the next sprint proceeds.

The technology stack was described across six categories: AWS cloud services (VPC, EC2, RDS, ALB, KMS, CloudWatch, CloudTrail, Security Hub), Terraform IaC, Docker containerisation, GitHub Actions CI/CD, security scanning tools (Trivy, SonarQube, Checkov), and the application stack (React, Flask, PostgreSQL). Each technology selection was grounded in the security and operational requirements established in the literature review.

The system requirement analysis produced twelve functional requirements and eleven non-functional requirements, each with a defined verification method. The non-functional requirements establish the measurable security, availability, recovery, and compliance targets against which the system will be evaluated in Chapter 5. Chapter 4 proceeds to translate these requirements into the complete system design.

---

### References

Bass, L., Weber, I., & Zhu, L. (2015). *DevOps: A software architect's perspective*. Addison-Wesley.

Paidy, P., & Chaganti, K. (2024). Resilient cloud architecture: Automating security across multi-region AWS deployments. *International Journal of Emerging Trends in Computer Science and Information Technology*, 5(2), 82–93.
