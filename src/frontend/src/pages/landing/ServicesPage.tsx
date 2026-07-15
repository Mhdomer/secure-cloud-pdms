import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { fadeUp, LandingFooter, LandingNav, PageHeader, SERVICE_IMAGES, staggerContainer } from '@/pages/landing/shared'

/**
 * Standalone services/departments page — reached from the nav mega-menu
 * instead of a landing-page anchor, per the "click a department, get its own
 * page" navigation redesign (see docs/psm2/report-delta.md DELTA-016).
 */
export default function ServicesPage() {
  const { t } = useTranslation('landing')
  const navigate = useNavigate()
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
            {serviceKeys.map((key) => (
              <motion.div
                key={key}
                variants={fadeUp}
                transition={{ duration: 0.45 }}
                whileHover={{ y: -6 }}
                className="group relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
              >
                <img
                  src={SERVICE_IMAGES[key]}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-neutral-900/20 to-transparent" />
                <div className="absolute bottom-0 start-0 p-5 text-white">
                  <h2 className="text-lg font-semibold">{t(`services.${key}.title`)}</h2>
                  <p className="mt-1 text-white/75">{t(`services.${key}.desc`)}</p>
                </div>
              </motion.div>
            ))}
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
