import { normalizeRole } from '@/lib/permissions';
import type { RiskAssessmentRecord } from '@/lib/cpv-risk-assessment-records';
import type { RiskLevel } from '@/lib/cpv';
import {
  getMitigationStatus,
  inferRiskDepartment,
  isPatientSafetyRisk,
} from '@/lib/risk-reports-records';

export const RISK_APPROVAL_MODULE = 'Risk Approval Workflow';
export const RISK_APPROVALS_COLLECTION = 'risk_approvals';
export const RISK_APPROVAL_HISTORY_COLLECTION = 'risk_approval_history';

export const RISK_WORKFLOW_STEPS = [
  'Draft',
  'Submitted',
  'Department Review',
  'Risk Manager Review',
  'QA Review',
  'Validation Review',
  'CSV Review',
  'Regulatory Review',
  'Head QA Review',
  'Final Approval',
  'Closed',
] as const;

export const RISK_APPROVAL_STATUSES = [
  'Pending',
  'Approved',
  'Rejected',
  'Sent Back',
  'Escalated',
  'Completed',
  'Waiting',
] as const;

export const RISK_APPROVAL_MEANINGS = [
  'I have reviewed this risk assessment.',
  'I approve this risk assessment.',
  'I reject this risk assessment.',
  'I approve this risk mitigation strategy.',
  'I provide final GMP risk approval.',
] as const;

export interface RiskApprovalActor {
  id: string;
  name: string;
  role?: string;
  email?: string;
}

export interface RiskWorkflowStepDef {
  level: number;
  stepName: string;
  approverRole: string;
  dueDays: number;
  eSignatureRequired: boolean;
  commentRequired: boolean;
}

export interface RiskWorkflowContext {
  fmeaCompleted: boolean;
  mitigationPlanExists: boolean;
  headQaRequired: boolean;
  validationReviewRequired: boolean;
  csvReviewRequired: boolean;
  regulatoryReviewRequired: boolean;
  patientSafetyRisk: boolean;
}

export interface RiskApproval {
  id: string;
  approval_id: string;
  risk_assessment_id: string;
  risk_number: string;
  current_workflow_step: string;
  current_approver: string;
  current_approver_name?: string;
  current_role: string;
  current_approver_role?: string;
  approval_level: number;
  approval_status: string;
  approval_comments: string;
  comments?: string;
  rejection_reason?: string;
  send_back_reason?: string;
  due_date: string;
  escalation_status: string;
  e_signature_required: boolean;
  e_signature_status: string;
  e_signature?: string;
  signed_by?: string;
  signed_date?: string | null;
  signed_at?: string | null;
  approver_id?: string;
  approver_name?: string;
  approver_role?: string;
  decision?: string;
  completed_date?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  is_deleted: boolean;
}

export interface RiskApprovalHistoryEntry {
  id?: string;
  risk_assessment_id: string;
  risk_number: string;
  approval_id: string;
  action: string;
  workflow_step: string;
  user_id: string;
  user_name: string;
  user_role: string;
  comments?: string;
  rejection_reason?: string;
  send_back_reason?: string;
  e_signature_status?: string;
  created_at: string;
  created_by: string;
  is_deleted?: boolean;
}

export interface RiskApprovalTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
  workflow_step?: string;
}

export interface RiskApprovalDashboardCounts {
  pendingApprovals: number;
  myPendingApprovals: number;
  approvedRisks: number;
  rejectedRisks: number;
  criticalPending: number;
  csvReviewsPending: number;
  validationReviewsPending: number;
  regulatoryReviewsPending: number;
  headQaPending: number;
  overdueApprovals: number;
}

function categoryIncludes(risk: RiskAssessmentRecord, terms: string[]): boolean {
  const text = `${risk.riskCategory} ${risk.riskDescription} ${risk.parameterType}`.toLowerCase();
  return terms.some((t) => text.includes(t));
}

export function computeHeadQaRequiredForRisk(risk: RiskAssessmentRecord): boolean {
  return risk.riskLevel === 'Critical'
    || risk.riskLevel === 'High'
    || isPatientSafetyRisk(risk);
}

export function isFmeaCompleted(risk: RiskAssessmentRecord): boolean {
  return Boolean(
    risk.potentialCause?.trim()
    && risk.severityScore > 0
    && risk.occurrenceScore > 0
    && risk.detectionScore > 0,
  );
}

