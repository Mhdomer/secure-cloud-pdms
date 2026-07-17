# Report Delta — Changes That Need Report Updates

Every time a design decision, role, UI element, use case, or rule changes during PSM2
implementation, it gets logged here with the exact report section that needs to be edited.

**Format per entry:**
- **What changed** — short description
- **Category** — Role | UI | Functionality | Security | DB Schema | API | Use Case
- **Report section** — chapter + section title
- **What to update in the report** — specific edit instructions

---

## Sprint 3c — Self-Service Patient Registration (Design)

---

### [DELTA-010] New use case: patient self-registration via OTP + self-booking

| Field | Value |
|---|---|
| **Category** | Use Case / Functionality / Security / DB Schema |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — SMS provider is stubbed (logs the OTP instead of sending it), needs a real provider before production use |

**What changed:**
PSM1's submitted report has patient registration as Admin-only (UC-06) and patients
as read-only on appointments (PRD §2). This adds three new use cases not in the
submitted design at all: UC-19 Patient Self-Registration (phone OTP-verified,
national ID + DOB identity check, patient sets their own password, username =
national ID), UC-20 Patient Books Own Appointment, and UC-21 Patient Cancels Own
Appointment. Self-registered patients start with no assigned doctor and get
auto-assigned to whichever doctor they book their first appointment with — without
that, the treating doctor has no RLS-granted way to chart the visit at all (see
`docs/psm2/self-registration-design.md` §5 for the mechanism). Full design + all
six implementation decisions: `docs/psm2/self-registration-design.md`.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR for self-registration (OTP-verified) and patient-initiated appointment booking |
| Chapter 3 | User stories | Add a patient-actor story for self-registration and self-booking |
| Chapter 4 | Use Case Diagram | Add UC-19/UC-20/UC-21, with Patient as an unauthenticated actor for UC-19 |
| Chapter 4 | §4.x ER Diagram | Add `otp_verifications` entity; add `email`, `preferred_language` to patients entity |
| Chapter 4 | §4.x RBAC / Access Control Design | Patient role gains a write capability (own appointments) for the first time — update the role-permission matrix |
| Chapter 4 | §4.x Security Design | Document the OTP flow's abuse-prevention controls (rate limiting, single-use, expiry, attempt limits) as a new unauthenticated-endpoint risk this project didn't previously have |

---

## Sprint 3c — UX Smoothing (Patient Search, Doctor Directory, Login Username)

---

### [DELTA-011] Patient login username = national ID, not a random string

| Field | Value |
|---|---|
| **Category** | Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
Every patient account's `users.username` is now their `national_id` (trimmed, same
value already validated unique on `patients`) instead of a randomly generated
`patient_xxxxxxxx` string. Applies to both UC-06 (admin registration) and UC-19
(self-registration) — the temp-credentials panel now shows a username the patient
already has memorized rather than a string they'd have to write down. A defensive
409 ("This ID number is already in use as a login username by another account") was
added for the practically-impossible case of a collision with an existing staff
username, mapped from the `users_username_key` unique-constraint violation.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update UC-06's temp-credential FR: username is the patient's national ID, not system-generated |
| Chapter 4 | §4.x Sequence Diagram (Figure 4.11, Register Patient) | Update the "generate temp credentials" step description |

---

### [DELTA-012] GET /doctors directory + shared frontend doctor picker

| Field | Value |
|---|---|
| **Category** | API / UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
New `GET /doctors` endpoint (superadmin/admin/doctor) returns the active-doctor
directory (`doctor_id`, `full_name`, `specialisation`, `is_active`), backing a new
shared frontend component (`components/shared/DoctorSelect.tsx`) that replaced five
separate raw-UUID text inputs across the app — patient registration, doctor
reassignment, appointment scheduling, appointment editing, and patient
self-booking — with a single reusable searchable dropdown. Staff/patients now pick a
doctor by name; a doctor's UUID is never typed or displayed anywhere in the UI.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Staff and patients shall select a doctor by name from an active-doctor directory, never by ID" |
| Chapter 4 | §4.x API Design | Add `GET /doctors` to the endpoint table |
| Chapter 4 | §4.x UI Design | Note the doctor-picker as a reusable, system-wide UI pattern, not a per-screen control |

---

