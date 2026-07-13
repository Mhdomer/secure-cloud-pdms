import { ShieldCheck, Settings, UserCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

interface QuickLink {
  to: string
  labelKey: string
  icon: LucideIcon
}

const QUICK_LINKS: QuickLink[] = [
  { to: '/users', labelKey: 'superadmin.manageUsers', icon: UserCog },
  { to: '/settings', labelKey: 'superadmin.settings', icon: Settings },
]

const ROLE_ORDER = ['superadmin', 'doctor', 'admin', 'patient'] as const

export default function SuperAdminDashboard() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t('greeting', { name: user?.username })}
        </h1>
        {/* No text-sm here — full-sentence content must fall through to the
            global [lang="ar"] 17px/1.75-line-height default, not the smaller
            English-scaled utility (see the same fix in LandingPage.tsx). */}
        <p className="mt-1 text-muted-foreground">{t('superadmin.subtitle')}</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-primary-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t('superadmin.infoBanner')}</span>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t('superadmin.quickActions')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-card transition-shadow duration-150 ease-out hover:bg-primary-50 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <link.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-foreground">{t(link.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('superadmin.roleHierarchy')}</CardTitle>
          {/* Plain <p>, not <CardDescription> — that component bakes in
              text-sm by default (components/ui/card.tsx), which has the
              same undersized-Arabic effect as the text-sm fixes elsewhere
              on this page. CardDescription's default is a app-wide latent
              issue worth its own audit; out of scope to change here since
              it's shared across the whole app. */}
          <p className="text-muted-foreground">{t('superadmin.roleHierarchyDesc')}</p>
        </CardHeader>
        <CardContent>
          {/* No text-sm on this wrapper — RoleRow's description paragraphs
              are full sentences and need to inherit the correct per-language
              body size, not get capped down by an ancestor override. */}
          <div className="divide-y divide-border">
            {ROLE_ORDER.map((role) => (
              <RoleRow
                key={role}
                role={role}
                name={t(`superadmin.roles.${role}.name`)}
                description={t(`superadmin.roles.${role}.desc`)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RoleRow({
  role,
  name,
  description,
}: {
  role: (typeof ROLE_ORDER)[number]
  name: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
        {role}
      </span>
      <div>
        <p className="font-medium text-foreground">{name}</p>
        {/* No text-xs — these are full sentences, not short labels; same
            Arabic-minimum concern as above. */}
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
