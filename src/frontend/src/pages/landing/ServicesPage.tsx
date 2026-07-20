import { motion } from 'framer-motion'
import {
  Baby,
  FileText,
  FlaskConical,
  HeartPulse,
  Shield,
  Smile,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fadeUp, LandingFooter, LandingNav, PageHeader, SERVICE_IMAGES, staggerContainer } from '@/pages/landing/shared'

const SERVICE_ICONS: Record<keyof typeof SERVICE_IMAGES, LucideIcon> = {
  generalMedicine: Stethoscope,
  pediatrics: Baby,
  internalMedicine: HeartPulse,
  dental: Smile,
  dermatology: Sparkles,
  laboratory: FlaskConical,
  digitalRecords: FileText,
  preventiveCare: Shield,
}

const SERVICE_SPECIALTY_SLUG_MAP: Record<string, string> = {
  dental: 'dental',
  pediatrics: 'pediatrics',
  generalMedicine: 'general-medicine',
  dermatology: 'dermatology',
  laboratory: 'laboratory',
}

/**
 * Standalone services/departments page — reached from the nav mega-menu
 * instead of a landing-page anchor, per the "click a department, get its own
 * page" navigation redesign (see docs/psm2/report-delta.md DELTA-016).
 */
export default function ServicesPage() {
  const { t, i18n } = useTranslation('landing')
  const navigate = useNavigate()
  const isArabic = i18n.language === 'ar'
  const serviceKeys = Object.keys(SERVICE_IMAGES) as Array<keyof typeof SERVICE_IMAGES>

  return (
    <div className="min-h-screen bg-neutral-50">
      <LandingNav />
      <PageHeader title={t('services.heading')} subtitle={t('services.sub')} image="/clinic/exam-room.png" />

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {serviceKeys.map((key) => {
              const Icon = SERVICE_ICONS[key]
              const slug = SERVICE_SPECIALTY_SLUG_MAP[key]
              return (
                <motion.div
                  key={key}
                  variants={fadeUp}
                  transition={{ duration: 0.45 }}
                  onClick={slug ? () => navigate(`/specialties/${slug}`) : undefined}
                  className={cn(
                    'group flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-200 ease-out hover:scale-[1.02] hover:shadow-md',
                    slug && 'cursor-pointer',
                  )}
                >
                  <div>
                    <div className="h-44 overflow-hidden">
                      <img
                        src={SERVICE_IMAGES[key]}
                        alt=""
                        aria-hidden="true"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold/10">
                        <Icon className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
                      </span>
                      <h2 className="mt-3 text-lg font-semibold text-neutral-900">{t(`services.${key}.title`)}</h2>
                      <p className="mt-1 text-sm text-neutral-500">{t(`services.${key}.desc`)}</p>
                    </div>
                  </div>

                  {slug && (
                    <div className="px-5 pb-5 pt-0">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-gold-700 group-hover:text-brand-gold-800 transition-colors">
                        <span>{isArabic ? 'اعرف المزيد' : 'Learn More'}</span>
                        <span className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180">→</span>
                      </span>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="mt-16 flex flex-col items-center gap-4 rounded-2xl bg-white p-10 text-center shadow-card"
          >
            <h2 className="text-2xl font-bold text-neutral-900">{t('doctors.cta')}</h2>
            <Button size="lg" className="bg-brand-gold text-white hover:bg-brand-gold-600" onClick={() => navigate('/login')}>
              {t('hero.cta')}
            </Button>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
