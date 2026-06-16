# AI Prompt – Create My FYP1 (PSM 1) Presentation Using University Template

You are an experienced academic presentation designer and university thesis presentation expert specialising in cybersecurity and cloud computing projects.

I will provide you with:

1. The official UTM (Universiti Teknologi Malaysia) PowerPoint template (.pptx)
2. My complete PSM 1 Final Year Project report (PDF)

Your task is to create a professional PSM 1 viva presentation directly inside the provided UTM template.

---

## Project Context (Read This First)

**Project Title:**
Design and Deployment of a Secure Cloud-Based Patient Data Management System Using a Three-Tier Architecture on AWS

**Student:** Mohamed Omar
**Programme:** SECRH (Security) — Universiti Teknologi Malaysia, Johor Bahru
**Stage:** PSM 1 — Analysis and Design Phase ONLY. Implementation has NOT been done yet.

**Core motivation:**
A real Malaysian private clinic called Alamin Clinic suffered a ransomware attack in May 2023. Patient data was inaccessible for 5 days, records were permanently lost, and the root cause was traced to three critical security gaps: no role-based access control, no audit trail, and no disaster recovery plan.

This project proposes a secure cloud-based solution to directly address all three gaps.

---

## Objective

Create a clean, modern, academic presentation suitable for a UTM examination panel.

The presentation should summarise the report — not copy it.

The final presentation should contain **11–12 slides maximum**, including the title slide.

---

# VERY IMPORTANT

Read the ENTIRE report before creating any slides.

Do NOT simply extract headings.

Understand the project first, then decide what information deserves to appear on each slide.

This is a **PSM 1 project** — it covers analysis and design only. Do NOT claim or imply that the system has been built or implemented. Present it as a proposed and designed system ready for implementation in PSM 2.

Only include information that helps explain the project within a **12–15 minute presentation**.

---

# Presentation Style

Follow the UTM PowerPoint template exactly.

Do NOT change:

* Fonts
* Theme
* Colour palette
* Logo placement
* Footer
* Header
* Background
* Slide master

Only replace placeholder content.

The presentation should look like it was officially prepared by a UTM student.

---

# Design Requirements

Keep every slide visually clean.

Use:

* Short bullet points
* Icons where appropriate
* Professional diagrams
* SmartArt
* Flowcharts
* Architecture diagrams
* Comparison tables only when necessary

Avoid paragraphs.

Maximum per slide:

* 5 bullet points
* 6–8 words per bullet wherever possible

Never fill slides with text.

---

# Speaker Notes

For every slide, generate detailed speaker notes.

The speaker notes should explain:

* Exactly what to say out loud
* Transition sentence to the next slide
* Additional context not shown on the slide

The slides remain concise. The notes carry the full explanation.

---

# Images and Diagrams

Extract figures directly from the report wherever they exist.

If figures are low quality, recreate them professionally.

Improve and include:

* AWS three-tier architecture diagram (Figure 4.2 from the report)
* Use case diagram (Figure 4.1)
* ER diagram / database schema (Figure 4.5)
* DevSecOps CI/CD pipeline flowchart
* Current system workflow (Figure 2.2)
* Interface wireframes (Appendix E, Figures E.1–E.4) — show these on the interface slide

Maintain academic appearance throughout.

---

# Visual Consistency

Use consistent:

* Icon style (flat line icons only — no clip art)
* Spacing and alignment
* Font sizes
* Margins
* Colour usage — UTM red as the primary accent only

Everything should look like one professionally designed presentation.

---

# Presentation Structure

## Slide 1 — Title Slide

Use the UTM template cover slide.

Include:

* Project title
* Student name: Mohamed Omar
* Programme: SECRH
* Supervisor: [Supervisor Name]
* Faculty: Computing — UTM Johor Bahru
* Year: 2026
* Label: PSM 1 — Final Viva Presentation

---

## Slide 2 — Background & Problem Statement

Briefly explain:

* Alamin Clinic's current system (manual, server-based, no security controls)
* The May 2023 ransomware attack and its impact (5-day outage, data loss)
* The three critical gaps discovered: no RBAC, no audit trail, no disaster recovery