### [DELTA-013] Admin-facing patient search UI

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
`PatientLookupPage` split by role: Admin now gets a debounced, live search box
(national ID exact match / name substring / phone prefix, backed by the
`GET /patients?q=` endpoint from DELTA-005) showing a compact result list with
avatar, name, national ID, phone, and an "Unassigned" badge — replacing the old
"paste a known patient UUID" form entirely for that role. Doctor keeps the
UUID-paste lookup unchanged, since `GET /patients?q=` is admin-only server-side
(matches the `admin_select_patients` RLS policy) and a doctor session has no
search endpoint to call — they still have "recently treated patients" for
browsing without a known ID.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x UI Design / Screen Designs | Replace the "Patient Lookup" screen description — Admin: live search; Doctor: ID lookup + recently-treated widget |

---

## Sprint 3c — Schema Gap Fixes

---

### [DELTA-005] National ID / Iqama as user-facing patient identifier

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
Two-layer identity model chosen — no MRN. UUID is the DB primary key (internal only,
never shown in UI). National ID / Iqama / Passport is the user-facing identifier:
what staff types to find a patient, what insurance requires, what patients carry.
`id_type` enum handles Saudi citizens (national_id), residents (iqama), and visitors (passport).

Staff workflow: type national ID (or name, or phone) into `PatientLookupPage`'s live
search box → debounced `GET /patients?q=` → click a result → navigate to profile.
Registration: staff enters national ID first → system checks for an existing record
(by name, shown in the 409) before creating a new one.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Staff shall search for patients by national ID, Iqama, or passport number. The system shall prevent duplicate registration for the same ID number." |
| Chapter 4 | §4.x ER Diagram | Add `national_id`, `id_type` columns to patients entity |
| Chapter 4 | §4.x Design Decisions | Add note: two-layer identity — UUID as PK (internal), national ID as user-facing identifier. No MRN needed for a single-clinic system where government IDs are already unique per person. |

---

### [DELTA-006] Patient safety fields added (blood type, allergies, emergency contact, insurance)

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
`patients` table now has: `blood_type`, `allergies` (text), `emergency_contact_name`,
`emergency_contact_phone`, `insurance_provider`, `insurance_number`, `nationality`, `address`.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FRs for allergy recording, emergency contact, insurance info capture |
| Chapter 3 | §3.5.2 Non-Functional Requirements | Mention blood type + allergy visibility as a patient safety NFR |
| Chapter 4 | §4.x ER Diagram | Add all 8 new columns to patients entity |
| Chapter 4 | §4.x UI Design | Blood type + allergies appear in sticky patient header — document as safety design decision |

---

### [DELTA-007] SOAP structure added to medical_records

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
`medical_records` was flat (diagnosis + prescription + notes). Added proper SOAP fields:
`chief_complaint`, `objective` (examination findings), `assessment` (clinical diagnosis narrative),
`plan` (treatment plan), `vital_signs` (JSONB: BP, temp, weight, height), `visit_type`.
Existing `diagnosis` column kept as a short summary line.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update medical record FR to specify SOAP note structure |
| Chapter 4 | §4.x ER Diagram | Update medical_records entity with all SOAP fields + vital_signs JSONB |
| Chapter 4 | §4.x Data Design | Add explanation of SOAP note structure and why vital_signs uses JSONB |

---

### [DELTA-008] Appointment status 'confirmed' added + cancellation tracking

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
`appointments.status` CHECK now includes `'confirmed'` (was missing despite UI showing it).
Added: `duration_minutes`, `cancelled_by` (FK to users), `cancellation_note`.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x ER Diagram | Update appointments entity: new status value, new columns |
| Chapter 3 | §3.5.1 Functional Requirements | Appointment status lifecycle: scheduled → confirmed → completed / cancelled |

---

### [DELTA-009] doctor_availability table added

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
New table `doctor_availability` defines each doctor's weekly working schedule
(day_of_week 0–6, start_time, end_time, slot_minutes). Without this, the appointment
booking system had no way to validate whether a doctor is available at the requested time.
Saudi work week defaults: Sunday–Thursday (days 0–4).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "System shall enforce doctor availability — appointments cannot be booked outside defined working hours" |
| Chapter 4 | §4.x ER Diagram | Add doctor_availability entity with FK to doctors |
| Chapter 4 | §4.x System Design | Describe appointment validation flow: check doctor_availability before confirming booking |

---

