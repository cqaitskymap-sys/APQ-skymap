import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/change-control-types';
import type {
  CcGanttItem,
  CcImplementationChartData,
  CcImplementationDashboardMetrics,
  CcImplementationPlan,
  CcImplementationTask,
  ChangeControlRecord,
} from '@/lib/change-control-types';

export const CC_IMPLEMENTATION_MODULE = 'Change Implementation Plan';

export type CcImplementationActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CcImplementationPlanInput {
  change_id: string;
  implementation_title: string;
  implementation_description: string;
  implementation_owner: string;
  implementation_owner_name?: string;
  department: string;
  planned_start_date: string;
  planned_end_date: string;
  validation_required: boolean;
  training_required: boolean;
  document_revision_required: boolean;
  capa_required: boolean;
  overall_remarks?: string;
}

export interface CcImplementationTaskInput {
  change_id: string;
  plan_id?: string;
  task_title: string;
  task_description?: string;
  task_category: string;
  assigned_to: string;
  assigned_to_name?: string;
  department: string;
  priority: string;
  dependency_task_id?: string | null;
  planned_start_date: string;
  planned_end_date: string;
  remarks?: string;
  is_mandatory?: boolean;
}

export interface CcImplementationQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
}

const APPROVED_FOR_IMPL = [
  'approved_for_implementation', 'approved', 'implementation_in_progress',
  'implemented', 'effectiveness_pending', 'effectiveness_completed',
];

const COMPLETED_TASK_STATUSES = ['Completed'];

export function canStartImplementation(change: ChangeControlRecord): boolean {
  return APPROVED_FOR_IMPL.includes(change.status);
}

export function computeImplementationProgress(tasks: CcImplementationTask[]): number {
  const active = tasks.filter((t) => !t.is_deleted);
  if (!active.length) return 0;
  const completed = active.filter((t) => COMPLETED_TASK_STATUSES.includes(t.task_status)).length;
  return Math.round((completed / active.length) * 100);
}

export function deriveImplementationStatus(
  plan: CcImplementationPlan,
  tasks: CcImplementationTask[],
): string {
  const active = tasks.filter((t) => !t.is_deleted);
  const progress = computeImplementationProgress(active);
  if (plan.implementation_status === 'Closed') return 'Closed';
  if (plan.implementation_status === 'Draft' && progress === 0 && !plan.actual_start_date) {
    return 'Draft';
  }
  if (plan.qa_review_completed && progress === 100) return 'Verified';
  if (progress === 100) return 'Pending Verification';
  if (progress > 0 && progress < 100) return 'Partially Completed';
  if (plan.actual_start_date || active.some((t) => !['Not Started', 'Assigned'].includes(t.task_status))) {
    return 'In Progress';
  }
  if (plan.implementation_status === 'Approved For Implementation') return 'Approved For Implementation';
  return plan.implementation_status || 'Draft';
}

export function isTaskOverdue(task: CcImplementationTask): boolean {
  if (COMPLETED_TASK_STATUSES.includes(task.task_status)) return false;
  const today = new Date().toISOString().split('T')[0];
  return Boolean(task.planned_end_date && task.planned_end_date < today);
}

export function refreshTaskOverdueStatus(tasks: CcImplementationTask[]): CcImplementationTask[] {
  return tasks.map((t) => ({
    ...t,
    task_status: isTaskOverdue(t) && !COMPLETED_TASK_STATUSES.includes(t.task_status) ? 'Overdue' : t.task_status,
  }));
}

export function validateTaskDependency(
  task: CcImplementationTask,
  tasks: CcImplementationTask[],
): { ok: boolean; error?: string } {
  if (!task.dependency_task_id) return { ok: true };
  const dep = tasks.find((t) => t.id === task.dependency_task_id || t.task_id === task.dependency_task_id);
  if (!dep) return { ok: false, error: 'Dependency task not found.' };
  if (!COMPLETED_TASK_STATUSES.includes(dep.task_status)) {
    return { ok: false, error: `Dependency task "${dep.task_title}" must be completed first.` };
  }
  return { ok: true };
}

export function detectCircularDependency(
  taskId: string,
  dependencyId: string | null | undefined,
  tasks: CcImplementationTask[],
): boolean {
  if (!dependencyId) return false;
  const visited = new Set<string>();
  let current: string | null | undefined = dependencyId;
  while (current) {
    if (current === taskId || visited.has(current)) return true;
    visited.add(current);
    const t = tasks.find((x) => x.id === current || x.task_id === current);
    current = t?.dependency_task_id;
  }
  return false;
}

