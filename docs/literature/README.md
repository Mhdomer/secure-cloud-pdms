# Literature Review

## Status: In Progress

This section documents the literature review underpinning the design decisions for the Secure Cloud PDMS.

## Planned Documents

- [ ] `systems-comparison.md` — Comparison table of existing healthcare systems
- [ ] `cloud-security-review.md` — Review of cloud security frameworks (HIPAA, AWS Shared Responsibility)
- [ ] `devsecops-review.md` — Shift-left security and IaC literature
- [ ] `references.md` — Full APA reference list

## Key Comparison (from Proposal)

| System | Key Features | Main Limitations |
|--------|-------------|-----------------|
| Traditional On-Premise HMS | Control over data, no internet dependency | High ransomware risk, manual updates, hardware cost |
| OpenEMR (Open Source) | Patient portals, scheduling, billing | Reactive security, manual updates, requires servers |
| Epic Systems (Commercial) | All-in-one clinical solution | Extremely high cost, unaffordable for small clinics |
| **Proposed System (Alamin Clinic)** | 3-Tier AWS + DevSecOps, shift-left security, security by design | Focused on infrastructure security, not billing features |

## Core References

- Argaw et al. (2019) — cyberattacks against hospitals; scoping review
- Al-Issa et al. (2019) — eHealth cloud security challenges
- Ahuja et al. (2012) — state of cloud computing in healthcare
- Paidy & Chaganti (2024) — resilient cloud architecture across multi-region AWS deployments
- Singh & Chatterjee (2015) — secure multi-tier authentication in cloud environments
