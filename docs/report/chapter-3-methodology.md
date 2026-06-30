
tags: [fyp, psm1, chapter-3, methodology, agile, devsecops]
phase: 3
status: complete
created: 2026-05-02
related: [[FYP/PSM 1 SECRH/docs/PHASES]], [[chapter-2-literature-review]], [[chapter-4-requirement-design]]


# CHAPTER 3

## SYSTEM DEVELOPMENT METHODOLOGY

---

### 3.1 Introduction

This chapter defines the development methodology adopted for the Secure Cloud-Based Patient Data Management System and justifies the selection of that methodology in the context of the project's requirements. The design and deployment of a security-hardened cloud infrastructure presents a distinct set of methodological challenges: the system must be developed iteratively to allow security requirements to be validated at each stage, the pipeline must integrate security tools that execute on every code change, and the infrastructure must be structured so that it can be incrementally built, tested, and hardened without requiring a complete rebuild between phases.

Section 3.2 presents the chosen methodology — Agile development integrated with DevSecOps practices — and justifies this choice against alternative approaches. Section 3.3 describes the phases of the methodology as applied to this specific project, mapping each phase to its deliverables. Section 3.4 provides a technical description of each tool and technology used in the system. Section 3.5 presents the complete system requirement analysis, covering both functional and non-functional requirements. Section 3.6 summarises the chapter.

---

### 3.2 Methodology Choice and Justification

This section presents the development methodology selected for this project and provides a structured justification for that choice. Three candidate methodologies were evaluated — Waterfall, Scrum, and Agile with DevSecOps integration — against the specific requirements of a cloud security system development project. The most appropriate approach was selected on the basis of four alignment criteria derived from the project's security objectives and iterative design requirements.

#### 3.2.1 Overview of Candidate Methodologies

Three development methodologies were considered for this project: the Waterfall model, Scrum (Agile), and a DevSecOps-integrated Agile approach.

**Waterfall** follows a strictly sequential process — requirements, design, implementation, testing, and deployment — in which each phase must be fully completed before the next begins. This model is appropriate for projects with stable, well-understood requirements and no anticipated need for iterative revision. However, it is poorly suited to cloud security projects, where requirements — particularly security requirements — frequently emerge from the findings of one phase and must inform the design of the next. In a Waterfall model, a security misconfiguration discovered during the testing phase would require revisiting the design phase, incurring significant rework.

**Scrum** is an Agile framework that organises development into fixed-duration sprints, each producing a potentially shippable increment. Scrum's iterative structure is well-matched to complex system development projects but does not, in its standard form, prescribe when or how security validation should occur within the sprint cycle. Without explicit integration of security practices, Scrum risks treating security as a separate concern to be addressed after functional development is complete — the reactive posture that this project is specifically designed to replace.

**Agile with DevSecOps integration** extends the Scrum framework by embedding security testing, vulnerability scanning, and compliance checks directly into the sprint workflow and the CI/CD pipeline. This approach ensures that security is not a phase that follows development but a property of every increment produced. The integration of DevSecOps into the Agile lifecycle is characterised as the natural extension of Agile principles into the security domain: just as Agile eliminated the hard boundary between requirements and implementation, DevSecOps eliminates the hard boundary between development and security — a principle established in foundational DevSecOps literature (Bass et al., 2015) and corroborated by more recent multi-cloud deployment studies (Paidy & Chaganti, 2024).

#### 3.2.2 Justification for Agile with DevSecOps

The Agile with DevSecOps methodology is selected for this project on the basis of four alignment criteria.

**Iterative security validation.** The system's security architecture — VPC network topology, IAM policy structure, encryption configuration, and CI/CD pipeline — must be validated at each stage of construction, not only at the end. Agile sprints allow each infrastructure component to be built, scanned, and verified before the next component depends on it. This prevents the accumulation of undetected security debt across phases.

**Shift-left security integration.** The DevSecOps principle of shifting security checks to the earliest possible point in the development lifecycle is directly applicable to this project. By integrating Trivy, SonarQube, and Checkov into the GitHub Actions CI/CD pipeline, every code commit triggers automated security validation. Vulnerabilities are caught at the commit stage rather than the deployment stage, at the lowest possible remediation cost.

