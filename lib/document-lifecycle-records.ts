import type { DocumentRecord, DocumentApproval } from './dms-types';
import type {
  DocumentLifecycleRecord,
  DocumentLifecycleKpis,
  DocumentLifecycleCharts,
  DocumentLifecycleFilters,
  LifecycleStage,
  LifecycleEvent,
} from './document-lifecycle-types';
import {
  determineLifecycleStage,
  parseVersion,
  isReviewOverdue,
  isReviewDueSoon,
  WORKFLOW_STAGES,
} from './document-lifecycle-types';

export function mapDocumentToLifecycle(
  doc: DocumentRecord,
  approvals?: DocumentApproval[],
): DocumentLifecycleRecord {
  const meta = doc as unknown as Record<string, unknown>;
  const versionParts = parseVersion(doc.version || '1.0');
  const stage = determineLifecycleStage(doc, approvals);

  return {
    id: doc.id,
    lifecycle_id: (meta.lifecycle_id as string) || `DLM-${doc.document_number}`,
    document_id: doc.id,
    document_number: doc.document_number,
    document_title: doc.document_title,
    current_version: doc.version || '1.0',
    major_version: (meta.major_version as number) ?? versionParts.major,
    minor_version: (meta.minor_version as number) ?? versionParts.minor,
    current_stage: stage,
    current_owner: (meta.owner as string) || doc.prepared_by || doc.created_by,
    current_owner_name: (meta.owner_name as string) || doc.prepared_by_name || doc.created_by_name,
    current_reviewer: doc.reviewed_by || '',
    current_reviewer_name: doc.reviewed_by_name || '',
    current_approver: doc.approved_by || '',
    current_approver_name: doc.approved_by_name || '',
    effective_date: doc.effective_date,
    review_due_date: doc.next_review_date,
    revision_due_date: (meta.revision_due_date as string) || null,
    archive_date: (meta.archive_date as string) || null,
    retention_period: (meta.retention_period as string) || null,
    disposal_date: (meta.disposal_date as string) || null,
    linked_change_control: doc.change_control_ref || doc.change_control_id || null,
    linked_training: (meta.linked_training as string) || null,
    linked_capa: (meta.linked_capa as string) || null,
    linked_deviation: (meta.linked_deviation as string) || null,
    linked_risk_assessment: (meta.linked_risk_assessment as string) || null,
    electronic_signature_status: (meta.electronic_signature_status as string) || 'Not Signed',
    workflow_status: doc.status,
    department: doc.department,
    document_type: doc.document_type,
    training_required: doc.training_required ?? false,
    is_latest: doc.is_latest !== false,
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    updated_by: doc.updated_by,
    updated_by_name: doc.updated_by_name,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

export function emptyLifecycleKpis(): DocumentLifecycleKpis {
  return {
    totalDocuments: 0,
    draft: 0,
    underReview: 0,
    pendingApproval: 0,
    effective: 0,
    scheduled: 0,
    reviewDue: 0,
    overdueReview: 0,
    revisionRequired: 0,
    archived: 0,
    obsolete: 0,
    retired: 0,
  };
}

export function emptyLifecycleCharts(): DocumentLifecycleCharts {
  return {
    lifecycleDistribution: [],
    reviewDueTrend: [],
    revisionTrend: [],
    documentAging: [],
    departmentLifecycle: [],
    approvalTimeline: [],
    effectiveTrend: [],
    retiredTrend: [],
  };
}

const REVIEW_STAGES: LifecycleStage[] = [
  'Author Review', 'Department Review', 'QA Review', 'Periodic Review',
];

export function computeLifecycleKpis(records: DocumentLifecycleRecord[]): DocumentLifecycleKpis {
  return {
    totalDocuments: records.length,
    draft: records.filter((r) => r.current_stage === 'Draft').length,
    underReview: records.filter((r) => REVIEW_STAGES.includes(r.current_stage)).length,
    pendingApproval: records.filter((r) => r.current_stage === 'Pending Approval').length,
    effective: records.filter((r) => r.current_stage === 'Effective').length,
    scheduled: records.filter((r) => r.current_stage === 'Scheduled').length,
    reviewDue: records.filter((r) =>
      r.current_stage === 'Periodic Review'
      || (r.current_stage === 'Effective' && isReviewDueSoon(r.review_due_date, 30)),
    ).length,
    overdueReview: records.filter((r) => isReviewOverdue(r.review_due_date)).length,
    revisionRequired: records.filter((r) => r.current_stage === 'Revision Required').length,
    archived: records.filter((r) => r.current_stage === 'Archived').length,
    obsolete: records.filter((r) => r.current_stage === 'Obsolete').length,
    retired: records.filter((r) => r.current_stage === 'Retired').length,
  };
}

export function computeLifecycleCharts(records: DocumentLifecycleRecord[]): DocumentLifecycleCharts {
  const stageCount: Record<string, number> = {};
  const deptCount: Record<string, number> = {};
  const reviewDueTrend: Record<string, number> = {};
  const revisionTrend: Record<string, number> = {};
  const approvalTimeline: Record<string, number> = {};
  const effectiveTrend: Record<string, number> = {};
  const retiredTrend: Record<string, number> = {};
  const agingBuckets: Record<string, number> = {
    '0-30 days': 0,
    '31-90 days': 0,
    '91-180 days': 0,
    '180+ days': 0,
  };

  const today = new Date();

  for (const r of records) {
    stageCount[r.current_stage] = (stageCount[r.current_stage] || 0) + 1;
    deptCount[r.department] = (deptCount[r.department] || 0) + 1;

    if (r.review_due_date) {
      const rm = r.review_due_date.slice(0, 7);
      reviewDueTrend[rm] = (reviewDueTrend[rm] || 0) + 1;
    }

    if (parseVersion(r.current_version).major > 1 || parseVersion(r.current_version).minor > 0) {
      const rm = r.updated_at.slice(0, 7);
      revisionTrend[rm] = (revisionTrend[rm] || 0) + 1;
    }

    if (r.current_stage === 'Approved' || r.current_stage === 'Pending Approval') {
      const rm = r.updated_at.slice(0, 7);
      approvalTimeline[rm] = (approvalTimeline[rm] || 0) + 1;
    }

    if (r.effective_date) {
      const em = r.effective_date.slice(0, 7);
      effectiveTrend[em] = (effectiveTrend[em] || 0) + 1;
    }

    if (r.current_stage === 'Retired') {
      const rm = r.updated_at.slice(0, 7);
      retiredTrend[rm] = (retiredTrend[rm] || 0) + 1;
    }

    const created = new Date(r.created_at);
    const ageDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 30) agingBuckets['0-30 days']++;
    else if (ageDays <= 90) agingBuckets['31-90 days']++;
    else if (ageDays <= 180) agingBuckets['91-180 days']++;
    else agingBuckets['180+ days']++;
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const toMonthChart = (obj: Record<string, number>) =>
    Object.entries(obj).sort().map(([month, count]) => ({ month, count }));

  return {
    lifecycleDistribution: toChart(stageCount),
    reviewDueTrend: toMonthChart(reviewDueTrend),
    revisionTrend: toMonthChart(revisionTrend),
    documentAging: Object.entries(agingBuckets).map(([bucket, count]) => ({ bucket, count })),
    departmentLifecycle: toChart(deptCount),
    approvalTimeline: toMonthChart(approvalTimeline),
    effectiveTrend: toMonthChart(effectiveTrend),
    retiredTrend: toMonthChart(retiredTrend),
  };
}

export function filterLifecycleRecords(
  records: DocumentLifecycleRecord[],
  filters?: DocumentLifecycleFilters,
): DocumentLifecycleRecord[] {
  let rows = [...records];

  if (filters?.stage) {
    rows = rows.filter((r) => r.current_stage === filters.stage);
  }
  if (filters?.department) {
    rows = rows.filter((r) => r.department === filters.department);
  }
  if (filters?.document_type) {
    rows = rows.filter((r) => r.document_type === filters.document_type);
  }
  if (filters?.owner) {
    rows = rows.filter((r) =>
      r.current_owner_name === filters.owner || r.current_owner === filters.owner,
    );
  }
  if (filters?.review_due) {
    rows = rows.filter((r) =>
      r.current_stage === 'Periodic Review'
      || r.current_stage === 'Revision Required'
      || isReviewDueSoon(r.review_due_date, 30),
    );
  }
  if (filters?.overdue) {
    rows = rows.filter((r) => isReviewOverdue(r.review_due_date));
  }
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
      r.document_number.toLowerCase().includes(q)
      || r.document_title.toLowerCase().includes(q)
      || r.current_owner_name.toLowerCase().includes(q)
      || r.department.toLowerCase().includes(q)
      || r.lifecycle_id.toLowerCase().includes(q),
    );
  }

  return rows;
}

