---
tags: [fyp, psm1, aws, architecture, diagram-reference]
status: active
created: 2026-05-02
---

# AWS Components — Architecture Diagram Reference

Every AWS component used in the system, grouped by tier. Use this as your checklist when building Figure 4.2 in draw.io.

**How to find icons in draw.io:**  
Extras → Edit Diagram, or use the search bar in the shape panel. Search the exact service name listed under each component. Make sure you enable the "AWS 19" or "AWS 4" shape library (Extras → Edit Diagrams → search shapes or go to View → Shapes → AWS).

---

## Zone 1 — Internet / External

### Internet (User Traffic)
- **draw.io shape:** `Internet` (General shape) or cloud icon
- **Count:** 1
- **Role in system:** Represents the public internet — the source of all incoming HTTPS requests from clinic users (doctors, admin, patients accessing the web app from their browsers)
- **Sits:** Outside the VPC boundary, at the top of the diagram

---

### GitHub + GitHub Actions
- **draw.io shape:** Use a plain rectangle labelled "GitHub Actions" — not an AWS shape
- **Count:** 1 box (can show GitHub logo manually)
- **Role in system:** Source code repository and CI/CD pipeline host. Triggers the build/scan/deploy pipeline on every push to `main`. External to AWS but feeds into ECR and Terraform.
- **Sits:** Outside the VPC, on the right side of the diagram, with an arrow pointing into ECR

---

## Zone 2 — AWS Account Boundary

Everything below sits inside the AWS account. Draw a large outer rectangle labelled "AWS Account — ap-southeast-1 (Singapore)" to represent this.

---

## Zone 3 — VPC

Draw a second rectangle inside the account boundary labelled:  
**VPC: secure-clinic-vpc | CIDR: 10.0.0.0/16**

Everything from Zone 4 downward sits inside this VPC box.

---

## Zone 4 — Internet Gateway

### Internet Gateway (IGW)
- **draw.io shape:** `Internet Gateway` (AWS Network & Content Delivery)
- **Count:** 1
- **Role in system:** The entry/exit point between the public internet and the VPC. Attached to the VPC. Routes inbound traffic to the ALB in the public subnets and outbound responses back to the internet.
- **Sits:** On the VPC boundary, between the Internet (Zone 1) and the Public Subnets (Zone 5)
- **Connects to:** Internet (inbound arrow) → ALB (outbound arrow)

---

## Zone 5 — Public Subnets (2x, one per AZ)

Draw two side-by-side boxes inside the VPC:
- `Public Subnet A — 10.0.1.0/24 — AZ: ap-southeast-1a`
- `Public Subnet B — 10.0.2.0/24 — AZ: ap-southeast-1b`

### Application Load Balancer (ALB)
- **draw.io shape:** `Application Load Balancer` (AWS Network & Content Delivery)
- **Count:** 1 (spans both public subnets — draw it across both AZ boxes or centred above them)
- **Role in system:** Receives all inbound HTTPS traffic (port 443) from the internet. Terminates TLS using the ACM certificate. Forwards decrypted traffic to EC2 instances in the private app subnets on port 5000. Redirects all HTTP (port 80) to HTTPS. The only public-facing entry point into the application.
- **Sits:** Public subnets
- **Connects to:** Internet Gateway (inbound) → EC2 instances in private app subnets (outbound)

### NAT Gateway
- **draw.io shape:** `NAT Gateway` (AWS Network & Content Delivery)
- **Count:** 1 (place in Public Subnet A — single NAT Gateway for cost efficiency at this scale)
- **Role in system:** Allows EC2 instances in the private app subnets to make outbound calls to the internet (e.g., to pull package updates, call the AWS API, send logs) without being directly reachable from the internet. Outbound-only. Patients and attackers cannot reach EC2 instances through the NAT Gateway.
- **Sits:** Public Subnet A
- **Connects to:** EC2 instances (receives outbound requests) → Internet Gateway (forwards outbound)

### AWS Certificate Manager (ACM)
- **draw.io shape:** `Certificate Manager` (AWS Security, Identity & Compliance)
- **Count:** 1
- **Role in system:** Manages and auto-renews the TLS/SSL certificate attached to the ALB. Enables HTTPS on the load balancer without manual certificate management. Satisfies NFR-02 (TLS 1.2+ encryption in transit).
- **Sits:** Draw as a small service box connected to the ALB with a dashed line labelled "TLS Certificate"
- **Connects to:** ALB

---

## Zone 6 — Private Application Subnets (2x, one per AZ)

Draw two side-by-side boxes inside the VPC below the public subnets:
- `Private App Subnet A — 10.0.3.0/24 — AZ: ap-southeast-1a`
- `Private App Subnet B — 10.0.4.0/24 — AZ: ap-southeast-1b`

