'use strict';

const fs = require('fs');

const { withTransaction } = require('../config/database');
const Patient = require('../models/Patient');
const PatientInvoice = require('../models/PatientInvoice');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

/** Staff (admin/superadmin) uploads a billing invoice for a patient. */
async function uploadInvoice(req, res) {
  if (!req.file) {
    const err = new Error('A file is required');
    err.statusCode = 400;
    throw err;
  }

  const { patientId } = req.params;
  const { amount, description, invoice_date: invoiceDate, category } = req.body;

  try {
    const invoice = await withTransaction(req.rlsSession, async (client) => {
      const patient = await Patient.findById(client, patientId);
      if (!patient) {
        const err = new Error('Patient not found');
        err.statusCode = 404;
        throw err;
      }

      const created = await PatientInvoice.create(client, {
        patientId,
        uploadedBy: req.user.userId,
        filePath: req.file.path,
        originalFilename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        amount,
        description,
        invoiceDate,
        category,
      });

      await AuditLog.log(client, {
        userId: req.user.userId,
        action: AUDIT_ACTIONS.UPLOAD_INVOICE,
        resource: 'patient_invoices',
        recordId: created.invoice_id,
        ipAddress: req.ip,
      });

      return created;
    });

    return res.status(201).json({
      invoiceId: invoice.invoice_id,
      patientId: invoice.patient_id,
      originalFilename: invoice.original_filename,
      amount: invoice.amount,
      description: invoice.description,
      invoiceDate: invoice.invoice_date,
      category: invoice.category,
      createdAt: invoice.created_at,
      uploadedBy: invoice.uploaded_by,
    });
  } catch (err) {
    // The file already landed on disk before the DB transaction ran (e.g.
    // patient_id didn't exist) — without this it becomes an orphan no row
    // ever references.
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw err;
  }
}

/** Admin/superadmin/doctor: list invoices for a patient. Optional ?category= narrows to 'invoice' | 'consent' | 'other'. */
async function getInvoices(req, res) {
  const { patientId } = req.params;
  const { category } = req.query;

  const invoices = await withTransaction(req.rlsSession, (client) =>
    PatientInvoice.listByPatient(client, patientId, category)
  );

  return res.status(200).json({
    invoices: invoices.map((inv) => ({
      invoiceId: inv.invoice_id,
      originalFilename: inv.original_filename,
      amount: inv.amount,
      description: inv.description,
      invoiceDate: inv.invoice_date,
      category: inv.category,
      createdAt: inv.created_at,
      uploadedBy: inv.uploaded_by,
    })),
  });
}

/**
 * Patient: their own invoices only. Unlike getInvoices (staff/doctor, which
 * trusts a :patientId route param), this derives the patient from the
 * session — a patient can never be handed someone else's invoices by typing
 * a different ID in the URL, because there is no ID in this URL at all.
 */
async function getMyInvoices(req, res) {
  const { patientId } = req.rlsSession;
  const { category } = req.query;

  const invoices = await withTransaction(req.rlsSession, (client) =>
    PatientInvoice.listByPatient(client, patientId, category)
  );

  return res.status(200).json({
    invoices: invoices.map((inv) => ({
      invoiceId: inv.invoice_id,
      originalFilename: inv.original_filename,
      amount: inv.amount,
      description: inv.description,
      invoiceDate: inv.invoice_date,
      category: inv.category,
      createdAt: inv.created_at,
      uploadedBy: inv.uploaded_by,
    })),
  });
}

/**
 * Admin/superadmin/doctor: download any invoice file. Patient: only their
 * own — patient_invoices carries no RLS (see the model's header comment),
 * so this ownership check is the only thing standing between a patient
 * session and someone else's invoice.
 */
async function downloadInvoice(req, res) {
  const { invoiceId } = req.params;

  const invoice = await withTransaction(req.rlsSession, (client) => PatientInvoice.findById(client, invoiceId));

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  if (req.user.role === ROLES.PATIENT && invoice.patient_id !== req.rlsSession.patientId) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  return res.download(invoice.file_path, invoice.original_filename);
}

module.exports = { uploadInvoice, getInvoices, getMyInvoices, downloadInvoice };
