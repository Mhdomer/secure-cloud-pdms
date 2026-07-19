'use strict';

function round(n) { return Math.round(n * 100) / 100; }

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

function calcTotals(items) {
  const subtotal       = round(items.reduce((s,i) => s + parseFloat(i.unit_price) * i.qty, 0));
  const total_discount = round(items.reduce((s,i) => s + parseFloat(i.discount_amount), 0));
  const net_total      = round(items.reduce((s,i) => s + parseFloat(i.net_price), 0));
  const total_vat      = round(items.reduce((s,i) => s + parseFloat(i.vat_amount), 0));
  const grand_total    = round(net_total + total_vat);
  return { subtotal, total_discount, net_total, total_vat, grand_total };
}

module.exports = { calcItem, calcTotals };
