
tags: [fyp, psm1, chapter-5, conclusion]
phase: 5
status: complete
created: 2026-05-09
related: [[FYP/PSM 1 SECRH/docs/PHASES]], [[chapter-4-requirement-design]]


# CHAPTER 5

## CONCLUSION

---

### 5.1 Introduction

This project addresses a well-documented and consequential gap in healthcare information security: the absence of accessible, security-first infrastructure solutions for small private healthcare providers. The motivating case study — a ransomware attack on Alamin Clinic's on-premise patient data management system — exemplifies a pattern that is prevalent across the small healthcare provider sector, where limited IT resources, manual configuration practices, and reactive security postures have consistently proven insufficient against modern cyber threats.

The aim of this project is to design and deploy a Secure Cloud-Based Patient Data Management System for Alamin Clinic using a three-tier architecture on Amazon Web Services, incorporating Infrastructure as Code and a DevSecOps pipeline to ensure automated, reproducible, and security-validated deployments. This aim is supported by three measurable objectives: (a) to investigate the core technologies and security concepts relevant to the proposed system; (b) to design the system architecture, database schema, and interface; and (c) to test the deployed system through operational testing and User Acceptance Testing.

The significance of the project operates at three levels. At the clinical level, the system directly addresses the conditions that led to five days of operational disruption and permanent patient data loss at Alamin Clinic. At the technical level, it demonstrates that infrastructure as code and DevSecOps automation can make enterprise-grade security practices accessible to resource-constrained healthcare providers. At the academic level, it provides a practical, case-study-grounded evaluation of cloud security principles using HIPAA compliance as a measurable benchmark.

---

### 5.2 Achievements

This section summarises the outcomes achieved at the conclusion of PSM1 across three workstreams: the key findings established through the literature review, the status of each project objective defined in Chapter 1, and the limitations of the current phase of work alongside notes on how each will be addressed during PSM2 implementation.

#### 5.2.1 Findings from Literature Review

The literature review conducted in Chapter 2 confirmed three findings that directly shape the design of the proposed system.

First, the security deficiencies at Alamin Clinic are consistent with documented patterns across the small healthcare provider sector. Argaw et al. (2019) identified that cyberattacks against hospitals frequently exploit the same conditions present at Alamin Clinic: outdated infrastructure, the absence of network segmentation, and reactive patch management. The clinic's experience is therefore not an isolated incident but a representative instance of a systemic vulnerability.

Second, existing solutions fail to address this gap adequately. The comparison of existing systems in Chapter 2 demonstrated that traditional on-premise systems and open-source alternatives such as OpenEMR place the full burden of security management on the clinic's IT staff — a burden that Alamin Clinic's experience has shown to be unsustainable. Commercial solutions such as Epic Systems provide robust security but at a cost and complexity that is inaccessible to small private providers. No current off-the-shelf solution combines cost accessibility with the security automation capabilities required to address the identified vulnerabilities.

Third, the proposed technical approach is supported by academic and industry literature. Paidy and Chaganti (2024) demonstrated that Infrastructure as Code significantly reduces configuration drift and enables faster, more reliable recovery from infrastructure failures. Al-Issa et al. (2019) confirmed that unauthorised data access, integrity violations, and service availability failures — the three threat categories directly addressed by the proposed system — are the dominant risks in healthcare cloud deployments.

#### 5.2.2 Status of Project Objectives

**Objective (a) — Investigate core concepts:** This objective has been fully achieved. Chapter 2 systematically reviewed the academic and industry literature relevant to the proposed system across seven domains: cloud computing in healthcare, three-tier architecture, the AWS shared responsibility model, Infrastructure as Code with Terraform, DevSecOps and shift-left security, Identity and Access Management with Role-Based Access Control, and HIPAA compliance. The review confirmed the appropriateness of each technology choice and provided the academic grounding for the design decisions made in Chapter 4.

**Objective (b) — Design the system:** The design phase of this objective has been fully completed within PSM1. Chapter 4 presents the complete system design including: the three-tier VPC network architecture with six subnets across two Availability Zones; the security group and NACL configuration at two independent network layers; the IAM role definitions and least-privilege policy structure; the six-stage DevSecOps CI/CD pipeline with automated blocking on critical findings; the PostgreSQL database schema with six tables and row-level security policies; and the interface wireframes for all three user roles. The development phase — the implementation of this design — is scheduled for PSM2 Sprints 2 through 4.

