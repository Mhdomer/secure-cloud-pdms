'use strict';
const { withTransaction } = require('../config/database');
const { calcItem, calcTotals, round } = require('../utils/invoiceCalc');
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
    paidBy: r.paid_by,
    paidAt: r.paid_at,
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
 * `visits`/`visit_invoices`/`invoice_items` DO now carry RLS (schema.sql's
 * "HIGH-03 audit fix" section — `admin_all_visits`/`doctor_own_visits`/
 * `patient_own_visits` and their `_invoices`/`_items` equivalents, added
 * after this function and comment were first written). This app-layer
 * check is intentionally redundant with that DB-layer enforcement, not a
 * substitute for it — kept because it's what actually produces a clean
 * 404 (RLS alone would just make the row invisible, which without this
 * explicit check would surface as a confusing empty-result path deeper in
 * each handler) and because defense-in-depth here is cheap. Same
 * generic-404 convention as visitsController (avoids leaking which case
 * occurred — missing vs. not-yours). Admin is unrestricted, matching
 * admin_select_patients elsewhere — staff bill any patient's visit.
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
  // ON CONFLICT DO NOTHING + fallback SELECT (rather than a bare INSERT)
  // closes a real race: two near-simultaneous first-add-item calls for the
  // same visit (double-click, retried request) could otherwise both pass
  // the "no existing invoice" check above and both attempt the INSERT —
  // visit_invoices.visit_id is UNIQUE, so the loser would throw an
  // unhandled 23505 instead of just reusing the winner's row.
  const inserted = await client.query(
    `INSERT INTO visit_invoices (visit_id, patient_id, doctor_id, created_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (visit_id) DO NOTHING
     RETURNING invoice_id`,
    [visitId, v.patient_id, v.doctor_id, userId]
  );
  if (inserted.rows.length) return inserted.rows[0].invoice_id;
  const { rows } = await client.query(
    `SELECT invoice_id FROM visit_invoices WHERE visit_id = $1`, [visitId]
  );
  return rows[0].invoice_id;
}

/**
 * Locks the invoice row for the remainder of this transaction — every
 * billing mutation (addItem, removeItem, updateQty, updateDiscount,
 * payInvoice) takes this lock first, so two concurrent mutations against
 * the *same* invoice serialize instead of racing (lost updates on totals,
 * duplicate line items, double-processed payments — see
 * docs/psm2/qa-audit-2026-07-24.md finding H-1). Postgres blocks a second
 * `FOR UPDATE` on the same row until the first transaction commits/rolls
 * back, so the second caller simply waits and then sees the first caller's
 * committed result before doing its own read-modify-write.
 */