## Sprint 3 — Backend + Frontend Implementation

---

### [DELTA-001] 4th role added: `superadmin`

| Field | Value |
|---|---|
| **Category** | Role / Security / Functionality |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
The system originally had 3 roles (Doctor, Admin, Patient). A 4th role `superadmin` was added because admin (reception staff) should not be able to create or deactivate user accounts — that is a security violation. Superadmin exclusively manages system accounts.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Only Superadmin may create, deactivate, or reactivate Doctor and Admin accounts" |
| Chapter 3 | §3.5.1 Functional Requirements | Update the user role list from 3 roles to 4 roles |
| Chapter 3 | User Role table (if exists) | Add Superadmin row with its permissions |
| Chapter 4 | §4.x RBAC / Access Control Design | Add Superadmin to the role-permission matrix |
| Chapter 4 | §4.x Use Case Diagram | Add Superadmin actor and its use cases (Manage User Accounts UC) |
| Chapter 4 | §4.x ER Diagram | Update `role` column type note: `VARCHAR(12) CHECK IN ('superadmin','doctor','admin','patient')` |
| Chapter 4 | §4.x System Architecture | Mention 4-role RBAC in the auth/security design description |

---

### [DELTA-002] Admin role renamed to "Staff" in UI

| Field | Value |
|---|---|
| **Category** | Role / UI |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
The `admin` role database value stays `'admin'` but the display label everywhere in the UI is now **"Staff"** (English) / **"موظف"** (Arabic). This better reflects the role — reception/registration counter staff, not a system administrator.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Replace "Admin" with "Staff" in role descriptions where it refers to reception staff |
| Chapter 4 | Role table / RBAC matrix | Update display name from "Admin" to "Staff" |
| Chapter 4 | Use Case Diagram | Rename the Admin actor to "Staff" |

---

### [DELTA-003] Public landing page added at `/`

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
A public marketing homepage was added at the root route `/`. Unauthenticated users see this page instead of being redirected to `/login`. Authenticated users are still redirected to their dashboard. The page covers: clinic branding, services overview, trust statistics, how-it-works flow, contact info.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "The system shall display a public landing page for unauthenticated users describing clinic services" |
| Chapter 4 | §4.x UI Design / Screen Designs | Add landing page wireframe or screenshot + description of its sections |
| Chapter 4 | Navigation / Routing design | Document that `/` is public (no auth required) and routes unauthenticated visitors to LandingPage |

---

### [DELTA-004] Role hierarchy enforcement — staff cannot create accounts

| Field | Value |
|---|---|
| **Category** | Security / Functionality / Use Case |
| **Sprint** | Sprint 3 |
| **Status** | Implemented |

**What changed:**
In the original design it was not explicitly stated who creates user accounts. Implementation revealed that Admin (Staff) was incorrectly able to create Doctor and Admin accounts — a privilege escalation risk. The rule is now enforced at both the API layer (route requires `superadmin` role) and the frontend (User Management page is only in the Superadmin nav).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.2 Non-Functional Requirements (Security) | Add NFR: "The system shall enforce the principle of least privilege — Staff accounts shall not have account management capabilities" |
| Chapter 4 | §4.x Use Case — Manage User Accounts | Change actor from Admin to Superadmin |
| Chapter 4 | RBAC matrix | Explicitly show that `admin` role has NO permission for Create/Deactivate User |

---

---

## Sprint 3c — QR-Based Password Setup (replaces admin-issued temp password)

---

### [DELTA-017] UC-06 registration no longer discloses a password to staff — QR/token setup flow instead

| Field | Value |
|---|---|
| **Category** | Functionality / UI / Security / DB Schema / API |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — backend smoke-tested via curl, frontend verified live in-browser (both AR/EN) |

**What changed:**
DELTA-011 (this same file) had already moved the patient's *username* to their
national ID. This entry replaces the other half of UC-06's temp-credentials
step: staff no longer see or relay a password at all. Registering a patient
now issues a one-time, single-use, 72-hour setup token (256-bit,
`crypto.randomBytes(32)`), rendered server-side as a QR code (base64 PNG data
URL) plus a plain link. Staff shows the QR to the patient (in person or via
the link); the patient opens a new public page, `/setup-password`, and
chooses their own password. The old "read the temporary password aloud"
step — awkward and error-prone, and the actual motivation for this change —
no longer exists. A parallel "regenerate QR" admin action covers the case
where a patient loses the QR before scanning it or the 72-hour window
lapses; regenerating auto-invalidates the previous unused token so at most
one is ever live per account.