**Objective (c) — Test the system:** This objective is partially concluded at the design level. The testing framework has been defined: operational testing will comprise automated vulnerability scanning (Trivy, SonarQube, Checkov), a Recovery Time Objective stress test simulating a ransomware wipe-and-redeploy scenario, and a HIPAA compliance posture assessment via AWS Security Hub. User Acceptance Testing will be conducted with a minimum of three representative participants, one per user role. The execution of this testing framework is scheduled for PSM2 Sprint 5, following the completion of system implementation.

---

### 5.3 Suggested Plan for Project Implementation and Execution (PSM2)

The PSM2 phase of this project will proceed through four implementation sprints, structured according to the Agile with DevSecOps methodology defined in Chapter 3. Each sprint builds on the design specifications established in Chapter 4 and is bounded by a security gate that must be cleared before the next sprint proceeds.

**Sprint 2 — Network Infrastructure and Database Layer**

The first implementation sprint will provision the AWS VPC using Terraform, establishing the complete three-tier network topology: public subnets containing the Application Load Balancer and NAT Gateway, private application subnets for the EC2 instances, and isolated database subnets for the Amazon RDS PostgreSQL instance. Security Groups and Network ACLs will be configured according to the specifications in Chapter 4, Sections 4.3.2 and 4.3.3. The RDS instance will be deployed with KMS encryption at rest and automated backups enabled. The sprint will be closed when Checkov reports zero critical misconfigurations across all Terraform configurations and the RDS instance is confirmed unreachable from the public internet.

**Sprint 3 — Application Layer and Authentication**

The second implementation sprint will deploy the Docker-containerised application stack — React frontend and Node.js/Express backend — to EC2 instances within the private application subnet. The JWT-based RBAC authentication system will be implemented with the three role definitions (Doctor, Admin, Patient) specified in Chapter 4, Section 4.3.5. PostgreSQL row-level security policies will be applied to the `medical_records` and `patients` tables as defined in Chapter 4, Section 4.4.3. The Application Load Balancer will be configured with HTTPS termination using an ACM-managed TLS certificate. The sprint will be closed when Trivy reports zero critical CVEs in the deployed container images and all three user role boundaries are verified through test cases.

**Sprint 4 — DevSecOps Pipeline and Monitoring**

The third implementation sprint will build and configure the GitHub Actions CI/CD pipeline, integrating Trivy, SonarQube, and Checkov as automated blocking stages as specified in Chapter 4, Section 4.3.6. Amazon CloudWatch will be configured with log groups, metric alarms, and alerting thresholds for anomalous authentication patterns. AWS CloudTrail will be enabled for full API audit logging. The sprint will be closed when the pipeline successfully blocks a test commit containing a deliberate critical vulnerability and CloudTrail is confirmed to capture patient data access events.

**Sprint 5 — Security Evaluation and Compliance Testing**

The final implementation sprint will execute the complete security evaluation framework. Automated scan reports from Trivy, SonarQube, and Checkov will be compiled and assessed. The Recovery Time Objective stress test will simulate a complete infrastructure wipe followed by a Terraform redeployment, with the recovery time measured and documented against the 15-minute target defined in NFR-06. AWS Security Hub will be used to assess the system's HIPAA compliance posture. User Acceptance Testing will be conducted with three representative participants across the Doctor, Admin, and Patient roles. The results of this sprint will form the primary content of Chapter 5 (Implementation and Testing) of the PSM2 report.

The deliverables of PSM2 will complete the project's remaining objectives and produce the final report comprising Chapters 5 and 6, the complete appendices including the UAT instrument and results, and the deployed system hosted on AWS.

---

### References

Al-Issa, Y., Ottom, M. A., & Tamrawi, A. (2019). EHealth cloud security challenges: A survey. *Journal of Healthcare Engineering*, 2019. https://doi.org/10.1155/2019/7516035

Argaw, S., Bempong-Ahun, N., Eshaya-Chauvin, B., & Flahault, A. (2019). The state of research on cyberattacks against hospitals and available best practice recommendations: A scoping review. *BMC Medical Informatics and Decision Making*, 19. https://doi.org/10.1186/s12911-018-0724-5

Paidy, P., & Chaganti, K. (2024). Resilient cloud architecture: Automating security across multi-region AWS deployments. *International Journal of Emerging Trends in Computer Science and Information Technology*, 5(2), 82–93.
