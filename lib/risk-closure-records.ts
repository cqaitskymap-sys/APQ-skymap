import { normalizeRole } from '@/lib/permissions';
import {
  calculateRiskAssessment,
  type RiskAssessmentRecord,
} from '@/lib/cpv-risk-assessment-records';
import type { RiskLevel } from '@/lib/cpv';
import {
  estimateResidualRpn,
  getMitigationStatus,
  inferRiskDepartment,
} from '@/lib/risk-reports-records';

export const RISK_CLOSURE_MODULE = 'Risk Closure';
export const RISK_CLOSURE_COLLECTION = 'risk_closure';

export const RISK_CLOSURE_STATUSES = [
  'Pending',
  'Ready For Closure',
  'QA Review',
  'Head QA Review',
  'Closed',
  'Rejected',
  'Reopened',
] as const;

export const FINAL_RISK_EVALUATIONS = [
  'Acceptable',
  'Conditionally Acceptable',
  'Not Acceptable',
] as const;

export type RiskClosureActor = { id: string; name: string; role?: string; email?: string };

export interface RiskClosureChecklistItem {
  key: string;
  label: string;
  complete: boolean;
  required: boolean;
  warning?: string;
}

export interface RiskClosureReadiness {
  items: RiskClosureChecklistItem[];
  completeCount: number;
  totalRequired: number;
  percent: number;
  ready: boolean;
  blockers: string[];
}

export interface RiskClosureFormInput {
  risk_assessment_approved: boolean;
  fmea_completed: boolean;
  mitigation_actions_completed: boolean;
  residual_risk_evaluated: boolean;
  risk_review_completed: boolean;
  effectiveness_verified: boolean;
  capa_completed: boolean;
  change_control_completed: boolean;
  training_completed: boolean;
  validation_completed: boolean;
  final_approval_completed: boolean;
  capa_required: boolean;
  change_control_required: boolean;
  training_required: boolean;
  validation_required: boolean;
  closure_justification: string;
  final_risk_evaluation: string;
  qa_closure_comments: string;
  head_qa_comments?: string;
}

export interface RiskClosure {
  id: string;
  closure_id: string;
  risk_assessment_id: string;
  risk_number: string;
  risk_title: string;
  risk_category: string;
  department: string;
  risk_owner: string;
  closure_date: string | null;
  closed_by: string;
  closed_by_name?: string;
  initial_rpn: number;
  residual_rpn: number;
  initial_risk_level: string;
  residual_risk_level: string;
  mitigation_completed: boolean;
  mitigation_effectiveness_verified: boolean;
  review_completed: boolean;
  approval_completed: boolean;
  capa_required: boolean;
  capa_linked: boolean;
  capa_completed: boolean;
  change_control_required: boolean;
  change_control_completed: boolean;
  training_required: boolean;
  training_completed: boolean;
  validation_required: boolean;
  validation_completed: boolean;
  final_risk_evaluation: string;
  closure_justification: string;
  qa_closure_comments: string;
  head_qa_comments?: string;
  closure_status: string;
  e_signature_required: boolean;
  e_signature_status?: string;
  signed_by?: string;
  signed_date?: string | null;
  readiness_percent?: number;
  reopen_reason?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
  updated_by_name?: string;
  is_deleted: boolean;
}

export interface RiskClosureDashboardMetrics {
  readyForClosure: number;
  pendingClosure: number;
  closed: number;
  rejected: number;
  reopened: number;
  highRiskClosures: number;
  capaPendingClosures: number;
  validationPendingClosures: number;
}

export interface RiskClosureTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export function residualRiskLevel(rpn: number): RiskLevel {
  if (rpn >= 201) return 'Critical';
  if (rpn >= 101) return 'High';
  if (rpn >= 51) return 'Medium';
  return 'Low';
}

export function determineFinalRiskEvaluation(residualRpn: number): string {
  if (residualRpn > 100) return 'Not Acceptable';
  if (residualRpn > 50) return 'Conditionally Acceptable';
  return 'Acceptable';
}

export function requiresHeadQaRiskClosure(risk: RiskAssessmentRecord): boolean {
  return risk.riskLevel === 'Critical' || risk.riskLevel === 'High'
    || residualRiskLevel(estimateResidualRpn(risk)) === 'High';
}

function allControlsCompleted(risk: RiskAssessmentRecord): boolean {
  const controls = risk.controls || [];
  if (!controls.length) return Boolean(risk.mitigationAction?.trim()) && getMitigationStatus(risk) === 'Completed';
  return controls.every((c) => c.status === 'Completed' || c.status === 'Closed');
}

function effectivenessVerified(risk: RiskAssessmentRecord): boolean {
  if (!risk.effectivenessCheckRequired) return true;
  return ['Effective', 'Partially Effective'].includes(risk.effectivenessStatus);
}

