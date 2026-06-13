# PSM 1 Viva — Full Project Walkthrough & Examiner Q&A
**Student:** Mohamed Omar Makhlouf | SECRH | UTM Johor Bahru
**Supervisor:** Johan Mohamed Sharif
**Viva:** 2 days away — read this, understand it, speak it out loud

> Do not memorise. Understand the reasoning behind every decision. Examiners will rephrase questions. If you know WHY you made each choice, you can answer any variation.

---

# PART 1 — THE FULL PROJECT STORY (know this cold)

## What is this project, in one sentence?
A secure, cloud-based patient data management system for a private clinic, built on AWS with a three-tier architecture, three-layer RBAC, and a DevSecOps CI/CD pipeline — designed specifically to prevent a repeat of the ransomware attack that destroyed Alamin Clinic's records in 2023.

---

## The Problem (Chapter 1 + Chapter 2)

**Alamin Clinic** is a private clinic in Saudi Arabia. Before the attack, they ran everything on a single Windows server — patient records, appointments, doctor notes. No access control. All staff used the same shared login. No backup. No audit trail.

**May 2023:** Ransomware encrypted every file on that server. The clinic was blind for 5 days. Patient records were permanently lost. They had no way to investigate who was responsible because there was no log of any access.

**Root cause analysis revealed three specific gaps:**

| Gap | What it means | Real consequence |
|---|---|---|
| P1 — No RBAC | Any staff member could read any record | No data isolation between roles |
| P2 — No audit trail | No log of who did what | Forensic investigation impossible |
| P3 — No disaster recovery | No backup, no IaC, no recovery plan | 5-day downtime, permanent data loss |

**Why does this matter beyond one clinic?**
Healthcare data breaches are the most expensive per-record of any industry ($429/record average, IBM 2023). Malaysian clinics are not exempt — PDPA 2010 carries legal penalties for data breaches. This is a real, unsolved problem at scale.

---

## The Solution (Chapter 4)

A three-tier AWS system that closes all three gaps simultaneously:

| Gap | Solution |
|---|---|
| No RBAC | 3-layer RBAC: JWT + AWS IAM + PostgreSQL RLS |
| No audit trail | CloudTrail (AWS API level) + audit_log table (data level) |
| No disaster recovery | Terraform IaC — full rebuild in under 15 minutes |

---

## The Architecture (know every component)

```
INTERNET
    ↓ HTTPS only (port 443)
┌─────────────────────────────────────────┐
│  PUBLIC SUBNET (ap-southeast-1)         │
│  Application Load Balancer (ALB)        │
│  NAT Gateway                            │
└────────────────┬────────────────────────┘
                 ↓ port 3000 (ALB-SG → EC2-SG only)
┌─────────────────────────────────────────┐
│  PRIVATE APPLICATION SUBNET             │
│  EC2 — Node.js / Express API            │
│  (S3 + CloudFront for React frontend)   │
└────────────────┬────────────────────────┘
                 ↓ port 5432 (EC2-SG → RDS-SG only)
┌─────────────────────────────────────────┐
│  PRIVATE DATABASE SUBNET                │
│  RDS PostgreSQL (Multi-AZ)              │
│  Row-Level Security active              │
│  AES-256 encryption at rest (KMS)       │
└─────────────────────────────────────────┘
```

**Cross-cutting controls (apply to all tiers):**
- Security Groups (instance-level stateful firewall)
- Network ACLs (subnet-level stateless firewall)
- AWS IAM least-privilege roles per service
- CloudTrail (logs every AWS API call, MFA-delete protected)
- Terraform IaC (entire infrastructure as code in Git)

---

## The Security Design (3-layer RBAC)

The single most important design decision. Each layer is independent — bypassing one does not bypass the others.

**Layer 1 — JWT at Application Layer**
- After login, server issues a JWT signed with HMAC-SHA256
- Stored as httpOnly + Secure + SameSite=Strict cookie
- httpOnly = JavaScript cannot read it → XSS cannot steal it
- Contains: userId, role, expiry (15 min access token, 7 days refresh)
- Every API endpoint validates the JWT and checks the role before processing
- bcrypt cost factor 12 on all passwords (~250ms per hash → brute force infeasible)
- Account lockout after 3 failed attempts → isActive = false, admin notified

