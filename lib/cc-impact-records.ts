import { normalizeRole } from '@/lib/permissions';
import type {
  CcImpactDashboardMetrics,
  CcImpactMatrixCell,
  ChangeControlRecord,
  ChangeImpactAssessment,
} from '@/lib/change-control-types';

export const CC_IMPACT_MODULE = 'Change Impact Assessment';

export type CcImpactActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CcImpactFormInput {
  change_id: string;
  assessment_date: string;
  assessed_by: string;
  assessed_by_name?: string;
  department: string;
  product_impact: string;
  process_impact: string;
  equipment_impact: string;
  utility_impact: string;
  facility_impact: string;
  document_impact: string;
  training_impact: string;
  validation_impact: string;
  csv_impact: string;
  regulatory_impact: string;
  quality_impact: string;
  patient_safety_impact: string;
  stability_impact: string;
  market_impact: string;
  business_impact: string;
  supplier_impact: string;
  environmental_impact: string;
  data_integrity_impact: string;
  impact_description: string;
  scientific_justification: string;
  recommended_actions?: string;
  impact_severity: string;
  impact_likelihood: string;
  overall_impact_rating: string;
  qa_comments?: string;
}

export interface CcImpactQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
  head_qa_comments?: string;
}

const SEVERITY_SCORE: Record<string, number> = { Negligible: 1, Minor: 2, Major: 3, Critical: 4 };
const LIKELIHOOD_SCORE: Record<string, number> = { Rare: 1, Possible: 2, Likely: 3, 'Almost Certain': 4 };

export function isImpactYes(value?: string | null): boolean {
  return (value || '').trim() === 'Yes';
}

export function computeOverallImpactRating(severity?: string, likelihood?: string): string {
  const s = SEVERITY_SCORE[severity || ''] || 1;
  const l = LIKELIHOOD_SCORE[likelihood || ''] || 1;
  const score = s * l;
  if (score >= 12) return 'Critical';
  if (score >= 8) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

export function buildImpactMatrix(assessments: ChangeImpactAssessment[]): CcImpactMatrixCell[] {
  const cells = new Map<string, CcImpactMatrixCell>();
  for (const a of assessments.filter((x) => !x.is_deleted && x.impact_severity && x.impact_likelihood)) {
    const key = `${a.impact_severity}-${a.impact_likelihood}`;
    const rating = a.overall_impact_rating || computeOverallImpactRating(a.impact_severity, a.impact_likelihood);
    const existing = cells.get(key);
    if (existing) existing.count += 1;
    else cells.set(key, { severity: a.impact_severity!, likelihood: a.impact_likelihood!, count: 1, rating });
  }
  return Array.from(cells.values());
}

export function deriveImpactFlags(input: Pick<
  CcImpactFormInput,
  | 'validation_impact' | 'csv_impact' | 'training_impact' | 'regulatory_impact'
  | 'patient_safety_impact' | 'data_integrity_impact' | 'document_impact'
>) {
  return {
    validation_required: isImpactYes(input.validation_impact),
    training_required: isImpactYes(input.training_impact),
    document_revision_required: isImpactYes(input.document_impact),
    regulatory_submission_required: isImpactYes(input.regulatory_impact),
    capa_required: false,
  };
}

export function generateImpactRecommendations(
  input: CcImpactFormInput,
  change: ChangeControlRecord,
): string[] {
  const recs: string[] = [];
  if (isImpactYes(input.validation_impact)) recs.push('Validation assessment mandatory — initiate change validation workflow.');
  if (isImpactYes(input.csv_impact)) recs.push('CSV assessment mandatory — complete GAMP5 and data integrity review.');
  if (isImpactYes(input.data_integrity_impact)) recs.push('CSV/Data Integrity review mandatory for data integrity impact.');
  if (isImpactYes(input.training_impact)) recs.push('Training plan mandatory — update training matrix and assign sessions.');
  if (isImpactYes(input.regulatory_impact)) recs.push('Regulatory review mandatory before implementation approval.');
  if (isImpactYes(input.patient_safety_impact)) recs.push('Head QA review mandatory due to patient safety impact.');
  if (isImpactYes(input.quality_impact) || isImpactYes(input.product_impact)) recs.push('QC review recommended for product/quality specification impact.');
  if (isImpactYes(input.process_impact)) recs.push('Production review recommended for process impact.');
  if (isImpactYes(input.equipment_impact) || isImpactYes(input.utility_impact)) recs.push('Engineering review recommended for equipment/utility impact.');
  if (input.overall_impact_rating === 'Critical') recs.push('Head QA approval mandatory for Critical overall impact rating.');
  if (change.capa_required) recs.push('Link or create CAPA record before closure.');
  return recs;
}

export function validateImpactRules(input: CcImpactFormInput): string[] {
  const errors: string[] = [];
  if (!input.impact_description?.trim()) errors.push('Impact description is required.');
  if (!input.scientific_justification?.trim()) errors.push('Scientific justification is required.');
  if (!input.overall_impact_rating) errors.push('Overall impact rating is required.');
  if (isImpactYes(input.validation_impact) && !input.recommended_actions?.trim()) {
    errors.push('Recommended actions required when validation impact is Yes.');
  }
  return errors;
}

export function impactRatingColor(rating?: string): string {
  const map: Record<string, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[rating || ''] || 'bg-slate-100 text-slate-700';
}

export function impactStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Review': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };
  return map[status || ''] || map.Draft;
}

export function impactOptionColor(value?: string): string {
  if (value === 'Yes') return 'bg-red-100 text-red-800';
  if (value === 'Under Evaluation') return 'bg-amber-100 text-amber-800';
  if (value === 'Not Applicable') return 'bg-slate-100 text-slate-600';
  return 'bg-green-100 text-green-800';
}

export function computeCcImpactDashboardMetrics(assessments: ChangeImpactAssessment[]): CcImpactDashboardMetrics {
  const active = assessments.filter((a) => !a.is_deleted);
  return {
    totalAssessments: active.length,
    pendingReview: active.filter((a) => ['Under Review', 'QA Review', 'Draft'].includes(a.status || 'Draft')).length,
    approvedAssessments: active.filter((a) => a.status === 'Approved').length,
    criticalImpactChanges: active.filter((a) => a.overall_impact_rating === 'Critical').length,
    validationImpactChanges: active.filter((a) => isImpactYes(a.validation_impact)).length,
    csvImpactChanges: active.filter((a) => isImpactYes(a.csv_impact) || isImpactYes(a.computerized_system_impact)).length,
    trainingImpactChanges: active.filter((a) => isImpactYes(a.training_impact)).length,
    regulatoryImpactChanges: active.filter((a) => isImpactYes(a.regulatory_impact)).length,
  };
}

export function buildImpactAssessmentId(changeNumber: string): string {
  return `CC-IA-${changeNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

export function canViewCcImpact(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return raw.includes('csv') || raw.includes('regulatory')
    || ['production_manager', 'production', 'qc_manager', 'qc', 'engineering_manager', 'engineering'].includes(r);
}

export function isCcImpactReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canManageCcImpact(role?: string | null, ownerId?: string, userId?: string): boolean {
  if (isCcImpactReadOnly(role)) return false;
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  return userId === ownerId;
}

export function canApproveCcImpact(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canApproveCriticalCcImpact(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function mapCcImpactAuditToTimeline(logs: Record<string, unknown>[]) {
  return logs
    .filter((log) => /impact|recommendation|qa review|assessment/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.changedByUserName || log.userName || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
