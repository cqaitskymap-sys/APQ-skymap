import type { TrainingAssignment, TrainingEffectiveness } from './training-types';

export const TRAINING_DASHBOARD_MODULE = 'Training';

export const TRAINING_DASHBOARD_STATUSES = [
  'Draft', 'Assigned', 'In Progress', 'Completed', 'Effectiveness Pending',
  'Effective', 'Not Effective', 'Overdue', 'Cancelled',
] as const;

export const TRAINING_DASHBOARD_TYPES = [
  'Induction', 'SOP Training', 'Refresher Training', 'Role Based Training',
  'GMP Training', 'Safety Training', 'CSV Training', 'Data Integrity Training',
  'On Job Training', 'External Training',
] as const;

export interface TrainingDashboardFilters {
  department?: string;
  training_type?: string;
  employee_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface TrainingDashboardKpis {
  totalTrainings: number;
  assignedTrainings: number;
  completedTrainings: number;
  pendingTrainings: number;
  overdueTrainings: number;
  sopTrainings: number;
  inductionTrainings: number;
  refresherTrainings: number;
  effectivenessPending: number;
  effectiveTrainings: number;
  notEffectiveTrainings: number;
  trainingCompliancePercent: number;
  departmentCompliancePercent: number;
  usersNotTrained: number;
  trainingDueThisWeek: number;
  totalEmployees: number;
}

export interface TrainingDashboardCharts {
  monthlyCompletionTrend: { month: string; count: number }[];
  deptCompliance: { name: string; value: number }[];
  typeDistribution: { name: string; value: number }[];
  pendingVsCompleted: { name: string; value: number }[];
  overdueTrend: { month: string; count: number }[];
  effectivenessTrend: { month: string; effective: number; notEffective: number }[];
  sopComplianceTrend: { month: string; value: number }[];
  userWiseStatus: { name: string; completed: number; pending: number; overdue: number }[];
}

export interface RecentAssignmentRow {
  id: string;
  training_number: string;
  employee_name: string;
  department: string;
  training_type: string;
  document_sop: string;
  due_date: string;
  status: string;
}

export interface OverdueTrainingRow {
  id: string;
  training_number: string;
  employee_name: string;
  department: string;
  due_date: string;
  days_overdue: number;
  responsible_manager: string;
  status: string;
}

export interface EffectivenessPendingRow {
  id: string;
  training_number: string;
  employee_name: string;
  training_topic: string;
  effectiveness_due_date: string;
  evaluator: string;
  status: string;
}

export interface TrainingActivityEntry {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: string;
}

export interface TrainingDashboardData {
  kpis: TrainingDashboardKpis;
  charts: TrainingDashboardCharts;
  recentAssignments: RecentAssignmentRow[];
  overdueTrainings: OverdueTrainingRow[];
  effectivenessPending: EffectivenessPendingRow[];
  activity: TrainingActivityEntry[];
  error?: string;
}

export function emptyTrainingKpis(): TrainingDashboardKpis {
  return {
    totalTrainings: 0, assignedTrainings: 0, completedTrainings: 0, pendingTrainings: 0,
    overdueTrainings: 0, sopTrainings: 0, inductionTrainings: 0, refresherTrainings: 0,
    effectivenessPending: 0, effectiveTrainings: 0, notEffectiveTrainings: 0,
    trainingCompliancePercent: 0, departmentCompliancePercent: 0, usersNotTrained: 0,
    trainingDueThisWeek: 0, totalEmployees: 0,
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
  if (a.status === 'cancelled') return 'Cancelled';
  if (a.status === 'overdue' || (a.due_date < new Date().toISOString().split('T')[0]
    && !['completed', 'cancelled'].includes(a.status))) return 'Overdue';
  if (a.status === 'in_progress') return 'In Progress';
  if (a.status === 'completed' || a.completion_date) {
    if (a.effectiveness_required) {
      if (!eff || eff.effectiveness_result === 'Pending' || !eff.evaluated_at) return 'Effectiveness Pending';
      if (eff.effectiveness_result === 'Effective') return 'Effective';
      if (eff.effectiveness_result === 'Not Effective') return 'Not Effective';
    }
    return 'Completed';
  }
  if (a.status === 'pending' || a.status === 'retraining') return 'Assigned';
  return 'Assigned';
}

export function classifyTrainingType(a: TrainingAssignment): string {
  const t = (a.training_type || '').toLowerCase();
  const src = (a.source || '').toLowerCase();
  if (src.includes('retraining') || src.includes('refresher')) return 'Refresher Training';
  if (t.includes('sop')) return 'SOP Training';
  if (t.includes('gmp')) return 'GMP Training';
  if (t.includes('safety')) return 'Safety Training';
  if (t.includes('csv')) return 'CSV Training';
  if (t.includes('data integrity')) return 'Data Integrity Training';
  if (t.includes('capa') || t.includes('deviation')) return 'Role Based Training';
  if (a.training_mode === 'On Job Training' || t.includes('on job')) return 'On Job Training';
  if (a.training_mode === 'External') return 'External Training';
  if (a.source === 'matrix_new_user') return 'Induction';
  return a.training_type || 'GMP Training';
}
