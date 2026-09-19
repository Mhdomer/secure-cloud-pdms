# Sprint 5 — UAT Instruments (ready to use)

Companion to `sprint-5-uat-plan.md`, which holds the methodology and task
scripts. This file holds the three things you actually need on the day:

1. The participant questionnaire, ready to paste into Google Forms
2. Your observation sheet, for what you record while watching
3. The Chapter 5 §5.4.8 skeleton, with blanks where the numbers go

**Format is modelled on an accepted PSM2 submission.** Basel A. A. Abunada's
thesis (`FYP/Prev papers/PSM2_Thesis_BaselA.A.Abunada.pdf`) reports UAT in
§5.4.3 as three short paragraphs of prose with percentages, one figure, and a
pointer to Appendix J, which contains screenshots of the form's own
auto-generated response charts. That is the whole mechanism — no hand-built
statistics, no manual tables. Copy it.

**Live system:** https://alamin-clinic.vercel.app
Reset between sessions with `node scripts/reset-demo.js`.

---

## Participant numbers — read this before recruiting

Chapter 3 commits to "not less than three", one per role. Three satisfies the
requirement and is the floor.

But Basel had **11 participants**, which is why his "90.9% rated the system 5
out of 5" reads as a finding. With three people your percentages are 33% / 67%
/ 100%, which is honest but thin.

Recommended split:

- **3 facilitated sessions** — one each as Patient, Staff, Doctor, following the
  full task script with you observing. This is the requirement and the source
  of the real findings.
- **A wider questionnaire** — anyone willing to click through the demo and
  answer. Classmates count. The hosted build makes this nearly free: it is a
  link, not a setup.

Report the two groups separately and say which is which. Do not blend a
classmate's five-minute click-through with a facilitated role session and
present them as one number.

---

## 1. Participant questionnaire (Google Forms)

Create a new Google Form. Turn **off** "Collect email addresses" — anonymity
gets more honest answers, and you do not need identities.

### Section 1 — About you

**Q1. Which role did you test?** *(Multiple choice, required)*
- Patient
- Staff / Reception
- Doctor
- Superadmin

**Q2. How would you describe your experience with clinic or hospital software?** *(Multiple choice, required)*
- I work in healthcare and use systems like this regularly
- I have used booking or medical portals as a patient
- I use business software generally, but nothing medical
- I rarely use software like this

**Q3. Which language did you use?** *(Multiple choice, required)*
- English
- Arabic
- I switched between both

**Q4. What device did you use?** *(Multiple choice, required)*
- Laptop or desktop
- Mobile phone
- Tablet

### Section 2 — Task completion

Use **one grid per role**, and set form logic so participants only see the
section matching their Q1 answer. Each grid uses the same three columns:

> **Columns:** `Completed on my own` · `Completed, but I needed help or a hint` · `Could not complete`

**Patient — did you manage to do each of these?** *(Multiple-choice grid, required)*
- Create my own account
- Log in with the account I created
- Book an appointment
- Reschedule my appointment
- Find my medical record and read what the doctor wrote
- Find my bill and see what I owe
- Reset my forgotten password

**Staff / Reception — did you manage to do each of these?** *(Grid, required)*
- Register a new walk-in patient
- Assign the patient to a doctor
- Schedule an appointment for them
- Check the patient in / start their visit
- Generate the bill and take a payment
- Reschedule an appointment
- Cancel an appointment

**Doctor — did you manage to do each of these?** *(Grid, required)*
- Find today's patient queue
- Open a patient's record and see their history
- Write a clinical note for the visit
- Issue a prescription
- Issue a sick leave certificate
- Mark the visit as complete

**Superadmin — did you manage to do each of these?** *(Grid, required)*
- Create a new staff account
- Deactivate an account
- View the clinic's financial analytics
- Add a department or service to the price list

### Section 3 — Your impressions

Scale of 1–5 throughout, labelled at both ends. Keep it to these six; a long
form gets abandoned or answered carelessly.

**Q5. Overall, how would you rate this system?** *(Linear 1–5; 1 = Poor, 5 = Excellent, required)*

**Q6. How easy was it to find what you needed?** *(Linear 1–5; 1 = Very difficult, 5 = Very easy, required)*

**Q7. How clear was the language and wording on screen?** *(Linear 1–5; 1 = Very confusing, 5 = Very clear, required)*

**Q8. How did the system look and feel?** *(Linear 1–5; 1 = Unprofessional, 5 = Very professional, required)*

**Q9. Would this system be useful in a real clinic?** *(Multiple choice, required)*
- Yes
- Maybe
- No

**Q10. Did you feel your information was handled securely?** *(Linear 1–5; 1 = Not at all, 5 = Completely, required)*

> Q10 is worth including on a security project even though it measures
> perception rather than fact. A system can be provably secure and still feel
> untrustworthy, and that gap is a legitimate finding.

### Section 4 — In your own words

Open-ended, all optional. These produce the quotes worth putting in the report.

**Q11. What was the most confusing or frustrating part?**

**Q12. What worked well?**

**Q13. Was there anything you expected to find that wasn't there?**

**Q14. Anything else?**

### Before you send it

Tell participants, in the form's description:

> This is a demonstration system with invented patient data. Nothing here is
> real. File upload is switched off in this version. When you register, the
> verification code appears on screen instead of arriving by text message — in
> the real system it would be an SMS.