**Layer 2 — AWS IAM at Infrastructure Layer**
- EC2 has an IAM Role (not a user with access keys — temporary credentials that auto-rotate)
- EC2 role can: write CloudWatch logs, read Secrets Manager, call KMS decrypt
- EC2 role cannot: reach RDS directly through IAM, delete S3 bucket, modify security groups
- S3 bucket: all public access blocked, CloudFront uses OAI (Origin Access Identity)

**Layer 3 — PostgreSQL RLS at Database Layer**
- Even if someone bypasses Layers 1 and 2 (e.g. a compromised API), the database itself enforces access
- medical_records: `WHERE doctor_id = current_setting('app.current_user_id')`
- patients: Doctor can only SELECT where `assigned_doctor_id = their doctorId`
- audit_log: INSERT only — UPDATE and DELETE are denied at policy level
- This is enforced at the PostgreSQL storage engine, not in application code

---

## The DevSecOps Pipeline (6 stages)

Security is automated, not manual. No vulnerable code can reach production.

```
[1] Code Checkout
        ↓
[2] SonarQube SAST
    → Scans source code for security vulnerabilities
    → BLOCKS on any CRITICAL finding
        ↓
[3] Docker Build
    → Containerise the Node.js app
        ↓
[4] Trivy Image Scan
    → Scans Docker image for known CVEs (Common Vulnerabilities and Exposures)
    → BLOCKS on CRITICAL severity CVEs
        ↓
[5] Checkov IaC Scan
    → Scans Terraform .tf files for misconfigurations
    → BLOCKS on HIGH or CRITICAL policy failures
        ↓
[6] Terraform Apply
    → ONLY runs if stages 2, 4, and 5 ALL passed
    → Deploys infrastructure to AWS
```

---

## The Database Design (6 tables)

| Table | Purpose | Key security feature |
|---|---|---|
| users | Authentication — username, bcrypt hash, role, isActive | isActive lockout field |
| patients | Patient demographics, assigned_doctor_id | RLS on assigned_doctor_id |
| doctors | Doctor profiles, linked to user account | |
| medical_records | Diagnoses, prescriptions, notes | RLS — doctor_id must match session |
| appointments | Schedule links patient + doctor + time | RLS — scoped to session user |
| audit_log | Immutable record of all data actions | INSERT only, no UPDATE/DELETE |

**UUID primary keys throughout** — no sequential integer IDs means attackers cannot enumerate records by guessing IDs.

---

## The Methodology (Chapter 3)

**Agile + DevSecOps across 5 sprints.**

Why Agile over Waterfall? Because requirements evolved through stakeholder interviews. The clinic staff did not know exactly what they needed until they were asked specific questions. Waterfall requires freezing requirements upfront — that would have produced the wrong system.

Why DevSecOps? Because in traditional development, security is a final-phase review. By that point, fixing security issues is expensive. DevSecOps integrates security scanning at every commit — problems are caught when they are cheapest to fix.

**Sprints:**
- Sprint 1 (PSM 1): Requirements, architecture design, all deliverables in this presentation ← COMPLETED
- Sprint 2–5 (PSM 2): Network deployment, application implementation, security integration, testing

**Requirements gathered through:** 2 structured stakeholder interviews — clinic administrator (operational perspective) and attending physician (clinical perspective). 14 interview questions across 3 sections: current workflow, security incidents, and requirements for a new system.

Result: 12 Functional Requirements, 11 Non-Functional Requirements.

---

# PART 2 — EXAMINER QUESTIONS BY TOPIC

---

## TOPIC A — Problem & Motivation

**Q: Why did you choose Alamin Clinic specifically?**
A: It provided a concrete, documented case study with a specific ransomware incident that exposed measurable security gaps. It gave the research a real-world grounding rather than hypothetical problems. The three gaps — no RBAC, no audit trail, no DR — are common across small private clinics in Malaysia and the region, so the solution has broader applicability.

**Q: Is Alamin Clinic a real place? How did you get access?**
A: Yes, it is a real private clinic. Access was through a personal contact. Two structured interviews were conducted — one with the clinic administrator and one with an attending physician. The interview protocol is documented in Appendix F of the report.

