# Sprint 5 — User Acceptance Testing Plan (Ready to Execute, Not Yet Run)

Status: **drafted, not executed**. Chapter-3 §3.3.5 requires UAT with at least three representative
participants, one per original user role (Doctor, Admin, Patient — chapter-5 §5.2.2's PSM1 testing
strategy). Running this needs real human testers, which is a coordination task for the project owner,
not something an automated session can substitute for by testing itself. This document is the
ready-to-hand-out script for whenever those three (or four, see the note below) people are available.

**Unlike the RTO test and Security Hub assessment, this does not require live AWS infrastructure.**
The application runs identically against a local dev environment (confirmed working during this
sprint's black-box pen test — local PostgreSQL + `npm run dev`/`node src/server.js` backend +
`npm run dev` frontend on `localhost:5173`) or against a live deployment if one happens to be up for
another reason (e.g. immediately after the RTO test, before tearing back down). The blocker here is
purely people, not infrastructure or cost.

---

## Participants

| Role | Minimum count | Note |
|---|---|---|
| Doctor | 1 | Should ideally have some real clinical/admin-software familiarity — a total novice will conflate "hard to use" with "unfamiliar with clinic software in general" |
| Admin / Staff | 1 | Front-desk/reception workflow — check-in, scheduling, billing |
| Patient | 1 | Ideally someone with no prior exposure to the system — patients are the role most likely to be a true first-time user in real deployment |
| Superadmin *(optional, PSM2 addition)* | 0–1 | Chapter-3's original PSM1 design only specified three roles (Doctor/Admin/Patient); the Staff/Superadmin split is a PSM2-era addition (`docs/psm2/report-delta.md`). Include a fourth tester for this role if available, but it isn't required to satisfy chapter-3's minimum |

