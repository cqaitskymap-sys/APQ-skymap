import { normalizeRole } from '@/lib/permissions';
import type { ComplaintInvestigation, ComplaintRecord } from '@/lib/complaint-types';
import { COMPLAINT_INVESTIGATION_STATUSES, COMPLAINT_RCA_METHODS } from '@/lib/complaint-types';
import type { ComplaintInvestigationInput } from '@/lib/complaint-schemas';

export const COMPLAINT_INVESTIGATION_MODULE = 'Complaint Investigation';

export type ComplaintInvestigationActor = { id: string; name: string; role?: string; department?: string };

export interface ComplaintInvestigationTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

function yesValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  return false;
}

export function canViewComplaintInvestigation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'qc', 'qc_manager', 'production', 'production_manager', 'warehouse',
    'regulatory_affairs', 'auditor', 'viewer',
  ].includes(r);
}

export function isComplaintInvestigationReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canEditComplaintInvestigation(
  role?: string | null,
  record?: ComplaintRecord,
  actorId?: string,
): boolean {
  if (isComplaintInvestigationReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  if (record?.assigned_to && actorId && record.assigned_to === actorId) return true;
  if (['qc', 'qc_manager', 'production', 'production_manager', 'warehouse', 'regulatory_affairs'].includes(r)) return true;
  return false;
}

export function canReviewComplaintInvestigation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canApproveCriticalComplaintInvestigation(role?: string | null, criticality?: string): boolean {
  if (criticality !== 'Critical') return canReviewComplaintInvestigation(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canEditChecklistField(role?: string | null, field?: string): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  const qcFields = ['qc_result_review', 'sample_analysis', 'sample_condition', 'complaint_sample_received'];
  const prodFields = ['manufacturing_process_review', 'batch_record_review', 'batch_review'];
  const whFields = ['distribution_review'];
  const regFields = ['impact_assessment'];
  if (['qc', 'qc_manager'].includes(r) && field && qcFields.includes(field)) return true;
  if (['production', 'production_manager'].includes(r) && field && prodFields.includes(field)) return true;
  if (['warehouse'].includes(r) && field && whFields.includes(field)) return true;
  if (['regulatory_affairs'].includes(r) && field && regFields.includes(field)) return true;
  return false;
}

export function computeComplaintInvestigationAutoRules(
  input: Partial<ComplaintInvestigationInput>,
  complaint?: ComplaintRecord,
): {
  capaRequired: boolean;
  recallEvaluationRequired: boolean;
  notifyHeadQa: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const sampleReceived = input.complaint_sample_received === 'Yes' || complaint?.sample_received === true;
  const qualityImpact = yesValue(complaint?.product_quality_impact);
  const marketImpact = yesValue(complaint?.market_impact);
  const noAssignable = input.root_cause_method === 'No Assignable Cause';

  if (sampleReceived && !input.sample_condition?.trim()) {
    warnings.push('Complaint sample received — sample condition is required.');
  }
  if (qualityImpact) warnings.push('Product quality impact — CAPA is mandatory.');
  if (marketImpact) warnings.push('Market impact — recall evaluation is required.');
  if (noAssignable && !input.qa_justification?.trim()) {
    warnings.push('No assignable cause — QA justification is required.');
  }
  if (!input.root_cause?.trim() && !noAssignable && input.root_cause_method !== 'No Assignable Cause') {
    warnings.push('Root cause or no-assignable-cause justification required before closure.');
  }
  if (!input.conclusion?.trim()) {
    warnings.push('Final investigation conclusion is required before closure.');
  }

  return {
    capaRequired: qualityImpact || input.capa_required === true,
    recallEvaluationRequired: marketImpact || input.recall_evaluation_required === true,
    notifyHeadQa: complaint?.complaint_criticality === 'Critical' || yesValue(complaint?.product_safety_impact),
    warnings,
  };
}

export function investigationStatusColor(status?: string): string {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700',
    'In Progress': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    'CAPA Required': 'bg-orange-100 text-orange-800',
    'Recall Evaluation': 'bg-red-100 text-red-800',
    Completed: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };
  return map[status || 'Not Started'] || map['Not Started'];
}

export function mapAuditToComplaintInvestigationTimeline(logs: Record<string, unknown>[]): ComplaintInvestigationTimelineEntry[] {
  return logs
    .filter((log) => {
      const action = String(log.action || log.actionType || '');
      return /investigation|sample|rca|impact|capa|recall|review|approve|reject/i.test(action);
    })
    .map((log) => ({
      action: String(log.action || log.actionType || 'Activity'),
      user: String(log.userName || (log.user as { name?: string } | undefined)?.name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.newValue || log.actionDescription || '').slice(0, 200),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function mapInvestigationToForm(
  inv: ComplaintInvestigation | null,
  complaint: ComplaintRecord,
): ComplaintInvestigationInput {
  return {
    investigation_start_date: inv?.investigation_start_date || complaint.complaint_date || '',
    investigation_due_date: inv?.investigation_due_date || complaint.due_date || '',
    customer_complaint_summary: inv?.customer_complaint_summary || complaint.complaint_description || '',
    retain_sample_available: (inv?.retain_sample_available === 'Yes' || complaint.retain_sample_required ? 'Yes' : 'No') as 'Yes' | 'No',
    complaint_sample_received: (inv?.complaint_sample_received === 'Yes' || complaint.sample_received ? 'Yes' : 'No') as 'Yes' | 'No',
    sample_condition: inv?.sample_condition || inv?.sample_analysis || '',
    batch_record_review: inv?.batch_record_review || inv?.batch_review || '',
    qc_result_review: inv?.qc_result_review || '',
    stability_data_review: inv?.stability_data_review || '',
    manufacturing_process_review: inv?.manufacturing_process_review || '',
    packaging_review: inv?.packaging_review || '',
    distribution_review: inv?.distribution_review || '',
    previous_complaint_review: inv?.previous_complaint_review || '',
    root_cause_method: (inv?.root_cause_method as ComplaintInvestigationInput['root_cause_method']) || '5 Why',
    investigation_summary: inv?.investigation_summary || '',
    findings: inv?.findings || '',
    root_cause: inv?.root_cause || complaint.root_cause || '',
    impact_assessment: inv?.impact_assessment || complaint.impact_assessment || '',
    sample_analysis: inv?.sample_analysis || '',
    batch_review: inv?.batch_review || '',
    conclusion: inv?.conclusion || '',
    capa_required: inv?.capa_required ?? complaint.capa_required ?? false,
    recall_evaluation_required: inv?.recall_evaluation_required ?? yesValue(complaint.recall_evaluation_required),
    qa_justification: inv?.qa_justification || '',
  };
}

export { COMPLAINT_INVESTIGATION_STATUSES, COMPLAINT_RCA_METHODS };