**Q: Could this problem not have been solved by simply installing antivirus software?**
A: Antivirus addresses one attack vector — known malware signatures. It does not address the structural gaps. Even with antivirus: shared credentials still allow unauthorised internal access, there is still no audit trail for forensics, and there is still no recovery plan. The 5-day recovery was not caused by the ransomware alone — it was caused by having no backup and no infrastructure that could be quickly rebuilt. The solution needs to be architectural, not just protective.

**Q: Why is HIPAA compliance relevant to a Malaysian clinic?**
A: Malaysia has PDPA 2010 (Personal Data Protection Act) which covers health data but does not prescribe specific technical controls. HIPAA's Security Rule (§164.312) provides the most comprehensive and widely recognised technical safeguard framework for healthcare data. Using HIPAA as a design target gives the system a defensible, internationally recognised security baseline while remaining compatible with PDPA requirements.

---

## TOPIC B — Architecture Decisions

**Q: Why AWS and not Azure or Google Cloud?**
A: Three reasons. First, AWS has the largest market share in Malaysian enterprise cloud — better local support, documentation, and ecosystem. Second, the ap-southeast-1 (Singapore) region satisfies PDPA data residency requirements for sensitive personal data stored by Malaysian organisations. Third, AWS has the most mature healthcare-specific guidance through the AWS Well-Architected Framework Healthcare Lens and is the most commonly used platform for HIPAA-eligible workloads globally.

**Q: Why three tiers? Why not two tiers or a monolith?**
A: Each tier is an independent security boundary. In a monolithic deployment, a compromise of the web layer gives direct database access. In a two-tier deployment (frontend + database, no separate app tier), there is no layer to enforce RBAC logic or audit trail. The three-tier separation means: compromising the frontend only gives access to the ALB. Compromising the application tier gives access to the API — but not the database directly (blocked by Security Group). Reaching the database requires first compromising the EC2 instance and then using the application's own parameterised query layer. Each tier is a deliberate friction point.

**Q: Why is the React frontend on S3/CloudFront and not on EC2?**
A: Three reasons. Security: static files have no execution environment — there is no server to compromise, no process to exploit, no credentials to steal. Cost: CloudFront delivers files from 400+ edge locations at a fraction of the bandwidth cost of EC2. Architecture: the frontend contains no patient data and no business logic. Keeping it outside the VPC entirely removes it from the attack surface of the sensitive application and database tiers.

**Q: What is the NAT Gateway and why does the private subnet need it?**
A: NAT Gateway allows instances in private subnets to initiate outbound connections to the internet while remaining completely unreachable from the internet on inbound connections. Without it, the EC2 instance in the private subnet cannot pull Docker images, download npm packages, call AWS APIs (like CloudWatch or Secrets Manager), or receive OS security patches. The NAT Gateway translates the EC2's private IP to a public Elastic IP for outbound traffic only — the internet cannot initiate a connection back in.

**Q: Why Multi-AZ for RDS?**
A: RDS Multi-AZ maintains a synchronous standby replica in a second Availability Zone — a physically separate data centre with independent power and network. If the primary AZ fails (hardware failure, power outage, flood), RDS automatically promotes the standby replica, typically within 60–120 seconds, with no manual intervention. For a medical system where downtime means delayed patient care, single-AZ is not acceptable. This also satisfies HIPAA's contingency planning requirement.

**Q: What is the difference between a Security Group and a Network ACL?**
A: Security Groups are stateful, instance-level firewalls — you only need to allow inbound traffic and the response is automatically allowed. They are allow-only (no deny rules). NACLs are stateless, subnet-level firewalls — you must explicitly allow both inbound and outbound. They support deny rules. In my design, Security Groups are the primary control (SG chaining ensures only the ALB can reach EC2, only EC2 can reach RDS). NACLs are the backstop — if a Security Group is misconfigured, the NACL still blocks traffic at the subnet boundary.

