# PDMS UI Brief — How to Prompt for Non-AI-Looking Screens

This brief is the reference agents must read before building or redesigning any screen.
It answers: who uses this screen, what is their one job, and what makes this screen
memorable — not just functional.

Read `design-system.md` for tokens (colors, type, spacing). This file is for *thinking*.

---

## The Product in One Sentence

A bilingual Arabic/English clinic management system for a small Saudi family clinic
(Alamin Clinic, Riyadh) that survived a ransomware attack and moved to the cloud.
Security is a feature here — not invisible infrastructure.

---

## Who Uses This and What They Actually Need

| Role | Real Job | Their Main Pain |
|---|---|---|
| **Doctor** | Sees 20–30 patients/day | Finding the right patient chart fast, seeing allergies before prescribing |
| **Staff (Admin)** | Runs the front desk | Registering new patients quickly and scheduling without double-booking |
| **Patient** | Checks their own health | Finding their last prescription or next appointment without calling the clinic |
| **Superadmin** | IT / clinic manager | Creating accounts for new hires, deactivating ones who leave |

---

## The Tone

- **Warm, not cold.** This is a small family clinic, not a hospital chain. Teal not blue.
- **Calm, not sterile.** Medical apps go wrong by feeling like an ICU. This one should feel like the clinic's own aesthetic.
- **Arabic-first, not translated.** The layout was *designed* RTL. English is the flip, not the default.
- **Trusted, not flashy.** No gradients everywhere, no glowing cards. Just quality details.

---

## What to Explicitly Avoid (Tell Claude This Verbatim)

> "Avoid the typical AI-generated dashboard look:
> no pure white background with blue accents,
> no glass-morphism cards with heavy blur,
> no three-column admin panels that look like every SaaS template,
> no gradient buttons on every CTA.
> Use the existing design system tokens exactly.
> One bold idea per screen, everything else quiet."

---

## Screen-by-Screen Brief

---

### 1. Login Page

**Primary user:** Any role — staff, doctor, patient, superadmin.
**Their one job:** Get in fast. This is not a marketing moment.

**What makes it memorable:**
The screen is split — left side is a deep teal panel (`primary-700`) with the clinic name
in both scripts stacked (`عيادة الأمين` large, `Alamin Clinic` smaller below it, white text),
a single Arabic calligraphy-inspired decorative line or geometric pattern (SVG, teal-on-teal
subtle), and a short trust line ("Your records, secure since 1986").
Right side is clean white with the form.

**Real field names:** Email address, Password, "Forgot password?" link.
**Interaction to nail:** Language toggle in top-right corner switches both sides simultaneously
(form labels + left panel text). Error message must be specific: "No account with this email"
vs "Wrong password" vs "Account deactivated — contact your administrator."
**Empty/error states:** Inline under each field in `danger-600`. Not a toast for auth errors.
**Do not:** Center a logo above a generic card on a gray background.

---

### 2. Doctor Dashboard

**Primary user:** Doctor, first thing in the morning.
**Their one job:** Know what their day looks like before the first patient walks in.

**What makes it memorable:**
A "Today" strip at the top — full width, `primary-50` background, shows:
`[current time]  ·  [X appointments today]  ·  Next: [Patient Name] at [HH:MM]  ·  [X pending lab results]`
This strip is the heartbeat of the screen. Everything else is secondary.

Below: two columns.
- Left (wider): Today's appointment list as a vertical timeline — time markers on the left edge,
  patient name + appointment type as a card, status pill (confirmed / pending / arrived).
  Current time slot highlighted in `primary-50` with a left border accent.
- Right (narrower): "Recent patients" — last 5 patients seen, avatar + name + last visit date.
  Quick-link to jump to their chart.

**Real field names:** Patient name, MRN #, appointment type (General / Follow-up / Specialist),
time, status (confirmed / pending / cancelled / completed).
**Interaction to nail:** Clicking an appointment card expands inline — shows the patient's
allergies (red pill) and last diagnosis. No modal. Inline expansion.
**Do not:** A generic "stats grid" with 4 cards showing numbers. That's not what a doctor needs.

---

