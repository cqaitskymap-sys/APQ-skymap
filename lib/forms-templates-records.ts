import type { DocumentRecord, DocumentApproval } from './dms-types';
import type { FormTemplateRecord, FormKpis, FormCharts, FormFilters, FormStatus } from './forms-templates-types';
import { parseFormVersion, isFormReviewOverdue, isFormReviewDueSoon, FORM_WORKFLOW } from './forms-templates-types';

function mapDmsToFormStatus(status: string, isLatest: boolean, approvals?: DocumentApproval[]): FormStatus {
  if (!isLatest && ['effective', 'approved', 'obsolete'].includes(status)) return 'Superseded';
  if (status === 'retired') return 'Retired';
  if (status === 'archived') return 'Archived';
  if (status === 'obsolete') return 'Obsolete';
  if (status === 'draft') return 'Draft';
  if (status === 'returned_for_correction') return 'Author Review';
  if (status === 'under_review' || status === 'pending_approval') {
    if (approvals?.length) {
      const pending = [...approvals].reverse().find((a) => a.decision === 'pending');
      if (pending?.stage === 'department_review') return 'Department Review';
      if (pending?.stage === 'qa_review') return 'QA Review';
      if (pending?.stage === 'head_qa_approval') return 'Pending Approval';
    }
    return 'Department Review';
  }
  if (status === 'approved') return 'Approved';
  if (status === 'effective') return 'Effective';
  return 'Draft';
}