**Q: Why Node.js and not Python/Django or Java/Spring?**
A: Node.js is event-driven and non-blocking — it handles concurrent API requests efficiently on a single thread, which is appropriate for a clinic system with moderate concurrent load (under 50 users). The npm ecosystem has mature packages for all required functions (express, jsonwebtoken, bcrypt, node-postgres, express-validator). Python and Java would also be valid choices — the architectural decisions are language-agnostic.

---

## TOPIC C — Security Design

**Q: Why three layers of RBAC? Is one layer not enough?**
A: Defence-in-depth. Each layer has a different failure mode:
- JWT can be bypassed if the signing secret is leaked or if there is a JWT validation bug
- IAM can be misconfigured or temporarily bypassed through a compromised role
- PostgreSQL RLS is enforced by the database engine itself — bypassing it requires admin-level database access

If only application-layer RBAC exists, a single bug in the middleware exposes all patient data. With RLS as the final layer, even a completely compromised application cannot read records it is not authorised for at the database level.

**Q: How exactly does PostgreSQL RLS work?**
A: Row-Level Security adds a WHERE clause to every query on a protected table, evaluated by the PostgreSQL engine before returning any results. For example: `CREATE POLICY doctor_records ON medical_records FOR SELECT USING (doctor_id = current_setting('app.current_user_id')::uuid)`. Before each request, the application sets `SET LOCAL app.current_user_id = '{userId}'` within the database session. Every SELECT on medical_records then automatically filters to rows matching that doctor's ID. This happens at the storage engine level — the application cannot override it.

**Q: What if a doctor tries to access another doctor's patient by modifying the API request?**
A: The request first hits the JWT middleware which validates the token and confirms the role. The RBAC middleware then checks the role against the route. Even if both are somehow bypassed, the database query will filter results to rows where doctor_id matches the session's userId. The response will be empty — not an error, just empty — because PostgreSQL RLS silently filters unauthorized rows. The attempt is also logged in audit_log with the userId, action, and resource ID.

**Q: Why bcrypt cost factor 12 specifically?**
A: Cost factor 12 produces approximately 250 milliseconds per hash on normal server hardware. This makes brute-force attacks computationally expensive — an attacker attempting 1,000 passwords per second would take 250 seconds per attempt. The cost factor can be increased as hardware improves without changing the stored hashes. Cost 10 (100ms) is too fast for modern hardware; cost 14 (1000ms) would noticeably slow down login for legitimate users.

**Q: What is an httpOnly cookie and why does it matter?**
A: An httpOnly cookie cannot be accessed by JavaScript running in the browser — `document.cookie` does not reveal it. This means even if an attacker injects malicious JavaScript into the page (XSS attack), they cannot read the JWT and use it to impersonate the user. Combined with SameSite=Strict (cookie is only sent on same-site requests, blocking CSRF) and Secure (only sent over HTTPS), this is the most secure way to store a session token in a browser.

**Q: What happens if the JWT secret is leaked?**
A: An attacker could forge valid tokens for any role. This is why the RLS layer is critical — even with a forged admin JWT, the database RLS policies limit what data can be read based on the userId claim in the token, which still must match a real userId in the users table. In practice, the JWT secret is stored in AWS Secrets Manager (not in environment variables or source code), so leakage would require compromising the EC2 instance's IAM role or the Secrets Manager service itself.

**Q: Why SonarQube, Trivy, and Checkov specifically? Why not one tool?**
A: Each tool addresses a different surface area:
- SonarQube scans source code (static analysis) — finds SQL injection patterns, hardcoded secrets, insecure function usage before the code is even compiled
- Trivy scans the built Docker image — finds known CVEs in OS packages and npm dependencies that SonarQube does not see because they are third-party packages, not your code
- Checkov scans Terraform files — finds infrastructure misconfigurations like unencrypted S3 buckets, open security groups, or disabled MFA delete, which neither of the above tools can detect

One tool cannot cover all three surfaces.

**Q: What if a developer pushes a fix but the scan takes too long — can they bypass it?**
A: No. The CI/CD pipeline is enforced through GitHub Actions branch protection rules. Direct pushes to the main branch are blocked — all changes must go through a pull request. The pipeline must pass before a merge is allowed. The only way to bypass it is to have admin access to the GitHub repository settings — which is a separate access control problem, not a pipeline problem.

---

## TOPIC D — Database Design

