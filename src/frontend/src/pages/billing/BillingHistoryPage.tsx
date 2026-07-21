import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi } from '@/lib/api'
import { cn } from '@/lib/utils'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation('visits')
  let colorClass = 'bg-neutral-100 text-neutral-700 border-neutral-200'

  if (status === 'paid') {
    colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  } else if (status === 'pending_billing') {
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200'
  } else if (status === 'partial') {
    colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200'
  } else if (status === 'cancelled') {
    colorClass = 'bg-neutral-100 text-neutral-600 border-neutral-200'
  }

  const label = t(`billingHistoryPage.statusPills.${status}`, { defaultValue: status })

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        colorClass,
      )}
    >
      {label}
    </span>
  )
}

export default function BillingHistoryPage() {
  const { t } = useTranslation('nav')
  const { t: tVisits } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const navigate = useNavigate()

  const today = useMemo(() => todayIso(), [])
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing-history', fromDate, toDate, statusFilter],
    queryFn: () =>
      billingApi.history({
        from: fromDate || undefined,
        to: toDate || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
    refetchInterval: 60_000,
  })

  const invoices = data?.invoices ?? []
  const totals = data?.totals ?? { grandTotal: 0, collected: 0, outstanding: 0 }

  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices
    const q = search.toLowerCase().trim()
    return invoices.filter(
      (inv) =>
        inv.invNo?.toLowerCase().includes(q) ||
        inv.patientName?.toLowerCase().includes(q) ||
        String(inv.fileNo).includes(q) ||
        inv.doctorName?.toLowerCase().includes(q),
    )
  }, [invoices, search])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('billingHistory')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tVisits('billingHistoryPage.description')}
        </p>
      </div>

      {/* Filters Bar */}
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {tVisits('billingHistoryPage.filters.fromDate')}
          </label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {tVisits('billingHistoryPage.filters.toDate')}
          </label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {tVisits('billingHistoryPage.filters.status')}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">{tVisits('billingHistoryPage.filters.allStatuses')}</option>
            <option value="paid">{tVisits('billingHistoryPage.filters.paid')}</option>
            <option value="pending_billing">{tVisits('billingHistoryPage.filters.pending')}</option>
            <option value="partial">{tVisits('billingHistoryPage.filters.partial')}</option>
            <option value="cancelled">{tVisits('billingHistoryPage.filters.cancelled')}</option>
          </select>
        </div>
        <div className="relative ms-auto flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            placeholder={tVisits('billingHistoryPage.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
      </Card>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {tVisits('billingHistoryPage.summary.collected')}
          </span>
          <p className="mt-1 text-2xl font-bold text-emerald-600" dir="ltr">
            SAR {totals.collected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {tVisits('billingHistoryPage.summary.outstanding')}
          </span>
          <p className="mt-1 text-2xl font-bold text-amber-600" dir="ltr">
            SAR {totals.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-medium text-muted-foreground">
            {tVisits('billingHistoryPage.summary.grandTotal')}
          </span>
          <p className="mt-1 text-2xl font-bold text-foreground" dir="ltr">
            SAR {totals.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Invoices Table */}
      {isLoading ? (
        <LoadingSpinner label={tCommon('loading')} />
      ) : isError ? (
        <p className="text-sm text-danger-600">{tVisits('billingHistoryPage.loadError')}</p>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState icon={Receipt} title={tVisits('billingHistoryPage.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tVisits('billingHistoryPage.table.invNo')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.date')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.patient')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.fileNo')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.doctor')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.totalSar')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.paidSar')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.balanceSar')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.status')}</TableHead>
              <TableHead>{tVisits('billingHistoryPage.table.action')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((inv) => (
              <TableRow key={inv.invoiceId}>
                <TableCell className="font-mono font-semibold" dir="ltr">
                  {inv.invNo}
                </TableCell>
                <TableCell dir="ltr">
                  {new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(inv.createdAt))}
                </TableCell>
                <TableCell dir="auto">
                  <Link
                    to={`/patients/${inv.patientId}`}
                    className="font-medium text-foreground hover:text-primary-600 hover:underline"
                  >
                    {inv.patientName}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {inv.fileNo}
                </TableCell>
                <TableCell>{inv.doctorName}</TableCell>
                <TableCell className="font-medium" dir="ltr">
                  {inv.grandTotal.toFixed(2)}
                </TableCell>
                <TableCell className="text-emerald-700" dir="ltr">
                  {inv.amountPaid.toFixed(2)}
                </TableCell>
                <TableCell className="text-amber-700" dir="ltr">
                  {inv.amountBalance.toFixed(2)}
                </TableCell>
                <TableCell>
                  <StatusPill status={inv.status} />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/visits/${inv.visitId}/invoice`)}
                  >
                    {tVisits('billingHistoryPage.table.viewInvoice')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
