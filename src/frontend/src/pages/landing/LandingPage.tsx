import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { motion, useInView, type Variants } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  LayoutGrid,
  MapPin,
  Phone,
  Search,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { avatarClassesFor } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import {
  doctorEmojiFor,
  EMERGENCY_TEL,
  fadeUp,
  LandingFooter,
  LandingNav,
  ScrollableCarousel,
  SERVICE_IMAGES,
  staggerContainer,
  useScrollOnArrival,
} from '@/pages/landing/shared'

/**
 * Public marketing homepage shown at `/` to anyone who isn't signed in.
 * Kept intentionally short — a "who we are, what we do" overview — with
 * Services, Medical Facilities, and Patient & Visitor content living on
 * their own pages (reached via the nav mega-menu) instead of an ever-longer
 * scroll. See docs/psm2/report-delta.md DELTA-016.
 */
export default function LandingPage() {
  useScrollOnArrival()

  return (
    <div className="min-h-screen bg-neutral-50">
      <LandingNav />
      <HeroSection />
      <QuickAccessSection />
      <TrustSection />
      <OfferingsTeaserSection />
      <DoctorsSection />
      <TestimonialsSection />
      <EmergencyBanner />
      <HowItWorksSection />
      <ContactSection />
      <LandingFooter />
    </div>
  )
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function HeroSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    toast.info(t('hero.searchToast'))
    setSearchValue('')
  }

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/clinic/main-hall.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-neutral-900/60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 mx-auto max-w-3xl px-6 text-center"
      >
        <p lang="ar" dir="rtl" className="text-3xl font-bold text-brand-gold-300">
          مجمع الأمين الطبي
        </p>
        <p lang="en" dir="ltr" className="mt-1 text-lg text-white/70">
          Alamin PolyClinic
        </p>

        <h1 className="mt-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
          {t('hero.tagline')}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-white/80">{t('hero.subtext')}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="bg-brand-gold text-neutral-900 font-semibold hover:bg-brand-gold-400"
            onClick={() => navigate('/login')}
          >
            {t('hero.cta')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white/10"
            onClick={() => navigate('/services')}
          >
            {t('hero.ctaSecondary')}
          </Button>
        </div>

        <form onSubmit={handleSearch} className="relative mx-auto mt-6 max-w-lg">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t('hero.searchPlaceholder')}
            aria-label={t('hero.searchPlaceholder')}
            className="h-12 border-white/30 bg-white/10 ps-10 text-white placeholder:text-white/60 focus-visible:ring-white/50"
          />
        </form>
      </motion.div>

      <motion.button
        type="button"
        onClick={() => scrollToId('trust')}
        aria-label={t('hero.ctaSecondary')}
        className="absolute inset-x-0 bottom-20 z-10 mx-auto flex w-fit text-white/50 transition-colors duration-150 ease-out hover:text-white"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="h-8 w-8" aria-hidden="true" />
      </motion.button>
    </section>
  )
}

function QuickAccessSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()

  const items: Array<{
    key: 'book' | 'findDoctor' | 'emergency' | 'departments'
    icon: ComponentType<{ className?: string }>
    href?: string
    onClick?: () => void
  }> = [
    { key: 'book', icon: Calendar, onClick: () => navigate('/login') },
    { key: 'findDoctor', icon: Users, onClick: () => scrollToId('doctors') },
    { key: 'emergency', icon: Phone, href: EMERGENCY_TEL },
    { key: 'departments', icon: LayoutGrid, onClick: () => navigate('/services') },
  ]

  return (
    <section className="relative z-20 -mt-8 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-4 shadow-modal sm:p-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={staggerContainer}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {items.map((item) => {
            const cardClass =
              'flex w-full flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors duration-150 ease-out hover:bg-brand-gold/5 sm:p-4'
            const content = (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/10">
                  <item.icon className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-neutral-900">
                  {t(`quickAccess.${item.key}.title`)}
                </span>
                <span className="text-xs text-neutral-500">{t(`quickAccess.${item.key}.desc`)}</span>
              </>
            )

            return (
              <motion.div key={item.key} variants={fadeUp} transition={{ duration: 0.4 }}>
                {item.href ? (
                  <a href={item.href} className={cardClass}>
                    {content}
                  </a>
                ) : (
                  <button type="button" onClick={item.onClick} className={cardClass}>
                    {content}
                  </button>
                )}
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

/** Parses a localized numeric stat string ("15+", "+٥٠٬٠٠٠"…) down to a plain
 * integer so it can be counted up from zero. Arabic-Indic digits are mapped
 * to their Western equivalents first since `parseInt` doesn't read them. */
function parseStatTarget(value: string): number {
  const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩'
  const normalized = value.replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
  const digitsOnly = normalized.replace(/[^0-9]/g, '')
  return digitsOnly ? parseInt(digitsOnly, 10) : 0
}

interface CountUpStatProps {
  value: string
  label: string
  icon: ComponentType<{ className?: string }>
}

function CountUpStat({ value, label, icon: Icon }: CountUpStatProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isInView) return

    const target = parseStatTarget(value)
    const durationMs = 1500
    const stepMs = 30
    const totalSteps = Math.max(1, Math.round(durationMs / stepMs))
    let currentStep = 0

    const interval = setInterval(() => {
      currentStep += 1
      const progress = Math.min(currentStep / totalSteps, 1)
      setCount(Math.round(target * progress))
      if (progress >= 1) {
        clearInterval(interval)
        setDone(true)
      }
    }, stepMs)

    return () => clearInterval(interval)
  }, [isInView, value])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5 }}
      className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm text-brand-gold-700">{label}</span>
        <span className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          {done ? value : count}
        </span>
      </div>
      <Icon className="h-10 w-10 shrink-0 text-neutral-200" aria-hidden="true" />
    </motion.div>
  )
}

