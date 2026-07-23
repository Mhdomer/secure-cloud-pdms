# Sprint 3c — UI Overhaul

Sprint 3a (backend) and 3b (frontend scaffold) are done.
The current UI is functional but visually poor. Sprint 3c fixes that before Sprint 4 begins.

**Rule: One screen per session. Never continue a UI session past one screen.**
Each session starts cold with a pre-built prompt. No warm-up needed. No drift.

---

## How to Run Each Session

1. Open a **new chat** in Claude Code (not this one, not the Sprint 3 chat)
2. Paste the **Context Block** (same every session — copy it once, save it somewhere)
3. Paste the **Screen Prompt** for the specific screen you're working on
4. Say: `start` — the frontend-designer agent handles the rest
5. When done, run `/rtl-check` and `/ui-review` in the same session
6. Mark the screen as done in the tracker below

---

## Context Block (paste this at the start of EVERY session)

```
You are a frontend-designer agent working on a bilingual (Arabic/English) React + Tailwind clinic
PDMS for Alamin Clinic, Jeddah (Saudi Arabia). The system is post-ransomware, cloud-based,
HIPAA-aligned. React 18 + TypeScript + Vite + shadcn/ui + Tailwind + Framer Motion.

Before doing anything else, read these two files:
  - docs/psm2/design-system.md    ← tokens, type rules, what to avoid
  - docs/psm2/ui-brief.md         ← who uses each screen + signature elements per screen

Rules you must follow:
- Use existing Tailwind tokens only — no new colors, no new shadow values
- shadcn/ui as base components, layered with design-system styling
- Framer Motion for animation — no CSS @keyframes
- All strings via useTranslation() — no hardcoded copy
- Arabic: line-height 1.7+, letter-spacing 0 always, font-size 17px body, Thmanyah font
- Logical CSS properties (start/end) — never hardcoded left/right
- One bold visual idea per screen, everything else quiet
- Read the existing file before editing it — never overwrite without reading first
```

---

## Screen Queue

