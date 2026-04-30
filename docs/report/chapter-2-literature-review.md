---
tags: [fyp, psm1, chapter-2, literature-review, case-study, alamin-clinic]
phase: 2
status: complete
created: 2026-05-01
related: [[PHASES]], [[chapter-1-introduction]], [[chapter-3-methodology]]
---

# CHAPTER 2

## LITERATURE REVIEW

---

### 2.1 Introduction

The design of a secure cloud-based patient data management system requires grounding in several converging bodies of knowledge: the threat landscape facing healthcare information systems, the architectural principles that underpin modern cloud deployments, the regulatory frameworks governing patient data, and the DevSecOps practices that embed security into the software delivery lifecycle. This chapter surveys each of these areas systematically, moving from the specific context of the case study organisation to the broader technological and academic literature that informs the design decisions made in subsequent chapters.

Section 2.2 introduces the case study organisation — Alamin Clinic — examining its organisational structure and current manual system of operation. Section 2.3 provides a critical analysis of the existing system's security and operational deficiencies. Section 2.4 compares the proposed system against representative existing healthcare management systems. Section 2.5 reviews the core technologies employed in the proposed solution, supported by academic and industry literature. Section 2.6 summarises the key findings of the review.

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

The organisational structure is illustrated in Figure 2.1.

> **Figure 2.1** — Alamin Clinic Organisational Structure  
> *(Diagram: Clinic Director → [Clinical: Doctors] → Patients | [Administrative: Admin Staff] → Patient Registration, Scheduling | [IT: Server Admin])*

#### 2.2.2 Manual Operation

Prior to the proposed system, Alamin Clinic managed its patient data through a conventional on-premise workflow that can be characterised by four defining characteristics: manual server configuration, manual deployment, local hosting, and reactive security.

**Manual Server Configuration.** The clinic's physical server is set up and maintained by IT staff on-site. Configuration is performed manually, without version-controlled infrastructure definitions or automated provisioning. This approach is inherently error-prone: configuration drift occurs over time as individual changes are applied without documentation, and there is no reliable mechanism to reproduce a clean server state in the event of failure (Paidy & Chaganti, 2024).

**Manual Deployment.** Application code is transferred from the development environment to the production server manually, using either an FTP client or physical media such as a USB drive. This approach introduces significant delays between development and deployment, removes any automated quality or security gate from the deployment process, and creates a direct pathway for compromised or untested code to reach the production environment.

**Local Hosting.** The web frontend, application backend, and patient database are co-hosted on a single physical server. There is no network segmentation between these components: a compromise of any one layer provides immediate access to all others. This flat network architecture is identified in the literature as a primary enabler of ransomware propagation within healthcare systems, as it allows malicious software to traverse from an internet-exposed entry point directly to the database layer without encountering any internal network boundary (Argaw et al., 2019).

**Reactive Security.** Firewall rules and antivirus definitions are updated manually by IT staff in response to known threats, rather than on a systematic schedule. This reactive posture means that the clinic's defences are perpetually behind the current threat landscape. Patches for known vulnerabilities are applied late or inconsistently, leaving windows of exposure that sophisticated attackers — and increasingly, automated ransomware campaigns — routinely exploit.

The cumulative effect of these four characteristics was demonstrated when the clinic's system was compromised by a ransomware attack. Attackers encrypted the entire patient database, rendering all clinical records inaccessible and halting clinic operations. The incident confirmed that the existing architecture contained no meaningful barrier between an attacker's initial foothold and the clinic's most sensitive data.

---

### 2.3 Current System Analysis

A structured analysis of the Alamin Clinic system prior to the proposed migration reveals deficiencies across four security domains: network architecture, access control, data protection, and operational resilience.

**Network Architecture.** The clinic's server hosts all three application tiers — web, application, and database — on a single machine with a single network interface. There are no internal network boundaries, no demilitarised zone (DMZ) for internet-facing components, and no mechanism to restrict lateral movement once an attacker has gained initial access. This architecture directly contradicts the principle of defence in depth, which requires that multiple independent security controls exist such that the failure of any single control does not result in a complete compromise (Al-Issa et al., 2019).

