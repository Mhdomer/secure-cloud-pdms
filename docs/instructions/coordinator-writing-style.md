---
tags: [fyp, instructions, coordinator, writing-style, chapter-1, chapter-2, chapter-4]
source: PSM Coordinator video
date: 2026-05-08
updated: 2026-05-09
status: captured
---

# PSM Coordinator — Writing Style Guidelines

**Source:** PSM Coordinator instructional video  
**Applies to:** Chapter 1 structure and writing approach

---

## 1. Chapter 1 Structure for System Development Projects

| Section | Coordinator Name | Key Requirement |
|---------|-----------------|-----------------|
| 1.1 | Introduction | Use the **Funnel Approach** — start generic about the domain, taper down to the specific problem |
| 1.2 | Project Background | Elaborate on the current situation / organisation that needs improvement |
| — | Problem Statement | Identify the specific flaws in the current manual/existing process |
| — | Proposed Solution | Brief overview of the system being built to fix those flaws |
| 1.3 | Project Aim | Single sentence explaining the key target |
| 1.4 | Project Objectives | Measurable steps — follow the 3-step pattern (see below) |
| 1.5 | Project Scope | Domain + Hardware/Software + Data/Subjects (see below) |
| 1.6 | Project Importance | Why it's being developed and who benefits |

---

## 2. Key Rules Per Section

### Introduction — Funnel Approach
Start broad (the domain: healthcare IT, cloud security) → narrow to the specific organisation and problem → end with the proposed solution as the bridge.

### Problem Background / Problem Statement
For system development, you must explain **the process**:
- Describe how the task is currently done (e.g., "manual signatures on paper", "FTP file transfer")
- Identify specific issues: slow? error-prone? fraud risk? security vulnerability?
- Explain why a new solution is necessary **now**

### Project Objectives — The 3-Step Pattern (MANDATORY)
Objectives must be **measurable** and **visible in the final output**. For system development, always follow:

1. **(a) Review / Analyse** — Study existing approaches and the technology to be used
2. **(b) Design & Develop** — Actually build the proposed system
3. **(c) Test** — Two types of testing:
   - **Operational Testing** — Check if the system runs correctly
   - **User Acceptance Test (UAT)** — ⚠️ **COMPULSORY to submit**

> ⚠️ Do NOT use subjective words like "easy" in objectives — they cannot be measured.

### Project Scope — Three Boundaries
Scope is not just a list of users. It defines limitations:

1. **Domain** — Which specific department or area the system applies to
2. **Hardware / Software** — Specific versions or tools being used
3. **Data / Subjects** — The limit on how many people or records will be used for the pilot/testing

### Gantt Chart
- Required to cover the **14-week semester**
- Must include milestones for Chapter 1–2 reports and Chapter 3–4 drafts
- Do NOT list "Development" as taking only 10 days — ensure the timeline is logical
- Discuss Gantt Chart with supervisor to verify the plan is realistic

---

## 3. Coordinator's Final Advice

- **"Just Write"** — Don't wait for perfection. Write the first draft so you have something to move on from.
- **Avoid subjective words** — Do not use words like "easy", "simple", "fast" in objectives — they cannot be measured.
- **Show your supervisor** the Gantt chart and draft chapters to verify the plan is logical.

---

---

## Chapter 2 — Literature Review Requirements

**Source:** PSM Coordinator instructional video  
**Applies to:** Chapter 2 structure, data collection, referencing, and comparison tables

---

## 5. Chapter 2 Structure for System Development Projects

| Section | Coordinator Name | Key Requirement |
|---------|-----------------|-----------------|
| 2.1 | Introduction | Overview of what the chapter covers |
| 2.2 | Organisation / Case Study | Background of the organisation, its current manual/digital process |
| 2.3 | User Requirements | Data collection — interview or survey with stakeholders; show the instrument and the results |
| 2.4 | Current System + Comparison | Current system deficiencies + comparison table of ≥ 3 existing systems including the proposed system |
| 2.5 | Technology Review | Review each technology used with academic/industry justification — not just a description |

---

