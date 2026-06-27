export {
  fetchRiskAuditTrail,
  fetchAllRiskAuditEntries,
  getFilteredRiskAuditTrail,
  logRiskAuditExport,
  logRiskAuditPreviewed,
  openRiskAuditPdfReport,
  getAuditLogsForRisk,
  type ReportActor,
} from '@/lib/risk-audit-trail-service';

export type {
  RiskAuditEntry,
  RiskAuditFilters,
  RiskAuditDashboardMetrics,
} from '@/lib/risk-audit-trail-records';
