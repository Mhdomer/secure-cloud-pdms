---
layout: post
title: "PSM1 Roadmap: How I'm Structuring My FYP Documentation"
date: 2026-04-26
categories: [fyp, process, documentation]
---

Chapter 1 is written and committed. Now I want to be transparent about the full plan — what PSM1 actually requires and how I'm approaching each phase.

## What PSM1 Is

PSM1 is the design and documentation semester of the Final Year Project at UTM. No code, no deployment — just rigorous system design backed by literature. The submission follows a fixed structure from the UTM thesis template for System Development projects.

My report covers four chapters:

| Chapter | Title |
|---------|-------|
| 1 | Introduction |
| 2 | Literature Review |
| 3 | System Development Methodology |
| 4 | Requirement Analysis and Design |

Chapters 5 (Implementation) and 6 (Conclusion) come in PSM2 next semester, when the actual AWS infrastructure gets built.

## The Six Phases

**Phase 0 — Setup** ✅  
Repo, directory structure, UTM template mapped. [GitHub: secure-cloud-pdms](https://github.com/Mhdomer/secure-cloud-pdms)

**Phase 1 — Chapter 1: Introduction** ✅  
Problem background (Alamin Clinic ransomware), project aim, objectives, scope, and why it matters. Written and pushed.

**Phase 2 — Chapter 2: Literature Review** ← current  
Deep dive into the case study, comparison of existing healthcare systems, and academic grounding for the technology choices (three-tier architecture, Terraform, DevSecOps, HIPAA).

**Phase 3 — Chapter 3: Methodology**  
Justifying Agile + DevSecOps as the development methodology, mapping the phases to the project timeline, and documenting all system requirements.

**Phase 4 — Chapter 4: Design**  
The technical core — VPC network design, IAM policy structure, database schema, and interface wireframes. This is where the security architecture gets fully documented.

**Phase 5 — Front Matter**  
Abstract (bilingual: English + Bahasa Melayu), list of abbreviations, dedication, acknowledgement. Written last once all chapters are stable.

**Phase 6 — Final Review**  
Cross-referencing, UTM formatting compliance, APA references, and supervisor review prep.

## Why Document This Way

Most FYP blogs document the *output* — here's my system, here's what it does. I want to document the *process* — the decisions, the trade-offs, the things that didn't fit neatly into the proposal.

Every phase will get a post. See you at Chapter 2.