## 6. Key Rules for Chapter 2

### Data Collection — Survey vs Interview
- **Survey:** Must have **15–35 respondents** to be statistically representative.
- **Interview:** Acceptable for smaller case studies, but must be **structured** (fixed questions), and must show both the **instrument** (questions) and the **results** (summary table/chart).
- The data collection section must clearly state: who was interviewed/surveyed, how many, and what instrument was used.

### Comparison Table (MANDATORY)
- Must compare **at least 3 existing systems** against each other.
- The **proposed system must be included** as a column/row in the comparison table.
- Comparison criteria should be relevant to the problem — e.g., security model, features, scalability, cost.

### Technology Review — Justification Required
- Do not just describe what a technology does — explain **why it was chosen** over alternatives.
- Each technology section should include: what it is → what the literature says about it → why it fits this project.
- Mind mapping is recommended as a visual tool to show how technologies relate to each other and to the problem.

### Reference Rules (STRICTLY ENFORCED)
1. **10-Year Rule:** Only cite sources published **2016 or later** (from the year of submission, 2026, going back 10 years).
   - Exception: **Seminal / foundational works** (e.g., original theoretical frameworks) may be cited if no newer equivalent exists — but this must be stated explicitly.
2. **No Wikipedia** — never cite Wikipedia as a source, even for background definitions.
3. **No unverified web pages, blogs, or forum posts** — only peer-reviewed journals, conference papers, or official vendor/government documentation.
4. All references must follow **APA format**.

---

## 7. Gaps Found in Our Current Chapter 2

| Requirement | Our Status | Action Needed |
|------------|------------|---------------|
| Organisation/case study background | ✅ Section 2.2 covers Alamin Clinic in detail | None |
| Data collection instrument shown | ✅ 8-question interview instrument in 2.2.3 | None |
| Data collection results shown | ✅ Table 2.1 stakeholder interview findings | None |
| Survey/interview framing | ⚠️ We used 3-person interview; coordinator says surveys need 15–35. | Frame explicitly as **structured interview** (not survey). A 3-stakeholder interview is valid for a case study. |
| ≥ 3 existing systems compared | ✅ Table 2.4 compares Traditional HMS, OpenEMR, Epic, Proposed — 4 systems | None |
| Proposed system in comparison table | ✅ Included in Table 2.4 | None |
| Features adopted from existing systems | ✅ Table 2.5 with source, justification, adaptation | None |
| Technology review with justification | ✅ Sections 2.5.1–2.5.7 each have what/why/literature | None |
| 10-year rule — Ahuja (2012) | ❌ 2012 is 14 years old — **FAILS** the rule | Replace with a 2016+ cloud-in-healthcare survey, OR justify as seminal if no newer equivalent |
| 10-year rule — Singh & Chatterjee (2015) | ❌ 2015 is 11 years old — **FAILS** the rule | Replace with a 2016+ IAM/RBAC paper, OR justify as the specific conference paper where this model was defined |
| 10-year rule — Al-Issa (2019) | ✅ 7 years old | None |
| 10-year rule — Argaw (2019) | ✅ 7 years old | None |
| 10-year rule — Paidy & Chaganti (2024) | ✅ 2 years old | None |
| No Wikipedia | ✅ No Wikipedia citations found | None |
| Workflow diagrams (current + proposed) | ⬜ Figure 2.2 and 2.3 not yet drawn | HIGH PRIORITY — produce in draw.io before submission |

### Reference Fixes Required

**Ahuja et al. (2012)** — cited in Section 2.5.1 (Cloud Computing in Healthcare).  
Action: Add a qualifying sentence: *"Although published in 2012, Ahuja et al. remains a frequently cited foundational survey in the field; its core findings on security barriers to cloud adoption have been corroborated by more recent work including Al-Issa et al. (2019)."* This invokes the seminal-works exception. Alternatively, add a 2016+ paper alongside it.

**Singh & Chatterjee (2015)** — cited in Sections 2.4.1 and 2.5.6 (RBAC / multi-tier auth).  
Action: Add a qualifying sentence similar to above, OR find a 2016+ paper that establishes the same multi-layer RBAC principle (e.g., from IEEE/ACM on IAM in cloud healthcare).

