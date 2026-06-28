import type { TrainingAttendance, TrainingRecord, TrainingAssignment } from '@/lib/training-types';
import {
  ATTENDANCE_STATUSES, COMPLETION_STATUSES, TRAINING_RESULTS, TRAINING_MODES,
} from '@/lib/training-types';

export const TRAINING_COMPLETION_MODULE = 'Training Completion & Attendance';
export const ATTENDANCE_COLLECTION = 'training_attendance';
export const RECORDS_COLLECTION = 'training_records';

export { ATTENDANCE_STATUSES, COMPLETION_STATUSES, TRAINING_RESULTS, TRAINING_MODES };
export type { TrainingAttendance, TrainingRecord, TrainingAssignment };

export interface CompletionFilters {
  department?: string;
  employee_id?: string;
  attendance_status?: string;
  completion_status?: string;
  training_result?: string;
  trainer?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface CompletionDashboardKpis {
  totalRecords: number;
  completed: number;
  failed: number;
  inProgress: number;
  pendingCompletion: number;
  attendanceLogged: number;
  absentCount: number;
  passRate: number;
}

export interface CompletionDashboardCharts {
  passVsFail: { name: string; value: number }[];
  attendanceStatus: { name: string; value: number }[];
  completionTrend: { month: string; count: number }[];
  departmentCompletion: { name: string; value: number }[];
}

export interface CompletionDashboardData {
  kpis: CompletionDashboardKpis;
  charts: CompletionDashboardCharts;
  attendance: TrainingAttendance[];
  records: TrainingRecord[];
  openAssignments: TrainingAssignment[];
  pendingEffectiveness: TrainingRecord[];
}

export interface CompletionActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function computeTrainingResult(
  score: number | null,
  passMarks: number,
  assessmentRequired: boolean,
): string {
  if (!assessmentRequired || score == null) return 'Not Applicable';
  return score >= passMarks ? 'Pass' : 'Fail';
}

export function canManageCompletion(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator'].includes(r);
}

export function canApproveCompletion(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageCompletion(r) || ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function canMarkCompletionAttendance(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageCompletion(r) || canApproveCompletion(r)
    || ['trainer', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager', 'supervisor'].includes(r);
}

export function canViewCompletion(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canMarkCompletionAttendance(r)
    || ['department_head', 'auditor', 'viewer', 'employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function isCompletionReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isEmployeeCompletionView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  const deptRoles = ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
  return ['employee', 'production', 'qc', 'warehouse'].includes(r) && !canManageCompletion(r) && !deptRoles.includes(r);
}

export function isDepartmentCompletionView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)
    && !canManageCompletion(r) && !canApproveCompletion(r);
}

export function attendanceStatusColor(status: string): string {
  const map: Record<string, string> = {
    Present: 'bg-green-100 text-green-800',
    Absent: 'bg-red-100 text-red-800',
    Late: 'bg-amber-100 text-amber-800',
    Excused: 'bg-blue-100 text-blue-800',
  };
  return map[status] || map.Present;
}

export function completionStatusColor(status: string): string {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-600',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
    Cancelled: 'bg-slate-100 text-slate-500',
  };
  return map[status] || map['Not Started'];
}

export function trainingResultColor(result: string): string {
  const map: Record<string, string> = {
    Pass: 'bg-green-100 text-green-800',
    Fail: 'bg-red-100 text-red-800',
    'Not Applicable': 'bg-slate-100 text-slate-600',
  };
  return map[result] || map['Not Applicable'];
}

export function openAssignmentStatuses(): string[] {
  return ['pending', 'in_progress', 'overdue', 'retraining', 'assigned'];
}
