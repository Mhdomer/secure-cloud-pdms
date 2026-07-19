import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { BackLink } from '@/components/shared/BackLink'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi, departmentsApi, doctorsApi } from '@/lib/api'
import { departmentLabel } from '@/types/department'

const DOCTOR_UNFILTERED = 'all'
const CLINIC_UNFILTERED = 'all'

function todayIsoDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/**
 * `/billing-report/invoices` — admin + superadmin only. Drill-down from
 * BillingReportPage's "View Invoices" links: the actual billed invoices
 * behind one day's (optionally one doctor's / one clinic's) totals.
 * Filters live in the URL (searchParams), not just component state, so a
 * "View Invoices" link from the report can deep-link straight to a
 * pre-filtered view, and the filter bar here can further refine it.
 */
export default function BillingReportInvoicesPage() {
  const { t } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [searchParams, setSearchParams] = useSearchParams()

  const date = searchParams.get('date') || todayIsoDate()
  const doctorId = searchParams.get('doctorId') || DOCTOR_UNFILTERED
  const clinic = searchParams.get('clinic') || CLINIC_UNFILTERED

  const updateDate = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('date', value)
    setSearchParams(next, { replace: true })
  }

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors', 'active'],
    queryFn: () => doctorsApi.listActive(),
  })
  const doctors = doctorsData?.doctors ?? []

  // All departments, not just active ones — this page filters *historical*
  // invoices, so a since-deactivated department must still be selectable
  // here even though it's hidden from new-assignment dropdowns elsewhere.
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })
  const departments = departmentsData?.departments ?? []

  // A doctor belongs to exactly one clinic (many doctors per clinic, never
  // the reverse) — so Doctor and Clinic are never independent filters here.
  // Picking a clinic narrows which doctors can even be picked; picking a
  // doctor pins the clinic to match his fixed one. An invalid combination
  // (a doctor paired with a clinic he doesn't belong to) is never selectable.
  const handleClinicChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === CLINIC_UNFILTERED) {
      next.delete('clinic')
    } else {
      next.set('clinic', value)
    }
    const selectedDoctor = doctors.find((doctor) => doctor.doctorId === doctorId)
    if (selectedDoctor && selectedDoctor.specialisation !== value) {
      next.delete('doctorId')
    }
    setSearchParams(next, { replace: true })
  }

  const handleDoctorChange = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value === DOCTOR_UNFILTERED) {
      next.delete('doctorId')
    } else {
      next.set('doctorId', value)
      const selectedDoctor = doctors.find((doctor) => doctor.doctorId === value)
      if (selectedDoctor?.specialisation) {
        next.set('clinic', selectedDoctor.specialisation)
      }
    }
    setSearchParams(next, { replace: true })
  }

  // Keeps a deep-link like "View Invoices" for one doctor (which only sets
  // `doctorId`, not `clinic` — BillingReportPage's per-doctor rows don't
  // carry the doctor's clinic) in sync with that doctor's actual clinic on
  // load, so the two selects never visually disagree.
  useEffect(() => {
    if (doctorId === DOCTOR_UNFILTERED) return
    const selectedDoctor = doctors.find((doctor) => doctor.doctorId === doctorId)
    if (selectedDoctor?.specialisation && clinic !== selectedDoctor.specialisation) {
      const next = new URLSearchParams(searchParams)
      next.set('clinic', selectedDoctor.specialisation)
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, doctors])

  const doctorOptions = useMemo(
    () => (clinic === CLINIC_UNFILTERED ? doctors : doctors.filter((doctor) => doctor.specialisation === clinic)),
    [doctors, clinic],
  )

  // Once a specific doctor is chosen, doctorId alone is the filter sent to
  // the backend — `clinic` here only drives which Select value is shown
  // (locked to that doctor's current department). A visit's `clinic` column
  // is a permanent snapshot of the doctor's department *at check-in time*;
  // if a doctor has since been reassigned (or, before that, had their
  // specialisation normalized), AND-ing both would silently exclude older
  // invoices that still match doctorId but were recorded under the old
  // clinic value — which is exactly what made the daily report's per-doctor
  // count/revenue disagree with this drill-down's (empty) results.
  const effectiveClinic = doctorId === DOCTOR_UNFILTERED && clinic !== CLINIC_UNFILTERED ? clinic : undefined

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing', 'report', 'invoices', date, doctorId, effectiveClinic],
    queryFn: () =>
      billingApi.getDailyInvoices({
        date,
        doctorId: doctorId === DOCTOR_UNFILTERED ? undefined : doctorId,
        clinic: effectiveClinic,
      }),
  })
  const invoices = data?.invoices ?? []

  const clinicLabel = (value: string | null) =>
    value === null ? t('billingReport.clinicUnspecified') : departmentLabel(departments, value, currentLang)

  const formatTime = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(iso))
    } catch {
      return '—'
    }
  }

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <BackLink to="/billing-report" label={t('billingReport.backToReport')} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('billingReport.invoicesTitle')}</h1>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('billingReport.dateLabel')}</label>
            <input
              type="date"
              dir="ltr"
              value={date}
              onChange={(event) => updateDate(event.target.value)}
              className="flex h-10 w-40 items-center rounded-lg border border-input bg-card px-3 text-sm text-foreground"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('billingReport.columns.doctor')}</label>
            <Select value={doctorId} onValueChange={handleDoctorChange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DOCTOR_UNFILTERED}>{t('billingReport.allDoctors')}</SelectItem>
                {doctorOptions.map((doctor) => (
                  <SelectItem key={doctor.doctorId} value={doctor.doctorId}>
                    {doctor.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('billingReport.columns.clinic')}</label>
            <Select
              value={clinic}
              onValueChange={handleClinicChange}
              disabled={doctorId !== DOCTOR_UNFILTERED}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLINIC_UNFILTERED}>{t('billingReport.allClinics')}</SelectItem>
                <SelectItem value="unspecified">{t('billingReport.clinicUnspecified')}</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.key} value={department.key}>
                    {currentLang === 'ar' ? department.nameAr : department.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      ) : invoices.length === 0 ? (
        <EmptyState title={t('billingReport.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('billingReport.columns.invNo')}</TableHead>
              <TableHead>{t('billingReport.columns.patient')}</TableHead>
              <TableHead>{t('billingReport.columns.doctor')}</TableHead>
              <TableHead>{t('billingReport.columns.clinic')}</TableHead>
              <TableHead>{t('billingReport.columns.paidAt')}</TableHead>
              <TableHead className="text-end">{t('billingReport.columns.revenue')}</TableHead>
              <TableHead>{t('billingReport.columns.status')}</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoiceId}>
                <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {invoice.invNo}
                </TableCell>
                <TableCell dir="auto">{invoice.patientName}</TableCell>
                <TableCell dir="auto">{invoice.doctorName}</TableCell>
                <TableCell dir="auto">{clinicLabel(invoice.clinic)}</TableCell>
                <TableCell dir="ltr">{formatTime(invoice.paidAt)}</TableCell>
                <TableCell className="text-end font-medium" dir="ltr">
                  {invoice.amountPaid.toFixed(2)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={invoice.status} />
                </TableCell>
                <TableCell>
                  <Link
                    to={`/visits/${invoice.visitId}/invoice`}
                    className="text-xs font-medium text-primary-600 hover:underline"
                  >
                    {t('billingReport.viewInvoice')}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
