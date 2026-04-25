---
tags: [fyp, psm1, chapter-1, introduction]
phase: 1
status: complete
created: 2026-04-25
related: [[PHASES]], [[chapter-2-literature-review]]
---

# CHAPTER 1

## INTRODUCTION

---

### 1.1 Introduction

The rapid growth of digital health systems has fundamentally changed how patient data is collected, stored, and accessed across healthcare facilities worldwide. As clinics and hospitals transition from paper-based workflows to electronic health records, the underlying infrastructure responsible for protecting sensitive patient information has become a critical concern. Healthcare data is among the most valuable and targeted categories of information, with breaches carrying severe consequences for patient safety, regulatory compliance, and institutional trust.

Despite the urgent need for secure digital infrastructure, many small and medium-sized healthcare providers continue to operate on traditional on-premise server environments. These systems, while functional, were not designed to meet the evolving threat landscape of modern cybersecurity. They rely on manual configuration, reactive security patching, and flat network architectures that offer little isolation between system components — conditions that have repeatedly proven catastrophic when exploited by malicious actors.

This project addresses these vulnerabilities by designing and deploying a Secure Cloud-Based Patient Data Management System (PDMS) on Amazon Web Services (AWS). The system adopts a three-tier architecture, separating the presentation, application, and data layers across isolated network subnets within a Virtual Private Cloud (VPC). Infrastructure as Code (IaC) using Terraform enables automated, reproducible deployments, while a DevSecOps pipeline enforces security scanning at every stage of development before any code reaches the production environment.

The case study guiding this project is Alamin Clinic, a private healthcare provider in Saudi Arabia, whose on-premise infrastructure was compromised by a ransomware attack. This real-world incident provides the concrete requirements and constraints that shape the system design, making the project directly applicable to a genuine operational problem rather than a theoretical exercise.

---

### 1.2 Problem Background

Alamin Clinic currently operates its patient data management system on a single on-premise physical server. This server hosts the web frontend, application backend, and patient database simultaneously, with no network segmentation between layers. The infrastructure is maintained manually: IT staff configure the server by hand, developers transfer code to the production environment via FTP client or USB drive, and security measures such as firewalls and antivirus software are updated reactively, often with significant delays between the release of a patch and its application.

This flat, manual architecture proved critically vulnerable when the clinic suffered a ransomware attack. Attackers were able to penetrate the system, traverse the network without restriction, and encrypt the entire patient database — rendering all records inaccessible and halting clinical operations. The absence of network isolation meant that a single point of compromise was sufficient to affect every component of the system simultaneously. The absence of automated backups and a tested recovery process extended the outage significantly.

This incident reflects a well-documented pattern across the healthcare sector. Argaw et al. (2019) found that cyberattacks against hospitals frequently exploit outdated infrastructure, inadequate network segmentation, and the absence of systematic patch management. Al-Issa et al. (2019) further identified that healthcare cloud migration, when approached without a security-first design mindset, introduces its own risks — particularly around access control and data exposure. These studies confirm that the problem at Alamin Clinic is not isolated but representative of a systemic gap in how small healthcare providers approach information security.

The proposed solution addresses this gap by migrating the clinic's patient data management system to a cloud environment that is architected with security built in from the ground up. Rather than adding security controls as an afterthought, the system applies the principle of security by design: every architectural decision — from subnet isolation to IAM policy structure to the CI/CD pipeline configuration — is made with the security posture of the system as the primary constraint.

---

### 1.3 Project Aim

The aim of this project is to design and deploy a secure cloud-based Patient Data Management System for Alamin Clinic using a three-tier architecture on AWS, incorporating Infrastructure as Code and a DevSecOps pipeline to ensure automated, reproducible, and security-validated deployments.

---

### 1.4 Project Objectives

The objectives of this project are:

(a) To investigate core concepts including cloud computing security, three-tier architecture, network segmentation, Identity and Access Management, and secure system design practices within the context of healthcare applications.

(b) To design a secure Cloud-Based Patient Data Management System based on a three-tier architecture on AWS, covering Virtual Private Cloud networking, access control through IAM and Role-Based Access Control (RBAC), and a DevSecOps CI/CD pipeline with integrated security scanning.

(c) To evaluate the security, performance, and scalability of the designed system using automated vulnerability scanning tools and Recovery Time Objective (RTO) stress testing simulating a ransomware wipe-and-redeploy scenario.

---

### 1.5 Project Scope

This project focuses on the design and deployment of a Secure Patient Data Management System intended for use by doctors, administrative staff, and patients at Alamin Clinic. The system will be deployed on AWS as a functional prototype with security evaluation evidence provided through scan reports, CloudWatch logs, and recovery time test results.

