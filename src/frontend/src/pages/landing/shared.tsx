import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { ClinicLogo } from '@/components/shared/ClinicLogo'
import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'

export const EMERGENCY_TEL = 'tel:+966114222000'

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09 },
  },
}

/**
 * Landing-page-only placeholder for a doctor's photo — deterministic (same
 * name always gets the same emoji, per the site's "never random" avatar
 * rule) but NOT the shared `lib/avatar.ts` initials system used inside the
 * authenticated app, since that one is a fixed signature element elsewhere.
 * Swap for real staff photos once available (see report-delta.md).
 */
const DOCTOR_EMOJIS = ['🩺', '👨‍⚕️', '👩‍⚕️', '⚕️']
export function doctorEmojiFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return DOCTOR_EMOJIS[Math.abs(hash) % DOCTOR_EMOJIS.length]
}

export const SERVICE_IMAGES = {
  generalMedicine: '/clinic/general-medicine.png',
  pediatrics: '/clinic/pediatrics.png',
  internalMedicine: '/clinic/reception.png',
  dental: '/clinic/dental.png',
  dermatology: '/clinic/dermatology.png',
  laboratory: '/clinic/laboratory.png',
  digitalRecords: '/clinic/exam-room.png',
  preventiveCare: '/clinic/waiting-area.png',
} as const

export interface Doctor {
  name: string
  nameEn: string
  specialty: string
  specialtyEn: string
  image: string
  position: string
  experience: string
}

export const REAL_DOCTORS: Doctor[] = [
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

export const SPECIALTY_IMAGES: Record<string, string> = {
  dental: '/clinic/spec-dental.png',
  'general-medicine': '/clinic/spec-general-medicine.png',
  laboratory: '/clinic/spec-laboratory.png',
  pediatrics: '/clinic/spec-pediatrics.png',
  dermatology: '/clinic/spec-dermatology.png',
}

export const FACILITY_IMAGES = ['/clinic/main-hall.png', '/clinic/branch-2.png']

/** Anchors that only exist on the landing page (`/`). Called from any page —
 * if we're already on `/` it just scrolls; from elsewhere it navigates home
 * and asks `LandingPage` (via router state) to scroll once it mounts. */
export function useGoToSection() {
  const navigate = useNavigate()
  const location = useLocation()

  return (id: string) => {
    if (location.pathname === '/') {
      scrollToId(id)
    } else {
      navigate('/', { state: { scrollTo: id } })
    }
  }
}

/** Pairs with `useGoToSection`: reads the `scrollTo` id left in router state
 * by a cross-page nav click and scrolls to it once the landing page has
 * painted, then clears the state so it doesn't re-fire on back/forward. */
export function useScrollOnArrival() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const targetId = (location.state as { scrollTo?: string } | null)?.scrollTo
    if (!targetId) return
    const timeout = setTimeout(() => scrollToId(targetId), 80)
    navigate('.', { replace: true, state: {} })
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** For standalone pages reached via a `#hash` mega-menu link (e.g.
 * `/facilities#pharmacy`) — scrolls to that section once mounted. */
export function useScrollToHash() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const timeout = setTimeout(() => scrollToId(id), 80)
    return () => clearTimeout(timeout)
  }, [location.hash])
}

interface NavMenuItem {
  label: string
  desc: string
  image: string
  /** Route to navigate to (may include a `#hash` the target page scrolls to on mount). */
  to?: string
  /** Anchor id that only exists on the landing page — routed via `useGoToSection`. */
  sectionId?: string
}

interface NavMenuGroup {
  key: string
  label: string
  items: NavMenuItem[]
}

