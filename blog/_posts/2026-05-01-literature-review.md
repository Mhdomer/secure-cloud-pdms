---
layout: post
title: "Chapter 2: What the Literature Says About Securing a Clinic in the Cloud"
date: 2026-05-01
categories: [fyp, literature-review, aws, devsecops]
---

Chapter 2 of my FYP report is done — the Literature Review. This is the chapter that justifies every technology choice before a single line of Terraform gets written.

Here's what I covered and what I learned in the process.

## The Alamin Clinic Deep Dive

The case study section forced me to think rigorously about *why* the ransomware attack happened — not just that it happened. The answer comes down to four failures:

1. **Flat network** — one server for web, app, and database with no internal boundaries
2. **Manual deployment** — code transferred via FTP or USB, no automated pipeline
3. **Reactive security** — patches applied after threats appeared, not before
4. **No recovery plan** — no tested backup, no documented process

Every one of these has a direct architectural countermeasure in the proposed system. The flat network → three-tier VPC with isolated subnets. Manual deployment → GitHub Actions CI/CD. Reactive security → shift-left scanning with Trivy, SonarQube, Checkov. No recovery plan → Terraform redeploy from clean state.

## Why Existing Systems Don't Fit

I compared four systems: traditional on-premise HMS, OpenEMR, Epic Systems, and the proposed solution. The gap is clear:

- **On-premise / OpenEMR**: affordable but dumps all security responsibility on IT staff (exactly how the clinic got hit)
- **Epic Systems**: enterprise-grade security but costs that small clinics can never justify
- **Proposed**: cloud-native, automated security, accessible cost

No existing solution threads that needle for a small private clinic. That's the actual justification for building something new.

## The Technology Review

Seven technology areas, all tied back to the design:

**Cloud computing in healthcare** — Ahuja et al. (2012) flagged the same access control and compliance concerns I'm designing around. Al-Issa et al. (2019) mapped unauthorised access, integrity violations, and availability failures directly — those three categories map to IAM, CloudTrail, and multi-AZ deployment respectively.

**Three-tier architecture** — Not just a design pattern. It's a security boundary. The database subnet has zero path to the internet. That's the core defence.

**AWS Shared Responsibility Model** — AWS secures the cloud, I'm responsible for security *in* the cloud. This distinction clarifies exactly what my system needs to do: network controls, IAM, encryption, application security.

**Terraform IaC** — The self-healing argument. Infrastructure that lives in code can be redeployed in minutes after a wipe. Paidy & Chaganti (2024) validated this for multi-region AWS deployments.

**DevSecOps / Shift-Left** — Security integrated at every commit, not bolted on at the end. Three scanners: Trivy (containers), SonarQube (source code), Checkov (infrastructure config).

**IAM + RBAC** — Singh & Chatterjee (2015) established that multi-layer access control is essential in cloud environments. Not just an application login screen — enforcement at the network and resource level too.

**HIPAA** — The compliance benchmark. AWS Security Hub provides continuous posture assessment against HIPAA controls. This is how I'll measure whether the security design actually works.

## Next: Chapter 3 — Methodology

The literature is done. Next I justify the *process*: why Agile with DevSecOps sprints, how the methodology phases map to the project timeline, and the full system requirements analysis.
