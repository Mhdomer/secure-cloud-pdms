import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListOrdered } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { VisitStatusBadge } from '@/components/shared/VisitStatusBadge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLanguage } from '@/hooks/useLanguage'
import { departmentsApi, visitsApi } from '@/lib/api'
import { elapsedMinutesSince } from '@/lib/utils'
import { NewWalkInDialog } from '@/pages/visits/NewWalkInDialog'
import { departmentLabel, type Department } from '@/types/department'
import type { Visit } from '@/types/visit'

const VISITS_TODAY_QUERY_KEY = ['visits', 'today'] as const
const REFRESH_INTERVAL_MS = 30_000

const FILTER_VALUES = ['all', 'waiting', 'in_progress', 'completed', 'billed'] as const
type FilterValue = (typeof FILTER_VALUES)[number]

/**
 * `/visits`, admin only. Staff's working view of today's walk-in queue —
 * "New Walk-in" (NewWalkInDialog) stays visible at all times, not tucked
 * into a menu, since starting a new visit is this screen's primary action.
 * Filtering by status is client-side over one un-filtered `listToday` fetch
 * rather than a re-query per tab — the backend supports a `status` param,
 * but a clinic's daily walk-in count is small enough that filtering an
 * already-fetched list is simpler and avoids a network round trip on every
 * tab click. `refetchInterval` keeps the board current for staff watching
 * it without needing a manual refresh, same as a real reception queue
 * display would.
 *
 * Staff only act at the two points they actually witness: creating the
 * visit at check-in, and "Bill Now" once the patient is back at the
 * counter. waiting->in_progress and in_progress->completed are the
 * doctor's own dashboard's job (DoctorDashboard's "Today's Queue") — staff
 * sitting at the front desk have no way to know when a patient actually
 * walks into the consultation room or when the consultation ends, so the
 * backend (visitsController.updateStatus) now rejects those two
 * transitions from an admin session entirely, not just hides the buttons.
 * "Bill Now" navigates to BillVisitPage rather than mutating status
 * directly — completed->billed now only ever happens server-side, inside
 * billingController.payInvoice, once staff actually collects payment there.
 */
export default function TodaysVisitsPage() {
  const { t } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const [filter, setFilter] = useState<FilterValue>('completed')

  const { data, isLoading, isError } = useQuery({
    queryKey: VISITS_TODAY_QUERY_KEY,
    queryFn: () => visitsApi.listToday(),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })
  const departments = departmentsData?.departments ?? []

  const visits = data?.visits ?? []

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const prevPendingRef = useRef<number>(0)

  useEffect(() => {
    const currentPending = visits?.filter((v) => v.status === 'completed').length ?? 0
    const prev = prevPendingRef.current

    if (prev !== 0 && currentPending > prev) {
      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(t('pendingBilling.notificationTitle', { defaultValue: 'Patient ready to pay' }), {
          body: t('pendingBilling.notificationBody', {
            count: currentPending,
            defaultValue: `${currentPending} patient(s) waiting at billing counter`,
          }),
          icon: '/clinic/logo.jpg',
          tag: 'billing-alert', // replaces previous notification instead of stacking
        })
      }

      // Sound chime — short, non-intrusive
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
      } catch {
        // AudioContext blocked in some browsers — silent failure is fine
      }
    }

    prevPendingRef.current = currentPending
  }, [visits, t])
  const filtered = useMemo(() => {
    const list = filter === 'all' ? visits : visits.filter((v) => v.status === filter)
    if (filter === 'completed') {
      return [...list].sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0
        return timeA - timeB
      })
    }
    return list
  }, [visits, filter])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('todaysVisits.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('todaysVisits.description')}</p>
        </div>
        <NewWalkInDialog />
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
        <TabsList>
          {FILTER_VALUES.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`todaysVisits.filters.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{t('todaysVisits.loadError')}</p>
      ) : visits.length === 0 ? (
        <EmptyState icon={ListOrdered} title={t('todaysVisits.empty')} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={ListOrdered} title={tCommon('noResults')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('todaysVisits.columns.queueNo')}</TableHead>
              <TableHead>{t('todaysVisits.columns.fileNo')}</TableHead>
              <TableHead>{t('todaysVisits.columns.patient')}</TableHead>
              <TableHead>{t('todaysVisits.columns.doctor')}</TableHead>
              <TableHead>{t('todaysVisits.columns.clinic')}</TableHead>
              <TableHead>{t('todaysVisits.columns.since')}</TableHead>
              <TableHead>{t('todaysVisits.columns.status')}</TableHead>
              <TableHead>{t('todaysVisits.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((visit) => (
              <VisitRow key={visit.visitId} visit={visit} departments={departments} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function formatSince(checkedInAt: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const elapsedMinutes = elapsedMinutesSince(checkedInAt)
  if (elapsedMinutes < 60) return t('todaysVisits.sinceMinutes', { count: elapsedMinutes })
  return t('todaysVisits.sinceHoursMinutes', {
    hours: Math.floor(elapsedMinutes / 60),
    minutes: elapsedMinutes % 60,
  })
}

function VisitRow({ visit, departments }: { visit: Visit; departments: Department[] }) {
  const { t } = useTranslation('visits')
  const { currentLang } = useLanguage()
  const navigate = useNavigate()

  return (
    <TableRow>
      <TableCell className="font-mono font-semibold" dir="ltr">
        {visit.queueNo}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
        {visit.fileNo}
      </TableCell>
      <TableCell dir="auto">{visit.patientName}</TableCell>
      <TableCell>{visit.doctorName}</TableCell>
      {/* `clinic` stores a department key (see NewWalkInDialog), not display
          text — look up its display name here the same way ServicesCatalogPage
          looks up clinic_services.category, so a visit created under one
          language still reads correctly when viewed in the other. */}
      <TableCell>{visit.clinic ? departmentLabel(departments, visit.clinic, currentLang) : '—'}</TableCell>
      <TableCell dir="ltr">{formatSince(visit.checkedInAt, t)}</TableCell>
      <TableCell>
        <VisitStatusBadge status={visit.status} />
      </TableCell>
      <TableCell>
        {visit.status === 'waiting' || visit.status === 'in_progress' ? (
          // Nothing for staff to click — the doctor makes this transition
          // from their own dashboard, since only they witness it.
          <span className="text-xs text-muted-foreground">{t('todaysVisits.awaitingDoctor')}</span>
        ) : visit.status === 'completed' ? (
          // "Bill Now" is the money action (highlighted, default/primary
          // button variant) — opens BillVisitPage, where staff review
          // items, apply discounts, and actually collect payment.
          <Button type="button" size="sm" onClick={() => navigate(`/visits/${visit.visitId}/bill`)}>
            {t('todaysVisits.actions.billNow')}
          </Button>
        ) : (
          // 'billed' — payment has already been collected via BillVisitPage,
          // so the invoice is guaranteed paid/partial by this point.
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/visits/${visit.visitId}/invoice`)}
          >
            {t('todaysVisits.actions.viewInvoice')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