function useNavGroups(): NavMenuGroup[] {
  const { t } = useTranslation('landing')
  const serviceKeys = Object.keys(SERVICE_IMAGES) as Array<keyof typeof SERVICE_IMAGES>

  return [
    {
      key: 'about',
      label: t('nav.about'),
      items: [
        { label: t('nav.ourStory'), desc: t('nav.ourStoryDesc'), image: '/clinic/main-hall-3.png', sectionId: 'trust' },
        { label: t('nav.howItWorks'), desc: t('nav.howItWorksDesc'), image: '/clinic/reception.png', sectionId: 'how-it-works' },
        { label: t('nav.ourDoctors'), desc: t('nav.ourDoctorsDesc'), image: '/clinic/exam-room.png', sectionId: 'doctors' },
      ],
    },
    {
      key: 'services',
      label: t('nav.services'),
      items: serviceKeys.map((key) => ({
        label: t(`services.${key}.title`),
        desc: t(`services.${key}.desc`),
        image: SERVICE_IMAGES[key],
        to: '/services',
      })),
    },
    {
      key: 'facilities',
      label: t('nav.facilities'),
      items: [
        { label: t('nav.ourBranches'), desc: t('nav.ourBranchesDesc'), image: FACILITY_IMAGES[0], to: '/facilities' },
        { label: t('nav.pharmacy'), desc: t('nav.pharmacyDesc'), image: '/clinic/pharmacy.png', to: '/facilities#pharmacy' },
      ],
    },
    {
      key: 'patientVisitor',
      label: t('nav.patientVisitor'),
      items: [
        { label: t('nav.patientInfo'), desc: t('nav.patientInfoDesc'), image: '/clinic/patient-visual.jpg', to: '/patient-info' },
        { label: t('nav.faq'), desc: t('nav.faqDesc'), image: '/clinic/clinic-sections.png', to: '/patient-info#faq' },
        { label: t('nav.contactUs'), desc: t('nav.contactUsDesc'), image: '/clinic/main-hall-2.png', sectionId: 'contact' },
      ],
    },
  ]
}

