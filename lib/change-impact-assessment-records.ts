import type {
  DocumentChangeImpactRecord, ChangeImpactKpis, ChangeImpactCharts, ChangeImpactFilters,
  ImpactDependency,
} from './change-impact-assessment-types';
import { CIA_MODULE_TAG } from './change-impact-assessment-types';

function rating(val: unknown): string {
  if (!val) return 'None';
  const s = String(val);
  if (['None', 'Low', 'Medium', 'High', 'Critical'].includes(s)) return s;
  if (s === 'Yes' || s === 'High') return 'High';
  if (s === 'No' || s === 'Not Applicable') return 'None';
  return 'Medium';
}

export function mapChangeImpactRaw(raw: Record<string, unknown> & { id: string }): DocumentChangeImpactRecord {
  return {
    id: raw.id,
    impact_assessment_id: (raw.impact_assessment_id as string) || raw.id,
    assessment_number: (raw.assessment_number as string) || (raw.impact_assessment_id as string) || raw.id,
    module: (raw.module as string) || '',
    related_change_control_id: (raw.related_change_control_id as string) || (raw.change_id as string) || null,
    related_document_id: (raw.related_document_id as string) || (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || (raw.change_control_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_version: (raw.document_version as string) || (raw.version as string) || '',
    assessment_type: (raw.assessment_type as string) || 'Document Revision',
    assessment_reason: (raw.assessment_reason as string) || (raw.impact_description as string) || '',
    change_summary: (raw.change_summary as string) || '',
    business_justification: (raw.business_justification as string) || (raw.scientific_justification as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    product_impact: rating(raw.product_impact),
    process_impact: rating(raw.process_impact),
    equipment_impact: rating(raw.equipment_impact),
    facility_impact: rating(raw.facility_impact),
    validation_impact: rating(raw.validation_impact),
    qualification_impact: rating(raw.qualification_impact),
    csv_impact: rating(raw.csv_impact || raw.computerized_system_impact),
    training_impact: rating(raw.training_impact),
    regulatory_impact: rating(raw.regulatory_impact),
    customer_impact: rating(raw.customer_impact || raw.market_impact),
    supplier_impact: rating(raw.supplier_impact),
    material_impact: rating(raw.material_impact),
    risk_assessment_required: Boolean(raw.risk_assessment_required),
    capa_required: Boolean(raw.capa_required),
    revalidation_required: Boolean(raw.revalidation_required || raw.validation_required),
    retraining_required: Boolean(raw.retraining_required || raw.training_required),
    regulatory_notification_required: Boolean(raw.regulatory_notification_required || raw.regulatory_submission_required),
    effective_date_impact: (raw.effective_date_impact as string) || null,
    priority: (raw.priority as string) || 'Normal',
    overall_impact_rating: (raw.overall_impact_rating as string) || (raw.impact_severity as string) || 'Low',
    assessment_status: mapStatus(raw.assessment_status || raw.status),
    reviewer_id: (raw.reviewer_id as string) || (raw.assessed_by as string) || '',
    reviewer_name: (raw.reviewer_name as string) || (raw.assessed_by_name as string) || '',
    approver_id: (raw.approver_id as string) || '',
    approver_name: (raw.approver_name as string) || '',
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    linked_risk_assessment_id: (raw.linked_risk_assessment_id as string) || null,
    linked_capa_id: (raw.linked_capa_id as string) || null,
    linked_validation_id: (raw.linked_validation_id as string) || null,
    dependencies: Array.isArray(raw.dependencies) ? raw.dependencies as ImpactDependency[] : [],
    affected_departments: Array.isArray(raw.affected_departments) ? raw.affected_departments as string[] : [],
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

function mapStatus(s: unknown): string {
  const v = String(s || 'Draft');
  const map: Record<string, string> = {
    'Under Review': 'In Review', 'QA Review': 'Pending Approval', Approved: 'Approved',
    draft: 'Draft', approved: 'Approved', rejected: 'Rejected',
  };
  return map[v] || v;
}

export function isDmsChangeImpactRecord(r: DocumentChangeImpactRecord): boolean {
  return r.module === CIA_MODULE_TAG;
}

export function emptyChangeImpactKpis(): ChangeImpactKpis {
  return {
    openAssessments: 0, approvedAssessments: 0, criticalImpacts: 0, pendingReviews: 0,
    pendingApprovals: 0, validationRequired: 0, retrainingRequired: 0, capasGenerated: 0,
  };
}

export function emptyChangeImpactCharts(): ChangeImpactCharts {
  return {
    impactRatingDistribution: [], departmentImpact: [], assessmentTrend: [],
    riskTrend: [], validationImpactTrend: [], trainingImpactTrend: [],
  };
}

export function computeChangeImpactKpis(records: DocumentChangeImpactRecord[]): ChangeImpactKpis {
  return {
    openAssessments: records.filter((r) => ['Draft', 'In Review', 'Pending Approval'].includes(r.assessment_status)).length,
    approvedAssessments: records.filter((r) => ['Approved', 'Closed'].includes(r.assessment_status)).length,
    criticalImpacts: records.filter((r) => r.overall_impact_rating === 'Critical').length,
    pendingReviews: records.filter((r) => r.assessment_status === 'In Review').length,
    pendingApprovals: records.filter((r) => r.assessment_status === 'Pending Approval').length,
    validationRequired: records.filter((r) => r.revalidation_required || ['High', 'Critical'].includes(r.validation_impact)).length,
    retrainingRequired: records.filter((r) => r.retraining_required || ['High', 'Critical'].includes(r.training_impact)).length,
    capasGenerated: records.filter((r) => r.linked_capa_id).length,
  };
}

export function computeChangeImpactCharts(records: DocumentChangeImpactRecord[]): ChangeImpactCharts {
  const byRating = new Map<string, number>();
  const byDept = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const riskByMonth = new Map<string, number>();
  const valByMonth = new Map<string, number>();
  const trainByMonth = new Map<string, number>();

  for (const r of records) {
    byRating.set(r.overall_impact_rating, (byRating.get(r.overall_impact_rating) || 0) + 1);
    byDept.set(r.department || 'Unknown', (byDept.get(r.department || 'Unknown') || 0) + 1);
    if (r.created_at) {
      const m = r.created_at.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
      if (r.risk_assessment_required) riskByMonth.set(m, (riskByMonth.get(m) || 0) + 1);
      if (r.revalidation_required) valByMonth.set(m, (valByMonth.get(m) || 0) + 1);
      if (r.retraining_required) trainByMonth.set(m, (trainByMonth.get(m) || 0) + 1);
    }
  }

  const sortMonths = (entries: [string, number][]) =>
    entries.sort(([a], [b]) => a.localeCompare(b)).slice(-12);

  return {
    impactRatingDistribution: Array.from(byRating.entries()).map(([name, value]) => ({ name, value })),
    departmentImpact: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })),
    assessmentTrend: sortMonths(Array.from(byMonth.entries())).map(([month, count]) => ({ month, count })),
    riskTrend: sortMonths(Array.from(riskByMonth.entries())).map(([month, count]) => ({ month, count })),
    validationImpactTrend: sortMonths(Array.from(valByMonth.entries())).map(([month, count]) => ({ month, count })),
    trainingImpactTrend: sortMonths(Array.from(trainByMonth.entries())).map(([month, count]) => ({ month, count })),
  };
}

export function filterChangeImpactRecords(records: DocumentChangeImpactRecord[], filters: ChangeImpactFilters): DocumentChangeImpactRecord[] {
  let result = [...records];
  if (filters.status) result = result.filter((r) => r.assessment_status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.assessment_type) result = result.filter((r) => r.assessment_type === filters.assessment_type);
  if (filters.impact_rating) result = result.filter((r) => r.overall_impact_rating === filters.impact_rating);
  if (filters.priority) result = result.filter((r) => r.priority === filters.priority);
  if (filters.open) result = result.filter((r) => ['Draft', 'In Review', 'Pending Approval'].includes(r.assessment_status));
  if (filters.critical) result = result.filter((r) => r.overall_impact_rating === 'Critical');
  if (filters.pending_approval) result = result.filter((r) => r.assessment_status === 'Pending Approval');
  if (filters.validation) result = result.filter((r) => r.revalidation_required);
  if (filters.retraining) result = result.filter((r) => r.retraining_required);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.assessment_number.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getOpenAssessments(records: DocumentChangeImpactRecord[]) {
  return records.filter((r) => ['Draft', 'In Review', 'Pending Approval'].includes(r.assessment_status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getCriticalAssessments(records: DocumentChangeImpactRecord[]) {
  return records.filter((r) => r.overall_impact_rating === 'Critical' && r.assessment_status !== 'Closed');
}

export function getPendingApprovals(records: DocumentChangeImpactRecord[]) {
  return records.filter((r) => r.assessment_status === 'Pending Approval');
}

export function getRecentAssessments(records: DocumentChangeImpactRecord[]) {
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
}

export function getValidationRequired(records: DocumentChangeImpactRecord[]) {
  return records.filter((r) => r.revalidation_required && !['Closed', 'Cancelled'].includes(r.assessment_status));
}

export function getRetrainingQueue(records: DocumentChangeImpactRecord[]) {
  return records.filter((r) => r.retraining_required && r.assessment_status === 'Approved');
}

export const CIA_KPI_FILTER_MAP: Record<string, Partial<ChangeImpactFilters>> = {
  open: { open: true },
  approved: { status: 'Approved' },
  critical: { critical: true },
  review: { status: 'In Review' },
  approval: { pending_approval: true },
  validation: { validation: true },
  retraining: { retraining: true },
};

export function computeOverallImpact(record: Pick<DocumentChangeImpactRecord,
  'product_impact' | 'process_impact' | 'equipment_impact' | 'validation_impact' | 'training_impact' | 'regulatory_impact'
>): string {
  const weights: Record<string, number> = { None: 0, Low: 1, Medium: 2, High: 3, Critical: 4 };
  const scores = [
    record.product_impact, record.process_impact, record.equipment_impact,
    record.validation_impact, record.training_impact, record.regulatory_impact,
  ].map((r) => weights[r] ?? 1);
  const max = Math.max(...scores, 0);
  return Object.entries(weights).find(([, v]) => v === max)?.[0] || 'Low';
}
