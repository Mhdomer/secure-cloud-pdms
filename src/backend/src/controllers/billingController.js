'use strict';
const { withTransaction } = require('../config/database');
const { calcItem, calcTotals } = require('../utils/invoiceCalc');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

const ITEM_COLS = `item_id, invoice_id, service_id, code_no, name_en, name_ar,
  qty, unit_price, discount_pct, discount_amount, net_price,
  vat_pct, vat_amount, total_with_vat, sort_order`;

// Every other controller in this app (patientsController, clinicServices
// Controller, visitsController) maps snake_case DB columns to camelCase
// before res.json — every frontend type in the app is camelCase to match.
// These two keep visit_invoices/invoice_items responses consistent with
// that instead of being the one raw-snake_case corner of the API.
function toInvoiceRow(r) {
  return {
    invoiceId: r.invoice_id,
    invNo: r.inv_no,
    visitId: r.visit_id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    paymentMethod: r.payment_method,
    insuranceCo: r.insurance_co,
    subtotal: parseFloat(r.subtotal),
    totalDiscount: parseFloat(r.total_discount),
    netTotal: parseFloat(r.net_total),
    totalVat: parseFloat(r.total_vat),
    grandTotal: parseFloat(r.grand_total),
    amountPaid: parseFloat(r.amount_paid),
    amountBalance: parseFloat(r.amount_balance),
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

// Shared by listForPatient/listMine below — a slimmer row than
// toInvoiceRow (no items, no patient/doctor/visit joins), just enough for a
// billing-history list that links out to GET /visits/:visitId/invoice for
// the full printable detail.
function toSummaryRow(r) {
  return {
    invoiceId: r.invoice_id,
    invNo: r.inv_no,
    visitId: r.visit_id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    status: r.status,
    grandTotal: parseFloat(r.grand_total),
    amountPaid: parseFloat(r.amount_paid),
    amountBalance: parseFloat(r.amount_balance),
    createdAt: r.created_at,
  };
}

function toItemRow(r) {
  return {
    itemId: r.item_id,
    invoiceId: r.invoice_id,
    serviceId: r.service_id,
    codeNo: r.code_no,
    nameEn: r.name_en,
    nameAr: r.name_ar,
    qty: r.qty,
    unitPrice: parseFloat(r.unit_price),
    discountPct: parseFloat(r.discount_pct),
    discountAmount: parseFloat(r.discount_amount),
    netPrice: parseFloat(r.net_price),
    vatPct: parseFloat(r.vat_pct),
    vatAmount: parseFloat(r.vat_amount),
    totalWithVat: parseFloat(r.total_with_vat),
    sortOrder: r.sort_order,
  };
}

/**
 * `visits`/`visit_invoices`/`invoice_items` have no RLS (schema.sql only
 * protects patients/medical_records/lab_results), so this is the only
 * place a doctor or patient session is scoped to their own visit — without
 * it, any doctor could read, bill, or write prescription_notes onto any
 * other doctor's patient's visit just by knowing/guessing a visitId, and
 * any patient could read another patient's invoice the same way. Same
 * generic-404 convention as visitsController (avoids leaking which case
 * occurred). Admin is unrestricted, matching admin_select_patients
 * elsewhere — staff bill any patient's visit.
 */
async function assertOwnVisit(client, visitId, session) {
  const { rows } = await client.query(`SELECT doctor_id, patient_id FROM visits WHERE visit_id = $1`, [visitId]);
  if (!rows.length) {
    const e = new Error('Visit not found');
    e.statusCode = 404;
    throw e;
  }
  if (session.role === ROLES.DOCTOR && rows[0].doctor_id !== session.doctorId) {
    const e = new Error('Visit not found');
    e.statusCode = 404;
    throw e;
  }
  if (session.role === ROLES.PATIENT && rows[0].patient_id !== session.patientId) {
    const e = new Error('Visit not found');
    e.statusCode = 404;
    throw e;
  }
}

async function ensureDraftInvoice(client, visitId, userId) {
  const existing = await client.query(
    `SELECT invoice_id FROM visit_invoices WHERE visit_id = $1`, [visitId]
  );
  if (existing.rows.length) return existing.rows[0].invoice_id;

  const visit = await client.query(
    `SELECT patient_id, doctor_id FROM visits WHERE visit_id = $1`, [visitId]
  );
  if (!visit.rows.length) {
    const e = new Error('Visit not found'); e.statusCode = 404; throw e;
  }
  const v = visit.rows[0];
  const { rows } = await client.query(
    `INSERT INTO visit_invoices (visit_id, patient_id, doctor_id, created_by)
     VALUES ($1,$2,$3,$4) RETURNING invoice_id`,
    [visitId, v.patient_id, v.doctor_id, userId]
  );
  return rows[0].invoice_id;
}

async function refreshTotals(client, invoiceId) {
  const { rows } = await client.query(
    `SELECT ${ITEM_COLS} FROM invoice_items WHERE invoice_id = $1`, [invoiceId]
  );
  if (!rows.length) {
    await client.query(
      `UPDATE visit_invoices
          SET subtotal=0, total_discount=0, net_total=0, total_vat=0,
              grand_total=0, amount_balance=0
        WHERE invoice_id=$1`, [invoiceId]
    );
    return;
  }
  const t = calcTotals(rows);
  await client.query(
    `UPDATE visit_invoices
        SET subtotal=$1, total_discount=$2, net_total=$3,
            total_vat=$4, grand_total=$5, amount_balance=($5 - amount_paid)
      WHERE invoice_id=$6`,
    [t.subtotal, t.total_discount, t.net_total, t.total_vat, t.grand_total, invoiceId]
  );
}

// ── GET /visits/:visitId/invoice  (doctor + admin) ───────────────────────
exports.getInvoice = async (req, res) => {
  const result = await withTransaction(req.rlsSession, async (client) => {
    await assertOwnVisit(client, req.params.visitId, req.rlsSession);
    const { rows } = await client.query(
      `SELECT vi.*,
              p.full_name AS patient_name, p.file_no, p.national_id,
              d.full_name AS doctor_name,
              v.queue_no, v.clinic, v.prescription_notes, v.checked_in_at
         FROM visit_invoices vi
         JOIN visits   v ON v.visit_id   = vi.visit_id
         JOIN patients p ON p.patient_id = vi.patient_id
         JOIN doctors  d ON d.doctor_id  = vi.doctor_id
        WHERE vi.visit_id = $1`,
      [req.params.visitId]
    );
    if (!rows.length) return null;
    const items = await client.query(
      `SELECT ${ITEM_COLS} FROM invoice_items
        WHERE invoice_id = $1 ORDER BY sort_order, item_id`,
      [rows[0].invoice_id]
    );
    return {
      ...toInvoiceRow(rows[0]),
      patientName: rows[0].patient_name,
      fileNo: rows[0].file_no,
      nationalId: rows[0].national_id,
      doctorName: rows[0].doctor_name,
      queueNo: rows[0].queue_no,
      clinic: rows[0].clinic,
      prescriptionNotes: rows[0].prescription_notes,
      checkedInAt: rows[0].checked_in_at,
      items: items.rows.map(toItemRow),
    };
  });
  if (!result) return res.status(404).json({ error: 'Invoice not found' });
  res.json(result);
};

// ── POST /visits/:visitId/invoice/items  (DOCTOR ONLY) ──────────────────
// Doctor adds a service during consultation. Auto-creates draft invoice.
exports.addItem = async (req, res) => {
  const { service_id, qty = 1, unit_price } = req.body;
  const result = await withTransaction(req.rlsSession, async (client) => {
    await assertOwnVisit(client, req.params.visitId, req.rlsSession);
    const invoiceId = await ensureDraftInvoice(client, req.params.visitId, req.user.userId);

    // Verify invoice is still editable by doctor
    const inv = await client.query(
      `SELECT status FROM visit_invoices WHERE invoice_id = $1`, [invoiceId]
    );
    if (!['draft'].includes(inv.rows[0].status)) {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }

    // Adding a service already on this invoice increases its quantity
    // instead of inserting a duplicate line — a printed invoice reads as one
    // row per distinct service with a qty column, not one row per click.
    // Custom items (no service_id) have no identity to merge on, so those
    // always insert a new row.
    const existing = service_id
      ? (await client.query(
          `SELECT * FROM invoice_items WHERE invoice_id = $1 AND service_id = $2`,
          [invoiceId, service_id]
        )).rows[0]
      : undefined;

    if (existing) {
      const calc = calcItem({
        unit_price: existing.unit_price,
        qty: existing.qty + qty,
        discount_pct: existing.discount_pct,
        vat_pct: existing.vat_pct,
      });
      await client.query(
        `UPDATE invoice_items
            SET qty=$1, discount_amount=$2, net_price=$3, vat_amount=$4, total_with_vat=$5
          WHERE item_id=$6`,
        [calc.qty, calc.discount_amount, calc.net_price, calc.vat_amount, calc.total_with_vat, existing.item_id]
      );
    } else {
      let code_no = null, name_en = null, name_ar = null, price = unit_price;
      if (service_id) {
        const svc = await client.query(
          `SELECT * FROM clinic_services WHERE service_id = $1`, [service_id]
        );
        if (svc.rows.length) {
          code_no    = svc.rows[0].code_no;
          name_en    = svc.rows[0].name_en;
          name_ar    = svc.rows[0].name_ar;
          price      = unit_price ?? svc.rows[0].base_price;
        }
      }

      const calc = calcItem({ unit_price: price, qty, discount_pct: 0, vat_pct: 15 });
      const nextOrder = await client.query(
        `SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM invoice_items WHERE invoice_id=$1`,
        [invoiceId]
      );

      await client.query(
        `INSERT INTO invoice_items
           (invoice_id, service_id, code_no, name_en, name_ar,
            qty, unit_price, discount_pct, discount_amount, net_price,
            vat_pct, vat_amount, total_with_vat, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [invoiceId, service_id ?? null, code_no, name_en, name_ar,
         calc.qty, calc.unit_price, 0, 0, calc.net_price,
         15, calc.vat_amount, calc.total_with_vat, nextOrder.rows[0].n]
      );
    }

    await refreshTotals(client, invoiceId);
    const updated = await client.query(
      `SELECT vi.*, i_items.items FROM visit_invoices vi,
         (SELECT json_agg(ii ORDER BY ii.sort_order) AS items
            FROM invoice_items ii WHERE ii.invoice_id = $1) i_items
        WHERE vi.invoice_id = $1`,
      [invoiceId]
    );
    const row = updated.rows[0];
    return { ...toInvoiceRow(row), items: (row.items || []).map(toItemRow) };
  });
  res.status(201).json(result);
};

// ── DELETE /visits/:visitId/invoice/items/:itemId  (DOCTOR ONLY) ─────────
exports.removeItem = async (req, res) => {
  await withTransaction(req.rlsSession, async (client) => {
    await assertOwnVisit(client, req.params.visitId, req.rlsSession);
    const invRow = await client.query(
      `SELECT vi.invoice_id, vi.status FROM visit_invoices vi
        WHERE vi.visit_id = $1`, [req.params.visitId]
    );
    if (!invRow.rows.length) {
      const e = new Error('Invoice not found'); e.statusCode = 404; throw e;
    }
    if (invRow.rows[0].status !== 'draft') {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }
    await client.query(
      `DELETE FROM invoice_items WHERE item_id=$1 AND invoice_id=$2`,
      [req.params.itemId, invRow.rows[0].invoice_id]
    );
    await refreshTotals(client, invRow.rows[0].invoice_id);
  });
  res.json({ message: 'Item removed' });
};

// ── PATCH /visits/:visitId/invoice/complete  (DOCTOR ONLY) ───────────────
// Doctor marks consultation done. Saves prescription + diagnosis notes,
// transitions invoice to pending_billing so staff can bill. Creates empty
// invoice if no items added.
exports.markDone = async (req, res) => {
  const { prescription_notes, notes } = req.body;
  await withTransaction(req.rlsSession, async (client) => {
    await assertOwnVisit(client, req.params.visitId, req.rlsSession);
    await client.query(
      `UPDATE visits SET status='completed', completed_at=NOW(),
              prescription_notes=$1, notes=COALESCE($3, notes)
        WHERE visit_id=$2`,
      [prescription_notes ?? null, req.params.visitId, notes ?? null]
    );
    const invoiceId = await ensureDraftInvoice(client, req.params.visitId, req.user.userId);
    await client.query(
      `UPDATE visit_invoices SET status='pending_billing' WHERE invoice_id=$1`,
      [invoiceId]
    );
    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.COMPLETE_VISIT,
      resource: 'visits',
      recordId: req.params.visitId,
      ipAddress: req.ip,
    });
  });
  res.json({ message: 'Consultation complete. Ready for billing.' });
};

// ── PATCH /visits/:visitId/invoice/items/:itemId/discount  (ADMIN ONLY) ──
// Staff applies discount per item before generating invoice. Admin isn't
// doctor-scoped (matches admin_select_patients elsewhere), so no
// assertOwnVisit call here — staff bill any patient's visit.
exports.updateDiscount = async (req, res) => {
  const { discount_pct } = req.body;
  const result = await withTransaction(req.rlsSession, async (client) => {
    const itemRow = await client.query(
      `SELECT ii.*, vi.status, vi.invoice_id
         FROM invoice_items ii
         JOIN visit_invoices vi ON vi.invoice_id = ii.invoice_id
        WHERE ii.item_id = $1 AND vi.visit_id = $2`,
      [req.params.itemId, req.params.visitId]
    );
    if (!itemRow.rows.length) {
      const e = new Error('Item not found'); e.statusCode = 404; throw e;
    }
    const item = itemRow.rows[0];
    // Once any money has moved (paid/partial) or the invoice is voided,
    // a discount change would silently desync amount_paid/amount_balance
    // from the new totals — only draft/pending_billing are editable, not
    // just "not yet paid" (the original check here only blocked 'paid',
    // missing 'partial' and 'cancelled').
    if (!['draft', 'pending_billing'].includes(item.status)) {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }
    const calc = calcItem({
      unit_price: item.unit_price,
      qty: item.qty,
      discount_pct,
      vat_pct: item.vat_pct,
    });
    await client.query(
      `UPDATE invoice_items
          SET discount_pct=$1, discount_amount=$2, net_price=$3,
              vat_amount=$4, total_with_vat=$5
        WHERE item_id=$6`,
      [calc.discount_pct, calc.discount_amount, calc.net_price,
       calc.vat_amount, calc.total_with_vat, req.params.itemId]
    );
    await refreshTotals(client, item.invoice_id);
    const { rows } = await client.query(
      `SELECT * FROM invoice_items WHERE item_id=$1`, [req.params.itemId]
    );
    return toItemRow(rows[0]);
  });
  res.json(result);
};

// ── PATCH /visits/:visitId/invoice/items/:itemId/qty  (DOCTOR ONLY) ──────
// Doctor adjusts an already-added item's quantity directly (e.g. "2
// sessions of X") instead of removing and re-adding it. Draft-only — once
// the visit is marked done the doctor's own editing window is over (matches
// removeItem's restriction, not updateDiscount's, since this is the
// doctor's item, not staff's billing adjustment).
exports.updateQty = async (req, res) => {
  const { qty } = req.body;
  const result = await withTransaction(req.rlsSession, async (client) => {
    await assertOwnVisit(client, req.params.visitId, req.rlsSession);
    const itemRow = await client.query(
      `SELECT ii.*, vi.status, vi.invoice_id
         FROM invoice_items ii
         JOIN visit_invoices vi ON vi.invoice_id = ii.invoice_id
        WHERE ii.item_id = $1 AND vi.visit_id = $2`,
      [req.params.itemId, req.params.visitId]
    );
    if (!itemRow.rows.length) {
      const e = new Error('Item not found'); e.statusCode = 404; throw e;
    }
    const item = itemRow.rows[0];
    if (item.status !== 'draft') {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }
    const calc = calcItem({
      unit_price: item.unit_price,
      qty,
      discount_pct: item.discount_pct,
      vat_pct: item.vat_pct,
    });
    await client.query(
      `UPDATE invoice_items
          SET qty=$1, discount_amount=$2, net_price=$3, vat_amount=$4, total_with_vat=$5
        WHERE item_id=$6`,
      [calc.qty, calc.discount_amount, calc.net_price, calc.vat_amount, calc.total_with_vat, req.params.itemId]
    );
    await refreshTotals(client, item.invoice_id);
    const { rows } = await client.query(
      `SELECT * FROM invoice_items WHERE item_id=$1`, [req.params.itemId]
    );
    return toItemRow(rows[0]);
  });
  res.json(result);
};

// ── PATCH /visits/:visitId/invoice/pay  (ADMIN ONLY) ─────────────────────
// Staff collects payment and finalizes the invoice.
exports.payInvoice = async (req, res) => {
  const { payment_method, amount_paid, insurance_co } = req.body;
  const result = await withTransaction(req.rlsSession, async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM visit_invoices WHERE visit_id=$1`, [req.params.visitId]
    );
    if (!rows.length) {
      const e = new Error('Invoice not found'); e.statusCode = 404; throw e;
    }
    if (rows[0].status === 'paid') {
      const e = new Error('Invoice already paid'); e.statusCode = 409; throw e;
    }
    // Also reject 'draft' (doctor hasn't marked the visit done yet — nothing
    // for staff to bill) and 'cancelled' (voided) — the original check only
    // caught the already-paid case, not these.
    if (!['pending_billing', 'partial'].includes(rows[0].status)) {
      const e = new Error('Invoice is not ready for payment'); e.statusCode = 409; throw e;
    }
    const inv     = rows[0];
    const paid    = parseFloat(amount_paid);
    const balance = Math.round((parseFloat(inv.grand_total) - paid) * 100) / 100;
    const status  = balance <= 0 ? 'paid' : 'partial';
    const { rows: updated } = await client.query(
      `UPDATE visit_invoices
          SET payment_method=$1, insurance_co=$2, amount_paid=$3,
              amount_balance=$4, status=$5, paid_at=NOW()
        WHERE invoice_id=$6 RETURNING *`,
      [payment_method, insurance_co ?? null, paid, balance, status, inv.invoice_id]
    );
    await client.query(
      `UPDATE visits SET status='billed' WHERE visit_id=$1`, [req.params.visitId]
    );
    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.COLLECT_PAYMENT,
      resource: 'visit_invoices',
      recordId: inv.invoice_id,
      ipAddress: req.ip,
    });
    return toInvoiceRow(updated[0]);
  });
  res.json(result);
};

// ── GET /patients/:patientId/billing  (admin + doctor) ───────────────────
// Doctor sees only invoices from visits they themselves treated (same
// scoping assertOwnVisit uses above); admin sees every invoice for the
// patient regardless of doctor, matching admin_select_patients elsewhere.
// No RLS on visit_invoices (see assertOwnVisit's comment), so this
// app-layer filter is what actually enforces the boundary.
exports.listForPatient = async (req, res) => {
  const { patientId } = req.params;
  const { role, doctorId } = req.rlsSession;
  const params = [patientId];
  let doctorFilter = '';
  if (role === ROLES.DOCTOR) {
    params.push(doctorId);
    doctorFilter = `AND doctor_id = $${params.length}`;
  }
  const result = await withTransaction(req.rlsSession, (client) =>
    client.query(
      `SELECT invoice_id, inv_no, visit_id, patient_id, doctor_id, status,
              grand_total, amount_paid, amount_balance, created_at
         FROM visit_invoices
        WHERE patient_id = $1 ${doctorFilter}
        ORDER BY created_at DESC`,
      params
    )
  );
  res.json({ invoices: result.rows.map(toSummaryRow) });
};

// ── GET /billing/mine  (patient) ──────────────────────────────────────────
// patientId comes from the session, never a route param — a patient can
// never be handed another patient's billing history by changing a URL.
// Drafts are excluded: that status means a doctor is still mid-consultation
// adding items, nothing final to show a patient yet.
exports.listMine = async (req, res) => {
  const { patientId } = req.rlsSession;
  const result = await withTransaction(req.rlsSession, (client) =>
    client.query(
      `SELECT invoice_id, inv_no, visit_id, patient_id, doctor_id, status,
              grand_total, amount_paid, amount_balance, created_at
         FROM visit_invoices
        WHERE patient_id = $1 AND status != 'draft'
        ORDER BY created_at DESC`,
      [patientId]
    )
  );
  res.json({ invoices: result.rows.map(toSummaryRow) });
};

// ── GET /billing/report?date=YYYY-MM-DD  (admin + superadmin) ───────────
// Staff end-of-day revenue reconciliation. `paid_at` (not created_at) is the
// basis — see schema.sql's comment on that column. Defaults to "today" in
// the clinic's real timezone (Asia/Riyadh), same reasoning as
// visitsController.js's TODAY_START_SQL — resolved to an explicit date
// string here so the query always takes exactly one date param either way.
exports.getDailyReport = async (req, res) => {
  const reportDate = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const dayStart = `($1::date AT TIME ZONE 'Asia/Riyadh')`;
  const dayCondition = `paid_at >= ${dayStart} AND paid_at < ${dayStart} + INTERVAL '1 day'`;

  const result = await withTransaction(req.rlsSession, async (client) => {
    const totals = await client.query(
      `SELECT COUNT(*)::int AS total_invoices, COALESCE(SUM(amount_paid),0) AS total_revenue
         FROM visit_invoices
        WHERE ${dayCondition}`,
      [reportDate]
    );
    const byDoctor = await client.query(
      `SELECT vi.doctor_id, d.full_name AS doctor_name,
              COUNT(*)::int AS invoice_count, COALESCE(SUM(vi.amount_paid),0) AS revenue
         FROM visit_invoices vi
         JOIN doctors d ON d.doctor_id = vi.doctor_id
        WHERE ${dayCondition}
        GROUP BY vi.doctor_id, d.full_name
        ORDER BY revenue DESC`,
      [reportDate]
    );
    const byClinic = await client.query(
      `SELECT COALESCE(v.clinic, 'unspecified') AS clinic,
              COUNT(*)::int AS invoice_count, COALESCE(SUM(vi.amount_paid),0) AS revenue
         FROM visit_invoices vi
         JOIN visits v ON v.visit_id = vi.visit_id
        WHERE ${dayCondition}
        GROUP BY COALESCE(v.clinic, 'unspecified')
        ORDER BY revenue DESC`,
      [reportDate]
    );
    return { totals: totals.rows[0], byDoctor: byDoctor.rows, byClinic: byClinic.rows };
  });

  res.json({
    date: reportDate,
    totalInvoices: result.totals.total_invoices,
    totalRevenue: parseFloat(result.totals.total_revenue),
    byDoctor: result.byDoctor.map((r) => ({
      doctorId: r.doctor_id,
      doctorName: r.doctor_name,
      invoiceCount: r.invoice_count,
      revenue: parseFloat(r.revenue),
    })),
    byClinic: result.byClinic.map((r) => ({
      clinic: r.clinic,
      invoiceCount: r.invoice_count,
      revenue: parseFloat(r.revenue),
    })),
  });
};

// ── GET /billing/report/invoices?date=&doctor_id=&clinic=  (admin + superadmin) ──
// Drill-down from the daily report ("View Invoices" per doctor/clinic row) —
// the actual invoice rows behind one day's (optionally one doctor's / one
// clinic's) totals. Each row links out to GET /visits/:visitId/invoice
// (InvoicePage) for the full printable detail. Same paid_at day-boundary
// logic as getDailyReport, so the drill-down always matches the totals it
// was reached from.
exports.getDailyInvoices = async (req, res) => {
  const reportDate = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const { doctor_id: doctorId, clinic } = req.query;
  const dayStart = `($1::date AT TIME ZONE 'Asia/Riyadh')`;
  const conditions = [`vi.paid_at >= ${dayStart}`, `vi.paid_at < ${dayStart} + INTERVAL '1 day'`];
  const params = [reportDate];

  if (doctorId) {
    params.push(doctorId);
    conditions.push(`vi.doctor_id = $${params.length}`);
  }
  if (clinic) {
    if (clinic === 'unspecified') {
      conditions.push(`v.clinic IS NULL`);
    } else {
      params.push(clinic);
      conditions.push(`v.clinic = $${params.length}`);
    }
  }

  const result = await withTransaction(req.rlsSession, (client) =>
    client.query(
      `SELECT vi.invoice_id, vi.inv_no, vi.visit_id, vi.patient_id, vi.doctor_id, vi.status,
              vi.payment_method, vi.grand_total, vi.amount_paid, vi.amount_balance, vi.paid_at,
              p.full_name AS patient_name, p.file_no,
              d.full_name AS doctor_name,
              v.queue_no, v.clinic
         FROM visit_invoices vi
         JOIN patients p ON p.patient_id = vi.patient_id
         JOIN doctors  d ON d.doctor_id  = vi.doctor_id
         JOIN visits   v ON v.visit_id   = vi.visit_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY vi.paid_at DESC`,
      params
    )
  );

  res.json({
    date: reportDate,
    invoices: result.rows.map((r) => ({
      invoiceId: r.invoice_id,
      invNo: r.inv_no,
      visitId: r.visit_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      fileNo: r.file_no,
      doctorId: r.doctor_id,
      doctorName: r.doctor_name,
      clinic: r.clinic,
      queueNo: r.queue_no,
      status: r.status,
      paymentMethod: r.payment_method,
      grandTotal: parseFloat(r.grand_total),
      amountPaid: parseFloat(r.amount_paid),
      amountBalance: parseFloat(r.amount_balance),
      paidAt: r.paid_at,
    })),
  });
};