export function LandingNav() {
  const { t, i18n } = useTranslation('landing')
  const navigate = useNavigate()
  const goToSection = useGoToSection()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const navGroups = useNavGroups()
  const isArabic = i18n.language === 'ar'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [scrolled])

  const handleMouseEnterGroup = (groupKey: string) => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
    setActiveGroupKey(groupKey)
  }

  const handleMouseLeaveNav = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setActiveGroupKey(null)
    }, 200)
  }

  const goToItem = (item: NavMenuItem) => {
    setActiveGroupKey(null)
    if (item.to) navigate(item.to)
    else if (item.sectionId) goToSection(item.sectionId)
  }

  const activeGroup = navGroups.find((g) => g.key === activeGroupKey)

  const triggerClass = (groupKey: string) =>
    cn(
      'relative flex items-center gap-1.5 text-sm font-bold outline-none transition-all duration-200 ease-out rounded-full px-4 py-2 cursor-pointer',
      activeGroupKey === groupKey
        ? 'bg-brand-gold-500/20 text-brand-gold-600 shadow-sm'
        : scrolled
        ? 'text-neutral-700 hover:text-brand-gold-700 hover:bg-neutral-100'
        : 'text-white/90 hover:text-white hover:bg-white/15',
    )

  return (
    <header
      onMouseLeave={handleMouseLeaveNav}
      className={cn(
        'sticky top-0 z-50 transition-all duration-300 ease-out backdrop-blur-2xl',
        scrolled
          ? 'border-b border-neutral-200/80 bg-white/90 shadow-md shadow-neutral-900/5'
          : 'border-b border-white/15 bg-neutral-950/75 shadow-2xl shadow-black/40',
      )}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring transition-transform hover:scale-105"
        >
          <ClinicLogo light={!scrolled} />
        </button>

        {/* Liquid Glass Navigation Menu Header Triggers */}
        <nav className="hidden items-center gap-1.5 md:flex">
          {navGroups.map((group) => (
            <div
              key={group.key}
              onMouseEnter={() => handleMouseEnterGroup(group.key)}
              className="relative"
            >
              <button
                type="button"
                onClick={() => handleMouseEnterGroup(group.key)}
                className={triggerClass(group.key)}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-300 ease-out',
                    activeGroupKey === group.key && 'rotate-180 text-brand-gold-500',
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle className="hidden sm:inline-flex" />
          <Button
            size="sm"
            className="rounded-full bg-gradient-to-r from-brand-gold-500 via-amber-500 to-brand-gold-600 px-5 text-neutral-950 font-bold shadow-md shadow-brand-gold-500/20 hover:shadow-lg hover:shadow-brand-gold-500/40 hover:scale-105 transition-all"
            onClick={() => navigate('/login')}
          >
            {t('nav.login')}
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={t('nav.menu')}
            aria-expanded={mobileOpen}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ease-out md:hidden',
              scrolled ? 'text-neutral-800 hover:bg-neutral-100' : 'text-white hover:bg-white/10',
            )}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Modern Liquid Glass Mega-Menu Panel */}
      <AnimatePresence>
        {activeGroup && (
          <motion.div
            key={activeGroup.key}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onMouseEnter={() => handleMouseEnterGroup(activeGroup.key)}
            className="absolute inset-x-0 top-full z-50 px-4 pt-2 pb-6 sm:px-6"
          >
            <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-6 backdrop-blur-3xl shadow-2xl shadow-neutral-900/20 text-neutral-900">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_260px] lg:grid-cols-[1fr_300px]">
                {/* Left Side: Interactive Items Grid */}
                <div>
                  <div className="mb-4 flex items-center justify-between border-b border-neutral-200/80 pb-3">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-brand-gold-700">
                      {activeGroup.label}
                    </span>
                    <span className="text-xs font-semibold text-neutral-400">
                      {isArabic ? 'اختر للذهاب مباشرة' : 'Select to navigate directly'}
                    </span>
                  </div>

                  <div
                    className={cn(
                      'grid gap-3',
                      activeGroup.items.length > 3
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2',
                    )}
                  >
                    {activeGroup.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => goToItem(item)}
                        className="group flex items-start gap-3.5 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-3 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-gold-500/40 hover:bg-amber-50/70 hover:shadow-md hover:shadow-brand-gold-500/10"
                      >
                        <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-white/80 shadow-sm">
                          <img
                            src={item.image}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-115"
                          />
                        </span>
                        <span className="flex flex-col gap-0.5 pt-0.5 min-w-0 flex-1">
                          <span className="text-sm font-bold text-neutral-900 group-hover:text-brand-gold-700 transition-colors flex items-center justify-between">
                            <span className="truncate">{item.label}</span>
                            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-all text-brand-gold-600 shrink-0 rtl:rotate-180" />
                          </span>
                          <span className="text-xs leading-relaxed text-neutral-500 line-clamp-2 font-medium">
                            {item.desc}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Side: Featured Highlight Banner Card */}
                <div className="flex flex-col overflow-hidden rounded-2xl border border-brand-gold-500/30 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-5 text-white shadow-xl">
                  <div className="relative h-28 w-full overflow-hidden rounded-xl border border-white/10 mb-4">
                    <img
                      src="/clinic/canva-services-collage.png"
                      alt="Featured Center"
                      className="h-full w-full object-cover filter brightness-95"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent" />
                    <span className="absolute bottom-2 start-2 rounded-md bg-brand-gold-500 px-2 py-0.5 text-[10px] font-bold text-neutral-950 uppercase tracking-wider">
                      {isArabic ? 'خدمة متميزة' : 'Featured Center'}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">
                    {isArabic ? 'عيادات تخصصية متكاملة' : 'Specialized PolyClinic Units'}
                  </h4>
                  <p className="mt-1 text-xs text-neutral-300 leading-relaxed font-medium">
                    {isArabic
                      ? 'نوفر لك أفضل الاستشاريين والتجهيزات الطبية الحديثة من 8 ص حتى 1 ص'
                      : 'Equipped with state-of-the-art diagnostic suites and expert consultants (8 AM – 1 AM)'}
                  </p>

                  <Button
                    size="sm"
                    className="mt-4 rounded-xl bg-brand-gold-500 text-neutral-950 font-bold hover:bg-brand-gold-400 transition-all text-xs"
                    onClick={() => {
                      setActiveGroupKey(null)
                      navigate('/login')
                    }}
                  >
                    {isArabic ? 'احجز موعدك الآن' : 'Book Appointment Now'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="max-h-[calc(100vh-5rem)] overflow-y-auto overflow-x-hidden border-t border-border bg-white md:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
              <LanguageToggle className="self-start sm:hidden" />
              {navGroups.map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{group.label}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          goToItem(item)
                          setMobileOpen(false)
                        }}
                        className="flex flex-col items-stretch gap-1 rounded-md text-start transition-opacity duration-150 ease-out active:opacity-70"
                      >
                        <span className="aspect-[4/3] w-full overflow-hidden rounded-md">
                          <img src={item.image} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                        </span>
                        <span className="text-xs font-medium leading-snug text-neutral-700">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

const SOCIAL_LINKS = [
  {
    name: 'Snapchat',
    href: 'https://snapchat.com/add/alaminclinic',
    icon: (
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
        <path d="M12 2.75c-3.1 0-5.25 2.1-5.25 4.5 0 .8.2 1.6.45 2.2-.6.1-1.35.45-1.5 1.05-.1.45.1.85.45 1.15.15.1.2.25.1.4-.4.8-1.55 1.85-2.6 1.75-.4 0-.75.25-.85.6-.1.4.15.8.5 1 .95.55 2.15 1.3 2.1 2.3 0 .2-.1.4-.3.45-1.1.35-1.95 1.1-1.7 2.1.2 1 .95 1.1 1.75 1.15.8.05 1.6-.2 2.25.5.75.8 2.3 1.35 4.6 1.35s3.85-.55 4.6-1.35c.65-.7 1.45-.45 2.25-.5.8-.05 1.55-.15 1.75-1.15.25-1-.6-1.75-1.7-2.1-.2-.05-.3-.25-.3-.45-.05-1 1.15-1.75 2.1-2.3.35-.2.6-.6.5-1-.1-.35-.45-.6-.85-.6-1.05.1-2.2-.95-2.6-1.75-.1-.15-.05-.3.1-.4.35-.3.55-.7.45-1.15-.15-.6-.9-.95-1.5-1.05.25-.6.45-1.4.45-2.2 0-2.4-2.15-4.5-5.25-4.5z" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com/Alamin-Clinicss',
    icon: (
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7.5v-3H10V9.69c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 3h-2.33v6.8c4.56-.93 8-4.96 8-9.8z" />
      </svg>
    ),
  },
  {
    name: 'Instagram',
    href: 'https://instagram.com/alaminclinic',
    icon: (
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/alaminclinic',
    icon: (
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
]

export function LandingFooter() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const goToSection = useGoToSection()

  return (
    <footer className="bg-neutral-900 px-4 pt-16 text-neutral-400 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 pb-10 sm:grid-cols-3">
        <div>
          <ClinicLogo light className="mb-4" />
          <p>{t('footer.about')}</p>
          <div className="mt-6 flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 transition-all duration-200 hover:bg-brand-gold-500 hover:text-neutral-950 hover:scale-110 shadow-sm"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">{t('footer.quickLinksHeading')}</h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <button type="button" onClick={() => navigate('/')} className="transition-colors duration-150 ease-out hover:text-white">
                {t('footer.home')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/services')} className="transition-colors duration-150 ease-out hover:text-white">
                {t('footer.servicesLink')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => goToSection('doctors')} className="transition-colors duration-150 ease-out hover:text-white">
                {t('footer.doctorsLink')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/facilities')} className="transition-colors duration-150 ease-out hover:text-white">
                {t('footer.locationsLink')}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => goToSection('contact')} className="transition-colors duration-150 ease-out hover:text-white">
                {t('footer.contactLink')}
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">{t('footer.contactHeading')}</h3>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>{t('contact.address')}</li>
            <li dir="auto">{t('contact.phone')}</li>
            <li>{t('contact.hours')}</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-neutral-800 py-6 text-sm sm:flex-row">
        <span>{t('footer.rights')}</span>
        <div className="flex items-center gap-6">
          <a href="#" className="transition-colors duration-150 ease-out hover:text-white">
            {t('footer.privacy')}
          </a>
          <a href="#" className="transition-colors duration-150 ease-out hover:text-white">
            {t('footer.terms')}
          </a>
        </div>
      </div>
    </footer>
  )
}

/** Reusable banner for standalone pages (`/services`, `/facilities`,
 * `/patient-info`) — gives each its own identity instead of feeling like an
 * orphaned fragment cut out of the landing page. */
export function PageHeader({ title, subtitle, image }: { title: string; subtitle: string; image: string }) {
  return (
    <section className="relative flex min-h-[46vh] items-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={image} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-neutral-900/65" />
      </div>
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">{subtitle}</p>
      </div>
    </section>
  )
}

/**
 * A "moving trail" row that also genuinely responds to the visitor — this is
 * a real `overflow-x-auto` scroll container (drag/swipe/wheel all work
 * natively and instantly, nothing is fighting the browser's own scrolling),
 * with a `setInterval` nudging it forward every few seconds so it never just
 * sits still. Auto-advance pauses the moment the visitor touches it and
 * resumes a few seconds after they let go. Cards should include `snap-center`
 * in their own className for the scroll-snap alignment to apply.
 */
export function ScrollableCarousel({
  children,
  prevLabel,
  nextLabel,
  intervalMs = 3200,
}: {
  children: ReactNode
  prevLabel: string
  nextLabel: string
  intervalMs?: number
}) {
  const { isRtl } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const id = setInterval(() => {
      const el = containerRef.current
      if (!el || pausedRef.current) return
      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 4) return
      const current = Math.abs(el.scrollLeft)
      const remaining = maxScroll - current
      if (remaining <= 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        const dir = isRtl ? -1 : 1
        const amount = Math.min(320, remaining)
        el.scrollBy({ left: dir * amount, behavior: 'smooth' })
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [isRtl, intervalMs])

  const pause = () => {
    pausedRef.current = true
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
  }
  const scheduleResume = (delayMs: number) => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => {
      pausedRef.current = false
    }, delayMs)
  }

  const stepManually = (dir: 1 | -1) => {
    const el = containerRef.current
    if (!el) return
    pause()
    el.scrollBy({ left: dir * el.clientWidth * 0.85 * (isRtl ? -1 : 1), behavior: 'smooth' })
    scheduleResume(3000)
  }

  return (
    <div className="group/row relative">
      <div
        ref={containerRef}
        onMouseEnter={pause}
        onMouseLeave={() => scheduleResume(0)}
        onPointerDown={pause}
        onPointerUp={() => scheduleResume(3000)}
        onTouchStart={pause}
        onTouchEnd={() => scheduleResume(3000)}
        onWheel={() => {
          pause()
          scheduleResume(1500)
        }}
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => stepManually(-1)}
        aria-label={prevLabel}
        className="absolute start-1 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 opacity-0 shadow-card-hover transition-opacity duration-150 ease-out hover:text-brand-gold-600 focus-visible:opacity-100 group-hover/row:opacity-100 sm:flex"
      >
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => stepManually(1)}
        aria-label={nextLabel}
        className="absolute end-1 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 opacity-0 shadow-card-hover transition-opacity duration-150 ease-out hover:text-brand-gold-600 focus-visible:opacity-100 group-hover/row:opacity-100 sm:flex"
      >
        <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
      </button>
    </div>
  )
}
