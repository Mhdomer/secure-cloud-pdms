tags: [fyp, psm2, chapter-5, implementation, testing, devsecops, security-evaluation]
phase: 5
status: draft
created: 2026-09-17
updated: 2026-09-17
related: [[chapter-4-requirement-design]], [[chapter-6-conclusion]], [[docs/psm2/report-delta]]


# CHAPTER 5

## IMPLEMENTATION AND TESTING

---

### 5.1 Introduction

This chapter documents the implementation and testing phases of the Secure Cloud-Based Patient Data Management System developed for Alamin Polyclinic. Chapter 4 established the design; this chapter records what was actually built against that design, what was measured, and where the implemented system diverged from the original specification.

The implementation was carried out over five sprints following the Agile methodology described in Chapter 3, Section 3.3. Each sprint concluded with a security gate that had to pass before the following sprint began. Unlike a conventional web application project, where implementation is principally a matter of application code, this system required four distinct implementation tracks: the cloud infrastructure itself, defined entirely as Terraform code; the application back end; the database and its row-level security policies; and the front end. A fifth track, the DevSecOps pipeline, exists to enforce security constraints across the other four.

Section 5.2 describes the coding of the system's main functions across those tracks. Section 5.3 presents the implemented interfaces. Section 5.4 documents the testing performed, which for a security-focused project extends considerably beyond functional testing to include static analysis, container scanning, infrastructure scanning, penetration testing, automated security-control testing, and a live disaster-recovery drill. Section 5.5 summarises the chapter.

A note on honesty of reporting is appropriate here. This chapter records two requirements that the implemented system does not evidence, and one that it fails as originally written. These are reported in Sections 5.4.5 and 5.4.8 rather than omitted, on the principle that an evaluation chapter which reports only successes is not an evaluation.

---

### 5.2 Coding of System Main Functions

The system was implemented as five cooperating layers. Table 5.1 summarises the scale of each layer as implemented.

**Table 5.1** — Implemented System Scale by Layer

| Layer | Technology | Scale as implemented |
| --- | --- | --- |
| Infrastructure | Terraform (HCL) | 11 modules, 122 resource declarations |
| Back end | Node.js / Express | 8,766 lines across 19 controllers, 13 models, 8 middleware, 8 utility modules |
| API surface | REST over HTTPS | 90 endpoints across 18 route modules |
| Database | PostgreSQL 15 on Amazon RDS | 19 tables, 11 under row-level security |
| Front end | React (TypeScript) | 26,701 lines, 17 screens, bilingual English/Arabic |
| Pipeline | GitHub Actions | 3 workflows, 6 pipeline stages |

#### 5.2.1 Infrastructure Provisioning

The entire AWS environment is declared as Terraform code, with no manually provisioned resources. This satisfies NFR-11 and is the mechanism by which the recovery objective in Section 5.4.5 is met at all: the infrastructure is reproducible from source rather than restored from a backup.

The configuration is organised into eleven modules — `vpc`, `security`, `rds`, `ec2`, `alb`, `kms`, `cloudtrail`, `monitoring`, `ecr`, `frontend`, and `github-oidc` — corresponding to the architectural components specified in Chapter 4, Section 4.3. Module boundaries follow the principle that each module owns one security boundary, so that a change to network isolation rules cannot be made accidentally while editing, for example, the monitoring configuration.

Two implementation findings from this track are worth recording because neither is visible from the design documents and both blocked deployment entirely until resolved.

First, the pinned EC2 AMI is the Amazon Linux 2023 *Minimal* edition, which — unlike the standard AL2023 image — does not ship the `amazon-ssm-agent`. Instances booted cleanly with no error of any kind and simply never registered as managed nodes, making the deployment mechanism silently inoperable. The agent is now installed explicitly during instance initialisation rather than switching image editions, as the smaller footprint of the Minimal edition was a deliberate attack-surface decision.

Second, the Auto Scaling service-linked role requires explicit statements in the KMS *key policy* in order to encrypt EBS volumes with a customer-managed key. This permission cannot be granted through an IAM identity policy. Its absence blocked every EC2 launch with a generic `Client.InvalidKMSKey.InvalidState` error that did not indicate the true cause. Both findings are characteristic of infrastructure-as-code work: the configuration was syntactically valid and passed static analysis, yet did not function.

#### 5.2.2 Back-End Development

