import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { notifyStateChange } from '@/lib/syncChannel'

import { BackLink } from '@/components/shared/BackLink'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toaster'
import { useLanguage } from '@/hooks/useLanguage'
import { billingApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { InvoiceItem, PaymentMethod } from '@/types/billing'

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'insurance']

function invoiceQueryKey(visitId: string) {
  return ['visits', visitId, 'invoice'] as const
}

/**
 * `/visits/:visitId/bill`, admin only. Staff's review-and-collect screen —
 * reached from TodaysVisitsPage's "Bill Now" once a doctor has marked a
 * visit complete. Items themselves are the doctor's (read-only here);
 * staff's only edit is per-item discount, then payment collection.
 */
export default function BillVisitPage() {
  const { visitId } = useParams<{ visitId: string }>()
  const { t } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const { currentLang } = useLanguage()
  const navigate = useNavigate()

  const {
    data: invoice,
    isLoading,
    isError,
  } = useQuery({
    queryKey: invoiceQueryKey(visitId!),
    queryFn: () => billingApi.getInvoice(visitId!),
    enabled: !!visitId,
    retry: false,
  })

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [insuranceCo, setInsuranceCo] = useState('Tawuniya Insurance')
  const [approvalCode, setApprovalCode] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [coveragePercent, setCoveragePercent] = useState('80')
  const [amountPaid, setAmountPaid] = useState('')
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)

  const payMutation = useMutation({
    mutationFn: () =>
      billingApi.pay(visitId!, {
        payment_method: paymentMethod!,
        amount_paid: Number(amountPaid) || 0,
        ...(paymentMethod === 'insurance'
          ? {
              insurance_co: insuranceCo.trim(),
              approval_code: approvalCode.trim(),
              policy_number: policyNumber.trim(),
              coverage_percent: Number(coveragePercent) || 0,
            }
          : {}),
      }),
    onSuccess: () => {
      toast.success(t('bill.paySuccess'))
      setConfirmPayOpen(false)
      notifyStateChange()
      navigate(`/visits/${visitId}/invoice`)
    },
    onError: (error: AxiosError<{ error?: string }>) => {
      setConfirmPayOpen(false)
      toast.error(error.response?.data?.error ?? t('bill.payError'))
    },
  })

  if (!visitId) return null

  if (isLoading) {
    return <LoadingSpinner label={tCommon('loading')} />
  }

  if (isError || !invoice) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        <EmptyState title={t('bill.notFoundTitle')} description={t('bill.loadError')} />
        <BackLink to="/visits" label={t('bill.backButton')} />
      </div>
    )
  }

  // 'partial' is now a valid state to land here in, not just
  // 'pending_billing' — a partially-paid invoice used to have no screen
  // anywhere that could ever collect the rest (finding C-1); this page now
  // handles both, distinguishing them via isFirstPayment below.
  if (!['pending_billing', 'partial'].includes(invoice.status)) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        <EmptyState title={t('bill.notReadyTitle')} />
        <BackLink to="/visits" label={t('bill.backButton')} />
      </div>
    )
  }

  const dateLabel = new Intl.DateTimeFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
  }).format(new Date(invoice.checkedInAt))

  const grandTotal = invoice.grandTotal
  const isFirstPayment = invoice.status === 'pending_billing'
  // Server-maintained truth: on 'pending_billing' this equals grandTotal
  // (nothing collected yet); on 'partial' it's already the patient's
  // locked-in owed amount minus whatever's been collected so far (which
  // may differ from grandTotal once insurance coverage was applied on the
  // first payment) — never recompute this client-side from grandTotal
  // alone, or a partial-payment collection would show the wrong amount
  // still owed.
  const remainingBalance = invoice.amountBalance
  const thisPayment = Number(amountPaid) || 0
  const balance = Math.round((remainingBalance - thisPayment) * 100) / 100
  // Epsilon matches the backend's (billingController.payInvoice) — kept in
  // sync so the button's enabled/disabled state agrees with what the
  // server will actually accept, rather than letting a click through that
  // the server would then 400.
  const canSubmit =
    paymentMethod !== null && thisPayment > 0 && thisPayment <= remainingBalance + 0.001 && !payMutation.isPending

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6">
      <BackLink to="/visits" label={t('bill.backButton')} />

      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('bill.title')}</h1>
      </div>

      {/* ── Section 1 — Visit header ── */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3">
          <HeaderField label={t('bill.visitHeader.patient')} value={invoice.patientName} dir="auto" />
          <HeaderField label={t('bill.visitHeader.fileNo')} value={String(invoice.fileNo)} dir="ltr" />
          <HeaderField label={t('bill.visitHeader.doctor')} value={invoice.doctorName} dir="auto" />
          <HeaderField label={t('bill.visitHeader.queueNo')} value={String(invoice.queueNo)} dir="ltr" />
          <HeaderField label={t('bill.visitHeader.date')} value={dateLabel} dir="ltr" />
          <HeaderField label={t('bill.visitHeader.clinic')} value={invoice.clinic ?? '—'} dir="auto" />
        </CardContent>
      </Card>

      {/* ── Section 2 — Services ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="text-base font-semibold text-foreground">{t('bill.itemsTitle')}</h2>
          {invoice.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('bill.noItems')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('bill.columns.index')}</TableHead>
                  <TableHead>{t('bill.columns.code')}</TableHead>
                  <TableHead>{t('bill.columns.service')}</TableHead>
                  <TableHead className="text-end">{t('bill.columns.qty')}</TableHead>
                  <TableHead className="text-end">{t('bill.columns.unitPrice')}</TableHead>
                  <TableHead className="text-end">{t('bill.columns.discountPct')}</TableHead>
                  <TableHead className="text-end">{t('bill.columns.net')}</TableHead>
                  <TableHead className="text-end">{t('bill.columns.vat')}</TableHead>
                  <TableHead className="text-end">{t('bill.columns.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item, index) => (
                  <InvoiceItemRow key={item.itemId} item={item} index={index + 1} visitId={visitId} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3 — Totals + payment ── */}
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-1.5 text-sm">
            <TotalRow label={t('bill.totals.subtotal')} value={invoice.subtotal} />
            <TotalRow label={t('bill.totals.totalDiscount')} value={-invoice.totalDiscount} negative />
            <TotalRow label={t('bill.totals.netTotal')} value={invoice.netTotal} />
            <TotalRow label={t('bill.totals.vat')} value={invoice.totalVat} />
            <div className="my-1 border-t border-border" />
            <TotalRow label={t('bill.totals.grandTotal')} value={grandTotal} bold />
            {!isFirstPayment && (
              <>
                <TotalRow label={t('bill.alreadyCollectedLabel')} value={invoice.amountPaid} />
                <TotalRow label={t('bill.remainingBalanceLabel')} value={remainingBalance} bold />
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <h2 className="text-base font-semibold text-foreground">{t('bill.paymentTitle')}</h2>

            {!isFirstPayment && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {t('bill.partialNotice')}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t('bill.paymentMethod')}</label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={paymentMethod === method ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {t(`bill.methods.${method}`)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Insurance coverage split is established once, on the first
                payment, and locked in server-side from then on (finding
                M-1) — showing this form again on a repeat collection would
                just re-ask for details that no longer change anything. */}
            {paymentMethod === 'insurance' && isFirstPayment && (
              <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Insurance Provider / شركة التأمين</label>
                  <select
                    value={insuranceCo}
                    onChange={(e) => setInsuranceCo(e.target.value)}
                    className="py-1.5 px-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <option value="Tawuniya Insurance">Tawuniya Insurance (التعاونية)</option>
                    <option value="Bupa Arabia">Bupa Arabia (بوبا العربية)</option>
                    <option value="Medgulf">Medgulf (ميدغلف)</option>
                    <option value="Malath Insurance">Malath Insurance (ملاذ للتأمين)</option>
                    <option value="Wafa Insurance">Wafa Insurance (وفاء للتأمين)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground">Policy Number / رقم البوليصة</label>
                    <Input
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="e.g. POL-99201"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground">Approval Code / رقم الموافقة</label>
                    <Input
                      value={approvalCode}
                      onChange={(e) => setApprovalCode(e.target.value)}
                      placeholder="e.g. NPH-88301"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground">Insurance Coverage % / نسبة تغطية التأمين</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={coveragePercent}
                      onChange={(e) => setCoveragePercent(e.target.value)}
                      className="h-8 w-20 text-xs bg-white"
                    />
                    <span className="text-xs text-slate-500">%</span>
                  </div>
                </div>

                {/* Co-Pay Calculation Box */}
                {invoice && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs space-y-1">
                    <div className="flex justify-between text-emerald-800 dark:text-emerald-300">
                      <span>Insurance Share ({coveragePercent}%):</span>
                      <span className="font-mono font-bold">
                        {((invoice.grandTotal * (Number(coveragePercent) || 0)) / 100).toFixed(2)} SAR
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-900 dark:text-emerald-200 pt-1 border-t border-emerald-200/60">
                      <span>Patient Co-Pay Share:</span>
                      <span className="font-mono">
                        {(invoice.grandTotal - (invoice.grandTotal * (Number(coveragePercent) || 0)) / 100).toFixed(2)} SAR
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">{t('bill.amountPaidLabel')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={remainingBalance}
                dir="ltr"
                value={amountPaid}
                onChange={(event) => setAmountPaid(event.target.value)}
                className="max-w-[200px]"
              />
            </div>

            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-foreground">{t('bill.balanceLabel')}</span>
              <span className={cn('font-mono', balance > 0 ? 'text-danger-600' : 'text-success-600')} dir="ltr">
                {balance.toFixed(2)}
              </span>
            </div>

            <Button size="lg" className="w-full" disabled={!canSubmit} onClick={() => setConfirmPayOpen(true)}>
              {isFirstPayment ? t('bill.generateInvoice') : t('bill.collectPayment')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmPayOpen} onOpenChange={setConfirmPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('bill.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('bill.confirmDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('bill.paymentMethod')}</span>
              <span className="font-medium text-foreground">
                {paymentMethod && t(`bill.methods.${paymentMethod}`)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('bill.amountPaidLabel')}</span>
              <span className="font-mono font-medium text-foreground" dir="ltr">
                {(Number(amountPaid) || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('bill.balanceLabel')}</span>
              <span
                className={cn('font-mono font-medium', balance > 0 ? 'text-danger-600' : 'text-success-600')}
                dir="ltr"
              >
                {balance.toFixed(2)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmPayOpen(false)}
              disabled={payMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button type="button" onClick={() => payMutation.mutate()} disabled={payMutation.isPending}>
              {payMutation.isPending
                ? t('bill.generating')
                : isFirstPayment
                  ? t('bill.generateInvoice')
                  : t('bill.collectPayment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HeaderField({ label, value, dir }: { label: string; value: string; dir: 'ltr' | 'auto' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium text-foreground" dir={dir}>
        {value}
      </span>
    </div>
  )
}

function TotalRow({
  label,
  value,
  negative,
  bold,
}: {
  label: string
  value: number
  negative?: boolean
  bold?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between', bold && 'text-base font-semibold text-foreground')}>
      <span className={bold ? undefined : 'text-muted-foreground'}>{label}</span>
      <span className="font-mono" dir="ltr">
        {negative ? `(${Math.abs(value).toFixed(2)})` : value.toFixed(2)} SAR
      </span>
    </div>
  )
}

/**
 * Own component so each row's discount edit is independent local state,
 * committed on blur rather than every keystroke. `updateDiscount` only
 * returns the single updated item (not refreshed invoice totals), so a
 * successful edit invalidates the whole invoice query — the totals section
 * above always reflects the server's own calcTotals, never a client-side
 * recomputation that could drift from it.
 */
function InvoiceItemRow({ item, index, visitId }: { item: InvoiceItem; index: number; visitId: string }) {
  const { t } = useTranslation('visits')
  const { currentLang } = useLanguage()
  const queryClient = useQueryClient()
  const [discountPct, setDiscountPct] = useState(String(item.discountPct))

  const discountMutation = useMutation({
    mutationFn: (pct: number) => billingApi.updateDiscount(visitId, item.itemId, pct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceQueryKey(visitId) })
    },
    onError: () => {
      toast.error(t('bill.discountUpdateError'))
      setDiscountPct(String(item.discountPct))
    },
  })

  const commitDiscount = () => {
    const parsed = Math.min(100, Math.max(0, Number(discountPct) || 0))
    setDiscountPct(String(parsed))
    if (parsed !== item.discountPct) discountMutation.mutate(parsed)
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
        {index}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
        {item.codeNo ?? '—'}
      </TableCell>
      <TableCell dir="auto">{currentLang === 'ar' && item.nameAr ? item.nameAr : (item.nameEn ?? '—')}</TableCell>
      <TableCell className="text-end" dir="ltr">
        {item.qty}
      </TableCell>
      <TableCell className="text-end" dir="ltr">
        {item.unitPrice.toFixed(2)}
      </TableCell>
      <TableCell className="text-end">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.01"
          dir="ltr"
          value={discountPct}
          disabled={discountMutation.isPending}
          onChange={(event) => setDiscountPct(event.target.value)}
          onBlur={commitDiscount}
          className="ms-auto h-8 w-20 text-end"
        />
      </TableCell>
      <TableCell className="text-end" dir="ltr">
        {item.netPrice.toFixed(2)}
      </TableCell>
      <TableCell className="text-end" dir="ltr">
        {item.vatAmount.toFixed(2)}
      </TableCell>
      <TableCell className="text-end font-medium" dir="ltr">
        {item.totalWithVat.toFixed(2)}
      </TableCell>
    </TableRow>
  )
}
