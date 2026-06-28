import type { DocumentRecord, DocumentApproval } from './dms-types';
import type { WorkInstructionRecord, WiKpis, WiCharts, WiFilters, WiStatus } from './wi-types';
import { parseWiVersion, isWiReviewOverdue, isWiReviewDueSoon, WI_WORKFLOW } from './wi-types';

function mapDmsStatusToWi(status: string, isLatest: boolean, approvals?: DocumentApproval[]): WiStatus {
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

export function mapDocumentToWi(doc: DocumentRecord, approvals?: DocumentApproval[]): WorkInstructionRecord {
  const meta = doc as unknown as Record<string, unknown>;
  const versionParts = parseWiVersion(doc.version || '1.0');
  const isLatest = doc.is_latest !== false;

  return {
    id: doc.id,
    wi_id: (meta.wi_id as string) || `WI-${doc.document_number}`,
    wi_number: doc.document_number,
    wi_title: doc.document_title,
    short_title: (meta.short_title as string) || doc.document_title.slice(0, 60),
    department: doc.department,
    business_unit: (meta.business_unit as string) || '',
    site: (meta.site as string) || '',
    area: (meta.area as string) || '',
    equipment: (meta.equipment as string) || '',
    equipment_id: (meta.equipment_id as string) || null,
    production_line: (meta.production_line as string) || '',
    production_line_id: (meta.production_line_id as string) || null,
    related_sop: (meta.related_sop as string) || '',
    related_sop_id: (meta.related_sop_id as string) || null,
    category: (meta.category as string) || 'Production',
    owner: (meta.owner as string) || doc.prepared_by || doc.created_by,
    owner_name: (meta.owner_name as string) || doc.prepared_by_name || doc.created_by_name,
    author: doc.prepared_by || doc.created_by,
    author_name: doc.prepared_by_name || doc.created_by_name,
    reviewer: doc.reviewed_by || '',
    reviewer_name: doc.reviewed_by_name || '',
    approver: doc.approved_by || '',
    approver_name: (meta.approver_name as string) || doc.approved_by_name || '',
    version: doc.version || '1.0',
    major_version: (meta.major_version as number) ?? versionParts.major,
    minor_version: (meta.minor_version as number) ?? versionParts.minor,
    status: (meta.wi_status as string) || mapDmsStatusToWi(doc.status, isLatest, approvals),
    workflow_status: doc.status,
    effective_date: doc.effective_date,
    review_due_date: doc.next_review_date,
    superseded_date: (meta.superseded_date as string) || null,
    archive_date: (meta.archive_date as string) || null,
    retention_period: (meta.retention_period as string) || null,
    training_required: doc.training_required ?? false,
    electronic_signature_required: (meta.electronic_signature_required as boolean) ?? true,
    linked_change_control: doc.change_control_ref || doc.change_control_id || null,
    linked_capa: (meta.linked_capa as string) || null,
    linked_risk_assessment: (meta.linked_risk_assessment as string) || null,
    linked_validation: (meta.linked_validation as string) || null,
    linked_forms: (meta.linked_forms as string[]) || [],
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

export function mapWiMasterRaw(raw: Record<string, unknown> & { id: string }): WorkInstructionRecord {
  const versionParts = parseWiVersion((raw.version as string) || '1.0');
  return {
    id: raw.id,
    wi_id: (raw.wi_id as string) || `WI-${raw.wi_number}`,
    wi_number: (raw.wi_number as string) || '',
    wi_title: (raw.wi_title as string) || '',
    short_title: (raw.short_title as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    area: (raw.area as string) || '',
    equipment: (raw.equipment as string) || '',
    equipment_id: (raw.equipment_id as string) || null,
    production_line: (raw.production_line as string) || '',
    production_line_id: (raw.production_line_id as string) || null,
    related_sop: (raw.related_sop as string) || '',
    related_sop_id: (raw.related_sop_id as string) || null,
    category: (raw.category as string) || '',
    owner: (raw.owner as string) || '',
    owner_name: (raw.owner_name as string) || '',
    author: (raw.author as string) || '',
    author_name: (raw.author_name as string) || '',
    reviewer: (raw.reviewer as string) || '',
    reviewer_name: (raw.reviewer_name as string) || '',
    approver: (raw.approver as string) || '',
    approver_name: (raw.approver_name as string) || '',
    version: (raw.version as string) || '1.0',
    major_version: (raw.major_version as number) ?? versionParts.major,
    minor_version: (raw.minor_version as number) ?? versionParts.minor,
    status: (raw.status as string) || 'Draft',
    workflow_status: (raw.workflow_status as string) || 'draft',
    effective_date: (raw.effective_date as string) || null,
    review_due_date: (raw.review_due_date as string) || null,
    superseded_date: (raw.superseded_date as string) || null,
    archive_date: (raw.archive_date as string) || null,
    retention_period: (raw.retention_period as string) || null,
    training_required: Boolean(raw.training_required),
    electronic_signature_required: Boolean(raw.electronic_signature_required ?? true),
    linked_change_control: (raw.linked_change_control as string) || null,
    linked_capa: (raw.linked_capa as string) || null,
    linked_risk_assessment: (raw.linked_risk_assessment as string) || null,
    linked_validation: (raw.linked_validation as string) || null,
    linked_forms: (raw.linked_forms as string[]) || [],
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

export function emptyWiKpis(): WiKpis {
  return {
    totalWis: 0, effectiveWis: 0, draftWis: 0, pendingReview: 0,
    pendingApproval: 0, trainingPending: 0, reviewDue: 0, overdueReviews: 0,
    archivedWis: 0, obsoleteWis: 0,
  };
}

export function emptyWiCharts(): WiCharts {
  return {
    statusDistribution: [], departmentDistribution: [], equipmentDistribution: [],
    reviewDueTrend: [], versionTrend: [], trainingCompletionTrend: [], revisionTrend: [],
  };
}

const REVIEW_STATUSES = ['Author Review', 'Department Review', 'QA Review', 'Periodic Review'];

export function computeWiKpis(records: WorkInstructionRecord[]): WiKpis {
  return {
    totalWis: records.length,
    effectiveWis: records.filter((r) => r.status === 'Effective').length,
    draftWis: records.filter((r) => r.status === 'Draft').length,
    pendingReview: records.filter((r) => REVIEW_STATUSES.includes(r.status)).length,
    pendingApproval: records.filter((r) => r.status === 'Pending Approval').length,
    trainingPending: records.filter((r) => r.training_pending || (r.training_required && r.status === 'Approved')).length,
    reviewDue: records.filter((r) => r.status === 'Periodic Review' || isWiReviewDueSoon(r.review_due_date, 30)).length,
    overdueReviews: records.filter((r) => isWiReviewOverdue(r.review_due_date)).length,
    archivedWis: records.filter((r) => r.status === 'Archived').length,
    obsoleteWis: records.filter((r) => r.status === 'Obsolete' || r.status === 'Superseded').length,
  };
}

export function computeWiCharts(records: WorkInstructionRecord[]): WiCharts {
  const statusCount: Record<string, number> = {};
  const deptCount: Record<string, number> = {};
  const equipCount: Record<string, number> = {};
  const reviewDueTrend: Record<string, number> = {};
  const versionTrend: Record<string, number> = {};
  const trainingTrend: Record<string, { total: number; sum: number }> = {};
  const revisionTrend: Record<string, number> = {};

  for (const r of records) {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    deptCount[r.department] = (deptCount[r.department] || 0) + 1;
    if (r.equipment) equipCount[r.equipment] = (equipCount[r.equipment] || 0) + 1;
    if (r.review_due_date) {
      const m = r.review_due_date.slice(0, 7);
      reviewDueTrend[m] = (reviewDueTrend[m] || 0) + 1;
    }
    if (parseWiVersion(r.version).major > 1 || parseWiVersion(r.version).minor > 0) {
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

  const toPie = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const toMonth = (obj: Record<string, number>) =>
    Object.entries(obj).sort().map(([month, count]) => ({ month, count }));

  return {
    statusDistribution: toPie(statusCount),
    departmentDistribution: toPie(deptCount),
    equipmentDistribution: toPie(equipCount),
    reviewDueTrend: toMonth(reviewDueTrend),
    versionTrend: toMonth(versionTrend),
    trainingCompletionTrend: Object.entries(trainingTrend).sort().map(([month, v]) => ({
      month, pct: v.total ? Math.round(v.sum / v.total) : 0,
    })),
    revisionTrend: toMonth(revisionTrend),
  };
}

export function filterWiRecords(records: WorkInstructionRecord[], filters?: WiFilters): WorkInstructionRecord[] {
  let rows = [...records];
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters?.department) rows = rows.filter((r) => r.department === filters.department);
  if (filters?.category) rows = rows.filter((r) => r.category === filters.category);
  if (filters?.equipment) rows = rows.filter((r) => r.equipment === filters.equipment);
  if (filters?.owner) rows = rows.filter((r) => r.owner_name === filters.owner || r.owner === filters.owner);
  if (filters?.review_due) rows = rows.filter((r) => r.status === 'Periodic Review' || isWiReviewDueSoon(r.review_due_date, 30));
  if (filters?.overdue) rows = rows.filter((r) => isWiReviewOverdue(r.review_due_date));
  if (filters?.training_pending) rows = rows.filter((r) => r.training_pending);
  if (filters?.favorites) rows = rows.filter((r) => r.is_favorite);
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    rows = rows.filter((r) =>
      r.wi_number.toLowerCase().includes(q) || r.wi_title.toLowerCase().includes(q)
      || r.equipment.toLowerCase().includes(q) || r.related_sop.toLowerCase().includes(q)
      || r.owner_name.toLowerCase().includes(q) || r.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }
  return rows;
}

export function getRecentWis(records: WorkInstructionRecord[]) {
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
}
export function getPendingWiReviews(records: WorkInstructionRecord[]) {
  return records.filter((r) => REVIEW_STATUSES.includes(r.status));
}
export function getPendingWiApprovals(records: WorkInstructionRecord[]) {
  return records.filter((r) => r.status === 'Pending Approval');
}
export function getUpcomingEffectiveWis(records: WorkInstructionRecord[]) {
  const today = new Date().toISOString().split('T')[0];
  return records.filter((r) => r.status === 'Scheduled' || (r.status === 'Approved' && r.effective_date && r.effective_date >= today));
}
export function getTrainingPendingWis(records: WorkInstructionRecord[]) {
  return records.filter((r) => r.training_pending || (r.training_required && r.training_completion_pct < 100));
}
export function getReviewDueWis(records: WorkInstructionRecord[]) {
  return records.filter((r) => r.status === 'Periodic Review' || isWiReviewDueSoon(r.review_due_date, 30) || isWiReviewOverdue(r.review_due_date));
}
export function getRecentWiRevisions(records: WorkInstructionRecord[]) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  return records.filter((r) => new Date(r.updated_at) >= cutoff && r.version !== '1.0')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export const WI_KPI_FILTER_MAP: Record<string, Partial<WiFilters>> = {
  effective: { status: 'Effective' },
  draft: { status: 'Draft' },
  pending_review: { status: 'Department Review' },
  pending_approval: { status: 'Pending Approval' },
  training_pending: { training_pending: true },
  review_due: { review_due: true },
  overdue: { overdue: true },
  archived: { status: 'Archived' },
  obsolete: { status: 'Obsolete' },
};

export function buildWiWorkflowTimeline(currentStatus: string) {
  const idx = WI_WORKFLOW.indexOf(currentStatus as typeof WI_WORKFLOW[number]);
  return WI_WORKFLOW.map((stage, i) => ({ stage, completed: i < idx, current: stage === currentStatus }));
}
