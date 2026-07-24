'use strict';

// Plain `Math.round(n*100)/100` is not safe at exact half-cent boundaries —
// binary floating point can't represent most decimals exactly, so e.g.
// `1.005 * 100 === 100.49999999999999` in JS, rounding the wrong way.
// Adding Number.EPSILON before rounding is the standard, minimal
// compensation for that representation error. This still isn't arbitrary-
// precision decimal arithmetic, but it closes the specific half-cent
// mis-rounding class of bug without restructuring every call site around
// integer cents (docs/psm2/qa-audit-2026-07-24.md finding M-4).
function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function calcItem({ unit_price, qty = 1, discount_pct = 0, vat_pct = 15 }) {
  const price    = parseFloat(unit_price);
  const q        = parseInt(qty, 10);
  const disc     = parseFloat(discount_pct);
  const vat      = parseFloat(vat_pct);
  const subtotal        = round(price * q);
  const discount_amount = round(subtotal * disc / 100);
  const net_price       = round(subtotal - discount_amount);
  const vat_amount      = round(net_price * vat / 100);
  const total_with_vat  = round(net_price + vat_amount);
  return { unit_price: price, qty: q, discount_pct: disc,
           discount_amount, net_price, vat_pct: vat, vat_amount, total_with_vat };
}

function calcTotals(items, insuranceOptions = {}) {
  const subtotal       = round(items.reduce((s,i) => s + parseFloat(i.unit_price) * i.qty, 0));
  const total_discount = round(items.reduce((s,i) => s + parseFloat(i.discount_amount), 0));
  const net_total      = round(items.reduce((s,i) => s + parseFloat(i.net_price), 0));
  const total_vat      = round(items.reduce((s,i) => s + parseFloat(i.vat_amount), 0));
  const grand_total    = round(net_total + total_vat);

  let patient_amount = grand_total;
  let insurance_amount = 0;
  let co_pay_amount = 0;
  let coverage_percent = parseFloat(insuranceOptions.coverage_percent || 0);

  if (insuranceOptions.payment_method === 'insurance' && coverage_percent > 0) {
    insurance_amount = round(grand_total * (coverage_percent / 100));
    co_pay_amount = round(grand_total - insurance_amount);
    patient_amount = co_pay_amount;
  }

  return {
    subtotal,
    total_discount,
    net_total,
    total_vat,
    grand_total,
    coverage_percent,
    co_pay_amount,
    patient_amount,
    insurance_amount,
  };
}

module.exports = { calcItem, calcTotals, round };