export function computeRiskClosureReadiness(
  risk: RiskAssessmentRecord,
  form?: Partial<RiskClosureFormInput>,
): RiskClosureReadiness {
  const residualRpn = estimateResidualRpn(risk);
  const residualLevel = residualRiskLevel(residualRpn);
  const capaRequired = form?.capa_required ?? (risk.capaSuggested || Boolean(risk.linkedCapaNumber));
  const ccRequired = form?.change_control_required ?? Boolean(risk.linkedChangeControlNumber);
  const trainingRequired = form?.training_required ?? false;
  const validationRequired = form?.validation_required ?? risk.riskCategory.toLowerCase().includes('csv');

  const approved = form?.risk_assessment_approved ?? (['Approval', 'Mitigation', 'Effectiveness Check', 'Closure'].includes(risk.workflowStatus) || Boolean(risk.approvedBy));
  const fmeaDone = form?.fmea_completed ?? Boolean(risk.potentialCause && risk.severityScore > 0);
  const mitigationDone = form?.mitigation_actions_completed ?? allControlsCompleted(risk);
  const residualEvaluated = form?.residual_risk_evaluated ?? (residualRpn < risk.rpnScore || risk.effectivenessStatus !== 'Pending');
  const reviewDone = form?.risk_review_completed ?? Boolean(risk.reviewedBy || risk.reviews?.length);
  const effVerified = form?.effectiveness_verified ?? effectivenessVerified(risk);
  const capaDone = form?.capa_completed ?? (!capaRequired || Boolean(risk.linkedCapaNumber));
  const ccDone = form?.change_control_completed ?? (!ccRequired || Boolean(risk.linkedChangeControlNumber));
  const trainingDone = form?.training_completed ?? !trainingRequired;
  const validationDone = form?.validation_completed ?? !validationRequired;
  const finalApproval = form?.final_approval_completed ?? Boolean(risk.approvedBy);

  const items: RiskClosureChecklistItem[] = [
    { key: 'approved', label: 'Risk Assessment Approved', complete: approved, required: true },
    { key: 'fmea', label: 'FMEA Completed', complete: fmeaDone, required: true },
    { key: 'mitigation', label: 'Mitigation Actions Completed', complete: mitigationDone, required: true, warning: 'All mitigation actions must be closed' },
    { key: 'residual', label: 'Residual Risk Evaluated', complete: residualEvaluated, required: true },
    { key: 'review', label: 'Risk Review Completed', complete: reviewDone, required: true },
    { key: 'effectiveness', label: 'Effectiveness Verified', complete: effVerified, required: risk.effectivenessCheckRequired },
    { key: 'capa', label: 'CAPA Completed (if applicable)', complete: capaDone, required: capaRequired },
    { key: 'cc', label: 'Change Control Completed (if applicable)', complete: ccDone, required: ccRequired },
    { key: 'training', label: 'Training Completed (if applicable)', complete: trainingDone, required: trainingRequired },
    { key: 'validation', label: 'Validation Completed (if applicable)', complete: validationDone, required: validationRequired },
    { key: 'final', label: 'Final Approval Completed', complete: finalApproval, required: true },
  ];

  const blockers: string[] = [];
  if (!mitigationDone) blockers.push('Mitigation actions remain open');
  if (residualLevel === 'Critical') blockers.push('Residual risk is Critical — additional mitigation required');
  if (residualRpn > 100) blockers.push('Residual RPN > 100 — additional mitigation required');
  if (risk.effectivenessCheckRequired && !effVerified) blockers.push('Effectiveness review incomplete');
  if (capaRequired && !capaDone) blockers.push('Mandatory CAPA remains open');
  if (ccRequired && !ccDone) blockers.push('Mandatory Change Control remains open');
  if (validationRequired && !validationDone) blockers.push('Mandatory Validation incomplete');

  const required = items.filter((i) => i.required);
  const completeCount = required.filter((i) => i.complete).length;
  const percent = required.length ? Math.round((completeCount / required.length) * 100) : 0;
  const ready = blockers.length === 0 && completeCount === required.length;

  return { items, completeCount, totalRequired: required.length, percent, ready, blockers };
}

export function closureStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-700',
    'Ready For Closure': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-amber-100 text-amber-800',
    'Head QA Review': 'bg-purple-100 text-purple-800',
    Closed: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Reopened: 'bg-orange-100 text-orange-800',
  };
  return map[status || ''] || map.Pending;
}

export function evaluationBadgeColor(evaluation?: string): string {
  const map: Record<string, string> = {
    Acceptable: 'bg-green-100 text-green-800',
    'Conditionally Acceptable': 'bg-amber-100 text-amber-800',
    'Not Acceptable': 'bg-red-100 text-red-800',
  };
  return map[evaluation || ''] || 'bg-slate-100 text-slate-700';
}