**Access Control.** User access to the system is managed through a single application-level authentication mechanism with no integration of identity management at the infrastructure level. Role distinctions between doctors, administrative staff, and patients exist within the application code but are not enforced at the network or storage layer. An attacker with access to the underlying server is therefore not constrained by these application-level controls.

**Data Protection.** Patient records stored in the clinic's database are not encrypted at rest. Data transmitted between the user's browser and the server is not consistently protected with TLS, as the clinic's HTTP configuration has not been systematically reviewed. This means that both stored data and data in transit are exposed to interception and exfiltration in addition to the ransomware encryption threat.

**Operational Resilience.** The clinic maintains no formal backup policy for its database. No tested recovery procedure exists. When the ransomware attack encrypted the database, the clinic had no clean backup to restore from, and no documented process to guide recovery. This absence of resilience planning is consistent with findings across the small healthcare provider sector: Argaw et al. (2019) identified the lack of backup and recovery planning as a consistent factor in cases where ransomware attacks caused prolonged operational disruption.

Taken together, these deficiencies indicate that the existing system does not meet the minimum security requirements for a healthcare information system, and that a fundamental architectural redesign — rather than incremental patching — is required to bring the clinic's patient data management to an acceptable security posture.

---

### 2.4 Comparison between Existing Systems

To contextualise the proposed system within the landscape of existing healthcare management solutions, Table 2.1 presents a structured comparison of four representative systems: a traditional on-premise Hospital Management System (HMS), OpenEMR (an open-source solution), Epic Systems (a leading commercial platform), and the proposed Secure Cloud PDMS.

**Table 2.1** — Comparison of Existing Healthcare Management Systems

| System | Key Features | Security Model | Main Limitations |
|--------|-------------|----------------|-----------------|
| Traditional On-Premise HMS | Full data control, no internet dependency, customisable | Reactive — manual patches, perimeter-only firewall | High ransomware risk, hardware maintenance cost, no network isolation, poor scalability |
| OpenEMR (Open Source) | Patient portal, appointment scheduling, billing, EHR | Reactive — community patches, server-dependent | Requires self-managed server, manual security updates, no automated deployment |
| Epic Systems (Commercial) | Comprehensive clinical suite, professional support, HL7/FHIR integration | Proactive — vendor-managed updates, enterprise IAM | Prohibitive licensing cost for small clinics, complex deployment, vendor lock-in |
| **Proposed System (Alamin Clinic)** | Patient records, appointment scheduling, role-based access, cloud-native | Proactive, shift-left — automated scanning, IAM/RBAC, encrypted at rest and in transit | Focused on infrastructure security; billing and pharmacy modules are out of scope |

The comparison reveals a clear gap in the market for small healthcare providers. Traditional on-premise systems and open-source alternatives like OpenEMR offer flexibility but place the full burden of security management on the clinic's IT staff — a burden that Alamin Clinic's experience has shown to be unsustainable in practice. Commercial solutions like Epic Systems provide robust security but at a cost and complexity level that is inaccessible to small private providers.

The proposed system addresses this gap by combining the cost accessibility of a self-managed cloud deployment with the security automation capabilities previously available only to enterprise-grade commercial platforms. By encoding the infrastructure in Terraform and integrating security scanning into the CI/CD pipeline, the system reduces the dependency on manual IT operations that is the fundamental vulnerability of the clinic's current approach.

A further distinguishing characteristic of the proposed system is its comparison against the standard AWS architecture pattern. Table 2.2 contrasts the typical approach to AWS deployment against the proposed security-hardened configuration.

**Table 2.2** — Proposed System vs Standard AWS Architecture

| Feature | Standard AWS Architecture | Proposed Solution |
|---------|--------------------------|-------------------|
| Deployment | Manual or basic scripts | Fully automated via Terraform IaC |
| Security model | Added after build | Shift-left — scanned at every CI/CD stage |
| Post-attack recovery | Long manual rebuild | Instant redeployment from Terraform state |
| Data protection | Basic private subnets | Hardened Network ACLs + Private RDS + KMS encryption |
| Compliance | Ad hoc | HIPAA posture measured via AWS Security Hub |

---

### 2.5 Literature Review of Technology Used

#### 2.5.1 Cloud Computing in Healthcare