export function hasMitigationPlan(risk: RiskAssessmentRecord): boolean {
  if ((risk.controls || []).length > 0) return true;
  return Boolean(risk.mitigationAction?.trim());
}

export function buildRiskWorkflowContext(risk: RiskAssessmentRecord): RiskWorkflowContext {
  const csvReviewRequired = categoryIncludes(risk, ['csv', 'data integrity', 'computerized']);
  const regulatoryReviewRequired = categoryIncludes(risk, ['regulatory']);
  const validationReviewRequired = categoryIncludes(risk, ['validation', 'equipment', 'process capability', 'csv'])
    || csvReviewRequired;
  const patientSafetyRisk = isPatientSafetyRisk(risk);
  return {
    fmeaCompleted: isFmeaCompleted(risk),
    mitigationPlanExists: hasMitigationPlan(risk),
    headQaRequired: computeHeadQaRequiredForRisk(risk) || patientSafetyRisk,
    validationReviewRequired,
    csvReviewRequired,
    regulatoryReviewRequired,
    patientSafetyRisk,
  };
}

export function buildRiskWorkflowSteps(ctx: RiskWorkflowContext): RiskWorkflowStepDef[] {
  const steps: RiskWorkflowStepDef[] = [
    { level: 1, stepName: 'Submitted', approverRole: 'risk_owner', dueDays: 1, eSignatureRequired: false, commentRequired: false },
    { level: 2, stepName: 'Department Review', approverRole: 'department_head', dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: 3, stepName: 'Risk Manager Review', approverRole: 'risk_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true },
    { level: 4, stepName: 'QA Review', approverRole: 'qa', dueDays: 7, eSignatureRequired: true, commentRequired: true },
  ];
  if (ctx.validationReviewRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Validation Review', approverRole: 'validation_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  }
  if (ctx.csvReviewRequired) {
    steps.push({ level: steps.length + 1, stepName: 'CSV Review', approverRole: 'csv_manager', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  }
  if (ctx.regulatoryReviewRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Regulatory Review', approverRole: 'regulatory_affairs', dueDays: 7, eSignatureRequired: true, commentRequired: true });
  }
  if (ctx.headQaRequired) {
    steps.push({ level: steps.length + 1, stepName: 'Head QA Review', approverRole: 'head_qa', dueDays: 5, eSignatureRequired: true, commentRequired: true });
  }
  steps.push({ level: steps.length + 1, stepName: 'Final Approval', approverRole: 'qa_manager', dueDays: 5, eSignatureRequired: true, commentRequired: true });
  return steps.map((s, i) => ({ ...s, level: i + 1 }));
}

export function roleMatchesRiskStep(
  userRole: string | undefined,
  stepRole: string,
  riskOwnerId?: string,
  userId?: string,
): boolean {
  if (!userRole) return false;
  const u = normalizeRole(userRole);
  if (['super_admin', 'admin'].includes(u)) return true;
  if (stepRole === 'risk_owner') return userId === riskOwnerId || u === 'production_executive';
  if (stepRole === 'department_head') {
    return ['department_head', 'production_manager', 'qc_manager', 'engineering_manager'].includes(u);
  }
  if (stepRole === 'risk_manager') return ['risk_manager', 'qa_manager'].includes(u);
  if (stepRole === 'qa') return ['qa', 'qa_executive', 'qa_manager'].includes(u);
  if (stepRole === 'validation_manager') return ['validation_manager', 'validation'].includes(u);
  if (stepRole === 'csv_manager') return ['csv_manager', 'csv'].includes(u);
  if (stepRole === 'regulatory_affairs') return ['regulatory_affairs', 'regulatory'].includes(u);
  if (stepRole === 'head_qa') return u === 'head_qa';
  if (stepRole === 'qa_manager') return ['qa_manager', 'head_qa'].includes(u);
  return u === stepRole;
}

export function canActOnRiskApproval(
  role: string | undefined,
  stepRole: string | undefined,
  riskOwnerId?: string,
  userId?: string,
): boolean {
  if (!stepRole) return false;
  return roleMatchesRiskStep(role, stepRole, riskOwnerId, userId);
}

export function getCurrentPendingRiskApproval(approvals: RiskApproval[]): RiskApproval | null {
  return approvals
    .filter((a) => !a.is_deleted && ['Pending', 'Escalated'].includes(a.approval_status || ''))
    .sort((a, b) => Number(a.approval_level) - Number(b.approval_level))[0] || null;
}

export function validateRiskApprovalAction(
  stepName: string,
  ctx: RiskWorkflowContext,
  action: 'approve' | 'reject' | 'send_back',
): { ok: boolean; error?: string } {
  if (action !== 'approve') return { ok: true };
  if (stepName === 'Final Approval') {
    if (!ctx.fmeaCompleted) return { ok: false, error: 'FMEA approval required before final risk approval.' };
    if (!ctx.mitigationPlanExists) return { ok: false, error: 'Mitigation plan approval required before final risk approval.' };
  }
  if (['QA Review', 'Head QA Review', 'Final Approval'].includes(stepName) && !ctx.fmeaCompleted) {
    return { ok: false, error: 'FMEA must be completed before this approval step.' };
  }
  return { ok: true };
}

export function mapRiskStatusForStep(stepName: string, action: string): {
  riskStatus: string;
  workflowStatus: string;
  lock?: boolean;
} {
  if (action === 'reject') return { riskStatus: 'Rejected', workflowStatus: 'Draft' };
  if (action === 'send_back') return { riskStatus: 'Open', workflowStatus: 'Draft' };
  if (stepName === 'Final Approval' && action === 'approve') {
    return { riskStatus: 'Mitigation In Progress', workflowStatus: 'Approval', lock: true };
  }
  if (stepName === 'Submitted') return { riskStatus: 'Under Review', workflowStatus: 'Review' };
  return { riskStatus: 'Under Review', workflowStatus: 'Review' };
}

export function daysPendingRiskApproval(approval: RiskApproval): number {
  const start = approval.created_at || approval.signed_at;
  if (!start) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(String(start)).getTime()) / 86400000));
}

