import { normalizeRole } from '@/lib/permissions';
import {
  requiresHeadQaApproval,
  type ChangeApproval,
  type ChangeClosure,
  type ChangeControlRecord,
  type ChangeEffectivenessReview,
  type ChangeImpactAssessment,
  type ChangeImplementationAction,
  type ChangeRiskAssessment,
  type CcClosureDashboardMetrics,
  type CcClosureTimelineEntry,
  isCcClosed,
} from '@/lib/change-control-types';

export const CC_CLOSURE_MODULE = 'Change Control Closure';

export type CcClosureActor = { id: string; name: string; role?: string; email?: string };

export interface CcClosureChecklistItem {
  key: string;
  label: string;
  complete: boolean;
  required: boolean;
  warning?: string;
}

export interface CcClosureReadiness {
  items: CcClosureChecklistItem[];
  completeCount: number;
  totalRequired: number;
  percent: number;
  ready: boolean;
  blockers: string[];
}

export interface CcClosureFormInput {
  impact_assessment_completed: boolean;
  risk_assessment_completed: boolean;
  validation_assessment_completed: boolean;
  implementation_completed: boolean;
  training_completed: boolean;
  document_revision_completed: boolean;
  validation_completed: boolean;
  csv_completed: boolean;
  regulatory_action_completed: boolean;
  effectiveness_review_completed: boolean;
  effectiveness_result: string;
  capa_required: boolean;
  capa_linked: boolean;
  capa_completed: boolean;
  all_evidence_reviewed: boolean;
  qa_closure_comments: string;
  head_qa_comments?: string;
  final_closure_conclusion: string;
}

const IMPL_DONE_STATUSES = ['implemented', 'effectiveness_pending', 'effectiveness_completed', 'final_qa_review', 'approved', 'closed'];

function allImplementationComplete(actions: ChangeImplementationAction[]): boolean {
  if (!actions.length) return false;
  return actions.every((a) => a.status === 'completed');
}

function actionsOfTypeComplete(actions: ChangeImplementationAction[], type: string): boolean {
  const typed = actions.filter((a) => a.action_type === type);
  if (!typed.length) return false;
  return typed.every((a) => a.status === 'completed');
}

function hasRegulatoryApproval(approvals: ChangeApproval[]): boolean {
  return approvals.some((a) => a.approval_level === 'regulatory' && a.decision === 'approved');
}

export function computeCcClosureReadiness(input: {
  change: ChangeControlRecord;
  impact?: ChangeImpactAssessment | null;
  risk?: ChangeRiskAssessment | null;
  implementation: ChangeImplementationAction[];
  effectiveness?: ChangeEffectivenessReview | null;
  approvals: ChangeApproval[];
  attachmentCount: number;
  validationAssessmentExists?: boolean;
  documentRevisionExists?: boolean;
  trainingRecordExists?: boolean;
  form?: Partial<CcClosureFormInput>;
}): CcClosureReadiness {
  const {
    change, impact, risk, implementation, effectiveness, approvals, attachmentCount,
    validationAssessmentExists, documentRevisionExists, trainingRecordExists, form,
  } = input;

  const impactComplete = form?.impact_assessment_completed ?? Boolean(impact?.assessed_at);
  const riskComplete = form?.risk_assessment_completed ?? Boolean(risk?.assessed_at);
  const implComplete = form?.implementation_completed ?? (
    allImplementationComplete(implementation) || IMPL_DONE_STATUSES.includes(change.status)
  );

  const validationRequired = change.validation_impact;
  const validationComplete = form?.validation_assessment_completed ?? (
    !validationRequired
    || validationAssessmentExists
    || actionsOfTypeComplete(implementation, 'validation')
    || Boolean(form?.validation_completed)
  );

  const trainingRequired = change.training_impact;
  const trainingComplete = form?.training_completed ?? (
    !trainingRequired || trainingRecordExists || actionsOfTypeComplete(implementation, 'training')
  );

  const documentRequired = Boolean(change.affected_documents?.trim())
    || change.change_type === 'Document Change';
  const documentComplete = form?.document_revision_completed ?? (
    !documentRequired || documentRevisionExists
  );

  const csvRequired = change.csv_impact;
  const csvComplete = form?.csv_completed ?? (
    !csvRequired || actionsOfTypeComplete(implementation, 'csv')
  );

  const regulatoryRequired = change.regulatory_impact;
  const regulatoryComplete = form?.regulatory_action_completed ?? (
    !regulatoryRequired || hasRegulatoryApproval(approvals)
  );

  const effRequired = change.effectiveness_check_required;
  const effResult = form?.effectiveness_result
    || effectiveness?.effectiveness_result
    || effectiveness?.result
    || 'Pending';
  const effReviewApproved = effectiveness?.status === 'Approved' || effectiveness?.status === 'Closed';
  const effComplete = form?.effectiveness_review_completed ?? (
    !effRequired || effReviewApproved
  );
  const effApproved = !effRequired || (effResult !== 'Not Effective' && effComplete);

  const capaRequired = change.capa_required;
  const capaLinked = Boolean(change.linked_capa_id);
  const capaComplete = form?.capa_completed ?? (!capaRequired || (capaLinked && Boolean(change.linked_capa_number)));

  const evidenceOk = form?.all_evidence_reviewed ?? (
    attachmentCount > 0
    || implementation.some((a) => Boolean(a.evidence))
    || (implComplete && !implementation.length)
  );

  const items: CcClosureChecklistItem[] = [
    { key: 'impact', label: 'Impact Assessment Completed', complete: impactComplete, required: true },
    { key: 'risk', label: 'Risk Assessment Completed', complete: riskComplete, required: true },
    { key: 'implementation', label: 'Implementation Completed', complete: implComplete, required: true },
    { key: 'validation', label: 'Validation Assessment Completed', complete: Boolean(validationComplete), required: validationRequired },
    { key: 'validation_impl', label: 'Validation Activities Completed', complete: form?.validation_completed ?? (!validationRequired || actionsOfTypeComplete(implementation, 'validation')), required: validationRequired },
    { key: 'training', label: 'Training Completed', complete: Boolean(trainingComplete), required: trainingRequired },
    { key: 'document', label: 'Document Revision Completed', complete: Boolean(documentComplete), required: documentRequired },
    { key: 'csv', label: 'CSV Activities Completed', complete: csvComplete, required: csvRequired },
    { key: 'regulatory', label: 'Regulatory Action Completed', complete: regulatoryComplete, required: regulatoryRequired },
    { key: 'effectiveness', label: 'Effectiveness Review Completed', complete: effComplete, required: effRequired },
    { key: 'eff_result', label: 'Effectiveness Result Acceptable', complete: effApproved, required: effRequired, warning: effResult === 'Not Effective' ? 'Not Effective — closure blocked' : undefined },
    { key: 'capa', label: 'CAPA Completed (if required)', complete: capaComplete, required: capaRequired },
    { key: 'evidence', label: 'All Evidence Reviewed', complete: evidenceOk, required: true },
  ];

  const required = items.filter((i) => i.required);
  const completeCount = required.filter((i) => i.complete).length;
  const blockers = required.filter((i) => !i.complete).map((i) => i.label);
  const percent = required.length ? Math.round((completeCount / required.length) * 100) : 0;

  return { items, completeCount, totalRequired: required.length, percent, ready: blockers.length === 0, blockers };
}

