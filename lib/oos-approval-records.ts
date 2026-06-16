import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  getDaysOverdueOos,
  isCriticalOosTest,
  type OosApproval,
  type OosApprovalHistoryEntry,
  type OosImpactAssessment,
  type OosPhase1,
  type OosPhase2,
  type OosRecord,
} from '@/lib/oos-types';

export const OOS_APPROVAL_MODULE = 'OOS Approval';

export const OOS_APPROVAL_COLLECTIONS = {
  approvals: 'oos_approvals',
  approvalHistory: 'oos_approval_history',
  approvalMatrix: 'approval_matrix',
  workflows: 'workflows',
  esignRecords: 'esign_records',
  notifications: 'notifications',
} as const;

export interface OosWorkflowStepDef {
  level: number;
  stepName: string;
  approverRole: string;
  dueDays: number;
  eSignatureRequired: boolean;
  commentRequired: boolean;
}

export interface OosWorkflowContext {
  phase1: OosPhase1 | null;
  phase2: OosPhase2 | null;
  impact: OosImpactAssessment | null;
  capaLinked: boolean;
  phase2Required: boolean;
  capaRequired: boolean;
  headQaRequired: boolean;
}

export function impactYes(value?: string): boolean {
  return value === 'Yes' || Boolean(value?.toLowerCase().includes('yes'));
}

export function computeHeadQaRequired(record: OosRecord, impact?: OosImpactAssessment | null): boolean {
  if (isCriticalOosTest(record.test_name) || record.is_critical_test) return true;
  if (/sterility|endotoxin/i.test(record.test_name)) return true;
  if (impactYes(impact?.patient_safety_impact)) return true;
  if (impactYes(impact?.market_impact)) return true;
  return false;
}

export function computePhase2Required(phase1?: OosPhase1 | null): boolean {
  if (!phase1) return true;
  const outcome = phase1.phase1_outcome;
  return outcome === 'No Laboratory Error' || outcome === 'Inconclusive';
}

export function buildOosWorkflowContext(
  record: OosRecord,
  phase1: OosPhase1 | null,
  phase2: OosPhase2 | null,
  impact: OosImpactAssessment | null,
  capaLinked: boolean,
): OosWorkflowContext {
  const phase2Required = computePhase2Required(phase1);
  const capaRequired = Boolean(record.capa_required || impact?.capa_required || phase2?.capa_required);
  const headQaRequired = computeHeadQaRequired(record, impact);
  return { phase1, phase2, impact, capaLinked, phase2Required, capaRequired, headQaRequired };
}

