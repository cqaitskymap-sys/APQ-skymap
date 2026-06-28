import type { TrainingAssignment, TrainingEffectiveness } from './training-types';
import type {
  TrainingDashboardKpis,
  TrainingDashboardCharts,
} from './training-dashboard-types';

export {
  TRAINING_DASHBOARD_MODULE,
  TRAINING_DASHBOARD_TYPES,
  TRAINING_DASHBOARD_STATUSES,
  TRAINING_MODES_FILTER,
  type TrainingDashboardFilters,
  type TrainingDashboardKpis,
  type TrainingDashboardCharts,
  type RecentAssignmentRow,
  type OverdueTrainingRow,
  type EffectivenessPendingRow,
  type TrainingActivityEntry,
  type TrainingDashboardData,
  type TrainingDashboardActor,
} from './training-dashboard-types';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function emptyTrainingKpis(): TrainingDashboardKpis {
  return {
    totalTrainings: 0,
    assignedTrainings: 0,
    completedTrainings: 0,
    pendingTrainings: 0,
    overdueTrainings: 0,
    sopTrainings: 0,
    inductionTrainings: 0,
    refresherTrainings: 0,
    effectivenessPending: 0,
    effectiveTrainings: 0,
    notEffectiveTrainings: 0,
    trainingCompliancePercent: 0,
    departmentCompliancePercent: 0,
    usersNotTrained: 0,
    trainingDueThisWeek: 0,
  };
}

export function emptyTrainingCharts(): TrainingDashboardCharts {
  return {
    monthlyCompletionTrend: [],
    deptCompliance: [],
    typeDistribution: [],
    pendingVsCompleted: [],
    overdueTrend: [],
    effectivenessTrend: [],
    sopComplianceTrend: [],
    userWiseStatus: [],
  };
}

export function mapAssignmentDashboardStatus(
  a: TrainingAssignment,
  effectiveness: TrainingEffectiveness[],
): string {
  const eff = effectiveness.find((e) => e.assignment_id === a.id);
  const dashboardStatus = eff?.effectiveness_result;

  if (a.status === 'cancelled') return 'Cancelled';
  if (a.status === 'failed') return 'Not Effective';

  const isComplete = a.status === 'completed' || !!a.completion_date;
  if (isComplete) {
    if (a.effectiveness_required) {
      if (!eff || dashboardStatus === 'Pending' || !eff.evaluated_at) return 'Effectiveness Pending';
      if (dashboardStatus === 'Effective') return 'Effective';
      if (dashboardStatus === 'Not Effective') return 'Not Effective';
    }
    return 'Completed';
  }

  if (a.status === 'overdue' || isAssignmentOverdue(a)) return 'Overdue';
  if (a.status === 'in_progress') return 'In Progress';
  if (a.status === 'pending' || a.status === 'retraining') return 'Assigned';
  return 'Assigned';
}

export function isAssignmentOverdue(a: TrainingAssignment): boolean {
  if (['completed', 'cancelled'].includes(a.status)) return false;
  if (a.completion_date) return false;
  if (!a.due_date) return false;
  return a.due_date < todayStr();
}

export function classifyTrainingType(a: TrainingAssignment): string {
  const t = (a.training_type || '').toLowerCase();
  const src = (a.source || '').toLowerCase();

  if (src.includes('retraining') || src.includes('refresher') || t.includes('refresher')) {
    return 'Refresher Training';
  }
  if (t.includes('sop') || src.includes('sop') || src.includes('dms')) return 'SOP Training';
  if (t.includes('role')) return 'Role Based Training';
  if (t.includes('gmp')) return 'GMP Training';
  if (t.includes('safety')) return 'Safety Training';
  if (t.includes('csv')) return 'CSV Training';
  if (t.includes('data integrity')) return 'Data Integrity Training';
  if (a.training_mode === 'On Job Training' || t.includes('on job')) return 'On Job Training';
  if (a.training_mode === 'External' || t.includes('external')) return 'External Training';
  if (a.source === 'matrix_new_user' || t.includes('induction')) return 'Induction';
  return a.training_type || 'GMP Training';
}
