import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, CreditCard, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { fadeUp, LandingFooter, LandingNav, PageHeader, staggerContainer, useScrollToHash } from '@/pages/landing/shared'

/**
 * Standalone Patient & Visitor page — Patient Rights, Insurance & Payment,
 * and FAQ. `/patient-info#faq` scrolls straight to the accordion. Banner
 * uses the real clinic photo of a patient's arm/wristband (no faces —
 * consistent with the project's no-real-people-photos rule for anyone
 * identifiable). See docs/psm2/report-delta.md DELTA-016.
 */
export default function PatientInfoPage() {
  const { t } = useTranslation('landing')
  useScrollToHash()

  const rights = t('patientInfo.rights', { returnObjects: true }) as string[]
  const insurance = t('patientInfo.insurance', { returnObjects: true }) as string[]
  const faqs = t('faq.list', { returnObjects: true }) as Array<{ q: string; a: string }>
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="min-h-screen bg-neutral-50">
      <LandingNav />
      <PageHeader title={t('patientInfo.heading')} subtitle={t('patientInfo.sub')} image="/clinic/patient-visual.jpg" />

      <section className="px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 gap-8 md:grid-cols-2"
          >
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              whileHover={{ y: -6 }}
              className="rounded-2xl bg-white p-8 shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10">
                  <ShieldCheck className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-neutral-900">{t('patientInfo.rightsHeading')}</h2>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {rights.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-neutral-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              whileHover={{ y: -6 }}
              className="rounded-2xl bg-white p-8 shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10">
                  <CreditCard className="h-5 w-5 text-brand-gold-600" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-neutral-900">{t('patientInfo.insuranceHeading')}</h2>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {insurance.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-neutral-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="faq" className="bg-white px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="text-center text-3xl font-bold text-neutral-900"
          >
            {t('faq.heading')}
          </motion.h2>

          <div className="mt-12">
            {faqs.map((item, index) => {
              const isOpen = openIndex === index
              return (
                <div key={item.q} className="border-b border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-start"
                    aria-expanded={isOpen}
                  >
                    <span className="font-medium text-neutral-900">{item.q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.15 }}
                      className="shrink-0 text-neutral-400"
                    >
                      <ChevronDown className="h-5 w-5" aria-hidden="true" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <p className="pb-5 text-neutral-600">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