**Q: Why PostgreSQL and not MySQL or MongoDB?**
A: PostgreSQL is the only open-source RDBMS with native Row-Level Security — this is a hard requirement for the three-layer RBAC design. MySQL requires application-layer simulation of RLS, which is weaker. MongoDB is a document database — appropriate for unstructured data but medical records have strong relational structure (patients linked to doctors, records linked to patients, appointments linking both). Enforcing referential integrity and RLS together requires a relational database with native RLS support, which PostgreSQL provides.

**Q: Why UUID primary keys instead of sequential integers?**
A: Sequential integer IDs are predictable — an attacker who can access record #1042 can guess that records #1041 and #1043 also exist and attempt to access them. UUID (Universally Unique Identifier) primary keys are randomly generated 128-bit values — there is no guessable sequence. This prevents enumeration attacks even if RBAC has a gap.

**Q: Why is the audit_log table append-only?**
A: Forensic integrity. If UPDATE and DELETE are permitted on audit_log, an attacker with database access could erase evidence of their own actions — exactly what happened at Alamin Clinic (no trail = impossible forensics). The INSERT-only RLS policy means: even a compromised application cannot delete or modify audit records. The only way to clear the audit trail is to have PostgreSQL superuser access and modify the RLS policies themselves — an action that would itself be recorded in CloudTrail.

**Q: What is stored in the audit_log table?**
A: userId (who performed the action), action (CREATE/READ/UPDATE/DELETE), resource (table name + record UUID), ipAddress (source IP of the API request), and timestamp. This provides the minimum required for HIPAA §164.312(b) audit controls — who accessed what, when, and from where.

**Q: How do you prevent SQL injection?**
A: All database queries use parameterised queries through the node-postgres library. User input is never concatenated into a SQL string. For example: `SELECT * FROM patients WHERE id = $1` with the user input passed as a separate parameter. The PostgreSQL server receives the query structure and the parameters separately — the parameter is treated as data, never as SQL syntax, regardless of what characters it contains.

---

## TOPIC E — Methodology & Requirements

**Q: How did you validate your requirements?**
A: Requirements were traced back to the stakeholder interview findings. Each functional requirement maps to at least one problem statement (P1, P2, or P3) and at least one interview response. The traceability matrix in the report shows this mapping explicitly. Additionally, the 18 use case specifications were reviewed against the requirements to confirm coverage — each FR appears in at least one use case's requirement list.

**Q: Why did you conduct interviews instead of surveys?**
A: The clinic is a small, specialised environment. A survey would be appropriate for gathering data from large populations of similar users. Here, I needed to understand a specific workflow in depth — including implicit knowledge the staff take for granted and would not think to mention in a survey. Semi-structured interviews allow follow-up questions and allow the participant to guide the conversation toward what they consider most important.

**Q: Why only 2 interview participants? Is that enough?**
A: For a single clinic case study, the two participants cover the two roles that own the relevant knowledge: the administrator (who manages system access and patient registration) and the physician (who uses clinical records). The goal was depth of understanding of one system, not statistical generalisability across many systems. This is a qualitative case study methodology, not a quantitative survey — sample size is appropriate to the research design.

**Q: What is the difference between a functional and non-functional requirement?**
A: Functional requirements describe what the system does — specific behaviours and features (e.g. "the system shall allow doctors to create medical records for assigned patients"). Non-functional requirements describe how well the system does it — quality attributes (e.g. "the system shall respond to API requests within 3 seconds", "the system shall maintain 99.9% uptime"). Both are verified differently: FRs through functional test cases, NFRs through performance testing, load testing, and configuration audits.

**Q: Why Agile and not the Waterfall model?**
A: Waterfall requires all requirements to be fully defined before design begins. In this project, stakeholder interviews revealed requirements that were not anticipated upfront — for example, the need for account lockout after failed logins only emerged when the physician mentioned that staff share computers. Agile allows requirements to evolve across sprints. The iterative approach also means the architecture can be validated against requirements before full implementation begins — which is exactly what Sprint 1 produced.

---

## TOPIC F — PSM 1 Scope & Completeness

