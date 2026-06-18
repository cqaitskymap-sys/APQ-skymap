import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import type {
  ComplaintApproval,
  ComplaintApprovalHistoryEntry,
  ComplaintImpactAssessment,
  ComplaintRecord,
} from '@/lib/complaint-types';
import { computeComplaintCapaMandatory } from '@/lib/complaint-capa-records';

export const COMPLAINT_APPROVAL_MODULE = 'Complaint Approval';

export interface ComplaintWorkflowStepDef {
  level: number;
  stepName: string;
  approverRole: string;
  dueDays: number;
  eSignatureRequired: boolean;
  commentRequired: boolean;
}

export interface ComplaintApprovalDashboardCounts {
  pendingApprovals: number;
  myPendingApprovals: number;
  approvedThisMonth: number;
  rejectedComplaints: number;
  sentBackComplaints: number;
  overdueApprovals: number;
  criticalPending: number;
  closedComplaints: number;
}

export type ComplaintApprovalActor = { id: string; name: string; role?: string; email?: string };

function impactYes(value?: string | boolean): boolean {
  if (typeof value === 'boolean') return value;
  return value === 'Yes';
}

export function needsHeadQaApproval(record: ComplaintRecord, impact?: ComplaintImpactAssessment | null): boolean {
  return record.complaint_criticality === 'Critical'
    || record.product_safety_impact
    || impactYes(impact?.patient_safety_impact)
    || impactYes(record.regulatory_impact)
    || impactYes(impact?.regulatory_impact)
    || Boolean(record.head_qa_approval_required);
}