The back end is a Node.js application using the Express framework, structured in three layers: route modules that define the API surface and attach middleware, controllers that implement request handling, and models that encapsulate database access. Every database-touching operation is routed through a transaction helper rather than issuing queries directly against the connection pool, for reasons developed in Section 5.2.3.

**Authentication.** Authentication uses JSON Web Tokens signed with HS256. Three implementation decisions distinguish the built system from a conventional token implementation:

1. The token is delivered exclusively as an `httpOnly` cookie and is never accepted from an `Authorization` header. This makes the token unreadable to client-side JavaScript, so a cross-site scripting vulnerability in the front end cannot exfiltrate a session.
2. The permitted signing algorithm is pinned to an explicit allow-list. Without this, a token presented with its algorithm field set to `none` would be accepted as valid — the algorithm-confusion attack.
3. Authentication failures return an identical response regardless of whether the token was expired, malformed, or carried an invalid signature, so the response does not disclose which failure mode occurred.

**Authorisation.** Role-based access control is enforced at two independent layers, as specified in Chapter 4, Section 4.3.8.2. The application layer is a middleware function that compares the role claim from the verified token against an allow-list declared per route. The database layer is described in Section 5.2.3. The two layers are genuinely independent: the middleware never queries the database, and the database policies never consult application state.

A design point that emerged during implementation is worth stating explicitly, because it is easily misread as redundancy. The application-layer middleware can enforce only *role* boundaries — it sees a role string and nothing else, and therefore cannot distinguish one doctor from another. All *row* ownership is enforced exclusively by the database layer. Neither layer subsumes the other.

**Role model.** The implemented system uses four roles rather than the three specified in Chapter 4: `superadmin`, `doctor`, `admin` (presented as "Staff" in the interface), and `patient`. The fourth role was introduced to separate account management from clinical and reception operations, so that the staff performing daily reception work do not hold the ability to create or deactivate accounts. This change is recorded as DELTA-001 in the requirement-delta register.

#### 5.2.3 Database Implementation and Row-Level Security

The database is PostgreSQL on Amazon RDS, encrypted at rest with a customer-managed KMS key, deployed Multi-AZ, and never publicly accessible. The application connects as `pdms_app`, an unprivileged role that holds only the specific table grants it requires — notably no `DELETE` grant on `users`, `patients`, or `medical_records`, and append-only access to the audit log.

**Row-level security.** Eleven of the nineteen tables enforce row-level security policies. The policies read four session variables — the authenticated user, the role, and the resolved doctor and patient surrogate keys — which are set at the start of every transaction using `set_config(..., true)`. The third argument is essential: it scopes the setting to the transaction, so a pooled connection cannot carry one patient's identity into the next request. A session-scoped setting here would constitute a cross-tenant data leak by construction.

Table 5.2 records which tables enforce row-level security and which deliberately do not.

**Table 5.2** — Row-Level Security Coverage

| Table | RLS | Rationale |
| --- | --- | --- |
| `patients`, `medical_records`, `lab_results` | Yes | Core patient data; specified in Chapter 4 §4.4.3 |
| `visits`, `visit_invoices`, `invoice_items`, `invoice_payments`, `patient_care_team` | Yes | Added during Sprint 3c when billing and visit tracking were implemented |
| `sick_leaves` | Yes | Added in Sprint 5 following the penetration-testing finding in §5.4.3 |
| `appointments`, `patient_invoices` | Yes | Added in Sprint 5; previously application-layer only |
| `otp_verifications`, `password_setup_tokens` | No | Pre-authentication tables, keyed by the secret itself; no session exists to filter against |
| `users`, `doctors`, `departments`, `clinic_services`, `doctor_availability` | No | Staff directory and reference data, not per-patient records |
| `audit_log` | No | Append-only by grant; readable only by superadmin |

**An implementation hazard specific to this design.** Every policy that casts a session variable to a UUID must first guard the empty-string case. An administrator session has neither a doctor nor a patient surrogate key, so both variables arrive as empty strings, and PostgreSQL evaluates the `current_setting` call as a stable initialisation plan *before* per-row short-circuit evaluation. A bare cast therefore raises an invalid-input error for every role, not merely the role the clause was written for. This defect was introduced once during Sprint 3c, caused every administrator request against four tables to fail, and is the reason the guard is now a documented and tested invariant rather than a convention.

