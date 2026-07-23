'use strict';

const { withTransaction } = require('../config/database');

exports.listNotifications = async (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  const result = await withTransaction(req.rlsSession, async (client) => {
    // 1. Fetch persistent notifications
    const dbNotifs = await client.query(
      `SELECT notification_id, title_en, title_ar, message_en, message_ar, type, is_read, created_at
         FROM notifications
        WHERE user_id = $1 OR target_role = $2
        ORDER BY created_at DESC
        LIMIT 10`,
      [userId, role]
    );

    const items = dbNotifs.rows.map((r) => ({
      id: r.notification_id,
      titleEn: r.title_en,
      titleAr: r.title_ar,
      messageEn: r.message_en,
      messageAr: r.message_ar,
      type: r.type,
      read: r.is_read,
      createdAt: r.created_at,
    }));

    // 2. Derive live real-time notifications directly from active PostgreSQL visits today
    const liveVisits = await client.query(
      `SELECT v.visit_id, v.queue_no, v.status, v.checked_in_at, v.clinic,
              p.full_name AS patient_name, d.full_name AS doctor_name,
              EXTRACT(EPOCH FROM (NOW() - v.checked_in_at))/60 AS wait_minutes
         FROM visits v
         JOIN patients p ON p.patient_id = v.patient_id
         JOIN doctors d ON d.doctor_id = v.doctor_id
        WHERE v.checked_in_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh')
        ORDER BY v.checked_in_at DESC
        LIMIT 10`
    );

    liveVisits.rows.forEach((v) => {
      const waitMins = Math.round(v.wait_minutes || 0);

      if (v.status === 'arrived') {
        items.unshift({
          id: `visit-arr-${v.visit_id}`,
          titleEn: 'Patient Arrived in Lobby',
          titleAr: 'وصول مريض إلى صالة الانتظار',
          messageEn: `Patient ${v.patient_name} checked in for ${v.clinic || 'Clinic'} (Ticket #${v.queue_no}).`,
          messageAr: `قام المريض ${v.patient_name} بتسجيل الدخول لعيادة ${v.clinic || 'العيادة'} (تذكرة رقم #${v.queue_no}).`,
          type: 'arrival',
          read: false,
          createdAt: v.checked_in_at,
        });

        if (waitMins > 20) {
          items.unshift({
            id: `visit-sla-${v.visit_id}`,
            titleEn: 'Lobby Wait Time Alert',
            titleAr: 'تنبيه تجاوز فترة الانتظار',
            messageEn: `Ticket #${v.queue_no} (${v.patient_name}) waiting time exceeded ${waitMins} minutes.`,
            messageAr: `تجاوزت التذكرة رقم #${v.queue_no} للمريض (${v.patient_name}) مدة الانتظار المستهدفة (${waitMins} دقيقة).`,
            type: 'sla_warning',
            read: false,
            createdAt: v.checked_in_at,
          });
        }
      } else if (v.status === 'completed') {
        items.unshift({
          id: `visit-comp-${v.visit_id}`,
          titleEn: 'Unbilled Visit Completed',
          titleAr: 'زيارة منتهية تنتظر الفوترة',
          messageEn: `Dr. ${v.doctor_name} completed visit for ${v.patient_name}. Pending payment at reception.`,
          messageAr: `أنهى الطبيب د. ${v.doctor_name} الكشف للمريض ${v.patient_name}. بانتظار التحصيل في الاستقبال.`,
          type: 'billing',
          read: false,
          createdAt: v.checked_in_at,
        });
      }
    });

    return items.slice(0, 15);
  });

  res.json({ notifications: result });
};

exports.markAllRead = async (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  await withTransaction(req.rlsSession, async (client) => {
    await client.query(
      `UPDATE notifications
          SET is_read = true
        WHERE user_id = $1 OR target_role = $2`,
      [userId, role]
    );
  });

  res.json({ message: 'All notifications marked as read' });
};
