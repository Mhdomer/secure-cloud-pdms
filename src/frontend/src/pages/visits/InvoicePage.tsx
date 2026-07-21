import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { BackLink } from '@/components/shared/BackLink'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { billingApi, departmentsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { InvoiceItem } from '@/types/billing'

const CLINIC_VAT_NO = '300020914400000'

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash / نقداً',
  card: 'Card / بطاقة',
  insurance: 'Insurance / تأمين',
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft / مسودة',
  pending_billing: 'Pending / قيد الفوترة',
  paid: 'Paid / مدفوعة',
  partial: 'Partial / جزئي',
  cancelled: 'Cancelled / ملغاة',
}

function invoiceQueryKey(visitId: string) {
  return ['visits', visitId, 'invoice'] as const
}

/**
 * `/visits/:visitId/invoice`, admin + doctor + patient. Print-ready receipt
 * — reached from TodaysVisitsPage's "View Invoice" once BillVisitPage's
 * payment has been collected, directly after "Generate Invoice" succeeds
 * there, or (patient) from a row in `MyBillingHistoryTab` / staff's
 * `BillingHistoryTab` on the patient profile. The back link goes to
 * `/visits` for staff/doctor (where they came from) but `/invoices` for a
 * patient — `/visits` itself is admin-only and would 403 them.
 *
 * Everything inside #invoice-print-area is deliberately hardcoded bilingual
 * (English + Arabic together, not switched by the app's language toggle) —
 * it mirrors the clinic's real paper Simplified Tax Invoice
 * (docs/real_samples/real_sample_invoice.pdf), which always prints both
 * languages on the same physical page regardless of who's reading it. Only
 * the chrome around the document (back link, print button, loading/error
 * states) follows the normal per-user language setting.
 */