**Q: What exactly have you completed in PSM 1?**
A: The complete analysis and design phase:
1. Ransomware case study and root cause analysis
2. 2 stakeholder interviews — 14 questions, documented protocol in Appendix F
3. 18 use case specifications with full main flow, alternative flow, pre/postconditions
4. 12 functional requirements and 11 non-functional requirements
5. Three-tier AWS VPC architecture design (Figure 4.2)
6. Three-layer RBAC model design (JWT + IAM + RLS)
7. Six-stage DevSecOps CI/CD pipeline design
8. Database schema — 6 tables with RLS policies specified
9. Four interface wireframes (Appendix E)
10. HIPAA §164.312 compliance mapping (all 8 technical safeguards)

**Q: Why is there no working prototype?**
A: PSM 1 scope at UTM is explicitly the analysis and design phase. Building the system without completing the design first would be the same mistake Alamin Clinic made — implementing without planning. The deliverable of PSM 1 is a complete, validated design ready for implementation. PSM 2 is where the implementation, testing, and audit happen.

**Q: How do you know your design will actually work?**
A: The design components are individually proven: three-tier VPC is an AWS standard architecture, JWT authentication is industry standard for API security, PostgreSQL RLS is a documented PostgreSQL feature, Terraform is used in production at AWS scale globally. What PSM 2 will verify is that my specific configuration of these components achieves the stated RTO and passes penetration testing.

**Q: What is your PSM 2 plan?**
A: Five activities:
1. Deploy the full infrastructure using Terraform (VPC, RDS, EC2, IAM)
2. Implement the Node.js backend and React frontend
3. Activate the DevSecOps pipeline and validate all security gates
4. Conduct penetration testing against the deployed system
5. Formal security audit against HIPAA §164.312 and PDPA 2010

Timeline: June to November 2026.

---

## TOPIC G — Stakeholder & Practical Questions

**Q: If the system is cloud-based, what happens if the internet goes down at the clinic?**
A: The system becomes inaccessible during an internet outage — this is a known limitation documented in the scope. For the clinic's usage context (doctors updating records during consultations, admin scheduling appointments), brief internet outages are manageable with manual processes for the duration. A hybrid local-cache architecture would address this but is out of scope for PSM 1 and would significantly increase cost and complexity. This is noted as a future enhancement.

**Q: How much will this system cost to run monthly on AWS?**
A: Approximate estimate for a small clinic (under 50 concurrent users):
- EC2 t3.small: ~$17/month
- RDS db.t3.micro Multi-AZ: ~$50/month
- ALB: ~$20/month
- NAT Gateway: ~$35/month
- S3 + CloudFront: ~$5/month
- Rough total: ~$130–150/month

This is significantly less than the cost of the ransomware recovery at Alamin Clinic — estimated at tens of thousands in lost operations, data recovery attempts, and staff overtime.

**Q: How do patients access the system? Do they need to install anything?**
A: No installation required. The patient portal is a web application served through a browser via CloudFront. Any device with a modern browser and internet connection can access it. The clinic administrator creates the patient account and provides credentials — there is no self-registration to prevent unauthorised account creation.

**Q: What happens to the data if the clinic decides to stop using the system?**
A: The data is owned by the clinic, stored in an RDS PostgreSQL database that the clinic controls. Data can be exported as a standard PostgreSQL dump. The entire infrastructure can be destroyed with `terraform destroy`, which deletes all resources. The data does not belong to or remain accessible by the system provider after termination. This is relevant to PDPA 2010 compliance regarding data ownership.

**Q: What if a doctor leaves the clinic? What happens to their patients?**
A: Use Case UC-09 handles this. The Admin role uses the "Assign/Reassign Doctor" function to update the `assigned_doctor_id` field in the patients table. The PostgreSQL RLS policy immediately takes effect — the previous doctor loses SELECT access to those records the moment the reassignment is committed. The new doctor gains access immediately. The account of the departing doctor is deactivated (isActive = false) through UC-05, preventing login.

**Q: How does the system handle a patient who wants to see their own records but the system is designed to prevent data leakage?**
A: The Patient role has a specific RLS policy on the patients table (can SELECT own record only) and on medical_records (can SELECT own records only). The Patient Portal interface only shows read-only views — no edit or delete controls appear in the UI. This is enforced at three levels: the frontend shows no edit buttons, the RBAC middleware rejects any non-GET request from the Patient role to clinical endpoints, and RLS prevents reading any record not belonging to them.