export function buildComplaintWorkflowSteps(
  record: ComplaintRecord,
  impact?: ComplaintImpactAssessment | null,
): ComplaintWorkflowStepDef[] {
  const steps: ComplaintWorkflowStepDef[] = [
    { level: 1, stepName: 'Received', approverRole: 'qa_executive', dueDays: 2, eSignatureRequired: false, commentRequired: false },
    { level: 2, stepName: 'Investigation Review', approverRole: 'qa_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true },
    { level: 3, stepName: 'Impact Assessment Review', approverRole: 'qa_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true },
  ];

  const capaMandatory = computeComplaintCapaMandatory(record, impact);
  if (record.capa_required || capaMandatory) {
    steps.push({ level: steps.length + 1, stepName: 'CAPA Review', approverRole: 'qa_manager', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }

  if (record.recall_evaluation_required || record.recall_required) {
    steps.push({ level: steps.length + 1, stepName: 'Recall Evaluation Review', approverRole: 'regulatory_affairs', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  }

  steps.push({ level: steps.length + 1, stepName: 'QA Review', approverRole: 'qa_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true });

  if (needsHeadQaApproval(record, impact)) {
    steps.push({ level: steps.length + 1, stepName: 'Head QA Approval', approverRole: 'head_qa', dueDays: 10, eSignatureRequired: true, commentRequired: true });
  }

  steps.push({
    level: steps.length + 1,
    stepName: 'Closed',
    approverRole: 'head_qa',
    dueDays: 5,
    eSignatureRequired: true,
    commentRequired: true,
  });

  return steps.map((s, i) => ({ ...s, level: i + 1 }));
}

export function roleMatchesComplaintStep(userRole: string | undefined, stepRole: string): boolean {
  if (!userRole) return false;
  const u = normalizeRole(userRole);
  const s = stepRole.toLowerCase();
  if (['super_admin', 'admin'].includes(u)) return true;
  if (u === s) return true;
  if (s === 'qa_executive' && ['qa', 'qa_executive', 'qa_manager'].includes(u)) return true;
  if (s === 'qa_manager' && ['qa_manager', 'head_qa', 'qa'].includes(u)) return true;
  if (s === 'head_qa' && u === 'head_qa') return true;
  if (s === 'regulatory_affairs' && ['regulatory_affairs', 'head_qa'].includes(u)) return true;
  return false;
}

export function getCurrentPendingComplaintApproval(approvals: ComplaintApproval[]): ComplaintApproval | null {
  return approvals
    .filter((a) => !a.is_deleted && ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0] || null;
}

export function mapComplaintStatusForStep(stepName: string, action: string): string {
  if (action === 'reject') return 'rejected';
  if (action === 'send_back') return 'under_investigation';
  if (stepName === 'Closed' && action === 'approve') return 'closed';
  if (stepName === 'Received') return 'received';
  if (stepName === 'Investigation Review') return 'under_investigation';
  if (stepName === 'Impact Assessment Review') return 'qa_review';
  if (stepName === 'CAPA Review') return 'capa_required';
  if (stepName === 'Recall Evaluation Review') return 'recall_evaluation';
  if (stepName === 'QA Review' || stepName === 'Head QA Approval') return 'qa_review';
  return 'qa_review';
}

export function computeComplaintApprovalDashboardCounts(
  approvals: ComplaintApproval[],
  history: ComplaintApprovalHistoryEntry[],
  complaints: ComplaintRecord[],
  actorId: string,
  actorRole?: string,
): ComplaintApprovalDashboardCounts {
  const active = approvals.filter((a) => !a.is_deleted);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const pending = active.filter((a) => ['Pending', 'Escalated'].includes(a.approval_status || ''));
  const isOverdue = (a: ComplaintApproval) => Boolean(a.due_date && a.due_date < today && !['Approved', 'Completed', 'Rejected'].includes(a.approval_status || ''));
  const criticalMap = new Map(complaints.map((c) => [c.id, c.complaint_criticality]));

  return {
    pendingApprovals: pending.length,
    myPendingApprovals: pending.filter((a) => roleMatchesComplaintStep(actorRole, a.current_role || '') || a.current_approver === actorId).length,
    approvedThisMonth: history.filter((h) => h.action.toLowerCase().includes('approve') && h.created_at >= monthStart).length,
    rejectedComplaints: complaints.filter((c) => c.status === 'rejected').length,
    sentBackComplaints: history.filter((h) => h.action.toLowerCase().includes('send back')).length,
    overdueApprovals: pending.filter(isOverdue).length,
    criticalPending: pending.filter((a) => criticalMap.get(a.complaint_id) === 'Critical').length,
    closedComplaints: complaints.filter((c) => c.status === 'closed').length,
  };
}

export function daysPendingComplaintApproval(record: ComplaintApproval): number {
  const start = new Date(record.created_at || record.signed_at || '');
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function canViewComplaintApproval(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return ['regulatory_affairs', 'qc_manager', 'qc'].includes(r);
}

export function canActOnComplaintApproval(role?: string | null, stepRole?: string): boolean {
  if (normalizeRole(role || '') === 'auditor') return false;
  return roleMatchesComplaintStep(role || undefined, stepRole || '');
}

export function isComplaintApprovalReadOnly(record?: ComplaintRecord | null): boolean {
  return record?.status === 'closed';
}

export function validateComplaintApprovalAction(
  record: ComplaintRecord,
  stepName: string,
  checks: {
    investigationComplete: boolean;
    impactComplete: boolean;
    capaSatisfied: boolean;
    recallComplete: boolean;
  },
): { ok: boolean; error?: string } {
  if (['Investigation Review', 'QA Review', 'Head QA Approval', 'Closed'].includes(stepName) && !checks.investigationComplete) {
    return { ok: false, error: 'Investigation must be completed before QA approval.' };
  }
  if (['Impact Assessment Review', 'QA Review', 'Head QA Approval', 'Closed'].includes(stepName) && !checks.impactComplete) {
    return { ok: false, error: 'Impact assessment must be completed before final review.' };
  }
  if (['CAPA Review', 'QA Review', 'Head QA Approval', 'Closed'].includes(stepName) && record.capa_required && !checks.capaSatisfied) {
    return { ok: false, error: 'CAPA must be linked and satisfied before closure approval.' };
  }
  if (stepName === 'Recall Evaluation Review' && !checks.recallComplete) {
    return { ok: false, error: 'Recall evaluation must be completed before approval.' };
  }
  if (stepName === 'Closed' && record.recall_evaluation_required && !checks.recallComplete) {
    return { ok: false, error: 'Recall evaluation must be completed before final closure.' };
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
  if (step === 'Closed') return 'bg-green-50 text-green-700 border-green-200';
  if (['QA Review', 'Head QA Approval'].includes(step)) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (['Investigation Review', 'Impact Assessment Review'].includes(step)) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (['CAPA Review', 'Recall Evaluation Review'].includes(step)) return 'bg-orange-50 text-orange-800 border-orange-200';
  if (step === 'Sent Back' || step === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function roleBadgeColor(): string {
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function overdueBadgeColor(overdue: boolean): string {
  return overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200';
}

export function mapAuditToComplaintApprovalTimeline(history: ComplaintApprovalHistoryEntry[]) {
  return history.map((h) => ({
    date: h.created_at,
    title: h.action,
    description: h.comments || h.rejection_reason || h.send_back_reason || '',
    user: h.user_name,
    step: h.workflow_step,
  }));
}

export const complaintRejectSchema = z.object({
  complaint_id: z.string().min(1, 'Complaint is required'),
  approval_id: z.string().min(1, 'Approval action is required'),
  rejection_reason: z.string().min(1, 'Reject reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const complaintSendBackSchema = z.object({
  complaint_id: z.string().min(1, 'Complaint is required'),
  approval_id: z.string().min(1, 'Approval action is required'),
  send_back_reason: z.string().min(1, 'Send back reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const complaintApproveSchema = z.object({
  complaint_id: z.string().min(1, 'Complaint is required'),
  approval_id: z.string().min(1, 'Approval action is required'),
  comments: z.string().optional().default(''),
  e_signature: z.string().optional().default(''),
});

export type ComplaintRejectInput = z.infer<typeof complaintRejectSchema>;
export type ComplaintSendBackInput = z.infer<typeof complaintSendBackSchema>;
export type ComplaintApproveInput = z.infer<typeof complaintApproveSchema>;
