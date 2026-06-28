export {
  fetchRiskAuditTrail,
  fetchAllRiskAuditEntries,
  getFilteredRiskAuditTrail,
  logRiskAuditExport,
  logRiskAuditPreviewed,
  openRiskAuditPdfReport,
  getAuditLogsForRisk,
} from '@/lib/risk-audit-trail-service';

export type { ReportActor } from '@/lib/risk-audit-trail-records';
export type { RiskAuditActor } from '@/lib/risk-audit-trail-types';

export type {
  RiskAuditEntry,
  RiskAuditFilters,
  RiskAuditDashboardMetrics,
} from '@/lib/risk-audit-trail-records';

export {
  canViewRiskAuditTrailModule,
  canExportRiskAuditTrailModule,
  isRiskAuditTrailReadOnly,
  RISK_AUDIT_ACTION_TYPES,
  RISK_TIMELINE_SECTIONS,
} from '@/lib/risk-audit-trail-types';