export function buildOosWorkflowSteps(ctx: OosWorkflowContext): OosWorkflowStepDef[] {
  const steps: OosWorkflowStepDef[] = [
    { level: 1, stepName: 'Submitted', approverRole: 'qc', dueDays: 2, eSignatureRequired: false, commentRequired: false },
    { level: 2, stepName: 'Phase-I Review', approverRole: 'qc_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: 3, stepName: 'QA Review', approverRole: 'qa', dueDays: 7, eSignatureRequired: true, commentRequired: true },
  ];
  if (ctx.phase2Required) {
    steps.push({ level: steps.length + 1, stepName: 'Phase-II Review', approverRole: 'production_manager', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }
  steps.push({ level: steps.length + 1, stepName: 'Impact Assessment Review', approverRole: 'qa_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  if (ctx.capaRequired) {
    steps.push({ level: steps.length + 1, stepName: 'CAPA Review', approverRole: 'qa_manager', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }
  steps.push({ level: steps.length + 1, stepName: 'Final QA Review', approverRole: 'qa_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  if (ctx.headQaRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Head QA Approval', approverRole: 'head_qa', dueDays: 5, eSignatureRequired: true, commentRequired: true });
  }
  return steps.map((s, i) => ({ ...s, level: i + 1 }));
}

export function roleMatchesOosStep(userRole: string | undefined, stepRole: string): boolean {
  if (!userRole) return false;
  const u = normalizeRole(userRole);
  const s = stepRole.toLowerCase();
  if (['super_admin', 'admin'].includes(u)) return true;
  if (u === s) return true;
  if (s === 'qc' && ['qc', 'qc_manager'].includes(u)) return true;
  if (s === 'qc_manager' && ['qc_manager', 'head_qa'].includes(u)) return true;
  if (s === 'qa' && ['qa', 'qa_manager', 'qa_reviewer'].includes(u)) return true;
  if (s === 'qa_manager' && ['qa_manager', 'head_qa'].includes(u)) return true;
  if (s === 'head_qa' && u === 'head_qa') return true;
  if (s === 'production_manager' && ['production_manager', 'production'].includes(u)) return true;
  return false;
}

export function getCurrentPendingOosApproval(approvals: OosApproval[]): OosApproval | null {
  return approvals
    .filter((a) => !a.is_deleted && ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0] || null;
}

export function mapOosStatusForStep(stepName: string, action: string): string {
  if (action === 'reject') return 'rejected';
  if (action === 'send_back') return 'phase1_investigation';
  if (stepName === 'Submitted') return 'submitted';
  if (stepName === 'Phase-I Review') return 'phase1_investigation';
  if (stepName === 'QA Review') return 'qa_review';
  if (stepName === 'Phase-II Review') return 'phase2_investigation';
  if (stepName === 'Impact Assessment Review') return 'qa_review';
  if (stepName === 'CAPA Review') return 'capa_required';
  if (stepName === 'Final QA Review') return 'final_qa_review';
  if (stepName === 'Head QA Approval' && action === 'approve') return 'approved';
  return 'qa_review';
}

export function validateOosApprovalAction(
  stepName: string,
  ctx: OosWorkflowContext,
): { ok: boolean; error?: string } {
  if (stepName === 'QA Review') {
    const p1 = ctx.phase1;
    if (!p1 || p1.status !== 'Completed') {
      return { ok: false, error: 'Phase-I must be completed before QA Review.' };
    }
  }
  if (stepName === 'Phase-II Review') {
    if (!ctx.phase2 || !['Completed', 'CAPA Required'].includes(ctx.phase2.status || '')) {
      return { ok: false, error: 'Phase-II investigation must be completed before this approval step.' };
    }
  }
  if (stepName === 'Impact Assessment Review') {
    if (!ctx.impact || ctx.impact.status !== 'Approved') {
      return { ok: false, error: 'Impact Assessment must be completed and approved before this step.' };
    }
  }
  if (stepName === 'CAPA Review' && ctx.capaRequired && !ctx.capaLinked) {
    return { ok: false, error: 'CAPA must be linked before CAPA Review approval.' };
  }
  if (stepName === 'Head QA Approval' && ctx.headQaRequired) {
    if (!ctx.impact || ctx.impact.status !== 'Approved') {
      return { ok: false, error: 'Complete impact assessment before Head QA Approval.' };
    }
  }
  if (['Final QA Review', 'Head QA Approval'].includes(stepName)) {
    if (ctx.capaRequired && !ctx.capaLinked) {
      return { ok: false, error: 'CAPA must be linked before final approval steps.' };
    }
  }
  return { ok: true };
}

export function computeOosApprovalDashboardCounts(
  approvals: OosApproval[],
  history: OosApprovalHistoryEntry[],
  records: OosRecord[],
  actorId: string,
  actorRole?: string,
): import('@/lib/oos-types').OosApprovalDashboardCounts {
  const active = approvals.filter((a) => !a.is_deleted);
  const today = new Date().toISOString().slice(0, 10);
  const pending = active.filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''));
  const recordMap = new Map(records.map((r) => [r.id, r]));

  return {
    pendingApprovals: pending.length,
    myPendingApprovals: pending.filter((a) => roleMatchesOosStep(actorRole, a.current_role || a.current_approver_role || '') || a.current_approver === actorId).length,
    approvedOos: records.filter((r) => r.status === 'approved').length,
    rejectedOos: records.filter((r) => r.status === 'rejected').length,
    sentBackOos: history.filter((h) => h.action.toLowerCase().includes('send back')).length,
    criticalPending: pending.filter((a) => {
      const r = recordMap.get(a.oos_id);
      return r && (isCriticalOosTest(r.test_name) || r.is_critical_test);
    }).length,
    overdueApprovals: pending.filter((a) => a.due_date && a.due_date < today).length,
    headQaPending: pending.filter((a) => a.current_workflow_step === 'Head QA Approval').length,
    closedOos: records.filter((r) => r.status === 'closed').length,
  };
}

export function daysPendingOosApproval(approval: OosApproval): number {
  const start = new Date(approval.created_at || approval.signed_at || '');
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function oosApprovalPriority(record?: OosRecord | null, daysPending = 0): string {
  if (!record) return 'Medium';
  if (isCriticalOosTest(record.test_name) || record.is_critical_test) return 'Critical';
  if (getDaysOverdueOos(record) > 0 || daysPending > 7) return 'High';
  return 'Medium';
}

export function canViewOosApproval(role?: string | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'auditor', 'viewer'].includes(r)) return true;
  return ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canActOnOosApproval(role?: string | null, stepRole?: string): boolean {
  if (normalizeRole(role) === 'auditor' || normalizeRole(role) === 'viewer') return false;
  return roleMatchesOosStep(role || undefined, stepRole || '');
}

export function canReopenOos(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}

export function canCloseOosRecord(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role));
}

export function isOosReadOnly(record: OosRecord): boolean {
  return ['closed', 'approved'].includes(record.status);
}

export function approvalStatusColor(status: string): string {
  if (status === 'Approved' || status === 'Completed') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Pending') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Escalated') return 'bg-orange-50 text-orange-800 border-orange-200';
  if (status === 'Sent Back') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Waiting') return 'bg-slate-50 text-slate-500 border-slate-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function workflowStepColor(step: string): string {
  if (step === 'Closed' || step === 'Head QA Approval') return 'bg-green-50 text-green-700 border-green-200';
  if (['QA Review', 'Final QA Review', 'Impact Assessment Review'].includes(step)) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (['Phase-I Review', 'Phase-II Review'].includes(step)) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (step === 'CAPA Review') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function roleBadgeColor(): string {
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function priorityBadgeColor(priority: string): string {
  if (priority === 'Critical') return 'bg-red-50 text-red-700 border-red-200';
  if (priority === 'High') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function overdueBadgeColor(overdue: boolean): string {
  return overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200';
}

export function mapHistoryToApprovalTimeline(history: OosApprovalHistoryEntry[]) {
  return history.map((h) => ({
    date: h.created_at,
    title: h.action,
    description: h.comments || h.rejection_reason || h.send_back_reason || '',
    user: h.user_name,
    step: h.workflow_step,
  }));
}

export const oosRejectSchema = z.object({
  oos_id: z.string().min(1),
  approval_id: z.string().min(1),
  rejection_reason: z.string().min(1, 'Rejection reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const oosSendBackSchema = z.object({
  oos_id: z.string().min(1),
  approval_id: z.string().min(1),
  send_back_reason: z.string().min(1, 'Send back reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const oosApproveSchema = z.object({
  oos_id: z.string().min(1),
  approval_id: z.string().min(1),
  comments: z.string().optional().default(''),
  e_signature: z.string().optional().default(''),
});

export const oosReopenSchema = z.object({
  oos_id: z.string().min(1),
  reason: z.string().min(5, 'Reopen reason is required'),
});

export type OosRejectInput = z.infer<typeof oosRejectSchema>;
export type OosSendBackInput = z.infer<typeof oosSendBackSchema>;
export type OosApproveInput = z.infer<typeof oosApproveSchema>;