async function lockInvoice(client, invoiceId) {
  const { rows } = await client.query(
    `SELECT * FROM visit_invoices WHERE invoice_id = $1 FOR UPDATE`, [invoiceId]
  );
  if (!rows.length) {
    const e = new Error('Invoice not found'); e.statusCode = 404; throw e;
  }
  return rows[0];
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
              u_created.username AS created_by_staff_name,
              u_paid.username AS paid_by_staff_name,
              v.queue_no, v.clinic, v.prescription_notes, v.checked_in_at
         FROM visit_invoices vi
         JOIN visits   v ON v.visit_id   = vi.visit_id
         JOIN patients p ON p.patient_id = vi.patient_id
         JOIN doctors  d ON d.doctor_id  = vi.doctor_id
         LEFT JOIN users u_created ON u_created.user_id = vi.created_by
         LEFT JOIN users u_paid    ON u_paid.user_id    = vi.paid_by
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
      createdByStaffName: rows[0].created_by_staff_name,
      paidByStaffName: rows[0].paid_by_staff_name,
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

    // Locks the invoice row so two near-simultaneous addItem calls for the
    // same invoice (double-click, retried request) can't both read the
    // same "no existing line for this service" snapshot and both insert a
    // duplicate row instead of merging into one qty (finding H-1).
    const inv = await lockInvoice(client, invoiceId);
    if (inv.status !== 'draft') {
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
      // A resent unit_price on a merge used to be silently dropped (finding
      // M-2) — if the caller explicitly sent one this time (e.g. the
      // catalog price changed mid-consultation), honor it instead of
      // always reusing whatever price the first add happened to use.
      const mergedPrice = unit_price ?? existing.unit_price;
      const calc = calcItem({
        unit_price: mergedPrice,
        qty: existing.qty + qty,
        discount_pct: existing.discount_pct,
        vat_pct: existing.vat_pct,
      });
      await client.query(
        `UPDATE invoice_items
            SET qty=$1, unit_price=$2, discount_amount=$3, net_price=$4, vat_amount=$5, total_with_vat=$6
          WHERE item_id=$7`,
        [calc.qty, calc.unit_price, calc.discount_amount, calc.net_price, calc.vat_amount, calc.total_with_vat, existing.item_id]
      );
    } else {
      let code_no = null, name_en = null, name_ar = null, price = unit_price, vatPct = 15;
      if (service_id) {
        const svc = await client.query(
          `SELECT * FROM clinic_services WHERE service_id = $1`, [service_id]
        );
        if (svc.rows.length) {
          code_no    = svc.rows[0].code_no;
          name_en    = svc.rows[0].name_en;
          name_ar    = svc.rows[0].name_ar;
          price      = unit_price ?? svc.rows[0].base_price;
          // Was hardcoded to 15 regardless of the catalog's own vat_pct
          // (finding C-2) — a service deliberately configured at 0% VAT
          // (Saudi VAT zero-rates a lot of essential healthcare) was
          // silently overridden and the patient over-charged.
          vatPct     = svc.rows[0].vat_pct != null ? parseFloat(svc.rows[0].vat_pct) : 15;
        }
      }

      const calc = calcItem({ unit_price: price, qty, discount_pct: 0, vat_pct: vatPct });
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
         calc.vat_pct, calc.vat_amount, calc.total_with_vat, nextOrder.rows[0].n]
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
    const invIdRow = await client.query(
      `SELECT invoice_id FROM visit_invoices WHERE visit_id = $1`, [req.params.visitId]
    );
    if (!invIdRow.rows.length) {
      const e = new Error('Invoice not found'); e.statusCode = 404; throw e;
    }
    const inv = await lockInvoice(client, invIdRow.rows[0].invoice_id);
    if (inv.status !== 'draft') {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }
    await client.query(
      `DELETE FROM invoice_items WHERE item_id=$1 AND invoice_id=$2`,
      [req.params.itemId, inv.invoice_id]
    );
    await refreshTotals(client, inv.invoice_id);
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
    // Used to have no status precondition at all — a direct API call (or a
    // doctor navigating straight to a visit's /consult URL without ever
    // clicking "start") could jump 'waiting' straight to 'completed', or
    // silently resurrect an already-'billed'/'cancelled' visit. Checked
    // explicitly here (not just left to the DB trigger below) so this
    // gives a specific, on-topic message rather than the trigger's more
    // generic one — `assertOwnVisit` above already confirmed the visit
    // exists and is this doctor's, so 0 rows here can only mean the status
    // precondition failed, never a missing-visit case.
    const updated = await client.query(
      `UPDATE visits SET status='completed', completed_at=NOW(),
              prescription_notes=$1, notes=COALESCE($3, notes)
        WHERE visit_id=$2 AND status='in_progress'
        RETURNING visit_id`,
      [prescription_notes ?? null, req.params.visitId, notes ?? null]
    );
    if (!updated.rows.length) {
      const e = new Error('This visit has not been started yet, or was already completed');
      e.statusCode = 409;
      throw e;
    }
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
    const invIdRow = await client.query(
      `SELECT invoice_id FROM visit_invoices WHERE visit_id = $1`, [req.params.visitId]
    );
    if (!invIdRow.rows.length) {
      const e = new Error('Item not found'); e.statusCode = 404; throw e;
    }
    const inv = await lockInvoice(client, invIdRow.rows[0].invoice_id);
    // Once any money has moved (paid/partial) or the invoice is voided,
    // a discount change would silently desync amount_paid/amount_balance
    // from the new totals — only draft/pending_billing are editable, not
    // just "not yet paid" (the original check here only blocked 'paid',
    // missing 'partial' and 'cancelled').
    if (!['draft', 'pending_billing'].includes(inv.status)) {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }
    const itemRow = await client.query(
      `SELECT * FROM invoice_items WHERE item_id = $1 AND invoice_id = $2`,
      [req.params.itemId, inv.invoice_id]
    );
    if (!itemRow.rows.length) {
      const e = new Error('Item not found'); e.statusCode = 404; throw e;
    }
    const item = itemRow.rows[0];
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
    const invIdRow = await client.query(
      `SELECT invoice_id FROM visit_invoices WHERE visit_id = $1`, [req.params.visitId]
    );
    if (!invIdRow.rows.length) {
      const e = new Error('Item not found'); e.statusCode = 404; throw e;
    }
    const inv = await lockInvoice(client, invIdRow.rows[0].invoice_id);
    if (inv.status !== 'draft') {
      const e = new Error('Invoice is no longer editable'); e.statusCode = 409; throw e;
    }
    const itemRow = await client.query(
      `SELECT * FROM invoice_items WHERE item_id = $1 AND invoice_id = $2`,
      [req.params.itemId, inv.invoice_id]
    );
    if (!itemRow.rows.length) {
      const e = new Error('Item not found'); e.statusCode = 404; throw e;
    }
    const item = itemRow.rows[0];
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
// Staff collects payment. Records one entry in the invoice_payments ledger
// per call and derives amount_paid as the running SUM of that ledger —
// this used to SET amount_paid directly, which silently erased any prior
// partial payment on a second collection call (finding C-1). A partial
// invoice can now be paid down over any number of calls until it reaches
// 'paid'; the amount owed by the patient (`patient_amount` — the full bill,
// or the post-insurance co-pay) is established once on the *first* payment
// and never recomputed afterward, so a later call that doesn't resend
// insurance details can't accidentally reset the patient's owed amount
// back to the full bill (finding M-1).
exports.payInvoice = async (req, res) => {
  const result = await withTransaction(req.rlsSession, async (client) => {
    const invIdRow = await client.query(
      `SELECT invoice_id FROM visit_invoices WHERE visit_id=$1`, [req.params.visitId]
    );
    if (!invIdRow.rows.length) {
      const e = new Error('Invoice not found'); e.statusCode = 404; throw e;
    }
    // Locks the invoice for the rest of this transaction — two concurrent
    // PATCH /pay calls on the same invoice (double-submit on a slow
    // connection, two staff terminals) now serialize instead of both
    // reading the same pre-payment snapshot and one silently clobbering
    // the other's payment (finding H-1).
    const inv = await lockInvoice(client, invIdRow.rows[0].invoice_id);

    if (inv.status === 'paid') {
      const e = new Error('Invoice already paid'); e.statusCode = 409; throw e;
    }
    // Also reject 'draft' (doctor hasn't marked the visit done yet — nothing
    // for staff to bill) and 'cancelled' (voided).
    if (!['pending_billing', 'partial'].includes(inv.status)) {
      const e = new Error('Invoice is not ready for payment'); e.statusCode = 409; throw e;
    }

    const {
      payment_method,
      insurance_co,
      approval_code,
      policy_number,
      coverage_percent = 0,
      amount_paid,
    } = req.body;

    const grandTotal = parseFloat(inv.grand_total);
    const alreadyPaid = parseFloat(inv.amount_paid) || 0;
    // status is only ever 'pending_billing' immediately before the first
    // payment on this invoice — every later call sees 'partial' instead
    // (or 'paid', already rejected above). More reliable than checking
    // alreadyPaid === 0, which an insurance invoice with a 0 co-pay could
    // also hit legitimately.
    const isFirstPayment = inv.status === 'pending_billing';

    let covPct, insAmount, coPay, patientAmount;
    if (isFirstPayment) {
      covPct = parseFloat(coverage_percent || 0);
      if (payment_method === 'insurance' && covPct > 0) {
        insAmount = round(grandTotal * (covPct / 100));
        coPay = round(grandTotal - insAmount);
        patientAmount = coPay;
      } else {
        covPct = 0;
        insAmount = 0;
        coPay = 0;
        patientAmount = grandTotal;
      }
    } else {
      // Subsequent payment on an already-partial invoice: the amount the
      // patient owes was locked in on the first payment — reuse it rather
      // than recomputing from whatever insurance fields (or lack of them)
      // this particular call happens to send.
      covPct = parseFloat(inv.coverage_percent) || 0;
      insAmount = parseFloat(inv.insurance_amount) || 0;
      coPay = parseFloat(inv.co_pay_amount) || 0;
      patientAmount = parseFloat(inv.patient_amount) || grandTotal;
    }

    const thisPayment = round(parseFloat(amount_paid));
    if (!(thisPayment > 0)) {
      const e = new Error('Payment amount must be greater than zero'); e.statusCode = 400; throw e;
    }
    const remainingBefore = round(patientAmount - alreadyPaid);
    // Overpayment was previously unbounded — amount_balance could go
    // negative and print raw on the invoice with no refund/change tracking
    // anywhere (finding H-3). A tiny epsilon (a tenth of a cent) absorbs
    // genuine binary-floating-point representation noise from the `round`
    // arithmetic above without letting a real overpayment through — 0.01
    // was tried first and found to be exactly one cent too generous: it let
    // a real 1-cent overpayment on a zero-balance invoice through
    // (0.01 > 0 + 0.01 is false), confirmed live while testing this fix.
    if (thisPayment > remainingBefore + 0.001) {
      const e = new Error(
        `Payment of ${thisPayment.toFixed(2)} exceeds the remaining balance of ${remainingBefore.toFixed(2)}`
      );
      e.statusCode = 400;
      throw e;
    }

    await client.query(
      `INSERT INTO invoice_payments (invoice_id, amount, payment_method, collected_by)
       VALUES ($1,$2,$3,$4)`,
      [inv.invoice_id, thisPayment, payment_method, req.user.userId]
    );

    const newAmountPaid = round(alreadyPaid + thisPayment);
    const newBalance = round(patientAmount - newAmountPaid);
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';

    // $11 is deliberately passed twice (as $11 and $14) rather than reused —
    // reusing the same placeholder in both `SET status = $11` and
    // `CASE WHEN $11 = 'paid'` makes Postgres deduce two different types for
    // it and fail the whole query with "inconsistent types deduced for
    // parameter $11" (confirmed against this project's local DB — same
    // class of bug visitsController.updateStatus already documents and
    // works around the same way).
    const { rows: updated } = await client.query(
      `UPDATE visit_invoices
          SET payment_method=$1, insurance_co=$2, approval_code=$3, policy_number=$4,
              coverage_percent=$5, co_pay_amount=$6, patient_amount=$7, insurance_amount=$8,
              amount_paid=$9, amount_balance=$10, status=$11, paid_by=$12,
              paid_at = CASE WHEN $14 = 'paid' THEN NOW() ELSE paid_at END
        WHERE invoice_id=$13 RETURNING *`,
      [
        payment_method,
        insurance_co ?? null,
        approval_code ?? null,
        policy_number ?? null,
        covPct,
        coPay,
        patientAmount,
        insAmount,
        newAmountPaid,
        newBalance,
        newStatus,
        req.user.userId,
        inv.invoice_id,
        newStatus,
      ]
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

// ── PATCH /visits/:visitId/invoice/cancel  (ADMIN + SUPERADMIN) ─────────
// Voids an invoice created by mistake (wrong-patient walk-in, duplicate
// check-in) — previously there was no way to ever get an invoice out of
// the billing worklist once created; `schema.sql` already modeled
// status='cancelled' but nothing ever set it (finding H-2). Only
// draft/pending_billing can be cancelled — once any money has been
// collected (partial/paid) this endpoint refuses, since voiding a
// part-paid invoice needs a refund decision a human should make
// explicitly, not something this button should do silently.
exports.cancelInvoice = async (req, res) => {
  await withTransaction(req.rlsSession, async (client) => {
    const invIdRow = await client.query(
      `SELECT invoice_id FROM visit_invoices WHERE visit_id=$1`, [req.params.visitId]
    );
    if (!invIdRow.rows.length) {
      const e = new Error('Invoice not found'); e.statusCode = 404; throw e;
    }
    const inv = await lockInvoice(client, invIdRow.rows[0].invoice_id);
    if (!['draft', 'pending_billing'].includes(inv.status)) {
      const e = new Error('Only a draft or pending-billing invoice can be cancelled');
      e.statusCode = 409;
      throw e;
    }
    await client.query(
      `UPDATE visit_invoices SET status='cancelled' WHERE invoice_id=$1`,
      [inv.invoice_id]
    );
    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CANCEL_INVOICE,
      resource: 'visit_invoices',
      recordId: inv.invoice_id,
      ipAddress: req.ip,
    });
  });
  res.json({ message: 'Invoice cancelled' });
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
  const dayStart = `($1::timestamp AT TIME ZONE 'Asia/Riyadh')`;
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
  const dayStart = `($1::timestamp AT TIME ZONE 'Asia/Riyadh')`;
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
              u_paid.username AS paid_by_staff_name,
              v.queue_no, v.clinic
         FROM visit_invoices vi
         JOIN patients p ON p.patient_id = vi.patient_id
         JOIN doctors  d ON d.doctor_id  = vi.doctor_id
         JOIN visits   v ON v.visit_id   = vi.visit_id
         LEFT JOIN users u_paid ON u_paid.user_id = vi.paid_by
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
      paidByStaffName: r.paid_by_staff_name,
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

// ── GET /invoices/history?from=&to=&status= (admin + superadmin) ───────────
exports.getBillingHistory = async (req, res) => {
  const result = await withTransaction(req.rlsSession, async (client) => {
    const { from, to, status } = req.query;
    const params = [];
    const conditions = ['1=1'];

    // Naive `created_at::date` casts against the DB session's own timezone
    // (UTC in production) instead of the clinic's real Riyadh calendar day
    // — a filter near midnight could mis-bucket invoices by up to 3 hours
    // (finding M-3). `AT TIME ZONE 'Asia/Riyadh'` converts to Riyadh local
    // time first, matching the same anchoring visitsController.js's
    // TODAY_START_SQL already documents as mandatory for this project.
    if (from) {
      params.push(from);
      conditions.push(`(vi.created_at AT TIME ZONE 'Asia/Riyadh')::date >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      conditions.push(`(vi.created_at AT TIME ZONE 'Asia/Riyadh')::date <= $${params.length}::date`);
    }
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`vi.status = $${params.length}`);
    }

    const queryRes = await client.query(
      `SELECT
         vi.invoice_id, vi.inv_no, vi.status,
         vi.grand_total, vi.amount_paid, vi.amount_balance,
         vi.payment_method, vi.created_at, vi.visit_id, vi.patient_id,
         p.full_name AS patient_name, p.file_no,
         d.full_name AS doctor_name,
         u_paid.username AS paid_by_staff_name,
         v.queue_no, v.clinic
       FROM visit_invoices vi
       JOIN visits v ON v.visit_id = vi.visit_id
       JOIN patients p ON p.patient_id = vi.patient_id
       JOIN doctors d ON d.doctor_id = vi.doctor_id
       LEFT JOIN users u_paid ON u_paid.user_id = vi.paid_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY vi.created_at DESC
       LIMIT 200`,
      params
    );

    const totals = queryRes.rows.reduce(
      (acc, row) => {
        acc.grandTotal += parseFloat(row.grand_total) || 0;
        acc.collected += parseFloat(row.amount_paid) || 0;
        acc.outstanding += parseFloat(row.amount_balance) || 0;
        return acc;
      },
      { grandTotal: 0, collected: 0, outstanding: 0 }
    );

    return {
      invoices: queryRes.rows.map((r) => ({
        invoiceId: r.invoice_id,
        invNo: r.inv_no,
        visitId: r.visit_id,
        patientId: r.patient_id,
        status: r.status,
        grandTotal: parseFloat(r.grand_total),
        amountPaid: parseFloat(r.amount_paid),
        amountBalance: parseFloat(r.amount_balance),
        paymentMethod: r.payment_method,
        createdAt: r.created_at,
        patientName: r.patient_name,
        fileNo: r.file_no,
        doctorName: r.doctor_name,
        paidByStaffName: r.paid_by_staff_name,
        queueNo: r.queue_no,
        clinic: r.clinic,
      })),
      totals,
    };
  });

  res.json(result);
};

exports.getFinancialAnalytics = async (req, res) => {
  const targetDate = req.query.date || null;

  const result = await withTransaction(req.rlsSession, async (client) => {
    // Both branches now convert to Riyadh local time before extracting the
    // calendar date. The explicit-date branch previously did a naive
    // `created_at::date` cast against the DB session's own timezone (UTC
    // in production) — picking a date near midnight could mis-bucket
    // invoices by up to 3 hours relative to the clinic's real day
    // (finding M-3), unlike the "today" branch which already anchored
    // correctly.
    const dateClause = targetDate
      ? `(vi.created_at AT TIME ZONE 'Asia/Riyadh')::date = $1::date`
      : `(vi.created_at AT TIME ZONE 'Asia/Riyadh')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Riyadh')::date`;
    const params = targetDate ? [targetDate] : [];

    const summaryRes = await client.query(
      `SELECT
         COUNT(*)::int AS total_invoices,
         COALESCE(SUM(vi.grand_total), 0)::numeric AS gross,
         COALESCE(SUM(vi.subtotal), 0)::numeric AS subtotal,
         COALESCE(SUM(vi.total_discount), 0)::numeric AS total_discount,
         COALESCE(SUM(vi.total_vat), 0)::numeric AS total_vat,
         COALESCE(SUM(vi.amount_paid), 0)::numeric AS total_collected,
         COALESCE(SUM(CASE WHEN vi.payment_method = 'cash' THEN vi.amount_paid ELSE 0 END), 0)::numeric AS cash,
         COALESCE(SUM(CASE WHEN vi.payment_method = 'card' THEN vi.amount_paid ELSE 0 END), 0)::numeric AS card,
         COALESCE(SUM(CASE WHEN vi.payment_method = 'insurance' OR vi.insurance_co IS NOT NULL THEN vi.amount_paid ELSE 0 END), 0)::numeric AS insurance
       FROM visit_invoices vi
       WHERE ${dateClause} AND vi.status IN ('paid', 'partial')`,
      params
    );

    // Was SUM(vi.grand_total) — the full billed amount, including the
    // still-outstanding portion of every 'partial' invoice — divided by
    // total_collected above, which is SUM(vi.amount_paid), the actual cash
    // in hand. Those two are on different bases; the moment any partial
    // payment exists in the window, the numerator can exceed the
    // denominator and the bar reads over 100% (finding H-4, reproduced
    // live as "general (127%)" on the superadmin dashboard). Summing
    // amount_paid here instead matches what "Gross Revenue" above it
    // already means: money actually collected, broken down by department.
    const deptRes = await client.query(
      `SELECT
         COALESCE(v.clinic, 'General') AS dept_name,
         COALESCE(SUM(vi.amount_paid), 0)::numeric AS dept_revenue
       FROM visit_invoices vi
       JOIN visits v ON v.visit_id = vi.visit_id
       WHERE ${dateClause} AND vi.status IN ('paid', 'partial')
       GROUP BY v.clinic`,
      params
    );

    const row = summaryRes.rows[0] || {};
    const totalCollected = parseFloat(row.total_collected) || 0;
    const cash = parseFloat(row.cash) || 0;
    const card = parseFloat(row.card) || 0;
    const insurance = parseFloat(row.insurance) || 0;

    const depts = deptRes.rows.map((d, idx) => {
      const rev = parseFloat(d.dept_revenue) || 0;
      const pct = totalCollected > 0 ? Math.round((rev / totalCollected) * 100) : 0;
      const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
      return {
        nameEn: d.dept_name,
        nameAr: d.dept_name,
        revenue: rev,
        percent: pct,
        color: colors[idx % colors.length],
      };
    });

    return {
      gross: totalCollected, // Matches exact sum of cash + card + insurance collected today
      cash,
      card,
      insurance,
      totalInvoices: parseInt(row.total_invoices) || 0,
      subtotal: parseFloat(row.subtotal) || 0,
      totalDiscount: parseFloat(row.total_discount) || 0,
      totalVat: parseFloat(row.total_vat) || 0,
      departments: depts,
    };
  });

  res.json(result);
};