**Infrastructure as Code compatibility.** Terraform's declarative infrastructure model aligns naturally with Agile iterative development: each sprint produces a tested, version-controlled increment of the infrastructure configuration. The complete environment can be rebuilt from any point in the version history, supporting both sprint-level rollback and the post-incident recovery scenario that motivates the entire project.

**Measurable compliance.** The HIPAA compliance objective requires that security posture be continuously measured, not assessed once at the end of development. AWS Security Hub provides this continuous posture assessment, and its findings can be tracked sprint-by-sprint as new infrastructure components are added. This creates a measurable, auditable compliance trail aligned with Agile's emphasis on working, validated deliverables at each iteration.

Table 3.1 summarises the comparison of the three candidate methodologies against the project's key requirements.

**Table 3.1** — Methodology Comparison

| Criteria                                  | Waterfall | Scrum (Agile) | Agile + DevSecOps |
| ----------------------------------------- | --------- | ------------- | ----------------- |
| Iterative development                     | ✗         | ✓             | ✓                 |
| Security integrated at each stage         | ✗         | ✗             | ✓                 |
| Supports IaC incremental build            | Partial   | ✓             | ✓                 |
| Automated pipeline compatibility          | ✗         | Partial       | ✓                 |
| Continuous compliance measurement         | ✗         | ✗             | ✓                 |
| Suited for changing security requirements | ✗         | ✓             | ✓                 |

Figure 3.1 illustrates the sprint cycle of the selected Agile with DevSecOps methodology, showing the integration of automated security gates at each phase of the iterative development process.

> 📎 **ATTACH:** `Figure 3.1` — Agile + DevSecOps sprint cycle diagram. Show the standard Agile loop (Plan → Develop → Test → Review → Release) with DevSecOps security gates overlaid: SAST scan (SonarQube) during Develop, container scan (Trivy) and IaC scan (Checkov) during Test, Security Hub posture check during Release. This makes the methodology tangible rather than abstract.

---

### 3.3 Phases of the Chosen Methodology

The project is organized into five sprints. Each sprint has a defined scope, a set of deliverables, and a security gate that must pass before the sprint is considered complete. Figure 3.2 presents the project timeline across all five sprints. A full-page reproduction is provided in Appendix A.

#### Sprint 1 — Requirements and Architecture Design

**Scope:** Elicit and document all functional and non-functional system requirements. Produce the complete system architecture design, including the three-tier VPC network diagram, IAM policy structure, and DevSecOps pipeline specification.

**Deliverables:** System requirements document (Chapter 3.5), VPC network architecture diagram, IAM policy matrix, CI/CD pipeline design.

**Security gate:** Architecture review against HIPAA Security Rule technical safeguard requirements. All identified control gaps must be documented and addressed in the design before Sprint 2 proceeds.

#### Sprint 2 — Network Infrastructure and Database Layer

**Scope:** Provision the AWS VPC using Terraform, including the public subnet (Application Load Balancer), private application subnet (EC2), and isolated database subnet (RDS). Configure Security Groups, Network ACLs, NAT Gateway, and Internet Gateway. Deploy and configure the Amazon RDS database instance with KMS encryption at rest.

**Deliverables:** Terraform configuration files for VPC, subnets, routing tables, security groups, and RDS instance. Checkov scan report for all IaC configurations.

**Security gate:** Checkov scan must report zero critical misconfigurations. RDS instance must be confirmed as unreachable from the public internet. Encryption at rest must be verified in the AWS Console.

#### Sprint 3 — Application Layer and Authentication

**Scope:** Deploy the Node.js/Express backend as a Docker container to EC2 instances in the private application subnet. Build the React frontend as a static production artifact and deploy it to an Amazon S3 bucket served through Amazon CloudFront. Implement the RBAC authentication system with three roles (Doctor, Admin, Patient). Configure the Application Load Balancer with HTTPS termination and TLS certificate.

**Deliverables:** Dockerfile for the Node.js/Express backend, React production build deployed to S3, CloudFront distribution configuration, application deployment Terraform modules, IAM role definitions, Trivy scan report for the backend container image.

