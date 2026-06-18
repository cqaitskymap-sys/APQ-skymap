import { normalizeRole } from '@/lib/permissions';
import { isSafetyCategory, type ComplaintRecord } from '@/lib/complaint-types';

export const COMPLAINT_IMPACT_MODULE = 'Complaint Impact Assessment';

export type ComplaintImpactActor = { id: string; name: string; role?: string; email?: string; department?: string };

export const COMPLAINT_IMPACT_CHECKLIST_FIELDS = [
  { key: 'product_quality_impact', label: 'Product Quality Impact', roles: ['qc', 'qc_manager', 'qa', 'qa_manager', 'head_qa'] },
  { key: 'patient_safety_impact', label: 'Patient Safety Impact', roles: ['qa', 'qa_manager', 'head_qa'] },
  { key: 'regulatory_impact', label: 'Regulatory Impact', roles: ['regulatory_affairs', 'qa', 'qa_manager', 'head_qa'] },
  { key: 'market_impact', label: 'Market Impact', roles: ['qa', 'qa_manager', 'head_qa', 'regulatory_affairs'] },
  { key: 'batch_impact', label: 'Batch Impact', roles: ['production', 'production_manager', 'qa', 'qa_manager'] },
  { key: 'distribution_impact', label: 'Distribution Impact', roles: ['warehouse', 'qa', 'qa_manager'] },
] as const;

export interface ComplaintImpactFormInput {
  assessment_date: string;
  assessed_by_name: string;
  product_quality_impact: string;
  patient_safety_impact: string;
  regulatory_impact: string;
  market_impact: string;
  batch_impact: string;
  distribution_impact: string;
  distribution_notes?: string;
  other_batches_impacted: string;
  impacted_batch_numbers?: string;
  impact_description?: string;
  scientific_justification?: string;
  severity: number;
  occurrence: number;
  detection: number;
  capa_required: boolean;
  recall_evaluation_required: boolean;
  recall_evaluation_reason?: string;
  conclusion?: string;
  qa_comments?: string;
}

export interface ComplaintImpactAutoRules {
  capaRequired: boolean;
  recallEvaluationRequired: boolean;
  notifyHeadQa: boolean;
  notifyRegulatory: boolean;
  headQaApprovalRequired: boolean;
  warnings: string[];
}

export interface ComplaintImpactTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export function impactYes(value?: string): boolean {
  return value === 'Yes';
}

export function computeRiskScore(severity: number, occurrence: number, detection: number): number {
  const s = Math.max(1, Math.min(10, severity || 1));
  const o = Math.max(1, Math.min(10, occurrence || 1));
  const d = Math.max(1, Math.min(10, detection || 1));
  return s * o * d;
}

export function computeRiskLevel(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (score > 100) return 'Critical';
  if (score > 60) return 'High';
  if (score > 30) return 'Medium';
  return 'Low';
}

export function riskLevelColor(level?: string): string {
  const map: Record<string, string> = {
    Low: 'bg-green-100 text-green-800 border-green-200',
    Medium: 'bg-blue-100 text-blue-800 border-blue-200',
    High: 'bg-orange-100 text-orange-800 border-orange-200',
    Critical: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[level || 'Low'] || map.Low;
}

export function impactStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700 border-slate-200',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-purple-100 text-purple-800 border-purple-200',
    'QA Review': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Approved: 'bg-green-100 text-green-800 border-green-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
  };
  return map[status || 'Draft'] || map.Draft;
}

export function computeComplaintImpactAutoRules(
  input: Partial<ComplaintImpactFormInput>,
  record?: ComplaintRecord | null,
): ComplaintImpactAutoRules {
  const warnings: string[] = [];
  const capaRequired = impactYes(input.product_quality_impact) || input.capa_required === true;
  const recallEvaluationRequired = impactYes(input.market_impact) || input.recall_evaluation_required === true;
  const notifyHeadQa = impactYes(input.patient_safety_impact);
  const notifyRegulatory = impactYes(input.regulatory_impact);
  const score = computeRiskScore(input.severity || 1, input.occurrence || 1, input.detection || 1);
  const riskLevel = computeRiskLevel(score);
  const headQaApprovalRequired = riskLevel === 'Critical'
    || record?.complaint_criticality === 'Critical'
    || Boolean(record && isSafetyCategory(record.complaint_category));

  if (impactYes(input.product_quality_impact)) warnings.push('Product quality impact — CAPA is mandatory.');
  if (impactYes(input.patient_safety_impact)) warnings.push('Patient safety impact — Head QA notification required immediately.');
  if (impactYes(input.regulatory_impact)) warnings.push('Regulatory impact — Regulatory Affairs will be notified.');
  if (impactYes(input.market_impact)) warnings.push('Market impact — recall evaluation is required.');
  if (input.other_batches_impacted === 'Yes' && !input.impacted_batch_numbers?.trim()) {
    warnings.push('Other batches impacted — impacted batch numbers are required.');
  }
  if (impactYes(input.market_impact) && !input.recall_evaluation_reason?.trim()) {
    warnings.push('Recall evaluation reason is required when market impact is Yes.');
  }
  if (riskLevel === 'Critical') warnings.push('Critical risk level — Head QA approval required.');
  if (impactYes(input.batch_impact)) warnings.push('Batch impact identified — verify batch disposition and release status.');
  if (impactYes(input.distribution_impact)) warnings.push('Distribution impact — verify warehouse and shipment records.');

  return {
    capaRequired,
    recallEvaluationRequired,
    notifyHeadQa,
    notifyRegulatory,
    headQaApprovalRequired,
    warnings,
  };
}

export function canViewComplaintImpactAssessment(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'qc_manager', 'qc', 'production_manager', 'production',
    'warehouse', 'regulatory_affairs', 'auditor', 'viewer',
  ].includes(r);
}

export function canEditComplaintImpactAssessment(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['auditor', 'viewer'].includes(r)) return false;
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'qc_manager', 'qc', 'production_manager', 'production',
    'warehouse', 'regulatory_affairs',
  ].includes(r);
}

export function canReviewComplaintImpactAssessment(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role || ''));
}

export function canApproveCriticalComplaintImpact(role?: string | null, riskLevel?: string): boolean {
  if (riskLevel !== 'Critical') return canReviewComplaintImpactAssessment(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function isComplaintImpactReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function mapComplaintImpactAuditTimeline(logs: Record<string, unknown>[]): ComplaintImpactTimelineEntry[] {
  return logs
    .filter((log) => /impact|recall|capa|risk|patient|market|regulatory|distribution|qa review|approve|reject/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.userName || log.user_name || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.actionDescription || log.reason || '').slice(0, 200),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function parseImpactedBatches(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return raw.split(/[\n,;]+/).map((b) => b.trim()).filter(Boolean);
}

export function buildComplaintImpactSummary(assessment: Partial<ComplaintImpactFormInput>): string {
  const parts: string[] = [];
  if (assessment.conclusion?.trim()) parts.push(assessment.conclusion.trim());
  const impacts = [
    ['Product Quality', assessment.product_quality_impact],
    ['Patient Safety', assessment.patient_safety_impact],
    ['Regulatory', assessment.regulatory_impact],
    ['Market', assessment.market_impact],
    ['Batch', assessment.batch_impact],
    ['Distribution', assessment.distribution_impact],
  ].filter(([, v]) => v && v !== 'Not Applicable' && v !== 'No');
  if (impacts.length) {
    parts.push(impacts.map(([k, v]) => `${k}: ${v}`).join('; '));
  }
  return parts.join(' — ').slice(0, 2000);
}
