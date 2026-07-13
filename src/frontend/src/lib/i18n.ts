import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '../locales/en/common.json'
import enNav from '../locales/en/nav.json'
import enAuth from '../locales/en/auth.json'
import enPatients from '../locales/en/patients.json'
import enAppointments from '../locales/en/appointments.json'

import arCommon from '../locales/ar/common.json'
import arNav from '../locales/ar/nav.json'
import arAuth from '../locales/ar/auth.json'
import arPatients from '../locales/ar/patients.json'
import arAppointments from '../locales/ar/appointments.json'

const savedLang = localStorage.getItem('pdms_lang') ?? 'ar'

i18n.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'ar',
  defaultNS: 'common',
  resources: {
    en: {
      common: enCommon,
      nav: enNav,
      auth: enAuth,
      patients: enPatients,
      appointments: enAppointments,
    },
    ar: {
      common: arCommon,
      nav: arNav,
      auth: arAuth,
      patients: arPatients,
      appointments: arAppointments,
    },
  },
  interpolation: { escapeValue: false },
})

// Sync html[lang] and html[dir] with the active language
i18n.on('languageChanged', (lng) => {
  const html = document.documentElement
  html.lang = lng
  html.dir = lng === 'ar' ? 'rtl' : 'ltr'
  localStorage.setItem('pdms_lang', lng)
})

// Apply on initial load
document.documentElement.lang = savedLang
document.documentElement.dir = savedLang === 'ar' ? 'rtl' : 'ltr'

export default i18n
