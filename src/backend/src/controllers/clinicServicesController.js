'use strict';
const { withTransaction } = require('../config/database');

function toRow(r) {
  return {
    serviceId:  r.service_id,
    codeNo:     r.code_no,
    nameEn:     r.name_en,
    nameAr:     r.name_ar,
    basePrice:  parseFloat(r.base_price),
    category:   r.category,
    vatPct:     parseFloat(r.vat_pct),
    isActive:   r.is_active,
    createdAt:  r.created_at,
    updatedAt:  r.updated_at,
  };
}

exports.list = async (req, res) => {
  const { q, category, active } = req.query;
  const result = await withTransaction(req.rlsSession, async (client) => {
    const conditions = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(code_no ILIKE $${params.length} OR name_en ILIKE $${params.length} OR name_ar ILIKE $${params.length})`);
    }
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (active !== undefined) {
      params.push(active === 'true');
      conditions.push(`is_active = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return client.query(
      `SELECT * FROM clinic_services ${where} ORDER BY code_no ASC`,
      params
    );
  });
  res.json({ services: result.rows.map(toRow) });
};

exports.create = async (req, res) => {
  const { code_no, name_en, name_ar, base_price, category, vat_pct } = req.body;
  const result = await withTransaction(req.rlsSession, async (client) => {
    return client.query(
      `INSERT INTO clinic_services (code_no, name_en, name_ar, base_price, category, vat_pct, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code_no, name_en, name_ar ?? null, base_price, category ?? null, vat_pct ?? 15, req.user.userId]
    );
  });
  res.status(201).json(toRow(result.rows[0]));
};

exports.update = async (req, res) => {
  const { serviceId } = req.params;
  const fields = ['name_en','name_ar','base_price','category','vat_pct','code_no'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  });
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(new Date(), serviceId);
  const result = await withTransaction(req.rlsSession, async (client) => {
    return client.query(
      `UPDATE clinic_services SET ${updates.join(', ')}, updated_at = $${params.length - 1}
       WHERE service_id = $${params.length} RETURNING *`,
      params
    );
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Service not found' });
  res.json(toRow(result.rows[0]));
};

exports.toggle = async (req, res) => {
  const { serviceId } = req.params;
  const result = await withTransaction(req.rlsSession, async (client) => {
    return client.query(
      `UPDATE clinic_services SET is_active = NOT is_active, updated_at = NOW()
       WHERE service_id = $1 RETURNING *`,
      [serviceId]
    );
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Service not found' });
  res.json(toRow(result.rows[0]));
};
