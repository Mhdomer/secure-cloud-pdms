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

## Sprint 3c — Appointment Booking UX + Doctor Scheduling

---

### [DELTA-018] Patient picker extended to appointment booking; Create/Edit Appointment converted to slide-in panels

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live via Puppeteer (search → select → schedule, in Arabic) |

**What changed:**
DELTA-012/013 gave the app a doctor picker (`DoctorSelect`) and an admin-facing
patient search screen (`PatientLookupPage`), but the `patient_id` field inside
`CreateAppointmentDialog`/`EditAppointmentDialog` was never migrated off the
original "paste the patient's UUID from their profile page" text input — spotted
by inspecting the actual booking flow, not by reading a status doc. New
`components/shared/PatientSelect.tsx` is a debounced search-as-you-type combobox
(same `GET /patients?q=` endpoint `PatientLookupPage` already uses — national ID,
name, or phone), wired into both dialogs; a patient UUID is now never typed or
pasted anywhere in the system. Editing an existing appointment pre-fills the
search box with `appointment.patientName` (already present in the list response)
rather than re-fetching.

Both dialogs were also converted from centered `Dialog` modals to the slide-in
`Sheet` pattern (`components/ui/sheet.tsx`, introduced in the User Management
rebuild) — closing a gap in `ui-brief.md`'s Appointments screen brief ("Create
appointment: slide-in panel from the right, not a modal") that the original
Sprint 3c UI pass never actually implemented.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Extend the DELTA-012 FR ("select a doctor by name, never by ID") to explicitly cover patients too |
| Chapter 4 | §4.x UI Design / Screen Designs | Update the appointment scheduling/editing screen description: slide-in panel (not modal), patient search combobox (not a UUID field) |

---

### [DELTA-019] Doctor working-hours (availability) management screen — the write side never had a UI

| Field | Value |
|---|---|
| **Category** | UI / Functionality / DB Schema / Security |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — live smoke test caught and fixed a real DB permission bug (below) |

**What changed:**
DELTA-009 added the `doctor_availability` table and its full backend API
(`GET/POST/DELETE /doctors/:doctorId/availability`, authorized for superadmin or
the doctor themselves — `doctorAvailabilityController.js`), but no frontend
screen was ever built against the write endpoints. The working-hours rows that
gate every appointment booking (`utils/availability.js`'s `isSlotAvailable`) only
ever existed because a developer inserted them directly via SQL during seeding —
raised by the user logging into the superadmin account and finding no way to
create them. New `/doctors/:doctorId/availability` page (superadmin only for
now — the backend's doctor-self-service path has no frontend entry point yet,
a natural follow-up) lists all 7 days, with inline add/edit (start time, end
time, slot length) and a confirm-before-remove per day. Reached via a new
"Working hours" link on doctor rows in User Management, which required adding
`doctorId` to the `GET /users` response (`users.user_id` and `doctors.doctor_id`
are different UUID spaces — the staff directory previously only exposed the
former).

**Bug found and fixed during live smoke testing:** removing a day's hours 500'd
with `permission denied for table doctor_availability`. DELTA-009's original
`GRANT` only gave the `pdms_app` role `SELECT, INSERT, UPDATE` on that table —
`DELETE` was never added, even though `DoctorAvailability.remove()` issues a
real `DELETE` (one row per doctor + day, not a soft-delete flag) and the
DELETE route/controller/model had all existed since DELTA-009. The write path
had evidently never been exercised end-to-end before this session. Fixed by
splitting `doctor_availability` into its own `GRANT ... DELETE` in `schema.sql`
and re-applying it to the local dev DB.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Superadmin shall be able to create, edit, and remove a doctor's weekly working hours" |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the Doctor Working Hours screen description |
| Chapter 4 | §4.x Security Design / DB Grants | Note the corrected `pdms_app` grant on `doctor_availability` (adds `DELETE`) — worth a sentence on why a grant gap like this can ship silently: the write path has no automated test, only manual/live verification catches it |

---

### [DELTA-020] Patient can view their own invoices and lab results — lab results gated behind a doctor "release" step

| Field | Value |
|---|---|
| **Category** | Functionality / UI / Security / DB Schema / API |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — backend smoke-tested via curl (with an RLS bug caught and fixed), frontend verified live in-browser in AR and EN |

**What changed:**
Patient Profile's Invoices and Lab Results tabs (added earlier this sprint,
see the "Backend Edit Sessions" table in `sprint-3c-ui-overhaul.md`) were
staff/doctor-only — a patient had no way to see their own bill or their own
lab results at all, which the user flagged as wrong for invoices ("he
absolutely needs to see it, he's the one paying") and asked for a
compromise on lab results rather than blanket access.

**Invoices** — a patient now sees their own via a new `GET /invoices/mine`
(patientId derived from the session, never a URL param, so there's nothing
to spoof). `patient_invoices` carries no RLS, so `downloadInvoice` gained an
explicit ownership check for patient sessions (`invoice.patient_id !==
session.patientId` → 404) — the only thing standing between a patient
session and someone else's invoice on that table.

**Lab results** — rather than blanket patient access, the user's suggestion
was adopted: a doctor must explicitly "release" a result before the patient
can see it (`released_at`/`released_by` columns, both null by default, so
every existing result stays hidden until acted on). New `PATCH
/lab-results/:resultId/release` (doctor, must be assigned to the patient)
and `GET /lab-results/mine` (patient, released-only). The doctor's existing
Lab Results tab gained a "Release to patient" button per unreleased result,
swapping to a "Released" badge once done — there is no "unrelease" action.

**Bug found and fixed during backend testing:** the first-draft RLS policy
restricting lab_results writes to doctors used `FOR ALL`, which — being a
RESTRICTIVE policy — also covers SELECT, and silently blocked every patient
read regardless of the permissive policy meant to allow it (RESTRICTIVE
policies AND together). The release call itself succeeded and set
`released_at`, but the patient's list stayed empty. Split into separate
INSERT-only and UPDATE-only restrictive policies to fix.

Frontend: the patient's existing `/records` page (already "my medical
stuff") gained a tabbed layout — Medical Records / Invoices / Lab Results —
rather than a new nav item, with two new read-only tab components mirroring
the staff-facing ones minus the upload form.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "A patient shall be able to view their own billing invoices" and "A patient shall be able to view their own lab results once released by their doctor" |
| Chapter 4 | §4.x RBAC / Access Control Design | Add the patient row for invoices (own only, app-layer ownership check) and lab results (own + released only, RLS-enforced); note the doctor-only "release" gate as a deliberate clinical-workflow control, not just an access-control one — results shouldn't surface before a doctor has had a chance to explain them |
| Chapter 4 | §4.x ER Diagram | Add `released_at`/`released_by` to the `lab_results` entity |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the patient's tabbed Medical Records/Invoices/Lab Results view; note the doctor's Lab Results tab now has a release action per result |
| Chapter 4 | §4.x Security Design | Worth a short case study: the RESTRICTIVE-policy `FOR ALL` bug above, as an example of why RLS policy changes need an actual opposite-role read test, not just confirming the write succeeded |

---

## Sprint 3c — Landing Page Visual Refresh (Specialty Centres, Services, Facilities, FAQ)

---

### [DELTA-021] Specialty Centres section added; Services/Facilities/FAQ gained photo treatments

| Field | Value |
|---|---|
| **Category** | UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live in-browser, both languages, desktop + mobile |

**What changed:**
Four visual additions to the public site built in DELTA-016's 4-route structure:

- **New "Our Specialty Centres" section on `/`** — inserted between the "What We
  Offer" teaser and the Doctors section. Left panel: a clickable list of 5
  specialties (Dentistry, General Medicine, Laboratory, Pediatrics, Dermatology).
  Right panel: a pre-designed marketing card image per specialty
  (`public/clinic/spec-*.png` — photo, gradient, "Overview" label, title,
  description, and a "Learn More" button already baked into the image pixels,
  not recreated as HTML/CSS), crossfading on selection, with a visible (not
  faded) preview of the next specialty in the list shown beside it — clicking
  the preview also advances to it.
- **`/services` cards redesigned** — icon + real clinic room photo (top,
  `h-44`) + title + description (unchanged copy), all 8 services now have a
  photo (`shared.tsx`'s `SERVICE_IMAGES` previously only covered 6 of the 8
  service keys; Digital Records and Preventive Care had none).
- **`/facilities` gained a "Take a Look Inside" photo gallery** — 6 labeled
  real clinic room photos (Reception, Consultation Room, Treatment Room,
  Laboratory, Waiting Area, Main Hall) in a mosaic grid, each with an
  icon+label pill badge.
- **`/patient-info`'s FAQ section gained a photo accent** — two-column split
  on desktop (accordion + a real clinic photo with a faint logo watermark
  behind it and a gold accent dot above the accordion); accordion-only on
  mobile.

**Known limitation worth documenting:** the 5 specialty-centre images are
pre-designed graphics with English-only text baked into the pixels — they do
not translate when the site switches to Arabic, since it's a raster image,
not localizable HTML. Accepted as-is; every other new element on this page
goes through `useTranslation()` as normal.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x UI Design / Screen Designs | Add the Specialty Centres section to the `/` page breakdown (after DELTA-016); update the `/services`, `/facilities`, `/patient-info` descriptions with their new photo treatments |
| Chapter 4 | §4.x UI Design | Note the specialty-centre images as an exception to the "all text is translatable" rule — pre-designed graphics with baked-in English copy, a deliberate trade-off for visual polish over full localization on that one element |

---

## Sprint 3c — Dashboard Hero Banners + Canva-Reference Widget Upgrades

---

### [DELTA-022] Role dashboards gained real-photo hero banners and per-role widget upgrades matching the Canva reference mockups

| Field | Value |
|---|---|
| **Category** | UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live in-browser, both languages, desktop + mobile |

**What changed:**
All three role dashboards (`DoctorDashboard.tsx`, `AdminDashboard.tsx`,
`PatientDashboard.tsx`) gained a full-width real-photo banner below the page
title (new shared `components/shared/DashboardHeroBanner.tsx`), then a
follow-up pass compared each dashboard against its Canva reference mockup
(`docs/Modern_Hospital_Landing_Visuals/dashboard_reff/`) and closed the gaps
that were achievable with data already available — nothing here required a
new table or column.

- **Doctor Dashboard** — banner is a single diptych photo
  (`header-doctor.png`) that already has both rooms side by side; two
  frosted caption pills ("Consultation Room" / "Treatment Room") are pinned
  to the photo's two physical halves with literal `left`/`right` (not
  logical `start`/`end`) since they must not swap sides in Arabic — a
  documented, deliberate exception to the logical-properties rule. Below the
  existing 4 stats, added a 5th "Follow-Ups" card (count of today's
  `follow_up`-type appointments) and a new "Next Patient" summary card
  (avatar, MRN, age, blood type, always-visible allergy badge, last visit
  date, view-chart link) bound to the day's next scheduled appointment.
