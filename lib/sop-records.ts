import type { DocumentRecord, DocumentApproval } from './dms-types';
import type { SopMasterRecord, SopKpis, SopCharts, SopFilters, SopStatus } from './sop-types';
import {
  parseSopVersion, isSopReviewOverdue, isSopReviewDueSoon, SOP_WORKFLOW,
} from './sop-types';

function mapDmsStatusToSopStatus(status: string, isLatest: boolean, approvals?: DocumentApproval[]): SopStatus {
  if (!isLatest && ['effective', 'approved', 'obsolete'].includes(status)) return 'Superseded';
  if (status === 'retired') return 'Retired';
  if (status === 'archived') return 'Archived';
  if (status === 'obsolete') return 'Obsolete';
  if (status === 'draft') return 'Draft';
  if (status === 'returned_for_correction') return 'Under Author Review';
  if (status === 'under_review' || status === 'pending_approval') {
    if (approvals?.length) {
      const pending = [...approvals].reverse().find((a) => a.decision === 'pending');
      if (pending?.stage === 'department_review') return 'Department Review';
      if (pending?.stage === 'qa_review') return 'QA Review';
      if (pending?.stage === 'head_qa_approval') return 'Pending Approval';
    }
    return 'Department Review';
  }
  if (status === 'approved') {
    const today = new Date().toISOString().split('T')[0];
    return 'Approved';
  }
  if (status === 'effective') return 'Effective';
  return 'Draft';
}

