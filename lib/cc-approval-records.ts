import { normalizeRole } from '@/lib/permissions';
import {
  requiresHeadQaApproval,
  requiresRegulatoryReview,
  type CcApprovalDashboardCounts,
  type CcApprovalHistoryEntry,
  type ChangeApproval,
  type ChangeControlRecord,
} from '@/lib/change-control-types';

export const CC_APPROVAL_MODULE = 'Change Control Approval Workflow';

export const CC_APPROVAL_MEANINGS = [
  'I have reviewed this change control.',
  'I approve this change control.',
  'I reject this change control.',
  'I authorize implementation of this change.',
  'I provide final GMP approval.',
] as const;

export interface CcWorkflowStepDef {
  level: number;
  stepName: string;
  approverRole: string;
  dueDays: number;
  eSignatureRequired: boolean;
  commentRequired: boolean;
}

export interface CcWorkflowContext {
  impactExists: boolean;
  impactApproved: boolean;
  riskExists: boolean;
  riskApproved: boolean;
  validationRequired: boolean;
  csvRequired: boolean;
  regulatoryRequired: boolean;
  headQaRequired: boolean;
  patientSafetyHeadQa: boolean;
  dataIntegrityCsv: boolean;
}

const deptRoleMap: Record<string, string> = {
  Production: 'production_manager',
  QC: 'qc_manager',
  QA: 'qa_manager',
  Engineering: 'engineering_manager',
  Warehouse: 'warehouse_manager',
  Regulatory: 'regulatory_affairs',
  Microbiology: 'qc_manager',
  Packaging: 'production_manager',
  Maintenance: 'engineering_manager',
  'IT / CSV': 'csv_team',
};

export function deptToCcApproverRole(department?: string): string {
  return deptRoleMap[department || ''] || 'production_manager';
}

export function buildCcWorkflowContext(
  change: ChangeControlRecord,
  impactExists: boolean,
  riskExists: boolean,
  opts?: { impactApproved?: boolean; riskApproved?: boolean; dataIntegrityImpact?: boolean },
): CcWorkflowContext {
  const patientSafetyHeadQa = Boolean(change.patient_safety_impact);
  const headQaRequired = requiresHeadQaApproval(change.change_category) || patientSafetyHeadQa;
  const dataIntegrityCsv = Boolean(change.csv_impact) || Boolean(opts?.dataIntegrityImpact);
  return {
    impactExists,
    impactApproved: opts?.impactApproved ?? impactExists,
    riskExists,
    riskApproved: opts?.riskApproved ?? riskExists,
    validationRequired: Boolean(change.validation_impact),
    csvRequired: Boolean(change.csv_impact),
    regulatoryRequired: requiresRegulatoryReview(change),
    headQaRequired,
    patientSafetyHeadQa,
    dataIntegrityCsv,
  };
}

