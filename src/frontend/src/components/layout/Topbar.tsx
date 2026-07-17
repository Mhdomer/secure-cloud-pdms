import { useTranslation } from 'react-i18next'

import { LanguageToggle } from '@/components/shared/LanguageToggle'

/**
 * Language toggle only — the signed-in user's name/role and logout moved to
 * the bottom of the sidebar (see Sidebar.tsx) per ui-brief.md's App Shell
 * spec, so this header no longer duplicates that affordance.
 */
export function Topbar() {
  const { t: tCommon } = useTranslation('common')

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <span className="text-sm font-semibold text-primary-700 sm:hidden">
        {tCommon('appName')}
      </span>
      <span />

      <LanguageToggle />
    </header>
  )
}