### 3. Staff (Admin) Dashboard

**Primary user:** Reception staff, all day.
**Their one job:** Register patients and fill today's schedule.

**What makes it memorable:**
Two big action buttons dominate the top — "Register New Patient" and "Book Appointment" —
full-width on mobile, side-by-side on desktop. `primary-600` filled. This is not subtle.
These are the only two things staff do all day. Make them obvious.

Below: Today's appointment list (same timeline component as Doctor Dashboard but read-only
status only — staff cannot see clinical notes). Plus a "Recently registered" strip showing
the last 3 patients added today with their MRN and registration time.

**Do not:** Give staff the same dashboard as the doctor with some columns hidden.
Different role = different primary action = different layout priority.

---

### 4. Patient Dashboard

**Primary user:** Patient checking in from their phone.
**Their one job:** See their next appointment or find their last prescription.

**What makes it memorable:**
A large, centered "Your Next Appointment" card — date, time, doctor name, appointment type.
If no upcoming appointment, the card becomes a CTA: "Book an Appointment — contact the clinic."
Below: Two sections — "Recent Records" (last 2–3 visit summaries, date + diagnosis line only)
and "Active Prescriptions" (medication name, dosage, end date).

**Real field names:** Doctor name, specialty, appointment date/time, diagnosis (brief text),
medication name, dosage, frequency, start/end date.
**Do not:** A grid of 4 stat cards (total appointments, total records, etc.). Patients don't
need stats. They need their information.

---

### 5. Patient List (Staff + Doctor)

**Primary user:** Staff registering, or doctor looking up a chart.
**Their one job:** Find a specific patient in under 5 seconds.

**What makes it memorable:**
Search is the hero — large search bar at top spanning 60% of the width, placeholder:
"Search by name, MRN, or phone number…" / "ابحث بالاسم أو رقم السجل أو الجوال…"
Results appear as the user types (debounced 300ms).

Table rows:
```
[Avatar: colored initials]  Full name (bold)         MRN #       DOB        Last visit   [View →]
                            Phone number (muted)
```
Avatar color: deterministic from name — same patient always gets the same teal/warm tone.
Row hover: `bg-primary-50` — not gray.
Empty state: Not "No results found." → "No patient found for '[search term]' — register them?"
with a "Register New Patient" button.

**Do not:** Paginated table with 10 columns. Show only what staff/doctor needs to identify
the right person. Details live on the profile page.

---

### 6. Patient Profile

**Primary user:** Doctor reviewing a chart mid-consultation.
**Their one job:** See full history without losing context of who this patient is.

**What makes it memorable:**
A sticky header that never scrolls away:
```
[Avatar]  Patient Full Name  ·  MRN #  ·  DOB (Age)  ·  Blood Type  ·  [Allergies: Penicillin ⚠]
```
Allergies are always visible in a `warning-600` badge. This is a safety feature.

Below the sticky header: vertical tab navigation — Medical Records | Appointments | Demographics.
Each tab shows a chronological timeline of events, newest first.

Medical Records timeline entry:
```
[Date]  Visit type  ·  Dr. Name
        Chief complaint (1 line)
        Diagnosis (bold)
        [Expand for SOAP notes + prescription]
```

**Interaction to nail:** The expand/collapse is smooth (150ms). Expanding shows the full SOAP
note in a readable format — not a raw form. Prescription medications render as styled pills
(name + dosage), not plain text.

**Do not:** A tabbed form that looks like a data entry screen. The profile is for *reading*,
not editing. Edit mode is a separate intentional action (pencil icon → unlocks fields).

---

### 7. Appointments Page

**Primary user:** Staff booking or rescheduling. Doctor checking their own schedule.
**Their one job:** See the day's flow and spot gaps or conflicts.

**What makes it memorable:**
A day view timeline — hours as rows (8 AM to 10 PM), appointments as blocks inside their
time slot. Doctor columns side by side if multiple doctors (like a simple weekly planner).
Toggle between Day View and List View (toggle in top-right).

List view = the same timeline card component used in dashboards. Consistent language.

**Do not:** A full calendar month view as the default. For a clinic this size, the day view
is what matters. Month view can be a secondary toggle.

