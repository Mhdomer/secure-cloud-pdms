tags: [fyp, psm2, chapter-6, conclusion, objectives, future-work]
phase: 6
status: draft
created: 2026-09-19
updated: 2026-09-19
related: [[chapter-1-introduction]], [[chapter-5-implementation-testing]]


# CHAPTER 6

## CONCLUSION

---

### 6.1 Introduction

This chapter concludes the development of the Secure Cloud-Based Patient Data Management System for Alamin Polyclinic. Section 6.2 assesses each of the three objectives stated in Chapter 1 against what the implementation and testing in Chapter 5 actually demonstrated. Section 6.3 states the weaknesses of the delivered system, including the requirements it does not satisfy and the evidence it does not yet possess. Section 6.4 sets out the improvements that would follow from this work. Section 6.5 summarises the chapter.

The assessment in Section 6.2 is deliberately specific about the difference between what was built and what was proven. A system can be complete and still be unevaluated, and the two are reported separately here.

---

### 6.2 Achievement of Project Objectives

#### 6.2.1 Objective (a) — Investigate core concepts

**Fully achieved.**

Chapter 2 reviewed the academic and industry literature across seven areas: cloud computing in healthcare, three-tier architecture, the AWS shared responsibility model, Infrastructure as Code, DevSecOps and shift-left security, Identity and Access Management, and role-based access control. Each technology selected for the implementation was justified against that literature rather than by preference, and the review established that Alamin Polyclinic's security shortcomings — unsegmented networks, ageing equipment, manual patching — are representative of small healthcare providers generally rather than exceptional (Argaw et al., 2019).

The review also established the gap the project addresses: on-premise and open-source systems return the whole security burden to an IT function the clinic does not have, while commercial platforms are priced and scoped for institutions far larger. No affordable option with security automation existed.

#### 6.2.2 Objective (b) — Develop the system

**Fully achieved, and exceeded in functional scope.**

The system was implemented across five sprints. The AWS environment is defined entirely as Terraform code across eleven modules and 122 resource declarations, with no manually provisioned resources, and was verified by a real deployment applying all resources with zero drift. The application comprises a Node.js and Express backend of 8,766 lines exposing 90 endpoints, a PostgreSQL database of 19 tables, and a React front end of 26,701 lines across seventeen screens with full English and Arabic right-to-left support. The DevSecOps pipeline runs as three GitHub Actions workflows authenticating to AWS through OpenID Connect federation, with no long-lived credentials stored anywhere.

Role-based access control is enforced at the two independent layers the design specified. The application layer verifies a JSON Web Token delivered exclusively as an `httpOnly` cookie, with the signing algorithm pinned to an explicit allowlist, and compares the role claim against a per-route allowlist. The database layer enforces row-level security policies on eleven tables, reading session variables scoped to each transaction so that a pooled connection cannot carry one patient's identity into the next request.

The delivered system substantially exceeds the functional scope specified in Chapter 3. Beyond the original twelve functional requirements, it implements patient self-registration by one-time passcode, patient self-booking and self-cancellation, a walk-in queue with per-doctor daily numbering, structured clinical documentation in SOAP format, a complete billing engine producing print-ready bilingual invoices, electronic prescriptions, official sick-leave certificate generation, laboratory results with a doctor release gate, and a superadmin role separating account management from clinical and reception duties. These additions are traced individually through thirty-four further functional requirements recorded in Appendix D, Table D.3.

#### 6.2.3 Objective (c) — Evaluate the system

**Partially achieved.** This is the objective on which the project falls short, and the shortfall is specific rather than general.

**Achieved.** The automated vulnerability assessment is complete. Checkov reports 399 passing infrastructure checks with zero failures and 46 individually justified suppressions. Trivy reports no critical or high findings against the built container image. SonarQube passes on security, reliability, maintainability, duplication and security hotspots. Penetration testing was carried out white-box and black-box and produced five findings, of which one was a genuine critical cross-tenant vulnerability — described in Section 6.3.1 — subsequently remediated and pinned by an automated regression test. A suite of 232 automated tests now covers the security controls themselves, including live cross-tenant isolation against a real database.

The Recovery Time Objective test was executed live against real infrastructure, measuring 47 minutes 48 seconds from a verified-empty account to serving traffic. That result is discussed in Section 6.3.2.

**Not achieved.** Three elements of Objective (c) lack evidence.

The AWS Security Hub HIPAA posture assessment could not be performed. Enabling Security Hub was blocked by an account-level eligibility restriction resolvable only through an AWS support case, not through Terraform or the command line. What Chapter 5 reports instead is an argued assessment of the implemented controls against the HIPAA §164.312 technical safeguards, conducted by examination of the infrastructure code. That is a design-level proxy and is reported as such; it is not an independently computed score and must not be presented as one.