export function computeCcClosureDecision(form: CcClosureFormInput): { status: string } {
  if (form.effectiveness_result === 'Not Effective') return { status: 'Rejected' };
  if (form.qa_closure_comments.trim() && form.final_closure_conclusion.trim()) {
    return { status: 'Ready For Closure' };
  }
  return { status: 'Pending' };
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

export function canViewCcClosure(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  if (raw.includes('validation') || raw.includes('csv') || raw === 'regulatory_affairs' || raw === 'regulatory') return true;
  return raw.includes('production') || raw.includes('engineering') || raw.includes('qc') || raw.includes('warehouse');
}

export function isDepartmentCcClosureViewer(role?: string | null): boolean {
  if (isCcClosureReadOnly(role) || canReviewCcClosure(role)) return false;
  const raw = (role || '').toLowerCase();
  return raw.includes('production') || raw.includes('engineering') || raw.includes('qc') || raw.includes('warehouse');
}

export function canRejectCcClosure(role?: string | null): boolean {
  return canReviewCcClosure(role);
}

export function isCcClosureReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canReviewCcClosure(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canApproveCcClosure(role?: string | null, change?: ChangeControlRecord): boolean {
  if (requiresHeadQaApproval(change?.change_category || '')) {
    return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
  }
  return canReviewCcClosure(role);
}

export function canReopenCcClosure(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canProvideValidationClosureInput(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canReviewCcClosure(role) || raw.includes('validation');
}

export function canProvideCsvClosureInput(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canReviewCcClosure(role) || raw.includes('csv');
}

export function canProvideRegulatoryClosureInput(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canReviewCcClosure(role) || raw === 'regulatory_affairs' || raw === 'regulatory';
}

export function computeCcClosureDashboardMetrics(
  closures: ChangeClosure[],
  changes: ChangeControlRecord[] = [],
): CcClosureDashboardMetrics {
  const active = closures.filter((c) => !c.is_deleted);
  const readyStatuses = ['implemented', 'effectiveness_completed', 'final_qa_review', 'approved'];
  return {
    readyForClosure: active.filter((c) => c.closure_status === 'Ready For Closure').length
      + changes.filter((r) => readyStatuses.includes(r.status) && !isCcClosed(r.status)).length,
    pendingReview: active.filter((c) => ['Pending', 'QA Review', 'Head QA Review'].includes(c.closure_status)).length,
    closed: active.filter((c) => c.closure_status === 'Closed').length + changes.filter((r) => r.status === 'closed').length,
    rejected: active.filter((c) => c.closure_status === 'Rejected').length,
    reopened: active.filter((c) => c.closure_status === 'Reopened').length,
    effectiveClosures: active.filter((c) => c.effectiveness_result === 'Effective' && c.closure_status === 'Closed').length,
    partiallyEffective: active.filter((c) => c.effectiveness_result === 'Partially Effective').length,
    notEffective: active.filter((c) => c.effectiveness_result === 'Not Effective').length,
  };
}

export function mapCcClosureAuditToTimeline(logs: Record<string, unknown>[]): CcClosureTimelineEntry[] {
  return logs
    .filter((log) => /closure|close|reopen|checklist|e-sign|esign|validation|training|document|implementation|effectiveness/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.changedByUserName || log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function ccClosureMeaning(action: 'close' | 'reopen' = 'close'): string {
  return action === 'reopen'
    ? 'I authorize reopening this Change Control record.'
    : 'I provide final GMP closure authorization for this Change Control.';
}
