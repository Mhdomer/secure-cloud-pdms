# Full AI Prompt — Build the Specialty Detail Page

> **Purpose**: Hand this entire document to any AI (Claude, Gemini, etc.) so it has complete context to build the feature in one shot.

---

## 🏥 PROJECT CONTEXT

You are working on **Al-Amin Polyclinic** — a medical clinic patient data management system in Riyadh, Saudi Arabia. The frontend is a **React + TypeScript + Vite** application using:

- **Styling**: Tailwind CSS (v4+) with custom brand tokens (`brand-gold-*`, etc.)
- **Animations**: Framer Motion (`motion`, `AnimatePresence`, `useInView`)
- **Routing**: React Router DOM v6 (`BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useParams`)
- **i18n**: react-i18next (namespaced JSON files, `useTranslation('landing')`)
- **UI Components**: Custom shadcn/ui-style components at `@/components/ui/*` (Button, Input, Select, Card, Badge, Dialog, DropdownMenu, Separator, Tabs, etc.)
- **Icons**: Lucide React (`lucide-react`)
- **Path alias**: `@/*` → `./src/*` (defined in `tsconfig.app.json`)
- **Bilingual**: Full Arabic (RTL) and English (LTR) support. Arabic font is set via `rtl:font-arabic` class.

### Directory Structure (relevant files)

```
src/frontend/
├── src/
│   ├── App.tsx                           ← Router config
│   ├── pages/
│   │   └── landing/
│   │       ├── LandingPage.tsx           ← Main landing page (all sections)
│   │       ├── ServicesPage.tsx           ← Standalone /services page
│   │       ├── FacilitiesPage.tsx         ← Standalone /facilities page
│   │       ├── PatientInfoPage.tsx        ← Standalone /patient-info page
│   │       ├── shared.tsx                ← Shared components (LandingNav, LandingFooter, PageHeader, ScrollableCarousel, etc.)
│   │       └── [NEW] SpecialtyDetailPage.tsx  ← YOU WILL CREATE THIS
│   ├── components/
│   │   ├── ui/                           ← Button, Input, Select, Card, Badge, etc.
│   │   └── shared/
│   │       ├── ClinicLogo.tsx
│   │       └── LanguageToggle.tsx
│   ├── hooks/
│   │   └── useLanguage.ts                ← exports { isRtl }
│   ├── lib/
│   │   └── utils.ts                      ← exports cn() (clsx + tailwind-merge)
│   └── locales/
│       ├── en/landing.json               ← English translations
│       └── ar/landing.json               ← Arabic translations
├── public/clinic/                        ← All clinic images
└── tsconfig.app.json                     ← "@/*": ["./src/*"]
```

---

## 🗂️ EXISTING DATA STRUCTURES

### 1. Doctor Data (`LandingPage.tsx` lines 37-92)

```typescript
const REAL_DOCTORS = [
  {
    name: 'د. محمد موسى',
    nameEn: 'Dr. Mohamed Moussa',
    specialty: 'طب عام',
    specialtyEn: 'General Medicine',
    image: '/clinic/dr-mohamed-moussa.jpg',
    position: 'object-[center_15%]',
    experience: '15+ Years Experience',
  },
  {
    name: 'د. أسماء نجم',
    nameEn: 'Dr. Asmaa Najm',
    specialty: 'نساء وتوليد',
    specialtyEn: 'Obstetrics & Gynecology',
    image: '/clinic/dr-asmaa.jpg',
    position: 'object-[center_20%]',
    experience: '12+ Years Experience',
  },
  {
    name: 'د. مصطفى',
    nameEn: 'Dr. Mustafa',
    specialty: 'طب الأطفال',
    specialtyEn: 'Pediatrics',
    image: '/clinic/dr-mustafa.jpg',
    position: 'object-[center_10%]',
    experience: '10+ Years Experience',
  },
  {
    name: 'د. شيماء السيسي',
    nameEn: 'Dr. Shaimaa Al-Sisi',
    specialty: 'الجلدية والتجميل',
    specialtyEn: 'Dermatology & Cosmetology',
    image: '/clinic/dr-shaimaa.jpg',
    position: 'object-[center_15%]',
    experience: '14+ Years Experience',
  },
  {
    name: 'د. أخصائية الجلدية',
    nameEn: 'Dr. Dermatology Specialist',
    specialty: 'الجلدية والليزر',
    specialtyEn: 'Advanced Dermatology & Laser',
    image: '/clinic/dr-dermatology-2.jpg',
    position: 'object-[center_15%]',
    experience: '13+ Years Experience',
  },
  {
    name: 'د. طاقم التخصصات',
    nameEn: 'Dr. Clinical Specialist',
    specialty: 'الفحوصات الشاملة',
    specialtyEn: 'Internal Diagnostics',
    image: '/clinic/dr-doctor-5.jpg',
    position: 'object-[center_15%]',
    experience: '11+ Years Experience',
  },
]
```