export function getMandatoryTaskTemplates(plan: CcImplementationPlanInput): CcImplementationTaskInput[] {
  const tasks: CcImplementationTaskInput[] = [];
  if (plan.validation_required) {
    tasks.push({
      change_id: plan.change_id,
      task_title: 'Execute validation activities per approved plan',
      task_category: 'Validation',
      assigned_to: plan.implementation_owner,
      assigned_to_name: plan.implementation_owner_name,
      department: plan.department,
      priority: 'High',
      planned_start_date: plan.planned_start_date,
      planned_end_date: plan.planned_end_date,
      is_mandatory: true,
    });
  }
  if (plan.training_required) {
    tasks.push({
      change_id: plan.change_id,
      task_title: 'Conduct training for affected personnel',
      task_category: 'Training',
      assigned_to: plan.implementation_owner,
      department: plan.department,
      priority: 'Medium',
      planned_start_date: plan.planned_start_date,
      planned_end_date: plan.planned_end_date,
      is_mandatory: true,
    });
  }
  if (plan.document_revision_required) {
    tasks.push({
      change_id: plan.change_id,
      task_title: 'Revise affected documents and SOPs',
      task_category: 'Document Update',
      assigned_to: plan.implementation_owner,
      department: plan.department,
      priority: 'Medium',
      planned_start_date: plan.planned_start_date,
      planned_end_date: plan.planned_end_date,
      is_mandatory: true,
    });
  }
  if (plan.capa_required) {
    tasks.push({
      change_id: plan.change_id,
      task_title: 'Execute linked CAPA actions',
      task_category: 'CAPA Action',
      assigned_to: plan.implementation_owner,
      department: plan.department,
      priority: 'High',
      planned_start_date: plan.planned_start_date,
      planned_end_date: plan.planned_end_date,
      is_mandatory: true,
    });
  }
  return tasks;
}

export function allMandatoryTasksComplete(tasks: CcImplementationTask[]): boolean {
  const mandatory = tasks.filter((t) => !t.is_deleted && t.is_mandatory);
  return mandatory.every((t) => COMPLETED_TASK_STATUSES.includes(t.task_status));
}

export function buildGanttItems(tasks: CcImplementationTask[]): CcGanttItem[] {
  return tasks
    .filter((t) => !t.is_deleted && t.planned_start_date && t.planned_end_date)
    .map((t) => ({
      id: t.id,
      label: t.task_title,
      start: t.planned_start_date,
      end: t.planned_end_date,
      progress: t.completion_percentage ?? 0,
      status: t.task_status,
      category: t.task_category,
    }));
}

export function canViewCcImplementation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return raw.includes('csv') || raw.includes('validation') || raw.includes('regulatory') || raw.includes('it')
    || ['production_manager', 'production_executive', 'production', 'qc_manager', 'qc', 'qc_executive', 'engineering_manager', 'engineering'].includes(r);
}

export function isCcImplementationReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canManageCcImplementation(role?: string | null, ownerId?: string, userId?: string): boolean {
  if (isCcImplementationReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin'].includes(r)) return true;
  return Boolean(userId && ownerId && userId === ownerId);
}

export function canCompleteCcImplementationTask(
  role: string | null | undefined,
  task: CcImplementationTask,
  userId?: string,
  ownerId?: string,
): boolean {
  if (isCcImplementationReadOnly(role)) return false;
  if (canManageCcImplementation(role, ownerId, userId)) return true;
  if (userId && task.assigned_to === userId) return true;
  return canEditTaskCategory(role, task.task_category);
}

export function canReviewDepartmentTasks(role?: string | null, department?: string, userDepartment?: string): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(r)) return true;
  return Boolean(department && userDepartment && department === userDepartment
    && ['production_manager', 'qc_manager', 'engineering_manager'].includes(r));
}

export function canEditTaskCategory(role?: string | null, category?: string): boolean {
  const raw = (role || '').toLowerCase();
  const r = normalizeRole(role || '');
  if (canManageCcImplementation(role)) return true;
  if (category === 'Equipment Modification' && (raw.includes('engineering') || r === 'engineering_manager')) return true;
  if (category === 'Testing' && ['qc', 'qc_manager'].includes(r)) return true;
  if (category === 'Process Change' && ['production', 'production_manager'].includes(r)) return true;
  if (category === 'Software / CSV' && raw.includes('csv')) return true;
  if (category === 'Regulatory Submission' && raw.includes('regulatory')) return true;
  return false;
}

export function canApproveCcImplementation(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canApproveCriticalCcImplementation(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function requiresHeadQaImplementationReview(
  change: ChangeControlRecord,
  tasks: CcImplementationTask[],
): boolean {
  return requiresHeadQaApproval(change.change_category)
    || tasks.some((t) => !t.is_deleted && t.priority === 'Critical');
}

export function implStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Approved For Implementation': 'bg-teal-100 text-teal-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    'Partially Completed': 'bg-amber-100 text-amber-800',
    Completed: 'bg-green-100 text-green-800',
    'Pending Verification': 'bg-purple-100 text-purple-800',
    Verified: 'bg-emerald-100 text-emerald-800',
    Closed: 'bg-slate-200 text-slate-800',
  };
  return map[status || ''] || 'bg-slate-100 text-slate-700';
}