export function mapDocumentToSop(doc: DocumentRecord, approvals?: DocumentApproval[]): SopMasterRecord {
  const meta = doc as unknown as Record<string, unknown>;
  const versionParts = parseSopVersion(doc.version || '1.0');
  const isLatest = doc.is_latest !== false;
  const status = (meta.sop_status as string) || mapDmsStatusToSopStatus(doc.status, isLatest, approvals);

  return {
    id: doc.id,
    sop_id: (meta.sop_id as string) || `SOP-${doc.document_number}`,
    sop_number: doc.document_number,
    sop_title: doc.document_title,
    short_title: (meta.short_title as string) || doc.document_title.slice(0, 60),
    department: doc.department,
    business_unit: (meta.business_unit as string) || '',
    site: (meta.site as string) || '',
    area: (meta.area as string) || '',
    category: (meta.category as string) || (meta.document_category as string) || 'Quality Assurance',
    process: (meta.process as string) || '',
    sub_process: (meta.sub_process as string) || '',
    owner: (meta.owner as string) || doc.prepared_by || doc.created_by,
    owner_name: (meta.owner_name as string) || doc.prepared_by_name || doc.created_by_name,
    author: doc.prepared_by || doc.created_by,
    author_name: doc.prepared_by_name || doc.created_by_name,
    reviewer: doc.reviewed_by || '',
    reviewer_name: doc.reviewed_by_name || '',
    approver: doc.approved_by || '',
    approver_name: doc.approved_by_name || '',
    version: doc.version || '1.0',
    major_version: (meta.major_version as number) ?? versionParts.major,
    minor_version: (meta.minor_version as number) ?? versionParts.minor,
    status,
    current_workflow: doc.status,
    effective_date: doc.effective_date,
    review_due_date: doc.next_review_date,
    superseded_date: (meta.superseded_date as string) || null,
    archive_date: (meta.archive_date as string) || null,
    retention_period: (meta.retention_period as string) || null,
    training_required: doc.training_required ?? false,
    training_before_effective: (meta.training_before_effective as boolean) ?? false,
    electronic_signature_required: (meta.electronic_signature_required as boolean) ?? true,
    linked_change_control: doc.change_control_ref || doc.change_control_id || null,
    linked_risk_assessment: (meta.linked_risk_assessment as string) || null,
    linked_capa: (meta.linked_capa as string) || null,
    linked_validation: (meta.linked_validation as string) || null,
    linked_forms: (meta.linked_forms as string[]) || [],
    linked_work_instructions: (meta.linked_work_instructions as string[]) || [],
    linked_templates: (meta.linked_templates as string[]) || [],
    keywords: (meta.keywords as string[]) || [],
    confidentiality: (meta.confidentiality as string) || 'Internal',
    language: (meta.language as string) || 'English',
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

export function mapSopMasterRaw(raw: Record<string, unknown> & { id: string }): SopMasterRecord {
  const versionParts = parseSopVersion((raw.version as string) || '1.0');
  return {
    id: raw.id,
    sop_id: (raw.sop_id as string) || `SOP-${raw.sop_number}`,
    sop_number: (raw.sop_number as string) || '',
    sop_title: (raw.sop_title as string) || '',
    short_title: (raw.short_title as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    area: (raw.area as string) || '',
    category: (raw.category as string) || '',
    process: (raw.process as string) || '',
    sub_process: (raw.sub_process as string) || '',
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
    current_workflow: (raw.current_workflow as string) || 'draft',
    effective_date: (raw.effective_date as string) || null,
    review_due_date: (raw.review_due_date as string) || null,
    superseded_date: (raw.superseded_date as string) || null,
    archive_date: (raw.archive_date as string) || null,
    retention_period: (raw.retention_period as string) || null,
    training_required: Boolean(raw.training_required),
    training_before_effective: Boolean(raw.training_before_effective),
    electronic_signature_required: Boolean(raw.electronic_signature_required ?? true),
    linked_change_control: (raw.linked_change_control as string) || null,
    linked_risk_assessment: (raw.linked_risk_assessment as string) || null,
    linked_capa: (raw.linked_capa as string) || null,
    linked_validation: (raw.linked_validation as string) || null,
    linked_forms: (raw.linked_forms as string[]) || [],
    linked_work_instructions: (raw.linked_work_instructions as string[]) || [],
    linked_templates: (raw.linked_templates as string[]) || [],
    keywords: (raw.keywords as string[]) || [],
    confidentiality: (raw.confidentiality as string) || 'Internal',
    language: (raw.language as string) || 'English',
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

export function emptySopKpis(): SopKpis {
  return {
    totalSops: 0, effectiveSops: 0, draftSops: 0, pendingReview: 0,
    pendingApproval: 0, trainingPending: 0, reviewDue: 0, overdueReviews: 0,
    archivedSops: 0, obsoleteSops: 0,
  };
}

export function emptySopCharts(): SopCharts {
  return {
    statusDistribution: [], departmentDistribution: [], reviewDueTrend: [],
    versionTrend: [], trainingCompletionTrend: [], approvalTimeline: [],
    periodicReviewTrend: [], revisionTrend: [],
  };
}

const REVIEW_STATUSES = ['Under Author Review', 'Department Review', 'QA Review', 'Periodic Review'];

export function computeSopKpis(records: SopMasterRecord[]): SopKpis {
  return {
    totalSops: records.length,
    effectiveSops: records.filter((r) => r.status === 'Effective').length,
    draftSops: records.filter((r) => r.status === 'Draft').length,
    pendingReview: records.filter((r) => REVIEW_STATUSES.includes(r.status)).length,
    pendingApproval: records.filter((r) => r.status === 'Pending Approval').length,
    trainingPending: records.filter((r) => r.training_pending || (r.training_required && r.status === 'Approved')).length,
    reviewDue: records.filter((r) => r.status === 'Periodic Review' || isSopReviewDueSoon(r.review_due_date, 30)).length,
    overdueReviews: records.filter((r) => isSopReviewOverdue(r.review_due_date)).length,
    archivedSops: records.filter((r) => r.status === 'Archived').length,
    obsoleteSops: records.filter((r) => r.status === 'Obsolete' || r.status === 'Superseded').length,
  };
}

export function computeSopCharts(records: SopMasterRecord[]): SopCharts {
  const statusCount: Record<string, number> = {};
  const deptCount: Record<string, number> = {};
  const reviewDueTrend: Record<string, number> = {};
  const versionTrend: Record<string, number> = {};
  const trainingTrend: Record<string, { total: number; sum: number }> = {};
  const approvalTimeline: Record<string, number> = {};
  const periodicTrend: Record<string, number> = {};
  const revisionTrend: Record<string, number> = {};

  for (const r of records) {
    statusCount[r.status] = (statusCount[r.status] || 0) + 1;
    deptCount[r.department] = (deptCount[r.department] || 0) + 1;
    if (r.review_due_date) {
      const m = r.review_due_date.slice(0, 7);
      reviewDueTrend[m] = (reviewDueTrend[m] || 0) + 1;
    }
    if (parseSopVersion(r.version).major > 1 || parseSopVersion(r.version).minor > 0) {
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
    if (r.status === 'Pending Approval' || r.status === 'Approved') {
      const m = r.updated_at.slice(0, 7);
      approvalTimeline[m] = (approvalTimeline[m] || 0) + 1;
    }
    if (r.status === 'Periodic Review') {
      const m = r.updated_at.slice(0, 7);
      periodicTrend[m] = (periodicTrend[m] || 0) + 1;
    }
  }

  const toPie = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const toMonth = (obj: Record<string, number>) =>
    Object.entries(obj).sort().map(([month, count]) => ({ month, count }));

  return {
    statusDistribution: toPie(statusCount),
    departmentDistribution: toPie(deptCount),
    reviewDueTrend: toMonth(reviewDueTrend),
    versionTrend: toMonth(versionTrend),
    trainingCompletionTrend: Object.entries(trainingTrend).sort().map(([month, v]) => ({
      month, pct: v.total ? Math.round(v.sum / v.total) : 0,
    })),
    approvalTimeline: toMonth(approvalTimeline),
    periodicReviewTrend: toMonth(periodicTrend),
    revisionTrend: toMonth(revisionTrend),
  };
}

export function filterSopRecords(records: SopMasterRecord[], filters?: SopFilters): SopMasterRecord[] {
  let rows = [...records];
  if (filters?.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters?.department) rows = rows.filter((r) => r.department === filters.department);
  if (filters?.category) rows = rows.filter((r) => r.category === filters.category);
  if (filters?.owner) rows = rows.filter((r) => r.owner_name === filters.owner || r.owner === filters.owner);
  if (filters?.review_due) rows = rows.filter((r) => r.status === 'Periodic Review' || isSopReviewDueSoon(r.review_due_date, 30));
  if (filters?.overdue) rows = rows.filter((r) => isSopReviewOverdue(r.review_due_date));
  if (filters?.training_pending) rows = rows.filter((r) => r.training_pending);
  if (filters?.favorites) rows = rows.filter((r) => r.is_favorite);
  if (filters?.date_from || filters?.date_to) {
    rows = rows.filter((r) => {
      const d = r.created_at.split('T')[0];
      if (filters.date_from && d < filters.date_from) return false;
      if (filters.date_to && d > filters.date_to) return false;
      return true;
    });
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    rows = rows.filter((r) =>
      r.sop_number.toLowerCase().includes(q) || r.sop_title.toLowerCase().includes(q)
      || r.short_title.toLowerCase().includes(q) || r.owner_name.toLowerCase().includes(q)
      || r.department.toLowerCase().includes(q) || r.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }
  return rows;
}

export function getLatestSops(records: SopMasterRecord[]): SopMasterRecord[] {
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
}

export function getPendingSopReviews(records: SopMasterRecord[]): SopMasterRecord[] {
  return records.filter((r) => REVIEW_STATUSES.includes(r.status));
}

export function getPendingSopApprovals(records: SopMasterRecord[]): SopMasterRecord[] {
  return records.filter((r) => r.status === 'Pending Approval');
}

export function getUpcomingEffectiveSops(records: SopMasterRecord[]): SopMasterRecord[] {
  const today = new Date().toISOString().split('T')[0];
  return records.filter((r) =>
    r.status === 'Scheduled' || (r.status === 'Approved' && r.effective_date && r.effective_date >= today),
  );
}

export function getTrainingPendingSops(records: SopMasterRecord[]): SopMasterRecord[] {
  return records.filter((r) => r.training_pending || (r.training_required && r.training_completion_pct < 100));
}

export function getOverdueSopReviews(records: SopMasterRecord[]): SopMasterRecord[] {
  return records.filter((r) => isSopReviewOverdue(r.review_due_date));
}

export function getRecentSopRevisions(records: SopMasterRecord[]): SopMasterRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return records.filter((r) => new Date(r.updated_at) >= cutoff && r.version !== '1.0')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export const SOP_KPI_FILTER_MAP: Record<string, Partial<SopFilters>> = {
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

export function buildSopWorkflowTimeline(currentStatus: string) {
  const idx = SOP_WORKFLOW.indexOf(currentStatus as typeof SOP_WORKFLOW[number]);
  return SOP_WORKFLOW.map((stage, i) => ({
    stage, completed: i < idx, current: stage === currentStatus,
  }));
}