Also surfaced and fixed a real RLS gap while building the regenerate-QR
admin action: the `admin_select_patients` policy only ever matched
`role = 'admin'`, never `'superadmin'` — so a superadmin session (a role this
project added specifically to be admin-equivalent-or-greater, DELTA-001)
would have silently gotten 404s reading the `patients` table. Widened to
`IN ('admin', 'superadmin')`.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Replace the UC-06 temp-credential FR: the system shall not disclose a password to staff; it shall issue a one-time QR/link the patient uses to set their own password |
| Chapter 4 | §4.x Sequence Diagram (Figure 4.11, Register Patient) | Replace the "generate temp password, display to staff" step with "generate setup token, render as QR + link" |
| Chapter 4 | §4.x ER Diagram | Add `password_setup_tokens` entity (FK to `users`, `token`, `expires_at`, `used_at`) |
| Chapter 4 | §4.x Security Design | Document the token's properties as the abuse-prevention controls: 256-bit entropy, single-use (atomic consume), 72-hour expiry, auto-invalidation of prior unused tokens, no auth middleware on the public setup endpoints because the token itself is the credential |
| Chapter 4 | §4.x RBAC / Access Control Design | Note the `admin_select_patients` RLS fix — superadmin now has the same `patients` table read access as admin, closing a gap that predates this feature but blocked it (regenerate-QR needs to resolve patient → user_id under a superadmin session) |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the new public `/setup-password` screen description; update the "Register New Patient" dialog's success-state description (QR panel, not a temp-credentials panel) |

---

## Sprint 3c — Landing Page Major Expansion

---

### [DELTA-014] Landing page expanded from minimal 3-section page to full public-facing clinic site

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — real clinic photography used throughout (hero, services, doctors avatars remain initials-only); see DELTA-015 for a second expansion pass |

**What changed:**
The PSM1 report described a basic public landing page (mentioned in DELTA-003). What is
actually being built is significantly richer: 10 distinct sections covering all aspects of
a real clinic public website, with full bilingual (Arabic/English RTL) support.

Sections added beyond what PSM1 described:

| Section | What it is |
|---|---|
| Quick Access cards | 4 action cards: Book Appointment (→/login), Find a Doctor, Emergency (tel: link), Departments |
| Decorative search bar | Search input that shows "Sign in to search" toast on submit — never a silent dead end |
| Services grid (expanded) | 6 service cards: General Medicine, Pediatrics, Internal Medicine, Dental, Dermatology, Laboratory |
| Featured Doctors | 4 static doctor cards — name, specialty, 1-line bio, deterministic initials avatar (no photos) |
| Patient Testimonials | 3 curated patient quotes with star ratings — static authored content, not a live reviews feed |
| Emergency Banner | Full-width red section with hotline number, 24/7 badge, click-to-call button |
| FAQ accordion | 5 questions covering booking, data security, record access, insurance, clinic hours |
| 3-column Footer | About blurb + quick links + contact/hours — replaces the minimal 1-line footer |

**Also fixed:** Arabic locale (`ar/landing.json`) had trust statistics copied from HMG hospital
group (4,500+ physicians, 3,300+ beds) — wrong for Alamin Clinic. Fixed to match the clinic's
actual scale (15+ physicians, 30+ years, 50,000+ patients, 8 specialties).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update the landing page FR to list all 10 sections (not just "a public overview page") |
| Chapter 4 | §4.x UI Design / Screen Designs | Replace landing page description/wireframe with a section-by-section breakdown (Quick Access, Search, Services, Doctors, Testimonials, Emergency, FAQ, Footer) |
| Chapter 4 | §4.x UI Design | Document the "no real photos" decision for the Doctors section — deterministic initials avatars are used system-wide for any person (patient or doctor) since no actual photos exist |
| Chapter 4 | §4.x UI Design | Document the decorative search bar design decision: clicking shows a toast explaining login is required — this is intentional UX, not a broken feature |

---

