import { ShieldCheck, Settings, UserCog, Users, Stethoscope, Calendar, Activity, FileText, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

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

const MOCK_AUDIT_LOGS = [
  { id: '1', key: 'superadmin.auditFeed.loginSuccess', time: '10 mins ago', user: 'Admin' },
  { id: '2', key: 'superadmin.auditFeed.userCreated', time: '1 hour ago', user: 'Dr. Sarah' },
  { id: '3', key: 'superadmin.auditFeed.systemBackup', time: '3 hours ago', user: 'System' },
  { id: '4', key: 'superadmin.auditFeed.roleUpdated', time: 'Yesterday', user: 'SuperAdmin' },
]

export default function SuperAdminDashboard() {
  const { t } = useTranslation('dashboard')
  const { user } = useAuth()

  const systemStats = [
    {
      titleKey: 'superadmin.stats.totalUsers',
      value: '148',
      icon: Users,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      titleKey: 'superadmin.stats.activeDoctors',
      value: '12',
      icon: Stethoscope,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      titleKey: 'superadmin.stats.todayAppointments',
      value: '42',
      icon: Calendar,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      titleKey: 'superadmin.stats.systemStatus',
      value: t('superadmin.stats.operational'),
      icon: Activity,
      color: 'text-emerald-600 bg-emerald-50',
      isBadge: true,
    },
  ]

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t('greeting', { name: user?.username })}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('superadmin.subtitle')}</p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary-200/80 bg-white/80 p-4 text-primary-900 shadow-sm backdrop-blur-md">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <span className="text-sm font-medium leading-relaxed">{t('superadmin.infoBanner')}</span>
      </div>

      {/* System Health KPI Bar */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t('superadmin.stats.systemStatus')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {systemStats.map((stat, idx) => (
            <motion.div
              key={stat.titleKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-md"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-muted-foreground">{t(stat.titleKey)}</span>
                {stat.isBadge ? (
                  <span className="mt-0.5 inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                    {stat.value}
                  </span>
                ) : (
                  <span className="text-xl font-bold tracking-tight text-foreground">{stat.value}</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Actions & Audit Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">{t('superadmin.quickActions')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md transition-all duration-150 ease-out hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-100/80 text-primary-700">
                  <link.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-medium text-foreground">{t(link.labelKey)}</span>
              </Link>
            ))}
          </div>

          <Card className="mt-2 rounded-xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t('superadmin.roleHierarchy')}</CardTitle>
              <p className="text-muted-foreground">{t('superadmin.roleHierarchyDesc')}</p>
            </CardHeader>
            <CardContent>
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

        {/* Audit Feed Snippet */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t('superadmin.auditFeed.heading')}</h2>
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <FileText className="h-4 w-4 text-primary-600" aria-hidden="true" />
                {t('superadmin.auditFeed.heading')}
              </span>
              <span className="text-xs font-medium text-primary-600">{t('superadmin.auditFeed.viewAll')}</span>
            </div>
            <div className="flex flex-col gap-3">
              {MOCK_AUDIT_LOGS.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-medium text-foreground">{t(log.key)}</span>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{log.user}</span>
                      <span>{log.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
      <span className="mt-0.5 shrink-0 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
        {role}
      </span>
      <div>
        <p className="font-medium text-foreground">{name}</p>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