**User Acceptance Testing was not executed.** The protocol is written and ready — participants, environment preparation, per-role task scripts and observation criteria — and a hosted demonstration build was deployed specifically so that participants could take part from a web link rather than installing a database locally. The remaining dependency is the availability of three people. This is the most significant gap in the project's evaluation, because it is the only element that would have involved anyone outside the project assessing the system.

**NFR-09 was never measured.** The requirement specifies API response within three seconds under fifty concurrent users, and no load test was performed. Unlike the recovery objective, which was measured and found wanting, this requirement has no measurement of any kind.

#### 6.2.4 Summary of objective status

**Table 6.1** — Objective Achievement Summary

| Objective | Status | Basis |
| --- | --- | --- |
| (a) Investigate core concepts | Fully achieved | Chapter 2, seven technology areas reviewed against literature |
| (b) Develop the system | Fully achieved, scope exceeded | Chapter 5 §5.2; 122 Terraform resources, 90 endpoints, 17 screens, two-layer RBAC |
| (c) Evaluate the system | **Partially achieved** | Scans, penetration testing and recovery testing complete; Security Hub blocked, UAT unexecuted, NFR-09 unmeasured |

---

### 6.3 Weaknesses of the System

#### 6.3.1 A protective layer was applied inconsistently

The most instructive weakness was found by the project's own penetration testing. The `sick_leaves` table, added during Sprint 3c to generate official Ministry of Health sick-leave certificates, was created without any row-level security policy. Every other patient-data table added in that sprint received policies; this one was missed. The result was an insecure direct object reference allowing any authenticated patient to retrieve another patient's certificate, including the recorded diagnosis, given only its identifier.

The design was not at fault — it specified two independent authorisation layers, and the application layer was present and correct for this table. The failure was that the second layer had simply not been applied, and no automated check existed that would notice. A security architecture that depends on a developer remembering to apply it at each new table is only as reliable as that memory.

This directly motivated two changes. An automated test suite was written for the security controls themselves rather than for utility functions, and row-level security was extended to `appointments` and `patient_invoices`, the two remaining tables holding patient data behind a single layer. Coverage now stands at eleven of nineteen tables, with the remaining eight being pre-authentication tables keyed by their own secrets, or staff and reference data.

#### 6.3.2 The original recovery target was not attainable

NFR-06 specified recovery within fifteen minutes. The live drill measured 47 minutes 48 seconds.

Investigation established that the target had been specified during design without a supporting measurement and could not have been met. Amazon RDS Multi-AZ instance creation alone measured 15 minutes 11 seconds and 15 minutes 22 seconds across two independent runs, consuming the entire budget before any other resource exists. Separately, restoration to serving traffic requires the deployment pipeline, which requires human approval by design — so the fully unattended recovery the requirement assumed is incompatible with a deliberate control of this system. The target could have been met by removing that approval gate, which would trade a security control for a performance metric on a project whose premise is the opposite trade.

The requirement was accordingly replaced by NFR-06a, infrastructure recovery within 25 minutes, and NFR-06b, full service restoration within 60 minutes including the approval gate. Both are satisfied by the measured drill. The revision is recorded in Appendix D, Table D.5.

Against the five days of downtime Alamin Polyclinic actually sustained, a measured 47-minute recovery remains a substantive improvement. The weakness is not the recovery time; it is that a requirement was specified without measurement and survived until it was tested.

#### 6.3.3 Transport encryption is disabled

The Application Load Balancer currently serves HTTP rather than HTTPS. This is not a design decision — the design specifies HTTPS only — but a consequence of no domain name or ACM certificate having been registered for the pilot. The configuration flag controlling it must be restored before the system holds any real patient data, and no deployment carrying real records should proceed until it is.

#### 6.3.4 No multi-factor authentication for privileged accounts

Doctor and administrator accounts authenticate with a username and password alone. This was identified during the HIPAA safeguard assessment and is a genuine feature absence rather than a configuration oversight. For accounts with access to clinical records, single-factor authentication is a material weakness.

#### 6.3.5 Verification gaps

Three gaps in what the project can evidence, distinct from gaps in what it built:

- **The database authorisation layer is not verified in continuous integration.** The live isolation suite requires a PostgreSQL instance, which the CI runner does not provide, so it is skipped there and runs locally only. Half of the two-layer claim is therefore verified, but not on every commit.
- **The front end has no automated tests.** The backend carries 232; the front end carries none.
- **Doctor access to billing documents is broader than minimum-necessary.** Any doctor may retrieve any patient's billing document. Row-level security was added to that table deliberately mirroring this existing behaviour rather than narrowing it, so that a security change did not silently alter functionality. The minimum-necessary question remains open.

