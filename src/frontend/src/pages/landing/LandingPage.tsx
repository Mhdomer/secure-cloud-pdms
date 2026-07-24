import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import {
  EMERGENCY_TEL,
  fadeUp,
  LandingFooter,
  LandingNav,
  REAL_DOCTORS,
  SERVICE_IMAGES,
  staggerContainer,
  useScrollOnArrival,
} from '@/pages/landing/shared'

export default function LandingPage() {
  useScrollOnArrival()

  return (
    <div className="relative min-h-screen bg-[#f8fafc] font-sans rtl:font-arabic text-slate-900 selection:bg-brand-gold-400 selection:text-slate-950">
      <LandingNav />
      <HeroSection />
      <QuickAccessSection />
      <TrustSection />
      <OfferingsTeaserSection />
      <SpecialtyCentresSection />
      <DoctorsSection />
      <TestimonialsSection />
      <ContactSection />
      <LandingFooter />
    </div>
  )
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function HeroSection() {
  const { t, i18n } = useTranslation('landing')
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const isArabic = i18n.language === 'ar'

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    toast.info(t('hero.searchToast'))
    setSearchValue('')
  }

  return (
    <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden pt-16">
      {/* High-Clarity Video Background Layer (HMG Style) */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-90 filter brightness-100 contrast-105"
        >
          <source src="/clinic/hero-motion.mp4" type="video/mp4" />
        </video>

        {/* Soft Clinical Vignette Mask */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/40 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 mx-auto max-w-4xl px-6 text-center pb-16"
      >
        {/* Frosted Gold Badge */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/60 px-4 py-1.5 backdrop-blur-xl shadow-xl text-sm font-semibold text-brand-gold-300"
        >
          <Sparkles className="h-4 w-4 animate-pulse text-brand-gold-400" />
          <span>{isArabic ? 'مجمع الأمين الطبي — رعاية صحية متكاملة' : 'Alamin PolyClinic — Trusted Medical Care'}</span>
        </motion.div>

        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-white md:text-7xl leading-tight drop-shadow-md">
          {t('hero.tagline')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-100 md:text-xl leading-relaxed font-medium drop-shadow">
          {t('hero.subtext')}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-brand-gold-500 via-amber-500 to-brand-gold-600 px-8 py-6 text-base font-bold text-slate-950 shadow-xl shadow-brand-gold-500/25 hover:shadow-brand-gold-500/40 hover:scale-105 transition-all duration-300"
            onClick={() => navigate('/login')}
          >
            <span className="relative z-10 flex items-center gap-2">
              {t('hero.cta')}
              <ArrowRight className="h-5 w-5 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="rounded-full border border-white/40 bg-slate-950/50 px-8 py-6 text-base font-bold text-white backdrop-blur-xl hover:bg-slate-900/80 hover:border-white/60 transition-all duration-300 shadow-md"
            onClick={() => navigate('/services')}
          >
            {t('hero.ctaSecondary')}
          </Button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mx-auto mt-8 max-w-xl">
          <div className="group relative rounded-2xl border border-white/30 bg-slate-950/65 p-1.5 backdrop-blur-2xl shadow-2xl shadow-black/30 transition-all duration-300 focus-within:border-brand-gold-400 focus-within:ring-2 focus-within:ring-brand-gold-400/30">
            <div className="flex items-center px-3">
              <Search className="h-5 w-5 text-white/80 transition-colors group-focus-within:text-brand-gold-400" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t('hero.searchPlaceholder')}
                aria-label={t('hero.searchPlaceholder')}
                className="h-11 border-0 bg-transparent text-white placeholder:text-slate-300 focus-visible:ring-0 focus-visible:ring-offset-0 text-base font-medium"
              />
              <Button type="submit" size="sm" className="rounded-xl bg-brand-gold-500 text-slate-950 font-bold hover:bg-brand-gold-400">
                {isArabic ? 'بحث' : 'Search'}
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
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
    <section id="quick-access" className="relative z-20 py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={staggerContainer}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {items.map((item) => {
            const cardClass =
              'group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-gold-500/50 hover:bg-white hover:shadow-xl hover:shadow-brand-gold-500/10'
            const content = (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold-500/15 border border-brand-gold-500/30 transition-transform duration-300 group-hover:scale-110">
                  <item.icon className="h-6 w-6 text-brand-gold-600" />
                </div>
                <span className="text-sm font-bold text-slate-900">{t(`quickAccess.${item.key}.title`)}</span>
                <span className="text-xs text-slate-500 font-medium">{t(`quickAccess.${item.key}.desc`)}</span>
              </>
            )

            return (
              <motion.div key={item.key} variants={fadeUp}>
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

function parseStatTarget(value: string): number {
  const arabicIndicDigits = '٠١٢٣٤٥٦٧٨٩'
  const normalized = value.replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
  const digitsOnly = normalized.replace(/[^0-9]/g, '')
  return digitsOnly ? parseInt(digitsOnly, 10) : 0
}

function formatDisplayCount(count: number, rawValue: string): string {
  const hasPlus = rawValue.includes('+')
  const hasComma = rawValue.includes('٬') || rawValue.includes(',')
  const isArabicDigit = /[٠-٩]/.test(rawValue)

  let numStr = count.toLocaleString()
  if (isArabicDigit) {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
    numStr = String(count).replace(/[0-9]/g, (d) => arabicDigits[parseInt(d, 10)])
    if (hasComma) {
      numStr = numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
    }
  }

  return hasPlus ? `${numStr}+` : numStr
}

function PopOutStatCard({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  value: string
  label: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!isInView) return
    const target = parseStatTarget(value)
    if (target === 0) {
      setDone(true)
      return
    }

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

  const formattedCount = formatDisplayCount(count, value)

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.85, y: 15 }}
      animate={isInView ? { opacity: 1, scale: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={cn(
        'absolute flex items-center gap-3 rounded-2xl border border-white/80 bg-white/95 p-3 sm:p-4 shadow-2xl shadow-slate-900/20 backdrop-blur-md transition-transform duration-300 hover:scale-105 hover:z-30 cursor-default',
        className,
      )}
    >
      <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-brand-gold-400 shadow-inner">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col text-start me-1">
        <span className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
          {done ? value : formattedCount}
        </span>
        <span className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1 whitespace-nowrap">
          {label}
        </span>
      </div>
    </motion.div>
  )
}

function TrustSection() {
  const { t } = useTranslation('landing')

  return (
    <section id="trust" className="relative overflow-hidden bg-[#f8fafc] px-4 py-24 sm:px-6 lg:py-28 border-b border-slate-100">
      {/* Background Brand Emblem Watermark */}
      <div className="absolute start-4 sm:start-12 top-1/2 -translate-y-1/2 opacity-25 pointer-events-none select-none z-0 mix-blend-multiply">
        <img
          src="/clinic/brand-emblem-watermark.png"
          alt=""
          className="h-[420px] sm:h-[500px] w-auto object-contain filter contrast-300 brightness-75"
        />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
        {/* Left Column: Text & CTA */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold-500/30 bg-brand-gold-500/10 px-4 py-1.5 text-xs font-bold text-brand-gold-700">
            <ShieldCheck className="h-4 w-4" />
            <span>Top Healthcare Standards</span>
          </div>

          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight">
            {t('trust.heading')}
          </h2>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed font-normal">{t('trust.description')}</p>

          <Button
            size="lg"
            className="mt-8 rounded-full bg-gradient-to-r from-brand-gold-500 to-amber-600 px-8 text-slate-950 font-bold shadow-lg shadow-brand-gold-500/20 hover:shadow-xl hover:shadow-brand-gold-500/35 hover:scale-105 transition-all"
            onClick={() => scrollToId('contact')}
          >
            {t('trust.cta')}
          </Button>
        </motion.div>

        {/* Right Column: Main Image with Pop-Out Stat Cards */}
        <div className="lg:col-span-6 flex justify-center py-6">
          <div className="relative w-full max-w-[460px] px-4">
            {/* Red / Gold Accent Background Shape */}
            <div className="absolute -top-4 -start-2 h-44 w-44 rounded-tl-[40px] rounded-br-[100px] bg-gradient-to-br from-red-500 via-amber-500 to-brand-gold-600 opacity-80 -z-10 blur-[1px]" />
            <div className="absolute -bottom-4 -end-2 h-40 w-40 rounded-br-[40px] rounded-tl-[100px] bg-slate-900 opacity-15 -z-10" />

            {/* Central Main Frame Image */}
            <div className="relative h-[380px] sm:h-[440px] w-full overflow-hidden rounded-[36px] border border-white/80 bg-slate-100 shadow-2xl">
              <img
                src="/clinic/brand-card-variant-2.png"
                alt="Alamin Polyclinic - Trusted Healthcare Provider"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Pop-Out Stat Cards Popping Beyond the Frame */}
            {/* Card 1: Top Right (Physicians) */}
            <PopOutStatCard
              icon={Stethoscope}
              value={t('trust.physicians.value')}
              label={t('trust.physicians.label')}
              className="-top-5 -end-4 sm:-end-8 z-20"
            />

            {/* Card 2: Middle Left (Specialties) */}
            <PopOutStatCard
              icon={LayoutGrid}
              value={t('trust.specialties.value')}
              label={t('trust.specialties.label')}
              className="top-1/3 -start-6 sm:-start-10 z-20"
            />

            {/* Card 3: Bottom Left (Experience) */}
            <PopOutStatCard
              icon={Clock}
              value={t('trust.experience.value')}
              label={t('trust.experience.label')}
              className="-bottom-5 -start-4 sm:-start-8 z-20"
            />

            {/* Card 4: Bottom Right (Patients Served) */}
            <PopOutStatCard
              icon={Users}
              value={t('trust.patients.value')}
              label={t('trust.patients.label')}
              className="-bottom-5 -end-4 sm:-end-8 z-20"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

const SPECIALTY_PREVIEW: Array<keyof typeof SERVICE_IMAGES> = ['generalMedicine', 'dental', 'laboratory', 'dermatology']

function OfferingsTeaserSection() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()

  return (
    <section id="services" className="relative bg-[#f8fafc] px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{t('offerings.heading')}</h2>
          <p className="mt-4 text-lg text-slate-600 font-medium">{t('offerings.sub')}</p>
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
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={() => navigate('/services')}
              className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-start shadow-xl shadow-slate-200/60 transition-all duration-300"
            >
              <img
                src={SERVICE_IMAGES[key]}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="block text-base font-bold text-white group-hover:text-brand-gold-300 transition-colors">
                  {t(`services.${key}.title`)}
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-slate-300">
                  <span>Explore Service</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <div className="mt-10 flex justify-center">
          <Button
            variant="outline"
            className="rounded-full border-slate-300 bg-white text-slate-800 hover:bg-slate-100 shadow-md font-semibold"
            onClick={() => navigate('/services')}
          >
            <span>{t('offerings.services.cta')}</span>
            <ArrowRight className="h-4 w-4 ms-2 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </section>
  )
}

const SPECIALTY_IMAGES: Record<string, string> = {
  dental: '/clinic/spec-dental.png',
  'general-medicine': '/clinic/spec-general-medicine.png',
  laboratory: '/clinic/spec-laboratory.png',
  pediatrics: '/clinic/spec-pediatrics.png',
  dermatology: '/clinic/spec-dermatology.png',
}

function SpecialtyCentresSection() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('landing')
  const specialties = t('specialtyCentres.list', { returnObjects: true }) as Array<{ key: string; name: string }>
  const [activeKey, setActiveKey] = useState('dental')
  const isArabic = i18n.language === 'ar'

  const activeIndex = Math.max(0, specialties.findIndex((item) => item.key === activeKey))
  const activeSpecialty = specialties[activeIndex] ?? specialties[0]
  const nextSpecialty = specialties[(activeIndex + 1) % specialties.length]

  return (
    <section id="specialty-centres" className="relative overflow-hidden bg-[#f4f4f2] text-slate-900">
      {/* Top/Rear High-Res B&W Header Banner Frame */}
      <div className="absolute inset-x-0 top-0 h-48 z-0 overflow-hidden bg-neutral-900">
        <img
          src="/clinic/canva-waiting-clean.png"
          alt=""
          className="h-full w-full object-cover grayscale opacity-35 contrast-125 brightness-95"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/50 via-neutral-950/20 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Typography & Enclosed Navigation Card Box */}
          <div className="lg:col-span-5">
            <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/5">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {t('specialtyCentres.heading')}
              </h2>
              <span className="mt-2 block h-1 w-12 rounded-full bg-[#967d58]" />

              {/* Interactive Menu List Inside Card Box */}
              <div className="mt-6 flex flex-col gap-2.5">
                {specialties.map((item) => {
                  const isActive = item.key === activeKey
                  return (
                    <div
                      key={item.key}
                      className={cn(
                        'group flex items-center justify-between transition-all duration-200 px-3.5 py-2 rounded-xl',
                        isActive
                          ? 'text-[#967d58] font-bold text-base bg-[#967d58]/10 shadow-sm'
                          : 'text-slate-600 font-semibold text-sm hover:text-slate-900 hover:bg-slate-50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveKey(item.key)}
                        className="flex flex-1 items-center text-start cursor-pointer outline-none truncate py-0.5 me-2"
                      >
                        {isActive ? (
                          <span className="w-5 h-[3px] bg-[#967d58] me-3 rounded-full inline-block shrink-0" />
                        ) : (
                          <span className="w-5 h-[3px] bg-transparent me-3 inline-block shrink-0" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/specialties/${item.key}`)
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#967d58] hover:text-amber-700 hover:underline shrink-0 cursor-pointer px-2 py-1 rounded-lg hover:bg-brand-gold-500/10 transition-colors"
                      >
                        <span>{isArabic ? 'اعرف المزيد' : 'Learn More'}</span>
                        <span className="rtl:rotate-180">→</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Staggered Feature Cards */}
          <div className="lg:col-span-7 flex flex-col sm:flex-row items-start sm:items-end justify-center lg:justify-end gap-6 pt-2">
            {/* Card 1: Main Active Card (Significantly Larger, Royal Purple Gradient) */}
            <div
              onClick={() => navigate(`/specialties/${activeKey}`)}
              className="group relative h-[520px] w-full max-w-[340px] sm:w-[340px] shrink-0 rounded-[32px] overflow-hidden shadow-2xl flex flex-col justify-end p-7 text-white bg-[#220d3b] z-20 border border-white/20 cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeKey}
                  src={SPECIALTY_IMAGES[activeKey]}
                  alt={activeSpecialty?.name ?? ''}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </AnimatePresence>

              {/* Deep Royal Purple Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#2a0e4d] via-[#3a1563]/85 to-transparent" />

              <div className="relative z-10">
                <span className="text-xs font-medium text-white/80 tracking-wide uppercase mb-1 block">
                  {isArabic ? 'نظرة عامة' : 'Overview'}
                </span>
                <h3 className="text-3xl font-bold text-white drop-shadow mb-3">
                  {activeSpecialty?.name}
                </h3>
                <p className="text-xs text-white/85 leading-relaxed font-normal line-clamp-3 mb-4">
                  {isArabic
                    ? 'مركز تخصصي متكامل يوفر أفضل أطباء واستشاريين الرعاية المتقدمة بأعلى معايير الأمان.'
                    : 'KPJ Centre For Sight is one stop eye centre with a team of professional surgeons...'}
                </p>
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold-400/40 bg-brand-gold-500/20 px-4 py-2 text-xs font-bold text-brand-gold-300 backdrop-blur-md transition-all group-hover:bg-brand-gold-500 group-hover:text-slate-950 group-hover:shadow-lg">
                  <span>{isArabic ? 'اعرف المزيد' : 'Learn More'}</span>
                  <span className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">→</span>
                </div>
              </div>
            </div>

            {/* Card 2: Second Teaser Card (Smaller, Shifted Lower, Dark Teal Gradient) */}
            {nextSpecialty && (
              <button
                type="button"
                onClick={() => setActiveKey(nextSpecialty.key)}
                className="group relative h-[360px] w-full max-w-[240px] sm:w-[240px] shrink-0 rounded-[28px] overflow-hidden shadow-xl flex flex-col justify-end p-6 text-start text-white bg-[#002f3c] cursor-pointer hover:scale-103 transition-all duration-300 z-10 border border-white/20 self-end"
              >
                <img
                  src={SPECIALTY_IMAGES[nextSpecialty.key]}
                  alt={nextSpecialty.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />

                {/* Dark Teal / Cyan Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#003847] via-[#004e63]/80 to-transparent" />

                <div className="relative z-10">
                  <span className="text-xs font-medium text-white/80 tracking-wide uppercase mb-1 block">
                    {isArabic ? 'التالي' : 'Overview'}
                  </span>
                  <h4 className="text-xl font-bold text-white drop-shadow mb-2">
                    {nextSpecialty.name}
                  </h4>
                  <div className="inline-flex items-center gap-1 text-xs font-bold text-brand-gold-300 group-hover:text-brand-gold-200">
                    <span>{isArabic ? 'اعرف المزيد' : 'Learn More'}</span>
                    <span className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">→</span>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function DoctorsSection() {
  const { t, i18n } = useTranslation('landing')
  const navigate = useNavigate()
  const { isRtl } = useLanguage()
  const isArabic = i18n.language === 'ar'
  const carouselRef = useRef<HTMLDivElement>(null)

  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const categories = [
    { key: 'all', labelAr: 'جميع الأطباء', labelEn: 'All Doctors' },
    { key: 'dental', labelAr: 'طب الأسنان', labelEn: 'Dentistry' },
    { key: 'dermatology', labelAr: 'الجلدية والتجميل', labelEn: 'Dermatology & Laser' },
    { key: 'pediatrics', labelAr: 'طب الأطفال', labelEn: 'Pediatrics' },
    { key: 'general', labelAr: 'طب عام', labelEn: 'General Medicine' },
    { key: 'obgyn', labelAr: 'نساء وتوليد', labelEn: 'Obstetrics & Gynecology' },
  ]

  const filteredDoctors = REAL_DOCTORS.filter((doc) => {
    const matchesCategory =
      selectedSpecialty === 'all' ||
      (selectedSpecialty === 'dental' && (doc.specialty.includes('أسنان') || doc.specialtyEn.toLowerCase().includes('den'))) ||
      (selectedSpecialty === 'dermatology' && (doc.specialty.includes('جلدية') || doc.specialtyEn.toLowerCase().includes('derm'))) ||
      (selectedSpecialty === 'pediatrics' && (doc.specialty.includes('أطفال') || doc.specialtyEn.toLowerCase().includes('ped'))) ||
      (selectedSpecialty === 'general' && (doc.specialty.includes('عام') || doc.specialtyEn.toLowerCase().includes('gen'))) ||
      (selectedSpecialty === 'obgyn' && (doc.specialty.includes('نساء') || doc.specialtyEn.toLowerCase().includes('obs')))

    const query = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !query ||
      doc.name.toLowerCase().includes(query) ||
      doc.nameEn.toLowerCase().includes(query) ||
      doc.specialty.toLowerCase().includes(query) ||
      doc.specialtyEn.toLowerCase().includes(query)

    return matchesCategory && matchesSearch
  })

  const handleBookDoctor = (doc: (typeof REAL_DOCTORS)[0]) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    if (token) {
      navigate('/dashboard', { state: { preferredDoctor: doc.name, specialty: doc.specialty } })
    } else {
      navigate('/login', {
        state: {
          doctorName: isArabic ? doc.name : doc.nameEn,
          specialty: isArabic ? doc.specialty : doc.specialtyEn,
          redirect: '/dashboard',
        },
      })
    }
  }

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = carouselRef.current
    if (!el) return
    const amount = direction === 'left' ? -340 : 340
    const scrollDir = isRtl ? -amount : amount
    el.scrollBy({ left: scrollDir, behavior: 'smooth' })
  }

  useEffect(() => {
    if (selectedSpecialty !== 'all' || searchQuery.trim() !== '') return

    const interval = setInterval(() => {
      const el = carouselRef.current
      if (!el) return
      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 10) return
      const current = Math.abs(el.scrollLeft)
      if (maxScroll - current <= 20) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        const dir = isRtl ? -1 : 1
        el.scrollBy({ left: dir * 320, behavior: 'smooth' })
      }
    }, 3500)

    return () => clearInterval(interval)
  }, [isRtl, selectedSpecialty, searchQuery])

  return (
    <section id="doctors" className="relative overflow-hidden bg-[#f8fafc] text-slate-900 py-24 sm:py-32">
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{t('doctors.heading')}</h2>
            <p className="mt-3 text-lg text-slate-600 font-medium">{t('doctors.sub')}</p>
          </div>

          {/* Controls & Search */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder={isArabic ? 'ابحث عن طبيب...' : 'Search doctor...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-10 rounded-full border-slate-200 bg-white text-sm focus-visible:ring-brand-gold-500 shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                aria-label={t('carousel.prev')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 transition-all hover:bg-brand-gold-500 hover:text-slate-950 hover:border-brand-gold-500 shadow-sm"
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                aria-label={t('carousel.next')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 transition-all hover:bg-brand-gold-500 hover:text-slate-950 hover:border-brand-gold-500 shadow-sm"
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-8 flex flex-wrap items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const isActive = selectedSpecialty === cat.key
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedSpecialty(cat.key)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-all shrink-0',
                  isActive
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                {isArabic ? cat.labelAr : cat.labelEn}
              </button>
            )
          })}
        </div>

        {/* Doctor Cards Carousel */}
        {filteredDoctors.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <Stethoscope className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-slate-700">
              {isArabic ? 'لم نجد أطباء يطابقون بحثك' : 'No doctors match your criteria'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isArabic ? 'جرب اختيار تخصص آخر أو تغيير كلمة البحث' : 'Try selecting another specialty or clear your search'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 rounded-full"
              onClick={() => {
                setSelectedSpecialty('all')
                setSearchQuery('')
              }}
            >
              {isArabic ? 'عرض كل الأطباء' : 'Show All Doctors'}
            </Button>
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="mt-8 flex snap-x snap-mandatory overflow-x-auto scrollbar-hide py-4 gap-6 scroll-smooth"
          >
            <AnimatePresence mode="popLayout">
              {filteredDoctors.map((doc) => (
                <motion.div
                  key={doc.nameEn}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="group relative flex w-80 shrink-0 snap-center flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5 transition-all duration-500 hover:-translate-y-2 hover:border-brand-gold-400 hover:shadow-2xl hover:shadow-brand-gold-500/15"
                >
                  {/* Doctor Headshot Portrait Frame */}
                  <div className="relative h-80 w-full overflow-hidden bg-slate-900">
                    <img
                      src={doc.image}
                      alt={doc.name}
                      className={cn(
                        'h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108 filter brightness-100 group-hover:brightness-105',
                        doc.position,
                      )}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    
                    {/* Experience Badge */}
                    <span className="absolute top-4 start-4 rounded-full border border-white/30 bg-black/60 px-3 py-1 backdrop-blur-md text-xs font-semibold text-brand-gold-300">
                      {doc.experience}
                    </span>
                  </div>

                  <div className="flex flex-col p-6 text-start bg-white">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-brand-gold-700 transition-colors">
                      {isArabic ? doc.name : doc.nameEn}
                    </h3>
                    <p className="mt-1 text-sm font-bold text-brand-gold-600">
                      {isArabic ? doc.specialty : doc.specialtyEn}
                    </p>
                    <Button
                      size="sm"
                      className="mt-5 rounded-xl bg-slate-900 text-white hover:bg-brand-gold-500 hover:text-slate-950 font-bold transition-all flex items-center justify-center gap-2"
                      onClick={() => handleBookDoctor(doc)}
                    >
                      <Calendar className="h-4 w-4" />
                      {t('doctors.cta')}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
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
    <section className="bg-white py-24 border-t border-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">{t('testimonials.heading')}</h2>
          <p className="mt-4 text-slate-600 font-medium">{t('testimonials.sub')}</p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <div
              key={item.name}
              className="flex flex-col rounded-3xl border border-slate-200/80 bg-slate-50/70 p-6 shadow-md shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-gold-400"
            >
              <div className="flex gap-1">
                {Array.from({ length: item.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-brand-gold-400 text-brand-gold-400" />
                ))}
              </div>
              <p className="mt-4 italic text-slate-700 leading-relaxed font-medium">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-4 text-sm font-bold text-brand-gold-700">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactSection() {
  const { t } = useTranslation('landing')

  return (
    <section id="contact" className="bg-white px-4 py-24 sm:px-6 border-t border-slate-100">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-extrabold text-slate-900">{t('contact.heading')}</h2>

          <div className="mt-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gold-500/10 border border-brand-gold-500/30">
                <MapPin className="h-6 w-6 text-brand-gold-600" />
              </span>
              <p className="pt-2 text-slate-700 font-semibold">{t('contact.address')}</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gold-500/10 border border-brand-gold-500/30">
                <Phone className="h-6 w-6 text-brand-gold-600" />
              </span>
              <p dir="auto" className="pt-2 text-slate-700 font-semibold">
                {t('contact.phone')}
              </p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-gold-500/10 border border-brand-gold-500/30">
                <Clock className="h-6 w-6 text-brand-gold-600" />
              </span>
              <p className="pt-2 text-slate-700 font-semibold">{t('contact.hours')}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="min-h-[300px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl"
        >
          <iframe
            title={t('contact.mapLabel')}
            src={`https://www.google.com/maps?q=${encodeURIComponent(t('contact.address'))}&output=embed`}
            className="h-full min-h-[300px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </motion.div>
      </div>
    </section>
  )
}