### EC2 Instances (Auto Scaling Group)
- **draw.io shape:** `EC2 Instance` (AWS Compute) — draw 2 instances, one per AZ
- **Count:** 2 instances minimum (1 per AZ), managed by Auto Scaling Group
- **Role in system:** Runs the Docker-containerised Flask backend application. Receives forwarded HTTPS traffic from the ALB on port 5000. Connects to the RDS database on port 5432. Cannot be reached directly from the internet — only from the ALB Security Group.
- **Sits:** Private App Subnets A and B
- **Connects to:** ALB (inbound on port 5000) → RDS (outbound on port 5432) → NAT Gateway (outbound for AWS API calls)
- **Note:** Draw a small Docker whale icon or label "Docker Container" inside the EC2 box to indicate the app runs containerised

### Auto Scaling Group
- **draw.io shape:** `Auto Scaling` (AWS Compute)
- **Count:** 1 (wraps the EC2 instances — draw a dashed boundary around both EC2 boxes)
- **Role in system:** Automatically adds or removes EC2 instances based on CPU/memory load. Satisfies NFR-10 (horizontal scalability). Works with the ALB to distribute traffic across instances.
- **Sits:** Drawn as a dashed-border wrapper around the EC2 instances in both app subnets

### Amazon ECR (Elastic Container Registry)
- **draw.io shape:** `Elastic Container Registry` (AWS Compute)
- **Count:** 1
- **Role in system:** Private Docker image registry. The CI/CD pipeline pushes verified container images here after passing Trivy scan. EC2 instances pull the latest image from ECR during deployment. Images in ECR have already been scanned — no unscanned image can reach production.
- **Sits:** Draw outside the VPC box but inside the AWS account boundary, with an arrow from GitHub Actions (push) and an arrow to EC2 (pull)

---

## Zone 7 — Private Database Subnets (2x, one per AZ)

Draw two side-by-side boxes inside the VPC below the app subnets:
- `Private DB Subnet A — 10.0.5.0/24 — AZ: ap-southeast-1a`
- `Private DB Subnet B — 10.0.6.0/24 — AZ: ap-southeast-1b`

**Important visual note:** These subnets have NO arrow pointing to the internet or to the NAT Gateway. The only route is `10.0.0.0/16` local. Show this by having no outbound arrow leaving these subnets except back to the EC2 tier.

### Amazon RDS — PostgreSQL (Multi-AZ)
- **draw.io shape:** `RDS` (AWS Database) — draw two: one labelled "Primary" in AZ-a, one labelled "Standby" in AZ-b
- **Count:** 2 (Primary + Standby, automatically managed by RDS Multi-AZ)
- **Role in system:** Stores all patient records, user accounts, medical records, appointments, and audit logs. PostgreSQL engine with row-level security enabled. Encrypted at rest with KMS. Automated backups enabled with 7-day retention. The standby instance receives synchronous replication from the primary — in a failure event, RDS automatically promotes the standby with no manual intervention.
- **Sits:** Private DB Subnets A (Primary) and B (Standby)
- **Connects to:** EC2 instances (inbound on port 5432 only — no other source)
- **Draw a sync arrow** between Primary and Standby labelled "Synchronous Replication"

---

## Zone 8 — Security Controls (overlay on diagram)

These are not separate zones — draw them as annotations, dashed-border boxes, or small service icons overlaid on the relevant components.

### Security Groups (3 total)
- **draw.io shape:** `Security Group` (AWS Network & Content Delivery) — or use a small shield icon
- **Placement:** Small label/icon on each component they protect:
  - `alb-sg` → overlaid on ALB
  - `ec2-sg` → overlaid on EC2 instances
  - `rds-sg` → overlaid on RDS instances
- **Role in system:** Virtual firewalls at the instance level. Enforce the allow-list rules from Table 4.2. The chain alb-sg → ec2-sg → rds-sg means the only valid traffic path is internet → ALB → EC2 → RDS.

### Network ACLs (3 total)
- **draw.io shape:** `Network Access Control List` (AWS Network & Content Delivery) — or label the subnet boundary
- **Placement:** Label on the border of each subnet tier box:
  - `public-nacl` on Public Subnet borders
  - `app-nacl` on Private App Subnet borders
  - `db-nacl` on Private DB Subnet borders
- **Role in system:** Stateless subnet-level firewall. Second line of defence after Security Groups. The db-nacl independently blocks all traffic to port 5432 that doesn't come from the app subnets.

---

## Zone 9 — AWS Managed Services (outside VPC, inside account)

Draw these as service boxes outside the VPC rectangle, connected with dashed lines to the components they serve.

### AWS KMS (Key Management Service)
- **draw.io shape:** `Key Management Service` (AWS Security, Identity & Compliance)
- **Count:** 1
- **Role in system:** Manages the encryption key used to encrypt the RDS database at rest (AES-256). Satisfies NFR-01. The EC2 application never handles the raw encryption key — KMS manages it transparently.
- **Connects to:** RDS (dashed line labelled "Encrypts at rest — AES-256")

### AWS IAM (Identity and Access Management)
- **draw.io shape:** `Identity and Access Management` (AWS Security, Identity & Compliance)
- **Count:** 1
- **Role in system:** Defines the EC2 instance profile (permissions to write CloudWatch logs, read from SSM Parameter Store), the CI/CD deployment role (permissions to push to ECR, run Terraform), and user-facing RBAC roles enforced at the application layer. Satisfies NFR-03.
- **Connects to:** EC2 (dashed line labelled "Instance Role"), GitHub Actions (dashed line labelled "CI/CD Deploy Role")

