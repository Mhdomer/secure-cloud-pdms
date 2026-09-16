# NFR-06 (RTO ≤ 15 min) — resolution decision

**Status: ACCEPTED by the author, 2026-09-16, and applied.** This changes a
stated non-functional requirement in a submitted PSM1 report. The submitted
Table D.2 is preserved unchanged as the historical record; the revision lands
as Table D.5 alongside the other PSM2 requirement changes, and every living
document that stated the 15-minute target now states the revised pair.

**Still worth raising with Dr. Johan** at the next supervision — revising a
submitted requirement is defensible and documented here, but he should hear
it from you rather than find it in the PSM2 report.

## The problem

NFR-06 states **RTO ≤ 15 minutes** (full Terraform redeployment from wipe).
The live test on 2026-07-31 measured **47m48s** — see
`sprints/sprint-5-security-evaluation.md` §6 for the full runbook and
timings. The result was recorded honestly but never resolved in the thesis
narrative, leaving the report asserting a target the system provably misses.

## Why it misses — and why more automation would not fix it

Two of the three phases are structurally bounded, not merely unoptimised.

| Phase | Measured | Bounded by |
|---|---|---|
| Infrastructure provisioning | 17m40s | **RDS Multi-AZ creation alone: 15m11s / 15m22s** across two independent runs |
| Application deployment | 29m56s | Image build/push, SSM updates, frontend build — **plus a mandatory human approval** |
| Health-check convergence | 12s | Not a factor |

**1. RDS Multi-AZ alone consumes the entire budget.** Two live runs measured
15m11s and 15m22s for RDS creation — consistent, and already at or over the
15-minute target before a single other resource exists, let alone the
application. The 15-minute figure was set during PSM1 design without a
measurement behind it.

**2. A human approval step is unavoidable *by design*.** Getting from
"infrastructure exists" to "traffic serving" requires the deploy pipeline,
and all three deploy jobs run under a GitHub `production` environment with a
required-reviewer rule (`deploy.yml:43`, `:98`, `:233`) — a deliberate
Sprint 4 control preventing unreviewed code reaching an environment holding
patient data. Removing it to hit an RTO number would trade a real security
control for a performance metric, on a project whose entire premise is the
opposite tradeoff.

This is the part worth foregrounding in the report: **NFR-06 as written is in
direct tension with the deploy-approval control, and the control is the more
defensible of the two.** A recovery target that assumes unattended automation
was never compatible with a pipeline deliberately built to require a human.

## Recommendation: split NFR-06 into two measured targets

Replace the single unmeasured figure with two targets that separate what
automation controls from what human process controls. Both are set from
observed data with headroom.

| ID | Requirement | Measured | Proposed target |
|---|---|---|---|
| **NFR-06a** | *Infrastructure recovery.* Time from `terraform apply` to all resources provisioned and healthy, unattended. | 17m40s | **≤ 25 minutes** |
| **NFR-06b** | *Full service restoration.* Time from recovery start to the ALB serving real traffic, including the mandatory deploy-approval gate. | 47m48s | **≤ 60 minutes** |

Justification to carry into the report:

- **NFR-06a** is the number the engineering actually controls, and it is
  dominated by an AWS-side floor (RDS Multi-AZ ≈ 15 min) that no amount of
  Terraform tuning removes.
- **NFR-06b** reflects the system as it is genuinely operated, approval gate
  included. Reporting only the unattended number would overstate readiness.
- Both are honest, both are met by the measured run, and neither requires
  weakening a control to satisfy.

## Alternatives considered and rejected

| Option | Why not |
|---|---|
| Keep ≤ 15 min, report the miss | Leaves the report asserting a target contradicted by its own evidence. Acceptable only if the supervisor prefers the original requirement stay frozen as submitted. |
| Drop RDS Multi-AZ to single-AZ | Would cut roughly 7–8 min, but trades AZ-failure availability for a recovery metric. Also does not address the ransomware/account-wipe threat that motivated this project — both AZs sit in the same AWS account either way. |
| Remove the deploy approval gate | Trades a deliberate security control for a performance number, on a security FYP. Rejected outright. |
| Warm standby / pre-provisioned RDS | Genuinely would meet ≤ 15 min, but means paying for always-on infrastructure — incompatible with this project's zero-cost-when-idle posture, and out of scope for a pilot. Worth naming in the report as the architecture that *would* hit the original target, and what it would cost. |

## If the recommendation is accepted

Report edits owed (tracked as DELTA-048 in `report-delta.md`):

- **Chapter 3 §3.5.2 / Appendix D Table D.2** — replace NFR-06 with NFR-06a
  and NFR-06b, with the measured figures and the rationale above.
- **Chapter 5** — record the original ≤ 15 min target, the measured 47m48s,
  the two structural causes, and the revision. Frame it as a design
  requirement corrected by measurement, which is a stronger engineering
  narrative than a target that was met because it was never tested.
- **Chapter 5 (Future Work)** — warm standby as the route to sub-15-minute
  recovery, and what it costs.

## Still outstanding, unrelated to this decision

**UAT with 3+ participants** (`sprints/sprint-5-uat-plan.md`) remains the only
fully unexecuted Sprint 5 deliverable. It needs human scheduling and incurs no
AWS cost. It is not blocked by anything technical.
