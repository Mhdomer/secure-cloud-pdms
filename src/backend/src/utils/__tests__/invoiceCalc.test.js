'use strict';

const { calcItem, calcTotals, round } = require('../invoiceCalc');

describe('round', () => {
  it('rounds to 2 decimal places', () => {
    expect(round(10.005)).toBe(10.01); // the exact half-cent case this helper exists for
    expect(round(10.004)).toBe(10);
    expect(round(1.005 * 100 / 100)).not.toBe(1.0049999999999999);
  });
});

describe('calcItem', () => {
  it('computes subtotal, VAT and total for a plain line item', () => {
    const item = calcItem({ unit_price: 100, qty: 2, discount_pct: 0, vat_pct: 15 });
    expect(item.net_price).toBe(200);
    expect(item.vat_amount).toBe(30);
    expect(item.total_with_vat).toBe(230);
  });

  it('applies a discount before computing VAT', () => {
    const item = calcItem({ unit_price: 100, qty: 1, discount_pct: 10, vat_pct: 15 });
    expect(item.discount_amount).toBe(10);
    expect(item.net_price).toBe(90);
    expect(item.vat_amount).toBe(13.5);
    expect(item.total_with_vat).toBe(103.5);
  });

  it('defaults qty to 1 and vat_pct to 15 when omitted', () => {
    const item = calcItem({ unit_price: 50 });
    expect(item.qty).toBe(1);
    expect(item.vat_pct).toBe(15);
    expect(item.net_price).toBe(50);
  });

  it('handles a 100% discount without going negative', () => {
    const item = calcItem({ unit_price: 40, qty: 1, discount_pct: 100, vat_pct: 15 });
    expect(item.net_price).toBe(0);
    expect(item.vat_amount).toBe(0);
    expect(item.total_with_vat).toBe(0);
  });
});

describe('calcTotals', () => {
  const items = [
    calcItem({ unit_price: 100, qty: 1, discount_pct: 0, vat_pct: 15 }),
    calcItem({ unit_price: 50, qty: 2, discount_pct: 10, vat_pct: 15 }),
  ];

  it('sums line items into invoice-level totals with no insurance', () => {
    const totals = calcTotals(items);
    expect(totals.net_total).toBe(190); // 100 + (100 - 10)
    expect(totals.grand_total).toBe(218.5);
    expect(totals.patient_amount).toBe(218.5);
    expect(totals.insurance_amount).toBe(0);
  });

  it('splits patient vs. insurance amounts when insurance covers part of the bill', () => {
    const totals = calcTotals(items, { payment_method: 'insurance', coverage_percent: 80 });
    expect(totals.insurance_amount).toBe(round(totals.grand_total * 0.8));
    expect(totals.co_pay_amount).toBe(round(totals.grand_total - totals.insurance_amount));
    expect(totals.patient_amount).toBe(totals.co_pay_amount);
  });

  it('leaves the patient responsible for the full amount when payment_method is not insurance', () => {
    const totals = calcTotals(items, { payment_method: 'cash', coverage_percent: 80 });
    expect(totals.insurance_amount).toBe(0);
    expect(totals.patient_amount).toBe(totals.grand_total);
  });

  it('returns all-zero totals for an empty item list', () => {
    const totals = calcTotals([]);
    expect(totals.grand_total).toBe(0);
    expect(totals.patient_amount).toBe(0);
  });
});