**Preserving correctness when adding security.** Extending row-level security to `appointments` in Sprint 5 produced a subtler problem. The double-booking check performed during patient self-booking executes inside the patient's own transaction. Once the table was protected, that check could no longer observe other patients' appointments, would have found no clash, and would have permitted two patients to book the same physician in the same slot — silently, with no error raised. The security improvement would have introduced a correctness defect.

The resolution was to route conflict detection through two `SECURITY DEFINER` functions that execute with the privileges of their owner and therefore bypass row-level security, but which return only an appointment identifier and a boolean. They disclose that a slot is occupied and nothing about who occupies it. This is strictly less disclosure than the pre-existing behaviour, in which the conflict query read the table directly. Both functions pin their schema search path, which is a required mitigation for definer-rights functions rather than a stylistic choice.

#### 5.2.4 Front-End Development

The front end is a React single-page application written in TypeScript, built to static assets and served from Amazon S3 through CloudFront. It comprises seventeen screens across four role-specific dashboards.

**Bilingual interface.** The interface supports English and Arabic with full right-to-left layout. Language selection switches text direction, typography, and font family together, as Arabic script requires different line height and forbids letter spacing. Translation coverage is enforced programmatically rather than by inspection: a parity checker compares base keys across all eleven namespaces and validates plural categories per language. This distinction matters, because Arabic carries six CLDR plural categories where English carries two — a naive key-count comparison reports twelve false discrepancies, and an earlier revision of the check had been silenced by padding the English files with unreachable plural forms. The corrected check compares base keys and validates categories per language, and is negative-tested against both a dead English category and a removed Arabic one.

**Client-side authorisation is presentational only.** The interface hides controls the current role may not use. This is a usability measure and is not treated as a security control; every corresponding operation is independently refused by the API and, for patient data, by the database.

#### 5.2.5 DevSecOps Pipeline Implementation

The pipeline is implemented as three GitHub Actions workflows. A reusable security-scan workflow runs static analysis, container build and scan, and infrastructure scanning; it is invoked identically by the pull-request workflow and the deployment workflow, so that merging to the main branch cannot bypass the checks that a pull request would have run.

Authentication to AWS uses OpenID Connect federation rather than long-lived access keys, so no AWS credential is stored in the repository or in GitHub secrets. The trust policy is scoped such that only a job declaring the production environment receives a token the deployment role will accept.

**A deliberate control that presents as a failure.** All three deployment jobs declare a protected `production` environment carrying a required-reviewer rule. While the infrastructure is intentionally torn down between evaluation exercises to avoid cost, no reviewer approves these jobs, and they remain pending indefinitely. GitHub renders the overall workflow run as failed. This is the control operating correctly: unreviewed code is being prevented from reaching an environment that holds patient data. The distinction between "the security gates passed" and "deployment is held at a human approval point" is maintained throughout this chapter, as conflating them would misrepresent both.

#### 5.2.6 Deployment and Hosting

The back end is packaged as a Docker image built from a multi-stage Dockerfile and published to Amazon ECR. The runtime stage runs as a non-root user and removes the bundled Node package manager, which is never invoked at runtime. This removal is a security measure rather than housekeeping: the bundled package manager ships its own copy of an archive-handling library that has repeatedly carried critical vulnerabilities unrelated to anything this application uses. Removing it eliminates those findings at their source instead of suppressing them in the scanner.

---

### 5.3 Interfaces of System Main Functions

The implemented interfaces follow the designs presented in Chapter 4, Section 4.5, with the additions recorded in the requirement-delta register. Each is presented with its corresponding figure.

*(Figure placeholders — screenshots to be captured from a running instance and inserted here.)*

- **Figure 5.1** — Login screen, showing the language toggle and bilingual presentation.
- **Figure 5.2** — Doctor dashboard, showing the daily patient queue and the next-patient summary.
- **Figure 5.3** — Consultation screen, showing the four-tab structure: structured clinical notes, electronic prescription and sick-leave generation, dental and body annotation, and billing items.
- **Figure 5.4** — Staff reception dashboard, showing walk-in check-in and the visual queue board.
- **Figure 5.5** — Patient portal, showing appointments, released laboratory results, and billing history.
- **Figure 5.6** — Superadmin account management screen.
- **Figure 5.7** — Bilingual printable invoice, which renders both languages regardless of interface language in order to match the clinic's existing physical document.
- **Figure 5.8** — Arabic right-to-left rendering of the doctor dashboard, demonstrating full layout mirroring rather than text translation alone.