Include a simple visual showing the problem — for example, a "current state" vs "impact" flow or a 3-box visual highlighting the three gaps.

---

## Slide 3 — Problem Statement

Clearly state the three root causes as distinct problems:

1. No role-based access control — shared credentials, flat server access
2. No audit trail — post-incident forensics were impossible
3. No disaster recovery — 5-day recovery, permanent data loss, no IaC

Show real-world impact clearly. Use a structured layout or comparison visual.

---

## Slide 4 — Aim, Objectives & Scope

Present the project aim as one concise sentence.

Present the four objectives using SmartArt or numbered icons:

1. Design a three-tier AWS VPC with isolated subnets
2. Implement RBAC at three layers: JWT · IAM · PostgreSQL RLS
3. Build a DevSecOps CI/CD pipeline with three automated security gates
4. Achieve RTO < 15 minutes using Terraform infrastructure-as-code

Below the objectives, add a compact scope line:
3 roles (Doctor · Admin · Patient) | AWS only | PSM 1 = Design | PSM 2 = Implementation

Avoid paragraphs. Use icons.

---

## Slide 5 — Literature Review & Research Gap

Very briefly compare three existing systems against the proposed solution using a table:

| Feature | OpenEMR | Epic Systems | Proposed System |
|---|---|---|---|
| RBAC | Basic | Enterprise | 3-layer (JWT+IAM+RLS) |
| Audit Trail | None | Yes | CloudTrail + audit_log |
| Cloud Deployment | On-premise | Private | AWS (public cloud) |
| IaC / DR | None | Proprietary | Terraform RTO < 15 min |
| DevSecOps Pipeline | None | None | 6-stage automated |

Below the table, clearly state the research gap in one or two bullet points.

---

## Slide 6 — Methodology

Show the Agile + DevSecOps methodology as a visual flowchart or cycle.

Include the 5 sprints as a horizontal timeline:

Sprint 1: Requirements & Architecture →
Sprint 2: Network & Database Layer →
Sprint 3: Application Layer →
Sprint 4: Security Integration →
Sprint 5: Testing & Documentation

Mark Sprint 1 as COMPLETED (PSM 1). Sprints 2–5 are PLANNED (PSM 2).

Add two small notes:
* Requirements gathered through 2 structured stakeholder interviews
* DevSecOps scanning is automated at every pipeline stage — not added at the end

---

## Slide 7 — System Architecture

Create a clean AWS architecture diagram based on Figure 4.2 in the report.

Show three clearly labelled tiers:

**PUBLIC TIER:**
Application Load Balancer (HTTPS) · NAT Gateway

**PRIVATE APPLICATION TIER:**
EC2 — Node.js/Express API · S3 + CloudFront (React frontend)

**PRIVATE DATABASE TIER:**
RDS PostgreSQL · AES-256 encryption at rest · RLS active

Show cross-cutting controls below:
Security Groups | Network ACLs | IAM Roles | CloudTrail | Terraform IaC

Use AWS service icons where possible. Keep the diagram clean and readable.

---

## Slide 8 — System Design

Divide this slide into three sections:

**Left: Use Case (Figure 4.1)**
* 18 use cases · 3 actors (Doctor, Admin, Patient)
* 5 modules: Authentication, Patients, Records, Appointments, Audit

**Centre: ER Diagram (Figure 4.5)**
* 6 tables: users, patients, doctors, medical_records, appointments, audit_log
* UUID primary keys

**Right: Key Design Decisions**
* Row-Level Security on medical_records (doctor sees only own patients)
* Row-Level Security on patients (patient sees only own profile)
* audit_log is append-only — no UPDATE or DELETE allowed

---

## Slide 9 — Security Design & DevSecOps Pipeline

Split this slide into two sections.

**Top section — 3-Layer RBAC (three side-by-side cards):**

Layer 1 — JWT (Application):
httpOnly cookie · bcrypt cost 12 · role in token · SameSite=Strict

Layer 2 — AWS IAM (Infrastructure):
Least-privilege per service · EC2 cannot reach RDS directly · S3 no public access

Layer 3 — PostgreSQL RLS (Database):
Doctors see only assigned records · bypass requires schema change · independent of app layer

