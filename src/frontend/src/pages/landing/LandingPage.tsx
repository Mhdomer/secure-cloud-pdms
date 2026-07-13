import { useEffect, useRef, useState } from 'react'
import { motion, useInView, type Variants } from 'framer-motion'
import {
  ChevronDown,
  Clock,
  FileText,
  MapPin,
  Phone,
  Star,
  Stethoscope,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { Button } from '@/components/ui/button'

/**
 * Public marketing homepage shown at `/` to anyone who isn't signed in.
 * Every string comes from the `landing` i18n namespace so it mirrors
 * correctly in Arabic (default) and English. No external images/fetches —
 * all visuals are inline SVG/lucide icons and CSS gradients so the page is
 * fully self-contained.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <LandingNav />
      <HeroSection />
      <ServicesSection />
      <TrustSection />
      <HowItWorksSection />
      <ContactSection />
      <LandingFooter />
    </div>
  )
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

function LandingNav() {
  const { t } = useTranslation('landing')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50">
            <Stethoscope className="h-5 w-5 text-primary-600" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-primary-700">{tCommon('appName')}</span>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Button size="sm" onClick={() => navigate('/login')}>
            {t('nav.login')}
          </Button>
        </div>
      </div>
    </header>
  )
}

function HeroSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()

  const scrollToServices = () => {
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600">
      {/* Gradient stays within the project's own primary-800..primary-600
          range — the previous to-teal-500 stop was both an off-brand color
          (not a design-system token) and, measured, dropped white/90 text
          contrast to 2.27:1 at that corner, well under WCAG AA's 4.5:1
          minimum. Slow-pulsing blurred glow circles below are purely
          decorative. */}
      <motion.div
        aria-hidden="true"
        className="absolute -top-32 start-[-8rem] h-[420px] w-[420px] rounded-full bg-white/10 blur-3xl"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -bottom-40 end-[-6rem] h-[380px] w-[380px] rounded-full bg-white/10 blur-3xl"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-4xl font-bold text-white sm:text-5xl md:text-6xl"
        >
          {t('hero.tagline')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg"
        >
          {t('hero.subtext')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            className="bg-white text-primary-700 hover:bg-white/90"
            onClick={() => navigate('/login')}
          >
            {t('hero.cta')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white bg-transparent text-white hover:bg-white/10"
            onClick={scrollToServices}
          >
            {t('hero.ctaSecondary')}
          </Button>
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={scrollToServices}
        aria-label={t('hero.ctaSecondary')}
        className="absolute bottom-8 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 text-white/80 transition-colors duration-150 ease-out hover:text-white"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <ChevronDown className="h-8 w-8" aria-hidden="true" />
      </motion.button>
    </section>
  )
}

function ServicesSection() {
  const { t } = useTranslation('landing')

  const services = [
    { icon: Stethoscope, title: t('services.generalMedicine.title'), desc: t('services.generalMedicine.desc') },
    { icon: Star, title: t('services.specialist.title'), desc: t('services.specialist.desc') },
    { icon: FileText, title: t('services.digitalRecords.title'), desc: t('services.digitalRecords.desc') },
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
          className="mx-auto max-w-xl text-center"
        >
          <h2 className="text-3xl font-bold text-neutral-900">{t('services.heading')}</h2>
          <span className="mx-auto mt-3 block h-1 w-16 rounded-full bg-primary-600" aria-hidden="true" />
          <p className="mt-4 text-neutral-600">{t('services.sub')}</p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3"
        >
          {services.map((service) => (
            <motion.div
              key={service.title}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-start rounded-2xl border border-border bg-white p-8 shadow-card transition-all duration-150 ease-out hover:-translate-y-1 hover:shadow-card-hover"
            >
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50">
                <service.icon className="h-6 w-6 text-primary-600" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold text-neutral-900">{service.title}</h3>
              {/* No text-sm/leading-relaxed here — those utilities beat the
                  global [lang="ar"] 17px/1.75-line-height rule on specificity
                  ties, which would push this sentence-length copy below the
                  design system's non-negotiable Arabic minimum. */}
              <p className="mt-2 text-neutral-600">{service.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/** Parses a localized numeric stat string ("20+", "+٢٠", "50,000+"…) down to a
 * plain integer so it can be counted up from zero. Arabic-Indic digits are
 * mapped to their Western equivalents first since `parseInt` doesn't read them. */
function parseStatTarget(value: string): number {
  const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩'
  const normalized = value.replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
  const digitsOnly = normalized.replace(/[^0-9]/g, '')
  return digitsOnly ? parseInt(digitsOnly, 10) : 0
}

interface CountUpStatProps {
  value: string
  label: string
  /** Skip the numeric count-up and just reveal the value as-is (years, percentages). */
  staticValue?: boolean
}

function CountUpStat({ value, label, staticValue = false }: CountUpStatProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(staticValue)

  useEffect(() => {
    if (!isInView || staticValue) return

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
  }, [isInView, staticValue, value])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center text-center"
    >
      <span className="text-[clamp(2rem,5vw,3rem)] font-bold text-white">
        {done ? value : count}
      </span>
      <span className="mt-2 text-sm text-white/80">{label}</span>
    </motion.div>
  )
}

function TrustSection() {
  const { t } = useTranslation('landing')

  return (
    <section className="bg-primary-700 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="text-center text-2xl font-bold text-white sm:text-3xl"
        >
          {t('trust.heading')}
        </motion.h2>

        <div className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-4">
          <CountUpStat value={t('trust.since.value')} label={t('trust.since.label')} staticValue />
          <CountUpStat value={t('trust.doctors.value')} label={t('trust.doctors.label')} />
          <CountUpStat value={t('trust.patients.value')} label={t('trust.patients.label')} />
          <CountUpStat value={t('trust.uptime.value')} label={t('trust.uptime.label')} staticValue />
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
    <section className="bg-neutral-100 px-4 py-24 sm:px-6">
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
          {/* Dashed connector — spans the row behind the step circles on desktop only */}
          <div
            aria-hidden="true"
            className="absolute top-6 hidden h-px w-full border-t-2 border-dashed border-primary-200 md:block"
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
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-lg font-bold text-white">
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
    <section className="bg-white px-4 py-24 sm:px-6">
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <MapPin className="h-5 w-5 text-primary-600" aria-hidden="true" />
              </span>
              <p className="pt-2 text-neutral-700">{t('contact.address')}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <Phone className="h-5 w-5 text-primary-600" aria-hidden="true" />
              </span>
              <p dir="auto" className="pt-2 text-sm text-neutral-700">
                {t('contact.phone')}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                <Clock className="h-5 w-5 text-primary-600" aria-hidden="true" />
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

function LandingFooter() {
  const { t } = useTranslation('landing')

  return (
    <footer className="bg-neutral-900 px-4 py-8 text-neutral-400 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
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