export function mapDocumentToForm(doc: DocumentRecord, approvals?: DocumentApproval[]): FormTemplateRecord {
  const meta = doc as unknown as Record<string, unknown>;
  const vp = parseFormVersion(doc.version || '1.0');
  const isLatest = doc.is_latest !== false;
  return {
    id: doc.id,
    form_id: (meta.form_id as string) || `FRM-${doc.document_number}`,
    form_number: doc.document_number,
    form_title: doc.document_title,
    short_title: (meta.short_title as string) || doc.document_title.slice(0, 60),
    form_type: (meta.form_type as string) || doc.document_type || 'Form',
    category: (meta.category as string) || 'Production',
    department: doc.department,
    business_unit: (meta.business_unit as string) || '',
    site: (meta.site as string) || '',
    owner: (meta.owner as string) || doc.prepared_by || doc.created_by,
    owner_name: (meta.owner_name as string) || doc.prepared_by_name || doc.created_by_name,
    author: doc.prepared_by || doc.created_by,
    author_name: doc.prepared_by_name || doc.created_by_name,
    reviewer: doc.reviewed_by || '',
    reviewer_name: doc.reviewed_by_name || '',
    approver: doc.approved_by || '',
    approver_name: (meta.approver_name as string) || doc.approved_by_name || '',
    related_sop: (meta.related_sop as string) || '',
    related_sop_id: (meta.related_sop_id as string) || null,
    related_wi: (meta.related_wi as string) || '',
    related_wi_id: (meta.related_wi_id as string) || null,
    linked_change_control: (meta.linked_change_control as string) || doc.change_control_ref || null,
    version: doc.version || '1.0',
    major_version: (meta.major_version as number) ?? vp.major,
    minor_version: (meta.minor_version as number) ?? vp.minor,
    status: (meta.form_status as string) || mapDmsToFormStatus(doc.status, isLatest, approvals),
    workflow_status: doc.status,
    effective_date: doc.effective_date,
    review_due_date: doc.next_review_date,
    superseded_date: (meta.superseded_date as string) || null,
    archive_date: (meta.archive_date as string) || null,
    retention_period: (meta.retention_period as string) || null,
    training_required: doc.training_required ?? false,
    electronic_signature_required: (meta.electronic_signature_required as boolean) ?? true,
    attachment_url: (meta.attachment_url as string) || null,
    keywords: (meta.keywords as string[]) || [],
    language: (meta.language as string) || 'English',
    confidentiality: (meta.confidentiality as string) || 'Internal',
    document_id: doc.id,
    is_latest: isLatest,
    is_favorite: Boolean(meta.is_favorite),
    training_pending: Boolean(meta.training_pending),
    training_completion_pct: (meta.training_completion_pct as number) ?? 0,
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    updated_by: doc.updated_by,
    updated_by_name: doc.updated_by_name,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export function mapFormMasterRaw(raw: Record<string, unknown> & { id: string }): FormTemplateRecord {
  const vp = parseFormVersion((raw.version as string) || '1.0');
  return {
    id: raw.id,
    form_id: (raw.form_id as string) || `FRM-${raw.form_number}`,
    form_number: (raw.form_number as string) || '',
    form_title: (raw.form_title as string) || '',
    short_title: (raw.short_title as string) || '',
    form_type: (raw.form_type as string) || 'Form',
    category: (raw.category as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    owner: (raw.owner as string) || '',
    owner_name: (raw.owner_name as string) || '',
    author: (raw.author as string) || '',
    author_name: (raw.author_name as string) || '',
    reviewer: (raw.reviewer as string) || '',
    reviewer_name: (raw.reviewer_name as string) || '',
    approver: (raw.approver as string) || '',
    approver_name: (raw.approver_name as string) || '',
    related_sop: (raw.related_sop as string) || '',
    related_sop_id: (raw.related_sop_id as string) || null,
    related_wi: (raw.related_wi as string) || '',
    related_wi_id: (raw.related_wi_id as string) || null,
    linked_change_control: (raw.linked_change_control as string) || null,
    version: (raw.version as string) || '1.0',
    major_version: (raw.major_version as number) ?? vp.major,
    minor_version: (raw.minor_version as number) ?? vp.minor,
    status: (raw.status as string) || 'Draft',
    workflow_status: (raw.workflow_status as string) || 'draft',
    effective_date: (raw.effective_date as string) || null,
    review_due_date: (raw.review_due_date as string) || null,
    superseded_date: (raw.superseded_date as string) || null,
    archive_date: (raw.archive_date as string) || null,
    retention_period: (raw.retention_period as string) || null,
    training_required: Boolean(raw.training_required),
    electronic_signature_required: Boolean(raw.electronic_signature_required ?? true),
    attachment_url: (raw.attachment_url as string) || null,
    keywords: (raw.keywords as string[]) || [],
    language: (raw.language as string) || 'English',
    confidentiality: (raw.confidentiality as string) || 'Internal',
    document_id: (raw.document_id as string) || raw.id,
    is_latest: raw.is_latest !== false,
    is_favorite: Boolean(raw.is_favorite),
    training_pending: Boolean(raw.training_pending),
    training_completion_pct: (raw.training_completion_pct as number) ?? 0,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyFormKpis(): FormKpis {
  return { totalForms: 0, effectiveForms: 0, draftForms: 0, pendingReview: 0, pendingApproval: 0, reviewDue: 0, trainingPending: 0, archivedForms: 0, obsoleteForms: 0 };
}

export function emptyFormCharts(): FormCharts {
  return { statusDistribution: [], categoryDistribution: [], departmentDistribution: [], reviewDueTrend: [], versionTrend: [], revisionTrend: [], trainingCompletionTrend: [] };
}

const REVIEW = ['Author Review', 'Department Review', 'QA Review', 'Periodic Review'];

export function computeFormKpis(records: FormTemplateRecord[]): FormKpis {
  return {
    totalForms: records.length,
    effectiveForms: records.filter((r) => r.status === 'Effective').length,
    draftForms: records.filter((r) => r.status === 'Draft').length,
    pendingReview: records.filter((r) => REVIEW.includes(r.status)).length,
    pendingApproval: records.filter((r) => r.status === 'Pending Approval').length,
    reviewDue: records.filter((r) => r.status === 'Periodic Review' || isFormReviewDueSoon(r.review_due_date, 30)).length,
    trainingPending: records.filter((r) => r.training_pending).length,
    archivedForms: records.filter((r) => r.status === 'Archived').length,
    obsoleteForms: records.filter((r) => r.status === 'Obsolete' || r.status === 'Superseded').length,
  };
}

export function computeFormCharts(records: FormTemplateRecord[]): FormCharts {
  const statusCount: Record<string, number> = {};
  const catCount: Record<string, number> = {};
  const deptCount: Record<string, number> = {};
  const reviewTrend: Record<string, number> = {};
  const versionTrend: Record<string, number> = {};
  const revisionTrend: Record<string, number> = {};
  const trainingTrend: Record<string, { total: number; sum: number }> = {};

  for (const r of records) {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    catCount[r.category] = (catCount[r.category] || 0) + 1;
    deptCount[r.department] = (deptCount[r.department] || 0) + 1;
    if (r.review_due_date) reviewTrend[r.review_due_date.slice(0, 7)] = (reviewTrend[r.review_due_date.slice(0, 7)] || 0) + 1;
    if (parseFormVersion(r.version).major > 1 || parseFormVersion(r.version).minor > 0) {
      const m = r.updated_at.slice(0, 7);
      versionTrend[m] = (versionTrend[m] || 0) + 1;
      revisionTrend[m] = (revisionTrend[m] || 0) + 1;
    }
    if (r.training_required) {
      const m = r.updated_at.slice(0, 7);
      if (!trainingTrend[m]) trainingTrend[m] = { total: 0, sum: 0 };
      trainingTrend[m].total++;
      trainingTrend[m].sum += r.training_completion_pct;
    }
  }

  const pie = (o: Record<string, number>) => Object.entries(o).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const month = (o: Record<string, number>) => Object.entries(o).sort().map(([month, count]) => ({ month, count }));

  return {
    statusDistribution: pie(statusCount),
    categoryDistribution: pie(catCount),
    departmentDistribution: pie(deptCount),
    reviewDueTrend: month(reviewTrend),
    versionTrend: month(versionTrend),
    revisionTrend: month(revisionTrend),
    trainingCompletionTrend: Object.entries(trainingTrend).sort().map(([month, v]) => ({ month, pct: v.total ? Math.round(v.sum / v.total) : 0 })),
  };
}

export function filterFormRecords(records: FormTemplateRecord[], filters?: FormFilters): FormTemplateRecord[] {
  let rows = [...records];
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters?.department) rows = rows.filter((r) => r.department === filters.department);
  if (filters?.category) rows = rows.filter((r) => r.category === filters.category);
  if (filters?.form_type) rows = rows.filter((r) => r.form_type === filters.form_type);
  if (filters?.owner) rows = rows.filter((r) => r.owner_name === filters.owner || r.owner === filters.owner);
  if (filters?.review_due) rows = rows.filter((r) => r.status === 'Periodic Review' || isFormReviewDueSoon(r.review_due_date, 30));
  if (filters?.overdue) rows = rows.filter((r) => isFormReviewOverdue(r.review_due_date));
  if (filters?.training_pending) rows = rows.filter((r) => r.training_pending);
  if (filters?.favorites) rows = rows.filter((r) => r.is_favorite);
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    rows = rows.filter((r) =>
      r.form_number.toLowerCase().includes(q) || r.form_title.toLowerCase().includes(q)
      || r.form_type.toLowerCase().includes(q) || r.related_sop.toLowerCase().includes(q)
      || r.related_wi.toLowerCase().includes(q) || r.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }
  return rows;
}

export function getRecentForms(records: FormTemplateRecord[]) { return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20); }
export function getPendingFormReviews(records: FormTemplateRecord[]) { return records.filter((r) => REVIEW.includes(r.status)); }
export function getPendingFormApprovals(records: FormTemplateRecord[]) { return records.filter((r) => r.status === 'Pending Approval'); }
export function getUpcomingEffectiveForms(records: FormTemplateRecord[]) {
  const today = new Date().toISOString().split('T')[0];
  return records.filter((r) => r.status === 'Scheduled' || (r.status === 'Approved' && r.effective_date && r.effective_date >= today));
}
export function getReviewDueForms(records: FormTemplateRecord[]) {
  return records.filter((r) => r.status === 'Periodic Review' || isFormReviewDueSoon(r.review_due_date, 30) || isFormReviewOverdue(r.review_due_date));
}
export function getTrainingPendingForms(records: FormTemplateRecord[]) { return records.filter((r) => r.training_pending); }
export function getRecentFormRevisions(records: FormTemplateRecord[]) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  return records.filter((r) => new Date(r.updated_at) >= cutoff && r.version !== '1.0').sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function getArchivedForms(records: FormTemplateRecord[]) { return records.filter((r) => r.status === 'Archived'); }

export const FORM_KPI_FILTER_MAP: Record<string, Partial<FormFilters>> = {
  effective: { status: 'Effective' }, draft: { status: 'Draft' },
  pending_review: { status: 'Department Review' }, pending_approval: { status: 'Pending Approval' },
  review_due: { review_due: true }, training_pending: { training_pending: true },
  archived: { status: 'Archived' }, obsolete: { status: 'Obsolete' },
};

export function buildFormWorkflowTimeline(currentStatus: string) {
  const idx = FORM_WORKFLOW.indexOf(currentStatus as typeof FORM_WORKFLOW[number]);
  return FORM_WORKFLOW.map((stage, i) => ({ stage, completed: i < idx, current: stage === currentStatus }));
}
