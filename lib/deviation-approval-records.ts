import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import type { DeviationApproval, DeviationApprovalHistoryEntry, DeviationRecord } from '@/lib/deviation-types';

export const DEVIATION_APPROVAL_MODULE = 'Deviation Approval';

export const DEVIATION_APPROVAL_COLLECTIONS = {
  approvals: 'deviation_approvals',
  approvalHistory: 'deviation_approval_history',
  deviations: 'deviations',
  approvalMatrix: 'approval_matrix',
  workflows: 'workflows',
  esignRecords: 'esign_records',
  notifications: 'notifications',
} as const;

export interface DeviationWorkflowStepDef {
  level: number;
  stepName: string;
  approverRole: string;
  dueDays: number;
  eSignatureRequired: boolean;
  commentRequired: boolean;
}

export interface DeviationApprovalDashboardCounts {
  pendingApprovals: number;
  myPendingApprovals: number;
  approvedThisMonth: number;
  rejectedDeviations: number;
  sentBackDeviations: number;
  overdueApprovals: number;
  criticalPending: number;
  finalApprovedDeviations: number;
  closedDeviations: number;
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
};

export function deptToApproverRole(department?: string): string {
  return deptRoleMap[department || ''] || 'production_manager';
}

export function buildDeviationWorkflowSteps(record: DeviationRecord): DeviationWorkflowStepDef[] {
  const steps: DeviationWorkflowStepDef[] = [
    { level: 1, stepName: 'Submitted', approverRole: 'qa_executive', dueDays: 2, eSignatureRequired: false, commentRequired: false },
    { level: 2, stepName: 'Department Review', approverRole: deptToApproverRole(record.department), dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: 3, stepName: 'Investigation Review', approverRole: 'qa_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true },
    { level: 4, stepName: 'QA Review', approverRole: 'qa_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true },
  ];
  const needsHeadQa = record.criticality === 'Critical'
    || record.patient_safety_impacted
    || record.patient_safety_impact === 'Yes';
  const needsRegulatory = record.regulatory_impact || record.regulatory_impact_status === 'Yes';
  if (needsHeadQa || needsRegulatory) {
    steps.push({ level: steps.length + 1, stepName: 'Head QA Review', approverRole: 'head_qa', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }
  steps.push({
    level: steps.length + 1,
    stepName: 'Final Approval',
    approverRole: 'head_qa',
    dueDays: 5,
    eSignatureRequired: true,
    commentRequired: true,
  });
  return steps;
}

export function roleMatchesStep(userRole: string | undefined, stepRole: string): boolean {
  if (!userRole) return false;
  const u = normalizeRole(userRole);
  const s = stepRole.toLowerCase();
  if (['super_admin', 'admin'].includes(u)) return true;
  if (u === s) return true;
  if (s === 'qa_executive' && ['qa', 'qa_executive', 'qa_manager'].includes(u)) return true;
  if (s === 'qa_manager' && ['qa_manager', 'head_qa'].includes(u)) return true;
  if (s === 'head_qa' && u === 'head_qa') return true;
  if (s === 'production_manager' && ['production_manager', 'production'].includes(u)) return true;
  if (s === 'qc_manager' && ['qc_manager', 'qc'].includes(u)) return true;
  if (s === 'engineering_manager' && ['engineering_manager', 'engineering'].includes(u)) return true;
  if (s === 'warehouse_manager' && ['warehouse_manager', 'warehouse'].includes(u)) return true;
  return false;
}

export function getCurrentPendingApproval(approvals: DeviationApproval[]): DeviationApproval | null {
  return approvals
    .filter((a) => !a.is_deleted && ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0] || null;
}

export function mapDeviationStatusForStep(stepName: string, action: string): string {
  if (action === 'reject') return 'rejected';
  if (action === 'send_back') return 'under_investigation';
  if (stepName === 'Final Approval' && action === 'approve') return 'approved';
  if (stepName === 'Submitted') return 'submitted';
  if (stepName === 'Department Review') return 'submitted';
  if (stepName === 'Investigation Review') return 'under_investigation';
  if (stepName === 'QA Review' || stepName === 'Head QA Review') return 'qa_review';
  return 'qa_review';
}

export function computeApprovalDashboardCounts(
  approvals: DeviationApproval[],
  history: DeviationApprovalHistoryEntry[],
  deviations: DeviationRecord[],
  actorId: string,
  actorRole?: string,
): DeviationApprovalDashboardCounts {
  const active = approvals.filter((a) => !a.is_deleted);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const pending = active.filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''));
  const isOverdue = (a: DeviationApproval) => Boolean(a.due_date && a.due_date < today && !['Approved', 'Completed', 'Rejected'].includes(a.approval_status || ''));

  const devStatusMap = new Map(deviations.map((d) => [d.id, d.status]));
  const devCriticalMap = new Map(deviations.map((d) => [d.id, d.criticality]));

  return {
    pendingApprovals: pending.length,
    myPendingApprovals: pending.filter((a) => roleMatchesStep(actorRole, a.current_role || '') || a.current_approver === actorId).length,
    approvedThisMonth: history.filter((h) => h.action.toLowerCase().includes('approve') && h.created_at >= monthStart).length,
    rejectedDeviations: deviations.filter((d) => d.status === 'rejected').length,
    sentBackDeviations: history.filter((h) => h.action.toLowerCase().includes('send back')).length,
    overdueApprovals: pending.filter(isOverdue).length,
    criticalPending: pending.filter((a) => devCriticalMap.get(a.deviation_id) === 'Critical').length,
    finalApprovedDeviations: deviations.filter((d) => d.status === 'approved').length,
    closedDeviations: deviations.filter((d) => d.status === 'closed').length,
  };
}

export function daysPendingApproval(record: DeviationApproval): number {
  const start = new Date(record.created_at || record.signed_at || '');
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function canViewDeviationApproval(role?: string | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return ['qc_manager', 'qc', 'production_manager', 'production', 'engineering_manager', 'engineering',
    'warehouse_manager', 'warehouse', 'regulatory_affairs'].includes(r);
}

export function canActOnDeviationApproval(role?: string | null, stepRole?: string): boolean {
  if (normalizeRole(role) === 'auditor') return false;
  return roleMatchesStep(role || undefined, stepRole || '');
}

export function canReopenDeviation(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}

export function canCloseDeviationRecord(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role));
}

export function validateApprovalAction(
  record: DeviationRecord,
  stepName: string,
  investigationComplete: boolean,
  capaSatisfied: boolean,
): { ok: boolean; error?: string } {
  if (stepName === 'QA Review' && !investigationComplete) {
    return { ok: false, error: 'Investigation must be completed before QA approval.' };
  }
  if (stepName === 'Head QA Review' && record.criticality === 'Critical' && !investigationComplete) {
    return { ok: false, error: 'Investigation must be completed before Head QA approval.' };
  }
  if (stepName === 'Final Approval' && record.capa_required && !capaSatisfied) {
    return { ok: false, error: 'Mandatory CAPA must be linked and closed before final approval.' };
  }
  return { ok: true };
}

export function approvalStatusColor(status: string): string {
  if (status === 'Approved' || status === 'Completed') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'Pending') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Escalated') return 'bg-orange-50 text-orange-800 border-orange-200';
  if (status === 'Sent Back') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function workflowStepColor(step: string): string {
  if (step === 'Closed' || step === 'Final Approval') return 'bg-green-50 text-green-700 border-green-200';
  if (['QA Review', 'Head QA Review'].includes(step)) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (step === 'Investigation Review') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (step === 'Sent Back' || step === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function roleBadgeColor(): string {
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function overdueBadgeColor(overdue: boolean): string {
  return overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200';
}

export function mapAuditToApprovalTimeline(history: DeviationApprovalHistoryEntry[]) {
  return history.map((h) => ({
    date: h.created_at,
    title: h.action,
    description: h.comments || h.rejection_reason || h.send_back_reason || '',
    user: h.user_name,
    step: h.workflow_step,
  }));
}

export const deviationRejectSchema = z.object({
  deviation_id: z.string().min(1),
  approval_id: z.string().min(1),
  rejection_reason: z.string().min(1, 'Rejection reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const deviationSendBackSchema = z.object({
  deviation_id: z.string().min(1),
  approval_id: z.string().min(1),
  send_back_reason: z.string().min(1, 'Send back reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const deviationApproveSchema = z.object({
  deviation_id: z.string().min(1),
  approval_id: z.string().min(1),
  comments: z.string().optional().default(''),
  e_signature: z.string().optional().default(''),
});

export const deviationReopenSchema = z.object({
  deviation_id: z.string().min(1),
  reason: z.string().min(5, 'Reopen reason is required'),
});

export type DeviationRejectInput = z.infer<typeof deviationRejectSchema>;
export type DeviationSendBackInput = z.infer<typeof deviationSendBackSchema>;
export type DeviationApproveInput = z.infer<typeof deviationApproveSchema>;
