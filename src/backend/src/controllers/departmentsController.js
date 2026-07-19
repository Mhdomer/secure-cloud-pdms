'use strict';
const { withTransaction } = require('../config/database');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../config/constants');

/**
 * Derives a department's immutable `key` from its English name at creation
 * time — the only place a key is ever generated (see Department model /
 * schema.sql comment on why it can never change afterward).
 */
function slugify(nameEn) {
  return nameEn
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40); // leaves room for a numeric collision suffix under VARCHAR(50)
}

function toRow(r) {
  return {
    departmentId: r.department_id,
    key: r.key,
    nameEn: r.name_en,
    nameAr: r.name_ar,
    isActive: r.is_active,
    doctorCount: r.doctor_count !== undefined ? Number(r.doctor_count) : undefined,
    serviceCount: r.service_count !== undefined ? Number(r.service_count) : undefined,
    createdAt: r.created_at,
  };
}

exports.list = async (req, res) => {
  const activeOnly = req.query.active === 'true';
  const rows = await withTransaction(req.rlsSession, (client) => Department.list(client, { activeOnly }));
  res.json({ departments: rows.map(toRow) });
};

exports.create = async (req, res) => {
  const { name_en, name_ar } = req.body;
  const result = await withTransaction(req.rlsSession, async (client) => {
    const base = slugify(name_en) || 'department';
    let key = base;
    let suffix = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await Department.keyExists(client, key)) {
      key = `${base}_${suffix}`;
      suffix += 1;
    }
    const row = await Department.create(client, { key, nameEn: name_en, nameAr: name_ar });
    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.CREATE_DEPARTMENT,
      resource: 'departments',
      recordId: row.department_id,
      ipAddress: req.ip,
    });
    return row;
  });
  res.status(201).json(toRow(result));
};

exports.update = async (req, res) => {
  const { key } = req.params;
  const { name_en, name_ar } = req.body;
  if (name_en === undefined && name_ar === undefined) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  const result = await withTransaction(req.rlsSession, async (client) => {
    const row = await Department.update(client, key, { nameEn: name_en, nameAr: name_ar });
    if (!row) return null;
    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.UPDATE_DEPARTMENT,
      resource: 'departments',
      recordId: row.department_id,
      ipAddress: req.ip,
    });
    return row;
  });
  if (!result) return res.status(404).json({ error: 'Department not found' });
  res.json(toRow(result));
};

exports.toggle = async (req, res) => {
  const { key } = req.params;
  const result = await withTransaction(req.rlsSession, async (client) => {
    const row = await Department.toggle(client, key);
    if (!row) return null;
    await AuditLog.log(client, {
      userId: req.user.userId,
      action: AUDIT_ACTIONS.TOGGLE_DEPARTMENT,
      resource: 'departments',
      recordId: row.department_id,
      ipAddress: req.ip,
    });
    return row;
  });
  if (!result) return res.status(404).json({ error: 'Department not found' });
  res.json(toRow(result));
};
