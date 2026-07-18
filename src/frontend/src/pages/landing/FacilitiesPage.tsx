import { motion } from 'framer-motion'
import {
  Armchair,
  Building2,
  ConciergeBell,
  FlaskConical,
  MapPin,
  Navigation,
  Pill,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react'
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

const GALLERY_ITEMS: Array<{ key: string; image: string; icon: LucideIcon; tall?: boolean }> = [
  { key: 'reception', image: '/clinic/reception.png', icon: ConciergeBell, tall: true },
  { key: 'consultationRoom', image: '/clinic/exam-room.png', icon: Stethoscope },
  { key: 'treatmentRoom', image: '/clinic/dermatology.png', icon: Syringe },
  { key: 'laboratory', image: '/clinic/laboratory.png', icon: FlaskConical, tall: true },
  { key: 'waitingArea', image: '/clinic/waiting-area.png', icon: Armchair },
  { key: 'mainHall', image: '/clinic/main-hall-2.png', icon: Building2 },
]

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

      <section className="bg-white px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-neutral-900">{t('facilities.galleryHeading')}</h2>
            <span aria-hidden="true" className="mt-3 block h-0.5 w-8 bg-brand-gold" />
            <p className="mt-3 max-w-xl text-neutral-500">{t('facilities.gallerySub')}</p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={staggerContainer}
            className="mt-10 grid grid-flow-row-dense grid-cols-2 gap-4 md:grid-cols-4 md:auto-rows-[160px]"
          >
            {GALLERY_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.key}
                  variants={fadeUp}
                  transition={{ duration: 0.45 }}
                  className={`group relative overflow-hidden rounded-2xl shadow-card ${item.tall ? 'row-span-2 aspect-[3/4] md:aspect-auto' : 'aspect-[4/3] md:aspect-auto'}`}
                >
                  <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-neutral-900/60 via-transparent to-transparent"
                  />
                  <span className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-brand-gold/90 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {t(`facilities.gallery.${item.key}`)}
                  </span>
                </motion.div>
              )
            })}
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
