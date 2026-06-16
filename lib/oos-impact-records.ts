import { normalizeRole } from '@/lib/permissions';
import { isCriticalOosTest, type OosRecord } from '@/lib/oos-types';

export type OosImpactActor = { id: string; name: string; role?: string; email?: string };

export const OOS_IMPACT_CHECKLIST_FIELDS = [
  { key: 'product_quality_impact', label: 'Product Quality Impact' },
  { key: 'batch_impact', label: 'Batch Impact' },
  { key: 'patient_safety_impact', label: 'Patient Safety Impact' },
  { key: 'regulatory_impact', label: 'Regulatory Impact' },
  { key: 'market_impact', label: 'Market Impact' },
  { key: 'stability_impact', label: 'Stability Impact' },
  { key: 'validation_impact', label: 'Validation Impact' },
] as const;

export interface OosImpactFormInput {
  assessment_date: string;
  assessed_by_name: string;
  product_quality_impact: string;
  batch_impact: string;
  patient_safety_impact: string;
  regulatory_impact: string;
  market_impact: string;
  stability_impact: string;
  validation_impact: string;
  other_batches_impacted: string;
  impacted_batch_numbers?: string;
  impact_description?: string;
  scientific_justification?: string;
  severity: number;
  occurrence: number;
  detection: number;
  capa_required: boolean;
  deviation_required: boolean;
  recall_evaluation_required: boolean;
  recall_evaluation_reason?: string;
  conclusion?: string;
  qa_comments?: string;
}

export interface OosImpactAutoRules {
  capaRequired: boolean;
  deviationRecommended: boolean;
  recallEvaluationRequired: boolean;
  notifyHeadQa: boolean;
  headQaApprovalRequired: boolean;
  warnings: string[];
}

export interface OosImpactTimelineEntry {
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

export function computeOosImpactAutoRules(input: Partial<OosImpactFormInput>, record?: OosRecord | null): OosImpactAutoRules {
  const warnings: string[] = [];
  const capaRequired = impactYes(input.product_quality_impact) || input.capa_required === true;
  const recallEvaluationRequired = impactYes(input.market_impact) || input.recall_evaluation_required === true;
  const notifyHeadQa = impactYes(input.patient_safety_impact);
  const score = computeRiskScore(input.severity || 1, input.occurrence || 1, input.detection || 1);
  const riskLevel = computeRiskLevel(score);
  const headQaApprovalRequired = riskLevel === 'Critical' || Boolean(record && isCriticalOosTest(record.test_name));

  if (impactYes(input.product_quality_impact)) warnings.push('Product quality impact — CAPA is mandatory.');
  if (impactYes(input.patient_safety_impact)) warnings.push('Patient safety impact — Head QA notification required immediately.');
  if (impactYes(input.market_impact)) warnings.push('Market impact — recall evaluation is required.');
  if (input.other_batches_impacted === 'Yes' && !input.impacted_batch_numbers?.trim()) {
    warnings.push('Other batches impacted — impacted batch numbers are required.');
  }
  if (impactYes(input.market_impact) && !input.recall_evaluation_reason?.trim()) {
    warnings.push('Recall evaluation reason is required when market impact is Yes.');
  }
  if (riskLevel === 'Critical') warnings.push('Critical risk level — Head QA approval required.');
  if (impactYes(input.batch_impact)) warnings.push('Batch impact identified — verify batch disposition and release status.');

  return {
    capaRequired,
    deviationRecommended: impactYes(input.batch_impact) || impactYes(input.product_quality_impact),
    recallEvaluationRequired,
    notifyHeadQa,
    headQaApprovalRequired,
    warnings,
  };
}

export function canViewOosImpactAssessment(role?: string | null, record?: OosRecord | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'auditor', 'viewer'].includes(r)) return true;
  if (r === 'head_qa' && record && isCriticalOosTest(record.test_name)) return true;
  return ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canEditOosImpactAssessment(role?: string | null): boolean {
  const r = normalizeRole(role);
  if (['auditor', 'viewer'].includes(r)) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canReviewOosImpactAssessment(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role));
}

export function canApproveCriticalOosImpact(role?: string | null, riskLevel?: string): boolean {
  if (riskLevel !== 'Critical') return canReviewOosImpactAssessment(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}

export function isOosImpactReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role));
}

export function mapOosImpactAuditTimeline(logs: Record<string, unknown>[]): OosImpactTimelineEntry[] {
  return logs
    .filter((log) => /impact|recall|capa|risk|patient|market|qa review|approve|reject/i.test(String(log.actionType || log.action || '')))
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