---

## TOPIC H — Design Choices You Can Defend

**Q: Why not use a serverless architecture (Lambda + DynamoDB)?**
A: Serverless is appropriate for event-driven, stateless workloads with unpredictable traffic. A clinic management system has predictable load patterns and requires strong transactional guarantees (ACID compliance) for medical records — a patient record update must either fully succeed or fully fail, not partially apply. PostgreSQL on RDS provides ACID transactions; DynamoDB does not provide full ACID at the document level. Additionally, Row-Level Security is a PostgreSQL-specific feature — migrating to DynamoDB would require implementing RLS in application code, which is weaker.

**Q: Why not use a managed container service like ECS or EKS instead of EC2?**
A: For PSM 1 scope and the clinic's scale, EC2 with Docker is the simplest configuration that meets requirements. ECS and EKS add orchestration complexity (task definitions, cluster management, service discovery) that is not needed for a system with one application container and under 50 concurrent users. The architecture is designed so migration to ECS is straightforward in PSM 2 if the clinic grows — the containerised Docker deployment is compatible with ECS without code changes.

**Q: Why not use AWS Cognito for authentication instead of your own JWT system?**
A: Cognito adds external dependency and cost for functionality that is straightforward to implement correctly with established libraries (jsonwebtoken, bcrypt). More importantly, the PostgreSQL RLS policies depend on the `app.current_user_id` session variable being set by the application after JWT validation — this tight integration between the authentication layer and the database security layer requires the application to control the authentication flow. With Cognito, this integration would be more complex to implement reliably.

---

## TOPIC I — If You Don't Know the Answer

Use one of these:

**For technical questions outside the design scope:**
*"That falls outside the implementation scope of PSM 1. My design assumes [X] and PSM 2 will include testing to validate that assumption."*

**For questions about things you genuinely do not know:**
*"I have not fully explored that specific aspect in PSM 1. My current design addresses it by [closest relevant thing], and I will investigate [the specific question] further in PSM 2."*

**For questions that challenge a design decision:**
*"That is a valid concern. The reason I chose [decision] over [alternative] was [primary reason]. You are right that [alternative] would have [advantage], but in this context [why your choice is still better]."*

Never say "I don't know" and stop. Always connect to what you do know.

---

# PART 3 — QUICK REFERENCE NUMBERS

Memorise these — examiners will ask:

| Fact | Answer |
|---|---|
| Number of use cases | 18 |
| Number of functional requirements | 12 |
| Number of non-functional requirements | 11 |
| Number of database tables | 6 |
| Number of user roles | 3 (Doctor, Admin, Patient) |
| Number of interview participants | 2 |
| Number of interview questions | 14 |
| Number of pipeline stages | 6 |
| Number of RBAC layers | 3 |
| Number of wireframes | 4 (E.1–E.4) |
| bcrypt cost factor | 12 |
| JWT access token expiry | 15 minutes |
| JWT refresh token expiry | 7 days |
| Target RTO | Under 15 minutes |
| Actual Alamin Clinic downtime | 5 days |
| Account lockout threshold | 3 failed attempts |
| Rate limit (general) | 100 requests per 15 minutes per IP |
| Rate limit (login endpoint) | 10 requests per 15 minutes per IP |
| HIPAA requirements mapped | 8 (§164.312 technical safeguards) |
| AWS region | ap-southeast-1 (Singapore) |
| Database port | 5432 (PostgreSQL) |
| Application port | 3000 (Node.js) |
| HTTPS port | 443 (ALB listener) |
| TLS minimum version | 1.2 (ELBSecurityPolicy-TLS13-1-2-2021-06) |

---

# PART 4 — THE NIGHT BEFORE

1. Read Part 1 (the full story) out loud once — hear yourself explain it
2. Have someone ask you 10 random questions from Part 2 — answer without looking
3. Sleep. You know this project.

The examiners are not trying to catch you out. They want to see that you understand what you built, why you built it that way, and what comes next. You do.