export function canViewRiskClosure(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'department_head', 'validation_manager', 'csv_manager',
    'regulatory_affairs', 'auditor', 'viewer',
  ].includes(r);
}

export function isRiskClosureReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function canReviewRiskClosure(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager'].includes(normalizeRole(role || ''));
}

export function canApproveHeadQaRiskClosure(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canReopenRiskClosure(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canProvideClosureInputs(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return canReviewRiskClosure(role) || ['department_head', 'production_manager', 'qc_manager'].includes(r);
}

export function riskClosureMeaning(action: 'close' | 'reopen'): string {
  return action === 'close'
    ? 'I authorize closure of this risk assessment per ICH Q9 and GMP requirements.'
    : 'I authorize reopening of this closed risk assessment.';
}

export function computeRiskClosureDashboardMetrics(
  closures: RiskClosure[],
  risks: RiskAssessmentRecord[],
): RiskClosureDashboardMetrics {
  const readyRisks = risks.filter((r) => {
    if (['Closed', 'Accepted', 'Rejected'].includes(r.riskStatus)) return false;
    const readiness = computeRiskClosureReadiness(r);
    return readiness.ready;
  });

  return {
    readyForClosure: readyRisks.length,
    pendingClosure: closures.filter((c) => ['Pending', 'QA Review', 'Head QA Review'].includes(c.closure_status)).length,
    closed: closures.filter((c) => c.closure_status === 'Closed').length,
    rejected: closures.filter((c) => c.closure_status === 'Rejected').length,
    reopened: closures.filter((c) => c.closure_status === 'Reopened').length,
    highRiskClosures: closures.filter((c) => c.initial_risk_level === 'High' || c.initial_risk_level === 'Critical').length,
    capaPendingClosures: closures.filter((c) => c.capa_required && !c.capa_completed && c.closure_status !== 'Closed').length,
    validationPendingClosures: closures.filter((c) => c.validation_required && !c.validation_completed && c.closure_status !== 'Closed').length,
  };
}

export function mapClosureAuditToTimeline(logs: Record<string, unknown>[]): RiskClosureTimelineEntry[] {
  return logs
    .map((l) => ({
      action: String(l.actionType || l.action || 'Event'),
      user: String(l.userName || l.changedByUserName || 'System'),
      at: String(l.dateTime || l.timestamp || ''),
      detail: String(l.actionDescription || l.reason || ''),
    }))
    .filter((e) => e.at)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function buildDefaultClosureForm(risk: RiskAssessmentRecord, existing?: RiskClosure | null): RiskClosureFormInput {
  const capaRequired = existing?.capa_required ?? (risk.capaSuggested || Boolean(risk.linkedCapaNumber));
  const ccRequired = existing?.change_control_required ?? Boolean(risk.linkedChangeControlNumber);
  const residualRpn = estimateResidualRpn(risk);
  return {
    risk_assessment_approved: existing?.approval_completed ?? Boolean(risk.approvedBy),
    fmea_completed: existing?.mitigation_completed ?? Boolean(risk.potentialCause),
    mitigation_actions_completed: existing?.mitigation_completed ?? allControlsCompleted(risk),
    residual_risk_evaluated: existing?.mitigation_effectiveness_verified ?? residualRpn <= risk.rpnScore,
    risk_review_completed: existing?.review_completed ?? Boolean(risk.reviewedBy),
    effectiveness_verified: existing?.mitigation_effectiveness_verified ?? effectivenessVerified(risk),
    capa_completed: existing?.capa_completed ?? (!capaRequired || Boolean(risk.linkedCapaNumber)),
    change_control_completed: existing?.change_control_completed ?? (!ccRequired || Boolean(risk.linkedChangeControlNumber)),
    training_completed: existing?.training_completed ?? true,
    validation_completed: existing?.validation_completed ?? true,
    final_approval_completed: existing?.approval_completed ?? Boolean(risk.approvedBy),
    capa_required: capaRequired,
    change_control_required: ccRequired,
    training_required: existing?.training_required ?? false,
    validation_required: existing?.validation_required ?? risk.riskCategory.toLowerCase().includes('csv'),
    closure_justification: existing?.closure_justification || '',
    final_risk_evaluation: existing?.final_risk_evaluation || determineFinalRiskEvaluation(residualRpn),
    qa_closure_comments: existing?.qa_closure_comments || '',
    head_qa_comments: existing?.head_qa_comments || '',
  };
}

export { calculateRiskAssessment, estimateResidualRpn, inferRiskDepartment, getMitigationStatus };
