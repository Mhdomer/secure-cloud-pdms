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
| 1 | Login Page | `src/pages/auth/LoginPage.tsx` | Gate passed | 2026-07-17 |
| 2 | Doctor Dashboard | `src/pages/dashboard/DoctorDashboard.tsx` | Gate passed | 2026-07-14 |
| 3 | Staff Dashboard | `src/pages/dashboard/AdminDashboard.tsx` | Gate passed | 2026-07-15 |
| 4 | Patient Dashboard | `src/pages/dashboard/PatientDashboard.tsx` | Gate passed | 2026-07-15 |
| 5 | Superadmin Dashboard | `src/pages/dashboard/SuperAdminDashboard.tsx` | Gate passed | 2026-07-17 |
| 6 | Patient List | `src/pages/patients/PatientLookupPage.tsx` | Gate passed | 2026-07-17 |
| 7 | Patient Profile | `src/pages/patients/PatientProfilePage.tsx` | Gate passed — full rebuild per the expanded Screen 7 spec: sticky header (avatar/name/national ID/age/blood type/always-visible allergy badge, admin-only edit toggle) + role-gated vertical tabs (Medical Records + Lab Results doctor-only; Appointments + Demographics + Invoices doctor+admin; Demographics edit admin-only). Extended `Patient`/`UpdatePatientPayload` types to the full demographic field set the backend already returns. Added `types/invoice.ts`, `types/labResult.ts`, `invoicesApi`/`labResultsApi` (multipart upload + plain `<a download>` file links) to `lib/api.ts`. New tab components under `pages/patients/profile/`. Verified live as both doctor and admin. | 2026-07-17 |
| 8 | Appointments | `src/pages/appointments/AppointmentsPage.tsx` | Gate passed (create/edit dialogs still plain modals, not the slide-in panel `ui-brief.md` describes — follow-up, not blocking) | 2026-07-17 |
| 9 | Medical Records | `src/pages/records/MedicalRecordsPage.tsx` | Gate passed — added a split-pane view (history left/right by RTL, inline note form) for the doctor+patient-context case (`?patientId=`); doctor's own unscoped list and patient's read-only list keep the plain list. Uses the existing flat diagnosis/prescription/notes fields, not the SOAP shape `ui-brief.md` describes — `types/medicalRecord.ts` documents that the backend has no structured SOAP/prescriptions-array model | 2026-07-17 |
| 10 | Record Detail | `src/pages/records/RecordDetailPage.tsx` | Gate passed — replaced the exposed raw record UUID in the header with the created date (existing left-border clinical-field treatment was already reasonable) | 2026-07-17 |
| 11 | Settings | `src/pages/settings/SettingsPage.tsx` | Gate passed (superadmin "Change Display Name" not implemented — no backend endpoint exists yet, out of frontend scope) | 2026-07-17 |
| 12 | User Management | `src/pages/settings/UserManagementPage.tsx` | Gate passed — added `components/ui/sheet.tsx` (new, RTL-aware slide-in) for account creation + a confirm dialog before deactivate/reactivate | 2026-07-17 |
| 13 | Landing Page | `src/pages/landing/LandingPage.tsx` | Gate passed | 2026-07-17 |
| 14 | App Shell / Sidebar | `src/components/layout/` | Gate passed — added bottom-of-sidebar user block (avatar, name, role, logout dropdown) per ui-brief.md, replacing the Topbar's duplicate user menu (Topbar now holds only the language toggle); collapsed state now shows a clinic-initials mark + per-item hover tooltips instead of bare icons with no labels | 2026-07-17 |
| 15 | Password Setup Page (new, public) | `src/pages/auth/SetupPasswordPage.tsx` | Done — built same session as the backend QR flow it depends on (see Backend Edit Sessions below). Manually verified bilingual (AR/EN) end-to-end in-browser (token validate → set password → success → login with new password); formal `/rtl-check` + `/ui-review` not yet run | 2026-07-16 |

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

### Upcoming — QR/password-setup follow-ups (not started)

Raised while reviewing the QR flow above; none of these are blocking, but the QR flow's rollout isn't fully "smooth" without them.

| Item | Type | Why |
|---|---|---|
| Rate limit `POST /api/auth/setup-password` | Backend | It's public/unauthenticated and does a bcrypt hash on every call — cheap CPU-exhaustion target today. Should reuse the `loginLimiter` pattern in `middleware/rateLimiter.js`. |
| SMS delivery of the setup link | Backend (small) | `utils/smsProvider.js` already exists (stubbed, from the UC-19 OTP flow) — reuse it so staff can text the link instead of relying on the patient scanning a QR on the spot. |
| "Pending setup" list for admins | Backend + Frontend | No way today to see which registered patients haven't scanned their QR yet, or whose 72-hour window is about to lapse — staff only finds out reactively when the patient shows up unable to log in. Needs a query (`password_setup_tokens` where `used_at IS NULL`) and a small admin-facing view/badge. |
| Printable QR slip | Frontend | Not every patient scans on the spot; a print-friendly bilingual card (QR + instructions) the patient can take home would reduce round-trips back to the desk. |

Backend session prompt prefix:
```
You are working on the Node.js/Express backend of a clinic PDMS.
Read src/backend/src/config/constants.js for ROLES and other constants.
Read src/backend/src/config/schema.sql for the DB schema.
The app DB user is pdms_app (least-privilege). NEVER use the postgres superuser in app code.
JWT is in an httpOnly cookie. 15-minute expiry. No refresh token in Sprint 3.
```

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
