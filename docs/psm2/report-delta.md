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

## How to use this file

1. After each sprint ends, check this file before editing the report.
2. Each DELTA entry tells you exactly which section to open and what to change.
3. Mark entries `Done` in the Status field once the report chapter is updated.
4. New implementation decisions go here first — then into the sprint, then into the report.

---

*Last updated: Sprint 3c (2026-07-18)*