function TrustSection() {
  const { t } = useTranslation('landing')

  return (
    <section id="trust" className="relative overflow-hidden px-4 pb-20 pt-24 sm:px-6 lg:pt-28">
      <div className="absolute inset-0">
        <img src="/clinic/main-hall-3.png" alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-brand-charcoal/90" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t('trust.heading')}</h2>
          <p className="mt-5 max-w-md text-white/70">{t('trust.description')}</p>
          <Button
            size="lg"
            className="mt-8 rounded-full bg-white text-brand-charcoal hover:bg-white/90"
            onClick={() => scrollToId('contact')}
          >
            {t('trust.cta')}
          </Button>
        </motion.div>

        <div className="rounded-3xl bg-white/5 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <CountUpStat icon={Stethoscope} value={t('trust.physicians.value')} label={t('trust.physicians.label')} />
            <CountUpStat icon={Clock} value={t('trust.experience.value')} label={t('trust.experience.label')} />
            <CountUpStat icon={Users} value={t('trust.patients.value')} label={t('trust.patients.label')} />
            <CountUpStat icon={LayoutGrid} value={t('trust.specialties.value')} label={t('trust.specialties.label')} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Condensed "what we offer" preview — replaces a full in-page Services grid
 * with 3 hover-lift cards that route out to their own pages, keeping the
 * landing page short instead of an ever-longer scroll. */
const SPECIALTY_PREVIEW: Array<keyof typeof SERVICE_IMAGES> = ['generalMedicine', 'dental', 'laboratory', 'dermatology']

function OfferingsTeaserSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()

  const offerings: Array<{ key: 'facilities' | 'patientInfo'; image: string; to: string }> = [
    { key: 'facilities', image: '/clinic/branch-2.png', to: '/facilities' },
    { key: 'patientInfo', image: '/clinic/patient-visual.jpg', to: '/patient-info' },
  ]

  return (
    <section id="services" className="bg-neutral-50 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900">{t('offerings.heading')}</h2>
          <p className="mt-5 text-neutral-500">{t('offerings.sub')}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          {SPECIALTY_PREVIEW.map((key) => (
            <motion.button
              key={key}
              type="button"
              variants={fadeUp}
              transition={{ duration: 0.4 }}
              whileHover={{ y: -4 }}
              onClick={() => navigate('/services')}
              className="group relative aspect-square overflow-hidden rounded-xl text-start shadow-card transition-shadow duration-150 ease-out hover:shadow-card-hover"
            >
              <img
                src={SERVICE_IMAGES[key]}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-neutral-900/10 to-transparent" />
              <span className="absolute bottom-0 start-0 p-3 text-sm font-semibold text-white">
                {t(`services.${key}.title`)}
              </span>
            </motion.button>
          ))}
        </motion.div>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-gold-600 transition-colors duration-150 ease-out hover:text-brand-gold-700"
          >
            {t('offerings.services.cta')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2"
        >
          {offerings.map((offer) => (
            <motion.button
              key={offer.key}
              type="button"
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              whileHover={{ y: -6 }}
              onClick={() => navigate(offer.to)}
              className="group relative aspect-[16/9] overflow-hidden rounded-2xl text-start shadow-card transition-shadow duration-150 ease-out hover:shadow-card-hover sm:aspect-[3/4]"
            >
              <img
                src={offer.image}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/85 via-neutral-900/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <h3 className="text-xl font-semibold">{t(`offerings.${offer.key}.title`)}</h3>
                <p className="mt-1.5 text-white/80">{t(`offerings.${offer.key}.desc`)}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gold-300">
                  {t(`offerings.${offer.key}.cta`)}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function DoctorsSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
  const doctors = t('doctors.list', { returnObjects: true }) as Array<{
    name: string
    specialty: string
    bio: string
  }>

  return (
    <section id="doctors" className="relative overflow-hidden py-24">
      <div className="absolute inset-0">
        <img src="/clinic/reception.png" alt="" aria-hidden="true" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-neutral-900/80" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-extrabold tracking-tight text-white">{t('doctors.heading')}</h2>
          <p className="mt-5 text-white/70">{t('doctors.sub')}</p>
        </motion.div>

        <div className="mt-16 rounded-3xl bg-white p-4 shadow-modal sm:p-6">
          <ScrollableCarousel prevLabel={t('carousel.prev')} nextLabel={t('carousel.next')}>
            {doctors.map((doctor) => (
              <div
                key={doctor.name}
                className="group mx-3 flex w-72 shrink-0 snap-center flex-col items-center rounded-2xl bg-neutral-50 px-6 py-8 text-center transition-all duration-200 ease-out hover:-translate-y-1.5 hover:shadow-card-hover"
              >
                <span
                  className={cn(
                    'flex h-20 w-20 items-center justify-center rounded-full text-4xl transition-transform duration-200 ease-out group-hover:scale-105',
                    avatarClassesFor(doctor.name),
                  )}
                >
                  {doctorEmojiFor(doctor.name)}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900">{doctor.name}</h3>
                <p className="mt-1 text-sm text-brand-gold-600">{doctor.specialty}</p>
                <p className="mt-2 line-clamp-2 text-neutral-500">{doctor.bio}</p>
              </div>
            ))}
          </ScrollableCarousel>
        </div>

        <div className="mt-10 flex justify-center">
          <Button size="lg" className="bg-brand-gold text-white hover:bg-brand-gold-600" onClick={() => navigate('/login')}>
            {t('doctors.cta')}
          </Button>
        </div>
      </div>
    </section>
  )
}

function TestimonialsSection() {
  const { t } = useTranslation('landing')
  const testimonials = t('testimonials.list', { returnObjects: true }) as Array<{
    name: string
    quote: string
    rating: number
  }>

  return (
    <section className="bg-stone-100 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900">{t('testimonials.heading')}</h2>
          <p className="mt-5 text-neutral-500">{t('testimonials.sub')}</p>
        </motion.div>

        <div className="mt-16 rounded-3xl bg-white p-4 shadow-card sm:p-6">
          <ScrollableCarousel prevLabel={t('carousel.prev')} nextLabel={t('carousel.next')}>
            {testimonials.map((item) => (
              <div
                key={item.name}
                className="mx-3 flex w-80 shrink-0 snap-center flex-col rounded-2xl border border-neutral-200 bg-neutral-50 p-6 transition-all duration-200 ease-out hover:-translate-y-1.5 hover:border-brand-gold/40 hover:shadow-card-hover"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: item.rating }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 fill-brand-gold-400 text-brand-gold-400" aria-hidden="true" />
                  ))}
                </div>
                <p className="mt-4 italic text-neutral-700">&ldquo;{item.quote}&rdquo;</p>
                <p className="mt-4 text-sm text-neutral-400">{item.name}</p>
              </div>
            ))}
          </ScrollableCarousel>
        </div>
      </div>
    </section>
  )
}

function EmergencyBanner() {
  const { t } = useTranslation('landing')

  return (
    <section className="bg-danger-600 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="text-center md:text-start">
          <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <h2 className="text-xl font-bold text-white">{t('emergency.heading')}</h2>
            <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs font-semibold text-white">
              {t('emergency.badge')}
            </span>
          </div>
          <p className="mt-2 max-w-lg text-white/80">{t('emergency.description')}</p>
        </div>

        <div className="flex flex-col items-center gap-2 md:items-end">
          <span className="text-sm text-white/70">{t('emergency.hotlineLabel')}</span>
          <motion.span
            dir="auto"
            className="text-3xl font-bold text-white"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {t('contact.phone')}
          </motion.span>
          <Button asChild size="lg" className="mt-1 bg-white font-semibold text-danger-600 hover:bg-white/90">
            <a href={EMERGENCY_TEL}>{t('emergency.cta')}</a>
          </Button>
        </div>
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const { t } = useTranslation('landing')
  const steps = t('howItWorks.steps', { returnObjects: true }) as Array<{
    step: string
    title: string
    desc: string
  }>

  return (
    <section id="how-it-works" className="bg-neutral-100 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-center text-3xl font-bold text-neutral-900"
        >
          {t('howItWorks.heading')}
        </motion.h2>

        <div className="relative mt-16 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
          <div
            aria-hidden="true"
            className="absolute top-6 hidden h-px w-full border-t-2 border-dashed border-brand-gold/30 md:block"
          />

          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: index % 2 === 0 ? -32 : 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative flex flex-col items-center text-center"
            >
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gold text-lg font-bold text-white">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-2 max-w-xs text-neutral-600">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactSection() {
  const { t } = useTranslation('landing')

  return (
    <section id="contact" className="bg-white px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-neutral-900">{t('contact.heading')}</h2>

          <div className="mt-8 flex flex-col gap-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10">
                <MapPin className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
              </span>
              <p className="pt-2 text-neutral-700">{t('contact.address')}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10">
                <Phone className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
              </span>
              <p dir="auto" className="pt-2 text-sm text-neutral-700">
                {t('contact.phone')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10">
                <Clock className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
              </span>
              <p className="pt-2 text-neutral-700">{t('contact.hours')}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex min-h-[280px] items-center justify-center rounded-2xl bg-neutral-100"
        >
          <div className="flex flex-col items-center gap-2 text-neutral-500">
            <MapPin className="h-8 w-8" aria-hidden="true" />
            <span className="text-sm font-medium">{t('contact.mapLabel')}</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
