/**
 * Firebase Cloud Functions — scheduled effective date activation.
 *
 * Deploy: cd functions && npm install && npm run deploy
 * Requires EFFECTIVE_DATE_API_URL and EFFECTIVE_DATE_CRON_SECRET env config.
 *
 * Alternative: call POST /api/dms/effective-date/activate from Cloud Scheduler directly.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const cronSecret = defineSecret('EFFECTIVE_DATE_CRON_SECRET');
const apiUrl = defineSecret('EFFECTIVE_DATE_API_URL');

export const scheduledEffectiveDateActivation = onSchedule(
  {
    schedule: 'every day 00:05',
    timeZone: 'UTC',
    secrets: [cronSecret, apiUrl],
  },
  async () => {
    const url = apiUrl.value() || process.env.EFFECTIVE_DATE_API_URL;
    const secret = cronSecret.value() || process.env.EFFECTIVE_DATE_CRON_SECRET;
    if (!url) {
      logger.error('EFFECTIVE_DATE_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Effective date activation completed', body);
  },
);

const prmCronSecret = defineSecret('PERIODIC_REVIEW_CRON_SECRET');
const prmApiUrl = defineSecret('PERIODIC_REVIEW_API_URL');

export const scheduledPeriodicReviewJobs = onSchedule(
  {
    schedule: 'every day 06:00',
    timeZone: 'UTC',
    secrets: [prmCronSecret, prmApiUrl],
  },
  async () => {
    const url = prmApiUrl.value() || process.env.PERIODIC_REVIEW_API_URL;
    const secret = prmCronSecret.value() || process.env.PERIODIC_REVIEW_CRON_SECRET;
    if (!url) {
      logger.error('PERIODIC_REVIEW_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Periodic review scheduler completed', body);
  },
);

const dtlCronSecret = defineSecret('TRAINING_LINKAGE_CRON_SECRET');
const dtlApiUrl = defineSecret('TRAINING_LINKAGE_API_URL');

export const scheduledTrainingLinkageJobs = onSchedule(
  {
    schedule: 'every day 07:00',
    timeZone: 'UTC',
    secrets: [dtlCronSecret, dtlApiUrl],
  },
  async () => {
    const url = dtlApiUrl.value() || process.env.TRAINING_LINKAGE_API_URL;
    const secret = dtlCronSecret.value() || process.env.TRAINING_LINKAGE_CRON_SECRET;
    if (!url) {
      logger.error('TRAINING_LINKAGE_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Training linkage scheduler completed', body);
  },
);

const ciaCronSecret = defineSecret('CHANGE_IMPACT_CRON_SECRET');
const ciaApiUrl = defineSecret('CHANGE_IMPACT_API_URL');

export const scheduledChangeImpactJobs = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'UTC',
    secrets: [ciaCronSecret, ciaApiUrl],
  },
  async () => {
    const url = ciaApiUrl.value() || process.env.CHANGE_IMPACT_API_URL;
    const secret = ciaCronSecret.value() || process.env.CHANGE_IMPACT_CRON_SECRET;
    if (!url) {
      logger.error('CHANGE_IMPACT_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Change impact scheduler completed', body);
  },
);

const archiveCronSecret = defineSecret('ARCHIVE_CRON_SECRET');
const archiveApiUrl = defineSecret('ARCHIVE_API_URL');

export const scheduledArchiveJobs = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'UTC',
    secrets: [archiveCronSecret, archiveApiUrl],
  },
  async () => {
    const url = archiveApiUrl.value() || process.env.ARCHIVE_API_URL;
    const secret = archiveCronSecret.value() || process.env.ARCHIVE_CRON_SECRET;
    if (!url) {
      logger.error('ARCHIVE_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Archive scheduler completed', body);
  },
);

const retentionCronSecret = defineSecret('RETENTION_CRON_SECRET');
const retentionApiUrl = defineSecret('RETENTION_API_URL');

export const scheduledRetentionJobs = onSchedule(
  {
    schedule: 'every day 10:00',
    timeZone: 'UTC',
    secrets: [retentionCronSecret, retentionApiUrl],
  },
  async () => {
    const url = retentionApiUrl.value() || process.env.RETENTION_API_URL;
    const secret = retentionCronSecret.value() || process.env.RETENTION_CRON_SECRET;
    if (!url) {
      logger.error('RETENTION_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Retention scheduler completed', body);
  },
);

const externalDocCronSecret = defineSecret('EXTERNAL_DOC_CRON_SECRET');
const externalDocApiUrl = defineSecret('EXTERNAL_DOC_API_URL');

export const scheduledExternalDocumentJobs = onSchedule(
  {
    schedule: 'every day 11:00',
    timeZone: 'UTC',
    secrets: [externalDocCronSecret, externalDocApiUrl],
  },
  async () => {
    const url = externalDocApiUrl.value() || process.env.EXTERNAL_DOC_API_URL;
    const secret = externalDocCronSecret.value() || process.env.EXTERNAL_DOC_CRON_SECRET;
    if (!url) {
      logger.error('EXTERNAL_DOC_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('External document scheduler completed', body);
  },
);

const printControlCronSecret = defineSecret('PRINT_CONTROL_CRON_SECRET');
const printControlApiUrl = defineSecret('PRINT_CONTROL_API_URL');

export const scheduledPrintControlJobs = onSchedule(
  {
    schedule: 'every day 12:00',
    timeZone: 'UTC',
    secrets: [printControlCronSecret, printControlApiUrl],
  },
  async () => {
    const url = printControlApiUrl.value() || process.env.PRINT_CONTROL_API_URL;
    const secret = printControlCronSecret.value() || process.env.PRINT_CONTROL_CRON_SECRET;
    if (!url) {
      logger.error('PRINT_CONTROL_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Print control scheduler completed', body);
  },
);

const watermarkCronSecret = defineSecret('WATERMARK_CRON_SECRET');
const watermarkApiUrl = defineSecret('WATERMARK_API_URL');

export const scheduledWatermarkJobs = onSchedule(
  {
    schedule: 'every day 13:00',
    timeZone: 'UTC',
    secrets: [watermarkCronSecret, watermarkApiUrl],
  },
  async () => {
    const url = watermarkApiUrl.value() || process.env.WATERMARK_API_URL;
    const secret = watermarkCronSecret.value() || process.env.WATERMARK_CRON_SECRET;
    if (!url) {
      logger.error('WATERMARK_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Watermark scheduler completed', body);
  },
);

const documentAuditCronSecret = defineSecret('DOCUMENT_AUDIT_CRON_SECRET');
const documentAuditApiUrl = defineSecret('DOCUMENT_AUDIT_API_URL');

export const scheduledDocumentAuditJobs = onSchedule(
  {
    schedule: 'every day 14:00',
    timeZone: 'UTC',
    secrets: [documentAuditCronSecret, documentAuditApiUrl],
  },
  async () => {
    const url = documentAuditApiUrl.value() || process.env.DOCUMENT_AUDIT_API_URL;
    const secret = documentAuditCronSecret.value() || process.env.DOCUMENT_AUDIT_CRON_SECRET;
    if (!url) {
      logger.error('DOCUMENT_AUDIT_API_URL not configured');
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });
    const body = await res.json();
    logger.info('Document audit scheduler completed', body);
  },
);

export const scheduledTrainingAutomationJobs = onSchedule(
  {
    schedule: 'every day 05:00',
    timeZone: 'UTC',
  },
  async () => {
    if (getApps().length === 0) initializeApp();
    const firestore = getFirestore();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const reminderDate = new Date(now);
    reminderDate.setUTCDate(reminderDate.getUTCDate() + 30);
    const threshold = reminderDate.toISOString().slice(0, 10);
    let retrainingUpdated = 0;
    let certificatesUpdated = 0;

    const retraining = await firestore.collection('retraining_records')
      .where('due_date', '<=', threshold)
      .get();
    for (const snapshot of retraining.docs) {
      const record = snapshot.data();
      if (['Completed', 'Closed', 'Cancelled'].includes(String(record.retraining_status))) continue;
      const overdue = String(record.due_date) < today;
      const status = overdue ? 'Overdue' : String(record.retraining_status || 'Scheduled');
      const notificationId = `retraining-${snapshot.id}-${overdue ? 'overdue' : today}`;
      const batch = firestore.batch();
      if (overdue && record.retraining_status !== 'Overdue') {
        batch.update(snapshot.ref, {
          retraining_status: 'Overdue',
          status: 'Overdue',
          updated_at: now.toISOString(),
          updated_by: 'system',
          updated_by_name: 'Training Automation',
        });
        retrainingUpdated++;
      }
      batch.set(firestore.collection('notifications').doc(notificationId), {
        userId: String(record.employee_id || ''),
        recipientRole: 'training_coordinator',
        title: overdue ? 'Retraining Overdue' : 'Retraining Reminder',
        message: `${String(record.training_topic || 'Training')} is ${overdue ? 'overdue' : `due ${String(record.due_date)}`}`,
        type: overdue ? 'warning' : 'info',
        module: 'training',
        recordId: snapshot.id,
        isRead: false,
        createdAt: now.toISOString(),
        dedupeKey: notificationId,
        status,
      }, { merge: false });
      await batch.commit();
    }

    const certificates = await firestore.collection('training_certificates')
      .where('expiry_date', '<=', threshold)
      .get();
    for (const snapshot of certificates.docs) {
      const certificate = snapshot.data();
      if (certificate.certificate_status === 'Revoked') continue;
      const expired = String(certificate.expiry_date) < today;
      const status = expired ? 'Expired' : 'Expiring Soon';
      if (certificate.certificate_status === status) continue;
      const notificationId = `certificate-${snapshot.id}-${status.toLowerCase().replace(' ', '-')}`;
      const batch = firestore.batch();
      batch.update(snapshot.ref, {
        certificate_status: status,
        updated_at: now.toISOString(),
        updated_by: 'system',
        updated_by_name: 'Training Automation',
      });
      batch.set(firestore.collection('notifications').doc(notificationId), {
        userId: String(certificate.employee_id || ''),
        recipientRole: 'training_coordinator',
        title: `Certificate ${status}`,
        message: `${String(certificate.certificate_number || snapshot.id)} ${expired ? 'has expired' : `expires ${String(certificate.expiry_date)}`}`,
        type: expired ? 'warning' : 'info',
        module: 'training',
        recordId: snapshot.id,
        isRead: false,
        createdAt: now.toISOString(),
        dedupeKey: notificationId,
      }, { merge: false });
      await batch.commit();
      certificatesUpdated++;
    }

    await firestore.collection('training_automation_log').add({
      job: 'daily_training_automation',
      started_at: now.toISOString(),
      completed_at: new Date().toISOString(),
      status: 'Completed',
      retraining_updated: retrainingUpdated,
      certificates_updated: certificatesUpdated,
    });
    logger.info('Training automation completed', { retrainingUpdated, certificatesUpdated });
  },
);