---

## 4. Gaps Found in Our Current Chapter 1

Checking our Chapter 1 against the coordinator's requirements:

| Requirement | Our Status | Action Needed |
|------------|------------|---------------|
| Funnel approach in intro | ✅ Covered — starts generic, narrows to Alamin Clinic | None |
| Problem Background — current process described | ✅ Section 1.2 covers FTP, flat server, reactive security | None |
| Problem Statement — specific flaws identified | ✅ Four deficiencies clearly stated | None |
| Proposed Solution mentioned in intro | ✅ Section 1.1 describes the proposed system | None |
| Project Aim — one sentence | ✅ Section 1.3 | None |
| Objectives — 3-step pattern | ✅ (a) Review ✅, (b) Design ✅, (c) Test + UAT ✅ | Fixed |
| Scope — Domain | ✅ Alamin Clinic, patient data management | None |
| Scope — Hardware/Software | ✅ Specific tools listed (Trivy, SonarQube, Checkov, React, Node.js, PostgreSQL 16) | None |
| Scope — Data/Subjects | ✅ Pilot dataset + min 3 UAT participants added | Fixed |
| Gantt Chart | ⬜ Not yet produced | Appendix A — see FIGURES.md |
| UAT compulsory | ✅ Added to objective (c) | Fixed |

---

## Chapter 4 — Requirement Analysis and Design Requirements

**Source:** PSM Coordinator instructional video  
**Core Philosophy:** Design is a response to requirements AND constraints (the "tailor" analogy — what the user needs + limitations = the design). Goal is to envision the end product so you build the right thing, not patch spaghetti later.

---

## 8. Chapter 4 Required Diagrams (System Development Track)

### Functional Modeling — ALL diagrams are MANDATORY

| Diagram | Purpose | Our Status |
|---------|---------|------------|
| **Use Case Diagram** | Actors and their permitted actions | ✅ Figure 4.1 ATTACH exists |
| **Sequence Diagram** | How objects/users/processes interact over time | ❌ MISSING — need per-module or per-key-UC |
| **Activity Diagram** | Bird's-eye workflow of the whole system | ❌ MISSING |
| **Class Diagram** | Attributes and methods of internal structure | ❌ MISSING |
| **System Architecture** | User → Network → Server → Database connection | ✅ Figure 4.2 ATTACH exists |

### Database Design
- Identify data to store, determine relationships, choose data types ✅ Section 4.4 done

### Interface Design Rules
- **Master Minimalism** — use negative space, avoid clutter ✅ wireframes are clean
- **Form Follows Function** — beauty must not obstruct purpose ✅ role-isolated dashboards
- **Accessibility** — readable fonts, responsive navigation ⬜ note explicitly in design rationale
- **"Click Here" Rule** — design must be intuitive, no need to explain where to click

---

## 9. Key Rules for Chapter 4

- **No Orphan Figures** — every diagram and table MUST be referenced AND explained in the text before it appears (e.g., "Figure 4.3 shows..."). Never paste a diagram without a paragraph describing it.
- Every diagram must have a caption.
- Design choices must be traceable to requirements — explain WHY each decision was made, not just WHAT was built.
- Discuss design with supervisor before starting implementation to confirm it is logical.

---

---

## Chapter 3 — Methodology & Writing Format Requirements

**Source:** PSM Coordinator instructional video

---

## 11. Chapter 3 Structure (System Development Track)

| Section | Coordinator Name | Key Requirement |
|---------|-----------------|-----------------|
| 3.1 | Introduction | Brief — state what the chapter covers only |
| 3.2 | Chosen Methodology | Name YOUR method + justify it. **Do NOT list every methodology.** |
| 3.3 | Project Phases | Activities per phase with UML diagrams to illustrate |
| 3.4 | Tools & Technology | Specific hardware/software + their purpose |
| 3.5 | System Requirement Analysis | **Minimum specs a USER needs to run the system** — not your own PC's specs |

