export {
  fetchTrainingDashboard,
  refreshTrainingDashboard,
  logTrainingDashboardExport,
  logTrainingDashboardViewed,
  openTrainingDashboardPdfPlaceholder,
  type TrainingDashboardActor,
} from '@/lib/training-dashboard-service';

export type {
  TrainingDashboardData,
  TrainingDashboardFilters,
  TrainingDashboardKpis,
  TrainingDashboardCharts,
  RecentAssignmentRow,
  OverdueTrainingRow,
  EffectivenessPendingRow,
  TrainingActivityEntry,
} from '@/lib/training-dashboard-records';