**Security gate:** Trivy scan must report zero critical CVEs in deployed container images. TLS termination must be verified at the ALB. Application-level RBAC must be confirmed to enforce role boundaries through test cases covering each user role.

#### Sprint 4 — DevSecOps Pipeline and Monitoring

**Scope:** Build and configure the complete GitHub Actions CI/CD pipeline, integrating Trivy, SonarQube, and Checkov as automated pipeline stages. Configure Amazon CloudWatch log groups and metric alarms. Configure AWS CloudTrail for audit logging of all API calls and data access events.

**Deliverables:** GitHub Actions workflow YAML files, SonarQube configuration, CloudWatch dashboard configuration, CloudTrail trail configuration.

**Security gate:** Pipeline must demonstrate that a commit containing a deliberate critical vulnerability (test CVE injection) is blocked before reaching the deployment stage. CloudTrail must be confirmed to capture patient data access events.

#### Sprint 5 — Security Evaluation and Compliance Testing

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

**React** is the JavaScript framework used for the system's web frontend, providing the patient portal, appointment scheduling interface, and administrative dashboards. The React application is compiled to a static production build and deployed to an Amazon S3 bucket. Amazon CloudFront serves the static files globally from edge locations, providing low-latency delivery to end users while keeping the frontend entirely outside the VPC attack surface.

**Node.js with Express** is the JavaScript runtime and web framework used for the application backend, providing the RESTful API layer that handles authentication, role enforcement, and data access logic. Node.js/Express is selected over alternatives for three reasons: the development team has direct prior experience with this stack, eliminating framework learning overhead during the project; the same JWT authentication, bcrypt password hashing, and cookie-based session patterns validated in prior development work carry over directly; and a single language (JavaScript) across both the React frontend and the Express backend reduces context switching and simplifies the Docker containerisation setup.

**PostgreSQL** is the relational database management system deployed on Amazon RDS. PostgreSQL was selected for its robust support for row-level security policies, which complement the RBAC model by allowing database-level access restrictions to be defined per user role.

> 📎 **ATTACH:** `Figure 3.3` — Technology stack diagram. Show the full stack in one visual: S3+CloudFront (React) → ALB → Node.js/Express on EC2 → PostgreSQL on RDS, with the CI/CD pipeline (GitHub Actions + scanners) feeding into it from the left. This gives the examiner a single diagram that ties all the technologies in section 3.4 together.

---

### 3.5 System Requirement Analysis

System requirements are divided into two categories: functional requirements, which define what the system must do, and non-functional requirements, which define the quality constraints under which it must operate. Both categories are derived directly from the deficiencies identified in the Alamin Clinic case study (Chapter 2) and from the HIPAA Security Rule technical safeguard requirements.

#### 3.5.1 Functional Requirements

Functional requirements specify the behaviours and operations the system must support. The system has twelve functional requirements covering five domains: user authentication and account management (FR-07, FR-08, FR-10), patient registration and profile management (FR-01), medical records management (FR-02, FR-03, FR-06), appointment scheduling (FR-04, FR-05), and system-level security controls (FR-09, FR-11, FR-12). The complete requirements table is provided in Appendix B, Table B.19.

> 📎 **ATTACH:** `Figure 3.4` — Use case diagram. Draw three actors (Doctor, Admin, Patient) each connected to their authorised use cases from the FR table in Appendix B. This is standard UTM requirement — examiners expect a use case diagram in the requirements section. Keep it clean: one diagram, all three roles, all FRs represented as labelled ovals.

#### 3.5.2 Non-Functional Requirements

Non-functional requirements define the performance, security, reliability, and compliance constraints the system must satisfy. The system has eleven non-functional requirements across five categories: security (NFR-01 through NFR-04: KMS encryption, TLS, least-privilege IAM, pipeline blocking), availability and recovery (NFR-05: 99.9% uptime; NFR-06: RTO ≤ 15 minutes), compliance and auditability (NFR-07: HIPAA Security Hub posture; NFR-08: CloudTrail 90-day retention), performance (NFR-09: API response ≤ 3 s under 50 concurrent users), scalability (NFR-10: EC2 Auto Scaling), and maintainability (NFR-11: all infrastructure in Terraform). The complete requirements table is provided in Appendix B, Table B.20.

