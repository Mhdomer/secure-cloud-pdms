# Alamin PolyClinic — Frontend UI Progress & Change Tracker

> **Purpose**: This living document tracks all frontend UI redesigns, components, brand updates, and pending prompt specs. Every new AI chat session should read this file first to maintain 100% context alignment.

---

## 📌 Active Master Status & Latest Commit

- **Latest Commit**: `a5bcb69` — `feat(landing): redesign landing page UI with KPJ specialty cards, trust section brand card, and social links`
- **Main Landing Page**: `d:\Main_\FYP\PSM 1 SECRH\src\frontend\src\pages\landing\LandingPage.tsx`
- **Shared Landing Components**: `d:\Main_\FYP\PSM 1 SECRH\src\frontend\src\pages\landing\shared.tsx`
- **Current App Brand Name**: **مجمع الأمين الطبي** / **Alamin PolyClinic** (Established 1986)

### 5. Ergonomic Doctor Consultation Workspace Redesign ([ConsultationPage.tsx](file:///d:/Main_/FYP/PSM%201%20SECRH/src/frontend/src/pages/visits/ConsultationPage.tsx))
- **🚫 Zero Text / AI Emojis**: Removed all emoji badges (`⚡`, `📄`, `📱`, `⚡`) and decorative header icons across tab titles and SOAP template chips.
- **🚫 Zero Fake UI Placeholders**: Removed static non-functional lab result viewer buttons/modals.
- **📋 4 Segmented Ergonomic Workspace Tabs**:
  1. **Tab 1: 🩺 Clinical Exam & SOAP**: Patient Vitals strip (BP, HR, Temp, Weight, Height, BMI), Quick Clinical SOAP templates (URI, Dental, Dermatitis), Chief complaint, Physical Exam, and Voice Dictation.
  2. **Tab 2: 💊 E-Prescription & Sick Leave**: Structured Wasfaty / SFDA Medication table builder (initialized empty `[]`), Live Drug Allergy Cross-Sensitivity alert, Official E-Rx Print / Preview, and MOH Seha Sick Leave generator.
  3. **Tab 3: 🦷 Dental & Body Charting**: Interactive Odontogram Tooth Map and Body Charting.
  4. **Tab 4: 📋 Services & Billing**: Procedure selection and invoice quantity editor.
- **🖱️ Clickable Past Medical History Cards**: Made every recent visit item in the left sidebar an interactive button opening `ViewRecordModal` to inspect past diagnosis, SOAP notes, and prescribed medications.
- **📌 Spacious Uncrowded Header**: Added flexible line wrapping, generous padding (`p-5`), and dot separators for patient name, file `#`, age/gender, blood type, and queue ticket `#`.

---