None of these need to be clinicians or IT staff in real life — the point is exercising the UI/workflow
from a fresh perspective, not validating clinical accuracy (that's out of scope for a software UAT).

---

## Environment setup (do this once, before any participant starts)

1. Ensure local Postgres is running and the schema is current
   (`psql`/equivalent against the `pdms` database, or re-apply `src/backend/src/config/schema.sql`
   if this is a fresh database).
2. `cd src/backend && node src/server.js` (or `npm run dev`).
3. `cd src/frontend && npm run dev` — confirm it serves at `http://localhost:5173`.
4. Seed one clean test account per role. **Do not hand testers the shared accounts documented in
   `DEV_CREDENTIALS.md`** — those are reused across every development/QA session and may have
   inconsistent state (old test data, prior session's half-finished records) by the time UAT runs.
   Create fresh, single-purpose accounts instead:
   - Superadmin/Admin: `ADMIN_USERNAME=uat.doctor.seed ADMIN_PASSWORD='<generate a real one>' npm run seed:admin` (superadmin role, used only to create the other three accounts through the real UI — see Task D1 below, which doubles as part of the Admin participant's script)
   - Doctor, Patient: created live during the session as part of the Admin participant's and the
     self-registration flow's own tasks (see Sections 2 and 4) — this is deliberately part of the
     test, not pre-seeded, since account creation is itself a real workflow being evaluated.
5. Have the language toggle (English/Arabic) visibly available and mention its existence to every
   participant before they start — whether someone tries it is itself signal (does a natural workflow
   ever surface the option, or does it require being told), but don't hide it as a "gotcha."

---

## Methodology

For each task below: give the participant the plain-language task description only (not the UC
number or the technical route path — that's implementation detail, not what a real user sees).
Observe silently. Record, per task:

- **Completed unaided** / **Completed with a hint** / **Did not complete**
- **Time to completion** (rough, stopwatch is fine — this isn't a performance benchmark against
  NFR-09's 3-second API budget, it's "did the person get stuck")
- **Verbatim quotes** for anything the participant says unprompted (frustration, confusion, or
  positive reactions are all useful — don't paraphrase in the moment, write it down as said)

After all tasks for a role are done, ask the participant to rate the following on a 1–5 scale (this is
a lightweight System Usability Scale subset, not the full 10-item SUS — appropriate for a 3-person
FYP UAT, not a claim of statistical rigor):

1. I found this system easy to use.
2. I felt confident I wasn't going to accidentally do something wrong (e.g. delete or change the
   wrong patient's data).
3. If this replaced my current system, I think it would make my job easier.
4. The Arabic/English switch (if tried) felt like a natural part of the same system, not a separate
   experience bolted on.

Then one open question: *"What's the one thing about this you'd change first?"*

---

## Task scripts

### 1. Patient (UC-19 self-registration → UC-20 self-booking)

1. "You're a new patient at Alamin Clinic and have never used this system before. Create your own
   account." (Self-registration via phone OTP — the stub SMS provider logs the OTP to the server
   console in dev mode; the test facilitator relays the code out-of-band, standing in for a real SMS.
   This substitution should be disclosed to the participant as "in the real system this arrives by
   text message" so it doesn't read as a broken feature.)
2. "Log in with the account you just created."
3. "Book an appointment with a doctor of your choice, for any time that's available."
4. "Find your upcoming appointment and reschedule it to a different time." (UC-21b)
5. "You've just come from a checkup. Find your medical record from that visit and check what the
   doctor wrote." (Requires a doctor participant, or the facilitator acting as one, to have already
   created a visit + record for this patient — sequence this after Task 2 in the Doctor script if
   running roles in sequence rather than in parallel.)
6. "Find an invoice or bill on your account and check what you owe."
7. "You've forgotten your password. Get back into your account." (Forgot-password OTP flow)

### 2. Admin / Staff (UC-06, UC-14, front-desk/billing workflow)

1. "A new patient walks in without having registered online. Register them yourself at the front
   desk." (UC-06)
2. "Assign this new patient to a doctor." (UC-09)
3. "Schedule an appointment for this patient with their assigned doctor." (UC-14)
4. "The patient checks in for their appointment. Check them in as a walk-in / start their visit in
   the queue." (Walk-in queue feature — PSM2 addition)
5. "The doctor has finished seeing this patient and it's time to collect payment. Generate the bill
   and take a payment." (Billing engine — PSM2 addition; test both a full payment and, if time
   allows, a partial payment to see if the "resume collecting the rest" flow reads as intuitive to
   someone who's never seen the earlier bug this fixed — see `docs/psm2/qa-fixes-2026-07-24.md`)
6. "Reschedule this same patient's appointment to a different day." (UC-17)
7. "Cancel a different, unrelated appointment." (UC-17 / cancel workflow)

### 3. Doctor (UC-11, UC-12, UC-13, clinical workflow)

1. "Log in and find today's patient queue / schedule."
2. "Open the record for the patient the Admin participant just registered and see their history."
   (UC-13 — sequence after Task 2's Admin script)
3. "Start a consultation and write a clinical note for this visit — chief complaint, diagnosis,
   whatever feels natural." (UC-10, SOAP-structured notes — PSM2 addition)
4. "Issue a prescription for this patient." (E-prescription feature)
5. "This patient needs a sick leave certificate for their employer. Issue one." (PSM2 addition —
   also the exact feature this sprint's pentest found and fixed a cross-tenant data leak in; a doctor
   naturally attempting to look up a *different* patient's sick-leave history here, even by accident,
   is a useful informal secondary confirmation that the fix holds up under real usage, not just the
   scripted curl test already run in `docs/psm2/sprints/sprint-5-security-evaluation.md`)
6. "A colleague's patient needs your opinion. Find a patient that isn't normally assigned to you
   and see what you can and can't do with their record." (This should surface RBAC/RLS boundaries
   naturally — if the participant can view/edit a record they have no legitimate access to, that's a
   UAT-surfaced security finding, not just a task-completion failure, and should be escalated
   immediately rather than just noted for later.)
7. "Mark this visit as complete."

### 4. Superadmin *(optional fourth role)*

1. "Create a new staff account for a receptionist."
2. "Deactivate an account that's no longer needed."
3. "Look at the clinic's financial analytics for this month."
4. "Add a new department or clinical service to the price list."

---

## What to do with the results

- Any task in the **"Did not complete"** column gets written up as a specific UX finding in the
  evaluation report (`docs/psm2/sprints/sprint-5-security-evaluation.md` or its own section), with
  the participant's own words where available — not just "usability could be improved."
- Any moment a participant reaches data or an action they should not have access to (Doctor Task 6
  above is the deliberate trap for this, but treat any accidental instance anywhere the same way) is
  a **security finding**, escalated the same way `docs/psm2/security-audit-fixes-2026-07-24.md` and
  this sprint's own pentest findings were — not filed only as a UX note.
- Aggregate the 1–5 ratings per role; report the mean and the raw scores (3–4 data points doesn't
  support anything beyond descriptive reporting — do not compute a p-value or claim statistical
  significance for an n this small).
- This UAT's results are a required PSM2 report deliverable per chapter-5 §5.2.2 ("The user acceptance
  testing (UAT) would consist of not less than three users being tested") — write the outcome into
  the corresponding chapter-5 implementation/testing section once run.

## What still needs a human decision before this can run

Three (or four) willing participants and roughly 30–45 minutes each. No AWS cost, no infrastructure
decision — purely a scheduling/coordination task for the project owner.
