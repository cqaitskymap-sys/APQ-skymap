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