### [DELTA-015] Clinic location corrected Jeddah → Riyadh; Medical Facilities, Pharmacy, and Patient Info sections added

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
Real clinic photography (branch exterior + pharmacy storefront) surfaced signage reading
"مجمع الأمين الطبي **2**" and "صيدلية الأمين **3**", with `011`/`056` Riyadh-area phone
numbers — the clinic is Riyadh-based, not Jeddah as the landing page copy previously
assumed (a placeholder guess, never part of the submitted PSM1 report, which does not
name a city). Corrected sitewide on the landing page: hero subtext, footer about blurb,
and contact address/phone (`en/ar` `locales/landing.json`).

Three new landing-page sections added, all backed by real address/photo data from clinic
signage (not fabricated):
- **Medical Facilities** — 2 branch cards (photo, name, real address, "Get Directions"
  outbound Google Maps search link — not a live embed)
- **Pharmacy** — 1 card (photo, real address, "3 Branches" badge reflecting the pharmacy
  chain's own signage numbering; only 1 address is actually known, so the other 2 are
  referenced but not fabricated)
- **Patient Info** — 2 cards (Patient Rights, Insurance & Payment) — standard clinic-policy
  boilerplate, not tied to a specific insurer name

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update any FR naming Jeddah as the clinic's city to Riyadh |
| Chapter 4 | §4.x System Overview / Case Study Background | Update the clinic's stated location to Riyadh; add the 2-branch + pharmacy-chain structure |
| Chapter 4 | §4.x UI Design / Screen Designs | Add Medical Facilities, Pharmacy, and Patient Info to the landing page section breakdown |

---

### [DELTA-016] Landing page split into 4 routes with an image mega-menu; landing page itself shortened

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
DELTA-014/015 had grown the landing page into one long scroll (12 sections). User
feedback: too much scrolling to reach anything, and the nav didn't reflect the site's
real structure — wanted something closer to how real hospital sites (e.g. Dr. Sulaiman
Al Habib Medical Group) organize a mega-menu with image previews and dedicated pages
per section, not everything anchor-scrolled on one page.

Restructured into 4 public routes, all sharing `LandingNav`/`LandingFooter` (extracted
to `pages/landing/shared.tsx`):
- `/` — shortened to Hero, Quick Access, Trust stats, a 3-card "What We Offer" teaser
  (hover-lift cards linking out), Doctors teaser, Testimonials, Emergency banner, How It
  Works, Contact, Footer
- `/services` — full department grid (moved from the landing page)
- `/facilities` — Medical Facilities + Pharmacy (moved; `#pharmacy` hash scrolls to the
  pharmacy card)
- `/patient-info` — Patient Rights, Insurance & Payment, FAQ (moved; `#faq` hash scrolls
  to the accordion); banner uses a real clinic photo of a patient's arm/wristband (no
  face — consistent with the no-identifiable-real-people-photos rule)

Nav is now a 4-group mega-menu (About / Services / Medical Facilities / Patient &
Visitor), each item rendered as an image-thumbnail tile, not a plain text link. Items
either route to one of the 3 new pages or, for content that stays on the landing page
(Our Story, How It Works, Our Doctors, Contact Us), scroll to that anchor — navigating
there first from another page if needed (`useGoToSection`/`useScrollOnArrival` in
`shared.tsx`). Header background changed from transparent-over-hero to a permanent dim
overlay (`neutral-900/55` unscrolled, `neutral-50/95` scrolled) so the mega-menu panels
always have a legible anchor to open from. Logo swapped to the real clinic logo file
(`logo.jpg`); the nav/footer treatment crops just the icon glyph via a pixel-measured
`background-position` (the full vertical lockup's 3-line wordmark is illegible below
~100px) and pairs it with the wordmark as real text instead.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update the landing-page FR: now 4 routes (`/`, `/services`, `/facilities`, `/patient-info`), not a single scrolling page |
| Chapter 4 | §4.x UI Design / Screen Designs | Replace the single landing-page wireframe/description with 4 page descriptions + the mega-menu nav structure |
| Chapter 4 | Navigation / Routing design | Add `/services`, `/facilities`, `/patient-info` as public (no-auth) routes alongside `/` |

---

## How to use this file

1. After each sprint ends, check this file before editing the report.
2. Each DELTA entry tells you exactly which section to open and what to change.
3. Mark entries `Done` in the Status field once the report chapter is updated.
4. New implementation decisions go here first — then into the sprint, then into the report.

---

*Last updated: Sprint 3c (2026-07-16)*