#### 3.5.3 Minimum System Requirements

This section specifies the minimum hardware and software requirements for each category of user to access and operate the system, and the minimum server-side specifications required to deploy the system on AWS.

**Table 3.4** — Minimum Client-Side Requirements (End User)

| Requirement         | Minimum Specification                                                                               | Recommended                         |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Device              | Any internet-connected device (PC, laptop, tablet, or smartphone)                                   | Desktop or laptop                   |
| Processor           | 1 GHz single-core                                                                                   | 2 GHz dual-core or higher           |
| RAM                 | 1 GB                                                                                                | 4 GB or higher                      |
| Internet connection | 1 Mbps stable broadband                                                                             | 10 Mbps or higher                   |
| Web browser         | Google Chrome 90+, Mozilla Firefox 88+, Microsoft Edge 90+, Safari 14+ (JavaScript must be enabled) | Latest version of Chrome or Firefox |
| Screen resolution   | 1280 × 720 pixels                                                                                   | 1920 × 1080 pixels                  |
| Operating system    | Windows 7 or later, macOS 10.14 or later, iOS 12 or later, Android 8.0 or later                     | Windows 10+, macOS 12+              |

No software installation is required on the client device. The system is delivered as a browser-based web application accessible via HTTPS. All processing occurs on the server side; the client device is only required to render the web interface and transmit user input.

**Table 3.5** — Minimum Server-Side Requirements (AWS Deployment)

| Component          | AWS Service               | Minimum Instance/Tier            | Purpose                            |
| ------------------ | ------------------------- | -------------------------------- | ---------------------------------- |
| Application server | Amazon EC2                | t3.small (2 vCPU, 2 GB RAM)      | Node.js/Express backend            |
| Database server    | Amazon RDS                | db.t3.micro (2 vCPU, 1 GB RAM)   | PostgreSQL patient data store      |
| Load balancer      | Application Load Balancer | Standard (1 LCU)                 | HTTPS traffic distribution         |
| Storage            | Amazon EBS                | 20 GB GP3 SSD                    | EC2 root volume                    |
| Database storage   | Amazon RDS Storage        | 20 GB GP2 SSD                    | Patient records and audit log      |
| Network            | AWS VPC                   | /16 CIDR, 6 subnets across 2 AZs | Network isolation and segmentation |

These specifications define the minimum configuration required to run the system in a pilot deployment supporting up to 50 concurrent users. Production scale-up is achieved through EC2 Auto Scaling and RDS instance class upgrades with no change to the application code or network architecture.

---

### 3.6 Chapter Summary

This chapter defined the Agile with DevSecOps methodology adopted for the project and justified its selection over Waterfall and standard Scrum approaches on the basis of four criteria: iterative security validation, shift-left pipeline integration, Infrastructure as Code compatibility, and measurable compliance tracking.

The project is structured into five sprints. Sprint 1 covers requirements and architecture design. Sprints 2 through 5 cover network infrastructure, application layer, pipeline integration, and security evaluation respectively. Each sprint is bounded by a security gate that must be cleared before the next sprint proceeds.

The technology stack was described across six categories: AWS cloud services (VPC, EC2, RDS, ALB, S3, CloudFront, KMS, CloudWatch, CloudTrail, Security Hub), Terraform IaC, Docker containerisation, GitHub Actions CI/CD, security scanning tools (Trivy, SonarQube, Checkov), and the application stack (React, Node.js/Express, PostgreSQL). Each technology selection was grounded in the security and operational requirements established in the literature review.

The system requirement analysis produced twelve functional requirements and eleven non-functional requirements, each with a defined verification method. The non-functional requirements establish the measurable security, availability, recovery, and compliance targets against which the system will be evaluated in Chapter 5. Chapter 4 proceeds to translate these requirements into the complete system design.

---

### References

Bass, L., Weber, I., & Zhu, L. (2015). *DevOps: A software architect's perspective*. Addison-Wesley.

Paidy, P., & Chaganti, K. (2024). Resilient cloud architecture: Automating security across multi-region AWS deployments. *International Journal of Emerging Trends in Computer Science and Information Technology*, 5(2), 82–93.
