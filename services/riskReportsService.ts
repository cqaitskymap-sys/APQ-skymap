export {
  previewRiskReport,
  fetchRiskReportRecords,
  getRiskReportById,
  generateRiskReport,
  scheduleRiskReport,
  softDeleteRiskReport,
  logRiskReportPreviewed,
  logManagementReportViewed,
  exportRiskReport,
  logRiskReportPrinted,
  fetchRiskReportProductOptions,
  fetchRiskReportOwnerOptions,
  fetchRiskDashboardAnalytics,
  fetchRiskExportHistory,
  openRiskReportPdfHtml,
  computeRiskReportAnalytics,
  summarizeRiskReportsDashboard,
} from '@/lib/risk-reports-service';

export type { RiskReportActor, RiskReportFilterInput, RiskReportFormData, RiskReportRecord } from '@/lib/risk-reports-service';

export type {
  RiskReportAnalyticsMetrics,
  RiskReportChartData,
  RiskManagementReviewSummary,
  RiskReportAnalyticsResult,
  RiskReportPreviewRow,
  RiskReportType,
} from '@/lib/risk-reports-records';

export {
  canGenerateRiskReportsModule,
  canExportRiskReportsModule,
  canViewRegulatoryRiskReportsModule,
  canViewCsvRiskReportsModule,
  canViewManagementReviewModule,
  isRiskReportsReadOnlyModule,
  canGenerateRiskReportTypeModule,
  canExportRiskReportTypeModule,
  canViewRiskReportsModule,
  RISK_REPORT_TYPES,
  REPORTS_MODULE,
  RISK_REPORTS_COLLECTION,
} from '@/lib/risk-reports-types';

export {
  canGenerateRiskReports,
  canExportRiskReports,
  canExportRiskReportType,
  canGenerateRiskReportType,
  canViewRiskReports,
  exportRiskReportCsv,
  riskReportFormSchema,
} from '@/lib/risk-reports-records';