**Bottom section — DevSecOps Pipeline (6-stage horizontal flow):**

[1] Code Checkout → [2] SonarQube SAST → [3] Docker Build → [4] Trivy Image Scan → [5] Checkov IaC Scan → [6] Terraform Apply

Label stages 2, 4, 5 as "BLOCKS on failure". Label stage 6 as "Only runs if ALL pass".

---

## Slide 10 — Interface Design

Show the four wireframes from Appendix E of the report (Figures E.1–E.4).

Arrange as a 2×2 grid with a small label under each:

* Login Screen (E.1) — Single entry for all roles · JWT redirect · No self-registration
* Doctor Dashboard (E.2) — Assigned patients only · No admin functions
* Admin Dashboard (E.3) — Logistics only · No clinical data visible
* Patient Portal (E.4) — Read-only · No edit or delete controls

Add a one-line caption at the bottom:
"Role isolation enforced visually — each interface shows only the data and actions permitted for that role."

---

## Slide 11 — PSM 1 Achievements & PSM 2 Roadmap

Divide the slide into two equal columns.

**Left column — PSM 1 Completed (green checkmarks):**
* Ransomware root cause analysis
* 2 stakeholder interviews conducted
* 18 use cases · 12 FR · 11 NFR documented
* 3-tier AWS VPC architecture designed
* 3-layer RBAC model defined
* 6-stage DevSecOps pipeline designed
* DB schema + RLS policies designed
* 4 interface wireframes produced
* HIPAA §164.312 compliance mapped

**Right column — PSM 2 Planned (arrow icons):**
* VPC + RDS + IAM deployment via Terraform
* Node.js + React implementation
* JWT auth + RLS activation
* Pipeline activation and testing
* Penetration testing + security audit
* PDPA 2010 Malaysia compliance review
* PSM 2 viva — November 2026

Add a red banner at the bottom:
"PSM 2 Timeline: June – November 2026"

---

## Slide 12 — Conclusion & Thank You

**Left section:**
Three conclusion points, each with an icon:

🔒 3-Layer RBAC — JWT · IAM · PostgreSQL RLS
📋 Complete Audit Trail — CloudTrail + append-only audit_log
⚡ RTO < 15 Minutes — Terraform IaC vs. 5-day recovery at Alamin Clinic

Below: "PSM 1: Design complete. PSM 2: Implementation — June to November 2026."

**Right section:**
THANK YOU
Mohamed Omar
SECRH — UTM Johor Bahru
Supervisor: [Name]
PSM 1 · 2026

---

# Content Rules

Do NOT invent information. Everything must come from the report and the context given above.

This is PSM 1 — never say the system is "built", "developed", or "implemented". Use words like "designed", "proposed", "planned", "will be implemented in PSM 2".

If something is unclear in the report, infer only from surrounding context. Do not fabricate technical details.

---

# Language

Use professional academic English.

Grammar must be flawless.

Do not use AI-style wording.

Write naturally like an excellent university student.

Avoid repetitive phrases.

---

# Animation

Use only subtle animations.

Fade or Appear only.

No fancy transitions between slides.

---

# Output Requirements

Deliver the presentation as a fully editable PowerPoint (.pptx).

Do NOT output Markdown.

Do NOT provide only an outline.

Actually build every slide using the UTM university template provided.

All diagrams must be editable wherever possible.

Speaker notes must be included in the notes panel of every slide.

---

# Final Quality Checklist

Before finishing, verify:

✔ Every slide strictly follows the UTM university template
✔ Total slides are between 11 and 12
✔ No walls of text anywhere
✔ All bullet points are concise (max 6–8 words)
✔ Diagrams are clean, labelled, and readable
✔ Speaker notes are complete for every slide
✔ Visual style is fully consistent across all slides
✔ No spelling or grammar mistakes
✔ No placeholder text remains (except figure placeholders if figures cannot be extracted)
✔ The project is presented as PSM 1 design phase — no implementation claims
✔ The presentation looks professional enough for a UTM FYP viva panel

The final result should resemble a presentation prepared by a top-performing SECRH student and be suitable for presentation to UTM examiners.