export function taskStatusColor(status?: string): string {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700',
    Assigned: 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-indigo-100 text-indigo-800',
    'Pending Review': 'bg-amber-100 text-amber-800',
    Completed: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    'On Hold': 'bg-orange-100 text-orange-800',
    Overdue: 'bg-red-100 text-red-800 animate-pulse',
  };
  return map[status || ''] || map['Not Started'];
}

export function priorityColor(priority?: string): string {
  const map: Record<string, string> = {
    Low: 'bg-blue-100 text-blue-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[priority || ''] || map.Medium;
}

export function computeCcImplementationDashboardMetrics(tasks: CcImplementationTask[]): CcImplementationDashboardMetrics {
  const active = refreshTaskOverdueStatus(tasks.filter((t) => !t.is_deleted));
  return {
    totalTasks: active.length,
    completedTasks: active.filter((t) => COMPLETED_TASK_STATUSES.includes(t.task_status)).length,
    openTasks: active.filter((t) => !COMPLETED_TASK_STATUSES.includes(t.task_status)).length,
    overdueTasks: active.filter((t) => t.task_status === 'Overdue' || isTaskOverdue(t)).length,
    criticalTasks: active.filter((t) => t.priority === 'Critical' && !COMPLETED_TASK_STATUSES.includes(t.task_status)).length,
    validationTasks: active.filter((t) => t.task_category === 'Validation').length,
    trainingTasks: active.filter((t) => t.task_category === 'Training').length,
    documentTasks: active.filter((t) => t.task_category === 'Document Update').length,
  };
}

export function computeCcImplementationChartData(tasks: CcImplementationTask[]): CcImplementationChartData {
  const active = refreshTaskOverdueStatus(tasks.filter((t) => !t.is_deleted));
  const statusMap = new Map<string, number>();
  const deptProgress = new Map<string, { completed: number; total: number }>();
  const overdueMap = new Map<string, number>();
  const progressByMonth = new Map<string, { sum: number; count: number }>();

  for (const t of active) {
    statusMap.set(t.task_status, (statusMap.get(t.task_status) || 0) + 1);
    const dept = t.department || 'Unknown';
    const deptEntry = deptProgress.get(dept) || { completed: 0, total: 0 };
    deptEntry.total += 1;
    if (COMPLETED_TASK_STATUSES.includes(t.task_status)) deptEntry.completed += 1;
    deptProgress.set(dept, deptEntry);
    const month = t.planned_end_date?.slice(0, 7) || 'Unknown';
    if (t.task_status === 'Overdue' || isTaskOverdue(t)) overdueMap.set(month, (overdueMap.get(month) || 0) + 1);
    const monthEntry = progressByMonth.get(month) || { sum: 0, count: 0 };
    monthEntry.sum += t.completion_percentage || 0;
    monthEntry.count += 1;
    progressByMonth.set(month, monthEntry);
  }

  return {
    statusDistribution: Array.from(statusMap.entries()).map(([name, count]) => ({ name, count })),
    progressTrend: Array.from(progressByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, { sum, count }]) => ({ name, count: count ? Math.round(sum / count) : 0 })),
    byDepartment: Array.from(deptProgress.entries()).map(([name, { completed, total }]) => ({
      name,
      count: total ? Math.round((completed / total) * 100) : 0,
    })),
    overdueTrend: Array.from(overdueMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })),
  };
}

export function buildImplementationPlanId(changeNumber: string): string {
  return `CC-IMPL-${changeNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

export function buildTaskId(changeNumber: string, seq: number): string {
  return `CC-TASK-${changeNumber.replace(/\s+/g, '-')}-${String(seq).padStart(3, '0')}`;
}

export function mapCcImplementationTaskToLegacyAction(task: CcImplementationTask) {
  const categoryToType: Record<string, 'general' | 'validation' | 'training' | 'csv'> = {
    Validation: 'validation',
    Training: 'training',
    'Software / CSV': 'csv',
  };
  return {
    id: task.id,
    change_id: task.change_id,
    action_item: task.task_title,
    responsible_person: task.assigned_to,
    responsible_person_name: task.assigned_to_name || '',
    target_date: task.planned_end_date || null,
    completion_date: task.actual_end_date,
    status: task.task_status === 'Completed' ? 'completed' : 'pending',
    evidence: task.evidence_url || '',
    remarks: task.remarks || '',
    action_type: categoryToType[task.task_category] || 'general',
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

export function mapCcImplementationAuditToTimeline(logs: Record<string, unknown>[]) {
  return logs
    .filter((log) => /implementation|task|dependency|milestone/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.changedByUserName || log.userName || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
