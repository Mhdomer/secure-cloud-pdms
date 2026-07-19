import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleDollarSign, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { DashboardStatCard } from '@/components/shared/DashboardStatCard'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi, departmentsApi } from '@/lib/api'
import { departmentLabel } from '@/types/department'

function todayIsoDate() {
  const now = new Date()
  // Local calendar date, not UTC — a browser west of Riyadh could otherwise
  // default this input to "yesterday" right after local midnight.
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/**
 * `/billing-report` — admin + superadmin only, its own sidebar entry (not
 * buried in the Walk-ins queue or a patient's invoice view). Staff's
 * end-of-day revenue reconciliation: how many invoices were paid, how much
 * came in, broken down by doctor and by clinic. All figures come from the
 * server already aggregated (`billingController.getDailyReport`) — this
 * page never sums money client-side, matching how billing math works
 * everywhere else in this app.
 */
export default function BillingReportPage() {
  const { t } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const [date, setDate] = useState(() => todayIsoDate())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing', 'report', date],
    queryFn: () => billingApi.getDailyReport(date),
  })
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })
  const departments = departmentsData?.departments ?? []

  const clinicLabel = (clinic: string) =>
    clinic === 'unspecified' ? t('billingReport.clinicUnspecified') : departmentLabel(departments, clinic, currentLang)

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{t('billingReport.title')}</h1>
        <div className="flex flex-wrap items-end gap-3">
          <Link
            to={`/billing-report/invoices?date=${date}`}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            {t('billingReport.viewAllInvoices')}
          </Link>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billing-report-date">{t('billingReport.dateLabel')}</Label>
            <Input
              id="billing-report-date"
              type="date"
              dir="ltr"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-danger-600">{tCommon('error.generic')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DashboardStatCard
              icon={Receipt}
              tone="primary"
              label={t('billingReport.totalInvoices')}
              isLoading={isLoading}
            >
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {data?.totalInvoices ?? 0}
              </span>
            </DashboardStatCard>

            <DashboardStatCard
              icon={CircleDollarSign}
              tone="success"
              label={t('billingReport.totalRevenue')}
              isLoading={isLoading}
            >
              <span className="text-2xl font-bold tracking-tight text-foreground" dir="ltr">
                {(data?.totalRevenue ?? 0).toFixed(2)} SAR
              </span>
            </DashboardStatCard>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-foreground">{t('billingReport.byDoctorHeading')}</h2>
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-10 w-full animate-pulse rounded-lg bg-neutral-200" />
                  ))}
                </div>
              ) : !data?.byDoctor.length ? (
                <p className="text-sm text-muted-foreground">{t('billingReport.empty')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('billingReport.columns.doctor')}</TableHead>
                      <TableHead className="text-end">{t('billingReport.columns.count')}</TableHead>
                      <TableHead className="text-end">{t('billingReport.columns.revenue')}</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byDoctor.map((row) => (
                      <TableRow key={row.doctorId}>
                        <TableCell dir="auto">{row.doctorName}</TableCell>
                        <TableCell className="text-end" dir="ltr">
                          {row.invoiceCount}
                        </TableCell>
                        <TableCell className="text-end font-medium" dir="ltr">
                          {row.revenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Link
                            to={`/billing-report/invoices?date=${date}&doctorId=${row.doctorId}`}
                            className="whitespace-nowrap text-xs font-medium text-primary-600 hover:underline"
                          >
                            {t('billingReport.viewInvoices')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-foreground">{t('billingReport.byClinicHeading')}</h2>
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-10 w-full animate-pulse rounded-lg bg-neutral-200" />
                  ))}
                </div>
              ) : !data?.byClinic.length ? (
                <p className="text-sm text-muted-foreground">{t('billingReport.empty')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('billingReport.columns.clinic')}</TableHead>
                      <TableHead className="text-end">{t('billingReport.columns.count')}</TableHead>
                      <TableHead className="text-end">{t('billingReport.columns.revenue')}</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byClinic.map((row) => (
                      <TableRow key={row.clinic}>
                        <TableCell dir="auto">{clinicLabel(row.clinic)}</TableCell>
                        <TableCell className="text-end" dir="ltr">
                          {row.invoiceCount}
                        </TableCell>
                        <TableCell className="text-end font-medium" dir="ltr">
                          {row.revenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Link
                            to={`/billing-report/invoices?date=${date}&clinic=${row.clinic}`}
                            className="whitespace-nowrap text-xs font-medium text-primary-600 hover:underline"
                          >
                            {t('billingReport.viewInvoices')}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