### 2. Specialty Images Map (`LandingPage.tsx`)

```typescript
const SPECIALTY_IMAGES: Record<string, string> = {
  dental: '/clinic/spec-dental.png',
  'general-medicine': '/clinic/spec-general-medicine.png',
  laboratory: '/clinic/spec-laboratory.png',
  pediatrics: '/clinic/spec-pediatrics.png',
  dermatology: '/clinic/spec-dermatology.png',
}
```

### 3. i18n Specialty Data (`en/landing.json` lines 97-105)

```json
"specialtyCentres": {
  "heading": "Our Specialty Centres",
  "list": [
    { "key": "dental", "name": "Dentistry" },
    { "key": "general-medicine", "name": "General Medicine" },
    { "key": "laboratory", "name": "Laboratory" },
    { "key": "pediatrics", "name": "Pediatrics" },
    { "key": "dermatology", "name": "Dermatology" }
  ]
}
```

Arabic equivalent (`ar/landing.json` lines 97-105):
```json
"specialtyCentres": {
  "heading": "مراكزنا التخصصية",
  "list": [
    { "key": "dental", "name": "طب الأسنان" },
    { "key": "general-medicine", "name": "الطب العام" },
    { "key": "laboratory", "name": "المختبر" },
    { "key": "pediatrics", "name": "طب الأطفال" },
    { "key": "dermatology", "name": "الجلدية" }
  ]
}
```

### 4. Branch/Facility Data (`en/landing.json` lines 107-114)

```json
"facilities": {
  "list": [
    { "name": "Alamin Medical Complex — Namar", "address": "Dirab Branch Road, Namar, Riyadh 14961, Saudi Arabia" },
    { "name": "Alamin Medical Complex 2 — Dirab", "address": "Dirab Branch Rd, Dirab, Riyadh 14969, Saudi Arabia" }
  ]
}
```

### 5. Contact Data (`en/landing.json`)

```json
"contact": {
  "address": "Dirab Branch Road, Namar, Riyadh 14961, Saudi Arabia",
  "phone": "+966 11 422 2000",
  "hours": "Sat – Thu: 8 AM – 1 PM"
}
```

### 6. Official Social Media Links (`shared.tsx`)

- **Snapchat**: `https://snapchat.com/add/alaminclinic`
- **Facebook**: `https://facebook.com/Alamin-Clinicss`
- **Instagram**: `https://instagram.com/alaminclinic`
- **Twitter / X**: `https://twitter.com/alaminclinic`

### 6. Available Public Images (in `/public/clinic/`)

**Specialty-specific hero/card images**:
- `spec-dental.png`, `spec-general-medicine.png`, `spec-laboratory.png`, `spec-pediatrics.png`, `spec-dermatology.png`

**Additional specialty images (can use for "Best In Industry" right-side photo or "Our Services" banner bg)**:
- `dental.png`, `general-medicine.png`, `laboratory.png`, `pediatrics.png`, `dermatology.png`
- `svc-dentistry.png`, `svc-dermatology.png`
- `real-dental.png`, `real-dermatology.png`, `real-laboratory.png`, `real-pediatrics-2.png`, `real-general-clinic.png`

**Doctor photos**: `dr-mohamed-moussa.jpg`, `dr-asmaa.jpg`, `dr-mustafa.jpg`, `dr-shaimaa.jpg`, `dr-dermatology-2.jpg`, `dr-doctor-5.jpg`

**Facility/hall images**: `main-hall.png`, `main-hall-2.png`, `main-hall-3.png`, `branch-2.png`, `reception.png`, `exam-room.png`, `waiting-area.png`

---

## 🧩 SHARED COMPONENTS YOU MUST REUSE

These are exported from `@/pages/landing/shared`:

| Export | Usage |
|--------|-------|
| `LandingNav` | Top navigation bar with mega-menu, search, logo, lang toggle |
| `LandingFooter` | Site-wide footer (3-column, dark bg) |
| `PageHeader` | Reusable hero banner for standalone pages — `PageHeader({ title, subtitle, image })` |
| `fadeUp` | Framer Motion variant: `{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }` |
| `staggerContainer` | Framer Motion variant: stagger children by 0.09s |
| `ScrollableCarousel` | Auto-advancing horizontal scroll container with prev/next buttons |
| `EMERGENCY_TEL` | `'tel:+966114222000'` |
| `SERVICE_IMAGES` | Map of service keys → image paths |
| `useGoToSection()` | Cross-page anchor navigation back to landing page sections |
| `useScrollOnArrival()` | Scroll-to-section on mount from router state |
| `cn()` | From `@/lib/utils` — clsx + tailwind-merge |

**UI components** from `@/components/ui/*`:
- `Button` (variants: `default`, `outline`, `ghost`, `destructive`; sizes: `sm`, `default`, `lg`)
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Badge`
- `Input`
- `Separator`

---

## 🏗️ EXISTING ROUTING (App.tsx)

```tsx
<Routes>
  <Route path="/" element={<RoleAwareRedirect />} />
  <Route path="/services" element={<ServicesPage />} />
  <Route path="/facilities" element={<FacilitiesPage />} />
  <Route path="/patient-info" element={<PatientInfoPage />} />
  <Route path="/login" element={<LoginPage />} />
  {/* ... protected dashboard routes ... */}
