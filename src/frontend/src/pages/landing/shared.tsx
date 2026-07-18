import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { ClinicLogo } from '@/components/shared/ClinicLogo'
import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const goToSection = useGoToSection()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navGroups = useNavGroups()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [scrolled])

  const goToItem = (item: NavMenuItem) => {
    if (item.to) navigate(item.to)
    else if (item.sectionId) goToSection(item.sectionId)
  }

  const triggerClass = cn(
    'flex items-center gap-1 text-sm font-medium outline-none transition-colors duration-150 ease-out',
    scrolled ? 'text-neutral-600 hover:text-brand-charcoal' : 'text-white/90 hover:text-white',
  )

  return (
    <header
      className={cn(
        'sticky top-0 z-50 backdrop-blur-md transition-colors duration-150 ease-out',
        scrolled
          ? 'border-b border-border bg-neutral-50/95 shadow-sm'
          : 'border-b border-white/10 bg-neutral-900/55',
      )}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button type="button" onClick={() => navigate('/')} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ClinicLogo light={!scrolled} />
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {navGroups.map((group) => (
            <DropdownMenu key={group.key}>
              <DropdownMenuTrigger className={cn(triggerClass, 'rounded-md px-2.5 py-1.5 data-[state=open]:bg-white/10')}>
                {group.label}
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-150 ease-out data-[state=open]:rotate-180" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className={cn(
                  'grid gap-1 p-3',
                  group.items.length > 4 ? 'w-[38rem] grid-cols-2' : 'w-[22rem] grid-cols-1',
                )}
              >
                {group.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onSelect={() => goToItem(item)}
                    className="group cursor-pointer items-start gap-3 rounded-lg p-2.5 focus:bg-brand-gold/10 focus:text-brand-charcoal data-[highlighted]:bg-brand-gold/10"
                  >
                    <span className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                      <img
                        src={item.image}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                      />
                    </span>
                    <span className="flex flex-col gap-0.5 pt-1">
                      <span className="text-sm font-semibold text-neutral-900">{item.label}</span>
                      <span className="text-xs leading-snug text-neutral-500 line-clamp-2">{item.desc}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageToggle className="hidden sm:inline-flex" />
          <Button
            size="sm"
            className="bg-brand-gold text-white hover:bg-brand-gold-600"
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
              'flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 ease-out md:hidden',
              scrolled ? 'text-neutral-700 hover:bg-neutral-200' : 'text-white hover:bg-white/10',
            )}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

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
