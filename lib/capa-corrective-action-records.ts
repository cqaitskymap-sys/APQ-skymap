import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/capa-types';
import type {
  CapaCorrectiveAction,
  CapaCorrectiveActionDashboardMetrics,
  CapaCorrectiveActionTimelineEntry,
  CapaRecord,
} from '@/lib/capa-types';

export const CAPA_CORRECTIVE_ACTION_MODULE = 'CAPA Corrective Action';

export type CapaCorrectiveActionActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CapaCorrectiveActionFormInput {
  capa_id: string;
  root_cause_reference?: string;
  corrective_action_description: string;
  action_owner: string;
  action_owner_name?: string;
  department: string;
  priority: string;
  target_completion_date: string;
  verification_required?: boolean;
  remarks?: string;
}

export interface CapaCorrectiveActionImplementationInput {
  implementation_status: string;
  implementation_evidence: string;
  actual_completion_date?: string;
}

export interface CapaCorrectiveActionVerificationInput {
  decision: 'approved' | 'rejected';
  verification_comments: string;
  qa_review_comments?: string;
}

const CLOSED_STATUSES = ['closed', 'approved'];
const OPEN_STATUSES = ['draft', 'assigned', 'under_implementation', 'implemented', 'qa_verification', 'overdue'];

export function canViewCapaCorrectiveAction(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  if (['qc_manager', 'qc', 'production_manager', 'production', 'engineering_manager', 'engineering'].includes(r)) return true;
  return false;
}

export function isCapaCorrectiveActionReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canCreateCapaCorrectiveAction(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canAssignCapaCorrectiveAction(role?: string | null): boolean {
  return canCreateCapaCorrectiveAction(role);
}

export function canUpdateCapaCorrectiveActionImplementation(
  role: string | null | undefined,
  action: CapaCorrectiveAction,
  capa: CapaRecord,
  actorId: string,
): boolean {
  if (isCapaCorrectiveActionReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  if (action.action_owner === actorId || capa.action_owner === actorId) return true;
  return false;
}

export function canReviewCapaCorrectiveActionByDept(
  role: string | null | undefined,
  action: CapaCorrectiveAction,
): boolean {
  const r = normalizeRole(role || '');
  const deptHeadMap: Record<string, string> = {
    production_manager: 'Production',
    qc_manager: 'QC',
    engineering_manager: 'Engineering',
  };
  const dept = deptHeadMap[r];
  return Boolean(dept && action.department === dept);
}

export function canVerifyCapaCorrectiveAction(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canApproveCriticalCapaCorrectiveAction(role?: string | null, priority?: string): boolean {
  if (!requiresHeadQaApproval(priority || '')) return canVerifyCapaCorrectiveAction(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function isCorrectiveActionClosed(status?: string | null): boolean {
  return CLOSED_STATUSES.includes(status || '');
}

export function isCorrectiveActionOpen(status?: string | null): boolean {
  return OPEN_STATUSES.includes(status || '') || status === 'rejected';
}

export function computeCorrectiveActionProgress(action: CapaCorrectiveAction): number {
  const map: Record<string, number> = {
    draft: 10,
    assigned: 25,
    under_implementation: 50,
    implemented: 70,
    qa_verification: 85,
    approved: 95,
    closed: 100,
    rejected: 40,
    overdue: 45,
  };
  return map[action.action_status] ?? 0;
}

export function buildCorrectiveActionIdFallback(year: number, seq: number): string {
  return `CA-CAPA/${year}/${String(seq).padStart(4, '0')}`;
}

export function buildActionNumber(capaNumber: string, seq: number): string {
  return `${capaNumber}-CA-${String(seq).padStart(3, '0')}`;
}

export function actionStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    assigned: 'Assigned',
    under_implementation: 'Under Implementation',
    implemented: 'Implemented',
    qa_verification: 'QA Verification',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
    overdue: 'Overdue',
  };
  return map[status || 'draft'] || status || 'Draft';
}

export function actionStatusColor(status?: string): string {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    assigned: 'bg-indigo-100 text-indigo-800',
    under_implementation: 'bg-purple-100 text-purple-800',
    implemented: 'bg-teal-100 text-teal-800',
    qa_verification: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    closed: 'bg-emerald-100 text-emerald-800',
    overdue: 'bg-red-100 text-red-800 animate-pulse',
  };
  return map[status || 'draft'] || map.draft;
}

export function implementationStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    implemented: 'Implemented',
    delayed: 'Delayed',
    rejected: 'Rejected',
  };
  return map[status || 'not_started'] || status || 'Not Started';
}

export function implementationStatusColor(status?: string): string {
  const map: Record<string, string> = {
    not_started: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-800',
    implemented: 'bg-green-100 text-green-800',
    delayed: 'bg-orange-100 text-orange-800',
    rejected: 'bg-red-100 text-red-800',
  };
  return map[status || 'not_started'] || map.not_started;
}

export function computeCorrectiveActionDashboardMetrics(
  actions: CapaCorrectiveAction[],
): CapaCorrectiveActionDashboardMetrics {
  const active = actions.filter((a) => !a.is_deleted);
  return {
    total: active.length,
    open: active.filter((a) => isCorrectiveActionOpen(a.action_status) && !['implemented', 'qa_verification'].includes(a.action_status)).length,
    implemented: active.filter((a) => ['implemented', 'approved'].includes(a.action_status)).length,
    qaVerificationPending: active.filter((a) => a.action_status === 'qa_verification').length,
    overdue: active.filter((a) => a.action_status === 'overdue').length,
    rejected: active.filter((a) => a.action_status === 'rejected').length,
    closed: active.filter((a) => a.action_status === 'closed').length,
  };
}

export function mapAuditToCorrectiveActionTimeline(
  logs: Record<string, unknown>[],
): CapaCorrectiveActionTimelineEntry[] {
  return logs
    .filter((log) => {
      const action = String(log.action || log.actionType || '');
      return /corrective|implementation|evidence|verification|assign|approve|reject|overdue|closed/i.test(action);
    })
    .map((log) => ({
      action: String(log.action || log.actionType || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || log.newValue || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function applyCorrectiveActionOverdueCheck(action: CapaCorrectiveAction): CapaCorrectiveAction {
  if (isCorrectiveActionClosed(action.action_status) || action.action_status === 'overdue') return action;
  const today = new Date().toISOString().split('T')[0];
  if (action.target_completion_date && action.target_completion_date < today) {
    return { ...action, action_status: 'overdue' };
  }
  return action;
}

export function hasRequiredEvidence(action: CapaCorrectiveAction): boolean {
  return Boolean(
    action.implementation_evidence?.trim()
    || (action.evidence_items && action.evidence_items.length > 0),
  );
}
