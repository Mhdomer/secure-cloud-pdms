# Cloud Solution Architect Intern — Technical Interview Prep
## Project: Cloud-Native Clinic Management System on AWS

---

## 1. HIPAA Compliance in a Cloud Context

### What HIPAA Actually Is
HIPAA (Health Insurance Portability and Accountability Act, 1996) is a US federal law that sets standards for protecting sensitive patient health information. The part relevant to your system is the **Security Rule**, which mandates specific safeguards for **ePHI** (electronic Protected Health Information) — any individually identifiable health data stored or transmitted electronically.

HIPAA does not certify software. It certifies **processes and controls**. When you say your system is "HIPAA-aligned", you mean your architecture satisfies the Security Rule's three safeguard categories:

| Category | What It Means | Your Implementation |
|---|---|---|
| Technical Safeguards | Controls built into the system | RBAC, RLS, JWT, bcrypt, KMS, TLS |
| Physical Safeguards | Controls over physical hardware | AWS data centres (you inherit this) |
| Administrative Safeguards | Policies and procedures | IAM least privilege, CloudTrail audit log |

### The AWS Shared Responsibility Model and HIPAA
AWS operates under the **Shared Responsibility Model**:
- **AWS is responsible for:** Security *of* the cloud — physical data centres, hypervisor, network hardware
- **You are responsible for:** Security *in* the cloud — OS configuration, IAM policies, encryption keys, application security

For HIPAA, AWS will sign a **BAA (Business Associate Agreement)** with any covered entity or business associate. This is a legal contract where AWS accepts liability for the safeguarding of PHI on their platform. Not all AWS services are HIPAA-eligible — your system specifically uses only eligible services: EC2, RDS, S3, ALB, KMS, CloudWatch, CloudTrail.

### How Your Architecture Satisfies Specific HIPAA Requirements

**§164.312(a)(1) — Access Control:**
Your RBAC middleware enforces role-based access at the API layer. PostgreSQL Row-Level Security (RLS) enforces it again at the database layer. Even if the application layer is compromised, RLS prevents a Doctor from reading another doctor's patient records because the PostgreSQL session variable `app.current_user_id` is set per-request and the RLS policy filters every SELECT accordingly.

**§164.312(b) — Audit Controls:**
Every data access and mutation writes to the `audit_log` table (userId, action, resource, ipAddress, timestamp). AWS CloudTrail independently records every AWS API call. These are two separate audit streams — one application-level, one infrastructure-level — so neither can be selectively tampered with to hide an incident.

**§164.312(e)(1) — Transmission Security:**
TLS is terminated at the ALB. The ALB uses `ELBSecurityPolicy-TLS13-1-2`, enforcing TLS 1.2 minimum. The connection between EC2 and RDS uses SSL enforced via the RDS parameter group (`rds.force_ssl = 1`). There is no plaintext path anywhere in the data flow.

**Interview defence:** *"HIPAA is not about passing a checklist — it's about demonstrating that at each layer, access is controlled, all access is auditable, and data is encrypted everywhere. I deliberately chose defence-in-depth so that if any single control fails, two others still hold."*

---

## 2. Three-Tier Architecture

### What It Is
A three-tier architecture separates an application into three logical and physical layers:

```
Tier 1 — Presentation   → React frontend (S3 + CloudFront)
Tier 2 — Application    → Node.js/Express API (EC2, private subnet)
Tier 3 — Data           → PostgreSQL (RDS, isolated private subnet)
```

### Why Three Tiers Instead of Monolithic
| Concern | Monolithic | Three-Tier |
|---|---|---|
| Security | All components share same attack surface | Each tier has independent security boundary |
| Scalability | Scale the whole app even if only DB is bottleneck | Scale each tier independently |
| Failure isolation | One bug can crash everything | Application crash cannot corrupt database tier |
| Compliance | Hard to prove access boundaries | Clear, auditable network paths between tiers |