---

### 5.4 Testing

Testing for this project is necessarily broader than functional verification. A system whose stated contribution is security cannot be evaluated by confirming that its features operate; it must be evaluated by attempting to defeat the controls it claims to provide. Seven testing activities were therefore carried out, summarised in Table 5.3.

**Table 5.3** — Testing Activities and Outcomes

| Activity | Method | Outcome |
| --- | --- | --- |
| Automated testing | Jest unit and integration suite | 192 tests passing |
| White-box testing | Static analysis and structured code review | 1 critical, 4 lesser findings; all remediated |
| Black-box testing | Manual penetration testing against a running instance | Confirmed the critical finding exploitable; fix verified |
| Security scanning | Trivy, SonarQube, Checkov | 0 critical/high findings at conclusion |
| Recovery testing | Live infrastructure wipe and redeployment | 47m48s; original target revised (§5.4.5) |
| Compliance assessment | HIPAA §164.312 against the infrastructure code | Design-level proxy; live score unobtainable (§5.4.6) |
| User acceptance testing | Structured task-based sessions, three roles | **Not yet executed** (§5.4.8) |

#### 5.4.1 Automated Testing

The back end carries 192 automated tests across 1,569 lines of test code. The suite deliberately concentrates on the security controls rather than on feature coverage, because an earlier test suite covering only pure utility functions had produced a coverage figure while asserting nothing about whether the system's access controls functioned.

Coverage is organised as follows:

- **Token verification** — valid, expired, malformed, and absent tokens; signature tampering, in which a token's role claim is escalated while retaining the original signature; algorithm-confusion attempts; and rejection of a valid token presented via an HTTP header rather than the cookie.
- **Role-based access control** — a complete matrix of all four roles against every distinct route guard used in the system, asserting both the permitted and the refused paths.
- **Session context** — that the correct database session variables are established for each role, and that absent surrogate keys are transmitted as empty strings rather than as null or the literal string "undefined", which is the condition the database-side guard depends upon.
- **Cross-tenant isolation** — an integration suite executed against a live PostgreSQL instance, described below.

**Integration testing against a live database.** Automated tests that mock the database cannot verify row-level security, because the policies are database objects and a mock does not evaluate them. The isolation suite therefore executes against a real PostgreSQL instance, connecting as the same unprivileged application role the deployed system uses and setting the same session variables. It asserts that one patient cannot read another's records, appointments, invoices, or sick-leave certificates, including by direct primary-key lookup where the identifier is known.

Three properties of this suite are worth recording as methodology:

1. **It is not vacuous.** A test asserting that a query returns no rows passes trivially if the data was never created. The suite therefore also asserts that an administrator session sees both records and that each patient can read their own, so that the empty results are demonstrably the effect of filtering rather than absent data.
2. **It was verified by mutation.** The patient session was deliberately altered to carry an administrator role, and exactly the seven isolation assertions failed. A suite that cannot be made to fail is not evidence.
3. **It leaves no residue.** The entire suite executes inside a single transaction that is rolled back, with each test fenced by a savepoint. The database is left byte-identical, and the suite requires no privileged credentials.

One limitation must be stated. The continuous integration runner has no PostgreSQL service, so this suite is skipped there and executes locally only. The database half of the two-layer authorisation claim is therefore verified, but not on every commit. Closing this requires a database service container and a seeding step in the pipeline, and is recorded as future work.

#### 5.4.2 White-Box Testing

White-box testing consisted of a structured review of the full source with knowledge of the implementation, targeting authorisation boundaries specifically. It produced five findings, of which one was critical.

The critical finding was that the `sick_leaves` table — introduced during Sprint 3c to generate official Ministry of Health sick-leave certificates — had been created with no row-level security policy at all. Every other patient-data table added in that sprint received policies; this one was missed. The result was an insecure direct object reference: any authenticated patient could retrieve any other patient's sick-leave certificate, including the diagnosis recorded on it, by supplying its identifier.

The four lesser findings concerned a mutation endpoint lacking the ownership check present on its siblings, and three instances of inconsistent error handling that disclosed marginally more than necessary.

#### 5.4.3 Black-Box Penetration Testing