---

## 12. Mandatory Writing Format Standards

| Rule | Requirement |
|------|-------------|
| **Tone** | Passive voice — "It is found that..." NOT "I found that..." |
| **Abstract** | Both English and Malay. Max **300 words, single paragraph** each. |
| **Page limit** | PSM1: max **50 pages** (excluding appendices). PSM2: max 100 pages. |
| **Citations** | Harvard system (UTM Thesis Guide). Every in-text citation must match reference list. |
| **Figure/table numbering** | Sequential by chapter — first figure in Ch3 is Figure 3.1. |
| **No orphan figures** | MUST write "Table 3.1 shows..." BEFORE the table appears in text. |
| **Placement** | Figure/table appears AFTER it is first mentioned. |
| **Turnitin** | Every chapter submitted. Max **20% similarity**. |
| **Language setting** | Set Word to "English (Malaysia)". |
| **Title length** | Maximum **15 words**. |
| **Backup/versioning** | Use versioned filenames: `Thesis_v1_2026-05-08`. |

---

## 13. Common Errors to Avoid

| Error | Rule |
|-------|------|
| Scrum/Joint Application Development | **Do NOT use** unless you have a team. PSM is individual. |
| Listing all methodologies | **Do NOT list** Waterfall, Scrum, etc. just to reject them — describe yours and justify it. |
| Plagiarism | Malay-to-English translation is still plagiarism. Failing grade. |
| Asking supervisor to proofread | Use Grammarly / a friend. Supervisor is for content guidance only. |
| Active voice | Avoid "I designed..." — use "The system was designed..." |
| Title too long | Maximum 15 words for the project title. |

---

## 14. Gaps in Our Current Chapter 3

| Requirement | Our Status | Action Needed |
|------------|------------|---------------|
| 3.1 Introduction | ✅ One paragraph, covers what chapter does | None |
| 3.2 Names one methodology + justifies | ⚠️ Section 3.2.1 lists and compares all three methodologies before justifying ours | Flag for supervisor — coordinator says don't list all. But comparison table (Table 3.1) strengthens justification. Keep but frame as brief context. |
| 3.3 Project phases with activities | ✅ Five sprints with scope, deliverables, security gates | None |
| 3.4 Tools & Technology | ✅ Sections 3.4.1–3.4.6 cover all components | None |
| 3.5 Minimum user hardware/software specs | ❌ MISSING — current 3.5 has FR/NFR tables but no user-side minimum specs table | **Add Section 3.5.3** — minimum client requirements table |
| Passive voice throughout | ✅ "Three methodologies were considered", "The methodology is selected" — passive | None |
| Bass et al. (2015) reference | ❌ Still in Ch3 references — fails 10-year rule (2015 = 11 years old) | Replace or justify as seminal (same fix as Ch2 note) |
| Scrum warning | ✅ We use "Agile + DevSecOps" — not Scrum. We are an individual project. | None — but verify Chapter 3 summary doesn't call it "Scrum-based" |
| Project title length | ⚠️ Title likely exceeds 15 words — check cover page title | Shorten to ≤15 words if needed |

---

## 10. Gaps in Our Current Chapter 4

| Requirement | Our Status | Action Needed |
|------------|------------|---------------|
| Use Case Diagram | ✅ Figure 4.1 | None |
| Sequence Diagrams | ❌ Missing | Add at least 4 — one per module (Auth, Patient Mgmt, Medical Records, Appointments) |
| Activity Diagram | ❌ Missing | Add Figure showing full system workflow (login → role routing → action → audit) |
| Class Diagram | ❌ Missing | Add Figure showing Node.js model classes with attributes + methods |
| System Architecture | ✅ Figure 4.2 | None |
| Database Design | ✅ Section 4.4 | None |
| Interface Design | ✅ Section 4.5 | Add accessibility/minimalism justification sentence |
| No orphan figures | ✅ All ATTACH markers have descriptions | None |
| Use-cases folder (detailed UCs) | ❌ Only 4 UCs exist | Create docs/design/use-cases/ — 18 UCs across 4 modules |
