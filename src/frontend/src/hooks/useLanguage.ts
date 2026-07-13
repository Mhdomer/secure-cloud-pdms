import { useTranslation } from 'react-i18next'

export type SupportedLanguage = 'ar' | 'en'

/**
 * Thin wrapper over react-i18next's `useTranslation`. Changing language via
 * `toggleLanguage`/`setLanguage` fires i18next's `languageChanged` event,
 * which `lib/i18n.ts` listens to globally to sync `document.documentElement`
 * lang/dir and persist the choice to localStorage (`pdms_lang`). Components
 * should always go through this hook rather than touching `document` or
 * `localStorage` directly.
 */
export function useLanguage() {
  const { i18n } = useTranslation()
  const currentLang: SupportedLanguage = i18n.language === 'ar' ? 'ar' : 'en'

  const setLanguage = (lang: SupportedLanguage) => {
    void i18n.changeLanguage(lang)
  }

  const toggleLanguage = () => {
    setLanguage(currentLang === 'ar' ? 'en' : 'ar')
  }

  return {
    currentLang,
    isRtl: currentLang === 'ar',
    setLanguage,
    toggleLanguage,
  }
}