## 🔑 Development Credentials Reference
- Untracked local development credentials file created at [DEV_CREDENTIALS.md](file:///d:/Main_/FYP/PSM%201%20SECRH/DEV_CREDENTIALS.md) (listed in `.gitignore`).

---

## 🚀 Completed UI Overhauls (Chronological Order)

### 1. Hero Section & Video Framing
- **Background Video**: `/clinic/hero-motion.mp4` with `scale-90` framing so the full spinning Alamin PolyClinic logo animation is completely visible without edge cropping.
- **Tagline & CTA**: Multi-language hero text with frosted gold badge and interactive booking button.

### 2. Specialty Centres Section (`SpecialtyCentresSection`) — KPJ Healthcare Inspired
- **Top Header Banner Frame**: High-res desaturated B&W clinical backdrop (`/clinic/canva-waiting-clean.png` with `grayscale opacity-35 contrast-125`).
- **Enclosed Left Navigation Card Box**:
  - Title & vertical list of specialties enclosed in a rounded container (`rounded-[28px] border border-slate-200/80 bg-white shadow-xl p-6 sm:p-8`).
  - Active indicator pill (`bg-[#967d58]/10`) with gold/tan line (`#967d58`).
  - Dedicated **"Learn More →"** action buttons per item pointing to `/specialties/:slug`.
- **Staggered Right Feature Cards**:
  - **Card 1 (Main Active Specialty)**: `h-[520px] rounded-[32px] shadow-2xl bg-[#220d3b] border border-white/20`, full-bleed image transitioning into a **Deep Royal Purple Gradient** (`from-[#2a0e4d] via-[#3a1563]/85`), title, overview, and interactive **"Learn More →"** badge.
  - **Card 2 (Next Teaser Specialty)**: Shifted lower down (`h-[360px] rounded-[28px] shadow-xl bg-[#002f3c] border border-white/20`), full-bleed image transitioning into a **Dark Teal / Cyan Gradient** (`from-[#003847] via-[#004e63]/80`).
- **New Specialty Assets (`/public/clinic/`)**:
  - `spec-dental.png` (Dentistry)
  - `spec-general-medicine.png` (General Medicine)
  - `spec-laboratory.png` (Laboratory)
  - `spec-pediatrics.png` (Pediatrics)
  - `spec-dermatology.png` (Dermatology)

### 3. Trust & Healthcare Standards Section (`TrustSection`)
- **Brand Emblem Watermark**: `brand-emblem-watermark.png` (`Modern Hospital Landing Visuals.png`) rendered as a subtle background watermark (`mix-blend-multiply opacity-25 contrast-300 brightness-75 -start-12 h-[500px]`) behind the text.
- **Right Image Frame**: Full-bleed `brand-card-variant-2.png` inside a `rounded-[36px]` frame with red/amber accent background badge.
- **Pop-Out Floating Stat Cards**:
  - 4 animated stat counters popping out beyond the frame edges with soft drop shadows and dark icon badges:
    - 🩺 **Top-Right**: `Physicians 15+`
    - 🗂️ **Middle-Left**: `Specialties 8`
    - ⏱️ **Bottom-Left**: `Years of Experience 30+`
    - 👥 **Bottom-Right**: `Patients Served 50,000+`
  - Fixed Arabic Indic digit parsing (`٠-٩`) so counters animate smoothly from `0` up to target values in both English (`15+`) and Arabic (`+١٥`).

### 4. Official Social Media Links & Footer
- Added official social media links with custom SVG icons in `LandingFooter` ([shared.tsx](file:///d:/Main_/FYP/PSM%201%20SECRH/src/frontend/src/pages/landing/shared.tsx)):
  - 👻 **Snapchat**: `https://snapchat.com/add/alaminclinic`
  - 📘 **Facebook**: `https://facebook.com/Alamin-Clinicss`
  - 📸 **Instagram**: `https://instagram.com/alaminclinic`
  - 𝕏 **Twitter / X**: `https://twitter.com/alaminclinic`

### 5. Official Operating Hours & Arabic Naming Update
- Updated all clinic name references from **"عيادة الأمين"** to **"مجمع الأمين"** across all locales and backend services.
- Updated emergency availability and working hours from "24/7" to **Daily: 8 AM – 1 AM (Friday: 12 PM – 1 AM)** / **يومياً: ٨ ص – ١ ص (الجمعة: ١٢ ظ – ١ ص)** across all i18n keys and mega-menu cards.

### 6. Polyclinic PDMS Core UI Redesign & Functional Modules (Latest Additions)
- **⚡ Command Palette (`CommandPalette.tsx`)**:
  - Global `Ctrl+K` keyboard shortcut modal with search & jump-to navigation for all roles.
- **📋 Lobby Kanban Board (`LobbyKanbanBoard.tsx`)**:
  - 3-column interactive waiting room board (`Waiting Room` $\rightarrow$ `In Consultation` $\rightarrow$ `Completed`) with live wait-time color alerts.
- **🦷 Odontogram & Body Charting (`OdontogramBodyChart.tsx`)**:
  - Interactive 32-tooth FDI dental diagram & anatomical body chart generating Arabic/English clinical finding summaries.
- **💊 Wasfaty SFDA E-Prescription Builder (`EPrescriptionModal.tsx` & `ConsultationPage.tsx`)**:
  - Interactive structured medication table builder + official Wasfaty SFDA e-prescription printable document.
- **🎙️ Voice-to-Text Clinical Dictation (`VoiceDictationButton.tsx`)**:
  - Native Web Speech API speech-to-text dictation button supporting Arabic (`ar-SA`) and English (`en-US`) across consultation fields.
- **⚠️ Smart Drug-Allergy Warning System (`allergyChecker.ts`)**:
  - Live cross-sensitivity evaluation engine for Penicillins, NSAIDs, Sulfa, Opioids, and Cephalosporins.
- **🚪 Clinic Room Allocation Grid (`RoomStatusGrid.tsx` & `roomsController.js`)**:
  - Real-time room allocation grid for Rooms 101-501 with status controls (`available`, `occupied`, `cleaning`, `maintenance`).
- **🏥 NPHIES Insurance Co-Pay Engine (`BillVisitPage.tsx`, `InvoicePage.tsx`, `invoiceCalc.js`)**:
  - Insurance provider selection, policy number, approval code, and automated coverage % co-pay split on invoices.
- **🧾 Cashier Z-Report Reconciliation (`CashierZReportModal.tsx`)**:
  - Shift reconciliation modal breaking down Cash vs Card vs Insurance co-pay sales.
- **📊 Financial Revenue Analytics Page & Real PostgreSQL Backend (`FinancialAnalyticsPage.tsx`, `FinancialAnalyticsWidget.tsx`, `billingController.js`)**:
  - Dedicated full-page financial dashboard at `/financial-analytics` with sidebar navigation (`Sidebar.tsx`) exclusive to SuperAdmin (`ROLES.SUPERADMIN`).
  - Real PostgreSQL aggregation endpoint `GET /api/billing/analytics` filtered strictly by today's date (`Asia/Riyadh`) where $\text{Gross Revenue} = \text{Cash} + \text{Card} + \text{Insurance}$.
  - Removed financial widgets from general receptionist / staff dashboard (`AdminDashboard.tsx`) for strict role confidentiality.
- **🔍 Barcode / QR Fast Check-in (`QuickBarcodeScannerDialog.tsx`)**:
  - Scanner dialog to scan National ID cards or ticket QR codes for instant patient check-in.
- **👨‍⚕️ Treating Doctor Attribution & Shared Vital Signs (`MedicalRecordsTab.tsx`, `RecordDetailPage.tsx`, `MedicalRecord.js`, `medicalRecordsController.js`)**:
  - Joined `doctors` table in `MedicalRecord.findById` to fetch `d.full_name AS doctor_name`.
  - Added `doctorName` badge (e.g. `👨‍⚕️ الطبيب المعالج: د. طارق المنصور`) on patient medical record history cards and detail views.
  - Added shared Patient Vital Signs grid (BP, HR, Temp, BMI, Weight, Height) and Chief Complaint sections to medical record cards and detail views.
- **📄 Official MOH Seha Medical Certificate & Sick Leave Generator (`SickLeaveModal.tsx`, `sickLeavesController.js`, `sick_leaves` table)**:
  - Ministry of Health (Seha Platform) compliant sick leave report generator backed by PostgreSQL `sick_leaves` table and `POST /api/sick-leaves` REST route. Automatically binds the real logged-in doctor's session context (`req.rlsSession.doctorId`).
- **🩻 Visual Diagnostic Lab & Radiology Results Portal (`LabResultsViewerModal.tsx`, `ConsultationPage.tsx`)**:
  - Interactive lab panel viewer (CBC, Lipid Profile, Renal Function, Chest X-Ray) with automated reference range status badges (`Normal`, `High`, `Critical`).
- **🗓️ Interactive Doctor Schedule & Time-Slot Booking Grid (`DoctorSchedulePicker.tsx`, `doctor_schedules` table)**:
  - Interactive 30-minute time-slot booking grid backed by PostgreSQL `doctor_schedules` table with doctor selection and availability badges (`Available`, `Booked`, `Doctor Break`).
- **🔔 Topbar Notification Center & Live Bell Drawer (`NotificationDrawer.tsx`, `notificationsController.js`, `notifications` table)**:
  - Live topbar notification drawer backed by PostgreSQL queries joining `visits`, `patients`, and `doctors` for real-time lobby arrivals, queue SLA alerts (>20m), and unbilled visit notifications. Features animated pulsing red badge ring (`animate-ping`) and instant optimistic read state clearing.
- **🖨️ Universal Client-Side Print & PDF Generation Engine (`index.css`)**:
  - Fixed empty PDF bug by upgrading `@media print` CSS rules in `index.css` to expose all designated printable document containers (`.printable-area`, `#printable-area`, `#invoice-print-area`) while stripping Radix modal backdrop overlays for 100% full-page PDF printing.
- **🔬 LIS Automated Sync & Lab Tech Upload Workflow Architecture**:
  - Documented 3-step LIS operational standard (Order Creation ➔ Lab Tech Result Input/Attachment ➔ Live System Sync with Reference Range Evaluation).

---

## 📋 Open Feature Specs & Prompts Ready for Execution

### Spec 1: Standalone Specialty Detail Page (`/specialties/:slug`)
- **Prompt Spec Location**: [specialty_detail_page_prompt.md](file:///C:/Users/md3om/.gemini/antigravity-ide/brain/136f4940-96ea-4884-9390-91c469ba8e85/specialty_detail_page_prompt.md)
- **Scope**: Creates `/specialties/:slug` (dental, general-medicine, laboratory, pediatrics, dermatology) with 6 phases:
  1. Global Header (`<LandingNav />`)
  2. Hero with branch selector dropdown (Namar vs Dirab)
  3. Quick Info & Learn More bar
  4. Best In Industry split section & Our Services banner
  5. Specialty Doctors grid filtered by specialty
  6. Dynamic Google Maps embed centered on selected branch + `<LandingFooter />`

### Spec 2: Sidebar Brand Emblem Watermark (`Sidebar.tsx`)
- **Scope**: Adds `brand-emblem-watermark.png` (`mix-blend-multiply opacity-[0.08]`) to the lower background of the authenticated App Shell Sidebar (`Sidebar.tsx`), scaling smoothly between expanded (`w-60`) and collapsed (`w-16`) states.

---

## 🛠️ Available Slash Commands & Tools

When working in AI chats (Gemini 3.5 / Claude / Antigravity AI), you can invoke these checkers:
- `/ui-review` — Performs a comprehensive medical UI/UX audit on any component.
- `/rtl-check` — Audits Arabic RTL mirroring, logical properties, and font rendering.
- `/font-audit` — Audits Thmanyah/Tajawal font usage, line-height 1.7+, and letter-spacing.
- `/i18n-check` — Verifies missing translation keys between `en/*.json` and `ar/*.json`.
- `/grill-me` — Launches an interactive design review interview before major overhauls.

---

## 🛡️ AI Model Guidelines & Code Quality Standards (Gemini 3.5 & AI Assistants)

Every AI assistant (Gemini 3.5, Claude, or Antigravity AI) working on this codebase **MUST** follow these strict principles:

1. **Automated Build Verification**:
   - After modifying code in `src/frontend`, ALWAYS verify the build by running:
     ```bash
     cd src/frontend && npx tsc -b
     ```
   - Target: **0 compilation errors**. Never leave a turn with broken TypeScript builds.

2. **Clean Code & Type Safety**:
   - Maintain strict TypeScript typing (`no any`).
   - Keep components modular, readable, and properly formatted.
   - Zero hardcoded English/Arabic text in JSX — always use `useTranslation()` keys from `src/locales/en/*.json` and `src/locales/ar/*.json`.

3. **Strict RTL & Localization Rules**:
   - Always use CSS logical spacing properties: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-` (NEVER use `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`).
   - Ensure the Arabic font family (`rtl:font-arabic`) is preserved.

4. **Premium Design System & Aesthetics**:
   - Use curated brand tokens (`brand-gold-500`, `brand-gold-600`, `slate-900`, `bg-[#f4f4f2]`).
   - Implement modern glassmorphism (`backdrop-blur-md bg-white/95 border border-white/80 shadow-2xl`).
   - Use real clinic assets from `/public/clinic/` (never plain placeholder images).