#### In-Scope

The following areas are within the scope of this project:

(a) Core patient record management functionality, including Patient Registration, Medical Records Management, Appointment Scheduling, and User Authentication with Role Management (Doctor, Admin, Patient).

(b) Design of a Virtual Private Cloud (VPC) with public subnets for internet-facing components and private subnets for the application and database layers.

(c) Three-tier architecture comprising a React frontend layer, a Flask or Node.js backend layer on EC2, and a MySQL or PostgreSQL database layer on Amazon RDS.

(d) AWS services including VPC, EC2, RDS, Application Load Balancer (ALB), NAT Gateway, and Internet Gateway.

(e) Network security controls including Security Groups and Network Access Control Lists (ACLs).

(f) Identity and Access Management (IAM) with least-privilege policies and Role-Based Access Control (RBAC) enforced across all three user roles.

(g) Data encryption at rest using AES-256 through AWS Key Management Service (KMS) and encryption in transit using TLS/HTTPS.

(h) A DevSecOps CI/CD pipeline built on GitHub Actions with Docker containerisation and Terraform IaC, incorporating automated security scanning using Trivy (container images), SonarQube (static code analysis), and Checkov (IaC misconfiguration scanning).

(i) Monitoring and audit logging using Amazon CloudWatch and AWS CloudTrail, with defined alerting thresholds and log retention policies.

(j) HIPAA compliance posture assessment using AWS Security Hub.

#### Out-of-Scope

To maintain focus on the security architecture and infrastructure, the following modules are explicitly excluded from this project:

- Hospital billing and insurance claim management
- Pharmacy inventory and dispensing management
- Emergency Room (ER) management
- Obstetrics and Gynaecology (O&G) clinical modules

---

### 1.6 Project Importance

The importance of this project operates on three levels: clinical, technical, and academic.

At the clinical level, patient data is among the most sensitive categories of personal information. A breach or loss of availability — as occurred at Alamin Clinic — directly impacts patient care, erodes trust between patients and providers, and can have lasting reputational and legal consequences. Designing a system that ensures continuous availability, confidentiality, and integrity of patient records is therefore not merely a technical exercise but a matter of patient safety.

At the technical level, the project demonstrates how Infrastructure as Code and DevSecOps principles can transform a vulnerable, manually maintained system into a self-healing, security-validated infrastructure. By encoding the entire environment in Terraform, the system can be fully redeployed from a clean state within minutes — a capability that directly addresses the recovery problem exposed by the ransomware attack. The integration of automated security scanning into the deployment pipeline ensures that vulnerabilities are identified and blocked before they can reach production, shifting security left in the development lifecycle.

At the academic level, this project contributes a practical, case-study-grounded application of cloud security principles that bridges the gap between theoretical security frameworks and their real-world implementation. The use of HIPAA as a compliance benchmark and AWS Security Hub as the measurement tool provides a structured, industry-recognised evaluation framework that goes beyond conventional academic testing methodologies.

---

### 1.7 Report Organisation

This report is organised as follows:

**Chapter 2 — Literature Review** examines the background literature relevant to the project. It presents an analysis of the current system at Alamin Clinic, a comparison of existing healthcare management systems, and a review of the technologies and methods employed in the proposed solution, including cloud security frameworks, three-tier architecture, Infrastructure as Code, and DevSecOps practices.

**Chapter 3 — System Development Methodology** describes the development approach adopted for this project. It justifies the choice of methodology, outlines its phases as applied to this system, describes the technologies used, and presents the system requirements analysis.

**Chapter 4 — Requirement Analysis and Design** presents the detailed functional and non-functional requirements of the system, followed by the complete system design including the network architecture, database schema, IAM policy structure, and system interface design.

**Chapter 5 — Implementation and Testing** documents the implementation of the system, including the infrastructure provisioning, application code, and DevSecOps pipeline configuration. It presents the results of security scanning, black-box and white-box testing, and the Recovery Time Objective stress test.

**Chapter 6 — Conclusion** summarises the achievement of the project objectives, reflects on the limitations of the current implementation, and proposes directions for future improvement.

---

### References

Al-Issa, Y., Ottom, M. A., & Tamrawi, A. (2019). EHealth Cloud Security Challenges: A Survey. *Journal of Healthcare Engineering*, 2019. https://doi.org/10.1155/2019/7516035

Argaw, S., Bempong-Ahun, N., Eshaya-Chauvin, B., & Flahault, A. (2019). The state of research on cyberattacks against hospitals and available best practice recommendations: A scoping review. *BMC Medical Informatics and Decision Making*, 19. https://doi.org/10.1186/s12911-018-0724-5