export function buildCcWorkflowSteps(ctx: CcWorkflowContext, department?: string): CcWorkflowStepDef[] {
  const steps: CcWorkflowStepDef[] = [
    { level: 1, stepName: 'Submitted', approverRole: 'initiator', dueDays: 1, eSignatureRequired: false, commentRequired: false },
    { level: 2, stepName: 'Department Head Review', approverRole: deptToCcApproverRole(department), dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: 3, stepName: 'QA Review', approverRole: 'qa', dueDays: 7, eSignatureRequired: true, commentRequired: true },
    { level: 4, stepName: 'Impact Assessment Review', approverRole: 'qa_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: 5, stepName: 'Risk Assessment Review', approverRole: 'qa', dueDays: 7, eSignatureRequired: true, commentRequired: true },
  ];
  if (ctx.validationRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Validation Review', approverRole: 'validation_team', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }
  if (ctx.csvRequired || ctx.dataIntegrityCsv) {
    steps.push({ level: steps.length + 1, stepName: 'CSV Review', approverRole: 'csv_team', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  }
  if (ctx.regulatoryRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Regulatory Review', approverRole: 'regulatory_affairs', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }
  if (ctx.headQaRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Head QA Review', approverRole: 'head_qa', dueDays: 5, eSignatureRequired: true, commentRequired: true });
  }
  steps.push(
    { level: steps.length + 1, stepName: 'Implementation Approval', approverRole: 'qa_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: steps.length + 1, stepName: 'Final Approval', approverRole: ctx.headQaRequired ? 'head_qa' : 'qa_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true },
  );
  return steps.map((s, i) => ({ ...s, level: i + 1 }));
}

export function validateCcApprovalAction(
  stepName: string,
  ctx: CcWorkflowContext,
): { ok: boolean; error?: string } {
  if (stepName === 'Impact Assessment Review' && !ctx.impactExists) {
    return { ok: false, error: 'Impact assessment must be completed before Impact Assessment Review approval.' };
  }
  if (stepName === 'Risk Assessment Review' && !ctx.impactApproved) {
    return { ok: false, error: 'Impact assessment must be approved before Risk Assessment Review.' };
  }
  if (stepName === 'Risk Assessment Review' && !ctx.riskExists) {
    return { ok: false, error: 'Risk assessment must be completed before Risk Assessment Review approval.' };
  }
  if (stepName === 'Validation Review' && ctx.validationRequired && !ctx.riskApproved) {
    return { ok: false, error: 'Risk assessment must be approved before Validation Review.' };
  }
  if (stepName === 'CSV Review' && (ctx.csvRequired || ctx.dataIntegrityCsv) && !ctx.riskApproved) {
    return { ok: false, error: 'Risk assessment must be approved before CSV Review.' };
  }
  if (stepName === 'Regulatory Review' && ctx.regulatoryRequired && !ctx.impactApproved) {
    return { ok: false, error: 'Impact assessment must be approved before Regulatory Review.' };
  }
  return { ok: true };
}

export function roleMatchesCcStep(
  userRole: string | undefined,
  stepRole: string,
  initiatorId?: string,
  userId?: string,
): boolean {
  if (!userRole) return false;
  const u = normalizeRole(userRole);
  const raw = (userRole || '').toLowerCase();
  if (['super_admin', 'admin'].includes(u)) return true;
  if (stepRole === 'initiator') return userId === initiatorId;
  if (stepRole === 'qa' && ['qa', 'qa_executive', 'qa_manager'].includes(u)) return true;
  if (stepRole === 'qa_manager' && ['qa_manager', 'head_qa'].includes(u)) return true;
  if (stepRole === 'head_qa' && u === 'head_qa') return true;
  if (stepRole === 'regulatory_affairs' && (u === 'regulatory_affairs' || raw.includes('regulatory'))) return true;
  if (stepRole === 'validation_team' && raw.includes('validation')) return true;
  if (stepRole === 'csv_team' && raw.includes('csv')) return true;
  if (stepRole === 'production_manager' && ['production_manager', 'production'].includes(u)) return true;
  if (stepRole === 'qc_manager' && ['qc_manager', 'qc'].includes(u)) return true;
  if (stepRole === 'engineering_manager' && ['engineering_manager', 'engineering'].includes(u)) return true;
  if (stepRole === 'warehouse_manager' && ['warehouse_manager', 'warehouse'].includes(u)) return true;
  return u === stepRole;
}

export function canActOnCcApproval(
  role: string | undefined,
  stepRole: string | undefined,
  initiatorId?: string,
  userId?: string,
): boolean {
  if (!stepRole) return false;
  return roleMatchesCcStep(role, stepRole, initiatorId, userId);
}

export function isCcApprovalReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canViewCcApproval(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  if (raw.includes('validation') || raw.includes('csv') || raw.includes('regulatory')) return true;
  return raw.includes('production') || raw.includes('engineering') || raw.includes('qc') || raw.includes('warehouse');
}

export function getCurrentPendingCcApproval(approvals: ChangeApproval[]): ChangeApproval | null {
  return approvals
    .filter((a) => !a.is_deleted && ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0] || null;
}

export function mapCcStatusForStep(stepName: string, action: string): string {
  if (action === 'reject') return 'rejected';
  if (action === 'send_back') return 'draft';
  const map: Record<string, string> = {
    Submitted: 'submitted',
    'Department Head Review': 'submitted',
    'QA Review': 'under_qa_review',
    'Impact Assessment Review': 'impact_assessment',
    'Risk Assessment Review': 'risk_assessment',
    'Validation Review': 'under_qa_review',
    'CSV Review': 'under_qa_review',
    'Regulatory Review': 'under_qa_review',
    'Head QA Review': 'final_qa_review',
    'Implementation Approval': 'approved_for_implementation',
    'Final Approval': 'approved_for_implementation',
  };
  return map[stepName] || 'under_qa_review';
}

export function ccApprovalMeaning(stepName: string, action: 'approve' | 'reject'): string {
  if (action === 'reject') return CC_APPROVAL_MEANINGS[2];
  if (stepName === 'Implementation Approval') return CC_APPROVAL_MEANINGS[3];
  if (stepName === 'Final Approval') return CC_APPROVAL_MEANINGS[4];
  if (stepName.includes('Review')) return CC_APPROVAL_MEANINGS[0];
  return CC_APPROVAL_MEANINGS[1];
}

export function approvalStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Waiting: 'bg-slate-100 text-slate-700',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    'Sent Back': 'bg-orange-100 text-orange-800',
    Escalated: 'bg-purple-100 text-purple-800',
    Completed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || ''] || 'bg-slate-100 text-slate-700';
}

export function workflowStepColor(step?: string): string {
  const map: Record<string, string> = {
    'Head QA Review': 'bg-red-100 text-red-800',
    'CSV Review': 'bg-indigo-100 text-indigo-800',
    'Validation Review': 'bg-violet-100 text-violet-800',
    'Regulatory Review': 'bg-cyan-100 text-cyan-800',
    'Implementation Approval': 'bg-teal-100 text-teal-800',
    'Final Approval': 'bg-green-100 text-green-800',
  };
  return map[step || ''] || 'bg-blue-100 text-blue-800';
}

export function mapHistoryToCcApprovalTimeline(history: CcApprovalHistoryEntry[]) {
  return history
    .filter((h) => !h.is_deleted)
    .map((h) => ({
      action: h.action,
      step: h.workflow_step || '—',
      user: h.user_name,
      role: h.user_role,
      at: h.created_at,
      comments: h.comments || h.rejection_reason || h.send_back_reason || '',
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function computeCcApprovalDashboardCounts(
  approvals: ChangeApproval[],
  changes: ChangeControlRecord[],
  userRole?: string,
  userId?: string,
): CcApprovalDashboardCounts {
  const active = approvals.filter((a) => !a.is_deleted);
  const pending = active.filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''));
  const today = new Date().toISOString().split('T')[0];
  const changeById = new Map(changes.map((c) => [c.id, c]));
  const myPending = pending.filter((a) => canActOnCcApproval(userRole, a.current_role || a.approver_role, changeById.get(a.change_id)?.initiated_by, userId)).length;

  return {
    pendingApprovals: pending.length,
    myPendingApprovals: myPending,
    approvedChanges: changes.filter((c) => ['approved_for_implementation', 'approved', 'implemented', 'closed'].includes(c.status)).length,
    rejectedChanges: changes.filter((c) => c.status === 'rejected').length,
    criticalPending: pending.filter((a) => changeById.get(a.change_id)?.change_category === 'Critical').length,
    csvReviewsPending: pending.filter((a) => a.current_workflow_step === 'CSV Review').length,
    validationReviewsPending: pending.filter((a) => a.current_workflow_step === 'Validation Review').length,
    regulatoryReviewsPending: pending.filter((a) => a.current_workflow_step === 'Regulatory Review').length,
    headQaPending: pending.filter((a) => a.current_workflow_step === 'Head QA Review').length,
    overdueApprovals: pending.filter((a) => a.due_date && a.due_date < today).length,
  };
}

export function daysPendingCcApproval(approval: ChangeApproval): number {
  if (!approval.created_at) return 0;
  const start = new Date(approval.created_at).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}
