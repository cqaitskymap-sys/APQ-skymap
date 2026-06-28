export const TRAINING_DASHBOARD_MODULE = 'Training Management Dashboard';

export const TRAINING_DASHBOARD_TYPES = [
  'Induction',
  'SOP Training',
  'Refresher Training',
  'Role Based Training',
  'GMP Training',
  'Safety Training',
  'CSV Training',
  'Data Integrity Training',
  'On Job Training',
  'External Training',
] as const;

export const TRAINING_DASHBOARD_STATUSES = [
  'Draft',
  'Assigned',
  'In Progress',
  'Completed',
  'Effectiveness Pending',
  'Effective',
  'Not Effective',
  'Overdue',
  'Cancelled',
] as const;

export const TRAINING_MODES_FILTER = [
  'Classroom',
  'Online',
  'On Job Training',
  'Self Reading',
  'External',
  'Virtual',
  'Self-Study',
] as const;

export interface TrainingDashboardFilters {
  department?: string;
  employee_id?: string;
  designation?: string;
  training_type?: string;
  status?: string;
  trainer?: string;
  training_mode?: string;
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
  trainer?: string;
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

export interface TrainingDashboardActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

function roleKey(role?: string | null): string {
  return (role || '').toLowerCase();
}

function isQaRole(r: string): boolean {
  return ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function canManageTrainingDashboardModule(role?: string | null): boolean {
  const r = roleKey(role);
  return r === 'super_admin' || r === 'training_coordinator' || isQaRole(r);
}

export function canExportTrainingDashboardModule(role?: string | null): boolean {
  const r = roleKey(role);
  return ['super_admin', 'admin', 'training_coordinator'].includes(r) || isQaRole(r);
}

export function canViewTrainingDashboardModule(role?: string | null): boolean {
  const r = roleKey(role);
  return canManageTrainingDashboardModule(r)
    || canExportTrainingDashboardModule(r)
    || canViewDepartmentTrainingDashboard(r)
    || isEmployeeTrainingDashboardView(r)
    || isTrainingDashboardReadOnly(r);
}

export function canViewDepartmentTrainingDashboard(role?: string | null): boolean {
  const r = roleKey(role);
  return canManageTrainingDashboardModule(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r);
}

export function isEmployeeTrainingDashboardView(role?: string | null): boolean {
  const r = roleKey(role);
  return ['employee', 'production', 'qc', 'warehouse'].includes(r)
    && !canViewDepartmentTrainingDashboard(r);
}

export function isTrainingDashboardReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(roleKey(role));
}

export function isDepartmentTrainingDashboardView(role?: string | null): boolean {
  const r = roleKey(role);
  return canViewDepartmentTrainingDashboard(r)
    && !canManageTrainingDashboardModule(r)
    && !canExportTrainingDashboardModule(r);
}