| # | Screen | File | Status | Session # |
|---|---|---|---|---|
| 1 | Login Page | `src/pages/auth/LoginPage.tsx` | Gate passed — hero panel photo swapped to `public/clinic/login-hero.png` (real clinic entrance/lobby); no layout, form, color, or copy changes | 2026-07-18 |
| 2 | Doctor Dashboard | `src/pages/dashboard/DoctorDashboard.tsx` | Gate passed — follow-up session added the split Consultation/Treatment Room hero banner, a 5th "Follow-Ups" stat card, and a "Next Patient" summary card. Further rebuilt for the walk-in billing flow (DELTA-026/DELTA-027). Upgraded 2026-07-20: glassmorphism card styling, 1-click Lab & Rx order actions inside expanded timeline cards, and Vitals Highlight Bar in Patient Summary card. | 2026-07-14, 2026-07-18, 2026-07-20 |
| 3 | Staff Dashboard | `src/pages/dashboard/AdminDashboard.tsx` | Gate passed — follow-up session added the lobby hero banner + numbered Queue/Checked-In/In-Consultation flow pills, and Time/Patient/Type/Doctor/Status table. Upgraded 2026-07-20: glassmorphism card styling, live MRN/Name/Phone Instant Search bar, Queue Status Filter Tabs (All, Waiting Room, In Consultation, Completed), and live lobby waiting pulsing badges. | 2026-07-15, 2026-07-18, 2026-07-20 |
| 4 | Patient Dashboard | `src/pages/dashboard/PatientDashboard.tsx` | Gate passed — follow-up session added lobby hero banner, separate "Upcoming Appointment" and "Quick Book" cards, and "Your Care Journey" 4-step stepper. Upgraded 2026-07-20: glassmorphism card styling, SMS appointment reminder & Google Maps direction actions, and direct PDF Export & Print icons for prescriptions and past visits. | 2026-07-15, 2026-07-18, 2026-07-20 |
| 5 | Superadmin Dashboard | `src/pages/dashboard/SuperAdminDashboard.tsx` | Gate passed — upgraded 2026-07-20: glassmorphism card styling, System Health KPI Bar (Total Registered Users, Active Doctors, Today's Appointments, Operational Status), and System Audit Feed snippet. | 2026-07-17, 2026-07-20 |
| 6 | Patient List | `src/pages/patients/PatientLookupPage.tsx` | Gate passed | 2026-07-17 |
| 7 | Patient Profile | `src/pages/patients/PatientProfilePage.tsx` | Gate passed — full rebuild per the expanded Screen 7 spec: sticky header (avatar/name/national ID/age/blood type/always-visible allergy badge, admin-only edit toggle) + role-gated vertical tabs (Medical Records + Lab Results doctor-only; Appointments + Demographics + Invoices doctor+admin; Demographics edit admin-only). Extended `Patient`/`UpdatePatientPayload` types to the full demographic field set the backend already returns. Added `types/invoice.ts`, `types/labResult.ts`, `invoicesApi`/`labResultsApi` (multipart upload + plain `<a download>` file links) to `lib/api.ts`. New tab components under `pages/patients/profile/`. Verified live as both doctor and admin. Follow-up 2026-07-19 (DELTA-028): added a 6th tab, "Billing" — the structured `visit_invoices` history from the billing engine (DELTA-027), separate from the "Invoices" tab's staff-uploaded documents (unrelated table, unrelated data). | 2026-07-17, 2026-07-19 |
| 8 | Appointments | `src/pages/appointments/AppointmentsPage.tsx` | Gate passed — follow-up resolved 2026-07-17: Create/Edit Appointment dialogs converted to the slide-in `Sheet` panel `ui-brief.md` describes, and their `patient_id` field replaced with the new searchable `PatientSelect` combobox (see DELTA-018 in `report-delta.md`) | 2026-07-17 |
| 9 | Medical Records | `src/pages/records/MedicalRecordsPage.tsx` | Gate passed — added a split-pane view (history left/right by RTL, inline note form) for the doctor+patient-context case (`?patientId=`); doctor's own unscoped list and patient's read-only list keep the plain list. Uses the existing flat diagnosis/prescription/notes fields, not the SOAP shape `ui-brief.md` describes — `types/medicalRecord.ts` documents that the backend has no structured SOAP/prescriptions-array model | 2026-07-17 |
| 10 | Record Detail | `src/pages/records/RecordDetailPage.tsx` | Gate passed — replaced the exposed raw record UUID in the header with the created date (existing left-border clinical-field treatment was already reasonable) | 2026-07-17 |
| 11 | Settings | `src/pages/settings/SettingsPage.tsx` | Gate passed (superadmin "Change Display Name" not implemented — no backend endpoint exists yet, out of frontend scope) | 2026-07-17 |
| 12 | User Management | `src/pages/settings/UserManagementPage.tsx` | Gate passed — added `components/ui/sheet.tsx` (new, RTL-aware slide-in) for account creation + a confirm dialog before deactivate/reactivate | 2026-07-17 |
| 13 | Landing Page | `src/pages/landing/LandingPage.tsx` | Gate passed — follow-up session 2026-07-18 added a new "Our Specialty Centres" interactive section. Rebuilt 2026-07-20 with KPJ-style staggered cards, standalone `/specialties/:slug` detail pages, interactive "Learn More" buttons, and cleaned hero subtext. | 2026-07-17, 2026-07-18, 2026-07-20 |
| 14 | App Shell / Sidebar | `src/components/layout/` | Gate passed — upgraded 2026-07-20: background emblem mark watermark (`opacity-15`), layout z-index ordering, and `side="right"` physical tooltip positioning for collapsed sidebar. | 2026-07-17, 2026-07-20 |
| 15 | Password Setup Page (new, public) | `src/pages/auth/SetupPasswordPage.tsx` | Done — built same session as the backend QR flow it depends on (see Backend Edit Sessions below). Manually verified bilingual (AR/EN) end-to-end in-browser (token validate → set password → success → login with new password); formal `/rtl-check` + `/ui-review` not yet run | 2026-07-16 |
| 16 | Doctor Working Hours (new, superadmin only) | `src/pages/doctors/DoctorAvailabilityPage.tsx` | Done — new screen against the existing `doctor_availability` API (DELTA-009), which had no frontend write-side UI at all before this session. Reached via a new "Working hours" link on doctor rows in User Management. Verified live end-to-end (view seeded hours → add a day → confirm via API → remove a day with confirm dialog); formal `/rtl-check` + `/ui-review` not yet run. See DELTA-019 in `report-delta.md` for the DB grant bug this session also found and fixed. | 2026-07-17 |
| 17 | Patient Invoices (new, patient only) | `src/pages/invoices/MyInvoicesPage.tsx` | Done (DELTA-028) — new dedicated sidebar-nav page (`/invoices`), not a `/records` tab, per explicit user request to make it "easily navigated to". Two sections: Billing (`MyBillingHistoryTab.tsx`, new — the structured `visit_invoices` history) and Documents (reuses the existing `pages/records/MyInvoicesTab.tsx` from DELTA-020 as-is, relocated out of the `/records` tabs). Verified live in-browser as admin for the equivalent staff-facing Billing tab; patient-side view not yet clicked through in-browser (blocked mid-session — see report-delta.md DELTA-028), backend confirmed via direct controller calls with simulated patient sessions. | 2026-07-19 |

Update Status to: `In progress` → `Done` → `Gate passed` as you go.

> **Screen 15 note:** run `/rtl-check` and `/ui-review` on `SetupPasswordPage.tsx` (and on the QR panel it shares with `RegisterPatientDialog.tsx`/`RegenerateQrCard.tsx` — `components/shared/SetupQrPanel.tsx`) before marking Gate passed, per the one-screen-per-session rule.

> **Login Page brand correction (found during 2026-07-17 audit):** `LoginPage.tsx` uses the
> `brand.gold`/`brand.charcoal` palette (real photo hero, gold CTA) instead of the plain
> `primary-700` teal panel + SVG pattern described in `ui-brief.md`'s Login Page section.
> This isn't a bug — `tailwind.config.ts` documents `brand.*` as intentionally "scoped to
> auth/marketing surfaces," matching the same real-photography treatment used on the
> rebuilt Landing Page. `ui-brief.md`'s Login section is stale on this point; the code's
> decision wins. Login also asks for `username`, not `email`, since the backend auths by
> username — another point where the brief text predates the actual implementation.



---

## Running the app locally to actually see a rebuilt screen

Static review isn't enough — log in and look at it. Local Postgres already exists
on `localhost:5432` (db `pdms`, superuser `postgres` / `2013` — see `src/backend/.env`
for the app-role connection the backend itself uses). Schema is current; no need to
re-run `schema.sql` unless it's been changed since.

```
cd src/backend  && npm run dev     # http://localhost:5000
cd src/frontend && npm run dev     # http://localhost:3000
```

One seeded account per role already exists in that local DB (added 2026-07-14 while
building the Doctor Dashboard screen — reuse these rather than reseeding from scratch):

| Role | Username | Password | Notes |
|---|---|---|---|
| Doctor | `dr.fahad` | `DoctorPass123!` | Sarah Al-Fahad — has a seeded today's schedule (5 appointments, mixed statuses/types), 5 patients (some with `allergies` set), 4 medical records for the "Recent Patients" / last-diagnosis proxy |
| Admin (Staff) | `admin.test` | `AdminPass123!` | No data attached yet |
| Superadmin | `superadmin.test` | `SuperAdmin123!` | The pre-existing `superadmin` row in this DB is deactivated — use this one instead |
| Patient | `patient.test` | `PatientPass123!` | Linked to patient "Fahad Al-Otaibi" (one of dr.fahad's seeded patients) — has real appointments/records to view |

If a screen needs more seed data than this (e.g. Staff Dashboard needs "recently
registered patients today", Superadmin needs multiple staff accounts to list), add it
directly via `psql`/Docker against the same local DB rather than standing up a new one —
keep these five accounts stable so later sessions don't have to re-derive credentials.

To actually see RTL/Arabic, use the language toggle in the top bar — it's instant,
no reload. To test the "current time" moving elements (if a screen has any), remember
real local time may fall outside a clinic's display window; override `Date` via
dev-tools console before the component mounts, or click to a different route and back
to force a remount with the override applied.

---

## Screen Prompts (copy the one you need)

---

### Screen 1 — Login Page

```
Screen: Login Page
File to rebuild: src/pages/auth/LoginPage.tsx

Read the "Login Page" section from docs/psm2/ui-brief.md for the full brief.

Summary of what it should look like:
- Split layout: left panel = deep teal (primary-700) with clinic name in both scripts stacked
  (Arabic large, English smaller below), white text, a subtle geometric SVG pattern
  (teal-on-teal, almost invisible), and the line "Your records, secure since 1986"
- Right panel = clean form: Email, Password, Forgot password link, Submit button
- Language toggle top-right — switches BOTH panels simultaneously
- Error messages: inline under each field in danger-600, never a toast
  Specific messages: "No account found", "Wrong password", "Account deactivated"
- No generic logo-above-card-on-gray layout

Read the existing LoginPage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 2 — Doctor Dashboard

```
Screen: Doctor Dashboard
File to rebuild: src/pages/dashboard/DoctorDashboard.tsx

Read the "Doctor Dashboard" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- "Today" strip at top — full width, primary-50 bg — shows current time, appointment count,
  next patient name + time, pending lab results count
- Two columns below: left (wider) = today's appointments as a vertical timeline with time
  markers, current slot highlighted. Right (narrower) = last 5 patients quick-link list
- Appointment card expands inline on click (not a modal) — shows allergies + last diagnosis
- No generic 4-number stat grid

Read the existing DoctorDashboard.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 3 — Staff Dashboard

```
Screen: Staff (Admin) Dashboard
File to rebuild: src/pages/dashboard/AdminDashboard.tsx

Read the "Staff Dashboard" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Two large primary-600 action buttons dominate the top: "Register New Patient" + "Book Appointment"
- Below: today's appointment timeline (read-only, no clinical notes)
- "Recently registered" strip: last 3 patients registered today with MRN + time
- Different from doctor dashboard — staff has different primary actions, different layout priority

Read the existing AdminDashboard.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 4 — Patient Dashboard

```
Screen: Patient Dashboard
File to rebuild: src/pages/dashboard/PatientDashboard.tsx

Read the "Patient Dashboard" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Large centered "Your Next Appointment" card (date, time, doctor, type)
  If no appointment: card becomes a CTA "Contact the clinic to book"
- Below: "Recent Records" (last 2-3 visit summaries, date + diagnosis only)
- "Active Prescriptions" (medication name, dosage, end date as styled pills)
- No stat grid — patients need their information, not metrics about themselves

Read the existing PatientDashboard.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 5 — Superadmin Dashboard

```
Screen: Superadmin Dashboard
File to rebuild: src/pages/dashboard/SuperAdminDashboard.tsx

Read docs/psm2/ui-brief.md for the system tone and approach.

This screen is for the clinic manager/IT admin. Their one job: manage staff accounts.
- Security info strip at top (role cannot access clinical data — reinforce trust)
- Role hierarchy table (superadmin / doctor / staff / patient with what each can do)
- Quick action cards: Create Account, Deactivate Account, View All Users
- Clean, minimal — this user visits rarely

Read the existing SuperAdminDashboard.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 6 — Patient List

```
Screen: Patient List
File to rebuild: src/pages/patients/PatientLookupPage.tsx

Read the "Patient List" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Search bar is the hero — large, 60% width, debounced 300ms, searches name/MRN/phone
- Table rows: colored initials avatar + full name (bold) + phone (muted) | MRN | DOB | last visit | View →
- Avatar color: deterministic from name — same patient always gets the same color
- Row hover: bg-primary-50 (not gray)
- Empty state: "No patient found for '[term]' — register them?" + Register button
- No 10-column table

Read the existing PatientLookupPage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 7 — Patient Profile

```
Screen: Patient Profile
File to rebuild: src/pages/patients/PatientProfilePage.tsx

Read the "Patient Profile" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Sticky header that never scrolls: Avatar | Name · MRN | DOB (Age) | Blood Type | [Allergies: ⚠ warning-600]
- Vertical tab navigation below: Medical Records | Appointments | Demographics
- Medical Records tab = chronological timeline, newest first
  Each entry: date · visit type · Dr. name / chief complaint / diagnosis (bold) / [Expand]
  Expanded: full SOAP note in readable format, prescriptions as styled pill badges
- Edit mode is intentional: pencil icon → unlocks fields. Default is read-only.
- Allergies always visible is a patient safety design decision — document it as such in a comment

Read the existing PatientProfilePage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 8 — Appointments

```
Screen: Appointments
File to rebuild: src/pages/appointments/AppointmentsPage.tsx

Read the "Appointments" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Default view: Day view timeline — hours as rows (8 AM–10 PM), appointments as time-slot blocks
- Toggle: Day View / List View (top-right toggle)
- List view = same appointment card component used in dashboards (consistent)
- Create appointment: slide-in panel from the right (not a modal) — patient search + time picker + type
- Do not default to month calendar view

Read the existing AppointmentsPage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 9 — Medical Records

```
Screen: Medical Records
File to rebuild: src/pages/records/MedicalRecordsPage.tsx

Read the "Medical Records" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Split pane: left = patient history timeline (read-only), right = new note form
  Seeing history while writing the current note = fewer medical errors
- Form fields: Chief Complaint, Objective Findings, Assessment, Plan (all textareas)
  Prescriptions: add-row interface (drug name + dosage + frequency + duration)
- Submit button text: "Save Record" — not "Submit"
- On mobile: stacked (history above, form below)

Read the existing MedicalRecordsPage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 10 — Settings

```
Screen: Settings
File to rebuild: src/pages/settings/SettingsPage.tsx

Read the "Settings" section from docs/psm2/ui-brief.md for the full brief.

Summary:
- Single focused column — not a settings wall
- Language toggle: large segmented control (Arabic / English), not a dropdown
  Clicking it changes the page live — this is the best live demo of the bilingual system
- Change Password section below
- Superadmin only: Change Display Name
- No sidebar navigation within settings

Read the existing SettingsPage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 11 — User Management (Superadmin only)

```
Screen: User Management
File to rebuild: src/pages/settings/UserManagementPage.tsx

This screen is only accessible to superadmin.

Summary:
- Table of all staff accounts: Avatar + Name | Role badge (doctor/staff/superadmin) | Email | Status (active/inactive) | Actions
- "Create Account" button top-right → slide-in panel: Full name, email, role dropdown (doctor / staff), temp password
- Deactivate/reactivate action per row — confirmation dialog before executing
- Role badge colors: superadmin = primary, doctor = blue-50, staff = amber-50
- No patient accounts shown here — this is staff account management only

Read the existing UserManagementPage.tsx first, then rebuild it.
After building, run /rtl-check.
```

---

### Screen 14 — App Shell + Sidebar

```
Screen: App Shell and Sidebar
Files: src/components/layout/AppShell.tsx, src/components/layout/Sidebar.tsx

The shell wraps all authenticated screens. The sidebar is the navigation.

Summary:
- Sidebar 240px expanded / 64px collapsed, smooth 150ms transition
- Background: neutral-100 (warm, not white, not dark)
- Active item: primary-50 bg + 4px primary-600 border-inline-start
- No heavy shadow on sidebar — just a right border
- Collapsed: shows icons only. Each icon has a tooltip on hover.
- Top of sidebar: clinic name (expanded) or clinic initials (collapsed)
- Bottom of sidebar: logged-in user's name + role badge + logout button
- Logout confirmation: inline tooltip or small popover, not a full modal

Read the existing files first, then rebuild them.
After building, run /rtl-check.
```

---

### Screen 13 — Landing Page (image-enhanced, full rebuild)

```
Screen: Landing Page — full rebuild with real clinic photography
Files to edit:
  - src/frontend/src/pages/landing/LandingPage.tsx
  - src/frontend/src/locales/en/landing.json
  - src/frontend/src/locales/ar/landing.json

Read before writing any code:
  - docs/psm2/design-system.md
  - docs/psm2/ui-brief.md  (Landing Page section)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0 — COPY IMAGES TO PUBLIC FOLDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run this PowerShell block to copy and rename the clinic photos:

  New-Item -ItemType Directory -Force "src\frontend\public\clinic"
  Copy-Item "docs\clinic_imgs\snapshot_004_logo.png"              "src\frontend\public\clinic\logo.png"
  Copy-Item "docs\clinic_imgs\snapshot_011main_hall.png"          "src\frontend\public\clinic\main-hall.png"
  Copy-Item "docs\clinic_imgs\snapshot_010_reception.png"         "src\frontend\public\clinic\reception.png"
  Copy-Item "docs\clinic_imgs\snapshot_030.waiting_area.png"      "src\frontend\public\clinic\waiting-area.png"
  Copy-Item "docs\clinic_imgs\snapshot_034_laboratoy.png"         "src\frontend\public\clinic\laboratory.png"
  Copy-Item "docs\clinic_imgs\snapshot_021_kids_clinic.png"       "src\frontend\public\clinic\pediatrics.png"
  Copy-Item "docs\clinic_imgs\snapshot_052dermtology.png"         "src\frontend\public\clinic\dermatology.png"
  Copy-Item "docs\clinic_imgs\snapshot_073_emergeny.png"          "src\frontend\public\clinic\general-medicine.png"
  Copy-Item "docs\clinic_imgs\snapshot_085_genral_clinic.png"     "src\frontend\public\clinic\exam-room.png"
  Copy-Item "docs\clinic_imgs\dentaisti_women.png"                "src\frontend\public\clinic\cosmetology.png"
  Copy-Item "docs\clinic_imgs\snapshot_087_main_hall_again_backshot.png" "src\frontend\public\clinic\main-hall-2.png"
  Copy-Item "docs\clinic_imgs\snapshot_013_main_hall2.png"        "src\frontend\public\clinic\main-hall-3.png"
  Copy-Item "docs\clinic_imgs\snapshot_019_clinic_sections.png"   "src\frontend\public\clinic\clinic-sections.png"
  Copy-Item "docs\clinic_imgs\snapshot_061_baby_delivey_and_women_check.png" "src\frontend\public\clinic\womens-health.png"
  Copy-Item 'docs\clinic_imgs\snapshot_041 dentisit.png'          "src\frontend\public\clinic\dental.png"

After running, confirm the files exist in src/frontend/public/clinic/ before continuing.
These images are served by Vite at /clinic/filename.png in the browser.

IMPORTANT — Logo background:
  The logo (logo.png) has a light/white background. In any dark-bg context, wrap it in:
  <div className="bg-white rounded-lg px-3 py-1.5 inline-flex">
    <img src="/clinic/logo.png" className="h-10 w-auto" alt="مجمع الأمين الطبي" />
  </div>
  On white/light bg sections: use the logo directly without the wrapper.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — FIX ar/landing.json (read it first — it is broken)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Arabic locale has wrong data and missing sections. Fix all of this:

1. trust keys: replace HMG hospital-group numbers (4500 physicians, 3300 beds, etc.) with:
     "physicians": { "value": "+١٥", "label": "طبيب" }
     "experience": { "value": "+٣٠", "label": "عام من الخبرة" }
     "patients":   { "value": "+٥٠٬٠٠٠", "label": "مريض" }
     "specialties":{ "value": "٨", "label": "تخصص طبي" }
   Delete the old beds/subSpecialties/accreditations keys.

2. hero: add "searchPlaceholder": "ابحث عن طبيب أو قسم أو خدمة…"
              "searchToast": "سجّل دخولك للبحث في الدليل الكامل"

3. quickAccess (add entire block):
     "quickAccess": {
       "book":        { "title": "احجز موعداً",   "desc": "جدوِل زيارتك القادمة" },
       "findDoctor":  { "title": "ابحث عن طبيب",  "desc": "تصفّح أطباءنا والتخصصات" },
       "emergency":   { "title": "طوارئ",          "desc": "اتصل بنا الآن — متاح ٢٤/٧" },
       "departments": { "title": "الأقسام",        "desc": "استكشف خدماتنا الطبية" }
     }

4. services: add the 5 missing keys (keep generalMedicine and digitalRecords; delete "specialist"):
     "pediatrics":       { "title": "طب الأطفال",        "desc": "رعاية لطيفة لأطفالك، من حديثي الولادة حتى سن المراهقة." }
     "internalMedicine": { "title": "الطب الباطني",      "desc": "تشخيص وإدارة طويلة الأمد لأمراض البالغين، من السكري إلى ارتفاع الضغط." }
     "dental":           { "title": "طب الأسنان",        "desc": "فحوصات وتنظيف وعلاجات ترميمية للعائلة بأكملها." }
     "dermatology":      { "title": "الجلدية والتجميل",  "desc": "رعاية متخصصة لصحة الجلد وعلاج المشكلات الجلدية بمختلف أنواعها." }
     "laboratory":       { "title": "المختبر",            "desc": "تحاليل في الموقع بنتائج سريعة ودقيقة، ترسل مباشرة إلى سجلك الرقمي." }

5. doctors (add entire block):
     "doctors": {
       "heading": "تعرّف على أطباءنا",
       "sub": "فريق من الأطباء المتميزين الذين يعرفون مرضاهم بالاسم.",
       "cta": "احجز موعداً",
       "list": [
         { "name": "د. سارة الفهد",    "specialty": "الطب العام",    "bio": "١٥ عاماً من رعاية العائلات عبر ثلاثة أجيال." },
         { "name": "د. يوسف العمري",   "specialty": "طب الأطفال",   "bio": "يؤمن بأن هدوء الطبيب يمنح الطفل الهدوء أيضاً." },
         { "name": "د. نورة الزهراني", "specialty": "الطب الباطني", "bio": "تركّز على الرعاية الشاملة والمتابعة طويلة الأمد." },
         { "name": "د. فيصل الغامدي",  "specialty": "الجلدية",       "bio": "يعالج مشكلات الجلد في كل الأعمار بعناية واحترافية." }
       ]
     }

6. testimonials (add entire block):
     "testimonials": {
       "heading": "ماذا يقول مرضانا",
       "sub": "تجارب حقيقية من العائلات التي نرعاها.",
       "list": [
         { "name": "هدى م.",     "quote": "الأطباء هنا يتذكرونك فعلاً. الحجز وفّر عليّ الاتصال في كل مرة.", "rating": 5 },
         { "name": "عبدالله س.","quote": "السجلات الرقمية مكّنت طبيب ابني من رؤية كامل تاريخه الصحي فوراً.", "rating": 5 },
         { "name": "ريم أ.",    "quote": "أتيت هنا منذ طفولتي، والآن أحضر أطفالي. ما زالت تبدو كعيادة عائلية.", "rating": 5 }
       ]
     }

7. emergency (add entire block):
     "emergency": {
       "heading": "طارئ طبي؟",
       "description": "خط الطوارئ لدينا متاح على مدار الساعة. إن كان الأمر عاجلاً، اتصل — لا تنتظر الموعد.",
       "badge": "٢٤/٧",
       "hotlineLabel": "خط الطوارئ",
       "cta": "اتصل الآن"
     }

8. faq (add entire block):
     "faq": {
       "heading": "الأسئلة الشائعة",
       "list": [
         { "q": "كيف أحجز موعداً؟",
           "a": "يمكنك الاتصال بعيادتنا مباشرة أو طلب من موظف الاستقبال التسجيل وحجز الموعد." },
         { "q": "هل بياناتي الطبية آمنة؟",
           "a": "نعم. سجلاتك مخزّنة على AWS بتشفير AES-256 ولا يمكن الوصول إليها إلا من قِبَل طبيبك المعالج وأنت." },
         { "q": "هل يمكنني الوصول إلى سجلاتي عبر الإنترنت؟",
           "a": "بعد التسجيل، ستتلقى بيانات دخول للاطلاع على سجلاتك الخاصة بأمان من أي جهاز." },
         { "q": "ما شركات التأمين المقبولة؟",
           "a": "نتعامل مع كبرى شركات التأمين السعودية. تواصل معنا للتأكد من تغطيتك قبل زيارتك." },
         { "q": "ما مواعيد عمل العيادة؟",
           "a": "نعمل من السبت إلى الخميس من الساعة ٨ ص حتى ١٠ م. خدمات الطوارئ متاحة على مدار الساعة." }
       ]
     }

9. footer: add the missing keys (keep existing rights/privacy/terms):
     "about": "مجمع طبي عائلي في جدة يخدم المجتمع منذ ١٩٨٦، بسجلات رقمية حديثة وآمنة.",
     "quickLinksHeading": "روابط سريعة",
     "home": "الرئيسية",
     "servicesLink": "الخدمات",
     "doctorsLink": "أطباؤنا",
     "contactLink": "تواصل معنا",
     "servicesHeading": "الخدمات",
     "contactHeading": "التواصل"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — ADD FAQ + BRANDING FIXES TO en/landing.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add under "faq" key:
  "faq": {
    "heading": "Frequently Asked Questions",
    "list": [
      { "q": "How do I book an appointment?",
        "a": "Call our clinic or ask our front-desk staff to register and schedule for you." },
      { "q": "Is my medical data secure?",
        "a": "Yes. Records are stored on AWS with AES-256 encryption, accessible only by your doctor and yourself." },
      { "q": "Can I access my records online?",
        "a": "Once registered, you receive login credentials to view your records securely from any device." },
      { "q": "What insurance providers do you accept?",
        "a": "We work with major Saudi insurance providers. Contact us to confirm your coverage before your visit." },
      { "q": "What are your clinic hours?",
        "a": "Saturday through Thursday, 8 AM to 10 PM. Emergency services are available 24/7." }
    ]
  }

Also fix the footer.about text (the logo says "Since 1986", not 1993):
  "about": "A polyclinic in Jeddah serving the community since 1986 — trusted care, modern and secure digital records."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — REBUILD LandingPage.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the existing LandingPage.tsx fully before touching it.
Final page order:

  LandingNav → HeroSection → QuickAccessSection → TrustBand → ServicesSection
  → DoctorsSection → TestimonialsSection → EmergencyBanner → HowItWorksSection
  → FAQSection → ContactSection → LandingFooter

━━━ LANDING NAV ━━━
Sticky, backdrop-blur-md, border-bottom on scroll.
LEFT: <img src="/clinic/logo.png"> wrapped in <div className="bg-white rounded-lg px-3 py-1.5">
  height h-10 w-auto. This is the real clinic logo — gold metallic on light bg.
CENTER or RIGHT (LTR): nav links (Services, Doctors, Contact) + LanguageToggle + "Staff Login" button.
On scroll past hero: nav gets a white/95 bg, shadow-sm.

━━━ HERO SECTION ━━━
Full-viewport height. Real photo background — marble lobby of the clinic.

Structure:
  <section className="relative min-h-screen flex items-center overflow-hidden">
    {/* Photo background */}
    <div className="absolute inset-0">
      <img src="/clinic/main-hall.png" alt="" className="w-full h-full object-cover object-center" aria-hidden="true" />
      {/* Uniform dark overlay — preserves photo while making text readable */}
      <div className="absolute inset-0 bg-neutral-900/60" />
    </div>
    {/* Content: centered, max-w-3xl, text-center */}
    <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
      ...
    </div>
  </section>

Content inside:
  - Clinic name: "مجمع الأمين الطبي" (Arabic, text-3xl, text-amber-300 — matching the brand gold)
    below it: "Alamin PolyClinic" (English, text-lg, text-white/70)
    These lines switch language/direction with the toggle.
  - h1: t('hero.tagline') — text-5xl md:text-6xl, font-bold, text-white, mt-4
  - p: t('hero.subtext') — text-xl, text-white/80, max-w-2xl, mx-auto, mt-4
  - 2 CTA buttons (mt-8):
      Primary: t('hero.cta') → /login — bg-amber-500 hover:bg-amber-400 text-neutral-900 font-semibold
        (USE AMBER/GOLD for the primary CTA — this is the brand color, not teal on this page)
      Secondary: t('hero.ctaSecondary') → scrolls to #services — border-white text-white hover:bg-white/10
  - Search bar (mt-6):
      Input: placeholder=t('hero.searchPlaceholder'), bg-white/10 border-white/30 text-white
      On focus/submit: show a Sonner toast with t('hero.searchToast'), clear the input, do NOT navigate.
  - Framer Motion: the entire content block fades in + slides up (opacity 0→1, y 30→0, duration 0.7s)
  - Scroll chevron at bottom: ChevronDown icon, white/50, animate bob up/down (Framer Motion animate y: [0,8,0])

━━━ QUICK ACCESS SECTION ━━━
Immediately below hero. White bg. -mt-8 with a rounded-2xl card to overlap hero bottom.
4 cards: Book Appointment (Calendar icon → /login), Find a Doctor (Users → scrolls #doctors),
         Emergency (Phone → tel:+966112223333), Departments (LayoutGrid → scrolls #services)
Emergency card uses amber-50 bg + amber-600 icon to match brand gold (not red — red is for the
emergency banner further down, not this quick-access widget).
Stagger animation, whileInView once.

━━━ TRUST BAND ━━━
Dark charcoal section (existing TrustSection structure — keep it).
Fix locale keys: use trust.physicians, trust.experience, trust.patients, trust.specialties.
4 animated CountUp stat cards. (Remove any reference to the old beds/subSpecialties/accreditations keys.)

━━━ SERVICES SECTION ━━━
id="services"
6 cards. Each has a real clinic photo as a background image (object-cover, with a subtle
gradient overlay so the title text is always readable).

Service → image mapping:
  generalMedicine → /clinic/exam-room.png       (snapshot_085, labeled عيادات الطب العام والطورئ)
  pediatrics      → /clinic/pediatrics.png      (snapshot_021, labeled طب الأطفال)
  internalMedicine → /clinic/waiting-area.png   (snapshot_030, medical waiting room)
  dental          → /clinic/dental.png          (snapshot_041)
  dermatology     → /clinic/dermatology.png     (snapshot_052, labeled عيادات التجميل والجلدية)
  laboratory      → /clinic/laboratory.png      (snapshot_034, labeled المختبر)

Card structure (aspect-ratio: 4/3, overflow-hidden, rounded-2xl):
  <div className="relative rounded-2xl overflow-hidden group aspect-[4/3]">
    <img src={serviceImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-neutral-900/20 to-transparent" />
    <div className="absolute bottom-0 start-0 p-5 text-white">
      <h3 className="font-semibold text-lg">{t(`services.${key}.title`)}</h3>
      <p className="text-sm text-white/75 mt-1 line-clamp-2">{t(`services.${key}.desc`)}</p>
    </div>
  </div>

3-column grid desktop, 2-column tablet, 1-column mobile.
whileInView stagger 0.07s per card, once.

━━━ DOCTORS SECTION ━━━
id="doctors". White bg (off-white: bg-neutral-50).
Heading + sub from locale. 4 doctor cards from t('doctors.list') array.

Each card: white bg, rounded-2xl, subtle shadow.
  - Large circle avatar (80px) — deterministic color from name:
      const palette = ['bg-amber-600','bg-teal-600','bg-blue-700','bg-stone-600']
      (Use amber/gold as first in palette — matches brand)
    Initials from name, skip "Dr."/"د."
  - Doctor name (font-semibold, text-lg)
  - Specialty (text-sm, text-amber-600 — brand gold, not teal on this public page)
  - Bio (text-sm, text-neutral-500, 1 line)

One shared CTA button below the 4 cards: t('doctors.cta') → /login
(amber-500 bg, matching hero CTA)

━━━ TESTIMONIALS SECTION ━━━
bg-stone-50 (warm neutral).
3 cards from t('testimonials.list') array.
Star rating → filled stars (Star icon, fill-amber-400 text-amber-400 for filled, text-neutral-200 for empty).
Card: white bg, border border-neutral-200, rounded-2xl, p-6.
Layout: quote text (italic, text-neutral-700) → name (text-sm text-neutral-400, mt-4).
No avatar photo — just the name and stars.

━━━ EMERGENCY BANNER ━━━
Full-width, bg-red-700 (stronger red than 600 for authority).
Left: t('emergency.heading') white bold + t('emergency.badge') as pill (bg-red-900 text-white text-xs px-2 py-0.5)
      + t('emergency.description') white/80
Right: t('emergency.hotlineLabel') small white/70 + phone number large white font-bold text-3xl
       (Framer Motion: animate scale [1, 1.02, 1] on a loop — very subtle pulse)
       t('emergency.cta') button: bg-white text-red-700 font-semibold, href="tel:+966112223333"

━━━ HOW IT WORKS ━━━
Keep existing. Light cleanup only.

━━━ FAQ SECTION ━━━
bg-white. 5 accordion items from t('faq.list').
Custom accordion (no shadcn dependency needed — just useState):
  - One item open at a time. Default: first item open.
  - Trigger row: question text (font-medium) + ChevronDown (rotates 180° when open, Framer Motion).
  - Answer panel: AnimatePresence + motion.div (height: 0→auto, opacity 0→1).
  - Bottom border between items.
Max width: max-w-3xl mx-auto.

━━━ CONTACT SECTION ━━━
Keep existing ContactSection. Light cleanup only.

━━━ FOOTER ━━━
bg-neutral-900. 3 columns.

Col 1 (About):
  Logo: <div className="bg-white rounded-lg px-3 py-1.5 inline-flex mb-4"><img src="/clinic/logo.png" className="h-9 w-auto" /></div>
  t('footer.about') blurb in text-neutral-400

Col 2 (Quick Links): t('footer.quickLinksHeading') + 4 anchor links

Col 3 (Contact):
  t('footer.contactHeading') + t('contact.address') + t('contact.phone') + t('contact.hours')
  All text-neutral-400.

Bottom bar: border-t border-neutral-800, t('footer.rights') | t('footer.privacy') | t('footer.terms')

NO newsletter, NO social icons (we are not implementing social media accounts for this project).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSTRAINTS (non-negotiable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Landing page uses AMBER/GOLD for primary CTAs and accents — not the internal app's teal.
  teal (primary-600) is for the authenticated app. Gold (amber-500/amber-600) is for the public site.
  This matches the clinic's real brand identity (visible in logo, interior signage, all clinic materials).
- All images are served from /clinic/ — files were copied in Step 0. No external image URLs.
- All animation: Framer Motion only. No CSS @keyframes or CSS transitions on transform/opacity.
- All strings: useTranslation('landing'). No hardcoded copy.
- Arabic: letter-spacing: 0, line-height: 1.75+, 17px body, Thmanyah font on [lang="ar"].
- Logical CSS: ps/pe/ms/me/start/end — never hardcoded left/right.
- No social icons, newsletter, live map embed, dark mode, or content this project doesn't have data for.
- The search bar must show a toast before doing anything — never a silent dead end.

After finishing, run /rtl-check then /ui-review.
```

---

## Backend Edit Sessions

For backend fixes and additions, use the same one-session-per-feature rule.

| Feature | File(s) | Status |
|---|---|---|
| Seed superadmin account | `scripts/seed-admin.js` | Not started |
| Schema gap fixes (national_id, SOAP, confirmed status, doctor_availability) | `schema.sql`, `patientsController.js`, `medicalRecordsController.js`, `appointmentsController.js`, `DoctorAvailability.js`, `availability.js` | **Already implemented** — all files exist and contain the new fields. `docs/psm2/session-prompts/backend-schema-gaps.md` prompt is now stale/unneeded. Only outstanding question: whether the local DB was actually migrated (run `schema-additions.sql` against local Postgres if app errors on the new columns). |
| `GET /appointments` had no date bound — `ORDER BY scheduled_at ASC LIMIT` alone silently returned only the oldest rows once past `limit`, found while gating the Staff Dashboard screen | `models/Appointment.js`, `controllers/appointmentsController.js`, `routes/appointments.routes.js`, `lib/dateRange.ts`, `DoctorDashboard.tsx`, `AdminDashboard.tsx` | Fixed 2026-07-15 — added optional `from`/`to` ISO8601 query params, both dashboards now request a padded window around today; verified live against seeded data (admin/doctor/patient scoping + backward-compat pagination all confirmed via curl) |
| QR-based first-password flow — replaces the old admin-issued random temp password. Staff registers a patient with no password disclosed to them; a one-time 72-hour setup token is issued and rendered as a QR (`qrcode` npm package, server-side) + link; patient scans/opens it, lands on the new public `/setup-password` page, and sets their own password. Single-use, atomically consumed to close a race window; previous unused token auto-invalidated on regenerate. Also fixed a latent RLS gap found while building this: `admin_select_patients` only matched role `'admin'`, never `'superadmin'`, so any superadmin-authorized patients-table read (like the new regenerate-QR lookup) would have silently 404'd | Backend: `schema.sql` (`password_setup_tokens` table + RLS widen), `lib/generateSetupToken.js`, `models/PasswordSetupToken.js`, `controllers/passwordSetupController.js`, `controllers/patientsController.js` (registerPatient + new regenerateQR), `routes/passwordSetup.routes.js`, `routes/patients.routes.js`. Frontend: `pages/auth/SetupPasswordPage.tsx` (new), `components/shared/SetupQrPanel.tsx` (new, shared), `pages/patients/RegenerateQrCard.tsx` (new), `pages/patients/RegisterPatientDialog.tsx` (credentials panel → QR panel), `pages/patients/PatientProfilePage.tsx`, `App.tsx`, `lib/api.ts`, `types/patient.ts`, `types/auth.ts`, `locales/{en,ar}/{patients,auth}.json` | Done 2026-07-16 — backend smoke-tested end-to-end via curl in one session, frontend built and verified live in-browser in a follow-up session (register → QR shown → scan link → set password → login with new password → regenerate QR as admin, all confirmed working in both AR and EN). One real bug caught and fixed during browser verification: `SetupQrPanel`'s root div needed `min-w-0` — `DialogContent` is `display:grid`, and grid/flex items default to `min-width:auto`, so the panel refused to shrink below the un-truncated setup URL's intrinsic width and overflowed the dialog box. |
| Quick Check-In (Feature E from the 2026-07-17 feature audit, see "Feature Audit" section below) — staff marks a patient "arrived" between confirmation and being seen. Added `'arrived'` to the `appointments.status` CHECK constraint (kept the app's real vocabulary — `scheduled`/`confirmed`/`completed`/`cancelled` — never added the suggested-but-nonexistent `'pending'`/`'no_show'`) and an `updated_at` column. New `PATCH /appointments/:id/checkin` (admin/superadmin only). Fixed a bug the status addition would otherwise have caused: `Appointment.listForDoctor`/`.listForPatient` hard-filtered `status IN ('scheduled','confirmed')`, so a checked-in appointment would have vanished from the doctor's and patient's own lists — added `'arrived'` to both filters | `schema.sql`, `config/constants.js`, `models/Appointment.js`, `controllers/appointmentsController.js`, `routes/appointments.routes.js`. Frontend: `types/appointment.ts`, `components/shared/StatusBadge.tsx`, `lib/api.ts`, `pages/dashboard/AdminDashboard.tsx`, `pages/dashboard/DoctorDashboard.tsx`, `locales/{en,ar}/{common,appointments,dashboard}.json` | Done 2026-07-17 — verified live (staff checks in → green "Arrived" badge + button disappears on Staff Dashboard → same appointment shows green border + "● Here" dot on Doctor Dashboard); security gate confirmed via curl (patient → 403, doctor → 403, only admin/superadmin can check in) |
| Digital Consent Forms (Feature I from the same feature audit) — reuses `patient_invoices` with a `category` column (`'invoice'` \| `'consent'` \| `'other'`) rather than a parallel table, since a consent form is the same "scanned file per patient" shape as a billing invoice. `POST`/`GET .../invoices` both extended with an optional `category` (upload defaults to `'invoice'`, existing callers unaffected) | `schema.sql`, `models/PatientInvoice.js`, `controllers/invoicesController.js`, `routes/invoices.routes.js`. Frontend: `types/invoice.ts`, `lib/api.ts`, `pages/patients/profile/InvoicesTab.tsx` (segmented Invoices/Consent Forms view), `locales/{en,ar}/patients.json` | Done 2026-07-17 — verified live via authenticated API calls (Puppeteer can't drive a native file picker): uploaded one of each category for the same patient, confirmed each view shows only its own category both via `?category=` and after a UI reload; security gate confirmed via curl (doctor → 403 on upload, doctor → 200 on download, matching the existing invoice endpoint's role split) |
| Patient picker extended into appointment booking + Create/Edit Appointment converted to slide-in panels (DELTA-018) — see the Screen 8 row above and `report-delta.md` for the full writeup | `components/shared/PatientSelect.tsx` (new), `pages/appointments/CreateAppointmentDialog.tsx`, `pages/appointments/EditAppointmentDialog.tsx`, `locales/{en,ar}/appointments.json` | Done 2026-07-17 — verified live (typed a name → debounced results appeared → selected → field populated; slide-in panel opens/closes correctly in RTL) |
| Doctor working-hours (availability) management screen (DELTA-019) — the `doctor_availability` write API existed since the schema-gap-fixes session but had no frontend ever built against it; also uncovered and fixed a real `GRANT` bug (see "Feature Audit" follow-up notes and `report-delta.md`) | Backend: `schema.sql` (added `GRANT ... DELETE ON doctor_availability`), `models/User.js` + `controllers/usersController.js` (expose `doctorId` on `GET /users`). Frontend: `types/doctor.ts`, `types/user.ts`, `lib/api.ts`, `pages/doctors/DoctorAvailabilityPage.tsx` (new), `pages/settings/UserManagementPage.tsx` (new "Working hours" link), `App.tsx`, `locales/{en,ar}/doctors.json` (new namespace, registered in `lib/i18n.ts`), `locales/{en,ar}/settings.json` | Done 2026-07-17 — verified live end-to-end as superadmin (viewed dr.fahad's seeded Sun–Thu hours → added Friday hours, confirmed via `GET .../availability` → removed Friday, which first 500'd with `permission denied for table doctor_availability` until the GRANT fix, then confirmed working and re-tested); security gate confirmed via curl (admin/staff role → 403, matches `assertCanManage`'s superadmin-or-self rule) |
| Patient self-view of invoices + doctor-gated lab result release (DELTA-020) — invoices/lab-results tabs were staff/doctor-only until now; user asked for patients to see their own invoices (billing, "he's the one paying") and proposed a doctor "release" step for lab results instead of blanket patient access | Backend: `schema.sql` (`lab_results.released_at`/`released_by` + RLS: `patient_select_released_lab_results`, `doctor_release_lab_results`, split `doctor_only_insert_lab_results`/`doctor_only_update_lab_results`), `models/LabResult.js` (`release()`), `controllers/invoicesController.js` (`getMyInvoices` + ownership check on download), `controllers/labResultsController.js` (`getMyLabResults`, `releaseLabResult`), `routes/invoices.routes.js`, `routes/labResults.routes.js`. Frontend: `types/labResult.ts`, `lib/api.ts` (`invoicesApi.mine`, `labResultsApi.mine`/`.release`), `pages/patients/profile/LabResultsTab.tsx` (release button/badge), `pages/records/MedicalRecordsPage.tsx` (patient view now tabbed), `pages/records/MyInvoicesTab.tsx` (new), `pages/records/MyLabResultsTab.tsx` (new), `locales/{en,ar}/{patients,records}.json` | Done 2026-07-18 — see `report-delta.md` DELTA-020 for the full writeup, including a RESTRICTIVE-policy `FOR ALL` RLS bug caught and fixed mid-session (release succeeded but the patient's list stayed empty until fixed); verified live in-browser as doctor (release button → badge flips) and patient (both tabs, AR + EN) |
| Clinic services price catalog (`clinic_services`) — superadmin-managed, admin read-only, dedicated `/catalog` page (DELTA-025) | Backend: `schema.sql` (`clinic_services` table), `controllers/clinicServicesController.js`, `routes/clinicServices.routes.js`. Frontend: `types/clinicService.ts`, `lib/api.ts` (`clinicServicesApi`), `pages/catalog/ServicesCatalogPage.tsx` (new), `App.tsx` (`/catalog` route), `components/layout/Sidebar.tsx` (nav link), `locales/{en,ar}/settings.json` | Done 2026-07-18 — write access started as admin+superadmin, narrowed to superadmin-only after user feedback that staff editing prices "against the integrity of the place"; admin kept read-only. Also relocated from a planned Settings tab to its own sidebar page after feedback that staff wouldn't think to check Settings for something needed constantly mid-shift. See DELTA-025 in `report-delta.md`. |
| Walk-in patient visit & queue system (`visits`) — doctor-only consultation status (DELTA-026) | Backend: `schema.sql` (`visits` table, per-day `queue_no` assignment), `controllers/visitsController.js`, `routes/visits.routes.js`. Frontend: `types/visit.ts`, `lib/api.ts` (`visitsApi`), `pages/visits/NewWalkInDialog.tsx` (new), `pages/visits/TodaysVisitsPage.tsx` (new, `/visits` route), `components/shared/VisitStatusBadge.tsx` (new), `lib/utils.ts` (`elapsedMinutesSince`), `pages/dashboard/DoctorDashboard.tsx` (Today's Queue promoted to the top of the page) | Done 2026-07-18 — re-architected mid-build after user correction: staff aren't physically present with the doctor and can't know when a patient actually enters/leaves the consultation room, so `waiting→in_progress`/`in_progress→completed` moved from staff buttons to doctor-only, rejected server-side (not just hidden) if an admin session attempts them (`visitsController.updateStatus`). Real bug found and fixed while building this: reusing the same `$1` placeholder across a `SET col = $1` context and a `CASE WHEN $1 IN (...)` context in the same query threw Postgres's "inconsistent types deduced for parameter $1" — fixed by giving each context its own parameter number. See DELTA-026 in `report-delta.md`. |
| Billing engine (`visit_invoices`/`invoice_items`) + print-ready invoice (DELTA-027) | Backend: `schema.sql` (`visit_invoices`/`invoice_items`, `invoice_no_seq` starting 900001), `utils/invoiceCalc.js` (new), `controllers/billingController.js` (new), `routes/billing.routes.js` (new), `config/constants.js` (`AUDIT_ACTIONS` additions). Frontend: `types/billing.ts` (new), `lib/api.ts` (`billingApi`), `pages/dashboard/DoctorDashboard.tsx` (interactive consultation card — add priced items, prescription notes, mark done), `pages/visits/BillVisitPage.tsx` (new, `/visits/:visitId/bill` — staff discount + payment collection), `pages/visits/InvoicePage.tsx` (new, `/visits/:visitId/invoice` — print-ready receipt), `components/shared/BackLink.tsx` (new, extracted as the 2nd consumer), `index.css` (print isolation rule), `locales/{en,ar}/{dashboard,visits}.json` | Done 2026-07-18 — all money math (subtotal/discount/VAT/grand total) computed server-side and re-fetched after every edit, never approximated client-side. The invoice print layout was cross-checked field-by-field against a real scanned invoice (`docs/real_samples/real_sample_invoice.pdf`) rather than guessed, and renders both languages simultaneously (not switched by the app's language toggle) matching how the physical document actually prints. Two real bugs caught while building: the given print CSS relied on `display:none` on an ancestor with a `!important display:block` override on the nested invoice element, which doesn't work — an ancestor's `display:none` removes descendants from the render tree regardless of their own `display` value; replaced with the standard `visibility`-based print-isolation pattern. The given invoice-header logo asset was actually a social-media promo card (phone number, Instagram/Snapchat icons, handle), not a document logo — swapped for the plain cropped icon mark. Backend syntax-checked and dev-server smoke-tested; full in-browser click-through not yet performed (no test credentials available in the implementing session). See DELTA-027 in `report-delta.md`. |
| Billing history surfaced to patients + staff/doctor (DELTA-028) — user-reported bug: a bill was generated and paid via DELTA-027's flow but was invisible everywhere except its exact `/visits/:visitId/invoice` URL; root cause was that DELTA-027 never wired `visit_invoices` up to `PatientProfilePage` or any patient-facing view at all | Backend: `controllers/billingController.js` (`listForPatient`, `listMine`, patient-ownership branch added to `assertOwnVisit`), `routes/billing.routes.js` (`ROLES.PATIENT` added to `GET /`), `routes/billingHistory.routes.js` (new). Frontend: `types/billing.ts` (`VisitInvoiceSummary`, `BillingHistoryResponse`), `lib/api.ts` (`billingApi.listForPatient`/`.mine`), `components/shared/StatusBadge.tsx` (extended for `visit_invoices.status`), `pages/patients/profile/BillingHistoryTab.tsx` (new, staff/doctor), `pages/invoices/MyInvoicesPage.tsx` + `MyBillingHistoryTab.tsx` (new, patient — own sidebar nav item, not a `/records` tab, per explicit user ask), `pages/visits/InvoicePage.tsx` (opened to `ROLES.PATIENT`, back-link now role-aware), `App.tsx`, `components/layout/Sidebar.tsx`, `locales/{en,ar}/{nav,visits,patients,common}.json` | Done 2026-07-19 — backend verified by calling the controller directly with simulated sessions (admin sees all/treating doctor sees own/unrelated doctor sees none/owning patient sees detail/other patient 404s); frontend verified live in-browser as admin (Billing tab lists the actual generated invoice, links through to the existing print page correctly). See DELTA-028 in `report-delta.md`. |

### Upcoming — QR/password-setup follow-ups (not started)

Raised while reviewing the QR flow above; none of these are blocking, but the QR flow's rollout isn't fully "smooth" without them.

| Item | Type | Why |
|---|---|---|
| Rate limit `POST /api/auth/setup-password` | Backend | It's public/unauthenticated and does a bcrypt hash on every call — cheap CPU-exhaustion target today. Should reuse the `loginLimiter` pattern in `middleware/rateLimiter.js`. |
| SMS delivery of the setup link | Backend (small) | `utils/smsProvider.js` already exists (stubbed, from the UC-19 OTP flow) — reuse it so staff can text the link instead of relying on the patient scanning a QR on the spot. |
| "Pending setup" list for admins | Backend + Frontend | No way today to see which registered patients haven't scanned their QR yet, or whose 72-hour window is about to lapse — staff only finds out reactively when the patient shows up unable to log in. Needs a query (`password_setup_tokens` where `used_at IS NULL`) and a small admin-facing view/badge. |
| Printable QR slip | Frontend | Not every patient scans on the spot; a print-friendly bilingual card (QR + instructions) the patient can take home would reduce round-trips back to the desk. |

### Upcoming — doctor scheduling follow-ups (not started)

Raised while building the Doctor Working Hours screen (DELTA-019) above; none block the superadmin flow that exists today.

| Item | Type | Why |
|---|---|---|
| Doctor self-service availability | Frontend | The backend already authorizes a doctor to manage their own hours (`assertCanManage` in `doctorAvailabilityController.js`), but nothing links a signed-in doctor to `/doctors/:doctorId/availability` for themselves — a doctor session has no client-side `doctorId` on the authenticated user object to build that link from. Needs either a "my own availability" self-referencing endpoint/route, or exposing `doctorId` on the login/session response. |
| Availability page for a deactivated doctor | Frontend | `DoctorAvailabilityPage` resolves the doctor's name via `GET /doctors` (the *active*-only directory), so the page shows "not found" for a deactivated doctor even though `GET .../availability` itself would still return their schedule. Minor — a superadmin managing hours for someone they just deactivated is an edge case, but the "not found" wording is misleading for it. |
| Grant audit for other write endpoints | Backend | The DELTA-019 bug (a DELETE route that had existed for a whole sprint but 500'd the first time it was actually exercised) suggests it's worth a quick pass checking every other table's `GRANT` list against what its controllers actually do (SELECT/INSERT/UPDATE/DELETE), rather than assuming a route existing means it was ever tested end-to-end. |

Backend session prompt prefix:
```
You are working on the Node.js/Express backend of a clinic PDMS.
Read src/backend/src/config/constants.js for ROLES and other constants.
Read src/backend/src/config/schema.sql for the DB schema.
The app DB user is pdms_app (least-privilege). NEVER use the postgres superuser in app code.
JWT is in an httpOnly cookie. 15-minute expiry. No refresh token in Sprint 3.
```

### Known pre-existing `tsc -b --noEmit` errors (not started)

Surfaced repeatedly while typechecking the file-number, clinic-services-catalog,
and services-catalog-sidebar sessions (2026-07-18) — confirmed via `git log`/`git blame`
to predate all three, most recently touched in the `d9ee837` rebrand commit or earlier.
None block the app (it still runs and typechecks around them), but a clean
`tsc -b --noEmit` run should fold these in next time either file is touched anyway.

| Item | Type | Why |
|---|---|---|
| `components/layout/Sidebar.tsx` lines 138 and 176 — `<TooltipContent side="end">` | Frontend (typecheck, `TS2322`) | Radix's `Tooltip.Content` `side` prop only accepts the physical `"top" \| "right" \| "bottom" \| "left"`, not the logical `"end"` this app otherwise uses everywhere for RTL (`border-s-4`, `ps-9`, etc.). Doesn't crash — Radix silently falls back to a default side — but the collapsed-sidebar tooltips (logo mark + each nav item) aren't guaranteed to flip to the correct side in Arabic. Fix is to pick the actual physical side per direction, not just swap in `"right"`. |
| `pages/appointments/AppointmentsPage.tsx` line 140 — unused `tCommon` | Frontend (typecheck, `TS6133`) | `const { t: tCommon } = useTranslation('common')` is declared but never called anywhere in the component. Dead code — safe to delete the line. |
| `pages/patients/profile/DemographicsTab.tsx` line 24 — unused `PreferredLanguage` import | Frontend (typecheck, `TS6196`) | Imported from `@/types/patient`, never referenced in the file. Dead code — safe to drop from the import list. |

---

## Recommended Session Order

Run in this order. No blocking dependencies remain — backend schema + controllers are already implemented.

```
Session 1  → Screen 13 — Landing Page        (fully static, self-contained — good warmup)
Session 2  → Screen 1  — Login Page
Session 3  → Screen 5  — Superadmin Dashboard
Session 4  → Screen 6  — Patient List
Session 5  → Screen 8  — Appointments
Session 6  → Screen 7  — Patient Profile     (blood_type, allergies, national_id — all in backend already)
Session 7  → Screen 9  — Medical Records     (SOAP fields — all in backend already)
Session 8  → Screen 10 — Record Detail
Session 9  → Screen 11 — Settings
Session 10 → Screen 12 — User Management
Session 11 → Screen 14 — App Shell / Sidebar (do last — wraps all other screens)
```

Sessions 1–5 can run in any order.
Session 11 (App Shell) must run last.

Note: Before running sessions 6–8, confirm the local DB has the new columns by running
`docs/psm2/schema-additions.sql` against the local Postgres instance if you see column-not-found
errors. The code is ready; only the local DB migration may be pending.

---

## Token Budget Guidance

| Session type | Typical token use | When to stop and start fresh |
|---|---|---|
| One screen rebuild | ~15k–25k | When the screen is done + RTL check passes |
| One backend fix | ~8k–15k | When the fix is committed and tested |
| Bug hunt | ~10k–20k | After 3 bugs fixed — start fresh for the next batch |

If a session hits 40k+ tokens and the screen isn't done, **stop**.
Write a handoff note in this file under the screen's row, then start a new session.

---

## Feature Audit — 2026-07-17

A feature-suggestion list (A–J) was audited against the actual code (`schema.sql`,
`constants.js`, controllers/routes, and the corresponding frontend screens) rather than
taken at face value. All ten verdicts matched the expected result; one (C) needed an
accuracy correction on *how* it's done, not *whether*.

| Feature | Status | Notes |
|---|---|---|
| A — Comprehensive EHR | Already done | Patient Profile's role-gated tabs (Medical Records, Appointments, Demographics, Invoices, Lab Results) plus the split-pane Medical Records screen cover this. |
| B — Daily Patient Queue | Already done | Doctor Dashboard's today timeline + Staff Dashboard's read-only mirror. |
| C — Clinical Notes | Already done, with a caveat | `medical_records` has real SOAP columns (`chief_complaint`/`objective`/`assessment`/`plan`/`vital_signs`/`visit_type`) and `medicalRecordsController.js` fully reads/writes them — but `CreateRecordDialog.tsx` and the split-pane form on `/records` still only expose the flatter `diagnosis`/`prescription`/`notes` fields `types/medicalRecord.ts` documents. The core job ("write a note quickly") is done; upgrading the form to the full SOAP fields is a real but separate frontend task, not part of this one. |
| D — Internal Secure Messaging | Skipped — Phase 2 | No messaging table, no WebSocket/socket.io dependency anywhere in `package.json`. |
| E — Quick Check-In | Implemented this session | See below. |
| F — Smart Search | Already done | `PatientLookupPage.tsx`'s 300ms-debounced search against `GET /patients?q=` (national ID / name / phone). |
| G — Real-Time Queue Dispatch | Skipped — Phase 2 | No WebSocket infrastructure. Quick Check-In (E) is the deliberate lightweight stand-in — the doctor dashboard already polls `GET /appointments` on its normal query interval and now highlights `arrived` rows, so "the doctor sees who's actually here" is solved without a push channel. |
| H — Team & Shift Dashboard | Skipped — Phase 2 | No `shifts`/`schedules`/`on_call` table in `schema.sql`; would need a whole new module. |
| I — Digital Consent Forms | Implemented this session | See below. |
| J — Shift Report Generator | Skipped — Phase 2 | Depends on H, which doesn't exist. |

### E — Quick Check-In

- `appointments.status` CHECK constraint gained `'arrived'` — **not** `'pending'`/`'no_show'`
  as the original suggestion assumed; this codebase's real initial status is `'scheduled'`
  (see `APPOINTMENT_STATUS` in `constants.js`), and neither of those two values appears
  anywhere else in the code. Adding them would have been silent, unrequested scope creep.
- Added `appointments.updated_at` (was missing entirely). Note for future schema changes on
  this table: **`CREATE TABLE IF NOT EXISTS` does not add columns to an already-existing
  table** — the first pass at this added `updated_at` only inside that block and it silently
  never applied to the local dev DB; the fix was a separate `ALTER TABLE ... ADD COLUMN IF
  NOT EXISTS`, same idempotent pattern the `'arrived'` constraint change already used.
  `patient_invoices.category` avoided this trap from the start.
- New `PATCH /api/appointments/:appointmentId/checkin` (admin/superadmin only, matching the
  upload-invoice role pair elsewhere in this file). Uses **409**, not 400, when the
  appointment is already arrived/completed/cancelled — `confirmAppointment` and
  `cancelAppointment` in the same controller both already use 409 for "valid request, wrong
  resource state," so checkin follows that existing local convention instead of the generic
  suggestion.
- Fixed a real bug this change would otherwise have introduced: `Appointment.listForDoctor`
  and `.listForPatient` both hard-filter `status IN ('scheduled', 'confirmed')`. Without
  adding `'arrived'` to that list, a checked-in patient's appointment would have vanished
  from the doctor's own queue (and the patient's own appointment list) the instant staff
  checked them in — exactly backwards from the feature's purpose. `listForAdmin` has no
  status filter and was unaffected.
- Frontend colors: the brief specified raw `amber-50`/`amber-700` (button) and
  `green-100`/`green-700` (badge). Both are pixel-identical to this project's existing
  `warning`/`success` design-system tokens (`warning-600` = `#d97706` = Tailwind's default
  `amber-600`; `success-600` = `#16a34a` = Tailwind's default `green-600`), so the
  implementation uses `StatusBadge`'s existing `success` variant and `bg-warning-50
  text-warning-600` rather than introducing new raw color classes — same visual result,
  stays inside "use existing tokens only."
- Verified live: staff checks in a `confirmed` appointment on the Staff Dashboard → badge
  flips to green "Arrived" and the button disappears; the same appointment on the Doctor
  Dashboard gets a green left border and a "● Here" dot next to the patient's name.
- Security gate: patient → 403, doctor → 403 (admin/superadmin only), confirmed via curl
  against the running dev server.

### I — Digital Consent Forms

- `patient_invoices` already existed (file-uploads session) — took the "preferred" path:
  `ALTER TABLE patient_invoices ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL
  DEFAULT 'invoice' CHECK (category IN ('invoice','consent','other'))`, plus an index on
  `category`. No new table.
  `POST /patients/:id/invoices` and `GET /patients/:id/invoices` both extended with an
  optional `category`; upload defaults to `'invoice'` when omitted (existing invoice-upload
  callers are unaffected). All new/changed queries use `$1`/`$2`-style parameters — the one
  dynamic piece (`listByPatient`'s optional category filter) builds the `$N` *placeholder
  number* into the query text, never the value itself, matching the same technique
  `Appointment.listForAdmin`/`listForDoctor` already use for their `from`/`to` filters.
- Frontend: Patient Profile's Invoices tab gained a segmented control ("Invoices" /
  "Consent Forms") rather than a second tab — both are "documents on file for this patient"
  in the identical shape, just filtered differently. Consent upload hides the amount field
  entirely and relabels "Description" → "Form type" (placeholder: "e.g. General Consent,
  Privacy Notice"); also relabeled the date field generically ("Date" instead of "Invoice
  date") for the consent view, a small polish beyond the original ask.
- Verified live: uploaded one `category=invoice` and one `category=consent` row for the same
  patient via authenticated API calls (Puppeteer can't drive a native file-picker dialog, so
  this part of the smoke test used direct HTTP against the running dev server instead of
  clicking through the file input) — the Invoices view shows only the invoice, the Consent
  Forms view shows only the consent form, confirmed both directions with `?category=` query
  params and in the actual UI after reload. Test rows removed from the local DB afterward.
- Security gate: doctor → 403 on upload (admin/superadmin only, unchanged from the existing
  invoice endpoint being reused), doctor → 200 on download (unchanged — download was already
  admin/superadmin/doctor), both confirmed via curl.

---

### Dashboard Overhaul & Billing Controller Fix — 2026-07-20

- **Role-Based Dashboards Visual & Functional Enhancements**:
  - `SuperAdminDashboard.tsx`: Added 4 glassmorphic stat cards (Total Users, Active Doctors, Today's Appointments, System Status) and a System Audit Feed snippet.
  - `AdminDashboard.tsx`: Added live Instant Search input (MRN / Name / Phone), Queue Status Filter Tabs (`All`, `Waiting Room`, `In Consultation`, `Completed`), and pulsing green waiting badges for lobby patients (`arrived`).
  - `DoctorDashboard.tsx`: Added 1-click Lab (`FlaskConical`) & Rx (`Pill`) order buttons inside expanded timeline blocks and a Vitals Highlight Bar (BP, HR, BMI) inside `PatientSummaryCard`.
  - `PatientDashboard.tsx`: Added SMS appointment reminder & Google Maps direction action buttons in the upcoming appointment card, and direct PDF Export & Print icons next to prescriptions and past visits.
  - **Glassmorphism Design Tokens**: Standardized `bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-xl` across all 4 dashboards.
  - **i18n & RTL**: Added all corresponding translation strings in `src/locales/en/dashboard.json` and `src/locales/ar/dashboard.json` while maintaining strict logical spacing properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).

- **Landing Page & Specialty Detail Page Redesign — 2026-07-20**:
  - `SpecialtyDetailPage.tsx` (new): Built full standalone `/specialties/:slug` page supporting 5 specialty slugs (`dental`, `general-medicine`, `laboratory`, `pediatrics`, `dermatology`). Features a dynamic hero banner, branch switcher (`Al-Amin Clinic 1 — Namar` vs `Al-Amin Clinic 2 — Dirab`), 4-column quick info bar, "Best In Industry" split section, full-width "Our Services" banner, filtered doctor cards grid with direct phone & booking links, and dynamic Google Maps embed with floating branch info overlay.
  - `LandingPage.tsx` & `ServicesPage.tsx`: Redesigned Specialty Centres section with KPJ-inspired staggered cards (Purple `#220d3b` & Teal `#002f3c` gradients), desaturated B&W header banner frame (`/clinic/canva-waiting-clean.png`), and enclosed navigation list with `"Learn More →"` links.
  - `TrustSection`: Integrated `brand-emblem-watermark.png` as a subtle background watermark (`mix-blend-multiply opacity-25 contrast-300`), right image frame (`brand-card-variant-2.png`), and 4 pop-out floating stat cards with smooth count-up animations for English & Arabic.
  - `LandingFooter`: Integrated official social links (Snapchat, Facebook, Instagram, Twitter/X) and updated operating hours to **Daily: 8 AM – 1 AM (Friday: 12 PM – 1 AM)** / **مجمع الأمين الطبي**.
  - `Sidebar.tsx`: Added background emblem mark (`/clinic/brand-emblem-mark.png`) watermark (`opacity-15`) scaling smoothly between expanded (`w-60`) and collapsed (`w-16`) states. Updated tooltip `side="right"` (resolving pre-existing `tsc` warning) and added `z-10` layer ordering over watermark.
  - `locales/en/landing.json` & `locales/ar/landing.json`: Added `specialtyDetail` translation blocks and cleaned up hero subtext punctuation (replaced em-dashes `—` with periods).

- **Billing Report 500 Fix**:
  - Fixed PostgreSQL query casting error in `src/backend/src/controllers/billingController.js` where `($1::date AT TIME ZONE 'Asia/Riyadh')` threw `operator does not exist: date AT TIME ZONE text`.
  - Updated both `getDailyReport` and `getDailyInvoices` to `($1::timestamp AT TIME ZONE 'Asia/Riyadh')`.
  - Verified compilation via `cd src/frontend && npx tsc -b` (0 errors).

- **Full Scalable Backend Integration for Role-Based Dashboards — 2026-07-21**:
  - **Database Composite Indexing (`src/backend/src/config/schema.sql`)**:
    - Added `idx_medical_records_patient_latest` on `medical_records (patient_id, created_at DESC)`.
    - Added `idx_appointments_scheduled_at` on `appointments (scheduled_at)`.
    - Added `idx_audit_log_timestamp` on `audit_log (timestamp DESC)`.
    - Added `idx_doctors_is_active` on `doctors (is_active)`.
  - **SuperAdmin Telemetry & 60s Response Cache (`src/backend/src/controllers/usersController.js` & `src/backend/src/routes/users.routes.js`)**:
    - Implemented `getSystemHealth` (`GET /api/users/system-health`, Superadmin only) returning real DB counts (`totalUsers`, `activeDoctors`, `todayAppointments`, `systemStatus`, `auditLogs`).
    - Added a 60-second in-memory TTL response cache (`HEALTH_CACHE_TTL = 60_000`) to prevent DB table locks and CPU spikes under high traffic.
    - Mounted route with `authenticateJWT`, `authorizeRole(ROLES.SUPERADMIN)`, and `setupRLSContext` middleware ensuring proper RLS transaction session isolation.
  - **Live Vitals Query Integration (`src/backend/src/models/MedicalRecord.js` & `src/backend/src/controllers/medicalRecordsController.js`)**:
    - Included `vital_signs` column in `listByPatient` and `listByPatientAndDoctor` queries and JSON responses (`vitalSigns`).
    - Wired `DoctorDashboard.tsx` `PatientSummaryCard` to display real blood pressure, heart rate, and BMI values from `lastVisitRecord.vitalSigns`.
  - **Non-Blocking Async SMS Appointment Reminders (`src/backend/src/controllers/appointmentsController.js` & `src/backend/src/routes/appointments.routes.js`)**:
    - Implemented `sendSmsReminder` (`POST /api/appointments/:appointmentId/reminder-sms`).
    - Reads appointment info and logs `AUDIT_ACTIONS.SCHEDULE_APPOINTMENT` inside `withTransaction(req.rlsSession, ...)`.
    - Responds immediately with HTTP 200 to the client and dispatches Twilio SMS asynchronously outside the DB transaction boundary (`setImmediate`), ensuring network latency never holds open PostgreSQL pool connections.
    - Mounted `[SMS]` action trigger buttons on both the **Staff Dashboard** (`AdminDashboard.tsx`) and the main **Appointments Page** (`AppointmentsPage.tsx`).
  - **Client-Side PDF Document Generator (`src/frontend/src/lib/pdfGenerator.ts`)**:
    - Created `exportMedicalRecordPdf` using browser-native print rendering (`window.print()`), offloading 100% of PDF compilation to the client browser and keeping server RAM/CPU at zero overhead.
    - Wired PDF export and print buttons on `PatientDashboard.tsx`.
  - **Unrecorded Patient Vitals Medical Safety Fix**:
    - Removed static hardcoded numeric fallback defaults (`120/80`, `72 bpm`, `23.4`) in `DoctorDashboard.tsx`. Unrecorded vitals now explicitly render `—` (em-dash) to prevent physicians from mistaking fallbacks for actual recorded patient vitals.
  - **Client-Side Cross-Navigation Links**:
    - Wrapped patient names across `AdminDashboard.tsx` (daily appointments & queue), `DoctorDashboard.tsx` (patient summary card, waiting list, seen today list), `AppointmentsPage.tsx` (list view cards), and `BillingHistoryPage.tsx` (transaction history table) in `<Link to={`/patients/${patientId}`}>` for 1-click patient file navigation.
  - **Doctor Consultation Vitals Input Form (`ConsultationPage.tsx`)**:
    - Added a 6-field Vital Signs entry grid (BP, HR, BMI, Temp, Weight, Height) to `ConsultationPage.tsx`. Saves `vital_signs` payload to `medical_records.vital_signs` via `recordsApi.create`.
    - Added `vital_signs?: VitalSigns` to `CreateMedicalRecordPayload` in `src/frontend/src/types/medicalRecord.ts`.
  - **Staff Fraud Prevention & Billing Attribution (`schema.sql`, `billingController.js`, `InvoicePage.tsx`)**:
    - Added `paid_by UUID REFERENCES users(user_id) ON DELETE SET NULL` to `visit_invoices` in `schema.sql` and ran migration script `scripts/apply-rls.js`.
    - Updated `payInvoice` in `billingController.js` to record `paid_by = req.user.userId`.
    - Joined `users` table (`u_paid`) in `getInvoice`, `getDailyInvoices`, and `getBillingHistory` to select `u_paid.username AS paid_by_staff_name`.
    - Updated `InvoicePage.tsx` to render explicit staff cashier attribution: **Billed By (Staff / Cashier) / صُدرت بواسطة موظف الاستقبال: `paidByStaffName`** (shows `Pending Payment` when unbilled; strictly zero doctor fallback).
  - **Treatment-Relationship RLS Architecture & Non-Circular Policy Fix (`schema.sql`, `scripts/apply-rls.js`, `medicalRecordsController.js`)**:
    - Implemented Option 1 Treatment-Relationship RLS: doctors automatically gain read access to a patient's profile and medical history whenever an appointment or visit exists with that doctor (eliminating manual staff PCP reassignments).
    - Removed circular subqueries between `patients` and `medical_records` policies in `schema.sql` and `scripts/apply-rls.js`, resolving PostgreSQL `infinite recursion detected` errors.
    - Updated `viewHistory` (`GET /medical-records/patients/:patientId/records`) in `medicalRecordsController.js` to use `MedicalRecord.listByPatient` so treating doctors see the patient's complete cross-clinic medical history timeline (allergies, prescriptions, notes, chief complaints, treating doctor names).
  - **Verification**:
    - Verified compilation via `cd src/frontend && npx tsc -b` (0 errors).
    - Verified live migration via `node scripts/apply-rls.js` (`RLS POLICIES APPLIED SUCCESSFULLY!`).
    - Verified backend queries (`PATIENTS QUERY SUCCESS`, `QUERY SUCCESS`).

- **Polyclinic PDMS Comprehensive UI Redesign & Functional Modules Overhaul — 2026-07-23**:
  - **Command Palette & Global Keyboard Shortcuts (`CommandPalette.tsx`, `AppShell.tsx`, `Topbar.tsx`)**: Implemented global `Ctrl+K` command launcher modal for fast role navigation, patient search, and language switching (`ar` ↔ `en`).
  - **Interactive Reception Lobby Kanban Board (`LobbyKanbanBoard.tsx`, `AdminDashboard.tsx`)**: Implemented 3-column reception waiting room board (`Waiting Room` $\rightarrow$ `In Consultation` $\rightarrow$ `Completed`) with real-time wait duration indicators and color-coded SLA alerts.
  - **Clinical FDI Odontogram & Anatomical Body Chart (`OdontogramBodyChart.tsx`, `ConsultationPage.tsx`)**: Implemented interactive 32-tooth FDI dental diagram and anatomical body chart with localized Arabic/English clinical finding summary output (`[نتائج الفحص السريري]: ...`). Fixed single-state finding replace/remove logic.
  - **Wasfaty SFDA E-Prescription Builder & Official Print (`EPrescriptionModal.tsx`, `ConsultationPage.tsx`, `schema.sql`)**: Built interactive structured medication table builder directly inside the Prescription Card on `ConsultationPage.tsx` (Trade Name, Dosage, Frequency, Duration, Instructions). Saved `prescriptions_data` JSONB payload in PostgreSQL. Built official Wasfaty SFDA printable e-prescription modal with doctor stamp and verification QR code.
  - **Voice-to-Text Clinical Dictation (`VoiceDictationButton.tsx`, `ConsultationPage.tsx`)**: Built speech-to-text dictation button using Web Speech API supporting Arabic (`ar-SA`) and English (`en-US`) across Consultation Notes, Medication Name, Chief Complaint, Diagnosis, and Medical Record Notes.
  - **Smart Drug-Allergy Warning System (`allergyChecker.ts`, `ConsultationPage.tsx`)**: Built pharmaceutical cross-sensitivity evaluation engine cross-referencing patient allergies against Penicillins, NSAIDs/Aspirin, Sulfa, Opioids/Codeine, and Cephalosporins. Renders live flashing red warning banner upon allergen conflict detection.
  - **Clinic Room & Equipment Allocation Grid (`RoomStatusGrid.tsx`, `roomsController.js`, `rooms.routes.js`, `schema.sql`)**: Built real-time room allocation grid for Rooms 101–501 with status controls (`available`, `occupied`, `cleaning`, `maintenance`) and DB persistence.
  - **NPHIES Insurance Co-Pay Engine (`BillVisitPage.tsx`, `InvoicePage.tsx`, `invoiceCalc.js`, `schema.sql`)**: Implemented insurance provider selection, policy number, approval code, and automated coverage % co-pay split calculator on invoices and tax receipts.
  - **Cashier Shift Reconciliation Z-Report & Dedicated Financial Analytics Page (`CashierZReportModal.tsx`, `FinancialAnalyticsWidget.tsx`, `FinancialAnalyticsPage.tsx`, `billingController.js`)**: Built cashier shift reconciliation Z-Report modal breaking down Cash vs. Card vs. Insurance sales with cashier sign-off lines. Implemented real PostgreSQL backend aggregation endpoint `GET /api/billing/analytics` with `Asia/Riyadh` today date filtering and strict component summation ($\text{Gross} = \text{Cash} + \text{Card} + \text{Insurance}$). Built standalone Financial Analytics Page at `/financial-analytics` with `Sidebar.tsx` navigation item exclusive to SuperAdmin. Restricted financial widgets from general staff dashboards for role confidentiality.
  - **Barcode / QR Fast Check-in (`QuickBarcodeScannerDialog.tsx`, `AdminDashboard.tsx`)**: Implemented scanner dialog with auto-focus listener to scan National ID cards or ticket QR codes for instant patient check-in.
  - **Lobby Touchscreen Self-Service Patient Kiosk (`PatientKioskPage.tsx`, `App.tsx`)**: Built touchscreen tablet kiosk (`/kiosk`) enabling walk-in patients to self-check-in, select department, and issue digital queue tickets.
  - **👨‍⚕️ Treating Doctor Attribution & Shared Vital Signs (`MedicalRecordsTab.tsx`, `RecordDetailPage.tsx`, `MedicalRecord.js`, `medicalRecordsController.js`)**:
    - **Doctor Attribution**: Updated `MedicalRecord.findById` and `medicalRecordsController.js` to execute `LEFT JOIN doctors d ON d.doctor_id = mr.doctor_id`, returning `doctor_name` on medical record cards and detail views.
    - **Patient Vital Signs Display**: Added dedicated **Patient Vital Signs Grid** (Blood Pressure, Heart Rate, Temperature, BMI, Weight, Height) and **Chief Complaint** sections to both `MedicalRecordsTab.tsx` and `RecordDetailPage.tsx` for cross-specialty clinical transparency.
  - **Verification**: Verified compilation via `cd src/frontend && npx tsc -b` (0 errors).

---

## 📑 FYP / PSM 2 System Progress Report Summary (For Academic Documentation)

### Executive Summary
During Sprint 3c, the **Al-Amin Polyclinic Patient Data Management System (PDMS)** underwent a comprehensive architectural and UI/UX overhaul. The system was transformed from a static CRUD application into a state-of-the-art, multi-tenant polyclinic ERP featuring real-time clinical, financial, and operational automation.

### Key Architectural Modules Implemented

1. **🔐 Dynamic Role-Based Access Control (RBAC) & Data Confidentiality**:
   - SuperAdmin (`ROLES.SUPERADMIN`): Exclusive access to live financial revenue analytics (`/financial-analytics`), cashier shift reconciliation (Z-Reports), user management, and system-wide audit logs.
   - Staff / Receptionist (`ROLES.ADMIN`): Operations restricted to walk-in queue management, barcode scanning, patient registration, room allocation, and single-invoice billing (financial totals remain confidential).
   - Doctor (`ROLES.DOCTOR`): Scoped to clinical consultation, Wasfaty SFDA e-prescription builder, interactive FDI dental/body diagramming, and cross-specialty medical record reviews with attending doctor attribution.

2. **📊 Real-Time Financial Analytics & Shift Reconciliation Engine**:
   - **PostgreSQL Backend Endpoint**: `GET /api/billing/analytics` with `Asia/Riyadh` today date filtering (`WHERE vi.created_at::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Riyadh')::date AND status IN ('paid', 'partial')`).
   - **Mathematical Consistency**: Standardized gross revenue aggregation where $\text{Gross Collected} = \text{Cash} + \text{Card} + \text{Insurance Claims}$.
   - **Z-Report Shift Audit**: Cashier shift closing modal with payment method reconciliation and supervisor sign-off.

3. **🩺 Cross-Specialty Clinical Encounter & Attending Doctor Attribution**:
   - Multi-Doctor Patient Records: Shared records across clinics (e.g. Dental + General Medicine) now explicitly display **Attending Doctor Name** (`👨‍⚕️ الطبيب المعالج: د. طارق المنصور`).
   - Shared Vital Signs: Patient vitals (BP, HR, Temp, BMI, Weight, Height) captured during triage are automatically exposed across all doctor consultation views.

4. **💊 Wasfaty SFDA E-Prescriptions & Allergy Safety System**:
   - **Structured E-Prescription Builder**: Interactive medication table storing `prescriptions_data` JSONB payloads in PostgreSQL.
   - **Drug Allergy Warnings**: Automated cross-sensitivity checking for Penicillins, NSAIDs, Sulfa, Opioids, and Cephalosporins.

5. **📄 MOH Seha Certified Sick Leave Report Engine**:
   - **PostgreSQL Table & Endpoints**: `sick_leaves` table with `POST /api/sick-leaves` and `GET /api/sick-leaves/patient/:patientId`.
   - **Real Doctor Session Binding**: Binds `req.rlsSession.doctorId` to fetch the real logged-in physician's name and specialty instead of static placeholder strings. Generates official `SEHA-SL-XXXXXX` verification reference numbers.

6. **🩻 Visual Diagnostic Lab & Radiology Results Portal**:
   - Multi-panel diagnostic viewer for Complete Blood Count (CBC), Lipid Profile, Renal Function, and Chest X-Ray imaging notes with automated reference range badges (`Normal`, `High`, `Critical`) and lab stamp.

7. **🗓️ Interactive Doctor Schedule & 30-Min Time-Slot Grid**:
   - **PostgreSQL Table**: `doctor_schedules` (`schedule_id`, `doctor_id`, `slot_date`, `slot_time`, `status`).
   - 30-minute booking grid (`09:00 AM` – `09:00 PM`) with real-time status badges (`Available`, `Booked`, `Doctor Break`).

8. **🔔 Live Notification Center & Pulsing Red Badge Engine**:
   - **PostgreSQL Table & Dynamic Joins**: `notifications` table + live SQL queries joining `visits`, `patients`, and `doctors` for real-time check-in alerts, wait-time warnings (>20m), and unbilled completed visit notifications.
   - **Optimistic State & Animated Badge**: Animated pulsing red badge (`animate-ping`) displaying unread counts, with instant `0` badge clearing upon clicking "Mark all as read".

9. **🖨️ Universal Client-Side Print & PDF Generation Engine**:
   - **Zero Blank PDF Fix**: Upgraded `index.css` `@media print` rules to strip Radix modal backdrop overlays (`bg-black/80 fixed inset-0`) and expose document targets (`.printable-area`, `#printable-area`, `#invoice-print-area`) for 100% full-page PDF printing.

10. **🔬 Laboratory Information System (LIS) Upload & Sync Architecture Consideration**:
    - **LIS 3-Step Integration Standard**: Documented end-to-end operational workflow for future LIS hardware integrations:
      1. Attending Doctor issues lab order during consultation (`lab_orders` pending state).
      2. Laboratory Technician receives sample, inputs quantitative values / attaches DICOM images, and signs off.
      3. System executes instant status transition to `completed`, triggering automated reference range evaluation (`Normal`, `High`, `Critical`) and live notification to doctor's clinical viewer portal.