### How Tiers Map to Your AWS Design
- **Tier 1 (Presentation):** React is compiled to static files and hosted on S3. CloudFront serves them globally with edge caching. This tier has **zero server-side state** — it is pure content delivery. It lives entirely outside the VPC, eliminating it from the attack surface of the application and database tiers.
- **Tier 2 (Application):** Node.js/Express runs in Docker containers on EC2 in a **private application subnet**. It is only reachable via the ALB — no direct internet access. All business logic and security enforcement lives here.
- **Tier 3 (Data):** RDS PostgreSQL in a **private database subnet** that has no route to the internet, period. It only accepts connections from the EC2 Security Group on port 5432.

**Interview defence:** *"The key architectural principle is that data never moves to a less trusted zone. The database talks only to the application tier, the application tier talks only through the load balancer, and the frontend talks only to the API — never directly to the database."*

---

## 3. VPC and Subnet Isolation

### What a VPC Is
A VPC (Virtual Private Cloud) is a logically isolated section of the AWS cloud where you define your own IP address space, subnets, routing tables, and gateways. It is the fundamental network boundary for your system.

Your VPC: `10.0.0.0/16` — this gives you 65,536 available IP addresses across all subnets.

### What Makes a Subnet Public or Private
**This is a common interview trap.** A subnet is not public or private based on its CIDR range. It is public or private based on its **route table**:

| Route Table Entry | Means |
|---|---|
| `0.0.0.0/0 → Internet Gateway` | Public subnet — instances can receive inbound internet traffic |
| `0.0.0.0/0 → NAT Gateway` | Private subnet — instances can initiate outbound traffic but cannot receive inbound |
| No `0.0.0.0/0` route | Fully isolated — no internet access at all |

Your subnets:
```
Public Subnet   10.0.1.0/24  → route: 0.0.0.0/0 → IGW   (ALB, NAT Gateway live here)
Private App     10.0.2.0/24  → route: 0.0.0.0/0 → NAT   (EC2 lives here)
Private DB      10.0.3.0/24  → no 0.0.0.0/0 route       (RDS lives here, fully isolated)
```

### Why Multi-AZ
You deploy across two Availability Zones (e.g. ap-southeast-1a and ap-southeast-1b). Each AZ is a physically separate data centre with independent power and networking. RDS Multi-AZ maintains a synchronous standby replica in the second AZ. If the primary AZ fails, RDS automatically fails over to the standby — typically within 60–120 seconds — with no manual intervention. This satisfies HIPAA's requirement for contingency planning.

**Interview defence:** *"The AZ boundary is the blast radius boundary. A hardware failure, flood, or power outage in one AZ does not affect the other. For a medical system where downtime means delayed care, this is a baseline requirement, not an optional enhancement."*

---

## 4. NAT Gateway

### What It Does
NAT (Network Address Translation) Gateway allows instances in **private subnets** to initiate **outbound** connections to the internet while remaining unreachable from the internet on inbound connections.

Without NAT Gateway, your EC2 instance in the private subnet cannot:
- Pull Docker images from Docker Hub
- Download npm packages
- Call the AWS API (e.g. to write CloudWatch logs or call KMS)
- Receive OS security patches

### How It Works
1. EC2 instance (private IP `10.0.2.14`) sends a packet to `54.230.1.100` (npm registry)
2. Packet hits the subnet route table: `0.0.0.0/0 → NAT Gateway`
3. NAT Gateway replaces the source IP with its own **Elastic IP** (public IP)
4. Response comes back to NAT Gateway's Elastic IP
5. NAT Gateway translates it back and forwards to EC2's private IP
6. The npm registry never learns the EC2's private IP address

**The critical point:** NAT Gateway only tracks outbound connection state. An inbound packet with no corresponding outbound connection record is silently dropped. The internet cannot initiate a connection to your EC2.

### NAT Gateway vs NAT Instance
| | NAT Gateway | NAT Instance |
|---|---|---|
| Management | Fully managed by AWS | You manage the EC2 |
| Availability | Built-in HA within AZ | Single point of failure unless you script failover |
| Bandwidth | Up to 100 Gbps | Limited by instance type |
| Cost | Per-hour + per-GB data processed | EC2 instance cost |
| Use case | Production | Dev/test to save money |

