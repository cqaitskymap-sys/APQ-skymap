export {
  fetchRiskDashboardData,
  logDashboardViewed,
  logDashboardRefreshed,
  logDashboardFilterApplied,
  logRiskOpened,
  logDashboardExport,
} from '@/lib/risk-dashboard-service';

export {
  canViewRiskDashboard,
  canExportRiskDashboard,
  canCreateFromDashboard,
  getSafeRpn,
  riskLevelFromRpn,
} from '@/lib/risk-dashboard-records';

export type { RiskDashboardActor } from '@/lib/risk-dashboard-service';

export type {
  RiskDashboardData,
  RiskDashboardFilters,
  RiskDashboardMetrics,
  RiskDashboardChartData,
  RiskDashboardTableRow,
  RiskDashboardKpiFilter,
  RiskDashboardActivityEntry,
} from '@/lib/risk-dashboard-records';
