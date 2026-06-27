export {
  fetchCcDashboardData,
  logCcDashboardViewed,
  logCcDashboardRefreshed,
  logCcDashboardFilterApplied,
  logCcDashboardExport,
  logCcChangeOpened,
  openCcDashboardPdfPlaceholder,
} from '@/lib/cc-dashboard-service';

export { CC_DASHBOARD_MODULE } from '@/lib/cc-dashboard-records';

export type { CcDashboardActor } from '@/lib/cc-dashboard-service';

export type {
  CcDashboardData,
  CcDashboardFilters,
  CcDashboardKpiFilter,
  CcDashboardMetrics,
  CcDashboardTableRow,
  CcDashboardActivityEntry,
} from '@/lib/cc-dashboard-records';