Black-box testing was performed against a running local instance with no reference to the source, using authenticated sessions for each role and attempting to access data belonging to other users through direct object reference, parameter tampering, and role-boundary probing.

This confirmed the critical finding from Section 5.4.2 as genuinely exploitable rather than theoretical: a patient session retrieved another patient's sick-leave certificate and its diagnosis text. The remediation — enabling row-level security on the table with patient, doctor, and administrator policies — was verified against real fixture data, and the regression test described in Section 5.4.1 now pins it.

The finding is instructive beyond its own remediation, and is discussed in Chapter 6 as such. The system's design specified two independent authorisation layers. The application layer was present and correct for this table. The failure was that the *second* layer had simply not been applied, and no automated check existed that would notice. This directly motivated both the Sprint 5 test suite and the extension of row-level security to the two remaining patient-data tables.

#### 5.4.4 Static and Container Security Scanning

Three scanners run in the pipeline, each gating on findings at or above a defined severity.

**Infrastructure scanning (Checkov).** The final scan reports 399 passing checks, 0 failures, and 46 explicitly justified suppressions. Each suppression carries an inline justification at its source rather than a command-line severity filter, so that the reason is visible where the configuration is read. The suppressions group into ten themes, the largest being AWS service APIs that genuinely require wildcard resource scopes.

**Container scanning (Trivy).** The scan reports no critical or high findings against the built image and its dependencies.

A calibration defect in this gate is worth recording. The scanner was originally configured to fail only on critical findings. It therefore reported a clean image while the application's own dependencies carried three high-severity advisories, including one affecting an upload-handling library whose file-size limit the application relies upon as a control. The gate was reporting a clean result because it had been configured not to look. The threshold now includes high-severity findings, and the underlying advisories were remediated by dependency updates that required no code change.

**Static analysis (SonarQube).** The final analysis passes on security, reliability, maintainability, duplication, and security hotspots.

This gate also carried a defect of its own. Every commit had been failing the new-code coverage condition, because the analysis had never been supplied a project version. Consequently the tool's new-code baseline was anchored to the project's first-ever scan, and every commit made since was evaluated as new code requiring full coverage — an unmeetable condition that had nothing to do with the code being submitted. Both defects share a lesson: an automated gate reporting success is evidence only if the gate has been verified to be capable of reporting failure.

#### 5.4.5 Recovery Time Objective Testing

A live recovery drill was executed on 31 July 2026, simulating the total infrastructure loss that the Alamin Polyclinic ransomware incident produced. The AWS account was independently verified empty, a timer started, and the environment rebuilt from the Terraform configuration alone.

**Table 5.4** — Measured Recovery Timeline

| Phase | Duration | Content |
| --- | --- | --- |
| Infrastructure provisioning | 17m40s | Full Terraform apply; dominated by RDS |
| Application deployment | 29m56s | Image publication, parameter updates, front-end build and distribution, and the deployment approval |
| Health-check convergence | 12s | Load balancer targets reporting healthy |
| **Total** | **47m48s** | Recovery start to serving live traffic |

Recovery was defined as the load balancer reporting healthy targets, the application responding over the public distribution, and a real API route returning its expected response — not merely Terraform reporting success. This distinction was established during the drill itself, when it emerged that freshly provisioned instances with no published application image remain permanently unhealthy while the infrastructure is entirely present and correct.

**The result missed the requirement as originally written, and the requirement was revised.** NFR-06 specified recovery within fifteen minutes. Investigation established that this figure had been specified during design without a supporting measurement and was not attainable:

1. Amazon RDS Multi-AZ instance creation alone measured 15m11s and 15m22s across two independent runs. This consumes the entire original budget before any other resource exists.
2. Restoration to serving traffic requires the deployment pipeline, which requires human approval by design. A fully unattended recovery — which the original requirement implicitly assumed — is incompatible with a control deliberately built into this system. The fifteen-minute target could have been met by removing that approval gate, which would trade a security control for a performance metric on a project whose entire premise is the opposite trade.

NFR-06 was accordingly replaced by two separately measured requirements that distinguish what automation governs from what human process governs: **NFR-06a**, infrastructure recovery within 25 minutes, measured at 17m40s; and **NFR-06b**, full service restoration within 60 minutes including the approval gate, measured at 47m48s. Both are satisfied by the drill, and neither is satisfied by weakening a control. The revision is recorded in Appendix D, Table D.5.