### AWS Systems Manager — Parameter Store
- **draw.io shape:** `Systems Manager` (AWS Management & Governance)
- **Count:** 1
- **Role in system:** Securely stores the RDS database connection string and credentials as encrypted parameters. EC2 instances retrieve the credentials at startup via the SSM API — no credentials are hardcoded in the application code or Docker image.
- **Connects to:** EC2 (dashed line labelled "Fetch DB credentials at runtime")

### Amazon CloudWatch
- **draw.io shape:** `CloudWatch` (AWS Management & Governance)
- **Count:** 1
- **Role in system:** Collects application logs and system metrics from EC2 instances. Triggers alarms on anomalous activity (e.g., repeated auth failures, high error rate). Satisfies NFR-05 (availability monitoring) and NFR-09 (performance baseline). Dashboard provides the operations view.
- **Connects to:** EC2 (dashed line labelled "Logs + Metrics"), ALB (dashed line labelled "Access Logs")

### AWS CloudTrail
- **draw.io shape:** `CloudTrail` (AWS Management & Governance)
- **Count:** 1
- **Role in system:** Records every AWS API call made in the account — infrastructure changes, RDS access, IAM policy updates — and writes them to an S3 bucket. Creates an immutable audit trail. Satisfies NFR-08 (90-day log retention) and the HIPAA audit control requirement.
- **Connects to:** Entire VPC (dashed line labelled "API Audit Logging") → S3 (arrow labelled "Log storage")

### Amazon S3
- **draw.io shape:** `Simple Storage Service` (AWS Storage)
- **Count:** 1
- **Role in system:** Stores CloudTrail log files for the 90-day retention period required by NFR-08. Also stores the Terraform state file (with versioning enabled) so that the infrastructure definition is never lost.
- **Connects to:** CloudTrail (receives logs)

### AWS Security Hub
- **draw.io shape:** `Security Hub` (AWS Security, Identity & Compliance)
- **Count:** 1
- **Role in system:** Continuously evaluates the AWS account configuration against the HIPAA Security Standard. Aggregates findings from GuardDuty, Inspector, and Config. Provides the compliance posture score used to measure NFR-07. This is the primary evaluation tool in Sprint 5.
- **Connects to:** Entire account (dashed line labelled "HIPAA Posture Assessment")

---

## Complete Component Count Summary

| Component | AWS Service | Count | Tier |
|-----------|------------|-------|------|
| Internet Gateway | VPC | 1 | Network entry |
| NAT Gateway | VPC | 1 | Public subnet |
| Application Load Balancer | ELB | 1 | Public subnet |
| ACM Certificate | ACM | 1 | ALB attachment |
| EC2 Instances | EC2 | 2 (1 per AZ) | Private app |
| Auto Scaling Group | EC2 ASG | 1 | Private app |
| ECR Repository | ECR | 1 | Account level |
| RDS PostgreSQL Primary | RDS | 1 | Private DB |
| RDS PostgreSQL Standby | RDS | 1 | Private DB (Multi-AZ) |
| Security Groups | VPC | 3 (alb, ec2, rds) | Instance level |
| Network ACLs | VPC | 3 (public, app, db) | Subnet level |
| KMS Key | KMS | 1 | Account level |
| IAM Roles | IAM | 3+ (EC2, CI/CD, users) | Account level |
| SSM Parameter Store | SSM | 1 | Account level |
| CloudWatch | CloudWatch | 1 | Account level |
| CloudTrail | CloudTrail | 1 | Account level |
| S3 Bucket | S3 | 1 | Account level |
| Security Hub | Security Hub | 1 | Account level |
| **Total AWS components** | | **21** | |

---

## Draw Order (recommended)

Build the diagram in this order to avoid overlapping and repositioning:

1. Draw the outer AWS Account boundary rectangle
2. Draw the VPC rectangle inside it
3. Draw the 6 subnet rectangles (3 tiers × 2 AZs) inside the VPC
4. Place RDS Primary + Standby in DB subnets
5. Place EC2 instances + ASG wrapper in App subnets
6. Place ALB spanning both public subnets
7. Place NAT Gateway in Public Subnet A
8. Place Internet Gateway on VPC boundary
9. Add Internet cloud above IGW
10. Draw the vertical traffic flow arrows (Internet → IGW → ALB → EC2 → RDS)
11. Draw NAT Gateway outbound path (EC2 → NAT → IGW → Internet)
12. Add Security Group labels on ALB, EC2, RDS
13. Add NACL labels on subnet borders
14. Place KMS, CloudWatch, CloudTrail, Security Hub, S3 outside VPC
15. Add dashed connector lines from managed services to their targets
16. Place ECR outside VPC, add GitHub Actions box, draw CI/CD flow arrow
17. Add SSM Parameter Store with dashed line to EC2
18. Add ACM with dashed line to ALB
19. Label all CIDR blocks, AZs, and service names
20. Colour code: blue = public, orange = private app, red = DB
