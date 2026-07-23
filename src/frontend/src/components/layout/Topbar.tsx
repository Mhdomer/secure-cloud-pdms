import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { LanguageToggle } from '@/components/shared/LanguageToggle'
import { NotificationDrawer } from '@/components/layout/NotificationDrawer'
import { useLanguage } from '@/hooks/useLanguage'

interface TopbarProps {
  onOpenCommandPalette?: () => void
}

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const { t: tCommon } = useTranslation('common')
  const { isRtl } = useLanguage()

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-primary-700 sm:hidden">
          {tCommon('appName')}
        </span>
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{isRtl ? 'البحث السريع أو الأوامر...' : 'Quick Search or Commands...'}</span>
          <kbd className="ms-2 px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <NotificationDrawer />
        <LanguageToggle />
      </div>
    </header>
  )
}