#### 6.3.6 The demonstration build is not the evaluated system

A hosted demonstration build was deployed to support user acceptance testing and demonstration. It exercises the application layer only — authentication, role-based access control, row-level security, the bilingual interface and the clinical workflows. It does not demonstrate the infrastructure contribution that Chapters 4 and 5 largely concern: VPC isolation, network access control lists, security groups, KMS encryption at rest, CloudTrail auditing, the DevSecOps pipeline, or the recovery objective. It also runs a different PostgreSQL major version and has file upload disabled. It is a companion artefact and is described as such wherever it appears.

---

### 6.4 Suggestions for Future Improvements

**Execute User Acceptance Testing.** The single most valuable remaining action, and the only one that would place the system in front of people outside the project. The protocol is written and the hosted build removes the setup barrier that previously made scheduling difficult.

**Measure NFR-09.** Either conduct a load test against the deployed system, or narrow the requirement explicitly and in writing. A stated requirement with no measurement is weaker than a narrower requirement that has one.

**Implement multi-factor authentication** for doctor and administrator accounts, by time-based one-time password or equivalent. This is the most significant functional security improvement outstanding.

**Restore HTTPS** by registering a domain and an ACM certificate. This is a precondition for any deployment holding real patient records, not an enhancement.

**Obtain an independent compliance score** by resolving the AWS account eligibility restriction through a support case and running Security Hub's HIPAA standard, replacing the design-level proxy with an externally computed assessment.

**Add a database service to continuous integration** so the row-level security suite runs on every commit. This closes the verification gap in Section 6.3.5 and prevents the class of regression that Section 6.3.1 describes.

**Consider a warm standby architecture** if sub-fifteen-minute recovery is ever required. A pre-provisioned database instance would meet the original NFR-06 target, at the cost of permanently running infrastructure — a trade this pilot deliberately did not make, and one that should be evaluated against the clinic's actual tolerance for downtime rather than against a figure chosen during design.

**Complete the deferred functional work** recorded during implementation: persistence for the clinical annotation tool, a doctor-facing working-hours screen, a superadmin-managed clinical template library, cross-device real-time queue updates by WebSocket, and live integration with the Wasfaty electronic prescription service, which requires a registered SFDA facility identifier.

**Migrate file storage to object storage.** Uploaded documents currently rest on instance storage. Moving them to S3 with server-side encryption would improve durability, simplify recovery, and remove the constraint that prevents the demonstration build from supporting uploads.

**Deploy to Alamin Polyclinic.** The clinic's original incident motivated this project, and a pilot deployment with real users and real operational conditions would test the system in the way no laboratory exercise can.

---

### 6.5 Chapter Summary

This project set out to investigate the principles of secure cloud architecture for healthcare, to build a secure patient data management system on AWS, and to evaluate it. The first two objectives were fully achieved, the second exceeding its original functional scope considerably. The third was partially achieved: automated scanning, penetration testing and recovery testing were completed, while the compliance score was blocked by an account restriction, the performance requirement was never measured, and user acceptance testing remains unexecuted.

The project's more useful findings came from things that did not work. Penetration testing found a real cross-tenant vulnerability in a table the design had intended to protect and the implementation had missed. Two automated security gates were found to be reporting clean results because they had been configured, inadvertently, in ways that prevented them from reporting anything else. A recovery requirement specified without measurement was disproved the first time it was measured. In each case the defect lay in the verification rather than the feature, which is the more concerning class of defect, and each is now covered by an automated check.

Against the five-day outage that motivated it, the delivered system recovers in under an hour from total infrastructure loss, isolates patient records at two independent layers, and blocks its own deployment pipeline on security findings. What it does not yet have is evidence from anyone outside the project that it is usable by the people it was built for. That remains the work most worth doing next.

---

### References

Al-Issa, Y., Ottom, M. A., & Tamrawi, A. (2019). EHealth cloud security challenges: A survey. *Journal of Healthcare Engineering*, 2019. https://doi.org/10.1155/2019/7516035

Argaw, S., Bempong-Ahun, N., Eshaya-Chauvin, B., & Flahault, A. (2019). The state of research on cyberattacks against hospitals and available best practice recommendations: A scoping review. *BMC Medical Informatics and Decision Making*, 19. https://doi.org/10.1186/s12911-018-0724-5

Paidy, P., & Chaganti, K. (2024). Resilient cloud architecture: Automating security across multi-region AWS deployments. *International Journal of Emerging Trends in Computer Science and Information Technology*, 5(2), 82–93.
