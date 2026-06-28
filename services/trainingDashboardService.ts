export {
  fetchTrainingDashboard,
  refreshTrainingDashboard,
  logTrainingDashboardExport,
  logTrainingDashboardViewed,
  logTrainingDashboardFilterChanged,
  openTrainingDashboardPdfPlaceholder,
  exportTrainingDashboardCsv,
  saveDashboardLayout,
  loadDashboardLayout,
} from '@/lib/training-dashboard-service';

export type { TrainingDashboardActor } from '@/lib/training-dashboard-types';

export type {
  TrainingDashboardData,
  TrainingDashboardFilters,
  TrainingDashboardKpis,
  TrainingDashboardCharts,
  RecentAssignmentRow,
  OverdueTrainingRow,
  EffectivenessPendingRow,
  TrainingActivityEntry,
} from '@/lib/training-dashboard-types';

export {
  mapAssignmentDashboardStatus,
  classifyTrainingType,
} from '@/lib/training-dashboard-records';

export {
  canViewTrainingDashboardModule,
  canManageTrainingDashboardModule,
  canExportTrainingDashboardModule,
  isTrainingDashboardReadOnly,
  isDepartmentTrainingDashboardView,
  isEmployeeTrainingDashboardView,
} from '@/lib/training-dashboard-types';