The adoption of cloud computing in healthcare has been the subject of sustained academic interest since the early 2010s. Ahuja et al. (2012) provided one of the earliest systematic surveys of cloud computing in healthcare, identifying cost reduction, scalability, and improved data accessibility as the primary drivers of adoption, while flagging data security, regulatory compliance, and vendor reliability as the principal barriers. These findings remain relevant: the specific security concerns identified by Ahuja et al. — particularly around data sovereignty and access control — directly inform the design of the proposed system's IAM policy structure and data residency choices.

Al-Issa et al. (2019) extended this analysis with a focus on security challenges specific to eHealth cloud deployments. Their survey identified unauthorised data access, data integrity violations, and service availability failures as the three dominant threat categories. Each of these threats maps directly to a design requirement of the proposed system: unauthorised access is addressed through IAM/RBAC; integrity is protected through CloudTrail audit logging and KMS encryption; and availability is ensured through the multi-AZ deployment and Terraform-based rapid recovery capability.

#### 2.5.2 Three-Tier Architecture

The three-tier architectural pattern separates a web application into three physically and logically distinct layers: the presentation tier (frontend), the application tier (business logic), and the data tier (database). This separation provides two primary security benefits: it limits the blast radius of a compromise at any single tier, and it enables independent scaling and access control policies to be applied to each layer.

In the context of the proposed system, the three-tier model is implemented within an AWS Virtual Private Cloud, with the presentation tier served through an Application Load Balancer in a public subnet, the application tier running on EC2 instances in a private application subnet, and the database tier hosted on Amazon RDS in an isolated private database subnet. This configuration ensures that the database is never directly reachable from the internet — a direct architectural countermeasure to the network flatness that enabled the ransomware attack at Alamin Clinic.

#### 2.5.3 AWS and the Shared Responsibility Model

Amazon Web Services operates under a shared responsibility model that defines the division of security obligations between the cloud provider and the customer. AWS states explicitly:

> "AWS manages security *of* the cloud, you are responsible for security *in* the cloud."

Under this model, AWS is responsible for the physical security of data centres, the hypervisor layer, and the managed service infrastructure. The customer — in this case, the clinic — is responsible for operating system configuration, network security group rules, IAM policy design, application security, and data encryption.

This distinction is critical to the proposed system's design rationale. The shift from an on-premise model to AWS does not eliminate the clinic's security responsibilities; it redistributes them. The proposed system addresses the customer-side responsibilities through Terraform-managed network controls, IAM least-privilege policies, KMS encryption, and the DevSecOps pipeline.

#### 2.5.4 Infrastructure as Code (Terraform)

Infrastructure as Code (IaC) is the practice of defining and provisioning computing infrastructure through machine-readable configuration files rather than through manual processes. Paidy and Chaganti (2024) demonstrated that IaC significantly reduces configuration drift and enables faster, more reliable recovery from infrastructure failures in multi-region AWS deployments — findings directly applicable to the proposed system's self-healing recovery capability.

Terraform, developed by HashiCorp, is the IaC tool selected for this project. Terraform's declarative configuration model allows the entire VPC network topology, EC2 instance configurations, RDS parameter groups, IAM policies, and security group rules to be expressed as version-controlled code. This means that the complete environment can be destroyed and redeployed from a clean state in a matter of minutes — a capability that converts the Recovery Time Objective from an open-ended manual process into a measurable, testable metric.

Checkov, a static analysis tool for IaC, is integrated into the CI/CD pipeline to scan Terraform configurations for security misconfigurations before they are applied. This prevents common infrastructure security mistakes — such as overly permissive security group rules or unencrypted storage volumes — from reaching the production environment.

#### 2.5.5 DevSecOps and Shift-Left Security

DevSecOps is the practice of integrating security testing and validation throughout the software development and delivery lifecycle, rather than applying it as a final gate before production deployment. The "shift-left" principle refers to moving security checks earlier in the pipeline — towards the development phase — so that vulnerabilities are identified and remediated at the lowest possible cost, before they accumulate into the production codebase (Paidy & Chaganti, 2024).

The proposed system implements DevSecOps through a GitHub Actions CI/CD pipeline that executes three categories of security scan on every code commit:

- **Trivy** scans Docker container images for known Common Vulnerabilities and Exposures (CVEs) before any image is pushed to the container registry.
- **SonarQube** performs Static Application Security Testing (SAST), analysing the application source code for security anti-patterns, injection vulnerabilities, and code quality issues.
- **Checkov** analyses Terraform configuration files for infrastructure-level security misconfigurations.

