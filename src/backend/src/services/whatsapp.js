'use strict';

const twilio = require('twilio');
const logger = require('../config/logger');

// Optional side-feature — unlike src/config/database.js's required env vars,
// missing Twilio credentials must not crash the server at require() time.
// Twilio's SDK throws synchronously on an invalid accountSid, so the client
// is only constructed when both values are present.
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilioAccountSid && twilioAuthToken ? twilio(twilioAccountSid, twilioAuthToken) : null;

/** Normalizes a Saudi local number (05XXXXXXXX) to E.164. contact_number is
 * already stored as E.164 per docs/psm2/self-registration-design.md decision
 * #2, so this is a safety net for older/admin-entered rows, not the primary path. */
function toE164Saudi(phone) {
  const trimmed = phone.toString().trim();
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('0')) return `+966${trimmed.slice(1)}`;
  return `+966${trimmed}`;
}

/**
 * Fire-and-forget WhatsApp appointment confirmation (Twilio sandbox in dev —
 * see docs/psm2/self-registration-design.md decision #1, which stubbed real
 * SMS/notification delivery until "before any real deployment"; the Twilio
 * Sandbox has no BAA and must not be used for real patient traffic).
 * Never throws — a failed send must not affect the appointment API response.
 * Per src/config/logger.js, PHI (name, phone) is never passed to the logger —
 * only the appointmentId, for correlation.
 */
async function sendAppointmentConfirmation({ appointmentId, patientName, patientPhone, doctorName, scheduledAt }) {
  if (!client) {
    logger.warn('WhatsApp confirmation skipped — Twilio not configured', { appointmentId });
    return;
  }
  if (!patientPhone) {
    return;
  }

  const phone = toE164Saudi(patientPhone);
  const scheduledDate = new Date(scheduledAt);
  const date = scheduledDate.toLocaleDateString('en-GB', { timeZone: 'Asia/Riyadh' });
  const time = scheduledDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  });

  const body =
    `مرحباً ${patientName}،\n` +
    `تم تأكيد موعدك في عيادة الأمين مع د. ${doctorName}\n` +
    `التاريخ: ${date} | الوقت: ${time}\n\n` +
    `Hello ${patientName}, your appointment with Dr. ${doctorName} ` +
    `is confirmed for ${date} at ${time}. – Alamin Clinic`;

  try {
    await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
      body,
    });
    logger.info('WhatsApp appointment confirmation sent', { appointmentId });
  } catch (err) {
    logger.warn('WhatsApp appointment confirmation failed', { appointmentId, error: err.message });
  }
}

module.exports = { sendAppointmentConfirmation };
