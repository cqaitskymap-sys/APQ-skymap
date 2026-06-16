import { normalizeRole } from '@/lib/permissions';
import {
  computeCapaRequired,
  requiresHeadQaApproval,
  type DeviationInvestigation,
  type DeviationRecord,
  INVESTIGATION_STATUSES,
  RCA_METHODS,
} from '@/lib/deviation-types';

export type InvestigationActor = { id: string; name: string; role?: string; email?: string };

export type InvestigationStatus = typeof INVESTIGATION_STATUSES[number];

export interface InvestigationFormInput {
  investigation_summary: string;
  detailed_investigation?: string;
  rca_method: string;
  root_cause_details: string;
  root_cause?: string;
  contributing_factors?: string;
  immediate_correction?: string;
  corrective_action_required?: boolean;
  preventive_action_required?: boolean;
  capa_required?: boolean;
  impact_on_batch?: string;
  impact_on_product_quality?: string;
  impact_on_patient_safety?: string;
  impact_on_regulatory_compliance?: string;
  other_batches_impacted?: string;
  other_batches_details?: string;
  final_investigation_conclusion?: string;
  investigation_due_date?: string;
  five_why?: DeviationInvestigation['five_why'];
}

export interface InvestigationQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
}

export interface InvestigationTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export function canViewInvestigation(role?: string | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'auditor', 'viewer', 'regulatory_affairs'].includes(r)) return true;
  if (['qc_manager', 'qc', 'production_manager', 'production', 'engineering_manager', 'engineering',
    'warehouse_manager', 'warehouse'].includes(r)) return true;
  return false;
}

export function canEditInvestigation(
  role: string | null | undefined,
  record: DeviationRecord,
  actorId: string,
): boolean {
  if (isReadOnlyInvestigationRole(role)) return false;
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(r)) return true;
  if (record.assigned_investigator === actorId) return true;
  if (record.assigned_investigator_name && record.assigned_investigator_name.toLowerCase().includes(r.replace('_', ' '))) return true;
  const deptByRole: Record<string, string> = {
    production_manager: 'Production', qc_manager: 'QC', engineering_manager: 'Engineering', warehouse_manager: 'Warehouse',
  };
  const dept = deptByRole[r];
  if (dept && record.department === dept) return true;
  return false;
}

export function canReviewInvestigation(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(r);
}

export function canApproveCriticalInvestigation(role?: string | null, criticality?: string): boolean {
  if (!requiresHeadQaApproval(criticality || '')) return canReviewInvestigation(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}

export function isReadOnlyInvestigationRole(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role));
}

export function computeInvestigationAutoRules(
  input: Partial<InvestigationFormInput>,
  record?: DeviationRecord,
): { capaRequired: boolean; notifyHeadQa: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const qualityYes = input.impact_on_product_quality === 'Yes' || record?.product_quality_impacted;
  const safetyYes = input.impact_on_patient_safety === 'Yes' || record?.patient_safety_impacted;
  const otherBatches = input.other_batches_impacted === 'Yes';

  if (qualityYes) warnings.push('Product quality impact — CAPA is mandatory.');
  if (safetyYes) warnings.push('Patient safety impact — Head QA notification is mandatory.');
  if (otherBatches && !input.other_batches_details?.trim()) {
    warnings.push('Other batches impacted — batch impact details are required.');
  }

  const capaRequired = computeCapaRequired({
    product_quality_impacted: qualityYes,
    patient_safety_impacted: safetyYes,
    capa_required: input.capa_required,
    criticality: record?.criticality,
    repeat_deviation: record?.repeat_deviation,
  });

  return { capaRequired, notifyHeadQa: safetyYes || requiresHeadQaApproval(record?.criticality || ''), warnings };
}

export function investigationStatusColor(status?: string): string {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700',
    'In Progress': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    'CAPA Required': 'bg-orange-100 text-orange-800',
    Completed: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || 'Not Started'] || map['Not Started'];
}

export function mapAuditToInvestigationTimeline(logs: Record<string, unknown>[]): InvestigationTimelineEntry[] {
  return logs
    .filter((log) => {
      const action = String(log.action || log.actionType || '');
      return /investigation|rca|impact|capa|review|approve|reject|closure/i.test(action);
    })
    .map((log) => ({
      action: String(log.action || log.actionType || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || ''),
      detail: String(log.reason || log.newValue || '').slice(0, 200),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export { INVESTIGATION_STATUSES, RCA_METHODS };