- **Staff Dashboard** — banner is a plain lobby photo (no captions). Added
  numbered Queue → Checked-In → In-Consultation flow pills below it (reusing
  already-fetched appointment-status counts — no new endpoint; "In
  Consultation" uses `completed` as the closest existing status proxy, since
  the API has no distinct in-progress state). The read-only vertical
  timeline was replaced with a sortable Time/Patient/Type/Doctor/Status
  table, matching the reference more closely and easier to scan at a glance
  than the timeline was. A "Quick Actions" list from the reference (New
  Appointment, Add Patient, etc.) was deliberately **not** added — it would
  duplicate the two existing bold primary-600 action tiles that are already
  this screen's one bold visual idea.
- **Patient Dashboard** — banner has a frosted "Welcome back, {name}" card
  (gold/`warning-600` heart icon in a circular chip — `brand.gold` is
  scoped to auth/marketing surfaces only, so the closest already-approved
  authenticated-app token was used instead of a new raw color). The single
  appointment card (which previously embedded its own "Book" button in both
  populated and empty states) was split into two cards: "Upcoming
  Appointment" (informational only) and an always-visible "Quick Book" card,
  so a patient can still book a second visit even with one already upcoming.
  Added a static, non-data-bound "Your Care Journey" 4-step visual
  (Book → Check-In → Consultation → Support) at the bottom.

**Explicitly deferred / not built** (flagged during the reference review,
scoped out by the user before work began):
- **Room availability status** (Doctor reference's 4-room Available/In-Use
  grid) — no `rooms` table exists; faking live occupancy in a real clinical
  system would be misleading data, not a stub worth shipping.
- **Messaging widgets** (both Staff and Patient references show a Messages
  card) — Internal Secure Messaging was already marked "Skipped — Phase 2"
  in the 2026-07-17 feature audit (no messaging table, no socket.io
  anywhere in the stack); out of scope here too.
- **Billing/Test Results on the Patient Dashboard** — checked
  `invoices.routes.js`/`labResults.routes.js`: both are
  admin/superadmin/doctor-only today, with no patient self-service
  endpoint. A real backend gap, not a UI gap.
- **Doctor Lab Results widget** ("recent lab results across my patients") —
  `labResultsController.js` only supports a per-patient lookup; a
  doctor-scoped list needs a new endpoint. Flagged as a follow-up rather
  than built as a surprise backend addition alongside a UI-focused pass.

**Follow-up round (same day) — closed most of the remaining gaps above without touching the backend:**
- New shared `components/shared/DashboardStatCard.tsx` and `CountUpNumber.tsx`
  (extracted from Doctor Dashboard, now used by both Doctor and Staff) — the
  first genuine 2-consumer case for either, not a speculative abstraction.
- **Doctor** — "Confirmed"/"Awaiting Confirmation" stat cards replaced with
  "Patients Seen" and "Pending Notes". "Patients Seen" deliberately does
  **not** filter appointments by `status === 'completed'`: `listForDoctor`
  (the query backing this whole screen) only ever returns
  scheduled/confirmed/arrived rows, so that filter would always read 0. It
  counts today's *written medical records* instead (already-fetched data,
  no new request) — a completed record is real, direct evidence a visit
  happened. "Pending Notes" stays a `0` placeholder with a tooltip ("Coming
  soon") rather than a fabricated number, since `medical_records` has no
  draft/incomplete concept to count. Added a 4-button Quick Actions grid
  (New Note, Request Lab, New Prescription, Add Follow-Up) — plain
  navigation links, no new API calls; New Note/New Prescription reuse
  `MedicalRecordsPage`'s existing `?patientId=` convention, Request Lab
  opens the patient's profile (doctors upload results there, there's no
  separate "request" flow to link to), Add Follow-Up opens `/appointments`
  (doctors can't create appointments themselves — `CreateAppointmentDialog`
  is admin-only — so this navigates rather than pretends to book).
- **Staff** — added a 3-card stat row (Appointments Today, Patients
  Waiting, Completed Check-ins) above the flow pills, and real photo
  thumbnails on the flow pills themselves (`real-waiting-area.png`,
  `real-reception.png`, `real-general-clinic.png` — already-existing assets
  from the landing-page photo set, not new uploads). Restructured into a
  2-column layout: schedule table (start, wider) + a new static
  Announcements card and the existing Recently Registered card (end,
  narrower). Quick Actions was reconsidered and still not added — it would
  duplicate the two existing bold action tiles.
- **Patient** — added a small real-photo thumbnail
  (`real-general-clinic-2.png`) to the populated Upcoming Appointment card,
  and a static "Need Help?" card next to Care Journey with the clinic's
  real phone number (`+966 11 422 2000`, copied from `landing.json`'s
  `contact.phone` — not a new/fabricated number).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x UI Design / Screen Designs | Add the hero banner treatment (all 3 dashboards) and the per-role widget changes: Doctor's 5-stat row (incl. Patients Seen/Pending Notes) + Next Patient summary card + Quick Actions grid, Staff's stat row + photo flow pills + 2-column schedule/announcements layout, Patient's split appointment/Quick Book cards + appointment thumbnail + Care Journey + Need Help |
| Chapter 4 | §4.x UI Design | Note the three documented exceptions to system-wide rules: Doctor Dashboard's literal left/right caption pins (photo-content-anchored, not text-flow), the `warning-600` reuse in place of `brand.gold` (scoped to auth/marketing surfaces per the Login Page decision already in this file), and the "Patients Seen" stat sourcing from medical records rather than appointment status (a backend data-shape constraint, not a design choice) |
| Chapter 5 / Future Work | Recommendations | List the remaining deferred items (room availability, messaging, patient billing/lab-results self-service, doctor-scoped lab results list) as scoped-out follow-ups with the reason each was deferred |

---

## Sprint 3c — Site-Wide Rebrand (Teal → Gold) + Staff Dashboard Card Readability

---

### [DELTA-023] `primary` token recolored teal → gold site-wide; clinic logo added to the sidebar; stat/flow-pill cards redesigned for readability

| Field | Value |
|---|---|
| **Category** | UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live across dashboards and a non-dashboard screen (Appointments), both languages |

**What changed:**
Comparing the finished dashboards against the Canva reference mockups and
the real Alamin PolyClinic logo (gold + dark brown/charcoal — no teal
anywhere in the actual branding) surfaced that the authenticated app's
`primary-600` teal (`#0a7272`, chosen generically for "medical trust" back
in Sprint 3b) never matched the clinic's real identity. The Login Page
session had already pulled real logo colors into a separate `brand.gold`
token, explicitly scoped to auth/marketing surfaces only, with a code
comment noting "reconciling the two into one site-wide palette is a
separate design decision." This session made that decision: gold, applied
everywhere.

