export const TRAINING_RETRAINING_MODULE = 'Retraining Management';

export const RETRAINING_STATUSES = [
  'Draft', 'Assigned', 'Scheduled', 'In Progress', 'Completed', 'Overdue', 'Cancelled', 'Failed', 'Closed',
] as const;

export const RETRAINING_TRIGGER_TYPES = [
  'SOP Revision', 'Document Revision', 'CAPA', 'Deviation', 'OOS', 'OOT', 'Change Control',
  'Risk Assessment', 'Failed Assessment', 'Failed Competency', 'Periodic Refresher', 'Annual GMP',
  'Data Integrity', 'CSV', 'Validation', 'Management Decision', 'Regulatory Requirement',
] as const;

export const RETRAINING_COLLECTION = 'retraining_records';

export type RetrainingStatus = typeof RETRAINING_STATUSES[number];
export type RetrainingTriggerType = typeof RETRAINING_TRIGGER_TYPES[number];

export interface RetrainingRecord {
  id: string;
  retraining_id: string;
  retraining_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  training_topic: string;
  training_type: string;
  original_training_id: string;
  original_completion_date: string | null;
  trigger_type: RetrainingTriggerType | string;
  trigger_reference: string;
  document_number: string;
  document_version: string;
  sop_number: string;
  reason: string;
  assigned_date: string;
  due_date: string;
  trainer: string;
  training_mode: string;
  assessment_required: boolean;
  passing_score: number;
  obtained_score: number | null;
  result: string;
  competency_status: string;
  retraining_status: RetrainingStatus | string;
  completion_date: string | null;
  certificate_issued: boolean;
  certificate_number: string | null;
  scheduled_event_id: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  // Legacy fields (calendar/reports compat)
  original_assignment_id?: string;
  training_title?: string;
  status?: string;
}

export interface RetrainingFilters {
  department?: string;
  employee_id?: string;
  trigger_type?: string;
  training_type?: string;
  status?: string;
  trainer?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface RetrainingDashboardKpis {
  totalRetraining: number;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  failed: number;
  annualGmpDue: number;
  certificatesExpired: number;
  competencyGaps: number;
  departmentCompliance: number;
}

export interface RetrainingDashboardCharts {
  retrainingTrend: { month: string; count: number }[];
  triggerTypeDistribution: { name: string; value: number }[];
  departmentRetraining: { name: string; value: number }[];
  completionTrend: { month: string; count: number }[];
  passVsFail: { name: string; value: number }[];
  competencyImprovement: { month: string; percent: number }[];
  certificateRenewalTrend: { month: string; count: number }[];
  overdueTrend: { month: string; count: number }[];
}

export interface RetrainingDashboardData {
  kpis: RetrainingDashboardKpis;
  charts: RetrainingDashboardCharts;
  records: RetrainingRecord[];
  upcoming: RetrainingRecord[];
  overdue: RetrainingRecord[];
  failed: RetrainingRecord[];
  recentCompleted: RetrainingRecord[];
  certificateRenewals: RetrainingRecord[];
  capaLinked: RetrainingRecord[];
  deviationLinked: RetrainingRecord[];
}

export interface RetrainingActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function generateRetrainingNumber(): string {
  const year = new Date().getFullYear();
  return `RTR-${year}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

export function computeRetrainingStatus(
  dueDate: string,
  current?: string,
  completionDate?: string | null,
): RetrainingStatus {
  if (current === 'Cancelled' || current === 'Closed' || current === 'Draft') return current as RetrainingStatus;
  if (current === 'Failed') return 'Failed';
  if (completionDate || current === 'Completed') return 'Completed';
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate && dueDate < today && !['Completed', 'Closed', 'Cancelled'].includes(String(current))) {
    return 'Overdue';
  }
  return (current as RetrainingStatus) || 'Assigned';
}

export function canManageRetraining(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator'].includes(r);
}

export function canApproveRetraining(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageRetraining(r) || ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function canAssignRetraining(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageRetraining(r) || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r);
}

export function canConductRetraining(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageRetraining(r) || canApproveRetraining(r) || ['trainer', 'training_coordinator'].includes(r);
}

export function canViewRetraining(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canAssignRetraining(r) || canConductRetraining(r)
    || ['auditor', 'viewer'].includes(r)
    || ['employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function isRetrainingReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isEmployeeRetrainingView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['employee', 'production', 'qc', 'warehouse'].includes(r) && !canManageRetraining(r);
}

export function retrainingStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Assigned: 'bg-amber-100 text-amber-800',
    Scheduled: 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Overdue: 'bg-red-100 text-red-800',
    Cancelled: 'bg-slate-100 text-slate-600',
    Failed: 'bg-red-100 text-red-800',
    Closed: 'bg-teal-100 text-teal-800',
  };
  return map[status] || map.Assigned;
}
