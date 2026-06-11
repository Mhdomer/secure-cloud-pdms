---
layout: post
title: "FYP Kickoff: Building a Secure Cloud Clinic on AWS"
date: 2026-04-25
categories: [fyp, aws, architecture]
---

## The Problem

A small clinic in Saudi Arabia gets hit by ransomware. Every patient record is encrypted. The attackers demand payment. The clinic is completely offline.

This wasn't a sophisticated attack — it was a predictable one. The clinic ran its entire operation on a single on-premise server: web, application, and database all on the same flat network. No isolation, no encryption at rest, no automated backups. One phishing email and it was over.

This is the real-world case study behind my Final Year Project.

## What I'm Building

**Secure Cloud-Based Patient Data Management System** — a three-tier AWS infrastructure designed so that this kind of attack can never succeed again.

The architecture is split into three isolated layers:

```
Internet → Application Load Balancer (Public Subnet)
                      ↓
           Backend on EC2 (Private App Subnet)
                      ↓
           RDS Database (Isolated Private DB Subnet)
```

Even if an attacker breaches the frontend, the database is physically unreachable — it lives in a private subnet with no path to the public internet.

## The Tech Stack

- **AWS VPC** with public/private subnet isolation
- **Terraform** — entire infrastructure as code, so it can be redeployed from scratch after any incident
- **GitHub Actions** CI/CD pipeline with Trivy, SonarQube, and Checkov scanning before every deployment
- **AWS IAM** with role-based access control (Doctor / Admin / Patient)
- **CloudWatch + CloudTrail** for monitoring and audit logging
- **HIPAA compliance** measured via AWS Security Hub

## Where I Am Now

The proposal was approved on 15 April 2026. PSM1 (this semester) is the design and documentation phase. I'm now working through the architecture design, IAM policy structure, and security threat model before implementation begins in PSM2.

This blog will document every major decision along the way.