**Interview defence:** *"I chose NAT Gateway over a NAT instance because this is a medical system — the 10-minute window to detect and replace a failed NAT instance is unacceptable when doctors need to access patient records during an emergency."*

---

## 5. Security Groups vs Network ACLs

### Security Groups
Security Groups are **stateful, instance-level** virtual firewalls.

**Stateful** means: if you allow an inbound request on port 3000, the response traffic is automatically allowed out, regardless of outbound rules. The firewall tracks connection state.

**Instance-level** means: the SG is attached to an ENI (Elastic Network Interface) of a specific EC2 instance or RDS instance. Rules apply to that specific resource.

**Rules: allow-list only.** You cannot write a deny rule in a Security Group. Everything not explicitly allowed is implicitly denied.

Your three Security Groups:

```
ALB-SG:
  Inbound:  TCP 443 from 0.0.0.0/0  (HTTPS from internet)
  Inbound:  TCP 80 from 0.0.0.0/0   (HTTP → redirect to HTTPS)
  Outbound: All to EC2-SG

EC2-SG:
  Inbound:  TCP 3000 from ALB-SG only   ← NOT from internet
  Outbound: TCP 5432 to RDS-SG
  Outbound: TCP 443 to 0.0.0.0/0        (via NAT → AWS APIs, npm)

RDS-SG:
  Inbound:  TCP 5432 from EC2-SG only   ← database unreachable from everywhere else
  Outbound: None needed (RDS doesn't initiate)
```

**Key design decision — SG chaining:** Instead of allowing EC2-SG to reference `10.0.1.0/24` (the ALB subnet), you reference the ALB-SG directly. This means only the specific ALB that has `ALB-SG` attached can reach EC2 — not any other resource that happens to be in the same subnet.

### Network ACLs (NACLs)
NACLs are **stateless, subnet-level** firewalls.

**Stateless** means: you must explicitly allow both inbound AND outbound traffic. A rule allowing inbound TCP 443 does NOT automatically allow the response to go out. You must also add an outbound rule for ephemeral ports (1024–65535) to allow responses.

**Subnet-level** means: the NACL applies to every resource in the subnet, not just specific instances.

**Rules: allow and deny.** Unlike Security Groups, you CAN write explicit deny rules. Rules are evaluated in order by rule number — the first match wins.