---

### 8. Medical Records Page (Doctor view)

**Primary user:** Doctor writing a note after seeing a patient.
**Their one job:** Write the SOAP note for this visit and attach it to the right patient.

**What makes it memorable:**
Split pane — left side shows the patient's history (timeline, read-only), right side is the
new note form. Seeing history while writing the current note = fewer medical errors.
On mobile: stacked (history above, form below).

Form fields: Chief Complaint (textarea), Objective Findings (textarea), Assessment (textarea),
Plan (textarea), Prescriptions (add row: drug name + dosage + frequency + duration).
Submit button: "Save Record" — not "Submit" (clinical language).

**Do not:** A page with just a form and no context of the patient's history.

---

### 9. Settings Page

**Primary user:** Any role changing their own password or toggling language.
**Their one job:** One quick change, then get back to work.

**What makes it memorable:**
A single, focused column — not a settings wall with 20 options. This system has 3 settings:
Language toggle (Arabic/English), Change Password, and for superadmin only: Change Display Name.
The language toggle is a large, obvious segmented control — not a dropdown. Clicking it changes
the page live. This is the best demo of the bilingual system.

**Do not:** Sidebar navigation within settings. This is a small app, not an enterprise suite.

---

### 10. Landing Page

**Primary user:** Anyone not yet signed in — a prospective or existing patient browsing
before they log in or self-register.
**Their one job:** Get a trustworthy first impression of a real family clinic, then find
the door in — book an appointment (via login/self-registration) or call in an emergency.

**What makes it memorable:**
This is the one screen in the whole system with its own identity — `brand.gold` /
`brand.charcoal`, pulled from the actual Alamin Clinic logo, deliberately kept separate
from the internal app's teal so the public site doesn't read as "generic SaaS dashboard
wearing a clinic's logo." Warm, calm, small-family-clinic tone — not a hospital chain,
even though (per real signage/phone evidence gathered mid-Sprint-3c) the clinic operates
**2 branches + a numbered pharmacy chain across Riyadh**, not Jeddah — see the note below.
Every section below either already exists (elevate it) or is new but grounded in what
this system actually has data for — nothing here is a live feed the backend can't produce.

**As of the mega-menu redesign (DELTA-016), this is 4 public routes, not one long
scroll** — user feedback was that the single-page version required too much scrolling
and didn't reflect the site's real structure. All 4 share `LandingNav`/`LandingFooter`
(`pages/landing/shared.tsx`):

- **`/` (Landing)** — sticky nav → hero with headline/CTA/photo and a **decorative
  search bar** ("Search by doctor, department, or service…") that routes to `/login` on
  submit with an explanatory toast, since there is no public search endpoint → 4
  quick-access cards (Book Appointment → `/login`, Find a Doctor → scrolls to Doctors,
  Emergency → `tel:` link, Departments → `/services`) → animated stats (charcoal
  count-up section) → **"What We Offer" teaser**, 3 hover-lift image cards (Services,
  Medical Facilities, Patient & Visitor) that route out to the pages below, replacing
  what used to be a full in-page grid → Featured Doctors, 3-4 static authored cards
  (name, specialty, short blurb), **no photos of real people** (none exist — use
  icon/illustration-style deterministic-initials avatars, same as the internal app) —
  one shared CTA → Testimonials, 3 authored patient-quote cards with star rating →
  Emergency banner, full-width, hotline + "24/7" badge + click-to-call → How It Works →
  Contact → footer (about blurb, quick links, contact info, copyright).
