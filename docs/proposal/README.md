# Proposal

**Project Title:** Design and Deployment of a Secure Cloud-Based Patient Data Management System using a Three-Tier Architecture on AWS

**Student:** Mohamed Omar Makhlouf — A23CS4014
**Supervisor:** Johan Mohamad Sharif
**Approved:** 15 April 2026

## Summary

The proposal defines a secure cloud migration for Alamin Clinic (Saudi Arabia), which suffered a ransomware attack on its flat on-premise infrastructure. The proposed system rebuilds the clinic's patient data management on AWS using:

- Three-tier VPC architecture (Web → App → DB across isolated subnets)
- Terraform IaC for automated, reproducible deployments
- DevSecOps CI/CD pipeline (GitHub Actions + Trivy + SonarQube + Checkov)
- IAM/RBAC access control and data encryption (AES-256/KMS + TLS)
- Compliance measurement against HIPAA using AWS Security Hub

## Files

- `PSM1.PF_05 MOHAMED OMAR MAKHLOUF A23CS4014 RE.pdf` — signed and approved proposal form
- `PROPOSAL SLIDES.pdf` — presentation slides
