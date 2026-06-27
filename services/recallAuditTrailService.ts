export {
  fetchRecallAuditTrail,
  fetchAllRecallAuditEntries,
  getFilteredRecallAuditTrail,
  logRecallAuditExport,
  logRecallAuditPreviewed,
  openRecallAuditPdfReport,
  getAuditLogsForRecall,
} from '@/lib/recall-audit-trail-service';

export { RECALL_AUDIT_TRAIL_MODULE } from '@/lib/recall-audit-trail-records';

export type {
  RecallAuditEntry,
  RecallAuditFilters,
  RecallAuditActor,
} from '@/lib/recall-audit-trail-records';
