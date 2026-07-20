import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Stethoscope,
  ClipboardList,
  Heart,
  MapPin,
  Calendar,
  ExternalLink,
  Navigation,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClinicLogo } from '@/components/shared/ClinicLogo'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import {
  LandingFooter,
  LandingNav,
  REAL_DOCTORS,
  SPECIALTY_IMAGES,
  doctorEmojiFor,
  mapsUrl,
  useGoToSection,
  fadeUp,
  staggerContainer,
} from '@/pages/landing/shared'

const SECONDARY_SPECIALTY_IMAGES: Record<string, string> = {
  dental: '/clinic/dental.png',
  'general-medicine': '/clinic/general-medicine.png',
  laboratory: '/clinic/laboratory.png',
  pediatrics: '/clinic/pediatrics.png',
  dermatology: '/clinic/dermatology.png',
}

const BANNER_SPECIALTY_IMAGES: Record<string, string> = {
  dental: '/clinic/svc-dentistry.png',
  'general-medicine': '/clinic/real-general-clinic.png',
  laboratory: '/clinic/real-laboratory.png',
  pediatrics: '/clinic/real-pediatrics-2.png',
  dermatology: '/clinic/svc-dermatology.png',
}

export default function SpecialtyDetailPage() {
  const { slug = 'dental' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('landing')
  const { isRtl } = useLanguage()
  const goToSection = useGoToSection()

  const [branchKey, setBranchKey] = useState<'namar' | 'dirab'>('namar')

  // Resolve specialty name from i18n
  const specialtiesList = t('specialtyCentres.list', { returnObjects: true }) as Array<{
    key: string
    name: string
  }>
  const currentSpecialtyObj = specialtiesList.find((item) => item.key === slug)
  const specialtyName = currentSpecialtyObj?.name ?? slug

  // Branch data
  const branchName = t(`specialtyDetail.branches.${branchKey}.name`)
  const branchPhone = t(`specialtyDetail.branches.${branchKey}.phone`)
  const branchAddress = t(`specialtyDetail.branches.${branchKey}.address`)

  const heroImage = SPECIALTY_IMAGES[slug] || SPECIALTY_IMAGES.dental
  const secondaryImage = SECONDARY_SPECIALTY_IMAGES[slug] || SECONDARY_SPECIALTY_IMAGES.dental
  const bannerImage = BANNER_SPECIALTY_IMAGES[slug] || BANNER_SPECIALTY_IMAGES.dental
  const specialtyDescription = t(`specialtyDetail.descriptions.${slug}`)

  // Doctor filtering logic
  const filteredDoctors = REAL_DOCTORS.filter((doc) => {
    if (slug === 'general-medicine') return doc.specialtyEn.includes('General Medicine')
    if (slug === 'pediatrics') return doc.specialtyEn.includes('Pediatrics')
    if (slug === 'dermatology') return doc.specialtyEn.includes('Dermatology')
    return true
  })

  const displayedDoctors = filteredDoctors.length > 0 ? filteredDoctors : REAL_DOCTORS

  const telHref = `tel:${branchPhone.replace(/\s+/g, '')}`

  return (
    <div className="relative min-h-screen bg-[#f8fafc] font-sans rtl:font-arabic text-slate-900 selection:bg-brand-gold-400 selection:text-slate-950">
      <LandingNav />

      {/* PHASE 2: Hero Section */}
      <section className="relative flex min-h-[55vh] sm:min-h-[60vh] flex-col justify-between overflow-hidden pt-20 pb-12 text-white">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt={specialtyName}
            className="h-full w-full object-cover filter contrast-105 brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/40" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 flex flex-col justify-between h-full pt-6">
          {/* Top Row: Back link */}
          <div>
            <button
              type="button"
              onClick={() => goToSection('specialty-centres')}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/60 px-4 py-2 text-xs sm:text-sm font-semibold text-brand-gold-300 backdrop-blur-md transition-all hover:bg-slate-900/90 hover:text-brand-gold-200 cursor-pointer"
            >
              {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              <span>{t('specialtyDetail.backLink')}</span>
            </button>
          </div>

          {/* Bottom Row: Dynamic Title & Branch Dropdown */}
          <div className="mt-12 sm:mt-16 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold-500/40 bg-brand-gold-500/20 px-3.5 py-1 text-xs font-bold text-brand-gold-300 backdrop-blur-md mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t('specialtyCentres.heading')}</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white drop-shadow-lg leading-tight">
              {specialtyName}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="text-xs sm:text-sm font-semibold text-slate-300">
                {t('specialtyDetail.selectBranch')}:
              </span>
              <Select
                value={branchKey}
                onValueChange={(val) => setBranchKey(val as 'namar' | 'dirab')}
              >
                <SelectTrigger className="w-[260px] sm:w-[280px] border-white/30 bg-slate-950/70 text-white backdrop-blur-md font-medium text-xs sm:text-sm shadow-xl focus:ring-brand-gold-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-white">
                  <SelectItem value="namar">
                    {t('specialtyDetail.branches.namar.name')}
                  </SelectItem>
                  <SelectItem value="dirab">
                    {t('specialtyDetail.branches.dirab.name')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* PHASE 3: Quick Info Bar */}
      <section className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 -mt-8 sm:-mt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xl shadow-slate-900/10 backdrop-blur-lg">
          {/* Card 1: Contact */}
          <a
            href={telHref}
            className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-all duration-300 hover:border-brand-gold-500/40 hover:bg-brand-gold-500/5 hover:shadow-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold-500/10 text-brand-gold-700 group-hover:bg-brand-gold-500 group-hover:text-slate-950 transition-colors">
              <Phone className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('specialtyDetail.generalLine')}
              </p>
              <p className="text-sm font-extrabold text-slate-900 dir-ltr text-start truncate">
                {branchPhone}
              </p>
            </div>
          </a>

          {/* Card 2: Our Doctors */}
          <button
            type="button"
            onClick={() => {
              document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' })
            }}
            className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-start transition-all duration-300 hover:border-brand-gold-500/40 hover:bg-brand-gold-500/5 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold-500/10 text-brand-gold-700 group-hover:bg-brand-gold-500 group-hover:text-slate-950 transition-colors">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900">{t('specialtyDetail.ourDoctors')}</p>
                <p className="text-xs text-slate-500 truncate">{t('specialtyDetail.ourDoctorsDesc')}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-brand-gold-700 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
              →
            </span>
          </button>

          {/* Card 3: Services */}
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-start transition-all duration-300 hover:border-brand-gold-500/40 hover:bg-brand-gold-500/5 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold-500/10 text-brand-gold-700 group-hover:bg-brand-gold-500 group-hover:text-slate-950 transition-colors">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900">{t('specialtyDetail.services')}</p>
                <p className="text-xs text-slate-500 truncate">{t('specialtyDetail.servicesDesc')}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-brand-gold-700 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
              →
            </span>
          </button>

          {/* Card 4: Patient Care */}
          <button
            type="button"
            onClick={() => navigate('/patient-info')}
            className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-start transition-all duration-300 hover:border-brand-gold-500/40 hover:bg-brand-gold-500/5 hover:shadow-md cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold-500/10 text-brand-gold-700 group-hover:bg-brand-gold-500 group-hover:text-slate-950 transition-colors">
                <Heart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-extrabold text-slate-900">{t('specialtyDetail.patientCare')}</p>
                <p className="text-xs text-slate-500 truncate">{t('specialtyDetail.patientCareDesc')}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-brand-gold-700 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
              →
            </span>
          </button>
        </div>
      </section>

      {/* PHASE 4a: Best In Industry */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={staggerContainer}
          className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center"
        >
          {/* Left Side (60%) */}
          <motion.div variants={fadeUp} className="lg:col-span-7">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-brand-gold-700">
              Al-Amin Polyclinic
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              {t('specialtyDetail.bestInIndustry')} — {specialtyName}
            </h2>
            <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 font-normal">
              {specialtyDescription}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              {isRtl
                ? 'نحن نلتزم بالتطوير المستمر وتقديم الرعاية الصحية وفق أفضل الإرشادات الطبية المعتمدة في المملكة العربية السعودية.'
                : 'We strictly adhere to continuous clinical improvement and international healthcare safety standards across all our centers in Riyadh.'}
            </p>
            <div className="mt-8 flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-700">
                {isRtl ? 'للحجز والاستفسار مباشر:' : 'Direct Inquiry Line:'}
              </span>
              <a
                href={telHref}
                className="inline-flex items-center gap-2 font-bold text-brand-gold-700 hover:text-brand-gold-800 underline underline-offset-4 dir-ltr"
              >
                <Phone className="h-4 w-4" />
                <span>{branchPhone}</span>
              </a>
            </div>
          </motion.div>

          {/* Right Side (40%) */}
          <motion.div variants={fadeUp} className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-slate-200 bg-white p-2 shadow-2xl">
              <img
                src={secondaryImage}
                alt={specialtyName}
                className="h-[360px] sm:h-[420px] w-full rounded-[26px] object-cover"
              />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* PHASE 4b: Our Services Full-Width Banner */}
      <section className="relative overflow-hidden bg-slate-950 py-20 text-white">
        <div className="absolute inset-0 z-0">
          <img
            src={bannerImage}
            alt=""
            className="h-full w-full object-cover opacity-30 filter brightness-90 contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/60" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow">
              {t('specialtyDetail.ourServices')}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              {t('specialtyDetail.ourServicesDesc')}
            </p>
            <div className="mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/services')}
                className="rounded-full border-white/40 bg-white/10 text-white hover:bg-white hover:text-slate-950 transition-all font-bold px-8 shadow-lg"
              >
                {t('specialtyDetail.seeMore')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* PHASE 5: Our Doctors Grid */}
      <section id="doctors" className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-gold-700">
              {specialtyName}
            </span>
            <h2 className="mt-1 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {t('specialtyDetail.ourDoctors')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => goToSection('doctors')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-gold-700 hover:text-brand-gold-800 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>{t('specialtyDetail.learnMore')}</span>
            <span className="text-base rtl:rotate-180">→</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayedDoctors.map((doc, idx) => (
            <div
              key={idx}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div>
                {/* Top Section: Photo + Name + Specialty */}
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-slate-100 bg-slate-100 shadow-sm">
                    <img
                      src={doc.image}
                      alt={isRtl ? doc.name : doc.nameEn}
                      className={cn('h-full w-full object-cover', doc.position)}
                      onError={(e) => {
                        // Fallback emoji avatar if image fails
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="hidden h-full w-full items-center justify-center bg-brand-gold-100 text-3xl">
                      {doctorEmojiFor(doc.name)}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {isRtl ? doc.name : doc.nameEn}
                    </h3>
                    <p className="text-xs font-semibold text-brand-gold-700 mt-1">
                      {isRtl ? doc.specialty : doc.specialtyEn}
                    </p>
                    <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {doc.experience}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Location Pin & Buttons */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-brand-gold-700 shrink-0" />
                  <span className="truncate">{branchName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 me-0">
                  <a
                    href={telHref}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-gold-500 to-amber-600 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-md hover:scale-105 transition-transform"
                  >
                    {t('specialtyDetail.contact')}
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    title={t('specialtyDetail.bookAppointment')}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PHASE 6a: Dynamic Location Map */}
      <section className="relative w-full overflow-hidden bg-slate-900 border-t border-slate-800">
        <iframe
          title="Branch Location Map"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(branchAddress)}&output=embed`}
          className="h-[480px] w-full border-0 grayscale contrast-125 opacity-85 hover:grayscale-0 transition-all duration-700"
          loading="lazy"
          allowFullScreen
        />

        {/* Floating Info Card */}
        <div className="absolute start-4 sm:start-12 top-6 z-10 w-full max-w-sm px-2 sm:px-0">
          <div className="rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-md">
            <ClinicLogo />
            <h3 className="mt-4 text-base font-extrabold text-slate-900">{branchName}</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{branchAddress}</p>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
              <p className="flex items-center gap-2 font-semibold text-slate-800 dir-ltr text-start">
                <Phone className="h-3.5 w-3.5 text-brand-gold-700" />
                <span>{branchPhone}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-500">
                <span className="font-bold text-slate-700">Email:</span>
                <span>{t('specialtyDetail.email')}</span>
              </p>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <a
                href={mapsUrl(branchAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Google Maps</span>
              </a>
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(branchAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Waze</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PHASE 6b: Footer */}
      <LandingFooter />
    </div>
  )
}