- **`/services`** — full department grid (6 cards: General Medicine, Pediatrics,
  Internal Medicine, Dental, Dermatology, Laboratory — never Cardiology/Neurology/
  Surgery, which imply a hospital this isn't) + a "Book an Appointment" CTA banner.
- **`/facilities`** — one photo card per real branch (name, address, "Get Directions"
  Google Maps search link — not a live embed), plus a Pharmacy card (photo, address,
  branch-count badge). `#pharmacy` hash scrolls straight to the pharmacy card.
- **`/patient-info`** — Patient Rights + Insurance & Payment cards (standard,
  non-fabricated clinic-policy boilerplate, not tied to any specific insurer name), plus
  the FAQ accordion. Banner uses a real clinic photo of a patient's arm/wristband — no
  face, consistent with the no-identifiable-real-people-photos rule. `#faq` hash scrolls
  straight to the accordion.

**Nav mega-menu:** 4 dropdown groups (About / Services / Medical Facilities / Patient &
Visitor), each item an image-thumbnail tile, not a plain text link — images pulled from
the same real clinic photography used elsewhere on the site. Items either route to one
of the 3 standalone pages or, for content that only lives on the landing page (Our
Story, How It Works, Our Doctors, Contact Us), scroll to that anchor — navigating home
first if clicked from another page (`useGoToSection`/`useScrollOnArrival`). Header
background is a permanent dim overlay (not transparent-over-hero) so mega-menu panels
always have a legible surface to open against.

**Real field names:** None of this is backed by live API data — it's marketing copy,
same as the existing hero/stats copy in `locales/{en,ar}/landing.json`. The 2 facility
addresses and the pharmacy address are real (from clinic signage photos), not
fabricated — everything else remains authored placeholder copy.
**Interaction to nail:** The decorative search bar must never look broken — clicking it
or submitting shows a clear "Sign in to search the full directory" toast before
redirecting, never a silent dead end.
**Do not:** Add social media icons, a newsletter signup, or a live map embed (a "Get
Directions" outbound link is fine — it's not an embed) — there are no real accounts/
backend for any of them, and shipping dead decoration is worse than leaving it out. Do
not reach for `blog`, `AI symptom checker`, `telemedicine`, `careers`, or dark mode —
none of those exist in this project's scope; a generic "hospital website" brief does not
override what this specific clinic system actually is.

> **Jeddah → Riyadh correction (mid-Sprint-3c):** Real clinic photography surfaced
> signage reading "مجمع الأمين الطبي **2**" and "صيدلية الأمين **3**" with `011`/`056`
> Riyadh-area phone numbers — the clinic is actually Riyadh-based with 2 medical branches
> and a numbered pharmacy chain (3+ locations, only 1 with a known address). The landing
> page copy (hero subtext, footer about, contact address/phone) was corrected sitewide to
> Riyadh. The submitted PSM1 report chapters never named a city, so this doesn't
> contradict anything already graded — but `docs/psm2/report-delta.md` tracks it as a
> fact to carry into any PSM2 report chapter that describes the clinic's location.

---

## The Signature Elements (System-Wide)

These 4 details make the whole system feel designed, not generated:

1. **Deterministic avatar colors** — every person (patient, doctor) always gets the same
   color avatar based on their name. Consistent. Recognizable. Never random.

2. **Teal row hover** — every data table uses `bg-primary-50` on hover, not gray.
   A small thing that makes the whole system feel intentionally themed.

3. **Allergy badge always visible** — on any screen that shows a patient's name in a clinical
   context, their allergies appear as a compact `warning-600` badge next to the name.
   This is a design decision with patient safety implications.

4. **Bilingual transitions** — when the language toggle is clicked, the entire page transition
   direction flips. LTR → RTL transition slides content from right. RTL → LTR slides from left.
   The animation itself respects direction. 150ms ease.

---

## Ready-to-Paste Prompt Prefix for Any Screen

Paste this before asking an agent to build a specific page:

```
You are building a screen for a bilingual Arabic/English clinic PDMS (Alamin Clinic, Jeddah).
Read these two files before writing any code:
  - docs/psm2/design-system.md   (tokens: colors, type, spacing, what to avoid)
  - docs/psm2/ui-brief.md        (who uses each screen and what makes it memorable)

Use the existing Tailwind tokens exactly — do not introduce new colors or shadow values.
Use shadcn/ui components as a base, then layer design-system styling on top.
Framer Motion for any animation — no CSS @keyframes.
All strings via useTranslation() — no hardcoded copy.
Arabic: line-height 1.7+, letter-spacing 0, font-size 17px body, Thmanyah font.
One bold visual idea per screen. Everything else should be quiet and serve that idea.
```

Then follow with the specific screen brief from this file.
