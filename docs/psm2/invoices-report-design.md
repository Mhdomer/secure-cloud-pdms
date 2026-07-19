# Staff Invoices/Billing Report — Design

Sprint 3c addition. Staff currently have no way to see clinic-wide billing
activity — only per-patient billing history and one-invoice-at-a-time views
(BillVisitPage, InvoicePage). Front desk staff need an end-of-day view to
reconcile how much revenue came in and from where.

## Access

Admin + Superadmin. Not doctor-facing (billing/collections is staff's
domain, same as BillVisitPage/TodaysVisitsPage today) and not patient-facing
(patients already have their own `/invoices` page for their own history).

## Data model change

`visit_invoices` gains a nullable `paid_at TIMESTAMPTZ`, set the moment
`payInvoice` transitions an invoice to `paid` or `partial`. Existing rows
default to `NULL` (their revenue is invisible to this report, which is
correct — the report only reflects payments collected after this ships).

This clinic's workflow has no postponed/deferred invoices (payment happens
same visit), so `paid_at` and invoice-creation date are expected to coincide
in practice — but tracking the actual payment moment (rather than reusing
`created_at`, which is set when the doctor completes the visit, before any
money changes hands) is the technically correct basis for a revenue report
and costs nothing extra to get right.

Known simplification: if a partial payment is later topped up on a
different day, `paid_at` moves to the most recent payment action (no
payment-history ledger). Acceptable given this clinic's same-day-payment
workflow; would need revisiting if postponed/partial-then-later-full
payments become common.

## Backend

`GET /billing/report?date=YYYY-MM-DD` (admin + superadmin only, mounted
alongside the existing `/billing/mine` route in `billingHistory.routes.js`).
`date` defaults to today (Asia/Riyadh) if omitted — the same clinic-timezone
day-boundary logic `visitsController.js`'s `TODAY_START_SQL` already uses,
applied to an explicit date instead of always "now".

Response:
```json
{
  "date": "2026-07-19",
  "totalInvoices": 12,
  "totalRevenue": 4350.00,
  "byDoctor": [{ "doctorId": "...", "doctorName": "...", "invoiceCount": 5, "revenue": 1800.00 }],
  "byClinic": [{ "clinic": "general", "invoiceCount": 7, "revenue": 2600.00 }]
}
```

All aggregation (`COUNT`, `SUM`, `GROUP BY`) happens in SQL — matches this
app's existing convention that money math is always server-side
(`invoiceCalc.js`, `refreshTotals`), never summed client-side.

## Frontend

New page, route `/billing-report`, doctor excluded. Two stat cards up top
(Invoices Today, Total Revenue), a date input defaulting to today (free to
add once the backend takes a date param — lets staff also check yesterday),
and two tables below it (by doctor, by clinic). New sidebar entry for admin
and superadmin — clearly visible, not buried in an existing page.

## Explicitly out of scope for this pass

Multi-day date *ranges* (only a single day at a time for now), drilling
into a doctor/clinic row to see its underlying invoice list, export/print,
trend charts over time. The single-day endpoint design doesn't block adding
any of these later.
