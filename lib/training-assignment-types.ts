import type { TrainingAssignment, TrainingCalendarEvent, TrainingScheduleSession } from '@/lib/training-types';
import { ASSIGNMENT_TRAINING_MODES, TRAINING_ASSIGNMENT_STATUSES } from '@/lib/training-types';
import { getAssignmentDisplayStatus } from '@/lib/training-types';

export const TRAINING_ASSIGNMENT_MODULE = 'Training Assignment & Scheduling';
export const ASSIGNMENTS_COLLECTION = 'training_assignments';

export { ASSIGNMENT_TRAINING_MODES, TRAINING_ASSIGNMENT_STATUSES, getAssignmentDisplayStatus };
export type { TrainingAssignment, TrainingCalendarEvent, TrainingScheduleSession };

export interface AssignmentFilters {
  department?: string;
  employee_id?: string;
  training_type?: string;
  training_status?: string;
  training_mode?: string;
  trainer?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface AssignmentDashboardKpis {
  totalAssignments: number;
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
  fromMatrix: number;
  sopRetraining: number;
}

export interface AssignmentDashboardCharts {
  statusDistribution: { name: string; value: number }[];
  departmentAssignments: { name: string; value: number }[];
  assignmentTrend: { month: string; count: number }[];
  modeDistribution: { name: string; value: number }[];
}

export interface AssignmentDashboardData {
  kpis: AssignmentDashboardKpis;
  charts: AssignmentDashboardCharts;
  assignments: TrainingAssignment[];
  calendar: TrainingCalendarEvent[];
  upcomingDue: TrainingAssignment[];
}

export interface AssignmentActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function canManageAssignments(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator'].includes(r);
}

export function canAssignAssignments(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageAssignments(r)
    || ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r);
}

export function canViewAssignments(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canAssignAssignments(r)
    || ['auditor', 'viewer', 'employee', 'production', 'qc', 'warehouse', 'trainer'].includes(r);
}

export function isAssignmentReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isEmployeeAssignmentView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  const deptRoles = ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
  return ['employee', 'production', 'qc', 'warehouse'].includes(r) && !canManageAssignments(r) && !deptRoles.includes(r);
}

export function isDepartmentAssignmentView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)
    && !canManageAssignments(r) && !['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function assignmentStatusColor(status: string): string {
  const map: Record<string, string> = {
    Assigned: 'bg-amber-100 text-amber-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Overdue: 'bg-red-100 text-red-800 animate-pulse',
    Cancelled: 'bg-slate-100 text-slate-500',
  };
  return map[status] || map.Assigned;
}

export function displayAssignmentStatus(a: TrainingAssignment): string {
  return getAssignmentDisplayStatus(a);
}

export function isOverdueAssignment(a: TrainingAssignment): boolean {
  if (['completed', 'cancelled', 'failed'].includes(String(a.status))) return false;
  return a.due_date < new Date().toISOString().slice(0, 10);
}