A pipeline failure on any critical finding blocks the deployment, ensuring that no code with a known critical vulnerability can reach the production environment.

#### 2.5.6 Identity and Access Management and Role-Based Access Control

Identity and Access Management (IAM) is the set of policies, processes, and technologies that control who can access which resources in a system. In the AWS context, IAM provides fine-grained, policy-driven access control at the infrastructure level, complementing the application-level RBAC model.

Singh and Chatterjee (2015) established that multi-tier authentication in cloud environments requires security enforcement at multiple layers — not just at the application login screen but at the network and resource levels as well. The proposed system implements this principle by combining AWS IAM policies (which restrict which AWS API operations each application component can perform) with application-level RBAC (which restricts what data each authenticated user can read or write).

Three IAM roles are defined for the proposed system, corresponding to the clinic's three user categories: Doctor (read/write access to patient records assigned to their care), Admin (read/write access to scheduling and registration data only), and Patient (read-only access to their own records). Each role is granted the minimum permissions required to perform its function, implementing the principle of least privilege.

#### 2.5.7 HIPAA Compliance

The Health Insurance Portability and Accountability Act (HIPAA) is the primary regulatory framework governing the security and privacy of patient health information in the United States and is widely adopted as a benchmark standard for healthcare data security internationally. HIPAA's Security Rule mandates technical safeguards including access control, audit logging, data integrity protection, and transmission security — requirements that map directly onto the proposed system's IAM, CloudTrail, KMS, and TLS configurations.

AWS Security Hub provides a managed compliance posture assessment tool that continuously evaluates the AWS environment against HIPAA security controls and surfaces findings where the configuration deviates from the standard. The proposed system uses Security Hub as the primary mechanism for measuring and reporting HIPAA compliance posture.

---

### 2.6 Chapter Summary

This chapter has established the theoretical and contextual foundations for the proposed Secure Cloud-Based Patient Data Management System. The case study analysis of Alamin Clinic identified four systemic deficiencies in the current on-premise system — flat network architecture, weak access control, absent data encryption, and no operational resilience — that collectively created the conditions for a successful ransomware attack.

The comparison of existing systems demonstrated that no current off-the-shelf solution adequately addresses the security needs of a small private healthcare provider at an accessible cost: on-premise and open-source solutions transfer the full security burden to under-resourced IT staff, while commercial enterprise platforms are prohibitively expensive. The proposed system fills this gap through a security-by-design approach that automates the controls that manual maintenance consistently fails to sustain.

The literature review confirmed academic and industry support for each of the core technology choices: three-tier VPC architecture for network isolation, Terraform IaC for reproducible and auditable infrastructure, DevSecOps pipelines for shift-left vulnerability detection, IAM/RBAC for multi-layer access control, and HIPAA via AWS Security Hub for compliance measurement. Chapter 3 proceeds to define the development methodology through which these design principles will be applied.

---

### References

Ahuja, S., Mani, S., & Zambrano, J. (2012). A survey of the state of cloud computing in healthcare. *Network and Communication Technologies*, 1(2). https://doi.org/10.5539/nct.v1n2p12

Al-Issa, Y., Ottom, M. A., & Tamrawi, A. (2019). EHealth cloud security challenges: A survey. *Journal of Healthcare Engineering*, 2019. https://doi.org/10.1155/2019/7516035

Argaw, S., Bempong-Ahun, N., Eshaya-Chauvin, B., & Flahault, A. (2019). The state of research on cyberattacks against hospitals and available best practice recommendations: A scoping review. *BMC Medical Informatics and Decision Making*, 19. https://doi.org/10.1186/s12911-018-0724-5

Paidy, P., & Chaganti, K. (2024). Resilient cloud architecture: Automating security across multi-region AWS deployments. *International Journal of Emerging Trends in Computer Science and Information Technology*, 5(2), 82–93.

Singh, A., & Chatterjee, K. (2015). A secure multi-tier authentication scheme in cloud computing environment. *2015 International Conference on Circuits, Power and Computing Technologies (ICCPCT-2015)*, 1–7. https://doi.org/10.1109/ICCPCT.2015.7159276
