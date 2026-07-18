# Claude Prompt — Clinic Patient Portal (Sign In / Register / Find a Doctor)

Copy-paste the block below into Claude (or Claude Code) to generate the UI.

---

## PROMPT

Build a responsive patient-portal web UI (React + Tailwind CSS) with two screens that share a split-screen layout: a fixed-width dark sidebar/panel on one side holding the form, and a full-bleed clinical photo on the other side, dimmed with a dark overlay so white text stays readable.

### Global style
- **Palette:**
  - Panel background: `#1E2530` (dark slate navy)
  - Primary accent / buttons: `#7A1F2B` → `#8B1E2B` (deep maroon/burgundy), white text, ~8–10px border radius
  - Input fields: white background, dark text, subtle rounded corners (8–10px), no visible border, soft placeholder gray text
  - Secondary/subtitle text: warm amber (`#D98C4A`-ish) on dark backgrounds for helper text under headings
  - Body/label text on dark background: white/near-white
  - Photo overlay: black at ~55–65% opacity over the background image
- **Typography:** clean sans-serif (Inter/Poppins-style), bold headings (~20–24px), medium-weight field labels (~13px) placed directly above each input, lighter placeholder text inside inputs.
- **Buttons:** full-width, solid maroon, white bold label, rounded, subtle hover-darken state.
- **Links below buttons:** centered, white, medium weight (e.g. "Register", "Go To Sign In") acting as secondary navigation.
- **Footer watermark:** small "Powered by [Company]" logo lockup, bottom corner, low-opacity gray.

### Screen 1 — "Find a Doctor" search + Login modal
Layout: left sidebar (~260px, dark navy) is a **doctor search form**; right side is the dimmed clinic photo. A **centered modal card** floats above the photo for authentication.

**Left sidebar — "Find a Doctor":**
- Heading "Find a Doctor" + thin divider line
- Two radio options: "Search By Project And Clinic" (default selected) / "Search By Clinic"
- Stacked white input fields, each full width with a dropdown chevron where noted:
  1. Hospital Name (dropdown)
  2. Clinic Name (dropdown)
  3. Doctor Name (text)
  4. Nationality (dropdown)
  5. Date (native date picker, `dd/mm/yyyy` placeholder)
  6. Time (native time picker)
- Full-width maroon "Search" button at the bottom

**Center modal — "Login Authentication":**
- Dark semi-transparent rounded card, centered over the photo
- Title "Login Authentication" (bold, white, centered)
- Subtitle "Choose from below options to login to your medical file." (amber, smaller, centered)
- Fields:
  1. "Choose login Type" — dropdown (default: National ID)
  2. "National ID" — text input, placeholder "Please enter your national number"
  3. "Mobile no" — text input, placeholder "05XXXXXXXX"
- Full-width maroon "Sign in" button
- Centered white "Register" text link below the button

### Screen 2 — "Register"
Layout: left dark panel (wider, content vertically centered) holds the registration form; right side is the same dimmed clinic photo.

- Heading "Register" (bold, centered) + subtitle "Please enter mobile number and identification number" (centered, muted)
- Fields:
  1. "Country" — dropdown (default: Saudi Arabia)
  2. Two fields side-by-side: "Country code" (small, non-editable, e.g. `966`) + "Mobile Number" (text input, placeholder "Enter Mobile Number")
  3. "National ID" — text input
  4. "Birth Date" — date picker, placeholder `yyyy-mm-dd`
- Full-width maroon "Register" button
- Centered white "Go To Sign In" text link below the button
- "Powered by [Company]" watermark, bottom-left corner

### Behavior notes
- Modal in Screen 1 should be dismissible / sit on an overlay so the search form behind it is still visible but non-interactive.
- Form validation: required-field states, phone number formatted to local mobile pattern, National ID numeric-only.
- Fully responsive: on narrow viewports, stack the panel above the photo (or hide the photo) and let the form take full width.
- Use semantic HTML form elements (`<select>`, `<input type="date">`, `<input type="time">`) styled to match, rather than custom pickers, unless a component library is specified.

### Suggested stack (adjust as needed)
React + Tailwind CSS, controlled form state via `useState`/`react-hook-form`, routing via `react-router` (`/login`, `/register`, `/find-a-doctor`).

---

*Note: this describes the layout/UX pattern only — colors are approximate hex values, not exact brand values, and you should swap in your own clinic branding, logo, and imagery rather than reusing the original photo or "Cloud Solutions" watermark.*
