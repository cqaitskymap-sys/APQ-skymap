import { normalizeRole } from '@/lib/permissions';
import { requiresHeadQaApproval } from '@/lib/change-control-types';
import type {
  CcValidationAssessment,
  CcValidationChartData,
  CcValidationDashboardMetrics,
  ChangeControlRecord,
} from '@/lib/change-control-types';

export const CC_VALIDATION_MODULE = 'Change Control Validation Assessment';

export type CcValidationActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
  email?: string;
};

export interface CcValidationFormInput {
  change_id: string;
  assessment_date: string;
  assessed_by: string;
  assessed_by_name?: string;
  department: string;
  validation_impact: boolean;
  qualification_impact: boolean;
  csv_impact: boolean;
  data_integrity_impact: boolean;
  regulatory_impact: boolean;
  revalidation_required: boolean;
  validation_category: string;
  system_type: string;
  affected_system: string;
  affected_equipment: string;
  affected_documents: string;
  affected_sops: string;
  affected_process: string;
  validation_scope: string;
  validation_justification: string;
  risk_based_rationale: string;
  validation_deliverables: string[];
  validation_owner: string;
  validation_owner_name?: string;
  target_completion_date: string;
  qa_comments?: string;
  head_qa_comments?: string;
  gamp_category?: string;
  electronic_records_impact?: boolean;
  electronic_signature_impact?: boolean;
  audit_trail_impact?: boolean;
  security_impact?: boolean;
  backup_impact?: boolean;
  disaster_recovery_impact?: boolean;
  part_11_impact?: boolean;
  annex_11_impact?: boolean;
  annex_11_review_completed?: boolean;
  csv_assessment_completed?: boolean;
  qualification_review_completed?: boolean;
  recommendations?: string;
}

export interface CcValidationQaReviewInput {
  decision: 'approved' | 'rejected';
  qa_comments: string;
  head_qa_comments?: string;
}

export function recommendValidationCategory(change: ChangeControlRecord): string {
  if (change.csv_impact || change.change_type === 'Software / CSV Change') return 'CSV Validation';
  if (change.change_category === 'Critical') return 'Full Revalidation';
  if (change.change_category === 'Major') return 'Partial Revalidation';
  if (!change.validation_impact) return 'No Validation Required';
  return 'Partial Revalidation';
}

export function generateValidationDeliverables(input: Pick<
  CcValidationFormInput,
  | 'validation_category'
  | 'csv_impact'
  | 'qualification_impact'
  | 'validation_impact'
  | 'revalidation_required'
  | 'affected_equipment'
  | 'system_type'
>): string[] {
  const items = new Set<string>();
  if (input.validation_category === 'No Validation Required') return [];
  if (input.revalidation_required || input.validation_impact) {
    items.add('Validation Report');
    items.add('RA');
  }
  if (input.csv_impact || input.validation_category === 'CSV Validation') {
    items.add('CSV Validation Plan');
    items.add('Traceability Matrix');
    items.add('URS');
    items.add('FS');
    items.add('DS');
  }
  if (input.qualification_impact || input.affected_equipment?.trim()) {
    items.add('IQ');
    items.add('OQ');
    items.add('PQ');
  }
  if (['Software', 'ERP', 'LIMS', 'QMS', 'MES', 'SCADA'].includes(input.system_type)) {
    items.add('TM');
    items.add('CSV Validation Plan');
  }
  if (input.validation_category === 'Full Revalidation') {
    ['URS', 'FS', 'DS', 'IQ', 'OQ', 'PQ', 'Validation Report'].forEach((d) => items.add(d));
  }
  items.add('SOP Revision');
  items.add('Training Record');
  return Array.from(items);
}

export function generateValidationRecommendations(
  input: CcValidationFormInput,
  change: ChangeControlRecord,
): string[] {
  const recs: string[] = [];
  if (input.csv_impact && !input.csv_assessment_completed) {
    recs.push('CSV Assessment mandatory — complete GAMP5 category and Part 11/Annex 11 review.');
  }
  if (input.data_integrity_impact && !input.annex_11_review_completed) {
    recs.push('Annex 11 review mandatory due to data integrity impact.');
  }
  if (input.affected_equipment?.trim() && !input.qualification_review_completed) {
    recs.push('IQ/OQ/PQ assessment required for affected equipment.');
  }
  if (
    (change.affected_process && input.qualification_impact)
    || (['Utility', 'Facility'].includes(input.system_type) && input.qualification_impact)
  ) {
    recs.push('Utility/process qualification review required.');
  }
  if (input.regulatory_impact) {
    recs.push('Regulatory review required before validation approval.');
  }
  if (input.revalidation_required && !input.validation_scope?.trim()) {
    recs.push('Validation plan mandatory when revalidation is required.');
  }
  if (requiresHeadQaApproval(change.change_category) || input.validation_category === 'Full Revalidation') {
    recs.push('Head QA approval required for critical validation impact.');
  }
  return recs;
}

export function validateCcValidationRules(
  input: CcValidationFormInput,
  change: ChangeControlRecord,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (input.csv_impact && !input.gamp_category) {
    errors.push('GAMP category required when CSV impact is Yes.');
  }
  if (input.data_integrity_impact && !input.annex_11_review_completed) {
    errors.push('Annex 11 review must be completed when data integrity impact is Yes.');
  }
  if (input.affected_equipment?.trim() && input.qualification_impact) {
    const hasIqOqPq = input.validation_deliverables.some((d) => ['IQ', 'OQ', 'PQ'].includes(d));
    if (!hasIqOqPq) errors.push('IQ/OQ/PQ deliverables required for equipment impact.');
  }
  if (input.revalidation_required && input.validation_category === 'No Validation Required') {
    errors.push('Validation category cannot be "No Validation Required" when revalidation is required.');
  }
  if (input.revalidation_required && !input.validation_scope?.trim()) {
    errors.push('Validation scope/plan required when revalidation is required.');
  }
  if (change.regulatory_impact && input.regulatory_impact && !input.risk_based_rationale?.trim()) {
    errors.push('Risk-based rationale required for regulatory impact changes.');
  }
  return { ok: errors.length === 0, errors };
}

