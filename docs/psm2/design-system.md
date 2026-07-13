# PDMS Design System — Alamin Clinic

## Intent
A professional, calm, and trustworthy medical system. NOT a generic SaaS dashboard.
It should feel like it was built for a specific clinic — warm, Arabic-first, clean.

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `primary-600` | `#0a7272` | Primary actions, links, active states |
| `primary-50` | `#f0fafa` | Hover backgrounds, selected rows |
| `neutral-50` | `#fafaf9` | Page background (warm white, not pure white) |
| `neutral-100` | `#f5f4f2` | Card backgrounds, sidebar |
| `neutral-800` | `#3a3935` | Body text (warm dark, not #000) |
| `neutral-500` | `#8f8a7d` | Secondary/muted text |
| `success-600` | `#16a34a` | Confirmed appointments, active patients |
| `warning-600` | `#d97706` | Pending, awaiting attention |
| `danger-600` | `#dc2626` | Cancelled, errors, critical alerts |

### CSS Variables (set in `src/index.css`)
```css
:root {
  --background: 40 20% 98%;         /* neutral-50 */
  --foreground: 30 8% 23%;          /* neutral-800 */
  --card: 0 0% 100%;
  --card-foreground: 30 8% 23%;
  --muted: 35 15% 95%;              /* neutral-100 */
  --muted-foreground: 30 6% 56%;    /* neutral-500 */
  --primary: 180 83% 25%;           /* primary-600 */
  --primary-foreground: 0 0% 100%;
  --border: 35 12% 88%;             /* neutral-200 */
  --ring: 180 83% 25%;
  --radius: 0.625rem;               /* 10px — not too round, not sharp */
}
```

---

## Typography

### Fonts
- **Latin/English**: `Inter` (loaded from system/CDN — no self-hosting needed)
- **Arabic**: `Thmanyah` → fallback `Noto Sans Arabic` (files in `public/fonts/thmanyah/`)

### Rules (NON-NEGOTIABLE)
- Arabic line-height: **1.7 minimum** — never lower
- Arabic letter-spacing: **0 always** — never use letter-spacing with Arabic
- Arabic body font-size: **17–18px** — 16px looks visually smaller in Arabic script
- Apply `font-family` switch AND `dir="rtl"` together — never one without the other

### Scale
| Element | Size (EN) | Size (AR) | Weight |
|---|---|---|---|
| Page title | 24px | 24px | 600 |
| Section heading | 18px | 18px | 600 |
| Card title | 15px | 16px | 500 |
| Body | 14px | 17px | 400 |
| Label | 12px | 13px | 500 |
| Caption | 11px | 12px | 400 |

---

## Layout

### Sidebar Navigation
- Width: 240px (expanded) / 64px (collapsed)
- Background: `neutral-100`
- Active item: `primary-50` background + `primary-600` left border (4px)
- No heavy shadows — just `border-r border-neutral-200`

### Main Content Area
- Background: `neutral-50`
- Max content width: 1280px
- Padding: 24px (desktop) / 16px (mobile)

### Cards
- Background: white (`#ffffff`)
- Border: `1px solid border` (neutral-200)
- Shadow: `shadow-card` (subtle — 0 1px 3px)
- Hover shadow: `shadow-card-hover`
- Border radius: `rounded-lg` (10px)
- **No heavy drop shadows** — they make it look cheap

---

## Component Patterns

### Patient Row (in tables)
```
[Avatar initials] Name           MRN #        Last visit     Status badge
                  Secondary info  ──────────   ──────────────  [●──────]
```
- Avatar: colored by first letter, not random color, consistent per user
- Status badges: pill shape, colored backgrounds (success/warning/danger)
- Row hover: `bg-primary-50` — not gray, the brand teal tint

### Appointment Card
```
┌─────────────────────────────┐
│ [time]    Dr. Name          │
│ Patient Name                │
│ [Type tag]  [Status badge]  │
└─────────────────────────────┘
```

### Form Inputs
- Height: 40px (standard), 36px (compact)
- Focus ring: `primary-600` 2px — replace the default blue
- Error state: `danger-600` border + red helper text below
- Arabic inputs: `dir="rtl"`, `text-align: right`

---

## What "Real" Looks Like vs AI-Generated

| Real | AI-Generated (avoid) |
|---|---|
| Warm neutral backgrounds | Pure white `#ffffff` or pure gray |
| Subtle teal primary, not blue | Generic `#3B82F6` blue everywhere |
| Inter + Thmanyah fonts | Default system font or generic sans |
| 10px border radius | 4px (too sharp) or 20px (too round) |
| Thin card borders, soft shadow | Heavy `box-shadow: 0 4px 20px rgba` |
| Consistent spacing (8px grid) | Random padding values |
| Empty states with illustration | "No data" text with nothing else |
| Micro-transitions (150ms ease) | No transitions OR jarring 500ms |
| RTL-native — not mirrored | Flipped layout that looks broken |

---

## Screens to Build (Sprint 3b)

1. **Login page** — clinic logo, bilingual toggle, email/password form
2. **Dashboard** — role-aware landing (different for Doctor / Admin / Patient)
3. **Patients list** — search, filter, paginated table
4. **Patient profile** — medical records, appointment history, documents
5. **Appointments** — calendar view + list view, create/reschedule
6. **Medical records** — SOAP notes, prescriptions, lab results
7. **Settings** — profile, language toggle, password change

---

## i18n Keys Structure (`src/locales/`)
```
en/
  common.json    — buttons, labels, status words
  nav.json       — sidebar navigation
  patients.json  — patient management
  appointments.json
  auth.json      — login, logout, error messages

ar/
  (same keys, Arabic values)
```

Default language: determined by browser locale → default `ar` for Saudi clinic context.
