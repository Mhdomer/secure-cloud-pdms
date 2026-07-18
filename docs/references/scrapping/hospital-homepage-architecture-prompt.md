# Claude Prompt — Hospital/Clinic Group Homepage (Content Architecture)

Copy-paste the block below into Claude to generate the page. Fill the bracketed placeholders with your own clinic's real content — none of the original site's copy, stats, awards, or articles are included here.

---

## PROMPT

Build a responsive, bilingual-ready (Arabic RTL / English LTR) marketing homepage for a hospital/clinic group, using React + Tailwind CSS. Follow this section order and purpose for each block:

### 1. Header
- Logo, "Contact Us" link, search bar
- Nav links: Services, Medical Facilities, Visitor Guide, Healthcare Providers/Leaders

### 2. Hero stats strip
- 3 headline counters (e.g. `[X] Medical Facilities`, `[X] Pharmacies`, `[X]+ Doctors`) — large numbers, short labels underneath, laid over or beneath a hero image/banner

### 3. "Our Services" section
- Short intro paragraph (1–2 sentences) on tailoring services to patient needs
- 3 service category cards, each with an icon + 2–3 sentence description:
  1. Medical Services (specialties/sub-specialties)
  2. Digital Services (apps, telehealth, online booking)
  3. Pharmacy Services (in-branch + app-based)

### 4. "Award-Winning Achievements" carousel
- Horizontal scroll/carousel of accreditation cards
- Each card: award/certification name, awarding body, which branch/facility earned it, "View Details" link

### 5. "Most Trusted Medical Group" stat band
- 4 large counters in a row: doctors, beds, sub-specialties, accreditations — full-width dark or brand-color band

### 6. "Centers of Excellence" grid
- 3+ cards, each: specialty name (e.g. Cosmetic Surgery, Orthopedics, Ophthalmology), accrediting body badge, 2–3 sentence description of the care offered

### 7. "Facility Network" stats + CTA
- Counters: total medical facilities, medical centers, hospitals coming soon, centers coming soon
- "View All Medical Facilities" button/link

### 8. "Group Solutions" / partner services grid
- Cards for subsidiary or partner services (e.g. diagnostic labs, cloud/tech solutions, workflow solutions, insurance settlements), each with a "Learn More" link

### 9. "Recognitions" carousel
- 3-card carousel: award title, awarding body + year, "View Details" per card, "View All" link at section end

### 10. "Patient Stories" section
- Video/story cards (thumbnail + short title), "All Stories" link

### 11. "Latest News" section
- Dated news cards (date, headline, 1–2 line summary), "All News" link
- *(Do not copy real article bodies — use placeholder headlines/summaries)*

### 12. "Research & Publications" section
- Cards: publish date, paper title, author list, "Download Article" button
- *(Use placeholder citations, not real ones)*

### 13. App download CTA
- "All your health needs in your hands" style banner
- App Store / Google Play / Huawei AppGallery badges

### 14. Policy update banner (optional)
- Slim dismissible bar linking to an updated privacy policy

### 15. Footer
- Tagline + app badges
- 2–3 columns of links: FAQ, Careers, Investor Relations, Academy, Terms of Use, Media Center, News, Sitemap, Patient Rights, Privacy Policy, Contact Us
- Unified contact phone number, bottom bar

### Style notes
- Use a clean healthcare-brand palette (your clinic's own colors, not a copied one)
- RTL support if you want an Arabic version — mirror layout, right-align text, flip icon/arrow directions
- Counters can animate on scroll (count-up effect) for the stats bands
- Cards throughout use consistent rounded corners + soft shadows, carousel sections use snap-scroll

---

*Note: every number, award name, article, and citation in the original page is specific, real content belonging to Dr. Sulaiman Al Habib Medical Group. This prompt only captures the page's structural pattern — replace every placeholder with your own clinic's real facts, or leave as clearly-marked dummy content while you're still building.*