export default function InvoicePage() {
  const { visitId } = useParams<{ visitId: string }>()
  const { t } = useTranslation('visits')
  const { t: tCommon } = useTranslation('common')
  const { isPatient, isSuperAdmin } = useAuth()
  // Superadmin has no /visits nav item at all (see Sidebar.tsx) — they only
  // ever reach this page via the billing report's drill-down, so send them
  // back there instead of a route they can't access.
  const backTo = isPatient ? '/invoices' : isSuperAdmin ? '/billing-report' : '/visits'

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
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  })

  if (!visitId) return null

  if (isLoading) {
    return <LoadingSpinner label={tCommon('loading')} />
  }

  if (isError || !invoice) {
    return (
      <div className="mx-auto flex max-w-[640px] flex-col gap-4">
        <EmptyState title={t('bill.notFoundTitle')} description={t('bill.loadError')} />
        <BackLink to={backTo} label={t('bill.backButton')} />
      </div>
    )
  }

  // Always both languages together, regardless of the viewer's own language
  // setting — matches every other bilingual field in this print area (see
  // file header comment).
  const clinicDepartment = departmentsData?.departments.find((d) => d.key === invoice.clinic)
  const clinicLabel = invoice.clinic
    ? clinicDepartment
      ? `${clinicDepartment.nameEn} / ${clinicDepartment.nameAr}`
      : invoice.clinic
    : '—'

  const dateLabel = new Intl.DateTimeFormat('en-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(invoice.createdAt))

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between print:hidden">
        <BackLink to={backTo} label={t('bill.backButton')} />
        <Button type="button" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t('invoicePage.printButton')}
        </Button>
      </div>

      {/* Raw <table>/borders instead of the shared Table component on
          purpose — this has to match a printed tax-form grid (visible cell
          borders on every side), not the app's normal bordered-row list
          styling. */}
      <div id="invoice-print-area" className="mx-auto w-full max-w-3xl bg-white p-6 text-neutral-900 print:p-0">
        <div className="flex items-center justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <img src="/images/logo-mark.png" alt="Al Amin Polyclinic" className="h-16 w-auto" />
          <div className="text-center">
            <h1 className="text-xl font-bold">مجمع عيادات الأمين الطبي</h1>
            <h2 className="text-lg font-bold">AL AMIN POLYCLINIC</h2>
          </div>
          <div className="text-end text-xs text-neutral-500">
            <p>فاتورة ضريبية مبسطة</p>
            <p>Simplified Tax Invoice</p>
            <p dir="ltr">VAT No: {CLINIC_VAT_NO}</p>
          </div>
        </div>

        <div className="mb-4 mt-4 grid grid-cols-2 gap-x-8 gap-y-1 rounded-md border border-neutral-300 p-4 text-sm sm:grid-cols-3">
          <InfoRow label="File No" labelAr="رقم الملف" value={`#${invoice.fileNo}`} />
          <InfoRow label="Name" labelAr="الاسم" value={invoice.patientName} />
          <InfoRow label="ID No" labelAr="رقم الهوية" value={invoice.nationalId ?? '—'} />
          <InfoRow label="Doctor" labelAr="الطبيب" value={`Dr. ${invoice.doctorName}`} />
          <InfoRow label="Inv. No" labelAr="رقم الفاتورة" value={invoice.invNo} />
          <InfoRow label="Clinic" labelAr="العيادة" value={clinicLabel} />
          <InfoRow label="Visit" labelAr="رقم الانتظار" value={`#${invoice.queueNo}`} />
          <InfoRow label="Date" labelAr="التاريخ" value={dateLabel} />
          {invoice.insuranceCo && <InfoRow label="Insurance Co" labelAr="شركة التأمين" value={invoice.insuranceCo} />}
        </div>

        <table className="mb-4 w-full border-collapse border border-neutral-300 text-sm">
          <thead className="bg-neutral-100 text-xs">
            <tr>
              <th className="border border-neutral-300 px-2 py-1 text-start">#</th>
              <th className="border border-neutral-300 px-2 py-1 text-start">Code / رقم الخدمة</th>
              <th className="border border-neutral-300 px-2 py-1 text-start">Description / الوصف</th>
              <th className="border border-neutral-300 px-2 py-1 text-end">Qty / الكمية</th>
              <th className="border border-neutral-300 px-2 py-1 text-end">Price / السعر</th>
              <th className="border border-neutral-300 px-2 py-1 text-end">Disc % / الخصم</th>
              <th className="border border-neutral-300 px-2 py-1 text-end">Net / الصافي</th>
              <th className="border border-neutral-300 px-2 py-1 text-end">VAT / الضريبة</th>
              <th className="border border-neutral-300 px-2 py-1 text-end">Total / الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-neutral-300 px-3 py-4 text-center text-neutral-500">
                  Consultation only — no services / استشارة فقط — لا توجد خدمات
                </td>
              </tr>
            ) : (
              invoice.items.map((item, index) => <InvoiceLineRow key={item.itemId} item={item} index={index + 1} />)
            )}
          </tbody>
        </table>

        <div className="mb-4 flex justify-end">
          <div className="flex w-64 flex-col gap-1 text-sm">
            <TotalRow label="Subtotal / الاجمالي" value={invoice.subtotal} />
            <TotalRow label="Discount / الخصم" value={-invoice.totalDiscount} negative />
            <TotalRow label="Net / الصافي" value={invoice.netTotal} />
            <TotalRow label="VAT 15% / الضريبة" value={invoice.totalVat} />
            <div className="mt-1 border-t border-neutral-900 pt-1">
              <TotalRow label="Grand Total / الإجمالي شامل الضريبة" value={invoice.grandTotal} bold />
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-md border border-neutral-300 p-3 text-sm">
          <span>
            Amount Paid / المدفوع: <strong dir="ltr">{invoice.amountPaid.toFixed(2)} SAR</strong>
          </span>
          <span>
            Balance / الباقي: <strong dir="ltr">{invoice.amountBalance.toFixed(2)} SAR</strong>
          </span>
          <span>
            Payment / طريقة الدفع:{' '}
            <strong>{invoice.paymentMethod ? PAYMENT_METHOD_LABEL[invoice.paymentMethod] : '—'}</strong>
          </span>
          <span>
            Status / الحالة: <strong>{INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</strong>
          </span>
          <span className="col-span-2 border-t border-dashed border-neutral-200 pt-1.5">
            Billed By (Staff / Cashier) / صُدرت بواسطة موظف الاستقبال:{' '}
            <strong className="font-semibold text-neutral-800">
              {invoice.paidByStaffName ? invoice.paidByStaffName : 'Pending Payment (Not Billed Yet) / بانتظار إتمام المحاسبة'}
            </strong>
          </span>
        </div>

        <div className="border-t border-neutral-300 pt-3 text-center text-xs text-neutral-500">
          <p>مراجعة مجانية خلال ١٤ يوم من تاريخ فاتورة الكشف المدفوع</p>
          <p>Free follow-up within 14 days from the date of the paid invoice</p>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, labelAr, value }: { label: string; labelAr: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-[110px] shrink-0 text-neutral-500">
        {label} / {labelAr}:
      </span>
      <span className="truncate font-medium" dir="auto">
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
    <div className={cn('flex justify-between', bold && 'text-base font-bold')}>
      <span className={bold ? undefined : 'text-neutral-500'}>{label}</span>
      <span dir="ltr">{negative ? `(${Math.abs(value).toFixed(2)})` : value.toFixed(2)} SAR</span>
    </div>
  )
}

function InvoiceLineRow({ item, index }: { item: InvoiceItem; index: number }) {
  return (
    <tr>
      <td className="border border-neutral-300 px-2 py-1">{index}</td>
      <td className="border border-neutral-300 px-2 py-1 font-mono" dir="ltr">
        {item.codeNo ?? '—'}
      </td>
      <td className="border border-neutral-300 px-2 py-1">{item.nameEn ?? item.nameAr ?? '—'}</td>
      <td className="border border-neutral-300 px-2 py-1 text-end" dir="ltr">
        {item.qty}
      </td>
      <td className="border border-neutral-300 px-2 py-1 text-end" dir="ltr">
        {item.unitPrice.toFixed(2)}
      </td>
      <td className="border border-neutral-300 px-2 py-1 text-end" dir="ltr">
        {item.discountPct.toFixed(2)}%
      </td>
      <td className="border border-neutral-300 px-2 py-1 text-end" dir="ltr">
        {item.netPrice.toFixed(2)}
      </td>
      <td className="border border-neutral-300 px-2 py-1 text-end" dir="ltr">
        {item.vatAmount.toFixed(2)}
      </td>
      <td className="border border-neutral-300 px-2 py-1 text-end font-medium" dir="ltr">
        {item.totalWithVat.toFixed(2)}
      </td>
    </tr>
  )
}