The architecture that would meet the original figure — a warm standby with a pre-provisioned database — requires permanently running infrastructure and is identified as future work in Chapter 6. Against the five days of downtime Alamin Polyclinic actually sustained, a measured 47-minute recovery remains a substantive improvement.

#### 5.4.6 HIPAA Technical Safeguard Assessment

The implemented controls were assessed against the HIPAA §164.312 technical safeguards — access control, audit controls, integrity, authentication, and transmission security — by examination of the infrastructure code and application implementation.

This assessment is a design-level proxy and is reported as such. The intended instrument was AWS Security Hub's HIPAA standard, which produces an externally computed posture score. Enabling it was blocked by an account-level eligibility restriction that cannot be resolved through Terraform or the command line and requires an AWS support case. The distinction matters: what is reported here is an argued assessment against the published safeguards, not an independently scored one, and it should not be presented as the latter.

One gap identified by this assessment is recorded rather than resolved. The system does not implement multi-factor authentication for doctor or administrator accounts. This is a genuine feature absence rather than a configuration oversight, and is carried into Chapter 6.

A second gap is a known deviation. Transport encryption is presently disabled, as the load balancer serves HTTP rather than HTTPS. This is not a design decision but a consequence of no domain name or certificate having been registered for the pilot. The configuration flag controlling it must be restored before the system holds real patient data, and this is stated explicitly in Chapter 6 as a precondition for deployment.

#### 5.4.7 Functional Testing

Functional verification was performed continuously throughout implementation against the use case specifications in Chapter 4, covering authentication and session handling, patient registration including self-registration by OTP, appointment scheduling and self-booking, walk-in queue management, clinical documentation, billing and payment collection, and the patient portal.

A full-system quality assurance pass conducted on 24 July 2026 identified defects in the billing workflow — most materially a condition in which partially paid invoices became unresolvable — which were remediated by introducing an explicit payment ledger with row locking, together with a cancellation and void workflow.

#### 5.4.8 User Acceptance Testing

**This activity has not yet been executed.** It is reported here as outstanding rather than omitted, because it is a compulsory submission component and because Section 5.4 would otherwise imply an evaluation more complete than the one performed.

The instrument is prepared. A structured task-based protocol exists specifying participants — one representing each of the Doctor, Staff, and Patient roles, with an optional fourth for Superadmin — together with environment preparation, per-role task scripts, and observation criteria. Participants are to be given fresh single-purpose accounts rather than shared development credentials, and account creation is itself part of the protocol rather than a precondition, since it is a workflow under evaluation.

The exercise requires no cloud infrastructure and incurs no cost; the system runs identically against a local environment. The sole dependency is the availability of three participants. On completion, the results belong in this section, and Chapter 6's assessment of Objective (c) will require revision accordingly.

A second evidentiary gap is recorded alongside it. **NFR-09** specifies API response within three seconds under fifty concurrent users, and no load test has been performed. Unlike the recovery objective, which was measured and found wanting, this requirement has no measurement of any kind. It requires either a load test or an explicit and reasoned narrowing of the requirement.

---

### 5.5 Chapter Summary

This chapter documented the implementation of the Secure Cloud-Based Patient Data Management System across five layers — infrastructure, back end, database, front end, and pipeline — and the seven testing activities performed against it.

The implementation satisfies the substantial majority of the requirements specified in Chapters 3 and 4, and exceeds the original functional scope considerably: the delivered system includes billing, walk-in queue management, structured clinical documentation, official sick-leave generation, patient self-service, and a bilingual interface, none of which were part of the PSM1 specification. These additions are traced individually in the requirement-delta register.

The testing outcomes are better characterised by what they corrected than by what they confirmed. Penetration testing found a genuine, exploitable cross-tenant vulnerability in a table that the design intended to protect and which the implementation had simply missed. Two automated security gates were found to be reporting clean results because they had been configured, inadvertently, in ways that prevented them from reporting anything else. The recovery drill disproved a requirement that had been specified without measurement. In each case the defect was in the verification rather than in the feature, which is the more concerning class of defect, and each is now covered by an automated check.

Three matters remain outstanding and are carried into Chapter 6: user acceptance testing, which is prepared but unexecuted; the performance requirement, which has never been measured; and multi-factor authentication for privileged accounts, which is unimplemented. Transport encryption remains disabled pending a domain certificate and must be restored before any deployment holding real patient data.
