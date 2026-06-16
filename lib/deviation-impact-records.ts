import { normalizeRole } from '@/lib/permissions';
import { computeCapaRequired, type DeviationRecord } from '@/lib/deviation-types';

export type ImpactAssessmentActor = { id: string; name: string; role?: string; email?: string };

export const IMPACT_CHECKLIST_FIELDS = [
  { key: 'batch_impact', label: 'Batch Impact' },
  { key: 'product_quality_impact', label: 'Product Quality Impact' },
  { key: 'patient_safety_impact', label: 'Patient Safety Impact' },
  { key: 'regulatory_impact', label: 'Regulatory Impact' },
  { key: 'stability_impact', label: 'Stability Impact' },
  { key: 'validation_impact', label: 'Validation Impact' },
  { key: 'equipment_impact', label: 'Equipment Impact' },
  { key: 'utility_impact', label: 'Utility Impact' },
  { key: 'material_impact', label: 'Material Impact' },
  { key: 'packaging_impact', label: 'Packaging Impact' },
  { key: 'cleaning_impact', label: 'Cleaning Impact' },
  { key: 'documentation_impact', label: 'Documentation Impact' },
  { key: 'training_impact', label: 'Training Impact' },
  { key: 'market_impact', label: 'Market Impact' },
] as const;

export type ImpactFormInput = {
  assessment_date: string;
  assessed_by_name: string;
  department?: string;
  batch_impact: string;
  product_quality_impact: string;
  patient_safety_impact: string;
  regulatory_impact: string;
  stability_impact: string;
  validation_impact: string;
  equipment_impact: string;
  utility_impact: string;
  material_impact: string;
  packaging_impact: string;
  cleaning_impact: string;
  documentation_impact: string;
  training_impact: string;
  market_impact: string;
  other_batches_impacted: string;
  impacted_batch_numbers?: string;
  impact_description?: string;
  impact_summary: string;
  batch_impact_details?: string;
  product_quality_impact_details?: string;
  patient_safety_impact_details?: string;
  regulatory_impact_details?: string;
  severity: number;
  occurrence: number;
  detection: number;
  capa_required: boolean;
  capa_justification?: string;
  recall_evaluation_required: boolean;
  conclusion?: string;
  qa_comments?: string;
};

export interface ImpactAutoRules {
  capaRequired: boolean;
  recallEvaluationRequired: boolean;
  notifyHeadQa: boolean;
  headQaApprovalRequired: boolean;
  warnings: string[];
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
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-blue-100 text-blue-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[level || 'Low'] || map.Low;
}

export function computeImpactAutoRules(input: Partial<ImpactFormInput>, record?: DeviationRecord): ImpactAutoRules {
  const warnings: string[] = [];
  const capaRequired = computeCapaRequired({
    product_quality_impacted: impactYes(input.product_quality_impact),
    patient_safety_impacted: impactYes(input.patient_safety_impact),
    capa_required: input.capa_required,
    criticality: record?.criticality,
    repeat_deviation: record?.repeat_deviation,
  }) || impactYes(input.product_quality_impact);

  const recallEvaluationRequired = impactYes(input.market_impact) || input.recall_evaluation_required === true;
  const notifyHeadQa = impactYes(input.patient_safety_impact) || Boolean(record?.patient_safety_impacted);
  const score = computeRiskScore(input.severity || 1, input.occurrence || 1, input.detection || 1);
  const riskLevel = computeRiskLevel(score);
  const headQaApprovalRequired = riskLevel === 'Critical' || record?.criticality === 'Critical';

  if (impactYes(input.product_quality_impact)) warnings.push('Product quality impact — CAPA is mandatory.');
  if (impactYes(input.patient_safety_impact)) warnings.push('Patient safety impact — Head QA notification required.');
  if (impactYes(input.market_impact)) warnings.push('Market impact — recall evaluation is required.');
  if (input.other_batches_impacted === 'Yes' && !input.impacted_batch_numbers?.trim()) {
    warnings.push('Other batches impacted — list impacted batch numbers.');
  }
  if (riskLevel === 'Critical') warnings.push('Critical risk level — Head QA approval required.');

  return { capaRequired, recallEvaluationRequired, notifyHeadQa, headQaApprovalRequired, warnings };
}

export function hasAnyImpactField(input: Partial<ImpactFormInput>): boolean {
  return IMPACT_CHECKLIST_FIELDS.some((f) => {
    const v = input[f.key as keyof ImpactFormInput];
    return v && v !== 'Not Applicable';
  }) || input.other_batches_impacted === 'Yes';
}

export function canViewImpactAssessment(role?: string | null): boolean {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'auditor', 'viewer', 'regulatory_affairs'].includes(r)) return true;
  return ['qc_manager', 'qc', 'production_manager', 'production', 'engineering_manager', 'engineering',
    'warehouse_manager', 'warehouse'].includes(r);
}

export function canEditImpactAssessment(role: string | null | undefined, record: DeviationRecord, actorId: string): boolean {
  if (['auditor', 'viewer'].includes(normalizeRole(role))) return false;
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(r)) return true;
  if (record.assigned_investigator === actorId) return true;
  const deptByRole: Record<string, string> = {
    production_manager: 'Production', qc_manager: 'QC', engineering_manager: 'Engineering', warehouse_manager: 'Warehouse',
  };
  return deptByRole[r] === record.department;
}

export function canReviewImpactAssessment(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role));
}

export function canApproveCriticalImpact(role?: string | null, riskLevel?: string): boolean {
  if (riskLevel !== 'Critical') return canReviewImpactAssessment(role);
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}