export function riskApprovalPriority(risk?: RiskAssessmentRecord | null, daysPending = 0): string {
  if (risk?.riskLevel === 'Critical') return 'critical';
  if (daysPending > 7) return 'high';
  if (risk?.riskLevel === 'High') return 'high';
  return risk?.riskLevel?.toLowerCase() || 'medium';
}

export function canViewRiskApproval(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'department_head', 'validation_manager', 'csv_manager',
    'regulatory_affairs', 'auditor', 'viewer', 'production_manager', 'qc_manager',
  ].includes(r);
}

export function isRiskApprovalReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function isRiskRecordLocked(risk: RiskAssessmentRecord): boolean {
  return Boolean(risk.isLocked) || risk.riskStatus === 'Closed';
}

export function approvalStatusLabel(status?: string): string {
  const map: Record<string, string> = {
    Pending: 'Pending', Approved: 'Approved', Rejected: 'Rejected',
    'Sent Back': 'Sent Back', Escalated: 'Escalated', Waiting: 'Waiting', Completed: 'Completed',
  };
  return map[status || ''] || status || 'Pending';
}

export function approvalStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    'Sent Back': 'bg-orange-100 text-orange-800',
    Escalated: 'bg-purple-100 text-purple-800',
    Waiting: 'bg-slate-100 text-slate-700',
    Completed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || ''] || map.Pending;
}

export function workflowStepColor(step?: string): string {
  const map: Record<string, string> = {
    Submitted: 'bg-blue-100 text-blue-800',
    'Department Review': 'bg-indigo-100 text-indigo-800',
    'Risk Manager Review': 'bg-cyan-100 text-cyan-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    'Validation Review': 'bg-teal-100 text-teal-800',
    'CSV Review': 'bg-sky-100 text-sky-800',
    'Regulatory Review': 'bg-violet-100 text-violet-800',
    'Head QA Review': 'bg-red-100 text-red-800',
    'Final Approval': 'bg-green-100 text-green-800',
    Closed: 'bg-emerald-100 text-emerald-800',
  };
  return map[step || ''] || 'bg-slate-100 text-slate-700';
}