### When to Use Each
| Scenario | Use |
|---|---|
| Block a specific malicious IP | NACL (because SG can't deny) |
| Allow only the ALB to reach EC2 | Security Group (SG chaining) |
| Emergency block entire subnet | NACL |
| Fine-grained instance-to-instance rules | Security Group |
| Compliance requirement for perimeter firewall | NACL |

**Defence-in-depth:** Both are active simultaneously. Traffic must pass through the NACL (subnet boundary) AND the Security Group (instance boundary). A misconfigured SG rule is caught by the NACL. A misconfigured NACL is caught by the SG. Neither is a single point of failure.

**Interview defence:** *"Security Groups are my primary control because they're stateful and easier to reason about. NACLs are my backstop — if a developer accidentally opens port 22 in a Security Group, the NACL still blocks SSH traffic at the subnet boundary before it reaches any instance."*

---

## 6. IAM Policy Design

### Core Concepts
**IAM Identity types:**
- **User:** Long-term credentials for a human or application. Avoid for EC2 — never hardcode access keys in application code.
- **Role:** Temporary credentials assumed by a service or resource. EC2 assumes an IAM Role — it never has a static access key.
- **Group:** Collection of users sharing the same policies.
- **Policy:** JSON document defining permissions.

### Policy Structure
Every IAM policy statement has five elements:

```json
{
  "Effect": "Allow",           // Allow or Deny
  "Action": "s3:GetObject",    // What operation (or * for all)
  "Resource": "arn:aws:s3:::my-bucket/*",  // Which resource
  "Principal": "...",          // Who (only in resource-based policies)
  "Condition": {               // Optional: MFA required, IP range, etc.
    "Bool": { "aws:MultiFactorAuthPresent": "true" }
  }
}
```

### Your IAM Design — Three Roles

**EC2 Application Role:**
```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",   // DB credentials from Secrets Manager
    "kms:Decrypt",                     // Decrypt RDS data
    "logs:CreateLogGroup",             // Write to CloudWatch Logs
    "logs:PutLogEvents",
    "s3:PutObject"                     // Write static assets
  ],
  "Resource": "arn:aws:*:*:*:specific-resource-arns-only"
}
```

**RDS Admin Role:** `rds:DescribeDBInstances`, `rds:CreateDBSnapshot` — monitoring and backup only, no data access.

**CI/CD Pipeline Role:** `ecr:PutImage`, `ecs:UpdateService`, `s3:Sync` — deploy permissions only, no production data read access.

### Principle of Least Privilege
Every role has **only the permissions it needs to perform its specific function**. The EC2 role cannot delete RDS instances. The CI/CD role cannot read patient data. The Admin IAM user cannot modify KMS keys.

**How to defend least privilege in an interview:**
1. Start with zero permissions
2. Add only what the service needs to function
3. Scope to specific resources (ARNs), not `*`
4. Use conditions to add further restrictions (e.g. `aws:SourceVpc` to ensure API calls only come from inside your VPC)

### Instance Profile
An Instance Profile is the container that holds an IAM Role and allows EC2 instances to assume it. When your Node.js application calls the AWS SDK (e.g. to write CloudWatch logs), the SDK automatically retrieves temporary credentials from the EC2 Instance Metadata Service (IMDS) at `169.254.169.254` — no hardcoded keys ever appear in the application code or environment variables.

**Interview defence:** *"I never use IAM users with long-term access keys in EC2. Roles with temporary credentials that auto-rotate every 15 minutes are more secure and require no secret management on my part. If the EC2 is compromised, the attacker gets credentials that expire in minutes, not permanent API keys."*

---

## 7. Terraform IaC Best Practices

### What Terraform Is
Terraform is a declarative Infrastructure as Code tool. You describe the desired end state of your infrastructure in HCL (HashiCorp Configuration Language). Terraform calculates the difference between the desired state and the current state, then makes only the necessary API calls to achieve the desired state.

### Core Workflow
```
terraform init    → downloads provider plugins (AWS provider)
terraform plan    → shows what will be created/modified/destroyed (dry run)
terraform apply   → executes the plan
terraform destroy → tears down everything
```

### State Management
Terraform tracks the current state of all resources in a **state file** (`terraform.tfstate`). This is the source of truth Terraform uses to calculate diffs.

**Problem with local state:** If two developers run `terraform apply` simultaneously, they both read the same state, both calculate diffs, and one overwrites the other's changes — state corruption.

**Solution — Remote state with S3 + DynamoDB:**
```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"  # prevents concurrent applies
  }
}
```

DynamoDB provides **state locking** — a distributed lock that prevents two `terraform apply` commands from running simultaneously.

### Why IaC for Your Project
1. **Reproducibility:** Destroy and rebuild the entire AWS environment in under 10 minutes from a `terraform apply`. This directly addresses the ransomware recovery objective — you don't restore from backup, you rebuild from code.
2. **Version control:** Every infrastructure change is a git commit. You know exactly who changed what and when.
3. **Security scanning:** Checkov analyses the Terraform files statically before `terraform apply` runs. A misconfiguration (e.g. `storage_encrypted = false` on RDS) is caught at the code review stage, not after the resource is deployed.
4. **Idempotency:** Running `terraform apply` twice produces the same result. If the first apply partially failed, the second apply only creates what's missing.

### Checkov — IaC Security Scanner
Checkov reads your `.tf` files and checks them against a library of security policies:

```
checkov -d .
Check: CKV_AWS_17: "Ensure all data stored in the RDS instance is securely encrypted"
  PASSED for resource: aws_db_instance.main

Check: CKV_AWS_23: "Ensure every security groups rule has a description"
  FAILED for resource: aws_security_group.alb
```

In your CI/CD pipeline, Checkov runs in Stage 5. A `HIGH` or `CRITICAL` policy failure blocks the pipeline before `terraform apply` ever runs — infrastructure security is enforced at commit time, not deployment time.

**Interview defence:** *"Terraform gives me a recovery time objective of under 15 minutes for a complete environment rebuild. If a ransomware attack encrypted every EBS volume and RDS database, I don't restore — I destroy and rebuild from Terraform state stored in S3, which was never inside the VPC and is unaffected by the attack. The RTO is bounded by how long terraform apply takes, not how long backup restoration takes."*

---

## 8. CloudWatch vs CloudTrail

This is one of the most commonly confused pairs in AWS interviews.

### CloudWatch — Performance and Operations Monitoring

**What it is:** A monitoring and observability service. It answers: *"Is my system healthy right now?"*

**What it captures:**
- **Metrics:** CPU utilisation, memory, disk I/O, network in/out, request count, latency (automatically from AWS services; custom metrics from your application)
- **Logs:** Application logs, system logs, VPC Flow Logs (streamed from EC2 via CloudWatch Agent)
- **Alarms:** Trigger when a metric crosses a threshold (e.g. CPU > 80% for 5 minutes → SNS notification)
- **Dashboards:** Real-time visualisation of metrics

**Your CloudWatch implementation:**
- Log group: `/alamin-clinic/application` — Node.js application logs streamed from EC2
- Alarm: 5+ failed login attempts in 5 minutes → SNS email to admin (security monitoring)
- Alarm: HTTP 5xx error rate > 1% → operational alert
- Alarm: RDS CPU > 80% → capacity alert

**What CloudWatch does NOT capture:** Who called the AWS API. Who changed a Security Group. Who created an IAM user. That's CloudTrail's job.

---

### CloudTrail — API Audit Logging

**What it is:** A governance, compliance, and audit service. It answers: *"Who did what to my AWS infrastructure, and when?"*

**What it captures:**
Every AWS API call: `CreateInstance`, `ModifyDBInstance`, `DeleteBucket`, `AssumeRole`, `GetSecretValue`. Each event record includes:
- Who called it (IAM user/role ARN)
- When (timestamp to millisecond)
- From where (source IP address)
- What was requested (API name, parameters)
- What was returned (success/failure, response)

**Your CloudTrail implementation:**
- Trail enabled in all regions (not just ap-southeast-1) — catches any rogue API calls from unexpected regions
- Logs delivered to dedicated S3 bucket with **MFA delete** enabled — even an admin cannot delete CloudTrail logs without an MFA device
- Log file validation enabled — each log file has a SHA-256 hash so you can detect tampering
- Data events enabled for S3 bucket — records every `GetObject` (PHI read) on the patient data bucket

**CloudWatch Logs Integration:** CloudTrail can forward events to CloudWatch Logs, allowing you to create alarms on specific CloudTrail events. For example: alarm on any `DeleteTrail` API call (someone trying to cover their tracks) or `ConsoleLogin` from an unusual IP.

---

### Side-by-Side Comparison

| | CloudWatch | CloudTrail |
|---|---|---|
| Purpose | Monitor system health | Audit API activity |
| Data type | Metrics, logs, alarms | API call records |
| Real-time? | Yes, near real-time | 15-minute delivery to S3 |
| Who is it for? | DevOps, SRE | Security, Compliance, Forensics |
| Retention | Configurable (default 90 days for logs) | 90 days in console, indefinite in S3 |
| HIPAA requirement | §164.312(b) audit — partially | §164.312(b) audit — primarily |
| Example question answered | "Is the EC2 CPU spiking?" | "Who deleted the RDS snapshot?" |

**Interview defence:** *"CloudWatch tells me my system is under attack right now — I can see the failed login spike on a graph. CloudTrail tells me what the attacker did after they got in — every API call they made, every resource they touched, every credential they used. I need both: one for detection, one for forensics."*

---

## 9. The Ransomware Recovery Argument

This is your strongest differentiator — the original motivation for the project.

**The problem at Alamin Clinic:** A ransomware attack encrypted all patient records on a Windows Server. Recovery required restoring from backup (slow, unreliable, incomplete). Downtime: days to weeks.

**Your architectural answer to ransomware:**

| Attack Vector | Your Mitigation |
|---|---|
| Encrypt EBS volumes | RDS automated backups to S3 (outside VPC). Rebuild from `terraform apply` in 15 min. |
| Encrypt database | Point-in-time recovery up to 5 minutes before attack. Separate from EC2. |
| Encrypt application server | Docker container — rebuild from ECR image. Stateless by design. |
| Delete backups | S3 versioning + MFA delete on backup bucket. Backups require MFA to delete. |
| Lateral movement to other systems | VPC isolation. RDS is unreachable from anywhere except EC2-SG. |
| Exfiltrate patient data | KMS encryption — data encrypted at rest. Exfiltrated files are ciphertext without the key. |

**The key insight:** Traditional ransomware recovery restores data. Cloud-native ransomware recovery rebuilds infrastructure. The data is never at risk because: (1) it's encrypted with KMS at rest, (2) it's backed up automatically to a separate S3 bucket the application cannot write to, (3) the infrastructure is fully reproducible from Terraform code that lives in GitHub — outside AWS entirely.

---

## 10. Common Interview Questions and Answers

**Q: Why not just put everything in one subnet?**
A: Flat network architecture means a single compromised instance has a direct network path to the database. Subnet isolation forces attackers to pivot between security boundaries — each pivot is detectable via VPC Flow Logs and requires overcoming additional security controls.

**Q: Why not use RDS Aurora instead of RDS PostgreSQL?**
A: Aurora is architecturally superior (shared storage cluster, faster failover) but costs 2–3x more than RDS PostgreSQL. For a clinic at this scale, RDS Multi-AZ PostgreSQL provides sufficient availability (99.95% SLA) at a fraction of the cost. Aurora would be the right choice if the clinic grew to hundreds of concurrent connections.

**Q: How do you handle database credentials — are they in environment variables?**
A: No. Credentials are stored in AWS Secrets Manager and retrieved at startup via the EC2 IAM role. The application never sees the password in source code or environment variables. Secrets Manager also handles automatic credential rotation every 30 days without any application restart.

**Q: What happens if the KMS key is deleted?**
A: All encrypted data becomes permanently inaccessible. That's why KMS Customer Managed Keys have a 7-day minimum waiting period before deletion — it cannot be accidentally deleted in the same instant. Annual key rotation is enabled, which generates a new key version but retains the old version for decrypting data encrypted with it. Deleting the CMK entirely is a multi-step, time-delayed, audited operation.

**Q: Why S3 + CloudFront instead of serving React from EC2?**
A: Static files have no business logic. Serving them from EC2 wastes compute resources on file serving, adds the frontend to the VPC attack surface, and creates a scaling bottleneck. S3 + CloudFront removes the frontend from the VPC entirely, serves files from 400+ CloudFront edge locations for lower latency globally, and costs approximately 80% less than equivalent EC2 bandwidth. The frontend cannot be "hacked" in the traditional sense because it is static content with no execution environment.

**Q: What is the blast radius if the EC2 is compromised?**
A: The attacker has access to: (1) the Node.js application code running in memory, (2) temporary IAM role credentials that expire in 15 minutes and are scoped to specific AWS actions, (3) the ability to make API calls to RDS — but only through the application's parameterised query layer, not raw SQL, (4) whatever is in CloudWatch logs. They cannot access: RDS directly (blocked by Security Group), KMS keys (IAM policy restricts kms:Decrypt to specific resources), other AWS services not in the EC2 role policy, or other VPC resources (no lateral movement path exists).

---

*Last updated: May 2026 | Project: Secure Cloud-Based Patient Data Management System | Role: Cloud Solution Architect Intern — Microsoft*