export function computeValidationProgress(assessment?: CcValidationAssessment | null): number {
  if (!assessment) return 0;
  const map: Record<string, number> = {
    Draft: 15, 'Under Assessment': 45, 'QA Review': 70, Approved: 95, Rejected: 25, Closed: 100,
  };
  return map[assessment.status] ?? 0;
}

export function validationStatusColor(status?: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Assessment': 'bg-blue-100 text-blue-800',
    'QA Review': 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-emerald-100 text-emerald-800',
  };
  return map[status || 'Draft'] || map.Draft;
}

export function validationCategoryColor(category?: string): string {
  const map: Record<string, string> = {
    'No Validation Required': 'bg-slate-100 text-slate-700',
    'Partial Revalidation': 'bg-amber-100 text-amber-800',
    'Full Revalidation': 'bg-red-100 text-red-800',
    'CSV Validation': 'bg-indigo-100 text-indigo-800',
    'Prospective Validation': 'bg-blue-100 text-blue-800',
    'Concurrent Validation': 'bg-purple-100 text-purple-800',
    'Retrospective Assessment': 'bg-cyan-100 text-cyan-800',
  };
  return map[category || ''] || 'bg-slate-100 text-slate-700';
}

export function impactBadgeColor(active: boolean): string {
  return active ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
}

export function canViewCcValidation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return raw.includes('validation')
    || raw.includes('csv')
    || raw.includes('regulatory')
    || raw.includes('engineering')
    || raw.includes('production')
    || ['production_manager', 'production_executive', 'engineering_manager'].includes(r);
}

export function isCcValidationReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canCreateCcValidation(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r) || raw.includes('validation');
}

export function canEditCsvSection(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canCreateCcValidation(role) || raw.includes('csv');
}

export function requiresHeadQaValidationApproval(
  change: ChangeControlRecord,
  assessment: Pick<CcValidationAssessment, 'validation_category'>,
): boolean {
  return requiresHeadQaApproval(change.change_category)
    || assessment.validation_category === 'Full Revalidation'
    || assessment.validation_category === 'CSV Validation';
}

export function canEditQualificationSection(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canCreateCcValidation(role)
    || raw.includes('engineering')
    || ['production_manager', 'production_executive'].includes(normalizeRole(role || ''));
}

export function canEditRegulatorySection(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  return canCreateCcValidation(role) || raw === 'regulatory_affairs' || raw.includes('regulatory');
}

export function canApproveCriticalCcValidation(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canApproveCcValidation(role?: string | null, _category?: string): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function computeCcValidationDashboardMetrics(
  assessments: CcValidationAssessment[],
  changes: ChangeControlRecord[] = [],
): CcValidationDashboardMetrics {
  const active = assessments.filter((a) => !a.is_deleted);
  return {
    total: active.length,
    validationRequired: active.filter((a) => a.validation_impact || a.validation_category !== 'No Validation Required').length,
    csvAssessments: active.filter((a) => a.csv_impact || a.validation_category === 'CSV Validation').length,
    revalidationRequired: active.filter((a) => a.revalidation_required).length,
    equipmentQualificationRequired: active.filter((a) => a.qualification_impact || Boolean(a.affected_equipment?.trim())).length,
    annex11Reviews: active.filter((a) => a.data_integrity_impact || a.annex_11_impact).length,
    approved: active.filter((a) => a.status === 'Approved' || a.status === 'Closed').length,
    pendingReviews: active.filter((a) => ['Draft', 'Under Assessment', 'QA Review'].includes(a.status)).length,
  };
}

export function computeCcValidationChartData(assessments: CcValidationAssessment[]): CcValidationChartData {
  const active = assessments.filter((a) => !a.is_deleted);
  const catMap = new Map<string, number>();
  const csvMap = new Map<string, number>();
  const qualMap = new Map<string, number>();
  const revMap = new Map<string, number>();

  for (const a of active) {
    const cat = a.validation_category || 'Unknown';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
    const month = a.assessment_date?.slice(0, 7) || 'Unknown';
    if (a.csv_impact) csvMap.set(month, (csvMap.get(month) || 0) + 1);
    if (a.qualification_impact) qualMap.set(month, (qualMap.get(month) || 0) + 1);
    if (a.revalidation_required) revMap.set(month, (revMap.get(month) || 0) + 1);
  }

  const sortEntries = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));

  return {
    impactDistribution: Array.from(catMap.entries()).map(([name, count]) => ({ name, count })),
    csvImpactTrend: sortEntries(csvMap),
    qualificationTrend: sortEntries(qualMap),
    revalidationTrend: sortEntries(revMap),
  };
}

export function mapCcValidationAuditToTimeline(logs: Record<string, unknown>[]) {
  return logs
    .filter((log) => /validation|csv|annex|deliverable|qualification/i.test(String(log.actionType || log.action || '')))
    .map((log) => ({
      action: String(log.actionType || log.action || 'Activity'),
      user: String(log.changedByUserName || log.userName || 'System'),
      at: String(log.dateTime || log.timestamp || log.created_at || ''),
      detail: String(log.reason || log.actionDescription || '').slice(0, 240),
    }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

export function buildValidationAssessmentId(changeNumber: string): string {
  return `CC-VAL-${changeNumber.replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}