**Mechanically, this was a token-value change, not a per-screen edit.**
Every screen in the app already used the `primary-*` Tailwind scale (and
shadcn's `--primary`/`--ring` CSS variables) rather than hardcoded teal hex
— confirmed by grepping the whole frontend for teal hex values before
starting (zero hits outside the two config files). Changed:
- `tailwind.config.ts` — `primary.50` through `primary.950` recolored to a
  gold ramp. The 300/400/500/600/700 steps are identical to the existing
  `brand.gold` scale (so the two palettes agree exactly where they
  overlap); 50/100/200/800/900/950 extrapolate the same hue to fill out a
  full 11-step ramp. `brand.gold`/`brand.charcoal` themselves were left in
  place (a few auth/marketing call sites still reference them directly)
  but are now largely redundant with `primary`/`neutral-800`.
- `src/index.css` — `--primary`/`--ring` (light and dark mode) recolored to
  match `primary-600`/`primary-400` in HSL.

No component or page file needed a color-class edit. Verified live on all
three dashboards plus the Appointments page (deliberately picked because
this session hadn't touched it) to confirm the swap actually reached
already-built screens without a second round of edits — active nav state,
buttons, icon chips, links, and focus rings all picked up gold correctly
in both English and Arabic.

**Clinic logo added to the sidebar.** The Sidebar previously showed plain
text ("Alamin Clinic") expanded and a 2-letter initials badge collapsed —
no actual logo image anywhere outside the landing page and login screen.
Reused `ClinicLogo` (a pixel-measured crop of just the glyph mark off the
900×900 source file, paired with the wordmark as real text — originally
built for `LandingNav`/`LandingFooter`) rather than re-deriving the crop
math: relocated it from `pages/landing/shared.tsx` to
`components/shared/ClinicLogo.tsx` (the same "second real consumer, so
promote it to shared" pattern as `DashboardStatCard`/`CountUpNumber` in
DELTA-022) and used it for the expanded sidebar state. The collapsed state
needed a smaller crop to fit the ~32px available width, computed by scaling
the same crop's `background-size`/`background-position` by 0.7×.

**Staff Dashboard card layout — readability fix.** Direct user feedback:
the stat cards and flow pills didn't match the reference's layout and
read worse. Re-comparing against the reference identified the actual
differences and fixed the shared `DashboardStatCard` (used by both Doctor
and Staff, so this improves both dashboards' fidelity to their respective
references, not just Staff's):
- Label moved from a small caption *under* the number to a proper heading
  *above* it, with the same accent-underline idiom `SectionHeading` already
  uses elsewhere — matches the reference's label→icon row, then number
  hierarchy (previously inverted).
- Icon chip moved to a smaller (36px) top-end position instead of a large
  (44px) vertically-centered one.
- Caught a real regression while verifying live: with the label promoted
  to a prominent heading and `truncate` applied, the Doctor Dashboard's
  5-card row (narrower per-card width than Staff's 3-card row) clipped mid-word
  ("Today's App...", "Pending Not..."). Removed `truncate`, let labels wrap
  to two lines instead — worse than truncating would have been if left
  alone, since a screenshot taken immediately after the label-reorder
  change would have shipped it.
- `FlowPill` (Staff's Queue/Checked-In/In-Consultation cards): photo grew
  from a 64px strip to a 128–144px panel (closer to the reference's
  photo-forward treatment), and the text row below it changed from a
  centered number-then-label stack to a label+sublabel-left /
  number-right row, matching the reference exactly. Added real sublabel
  copy per step ("Patients in waiting" / "At reception" / "With a
  doctor") — informational only, not bound to any new data.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x UI Design / Design System | Replace every mention of teal/`#0a7272` as the app's primary color with gold; note the token-level (not per-screen) mechanism of the change, and that `brand.gold`/`primary` are now the same palette rather than two separate ones |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the clinic logo to the sidebar description (expanded: glyph + wordmark; collapsed: glyph only); update the Staff Dashboard stat-card and flow-pill descriptions (label-above-number hierarchy, taller photo panels, label+sublabel/number row) |
| Chapter 4 | Design decisions | Document the reconciliation of the "teal app / gold marketing" split first recorded in the Login Page DELTA — this entry is the follow-up that closes it out, all one gold palette now |

---

## Sprint 3c — Patient File Number (رقم الملف)

---

### [DELTA-024] Human-readable sequential patient file number added alongside the UUID patient_id

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality / API / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — code complete; DB migration run + `psql` spot-check still owed (no local Postgres available in this session) |

**What changed:**
The clinic's real paper/invoice workflow identifies a patient by a short
sequential number (e.g. `13167`, رقم الملف) printed on every physical
document — staff cannot use the system's UUID `patient_id` for this at all.
Added `patients.file_no`, an auto-assigned `INTEGER UNIQUE NOT NULL` backed
by a new `patient_file_no_seq` sequence starting at 10001 (so existing demo
data reads as a realistic clinic). Staff never type it; the system assigns
it at registration (`DEFAULT nextval(...)`) and existing rows were backfilled
in registration order. Indexed (`idx_patients_file_no`) since it's now a
search key, not just a display field.

Backend: `file_no` added to every `patients` SELECT/RETURNING clause used by
`Patient.findById`/`search`/`register`/`update` (`src/backend/src/models/
Patient.js`) and surfaced as `fileNo` in the corresponding
`patientsController.js` responses (register/search/view/update). The admin
patient-search endpoint (`GET /patients?q=`) was extended to also match an
exact `file_no` alongside its existing national-ID-exact / name-substring /
phone-prefix modes — typing a 5-digit file number now jumps straight to that
patient, the same way typing a national ID already did.

Frontend: `fileNo` added to the `Patient`, `PatientSearchResult`, and
`RegisterPatientResponse` types (`UpdatePatientResponse` inherits it via its
existing `Omit<Patient, ...>`). Five UI touchpoints surface it: a badge below
the patient's name on the profile header (`PatientSummary.tsx`); a prominent
block above the QR code on the registration success screen (`Register
PatientDialog.tsx` — staff need it immediately to write on physical
paperwork); inline before the name in both the admin search result list
(`PatientLookupPage.tsx`) and the shared `PatientSelect` combobox used by
every "pick a patient" form in the app (appointments, records, invoices);
and the search placeholder text now mentions file number as a valid search
term (EN/AR). New `patients.fileNo` i18n key ("File No." / "رقم الملف").

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "The system shall auto-assign a sequential, human-readable file number to every patient at registration, displayed alongside (not replacing) the internal patient ID" |
| Chapter 4 | §4.x ER Diagram | Add `file_no` (INTEGER, UNIQUE, NOT NULL) to the patients entity; note the backing `patient_file_no_seq` sequence |
| Chapter 4 | §4.x API Design | Extend the `GET /patients?q=` description: search now matches national ID (exact) / name (substring) / phone (prefix) / file number (exact) |
| Chapter 4 | §4.x UI Design / Screen Designs | Note the file-number badge on the patient profile header, its prominence on the registration success screen, and its appearance in both the search result list and the shared patient picker |
| Chapter 4 | §4.x Design Decisions | Document the two-identifier rationale: UUID stays the internal DB key (never shown), file number is the clinic's real-world, paper-compatible identifier — a third layer alongside the DELTA-005 national-ID identifier, addressing a different need (staff cannot write a UUID on an invoice) |

---

## Sprint 3c — Walk-in Queue, Billing Engine, and Clinic Services Catalog

---

### [DELTA-025] Clinic services price catalog added — superadmin-managed, admin read-only

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality / UI / Security |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
New `clinic_services` table (`code_no`, `name_en`, `name_ar`, `category`, `price`,
`is_active`) backs a price/service catalog the walk-in billing flow (DELTA-026/027)
draws from. Write access was originally scoped to both Admin and Superadmin, then
narrowed to **superadmin-only** after user feedback that reception staff editing
prices directly is "against the integrity of the place" — Admin (Staff) now has
read-only access, the same trust boundary already drawn around account management
(DELTA-004). Surfaced as its own sidebar-linked `/catalog` page rather than a
Settings tab, after a second round of feedback that staff wouldn't think to check
Settings for something they need to reference constantly mid-shift.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Superadmin shall manage the clinic's service/price catalog; Staff and Doctor roles may view it read-only" |
| Chapter 4 | §4.x ER Diagram | Add `clinic_services` entity |
| Chapter 4 | §4.x RBAC / Access Control Design | Add `clinic_services` row to the matrix: superadmin full CRUD, admin/doctor read-only |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the `/catalog` screen; note it as a dedicated sidebar page rather than a Settings tab, and why |

---

### [DELTA-026] Walk-in patient visit & queue system — doctor-only consultation status

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality / UI / Security / Use Case |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
New `visits` table gives the clinic a same-day walk-in queue independent of the
appointment system — staff check a walk-in patient in against an assigned doctor
and get back a daily sequential queue number (`queue_no`, assigned via the same
SERIALIZABLE-guarded read-then-insert pattern `appointmentsController.js` already
used, to stay race-safe under concurrent check-ins). New `/visits` staff screen
(`TodaysVisitsPage`) plus a "Today's Queue" panel promoted to the top of
`DoctorDashboard`.

The status-transition ownership was corrected mid-build after user feedback: the
original design had staff mark `waiting→in_progress` and `in_progress→completed`
from the front desk, but staff aren't physically present with the doctor and have
no way to know when a patient actually enters or leaves the consultation room.
Both transitions were moved to be doctor-only and are rejected **server-side**, not
just hidden client-side, if attempted from an admin session
(`visitsController.updateStatus`). Staff's role narrowed to creating the visit at
check-in; the final `completed→billed` transition later became server-only as part
of the billing engine (DELTA-027) — it now happens automatically once payment is
collected, rather than via any manual staff action.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR for walk-in check-in + queue numbering, and the doctor-only consultation-status rule |
| Chapter 4 | §4.x Use Case Diagram | Add a walk-in check-in use case (Staff actor) and a mark-in-progress/mark-complete use case (Doctor actor) |
| Chapter 4 | §4.x ER Diagram | Add `visits` entity (`queue_no`, `status`, `doctor_id`, `patient_id`, `checked_in_at`) |
| Chapter 4 | §4.x RBAC / Access Control Design | Document that visit status transitions are role-and-ownership gated at the API layer, not just UI-hidden — staff cannot advance a visit past "waiting" even via a direct API call |
| Chapter 4 | §4.x UI Design / Screen Designs | Add `TodaysVisitsPage` and the Doctor Dashboard's Today's Queue panel |

---

### [DELTA-027] Billing engine — consultation-time item entry, staff discounting, and a print-ready bilingual invoice

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality / UI / Security / API / Use Case |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — backend syntax-checked and dev-server smoke-tested; full in-browser click-through not yet performed (no test credentials available in the implementing session) |

**What changed:**
New `visit_invoices`/`invoice_items` tables complete the walk-in flow started by
DELTA-026: while a patient is `in_progress`, the doctor adds priced services from
the clinic services catalog (DELTA-025) and free-text prescription notes directly
from the Doctor Dashboard's active-consultation card, then marks the patient done —
this auto-creates a `draft` invoice on the first item added and flips it to
`pending_billing` on completion, transitioning the visit to `completed` in the same
step. Staff then open a dedicated review screen (`BillVisitPage`,
`/visits/:visitId/bill`) to apply a per-item discount percentage, choose a payment
method (cash/card/insurance, with a conditional insurance-company field), and
collect payment (`payInvoice`) — which is also the only place `visits.status` is
ever set to `billed`. All money math (subtotal, discount, net, 15% VAT, grand
total) is computed server-side (`utils/invoiceCalc.js`) and re-fetched after every
discount edit, so the totals shown to staff are never a client-side approximation
that could drift from what's actually stored.

A "Generate Invoice" action on the billing screen opens a new print-ready invoice
page (`InvoicePage`, `/visits/:visitId/invoice`) matching the clinic's real paper
Simplified Tax Invoice format — cross-checked field-by-field against a scanned real
invoice (`docs/real_samples/real_sample_invoice.pdf`) rather than a generic receipt
layout — showing File No, ID No, Inv. No, Doctor, Clinic, Date, itemized services,
totals, and payment summary, all bilingually (English + Arabic together)
regardless of the viewer's app-language setting, matching how the physical
document actually prints.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FRs: doctor records billable services + notes during consultation; staff applies discounts and collects payment; system generates a print-ready bilingual tax invoice |
| Chapter 4 | §4.x ER Diagram | Add `visit_invoices`/`invoice_items` entities (incl. `invoice_no_seq` starting at 900001, VAT/discount/net/total columns) |
| Chapter 4 | §4.x Use Case Diagram | Add a consultation-billing use case (Doctor actor) and a payment-collection use case (Staff actor) |
| Chapter 4 | §4.x RBAC / Access Control Design | Add a billing endpoint role table: doctor (add/remove items, mark done), admin (discount, pay), both (read-only view) |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the interactive Doctor Dashboard consultation card, `BillVisitPage`, and the print-ready `InvoicePage`; note the invoice page as the one screen in the system that deliberately does not follow the app's normal language-toggle convention — it always renders both languages, matching a physical bilingual document |
| Chapter 4 | §4.x Data Design | Note server-side-only money calculation (`invoiceCalc.js`) as a data-integrity decision — clients never compute or submit totals |

---

### [DELTA-028] Billing history surfaced to patients and to staff/doctor on the patient profile — the billing engine (DELTA-027) had no UI reachable from either

| Field | Value |
|---|---|
| **Category** | Functionality / UI / Security / API |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — backend verified by calling the controller directly with simulated sessions (admin/treating-doctor/unrelated-doctor/owning-patient/other-patient), frontend verified live in-browser as admin |

**What changed:**
User-reported bug: staff generated a bill and collected payment through the
DELTA-027 billing flow, then couldn't find it anywhere — not on the
patient's profile, not in the patient's own portal, not for the treating
doctor. Root cause: DELTA-027 built `visit_invoices`/`invoice_items` and the
print-ready `/visits/:visitId/invoice` page, but nothing ever queried those
tables from `PatientProfilePage` or exposed them to a patient session —
the money was recorded correctly, it was just invisible outside the exact
visit URL. This is a distinct problem from DELTA-020 (which added a patient
self-view for a *different*, older table, `patient_invoices` — staff-uploaded
scanned documents/consent forms, unrelated to the structured billing data
here).

Fix, by explicit user request (see conversation — "go with your
recommendation" for the billing-history list, plus "add invoices sidebar
tab" and "billing history... should be adhering to doctors and staff as
well... they can download it"):
- New `GET /patients/:patientId/billing` (admin/doctor, doctor scoped to
  visits they themselves treated) and `GET /billing/mine` (patient, own
  history, `draft` status excluded — nothing to show a patient for an
  in-progress consultation).
- `assertOwnVisit` (the same ownership guard `addItem`/`removeItem`/etc.
  already used for doctor scoping) extended to also check patient
  ownership, and `GET /visits/:visitId/invoice` opened to
  `ROLES.PATIENT` — without this, any patient could have viewed any other
  patient's invoice just by changing the URL, since `visit_invoices` has no
  RLS (app-layer scoping only, per DELTA-027/DELTA-026's own design).
- New "Billing" tab on `PatientProfilePage` (admin/doctor) and a new
  `/invoices` page + sidebar nav item for patients (two sections: "Billing"
  — this new data — and "Documents" — DELTA-020's existing
  `patient_invoices` self-view, reused as-is). Each row links to the
  existing `/visits/:visitId/invoice` print page rather than introducing a
  separate download mechanism — that page already has a working Print
  button that produces a real PDF via the browser's print dialog.
- `StatusBadge` (`components/shared/StatusBadge.tsx`) extended to cover
  `visit_invoices.status` values (`draft`/`pending_billing`/`paid`/`partial`)
  instead of adding a parallel badge component.

**Bug found and fixed during backend verification:** none in the new code,
but confirming a positive case (an owning patient successfully viewing
their own invoice) required using that patient's *real* `user_id` — an
early test with a fake one silently 404'd because `patients` RLS
(`patient_select_own`) matches on `user_id`, not `patient_id`, and the
`GET /visits/:visitId/invoice` query inner-joins `patients`. Worth noting
as a testing gotcha for this table, not a code defect: a wrong `user_id` in
a simulated session looks identical to "not authorized," which is the
correct behavior, just easy to misdiagnose as a bug in a hurry.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FRs: "A patient shall be able to view and print their own billing history" and "Staff/doctor shall be able to view a specific patient's billing history from their profile" |
| Chapter 4 | §4.x RBAC / Access Control Design | Add the billing-history rows to the role table from DELTA-027: doctor (own-treated visits only), admin (all), patient (own, non-draft only) |
| Chapter 4 | §4.x Security Design | Document `assertOwnVisit`'s patient-ownership branch as the only thing preventing one patient from reading another's invoice by URL, since `visit_invoices` carries no RLS |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the Patient Profile "Billing" tab and the patient-facing `/invoices` page (Billing + Documents sections); note it is a separate nav item from `/records`, not a third tab there, because it needed to be easy to find |
| Chapter 4 | §4.x Navigation / Routing design | Add `/invoices` as a patient-only route |

---

## Sprint 3c — Security Hardening Round 2

---

### [DELTA-029] RLS empty-string UUID cast guard — billing/visit tables 500'd for admin sessions

| Field | Value |
|---|---|
| **Category** | Security / DB Schema |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — schema.sql patched, local DB updated, pattern documented in `docs/psm2/rls-policy-guidelines.md` |

**What changed:**
The RLS policies added in DELTA-026/027 for `visits`, `visit_invoices`,
`invoice_items`, and `patient_care_team` cast session variables directly to
`::uuid` (e.g. `current_setting('app.current_user_id', true)::uuid`).
Admin and superadmin sessions leave those session GUCs as empty strings —
not NULL — because their sessions have no user/doctor/patient UUID to
set. PostgreSQL evaluates `''::uuid` immediately and throws an
`invalid_text_representation` error regardless of the surrounding role
check, so every admin or superadmin request that touched these four
tables (creating a walk-in, billing, viewing invoices) returned HTTP 500.

Fix: wrap every such cast in `NULLIF(..., '')` before casting, matching
the pattern already used by the older `medical_records`/`patients`/
`lab_results` policies that had learned this lesson earlier (see
`docs/psm2/rls-policy-guidelines.md`). The gotcha and the required
pattern are now documented in `rls-policy-guidelines.md` so future
policy authors copy the guarded version instead of a bare `::uuid` cast.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x Security Design / RLS | Document the empty-string GUC gotcha as a systematic rule: all RLS policy casts of session variables must use `NULLIF(..., '')` before `::uuid`. Reference `rls-policy-guidelines.md` as the authoritative source for this pattern. |
| Chapter 4 | §4.x Security Design | Worth a short "lessons learned" note: the same fix was needed twice (once for medical_records/patients in an earlier session, now for the billing/visit tables), demonstrating why a dedicated RLS policy guidelines document was created — the pattern is subtle enough that two separate implementation sessions missed it independently |

---

## Sprint 3c — Dashboard Upgrade + Specialty Pages

---

### [DELTA-030] Glassmorphism dashboard redesign + standalone specialty detail pages + billing date cast fix

| Field | Value |
|---|---|
| **Category** | UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live across all four dashboards and Appointments page, both languages |

**What changed:**
All four role dashboards (`DoctorDashboard`, `AdminDashboard`,
`PatientDashboard`, `SuperAdminDashboard`) received a glassmorphism card
styling pass — frosted-glass backgrounds, subtle border highlights, and
depth layering on stat cards and panels — matching the Canva reference
mockups more closely than the flat card treatment they had before.

Per-role additions in this pass:
- **Doctor** — 1-click Lab Order and Rx Order action buttons embedded
  directly in the expanded appointment timeline cards; Vitals Highlight
  Bar inside the Patient Summary card (displays the most-recent visit's
  vital signs at a glance — BP, temperature, weight — read from
  `medical_records.vital_signs` JSONB).
- **Admin/Staff** — instant patient search bar (MRN / Name / Phone,
  live results, no page reload); Queue Status Filter Tabs (All /
  Waiting Room / In Consultation / Completed); pulsing animated badges
  on waiting-room patient cards.
- **Patient** — SMS appointment reminder action; Google Maps directions
  link to the clinic; PDF Export and Print icons on prescriptions and
  past visits.
- **Superadmin** — System Health KPI Bar (Total Users, Active Doctors,
  Today's Appointments, Operational Status) wired to the new
  `GET /users/system-health` endpoint (DELTA-032); Audit Feed snippet
  showing recent user-management actions.

Landing page: rebuilt Specialty Centres section with KPJ-style staggered
cards; new standalone `/specialties/:slug` detail pages (one per
specialty — Dentistry, General Medicine, Laboratory, Pediatrics,
Dermatology/Cosmetology) with rich descriptions, services listed, and
a real clinic photo background. Trust section gained a watermark and
floating animated stat counters.

**Bug fixed in this commit:** `billingController.getDailyReport` and
`getDailyInvoices` cast the date query parameter as `::date` before
applying `AT TIME ZONE`, which PostgreSQL rejects — `AT TIME ZONE`
requires a timestamp, not a date. Fixed by casting to `::timestamp`
instead. The Z-Report and billing report pages were silently returning
zero rows for any date filter until this was corrected.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x UI Design / Screen Designs | Update all four dashboard descriptions: glassmorphism card treatment (visual); per-role additions (Doctor: 1-click Lab/Rx + Vitals Bar; Staff: instant search + filter tabs + lobby badges; Patient: SMS + Maps + PDF export; Superadmin: System Health KPI bar + Audit Feed) |
| Chapter 4 | §4.x UI Design | Add `/specialties/:slug` as a 5th public route (alongside the 4 from DELTA-016); describe the staggered-card Specialty Centres section on the home page |
| Chapter 4 | §4.x Security Design | Note the billing date cast bug as a testing coverage gap — the Z-Report endpoint's date filtering was untested for any specific date (only the default "today" path), so the cast error only surfaced once a non-default date was passed |

---

## Sprint 3c — Database Performance + Fraud Prevention

---

### [DELTA-031] Composite DB indexes for scale + paid_by schema migration

| Field | Value |
|---|---|
| **Category** | DB Schema / Security |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — schema.sql updated, apply-rls.js migration script added |

**What changed:**
Added composite indexes targeting the most common multi-column query
patterns across the high-traffic tables:
- `visits(doctor_id, checked_in_at, status)` — the today-queue query
  filters on all three simultaneously
- `visit_invoices(patient_id, status)` — billing history per patient
- `medical_records(patient_id, created_at)` — timeline queries
- `appointments(doctor_id, scheduled_at, status)` — dashboard range queries

Added `paid_by UUID REFERENCES users(user_id)` column to
`visit_invoices`. When staff collects payment via `payInvoice`, their
`user_id` (from the authenticated session) is stored alongside the
payment amount and method. This creates an immutable audit trail of
which staff member processed each transaction — a fraud prevention
control that prevents any individual from denying they collected a
payment later found to be inconsistent.

Added `apply-rls.js` migration script for programmatically applying RLS
policy changes to an existing live database without re-running the full
`schema.sql` (which would fail on already-existing tables).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.2 Non-Functional Requirements | Add NFR: "The system shall maintain sub-second query response on patient timeline and appointment schedule queries under concurrent clinic load" — the composite indexes are the mechanism |
| Chapter 4 | §4.x DB Schema / ER Diagram | Add the composite indexes to the schema description; add `paid_by` FK column to `visit_invoices` entity |
| Chapter 4 | §4.x Security Design | Document `paid_by` as a fraud-prevention control: immutable staff attribution on every payment transaction, independent of application-level role checks — even a compromised admin account cannot retroactively erase who collected a payment |

---

### [DELTA-032] Superadmin system-health endpoint with 60s TTL cache

| Field | Value |
|---|---|
| **Category** | API / Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — wired live to SuperAdminDashboard KPI bar |

**What changed:**
New `GET /users/system-health` endpoint (superadmin only) returns a live
snapshot of the system's operational state: total registered users by
role, active doctor count, today's visit count, today's appointment
count, and a simple `status: 'operational' | 'degraded'` signal. A
60-second in-memory TTL cache is applied server-side so that the
SuperAdminDashboard's polling (which fires on every load plus its
`refetchInterval`) cannot hammer the database with aggregation queries
under a busy clinic session.

Wired to the SuperAdminDashboard's new System Health KPI Bar
(DELTA-030), replacing the previously static placeholder values that
showed hardcoded zeros.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Superadmin shall have access to a real-time operational dashboard showing user counts, active doctors, and daily activity metrics" |
| Chapter 4 | §4.x API Design | Add `GET /users/system-health` to the endpoint table (superadmin only, 60s TTL cached) |
| Chapter 4 | §4.x Design Decisions | Document the TTL cache approach: aggregation queries are expensive enough to warrant a 60-second cache on a low-write endpoint (system health changes rarely within one minute), but short enough that the dashboard reflects real operational state |

---

### [DELTA-033] Staff payment attribution (paid_by) + full BillingHistoryPage

| Field | Value |
|---|---|
| **Category** | Functionality / UI / Security |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — backend verified, BillingHistoryPage verified live as admin |

**What changed:**
Two related billing additions built on the `paid_by` column introduced
in DELTA-031:

**Payment attribution:** `billingController.payInvoice` now writes the
authenticated user's `user_id` into `visit_invoices.paid_by` when
payment is collected. The `InvoicePage` print view displays "Collected
by: [staff name]" on the invoice, making the attending staff member
permanently visible on the printed record. This closes a fraud vector
where a payment could be collected off-system and the digital record
never updated — now every paid invoice has an accountable staff member
attached.

**BillingHistoryPage** (`/billing-history`, admin + superadmin): a
complete billing report UI showing all invoices across any date range
with summary totals (collected, outstanding, grand total), filterable
by status, sortable by date/amount, and linking through to individual
invoice print pages. Replaces the ad-hoc "find by navigating to
/visits/:id/invoice" workflow staff previously had to use. Backend
extended with `GET /billing/history` supporting `from`/`to`/`status`
query filters.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "The system shall record which staff member collected each payment, displayed on the invoice and in the billing history" and "Staff shall be able to view a date-filtered billing history with aggregate totals" |
| Chapter 4 | §4.x Security Design | Add `paid_by` attribution to the audit trail description — alongside CloudTrail (infrastructure) and AuditLog (application actions), payment-level attribution is a third layer of accountability specific to financial transactions |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the BillingHistoryPage description (/billing-history route, date range filter, status filter, summary tiles, table with View Invoice links) |

---

## Sprint 3c — Appointment Reminders + Clinical Records

---

### [DELTA-034] Non-blocking SMS appointment reminders

| Field | Value |
|---|---|
| **Category** | API / Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — SMS delivery uses existing `smsProvider.js` stub (logs instead of sending until a live Twilio key is configured); fire-and-forget, returns HTTP 202 immediately |

**What changed:**
New `POST /appointments/:id/send-reminder` endpoint (admin +
superadmin). The controller looks up the appointment's patient phone
number and scheduled time, formats a bilingual reminder message, and
passes it to `smsProvider.js` — the same stub already used by the OTP
flow (UC-19). The HTTP response returns 202 immediately without waiting
for SMS delivery; the send is fire-and-forget to keep the UI
non-blocking even if the provider is slow.

Staff-facing triggers added in two places: a "Send Reminder" button
per appointment row in `AppointmentsPage` (shown for scheduled and
confirmed appointments only), and a quick-action button on confirmed
appointments in `AdminDashboard`'s schedule table.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Staff shall be able to trigger an SMS appointment reminder to a patient directly from the appointment list" |
| Chapter 4 | §4.x API Design | Add `POST /appointments/:id/send-reminder` (admin + superadmin, 202 fire-and-forget) |
| Chapter 4 | §4.x System Design | Note the non-blocking (202) pattern for external communication calls — the same approach used by the OTP flow — and why: SMS provider latency must not block the UI |

---

### [DELTA-035] Treatment-relationship RLS + cross-clinic medical history + consultation vitals grid

| Field | Value |
|---|---|
| **Category** | DB Schema / Security / Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
Three related additions to the clinical records layer:

**Treatment-relationship RLS:** `medicalRecordsController.listForPatient`
previously returned only records written by the querying doctor.
Updated to use a treatment-relationship scope: a doctor can read any
medical record for a patient if that doctor has ever written at least
one record for that patient (i.e., has a treatment relationship), even
if the record being read was written by a different doctor at a
different visit. This enables continuity-of-care: the current treating
doctor can see what a colleague wrote at a previous visit.

**Cross-clinic history:** the same query scoping change means that a
doctor at Branch 2 who has treated a patient can read records written
at Branch 1, since both branches share the same database. No additional
column or filter is needed — the treatment relationship is the gate.

**Consultation vitals input grid:** `ConsultationPage` gained an
inline vitals capture form: Blood Pressure (systolic/diastolic),
Temperature (°C), Weight (kg), Height (cm), SpO₂ (%). Values are saved
into the `medical_records.vital_signs` JSONB column when the doctor
saves a record during the consultation. On re-opening the consultation,
the last-recorded vitals are displayed in the Patient Summary card's
Vitals Highlight Bar (DELTA-030).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "A doctor shall be able to view all medical records for any patient with whom they have a treatment relationship, regardless of which doctor wrote each individual record" |
| Chapter 4 | §4.x Security Design / RLS | Document the treatment-relationship scoping rule: the RLS predicate for doctor-read on `medical_records` is "has ever written a record for this patient", not "is currently the assigned doctor" — chosen for continuity-of-care, not blanket access |
| Chapter 4 | §4.x ER Diagram | Add `vital_signs` JSONB to the `medical_records` entity (if not already in DELTA-007 update) |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the vitals input grid to the Consultation Page description |

---

### [DELTA-036] Client-side PDF export + safe vitals display + live system-health wiring

| Field | Value |
|---|---|
| **Category** | Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
Three independent frontend additions shipped together:

**PDF export** (`lib/pdfGenerator.ts`): a client-side PDF generation
utility (browser `window.print()` with a targeted print stylesheet, or
a third-party library) that produces downloadable PDFs for medical
records and prescription summaries. Surfaced as PDF Export / Print icon
buttons on the Patient Dashboard's past-visits and prescription cards.

**Safe vitals display:** the Doctor Dashboard's Patient Summary card
and the Consultation Page previously crashed silently if
`vital_signs` was null (newly added patients have no vitals recorded
yet). Added null-guards so the vitals section gracefully renders
"Not recorded" rather than throwing a TypeError.

**Live system-health wiring:** SuperAdminDashboard's KPI bar
(introduced in DELTA-030 as static placeholders) wired to
`GET /users/system-health` (DELTA-032) via a `useQuery` with
`refetchInterval: 60_000`. Each KPI tile now shows real numbers.

**TodaysVisitsPage** extended with additional columns (elapsed wait
time, visit type badge) and a "View Invoice" link on completed/billed
rows that bypasses the "Bill Now" step when payment is already
collected.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Patients shall be able to export or print their medical records and prescriptions as PDFs directly from their portal" |
| Chapter 4 | §4.x UI Design / Screen Designs | Add PDF export buttons to the Patient Dashboard description; add elapsed-wait-time column and View Invoice link to the TodaysVisitsPage description |
| Chapter 4 | §4.x UI Design | Note the null-guard pattern as a patient-safety consideration: a vitals section that crashes or shows stale data is worse than one that clearly says "not recorded" |

---

## Sprint 3c — Major Feature Additions (Clinical Tools + Operations)

---

### [DELTA-037] Command Palette, Lobby Kanban, Odontogram/Body Chart, Wasfaty E-Rx, Room Allocation, Insurance Co-Pay

| Field | Value |
|---|---|
| **Category** | Functionality / UI / DB Schema / API |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — six distinct features in one commit |

**What changed:**
Six operational and clinical features added in a single implementation
pass:

**Command Palette** (`components/shared/CommandPalette.tsx`) — triggered
by Ctrl+K (or Cmd+K on Mac). Fuzzy-searches across patients (by name /
file# / national ID), appointments (by patient name / date), and app
routes (Dashboard, Patients, Records…). Results navigate directly on
selection. Accessible without a mouse — a keyboard-first power-user
feature for high-volume front-desk sessions.

**Lobby Kanban Board** (`components/visits/LobbyKanbanBoard.tsx`) —
a card-based visual board on the Admin Dashboard showing today's
walk-in visits as columns: Waiting → In Consultation → Done. Cards show
patient name, file#, queue number, elapsed time, and assigned doctor.
Built on the existing `visitsApi.listToday()` — no new endpoint. Admin
can drag (or click action buttons) to advance a visit's status, same
as the table view in `TodaysVisitsPage`.

**Queue Ticket Modal** (`components/visits/QueueTicketModal.tsx`) —
a printable/shareable queue ticket overlay showing the patient's name,
queue number (large), doctor, and estimated wait. Triggered by the
"Print Ticket" action on a walk-in visit card.

**Odontogram / Body Chart** (`components/clinical/OdontogramBodyChart.tsx`)
— an SVG-based clinical annotation tool. Doctors can toggle between
a dental odontogram (32 teeth, upper/lower arches) and a body chart
(front/back silhouette), tapping regions to mark conditions
(caries, crown, missing, extraction, etc. for dental; pain, swelling,
bruising for body). Annotations save as a JSONB field on the medical
record. Available inside the Consultation Page's Clinical Notes tab.

**Wasfaty SFDA E-Rx Modal** (`components/clinical/EPrescriptionModal.tsx`)
— a structured electronic prescription form matching the Saudi Food
and Drug Authority's Wasfaty e-prescription fields (medication name,
dosage form, strength, quantity, days supply, refills, prescriber ID,
patient national ID). The modal generates a prescription summary the
doctor can review before saving; integration with the live Wasfaty
API is stubbed (the form POSTs to the clinic's own backend, which
logs the prescription — live Wasfaty API connection requires a
registered facility ID, deferred to production deployment).

**Room Allocation** (`rooms` table + `controllers/roomsController.js`
+ `routes/rooms.routes.js` + `components/rooms/RoomStatusGrid.tsx`) —
a new `rooms` table tracks clinic consultation rooms (room number,
name, floor, status: available / occupied / maintenance). The
`RoomStatusGrid` on the Admin Dashboard shows each room's current
status with a colored badge. Staff can assign a walk-in visit to a
room from the Lobby Kanban view; the room's status updates
automatically. New routes: `GET /rooms`, `PATCH /rooms/:roomId/status`
(admin + superadmin).

**Insurance Co-Pay Engine** — `BillVisitPage` extended with a co-pay
calculation panel. When payment method is set to "insurance", staff
enters the insurance coverage percentage; the engine calculates the
patient's co-pay amount (grand total × (1 − coverage%)) and pre-fills
the "Amount Paid" field with it, with the remainder shown as
insurance claim. Server-side: `payInvoice` stores
`insurance_co` and `amount_balance` (the claim portion) alongside
`amount_paid` (the co-pay collected from the patient).

**Skeleton loaders** (`components/ui/skeleton-loaders.tsx`) — a set of
Tailwind pulse-animation placeholder skeletons for the most common
loading states (patient card, appointment row, invoice table) to
replace the previous "spinning circle" or blank-white loading states.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FRs for: Command Palette (keyboard-first navigation), Lobby Kanban (visual queue management), Odontogram/Body Chart (clinical annotation), E-Rx (electronic prescription), Room Allocation (room status tracking), Insurance Co-Pay (co-pay calculation) |
| Chapter 4 | §4.x ER Diagram | Add `rooms` entity (room_id, number, name, floor, status); add odontogram/body chart annotation field to `medical_records` |
| Chapter 4 | §4.x API Design | Add `GET /rooms`, `PATCH /rooms/:roomId/status` endpoints |
| Chapter 4 | §4.x UI Design / Screen Designs | Add Command Palette, Lobby Kanban Board, Odontogram/Body Chart, Wasfaty E-Rx Modal, Room Status Grid, and Co-Pay panel to their respective screen descriptions |
| Chapter 4 | §4.x Design Decisions | Note the Wasfaty E-Rx as "integration-ready": the form, data model, and submission flow are fully built; live Wasfaty API connectivity requires a registered SFDA facility ID, deferred to production deployment — this is a deliberate "production-ready stub" pattern, not an incomplete feature |

---

## Sprint 3c — Financial Analytics + Supporting Clinical Tools

---

### [DELTA-038] Financial analytics backend + Z-Report + allergy checker + voice dictation + barcode scanner + patient kiosk

| Field | Value |
|---|---|
| **Category** | Functionality / UI / API |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
A large pass adding financial reporting infrastructure and four
supporting clinical/UX tools:

**Financial Analytics Backend** — new backend queries in
`billingController.js` aggregate revenue by date range, by doctor,
and by payment method. Returns daily totals, weekly totals, and a
per-doctor attribution breakdown (which doctor's consultations
generated how much revenue). Backed by the existing `visit_invoices`
and `invoice_items` tables; no new schema needed.

**FinancialAnalyticsPage** (`/finance`, superadmin only) and
**FinancialAnalyticsWidget** (embedded on AdminDashboard for a summary
view): revenue totals, a breakdown chart by payment method
(cash/card/insurance), and a per-doctor revenue table. The superadmin
page has a full date-range picker; the admin widget shows today's
summary.

**Cashier Z-Report Modal** (`CashierZReportModal.tsx`): an
end-of-day reconciliation report triggered from the AdminDashboard.
Shows total transactions, total collected by payment method, and a
per-staff-member breakdown (using the `paid_by` attribution from
DELTA-031/033). Designed to match the workflow a real cashier follows
at shift close — count the drawer, compare to the Z-report, reconcile
any discrepancy.

**Allergy Checker** (`lib/allergyChecker.ts`): a client-side utility
that cross-checks a patient's recorded allergy string against a
medication name being added to the e-prescription or consultation
notes. Shows a warning banner if a potential match is found. Operates
entirely client-side (no API call — allergy text is already loaded in
the patient session) to keep the alert instant rather than network-
dependent.

**Voice Dictation Button** (`components/shared/VoiceDictationButton.tsx`):
a microphone button that attaches to the SOAP note textareas in the
Consultation Page. Uses the browser's Web Speech API
(`SpeechRecognition`) to transcribe doctor dictation directly into the
note field. Gracefully hidden on browsers that don't support the API.

**Quick Barcode Scanner Dialog** (`visits/QuickBarcodeScannerDialog.tsx`):
a dialog that reads a barcode via the device camera (using a barcode
scanning library) to look up a patient by a printed barcode on their
physical file card. Triggered from the New Walk-In dialog as a faster
alternative to typing the file number. Barcode format: the clinic's
sequential `file_no` encoded as Code 128.

**Patient Kiosk Page** (`pages/public/PatientKioskPage.tsx`): a
touch-optimized, large-text self-service page for a tablet mounted in
the clinic lobby. Patients enter their national ID to check their
queue status, see their doctor's name, and receive a confirmation of
their check-in. No login required — reads from the public queue status
endpoint.

**MedicalRecordsTab** enhanced on PatientProfilePage: doctors can now
see a "clinical summary" header per record (visit type badge, attending
doctor name, vital signs snapshot) before expanding the full SOAP note.

**RecordDetailPage** enhanced: shows a structured SOAP layout (labelled
sections for each field) instead of the previous raw textarea dump.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FRs: financial analytics for superadmin/management, cashier Z-Report, allergy-medication interaction warning, voice dictation, barcode patient lookup, self-service lobby kiosk |
| Chapter 4 | §4.x API Design | Add the financial analytics endpoints (`GET /billing/analytics`, `GET /billing/z-report`) |
| Chapter 4 | §4.x UI Design / Screen Designs | Add FinancialAnalyticsPage, Z-Report Modal, enhanced MedicalRecordsTab, structured RecordDetailPage, Kiosk Page |
| Chapter 4 | §4.x Design Decisions | Document the client-side allergy checker design decision: instant local check (no round-trip) is safer than a network-dependent check for a safety-critical warning — a slow network should not delay an allergy alert |
| Chapter 4 | §4.x Design Decisions | Document the voice dictation graceful-degradation approach: `SpeechRecognition` API availability is detected at render time; the button is hidden rather than disabled on unsupported browsers so the UI does not present a broken control |

---

## Sprint 3c — SOAP Clinical Templates + Public Queue Tracker

---

### [DELTA-039] Quick SOAP clinical templates + mobile public queue tracker

| Field | Value |
|---|---|
| **Category** | Functionality / UI / API |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — backend endpoint verified, frontend wired and verified in-browser |

**What changed:**
**SOAP Clinical Templates** — a backend-managed library of pre-written
SOAP note templates for the most common conditions a general clinic
sees (e.g. Upper Respiratory Infection, Hypertension Follow-Up,
Pediatric Well-Child Visit). New `clinical_templates` table stores
each template's `name`, `category` (condition group), and the four
SOAP field values. New routes: `GET /templates` (doctor + admin,
returns active templates), `POST /templates` (superadmin only — creates
new templates). Inside the Consultation Page's Clinical Notes tab, a
"Quick Templates" button opens a searchable modal; selecting a template
pre-fills all four SOAP textareas, which the doctor can then edit.
Saves significant typing time for routine presentations.

**Bug fixed in this commit:** `clinicalTemplates.routes.js` imported
`authenticateJWT` from the wrong path (`../middleware/auth` instead of
`../middleware/authMiddleware`), causing a startup crash. Corrected in
the following commit (`1e9bf54`).

**Public Queue Tracker** (`pages/public/QueueTrackerPage.tsx`, route
`/queue-tracker`) — a public, no-auth mobile page for patients waiting
in the clinic lobby. The patient enters their queue number and selects
their doctor; the page shows their current position in the queue (how
many patients are ahead of them), the current active patient's number,
and an estimated wait time (based on average elapsed consultation
duration for that doctor today). Refreshes every 30 seconds. Requires
no login — patients can open it on their own phone without registering
for the system. New backend endpoint: `GET /visits/queue-status?doctorId=`
(public, no auth middleware) returns aggregated, non-PII queue
information (position counts and current number — no patient names).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FRs: "Doctors shall be able to pre-fill SOAP notes from a template library for common conditions" and "Patients shall be able to check their real-time queue position from a public URL without logging in" |
| Chapter 4 | §4.x ER Diagram | Add `clinical_templates` entity (template_id, name, category, chief_complaint, objective, assessment, plan, is_active) |
| Chapter 4 | §4.x API Design | Add `GET /templates`, `POST /templates`, `GET /visits/queue-status` endpoints; note `GET /visits/queue-status` as the only truly public (unauthenticated) API endpoint in the system, and what PII it does NOT return (no patient names, only position counts) |
| Chapter 4 | §4.x Security Design | Document the `/queue-status` endpoint's privacy-by-design: it returns queue position numbers and counts only — never patient names, national IDs, or any identifying information. A patient's privacy is preserved even if they share the queue tracker URL |

---

## Sprint 3c — Doctor Consultation Page Final Redesign

---

### [DELTA-040] Doctor consultation page rebuilt as 4-tab layout with real-time sync

| Field | Value |
|---|---|
| **Category** | UI / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live in-browser, real-time sync confirmed across two browser tabs |

**What changed:**
`ConsultationPage.tsx` was completely rebuilt from a single-scroll page
into a 4-tab layout, and a real-time cross-tab sync mechanism was added
so the Staff page updates automatically when the doctor takes action.

**4-tab structure:**

| Tab | Content |
|---|---|
| Overview | Patient summary card (name, file#, age, allergies, blood type, care team) + current visit info (queue#, clinic, checked-in time, doctor) |
| Clinical Notes | SOAP note form (Chief Complaint, Objective, Assessment, Plan) + vital signs grid + Quick Templates button + Voice Dictation button + Odontogram/Body Chart toggle |
| Billing | Services/items table (add from catalog, remove, qty) + prescription notes textarea + "Complete Visit" button |
| History | Past medical records (most recent 10, expandable) + past visits list (date, doctor, status) |

The tab separation addresses the original single-scroll page's
usability problem: on a typical consultation, the doctor needs Clinical
Notes and sometimes History, but the Billing tab (which had previously
dominated the page with a large service table) was distracting when
the doctor's focus should be on the patient. Billing is now one click
away but out of sight when not needed.

**Real-time sync** (`lib/syncChannel.ts`) uses the browser's
`BroadcastChannel` API to push a lightweight notification to other
open tabs of the same app when the doctor completes a consultation
(`markDone`). The Staff's `TodaysVisitsPage` listens on the same
channel and invalidates its React Query cache when a completion event
arrives — the visit card updates from "In Consultation" to "Ready to
Bill" without waiting for the 30-second polling interval. This works
between tabs of the same browser only (not cross-device), which covers
the common case of a single front-desk computer with multiple tabs open.
Cross-device real-time would require WebSockets (deferred to Phase 2).

**Past history cards fixed:** the History tab's past-records list was
displaying incorrect visit dates (using `created_at` instead of
`scheduled_at`/`checked_in_at`) and not rendering the attending
doctor's name. Both corrected.

**NewWalkInDialog** gained a clinic picker (dropdown for Branch 1 /
Branch 2) — the `visits.clinic` column had existed since DELTA-026 but
was never populated from the UI, so all visits were created with a
null clinic value and showed "—" in the visits table.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update the consultation FR: doctor works within a tabbed consultation workspace (Overview / Clinical Notes / Billing / History), not a single scrolling page |
| Chapter 4 | §4.x UI Design / Screen Designs | Replace the Consultation Page description entirely: 4-tab layout with content per tab, real-time sync mechanism, and the NewWalkInDialog clinic picker |
| Chapter 4 | §4.x Design Decisions | Document the BroadcastChannel approach as a deliberate scoping decision: same-browser real-time (sufficient for a single front-desk machine) chosen over WebSockets (which would require a new infrastructure component — socket.io server or AWS API Gateway WebSocket — for marginal gain in the clinic's actual operating context). Cross-device real-time listed as a Phase 2 item |
| Chapter 4 | §4.x Design Decisions | Document the tab separation rationale: billing controls visible during clinical documentation is a cognitive interference risk — the doctor's attention should be on the patient, not on service codes. Separating Clinical Notes from Billing into distinct tabs is a UI safety decision, not just a layout preference |

---

## Sprint 3c — Corrections to Earlier Entries

---

### [DELTA-040 CORRECTION] ConsultationPage tab names were documented incorrectly

The 4 tabs in `ConsultationPage.tsx` are:

| Tab # | Correct Name | Content |
|---|---|---|
| 1 | **SOAP** | Patient vitals strip (BP, HR, Temp, Weight, Height, BMI), Quick Clinical Templates button, Chief Complaint, Physical Exam/Objective findings, Voice Dictation button |
| 2 | **Wasfaty E-Prescription & Seha Sick Leave** | Structured Wasfaty/SFDA medication table builder (initialized as empty `[]`), Live Drug-Allergy Cross-Sensitivity alert, Official E-Rx Print/Preview modal, MOH Seha Sick Leave generator |
| 3 | **Dental & Body Charting** | FDI interactive 32-tooth Odontogram and anatomical Body Chart SVG |
| 4 | **Services & Billing** | Procedure/service selection from catalog, invoice quantity editor |

The original DELTA-040 incorrectly documented the tabs as Overview / Clinical Notes / Billing / History. That was an earlier iteration of the design. The final implementation above is what the code actually contains.

Additionally: the left sidebar of ConsultationPage contains a **Past Medical History** panel with clickable visit cards that open `ViewRecordModal` to inspect historical diagnosis, SOAP notes, and prescribed medications — not a "History" tab.

**Report Chapter 4 update:** Replace any mention of "Overview / Clinical Notes / Billing / History" tabs in the Consultation Page description with the correct 4-tab structure above.

---

### [DELTA-038 CORRECTION] Financial analytics route is `/financial-analytics` not `/finance`

The standalone Financial Analytics Page (superadmin only) is mounted at `/financial-analytics` in `App.tsx`, with a matching sidebar navigation link in `Sidebar.tsx`. The report and any API table should use this path.

Also: the backend analytics endpoint is `GET /api/billing/analytics` (not `/api/finance/...`).

---

### [DELTA-037 CORRECTION] Room statuses have 4 values (not 3); room numbers are 101–501

The `rooms` table status column has 4 values: `available`, `occupied`, **`cleaning`**, `maintenance`. The "cleaning" status was omitted from the original DELTA-037. Room numbers in the grid span 101–501 (not a generic "Room 1 to N" range).

---

### [DELTA-034 CORRECTION] SMS reminder route path

The SMS appointment reminder endpoint is `POST /api/appointments/:appointmentId/reminder-sms`, not `POST /appointments/:id/send-reminder` as DELTA-034 described. The response is HTTP 200 (not 202) — the fire-and-forget pattern uses `setImmediate` to dispatch Twilio after the DB transaction commits, then returns 200 immediately. The audit log entry (`AUDIT_ACTIONS.SCHEDULE_APPOINTMENT`) is written inside the DB transaction.

---

## Sprint 3c — Clinical & Scheduling Features (Week 2)

---

### [DELTA-041] MOH Seha Certified Sick Leave Report Generator

| Field | Value |
|---|---|
| **Category** | Functionality / DB Schema / API / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — `sick_leaves` table live, backend endpoint active, `SickLeaveModal.tsx` wired to ConsultationPage Tab 2 |

**What changed:**
New `sick_leaves` table and a dedicated backend module implementing a Ministry
of Health (MOH) Seha Platform-compliant sick leave report. Components:

**Schema** — `sick_leaves` table: `sl_id` (UUID PK), `patient_id` (FK),
`doctor_id` (FK), `start_date`, `end_date`, `diagnosis_summary`, `notes`,
`created_at`. A `SEHA-SL-XXXXXX` reference number is generated server-side
(sequential or UUID prefix) and included in the printed document.

**Backend** — `sickLeavesController.js`:
- `POST /api/sick-leaves` (doctor only) — creates a record, binds the
  real logged-in doctor's session context (`req.rlsSession.doctorId`) to
  fetch the physician's actual name and specialty from the `doctors` table.
  Never uses static placeholder strings for doctor identity.
- `GET /api/sick-leaves/patient/:patientId` (doctor + admin) — retrieves
  sick leave history for a patient.

**Frontend** — `SickLeaveModal.tsx`: A structured form matching MOH Seha
fields (patient name, national ID, diagnosis summary, from/to dates, issuing
doctor's name + specialty + license number). Generates a printable A4-format
sick leave certificate with the Seha verification reference number. Surfaced
as a "Sick Leave" action button in ConsultationPage Tab 2
(Wasfaty E-Prescription & Seha Sick Leave).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "The system shall allow a doctor to generate an official MOH Seha-compliant sick leave certificate during a consultation, bound to the authenticated doctor's identity" |
| Chapter 4 | §4.x ER Diagram | Add `sick_leaves` entity (sl_id, patient_id FK, doctor_id FK, start_date, end_date, diagnosis_summary, reference_no, created_at) |
| Chapter 4 | §4.x API Design | Add `POST /api/sick-leaves` (doctor only) and `GET /api/sick-leaves/patient/:patientId` (doctor + admin) |
| Chapter 4 | §4.x Design Decisions | Document the real-session-binding decision: the sick leave certificate's physician identity is always derived from `req.rlsSession.doctorId` → DB lookup — never from a form field the user types. A form field would allow any doctor to issue a certificate under another doctor's name, which is a regulatory fraud risk. |

---

### [DELTA-042] Visual Diagnostic Lab & Radiology Results Viewer

| Field | Value |
|---|---|
| **Category** | Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — `LabResultsViewerModal.tsx` wired to ConsultationPage and PatientProfilePage |

**What changed:**
A new `LabResultsViewerModal.tsx` component implements a multi-panel diagnostic
lab viewer. The viewer supports four panel types:

| Panel | Fields shown |
|---|---|
| CBC (Complete Blood Count) | WBC, RBC, Hemoglobin, Hematocrit, Platelets |
| Lipid Profile | Total Cholesterol, LDL, HDL, Triglycerides |
| Renal Function | Creatinine, BUN, eGFR, Uric Acid |
| Chest X-Ray | Findings text, impression notes, radiology image attachment link |

Each numeric result displays an automated reference range status badge:
`Normal` (green), `High` (amber), `Critical` (red). The modal also renders
a lab stamp (clinic name, date, verifying technician) on the printable view.

This enhances the existing lab results upload flow (DELTA-020) — previously
staff could upload a PDF/image of lab results and the patient/doctor could
download it. The viewer now parses structured result data (stored as JSONB
in `lab_results`) and renders it in a clinical-grade panel layout with
reference ranges, rather than requiring the reader to open the raw PDF.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Update FR for lab results: "The system shall display structured lab results with automated reference range status indicators (Normal/High/Critical), not only raw file downloads" |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the Lab Results Viewer Modal description: panel tabs, reference range badge system, lab stamp, and the print view |
| Chapter 4 | §4.x Design Decisions | Document the local reference range evaluation decision: range checking runs client-side against the JSONB values already fetched — no separate API call. This keeps the display instant and avoids a second network round-trip for a read-only visual computation. |

---

### [DELTA-043] Interactive Doctor Schedule & 30-Min Time-Slot Booking Grid

| Field | Value |
|---|---|
| **Category** | Functionality / DB Schema / API / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — `doctor_schedules` table live, `DoctorSchedulePicker.tsx` wired to appointment booking flow |

**What changed:**
A new `doctor_schedules` table and booking grid provide a visual time-slot
picker for scheduling appointments:

**Schema** — `doctor_schedules` table: `schedule_id` (UUID PK), `doctor_id`
(FK), `slot_date` (DATE), `slot_time` (TIME), `status` (VARCHAR CHECK:
`available` / `booked` / `break`), `created_at`. Each row is one 30-minute
slot on one specific date for one doctor.

Note: this is separate from `doctor_availability` (DELTA-009/019), which
stores the doctor's *weekly recurring schedule* (e.g. "Sundays 9 AM – 5 PM").
`doctor_schedules` stores the *instantiated* daily slot grid (the actual
available/booked slots for a specific date), generated from the availability
template when a date is selected in the UI.

**Frontend** — `DoctorSchedulePicker.tsx`: A 30-minute grid spanning 9 AM –
9 PM. Each slot displays its status with a badge: `Available` (teal),
`Booked` (amber, shows patient name on hover if doctor/admin), `Doctor Break`
(gray). Clicking an available slot selects it for the appointment creation
form. Replaces the plain time-picker `<input type="time">` that was previously
in `CreateAppointmentDialog`.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "Staff shall be able to select appointment time slots from a visual 30-minute grid showing real-time slot availability per doctor per date" |
| Chapter 4 | §4.x ER Diagram | Add `doctor_schedules` entity (schedule_id, doctor_id FK, slot_date, slot_time, status); distinguish it from `doctor_availability` (weekly template vs. instantiated daily grid) |
| Chapter 4 | §4.x UI Design / Screen Designs | Update the Appointment creation dialog description: the time field is a `DoctorSchedulePicker` visual grid, not a plain time picker |
| Chapter 4 | §4.x Design Decisions | Document the two-table scheduling design: `doctor_availability` = weekly template (e.g. "doctor works Sundays 9–5"); `doctor_schedules` = instantiated slots for a specific date (generated on-demand when a date is picked). The separation means the availability template doesn't need to be re-queried to check every individual slot — the instantiated grid is the authoritative bookable surface. |

---

### [DELTA-044] Treating Doctor attribution on medical record cards

| Field | Value |
|---|---|
| **Category** | Functionality / UI / DB Schema |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — `MedicalRecord.findById` and `medicalRecordsController.js` updated; `MedicalRecordsTab.tsx` and `RecordDetailPage.tsx` display doctor name badge |

**What changed:**
`MedicalRecord.findById` (and the listing queries it feeds) now executes a
`LEFT JOIN doctors d ON d.doctor_id = mr.doctor_id` and returns `d.full_name
AS doctor_name` alongside the record fields. Previously the medical record
model only returned `doctor_id` (UUID) — the UI had no way to display a
human-readable doctor name without a second lookup.

The `doctor_name` value is now rendered as a badge on:
- **`MedicalRecordsTab.tsx`** (in PatientProfilePage) — each record card shows
  "Attending: Dr. [name]" (EN) / "الطبيب المعالج: د. [name]" (AR)
- **`RecordDetailPage.tsx`** — displayed in the record header below the visit date

This matters clinically: at a multi-doctor polyclinic where a patient may have
been seen by different physicians across specialties (General, Dental,
Pediatrics), the record list previously gave no indication of which doctor
wrote each record. Now each record is unambiguously attributed.

The same JOIN was also applied to the MedicalRecordsTab's cross-specialty
history view (DELTA-035/044) — treating doctors across clinics are now visible
in every record regardless of which clinic the record originated at.

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x UI Design / Screen Designs | Update Medical Records / Patient Profile description: each record card displays attending doctor name badge ("Dr. [name]" / "د. [name]") |
| Chapter 4 | §4.x Design Decisions | Document the JOIN-at-read approach: doctor name is resolved at query time via JOIN rather than stored denormalized in `medical_records` — avoids stale name data if a doctor updates their display name, at the cost of one JOIN per query (cheap at this scale). |

---

### [DELTA-045] Clinic name correction + operating hours + social links

| Field | Value |
|---|---|
| **Category** | Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — all i18n files and UI references updated |

**What changed:**
Three localization/content corrections applied across all i18n files and
backend services:

**Clinic Arabic name** — corrected from `عيادة الأمين` (clinic, singular) to
`مجمع الأمين الطبي` (polyclinic complex). The landing page hero, footer, sidebar
wordmark, invoice header, and all `ar/*.json` locale files now use the
correct name. The English name was already `Alamin PolyClinic` — consistent.

**Operating hours** — corrected from "24/7" (placeholder) to the real clinic
hours: **Daily 8 AM – 1 AM (Friday: 12 PM – 1 AM)** / **يومياً: ٨ ص – ١ ص
(الجمعة: ١٢ ظ – ١ ص)**. Updated in the Quick Access emergency card, the
footer contact section, and relevant i18n keys.

**Branch names** — the two clinic branches are officially named:
- **Al-Amin Clinic 1 — Namar** (Branch 1, main)
- **Al-Amin Clinic 2 — Dirab** (Branch 2)
These names are used in the NewWalkInDialog clinic picker, the
`/specialties/:slug` page's branch switcher, and the Google Maps embed on
the specialty detail pages.

**Social media links** — official clinic social accounts added to the
`LandingFooter`: Snapchat (`@alaminclinic`), Facebook (`Alamin-Clinicss`),
Instagram (`@alaminclinic`), Twitter/X (`@alaminclinic`).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 1 | §1.x Case Study — Alamin Clinic | Update any mention of "عيادة الأمين" to "مجمع الأمين الطبي"; update the operating hours if cited |
| Chapter 4 | §4.x UI Design | Note the branch picker in NewWalkInDialog uses the real branch names (Namar, Dirab) not generic "Branch 1 / Branch 2" |

---

### [DELTA-046] `prescriptions_data` JSONB column + `notifications` table

| Field | Value |
|---|---|
| **Category** | DB Schema / Functionality |
| **Sprint** | Sprint 3c |
| **Status** | Implemented |

**What changed:**
Two schema additions that support the Wasfaty E-Rx and notification systems:

**`prescriptions_data` JSONB** — added to `medical_records`. Stores the
structured Wasfaty/SFDA medication table as a JSON array of prescription
objects (trade name, dosage form, strength, quantity, days supply, refills,
frequency, instructions). Separate from the existing `prescription` TEXT
column (which stored free-text notes) — the JSONB column is the machine-
readable structured form used to generate the printable E-Rx document.

**`notifications` table** — new table backing the live notification drawer
(DELTA-030/038): `notification_id` (UUID PK), `user_id` (FK — recipient),
`type` (VARCHAR: `visit_checkin` / `queue_sla_alert` / `unbilled_visit`),
`title`, `body`, `is_read` (BOOLEAN DEFAULT false), `metadata` (JSONB —
stores the visit_id or patient_id the notification links to), `created_at`.
Live SQL queries joining `visits`, `patients`, and `doctors` populate
notification rows when:
- A patient checks in (walk-in or arrived appointment)
- A visit exceeds 20 minutes in the waiting queue (SLA alert)
- A visit is marked `completed` but has no `visit_invoices` row (unbilled alert)

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 4 | §4.x ER Diagram | Add `notifications` entity; add `prescriptions_data` JSONB to `medical_records` entity |
| Chapter 4 | §4.x API Design | Add `GET /api/notifications` (own user's notifications), `PATCH /api/notifications/read-all` (mark all read) |
| Chapter 4 | §4.x Design Decisions | Distinguish `prescriptions_data` (JSONB, structured Wasfaty E-Rx array) from `prescription` TEXT (free-text clinical notes) — both coexist on `medical_records`; the TEXT field supports quick dictation while the JSONB field supports the formal printable document format |

---

## Sprint 3c — Forgot Password (Patient Self-Service)

---

### [DELTA-047] Patient self-service forgot-password flow (phone OTP)

| Field | Value |
|---|---|
| **Category** | Security / API / Functionality / UI |
| **Sprint** | Sprint 3c |
| **Status** | Implemented — verified live end-to-end (happy path, non-enumeration, rate limiting, unlock-on-reset) |

**What changed:**
Patients who forget their password can now reset it themselves via phone
OTP, reusing the exact `otp_verifications`/`password_setup_tokens`
infrastructure already built for UC-19 self-registration rather than
introducing a parallel mechanism. Staff accounts (doctor/admin/superadmin)
have no verified contact channel to build self-service on — `doctors.phone`
exists as a schema column but nothing reads or writes it — so they see a
static "contact your system administrator" notice on the same page instead
of a form.

Two new public endpoints on `auth.routes.js`, backed by a new
`passwordResetController.js`:
- `POST /api/auth/forgot-password/request-otp` — looks up the patient by
  **national ID + phone number together** (national ID alone already
  identifies the account; requiring the phone too acts as a second factor
  and sidesteps `contact_number` having no UNIQUE constraint). Rate-limited
  to 3/phone/hour via a new, separate `passwordResetRequestLimiter` (kept
  distinct from `otpRequestLimiter` so registration-OTP and reset-OTP
  attempts don't drain the same per-phone budget).
- `POST /api/auth/forgot-password/verify-otp` — on success, mints a
  short-lived (30-minute) `password_setup_tokens` row via the existing
  `generateSetupToken` helper (extended with optional `ttlMs`/`purpose`)
  and redirects into the **existing, unmodified** `SetupPasswordPage.tsx` —
  no new password-setting UI needed.

Non-enumeration: `request-otp`'s response is identical in shape whether or
not the identifier pair matches a real patient (mirrors
`authController.js`'s `DUMMY_HASH` compare-on-every-path principle) — a
real `bcrypt.hash()` still runs on the no-match branch, and a syntactically
valid but unresolvable `requestId` is returned instead of skipping straight
to a response.

Schema: `otp_verifications.purpose` CHECK widened to include
`'password_reset'`, plus a new nullable `user_id` column linking a reset
OTP to the account it's resetting; `password_setup_tokens` gained a
`purpose` column (`'initial_setup' | 'password_reset'`) so the shared
`setPassword` controller can tell the two flows apart.

Frontend: new `ForgotPasswordPage.tsx` (2-step form: identify → OTP code)
at `/forgot-password`, linked from a new "Forgot password?" line under the
password field on `LoginPage.tsx`.

**Bug found and fixed live:** the first pass had `setPassword`
unconditionally reactivating (`is_active = true`, clear `failed_attempts`)
on every token consumption, including the plain first-time QR setup flow —
meaning a still-valid setup token could silently undo an admin's explicit
deactivation of an account that was still mid-setup. Fixed by scoping the
reactivate call to the `password_reset` branch only. A defense-in-depth
null check on `otp.user_id` was added alongside it (`patients.user_id` is
nullable via `ON DELETE SET NULL`; nothing produces a null today, but this
keeps a future hard-delete path a clean 400 instead of a 500).

**Verified live:** full happy path against a disposable test patient
(request-otp → SMS-stub code → verify-otp → setup-password → login with
new password); non-enumeration (wrong phone / fabricated identifier
returns the identical response shape and generically fails at verify);
rate limiting (4th request in the window → 429); unlock-on-reset (account
locked via 3 failed logins, then a successful reset flow confirmed both
`is_active` and `failed_attempts` cleared).

**Report sections to update:**

| Chapter | Section | What to edit |
|---|---|---|
| Chapter 3 | §3.5.1 Functional Requirements | Add FR: "A patient who forgets their password shall be able to reset it via phone OTP verification without staff intervention"; note staff accounts are explicitly out of scope (no verified contact channel) |
| Chapter 4 | §4.x API Design | Add `POST /auth/forgot-password/request-otp` and `POST /auth/forgot-password/verify-otp` (both public, rate-limited) to the endpoint table |
| Chapter 4 | §4.x Security Design | Document the non-enumeration mechanic (identical response shape/timing regardless of match) as a specific anti-enumeration control, alongside the existing `DUMMY_HASH` login-side precedent it mirrors |
| Chapter 4 | §4.x Security Design | Note the account-unlock scoping bug as a "lessons learned": reusing a shared endpoint (`setPassword`) across two purposes requires explicitly scoping any purpose-specific side effect, not assuming shared code implies shared behavior is always correct |
| Chapter 4 | §4.x DB Schema / ER Diagram | Add `otp_verifications.user_id` (nullable FK) and `password_setup_tokens.purpose` to the schema description |
| Chapter 4 | §4.x UI Design / Screen Designs | Add the Forgot Password page (2-step: identify, verify code) and its login-page entry point to the screen list |

---

## How to use this file

1. After each sprint ends, check this file before editing the report.
2. Each DELTA entry tells you exactly which section to open and what to change.
3. Mark entries `Done` in the Status field once the report chapter is updated.
4. New implementation decisions go here first — then into the sprint, then into the report.

---

*Last updated: Sprint 3c — DELTA-047 (2026-07-25)*