That last sentence matters. Without it, participants report the on-screen OTP
as a bug.

---

## 2. Observation sheet (for you, during facilitated sessions)

Print one per participant. This never goes in the appendix — it is where the
findings come from. The questionnaire records what people are willing to say
about themselves; this records what actually happened.

```
UAT OBSERVATION SHEET

Participant #: ____    Role: ____________    Date: __________
Device: ______________  Language: ______________
Experience level (Q2 answer): _________________________________

TASKS
 #  Task                          Time    Completed?      Notes / where they hesitated
                                          (own/hint/no)
 1  ____________________________  _____   ____________    ______________________________
 2  ____________________________  _____   ____________    ______________________________
 3  ____________________________  _____   ____________    ______________________________
 4  ____________________________  _____   ____________    ______________________________
 5  ____________________________  _____   ____________    ______________________________
 6  ____________________________  _____   ____________    ______________________________
 7  ____________________________  _____   ____________    ______________________________

VERBATIM QUOTES  (write exactly what they said, not your paraphrase)
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

HESITATIONS  (anywhere they paused more than ~10 seconds, and at what)
_______________________________________________________________________
_______________________________________________________________________

WRONG TURNS  (clicked something that wasn't the path — record what they
expected it to do)
_______________________________________________________________________
_______________________________________________________________________

SECURITY OBSERVATIONS  (Doctor task 6 especially: did they reach anything
they should not have? Escalate immediately, do not just note it)
_______________________________________________________________________

FACILITATOR HELP GIVEN  (every time you intervened, and why)
_______________________________________________________________________
```

### How to facilitate

**Say almost nothing.** The hardest part of running UAT is not helping. When
someone hesitates for ten seconds, that hesitation is the finding — intervene
and you have destroyed it. Wait. If they are genuinely stuck after a minute,
give the smallest possible hint and record that you gave it.

**Ask them to think aloud.** "Tell me what you're looking for" produces far
more than watching silently.

**Never explain the system beforehand.** What confuses them is the data.

**Budget 30–45 minutes per participant.**

---

## 3. Chapter 5 §5.4.8 skeleton

Replace §5.4.8's current "not yet executed" text with this once you have
results. Blanks marked `___`. Match the register of the surrounding sections —
formal, third person, past tense.

> #### 5.4.8 User Acceptance Testing
>
> User acceptance testing was conducted to evaluate whether the system's
> workflows are usable by people representing each of its user roles, rather
> than only by its developer. ___ participants took part: ___ in facilitated
> sessions following the role-specific task scripts, and ___ who completed the
> questionnaire independently after using the demonstration build.
>
> Participants were given no instruction in advance beyond their role and their
> task list, so that any confusion encountered would reflect the interface
> rather than a briefing. Sessions were conducted against the hosted
> demonstration build, which removed the local installation that had previously
> made scheduling impractical.
>
> **Table 5.5** — Task Completion by Role
>
> | Role | Tasks | Completed unaided | Completed with a hint | Not completed |
> | --- | --- | --- | --- | --- |
> | Patient | 7 | ___ | ___ | ___ |
> | Staff | 7 | ___ | ___ | ___ |
> | Doctor | 6 | ___ | ___ | ___ |
> | Superadmin | 4 | ___ | ___ | ___ |
>
> Overall, ___% of participants rated the system ___ out of 5, and ___% stated
> it would be useful in a real clinic environment. Figure 5.9 shows the overall
> feedback distribution; the full questionnaire results are provided in
> Appendix J.
>
> **Findings.** [One short paragraph per task that anyone failed or needed help
> with. State what they were trying to do, what they did instead, and what that
> implies about the interface. A task nobody could complete unaided is a UX
> defect, not a participant failure — write it that way.]
>
> **Limitations.** The participant group was small and drawn from a
> non-clinical population, so the results speak to general usability rather
> than to clinical workflow fit. Testing was conducted against the
> demonstration build, in which file upload is disabled and the one-time
> passcode is displayed on screen rather than delivered by SMS; neither
> substitution affects the workflows under test, but both are noted for
> completeness.

### Appendix J

Add a new appendix titled **User Acceptance Testing Results**, containing
screenshots of Google Forms' own response summary charts:

- **Figure J.1** — Participant Information of UAT Respondents *(Q1–Q4 charts)*
- **Figure J.2** — Task Completion Evaluation Results *(the grid summaries)*
- **Figure J.3** — Participant Satisfaction Ratings *(Q5–Q10 charts)*

Google Forms generates these automatically under the **Responses** tab. Screenshot
and paste. This is exactly what Basel's Appendix J contains.

### Also update when UAT is done

- **Chapter 6 §6.2.3** — Objective (c) is currently marked *partially achieved*,
  citing UAT as one of three reasons. Revise once this is complete. The other
  two (Security Hub, NFR-09) remain outstanding regardless, so the objective
  does not become fully achieved on UAT alone.
- **Chapter 6 §6.4** — "Execute User Acceptance Testing" is listed first under
  future improvements. Remove it.
- **Chapter 6 §6.5** — the closing paragraph says the project lacks "evidence
  from anyone outside the project that it is usable by the people it was built
  for." That sentence needs rewriting.
