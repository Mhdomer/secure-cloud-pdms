---
layout: post
title: "Chapters 3 & 4: How I'm Building It and What I'm Building"
date: 2026-05-02
categories: [fyp, methodology, design, aws, devsecops, database]
---

Two chapters in one session. Chapter 3 (Methodology) and Chapter 4 (Requirement Analysis and Design) are both written and committed. PSM1 is done — all four chapters complete.

Here's what went into each one.

## Chapter 3 — Why Agile + DevSecOps

The first question any methodology chapter has to answer: why this and not something else?

I looked at three options. **Waterfall** is out — healthcare security requirements are discovered iteratively, and a model where testing comes after implementation means security problems surface at the worst possible time. **Standard Scrum** is better but doesn't say anything about when security checks happen, which means they drift to the end of the sprint. That's the reactive posture I'm trying to replace.

**Agile with DevSecOps integration** wins because it puts security gates *inside* the sprint cycle, not after it. Every commit triggers three scanners — Trivy (container CVEs), SonarQube (source code), Checkov (Terraform config). A critical finding blocks the pipeline. The deployment never happens. Security is not a phase; it's a property of every increment.

The project runs in five sprints. Sprint 1 is PSM1 — requirements and architecture. Sprints 2 through 5 are PSM2 — build, harden, test, evaluate. Each sprint has a defined security gate that must clear before the next one starts.

The requirements section produced **12 functional requirements** and **11 non-functional requirements**, each with a specific verification method. The non-functional ones are the interesting ones — they set the measurable targets:

- RTO under 15 minutes (Terraform wipe-and-redeploy stress test)
- 99.9% availability (multi-AZ CloudWatch metric)
- HIPAA posture score via AWS Security Hub
- Zero critical CVEs in deployed containers
- All data encrypted at rest (AES-256/KMS) and in transit (TLS 1.2+)

These aren't vague goals — they're things I can actually measure and report in Chapter 5.

## Chapter 4 — The Design

This is the chapter I was most looking forward to writing. Everything from the literature and methodology had to translate into concrete decisions here.

### The VPC

Six subnets across two Availability Zones — public (ALB + NAT Gateway), private application (EC2), isolated database (RDS). The database subnets have a single route: `10.0.0.0/16` local. No NAT, no internet gateway. There is no path from the internet to the RDS instance. That's the direct fix for the flat network that got Alamin Clinic hit.

Security is layered at three independent levels:
1. **Security Groups** — instance-level. ALB only accepts 443/80. EC2 only accepts traffic from the ALB security group. RDS only accepts port 5432 from the EC2 security group.
2. **Network ACLs** — subnet-level, stateless. Second line of defence. Even if a Security Group rule were accidentally modified, the NACL independently blocks anything that shouldn't reach the DB subnet.
3. **IAM** — resource level. EC2 instance profile with least-privilege permissions. No hardcoded credentials anywhere.

### The Database

I went with PostgreSQL over MongoDB. The decision came down to one feature: **row-level security (RLS)**. PostgreSQL lets you define policies that filter rows at the database engine level based on the current session's role.

That means the RBAC model isn't just enforced in the Flask application code — it's enforced by the database itself. A doctor session can only see rows where `doctor_id = current_user`. A patient session can only see rows where `patient_id = current_user`. If something bypasses the application layer, the database independently rejects the query.

The schema is six tables: `users`, `patients`, `doctors`, `medical_records`, `appointments`, `audit_log`. The `audit_log` is append-only — every data access event writes a row with the user, action, target record, and timestamp. That's the HIPAA audit control satisfied at the application data level, separate from CloudTrail which operates at the AWS API level.

### The Pipeline Design

Six stages in GitHub Actions: Code Checkout → SonarQube SAST → Docker Build → Trivy Image Scan → Checkov IaC Scan → Terraform Apply. Stages 2, 4, and 5 can block. If any of them finds a critical issue, the pipeline stops and nothing is deployed.

The ordering matters: SonarQube runs on source code before the Docker image is even built. Checkov runs on Terraform files before any infrastructure is provisioned. Problems are caught at the cheapest possible point.

### The Interfaces

Four wireframes: Login, Doctor Dashboard, Admin Dashboard, Patient Portal.

The design principle I held throughout: each interface should make it *visually obvious* which role you're in and what you can't do. The Admin Dashboard has no path to medical record content — not hidden, not permission-denied, just absent. The Patient Portal has no create or edit controls anywhere on the screen. Role isolation should be visible in the UI, not just enforced in the backend.

## PSM1 Complete

That's all four chapters written and committed:

| Chapter | Title | Status |
|---------|-------|--------|
| 1 | Introduction | ✅ |
| 2 | Literature Review | ✅ |
| 3 | System Development Methodology | ✅ |
| 4 | Requirement Analysis and Design | ✅ |

What's left before submission: producing the 13 diagrams and wireframes flagged throughout the chapters, writing the front matter (abstract in English and Bahasa Melayu, abbreviations list, dedication, acknowledgement), and the final UTM formatting pass.

PSM2 is implementation. The design is done — time to build.