export function roleBadgeColor(role?: string): string {
  const map: Record<string, string> = {
    risk_owner: 'bg-slate-100 text-slate-700',
    department_head: 'bg-indigo-100 text-indigo-800',
    risk_manager: 'bg-cyan-100 text-cyan-800',
    qa: 'bg-purple-100 text-purple-800',
    validation_manager: 'bg-teal-100 text-teal-800',
    csv_manager: 'bg-sky-100 text-sky-800',
    regulatory_affairs: 'bg-violet-100 text-violet-800',
    head_qa: 'bg-red-100 text-red-800',
    qa_manager: 'bg-green-100 text-green-800',
  };
  return map[role || ''] || 'bg-slate-100 text-slate-700';
}

export function riskLevelColor(level?: string | RiskLevel): string {
  const map: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800',
    High: 'bg-orange-100 text-orange-800',
    Medium: 'bg-amber-100 text-amber-800',
    Low: 'bg-green-100 text-green-800',
  };
  return map[level || ''] || 'bg-slate-100 text-slate-700';
}

export function computeRiskApprovalDashboardCounts(
  approvals: RiskApproval[],
  history: RiskApprovalHistoryEntry[],
  risks: RiskAssessmentRecord[],
  actorId: string,
  role?: string,
): RiskApprovalDashboardCounts {
  const today = new Date().toISOString().split('T')[0];
  const pending = approvals.filter((a) => !a.is_deleted && ['Pending', 'Escalated'].includes(a.approval_status || ''));
  const riskMap = new Map(risks.map((r) => [r.id, r]));

  const myPending = pending.filter((a) => {
    const risk = riskMap.get(a.risk_assessment_id);
    return canActOnRiskApproval(role, a.current_role || a.current_approver_role, risk?.createdBy, actorId)
      || a.current_approver === actorId;
  });

  const riskIdsApproved = new Set(history.filter((h) => h.action === 'Approved' || h.action === 'Final Approval Completed').map((h) => h.risk_assessment_id));
  const riskIdsRejected = new Set(history.filter((h) => h.action === 'Rejected').map((h) => h.risk_assessment_id));

  return {
    pendingApprovals: pending.length,
    myPendingApprovals: myPending.length,
    approvedRisks: riskIdsApproved.size,
    rejectedRisks: riskIdsRejected.size,
    criticalPending: pending.filter((a) => riskMap.get(a.risk_assessment_id)?.riskLevel === 'Critical').length,
    csvReviewsPending: pending.filter((a) => a.current_workflow_step === 'CSV Review').length,
    validationReviewsPending: pending.filter((a) => a.current_workflow_step === 'Validation Review').length,
    regulatoryReviewsPending: pending.filter((a) => a.current_workflow_step === 'Regulatory Review').length,
    headQaPending: pending.filter((a) => (a.current_role || a.current_approver_role) === 'head_qa' || a.current_workflow_step === 'Head QA Review').length,
    overdueApprovals: pending.filter((a) => a.due_date && a.due_date < today).length,
  };
}

export function mapHistoryToRiskApprovalTimeline(history: RiskApprovalHistoryEntry[]): RiskApprovalTimelineEntry[] {
  return history
    .filter((h) => !h.is_deleted)
    .map((h) => ({
      action: h.action,
      user: h.user_name,
      at: h.created_at,
      detail: h.comments || h.rejection_reason || h.send_back_reason || '',
      workflow_step: h.workflow_step,
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function riskApprovalMeaning(step?: string, action: 'approve' | 'reject' = 'approve'): string {
  if (action === 'reject') return RISK_APPROVAL_MEANINGS[2];
  if (step === 'Head QA Review' || step === 'Final Approval') return RISK_APPROVAL_MEANINGS[4];
  if (step === 'Risk Manager Review') return RISK_APPROVAL_MEANINGS[3];
  return RISK_APPROVAL_MEANINGS[0];
}

export function notifyRolesForStep(stepRole: string): string[] {
  const map: Record<string, string[]> = {
    department_head: ['department_head', 'production_manager'],
    risk_manager: ['risk_manager'],
    qa: ['qa', 'qa_manager'],
    validation_manager: ['validation_manager'],
    csv_manager: ['csv_manager'],
    regulatory_affairs: ['regulatory_affairs'],
    head_qa: ['head_qa'],
    qa_manager: ['qa_manager', 'head_qa'],
  };
  return map[stepRole] || ['qa_manager'];
}

export { inferRiskDepartment, getMitigationStatus };