export function getAwaitingReview(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  return records.filter((r) =>
    ['Author Review', 'Department Review', 'QA Review', 'Periodic Review'].includes(r.current_stage),
  );
}

export function getPendingApprovals(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  return records.filter((r) => r.current_stage === 'Pending Approval');
}

export function getUpcomingEffective(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  const today = new Date().toISOString().split('T')[0];
  return records.filter((r) =>
    r.current_stage === 'Scheduled'
    || (r.current_stage === 'Approved' && r.effective_date && r.effective_date >= today),
  );
}

export function getReviewDueDocuments(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  return records.filter((r) =>
    r.current_stage === 'Periodic Review'
    || r.current_stage === 'Revision Required'
    || isReviewDueSoon(r.review_due_date, 30),
  );
}

export function getArchivedDocuments(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  return records.filter((r) => r.current_stage === 'Archived');
}

export function getObsoleteDocuments(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  return records.filter((r) => r.current_stage === 'Obsolete' || r.current_stage === 'Superseded');
}

export function getRecentRevisions(records: DocumentLifecycleRecord[]): DocumentLifecycleRecord[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return records
    .filter((r) => new Date(r.updated_at) >= thirtyDaysAgo && r.current_version !== '1.0')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export const KPI_FILTER_MAP: Record<string, Partial<DocumentLifecycleFilters>> = {
  draft: { stage: 'Draft' },
  under_review: { stage: 'Department Review' },
  pending_approval: { stage: 'Pending Approval' },
  effective: { stage: 'Effective' },
  scheduled: { stage: 'Scheduled' },
  review_due: { review_due: true },
  overdue: { overdue: true },
  revision_required: { stage: 'Revision Required' },
  archived: { stage: 'Archived' },
  obsolete: { stage: 'Obsolete' },
  retired: { stage: 'Retired' },
};

export function buildLifecycleTimeline(
  events: LifecycleEvent[],
  currentStage: LifecycleStage,
): Array<{ stage: LifecycleStage; completed: boolean; current: boolean; date?: string }> {
  const stageIndex = WORKFLOW_STAGES.indexOf(currentStage);
  const eventMap = new Map(events.map((e) => [e.to_stage, e.created_at]));

  return WORKFLOW_STAGES.map((stage, i) => ({
    stage,
    completed: i < stageIndex || eventMap.has(stage),
    current: stage === currentStage,
    date: eventMap.get(stage),
  }));
}