</Routes>
```

**You must add**: `<Route path="/specialties/:slug" element={<SpecialtyDetailPage />} />`

---

## 🎨 DESIGN SYSTEM / BRAND

- **Primary brand color**: `brand-gold` family (gold/amber tones, e.g. `brand-gold-500`, `brand-gold-600`)
- **Backgrounds**: `bg-[#f4f4f2]` (warm off-white), `bg-neutral-900` (dark sections), `bg-white`
- **Accent brown/tan**: `#967d58` (used in specialty nav indicators)
- **Card overlays**: Purple gradient (`from-[#2a0e4d] via-[#3a1563]/85`), Teal gradient (`from-[#003847] via-[#004e63]/80`)
- **Rounded corners**: `rounded-[28px]` to `rounded-[32px]` for feature cards, `rounded-2xl` for standard cards
- **Typography**: `font-black` for large headings, `font-bold`/`font-semibold` for subheadings
- **Shadows**: `shadow-xl shadow-slate-900/5`, `shadow-2xl`

---

## 📋 FULL FEATURE SPECIFICATION

### Route: `/specialties/:slug`

Where `:slug` is one of: `dental`, `general-medicine`, `laboratory`, `pediatrics`, `dermatology`.

The URL slug maps to `specialtyCentres.list[].key` in i18n to get the localized specialty name.

---

### Phase 1: Global Navigation Header

**Reuse `<LandingNav />`** — no changes needed. It already has:
- Al-Amin Clinic logo (top-left)
- Centered search input
- Right-aligned login button, language toggle, hamburger menu

---

### Phase 2: Specialty Hero Section

A full-width hero section at the top of the page.

**Structure**:
- **Background**: The specialty's image from `SPECIALTY_IMAGES[slug]` (e.g. `spec-dental.png`), covering the full width with a dark overlay gradient
- **Breadcrumb**: A back-arrow link at the top-left reading "← Back to Our Speciality Centres" that navigates to `/` and scrolls to the specialty centres section (use `useGoToSection()`)
- **Dynamic Title**: Large, bold white heading with the specialty name from i18n (e.g. "Dentistry" / "طب الأسنان")
- **Branch Selector Dropdown**: Below the title — a `<Select>` component with two options:
  - "Al-Amin Clinic 1 — Namar" (default)
  - "Al-Amin Clinic 2 — Dirab"
  
  Selecting a branch updates the phone number in Phase 3, address in Phase 6 map, etc.

**State**: `const [branch, setBranch] = useState<'namar' | 'dirab'>('namar')` — lifted to page level and passed down.

---

### Phase 3: Quick Info & Learn More Bar

A horizontal bar immediately below the hero. **4-column layout** on desktop, **single-column** on mobile.

| Column | Content |
|--------|---------|
| 1 — Contact | Phone icon + "General Line" label + dynamic phone number based on selected branch. Clickable `tel:` link. |
| 2 — Our Doctors | Stethoscope icon + "Our Doctors" + "Learn More →" link. Anchor-scrolls to Phase 5 doctors section on the same page. |
| 3 — Services | Clipboard/heart icon + "Services" + "Learn More →" link. Navigates to `/services`. |
| 4 — Patient Care | Heart+plus icon + "Patient Care" + "Learn More →" link. Navigates to `/patient-info`. |

**Styling**: Clean white cards with subtle borders, icons in `brand-gold-600`, hover lift effect.

---

### Phase 4a: "Best In Industry" Section

A **left/right split layout** section.

**Left side** (60% width):
- Large heading: "Best In Industry" (or Arabic equivalent)
- Multiple paragraphs of body text describing the clinic's unique approach to this specific specialty
- Final paragraph includes the dynamic branch phone number as a clickable link
- Use placeholder/professional medical text for now

**Right side** (40% width):
- A large, `rounded-3xl` photograph relevant to the specialty
- Use the secondary specialty images (e.g. `dental.png`, `real-dental.png`, etc.)
- Subtle shadow: `shadow-2xl`

---

### Phase 4b: "Our Services" Full-Width Banner

A **full-width banner section** with:

- **Background**: A close-up texture/photograph relevant to the specialty, with a dark gradient overlay
- **Content overlay**: 
  - Heading: "Our Services"
  - Paragraph describing the comprehensive services offered for this specialty
  - A ghost-style "See More" button (`variant="outline"` with white text/border) that navigates to `/services`

---

### Phase 5: "Our Doctors" Card Grid

**Heading row**: "Our Doctors" (bold, left-aligned) + "Learn More →" link (right-aligned, navigates to landing page doctors section)

**Doctor Cards Grid**: 2-3 columns on desktop, 1 on mobile.

**Each card structure**:
- `rounded-2xl` card with subtle `shadow-lg`
- **Top section**: Circular doctor photo (top-left, `w-20 h-20 rounded-full object-cover`), plus name (bold) and sub-specialty below
- **Middle**: Qualifications/experience text, degrees
- **Bottom-left**: Map pin icon + branch location text (e.g. "Al-Amin Clinic 1")
- **Bottom-right**: Two buttons:
  1. Solid `brand-gold` "Contact" button → `tel:` link
  2. Secondary calendar icon button → navigates to `/login` (appointment booking)

**Data filtering**: Filter `REAL_DOCTORS` by matching `specialtyEn` to the current specialty slug. If no match for a given specialty, show all doctors.

**Doctor-to-specialty mapping** (use for filtering):
| Slug | Match `specialtyEn` containing |
|------|-------------------------------|
| `dental` | — (no exact match, show all) |
| `general-medicine` | "General Medicine" |
| `laboratory` | — (show all) |
| `pediatrics` | "Pediatrics" |
| `dermatology` | "Dermatology" |

---

### Phase 6a: Dynamic Location Map

A **full-width section** with an embedded Google Maps iframe.

- **Map iframe**: Use Google Maps embed URL with the branch address as the search query:
  ```
  https://www.google.com/maps/embed/v1/place?key=YOUR_KEY&q={encodeURIComponent(branchAddress)}
  ```
  Or simpler (no API key needed):
  ```
  https://maps.google.com/maps?q={encodeURIComponent(branchAddress)}&output=embed
  ```
- **Map must center on the selected branch** (changes when branch dropdown in Phase 2 is toggled)

- **Overlay info card** (positioned absolute, left-aligned on the map):
  - Rounded white card with:
    - Clinic logo (use `<ClinicLogo />` from `@/components/shared/ClinicLogo`)
    - Branch name (dynamic)
    - Address (dynamic)
    - Phone number (dynamic)
    - Email: `info@alaminclinic.com`
    - Two small icon buttons: Google Maps link + Waze link

---

### Phase 6b: Footer

**Reuse `<LandingFooter />`** — no changes needed for now.

---

## 📝 FILES TO CREATE / MODIFY

### 1. [CREATE] `src/frontend/src/pages/landing/SpecialtyDetailPage.tsx`

The main new file. Structure:

```tsx
// Imports
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
// ... lucide icons, UI components, shared exports

// Branch data
const BRANCHES = { namar: { ... }, dirab: { ... } }

// Specialty-specific secondary images map
const SPECIALTY_HERO_IMAGES = { ... }

// Sub-components
function SpecialtyHero({ slug, specialtyName, branch, onBranchChange }) { ... }
function QuickInfoBar({ branch }) { ... }
function BestInIndustry({ slug, specialtyName, branch }) { ... }
function OurServicesBanner({ slug }) { ... }
function SpecialtyDoctors({ slug, isArabic }) { ... }
function LocationMap({ branch }) { ... }

// Main page
export default function SpecialtyDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [branch, setBranch] = useState<'namar' | 'dirab'>('namar')
  // ... resolve specialty name from i18n
  
  return (
    <div>
      <LandingNav />
      <SpecialtyHero ... />
      <QuickInfoBar ... />
      <BestInIndustry ... />
      <OurServicesBanner ... />
      <SpecialtyDoctors ... />
      <LocationMap ... />
      <LandingFooter />
    </div>
  )
}
```

### 2. [MODIFY] `src/frontend/src/App.tsx`

Add import and route:

```diff
+ import SpecialtyDetailPage from '@/pages/landing/SpecialtyDetailPage'
  ...
  <Route path="/services" element={<ServicesPage />} />
+ <Route path="/specialties/:slug" element={<SpecialtyDetailPage />} />
  <Route path="/facilities" element={<FacilitiesPage />} />
```

### 3. [MODIFY] `src/frontend/src/pages/landing/LandingPage.tsx`

In `SpecialtyCentresSection`, make the main active card clickable to navigate:

```tsx
// Add onClick to the main card div (Card 1):
onClick={() => navigate(`/specialties/${activeKey}`)}
className="... cursor-pointer"

// Add navigate to the function:
const navigate = useNavigate()
```

### 4. [MODIFY] `src/frontend/src/locales/en/landing.json`

Add new `specialtyDetail` key block:

```json
"specialtyDetail": {
  "backLink": "Back to Our Speciality Centres",
  "selectBranch": "Select Branch",
  "generalLine": "General Line",
  "ourDoctors": "Our Doctors",
  "ourDoctorsDesc": "Meet our specialist physicians",
  "services": "Services",
  "servicesDesc": "Comprehensive medical services",
  "patientCare": "Patient Care",
  "patientCareDesc": "Your comfort is our priority",
  "learnMore": "Learn More",
  "bestInIndustry": "Best In Industry",
  "ourServices": "Our Services",
  "ourServicesDesc": "We provide comprehensive services tailored to your needs, delivered by experienced professionals using the latest medical technology.",
  "seeMore": "See More",
  "contact": "Contact",
  "bookAppointment": "Book Appointment",
  "qualifications": "Qualifications",
  "location": "Location",
  "findUs": "Find Us",
  "email": "info@alaminclinic.com",
  "branches": {
    "namar": {
      "name": "Al-Amin Clinic 1 — Namar",
      "phone": "+966 11 422 2000",
      "address": "Dirab Branch Road, Namar, Riyadh 14961, Saudi Arabia"
    },
    "dirab": {
      "name": "Al-Amin Clinic 2 — Dirab",
      "phone": "+966 11 422 2000",
      "address": "Dirab Branch Rd, Dirab, Riyadh 14969, Saudi Arabia"
    }
  },
  "descriptions": {
    "dental": "Our dental centre provides comprehensive oral healthcare services including preventive care, restorative treatments, cosmetic dentistry, and emergency dental services. Our team of experienced dentists uses the latest technology to ensure comfortable and effective treatment for patients of all ages.",
    "general-medicine": "Our general medicine department offers primary healthcare services including routine check-ups, chronic disease management, preventive care, and health screenings. Our physicians take the time to understand your health history and develop personalized care plans.",
    "laboratory": "Our in-house laboratory provides fast, accurate diagnostic testing with results shared directly to your digital health record. We offer a comprehensive range of tests including blood work, urinalysis, and specialized diagnostics.",
    "pediatrics": "Our pediatrics department provides gentle, attentive care for children from newborns through adolescence. Our pediatricians are experienced in childhood development, vaccinations, and managing common childhood illnesses.",
    "dermatology": "Our dermatology centre offers specialized care for skin, hair, and nail conditions. From routine skin checks to advanced laser treatments and cosmetic procedures, our dermatologists provide personalized treatment plans."
  }
}
```

### 5. [MODIFY] `src/frontend/src/locales/ar/landing.json`

Add equivalent Arabic `specialtyDetail` block:

```json
"specialtyDetail": {
  "backLink": "العودة إلى مراكزنا التخصصية",
  "selectBranch": "اختر الفرع",
  "generalLine": "الخط العام",
  "ourDoctors": "أطباؤنا",
  "ourDoctorsDesc": "تعرّف على أطبائنا المتخصصين",
  "services": "الخدمات",
  "servicesDesc": "خدمات طبية شاملة",
  "patientCare": "رعاية المرضى",
  "patientCareDesc": "راحتك أولويتنا",
  "learnMore": "اعرف المزيد",
  "bestInIndustry": "الأفضل في المجال",
  "ourServices": "خدماتنا",
  "ourServicesDesc": "نقدم خدمات شاملة مصممة لتلبية احتياجاتك، يقدمها متخصصون ذوو خبرة باستخدام أحدث التقنيات الطبية.",
  "seeMore": "عرض المزيد",
  "contact": "تواصل",
  "bookAppointment": "احجز موعداً",
  "qualifications": "المؤهلات",
  "location": "الموقع",
  "findUs": "موقعنا",
  "email": "info@alaminclinic.com",
  "branches": {
    "namar": {
      "name": "عيادة الأمين ١ — النمار",
      "phone": "+٩٦٦ ١١ ٤٢٢ ٢٠٠٠",
      "address": "طريق ديراب الفرعي، حي النمار، الرياض ١٤٩٦١"
    },
    "dirab": {
      "name": "عيادة الأمين ٢ — ديراب",
      "phone": "+٩٦٦ ١١ ٤٢٢ ٢٠٠٠",
      "address": "طريق ديراب الفرعي، ديراب، الرياض ١٤٩٦٩"
    }
  },
  "descriptions": {
    "dental": "يقدم مركز طب الأسنان لدينا خدمات رعاية صحية شاملة للفم تشمل الرعاية الوقائية والعلاجات الترميمية وتجميل الأسنان وخدمات طوارئ الأسنان. يستخدم فريقنا من أطباء الأسنان ذوي الخبرة أحدث التقنيات لضمان علاج مريح وفعال للمرضى من جميع الأعمار.",
    "general-medicine": "يقدم قسم الطب العام لدينا خدمات الرعاية الصحية الأولية بما في ذلك الفحوصات الدورية وإدارة الأمراض المزمنة والرعاية الوقائية والفحوصات الصحية. يأخذ أطباؤنا الوقت لفهم تاريخك الصحي ووضع خطط رعاية مخصصة.",
    "laboratory": "يقدم مختبرنا الداخلي فحوصات تشخيصية سريعة ودقيقة مع مشاركة النتائج مباشرة في سجلك الصحي الرقمي. نقدم مجموعة شاملة من الفحوصات تشمل تحاليل الدم والبول والفحوصات المتخصصة.",
    "pediatrics": "يقدم قسم طب الأطفال لدينا رعاية لطيفة ومتأنية للأطفال من حديثي الولادة حتى المراهقة. أطباء الأطفال لدينا ذوو خبرة في نمو الطفل والتطعيمات وإدارة أمراض الطفولة الشائعة.",
    "dermatology": "يقدم مركز الجلدية لدينا رعاية متخصصة لأمراض الجلد والشعر والأظافر. من فحوصات الجلد الروتينية إلى علاجات الليزر المتقدمة والإجراءات التجميلية، يقدم أطباء الجلدية لدينا خطط علاج مخصصة."
  }
}
```

---

## ✅ VERIFICATION

After building, run:

```bash
cd src/frontend && npx tsc -b
```

Must compile with **0 errors**.

Then manually verify:
1. Navigate to `http://localhost:3000/specialties/dental` — all 6 phases render
2. Switch branch dropdown → phone, map, address update
3. Click breadcrumb → navigates back to landing page specialty section
4. Toggle Arabic → RTL layout works correctly
5. Test responsive at 375px, 768px, 1280px widths

---

## ⚠️ CRITICAL RULES

1. **Do NOT modify `shared.tsx`** — only import from it
2. **Use existing UI components** from `@/components/ui/*` — do not create new ones
3. **All text must be i18n-ized** — no hardcoded English or Arabic strings in the TSX
4. **Support RTL** — use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) not `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`
5. **Follow the existing code style** — see `ServicesPage.tsx` and `LandingPage.tsx` for patterns
6. **TypeScript strict mode** — no `any` types, no unused variables
7. **Move `REAL_DOCTORS` to `shared.tsx`** (or import it) so both `LandingPage.tsx` and `SpecialtyDetailPage.tsx` can use it — OR duplicate it in the new file
