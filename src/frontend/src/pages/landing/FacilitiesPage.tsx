import { motion } from 'framer-motion'
import { MapPin, Navigation, Pill } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  fadeUp,
  FACILITY_IMAGES,
  LandingFooter,
  LandingNav,
  mapsUrl,
  PageHeader,
  staggerContainer,
  useScrollToHash,
} from '@/pages/landing/shared'

/**
 * Standalone Medical Facilities + Pharmacy page — reached from the nav
 * mega-menu. `/facilities#pharmacy` scrolls straight to the pharmacy card.
 * See docs/psm2/report-delta.md DELTA-016 for why this moved off the
 * landing-page scroll.
 */
export default function FacilitiesPage() {
  const { t } = useTranslation('landing')
  useScrollToHash()

  const facilities = t('facilities.list', { returnObjects: true }) as Array<{
    name: string
    address: string
  }>

  return (
    <div className="min-h-screen bg-neutral-50">
      <LandingNav />
      <PageHeader title={t('facilities.heading')} subtitle={t('facilities.sub')} image="/clinic/branch-2.png" />

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-8 sm:grid-cols-2"
          >
            {facilities.map((facility, index) => (
              <motion.div
                key={facility.name}
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                whileHover={{ y: -6 }}
                className="group overflow-hidden rounded-2xl bg-white shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={FACILITY_IMAGES[index]}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900">{facility.name}</h2>
                  <div className="mt-3 flex items-start gap-2 text-neutral-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-600" aria-hidden="true" />
                    <span>{facility.address}</span>
                  </div>
                  <a
                    href={mapsUrl(facility.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gold-600 transition-colors duration-150 ease-out hover:text-brand-gold-700"
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    {t('facilities.directions')}
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="pharmacy" className="px-4 py-24 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="group mx-auto max-w-6xl overflow-hidden rounded-2xl bg-white shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover md:grid md:grid-cols-2"
        >
          <div className="aspect-[4/3] overflow-hidden md:aspect-auto md:h-full">
            <img
              src="/clinic/pharmacy.png"
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </div>

          <div className="flex flex-col justify-center p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10">
                <Pill className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
              </span>
              <h2 className="text-2xl font-bold text-neutral-900">{t('pharmacy.heading')}</h2>
              <span className="rounded-full bg-brand-gold/10 px-2.5 py-1 text-xs font-semibold text-brand-gold-700">
                {t('pharmacy.badge')}
              </span>
            </div>
            <p className="mt-4 text-neutral-600">{t('pharmacy.sub')}</p>
            <div className="mt-4 flex items-start gap-2 text-neutral-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-600" aria-hidden="true" />
              <span>{t('pharmacy.address')}</span>
            </div>
            <p className="mt-3 text-neutral-500">{t('pharmacy.note')}</p>
          </div>
        </motion.div>
      </section>

      <LandingFooter />
    </div>
  )
}
