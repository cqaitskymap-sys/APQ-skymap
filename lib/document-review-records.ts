import type { DocumentReviewRecord, ReviewKpis, ReviewCharts, ReviewFilters } from './document-review-types';
import { computeSlaStatus } from './document-review-types';

export function mapReviewRaw(raw: Record<string, unknown> & { id: string }): DocumentReviewRecord {
  const dueDate = (raw.due_date as string) || '';
  const status = (raw.review_status as string) || 'Pending Review';
  return {
    id: raw.id,
    review_id: (raw.review_id as string) || raw.id,
    review_number: (raw.review_number as string) || `REV-LEGACY-${raw.id.slice(0, 6)}`,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    version: (raw.version as string) || '',
    workflow_type: (raw.workflow_type as string) || 'Standard',
    review_mode: (raw.review_mode as string) || 'Sequential',
    current_step: (raw.current_step as number) || 1,
    total_steps: (raw.total_steps as number) || 1,
    reviewer_id: (raw.reviewer_id as string) || '',
    reviewer_name: (raw.reviewer_name as string) || '',
    reviewer_role: (raw.reviewer_role as string) || '',
    department: (raw.department as string) || '',
    due_date: dueDate,
    completed_date: (raw.completed_date as string) || null,
    review_decision: (raw.review_decision as string) || null,
    review_status: status,
    review_checklist: (raw.review_checklist as DocumentReviewRecord['review_checklist']) || [],
    review_comments: (raw.review_comments as string) || '',
    revision_requested: Boolean(raw.revision_requested),
    revision_summary: (raw.revision_summary as string) || '',
    priority: (raw.priority as string) || 'Normal',
    sla_status: (raw.sla_status as string) || computeSlaStatus(dueDate, status, raw.completed_date as string),
    workflow_id: (raw.workflow_id as string) || null,
    step_id: (raw.step_id as string) || null,
    started_at: (raw.started_at as string) || null,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyReviewKpis(): ReviewKpis {
  return { pendingReviews: 0, inProgress: 0, completedReviews: 0, overdueReviews: 0, revisionRequests: 0, averageReviewTimeDays: 0, slaCompliancePct: 0, departmentQueue: 0 };
}

export function emptyReviewCharts(): ReviewCharts {
  return { statusDistribution: [], completionTrend: [], averageReviewTime: [], departmentLoad: [], reviewerWorkload: [], slaComplianceTrend: [] };
}

export function computeReviewKpis(records: DocumentReviewRecord[]): ReviewKpis {
  const completed = records.filter((r) => r.review_status === 'Completed');
  let totalDays = 0;
  let slaMet = 0;
  for (const r of completed) {
    if (r.started_at && r.completed_date) {
      const days = (new Date(r.completed_date).getTime() - new Date(r.started_at).getTime()) / 86400000;
      totalDays += days;
      if (r.due_date >= r.completed_date.split('T')[0]) slaMet++;
    }
  }
  return {
    pendingReviews: records.filter((r) => r.review_status === 'Pending Review').length,
    inProgress: records.filter((r) => r.review_status === 'Under Review').length,
    completedReviews: completed.length,
    overdueReviews: records.filter((r) => r.sla_status === 'Overdue').length,
    revisionRequests: records.filter((r) => r.revision_requested).length,
    averageReviewTimeDays: completed.length ? Math.round((totalDays / completed.length) * 10) / 10 : 0,
    slaCompliancePct: completed.length ? Math.round((slaMet / completed.length) * 100) : 100,
    departmentQueue: records.filter((r) => ['Pending Review', 'Under Review'].includes(r.review_status)).length,
  };
}

export function computeReviewCharts(records: DocumentReviewRecord[]): ReviewCharts {
  const byStatus = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const avgByMonth = new Map<string, { total: number; count: number }>();
  const byDept = new Map<string, number>();
  const byReviewer = new Map<string, number>();
  const slaByMonth = new Map<string, { met: number; total: number }>();

  for (const r of records) {
    byStatus.set(r.review_status, (byStatus.get(r.review_status) || 0) + 1);
    byDept.set(r.department || 'Unassigned', (byDept.get(r.department || 'Unassigned') || 0) + 1);
    if (['Pending Review', 'Under Review'].includes(r.review_status)) {
      byReviewer.set(r.reviewer_name || 'Unassigned', (byReviewer.get(r.reviewer_name || 'Unassigned') || 0) + 1);
    }
    if (r.review_status === 'Completed' && r.completed_date) {
      const m = r.completed_date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
      if (r.started_at) {
        const days = (new Date(r.completed_date).getTime() - new Date(r.started_at).getTime()) / 86400000;
        const a = avgByMonth.get(m) || { total: 0, count: 0 };
        a.total += days; a.count++;
        avgByMonth.set(m, a);
      }
      const sla = slaByMonth.get(m) || { met: 0, total: 0 };
      sla.total++;
      if (r.due_date >= r.completed_date.split('T')[0]) sla.met++;
      slaByMonth.set(m, sla);
    }
  }

  return {
    statusDistribution: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
    completionTrend: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    averageReviewTime: Array.from(avgByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, v]) => ({ month, days: Math.round((v.total / v.count) * 10) / 10 })),
    departmentLoad: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    reviewerWorkload: Array.from(byReviewer.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
    slaComplianceTrend: Array.from(slaByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, v]) => ({ month, pct: v.total ? Math.round((v.met / v.total) * 100) : 100 })),
  };
}

export function filterReviewRecords(records: DocumentReviewRecord[], filters: ReviewFilters): DocumentReviewRecord[] {
  let result = [...records];
  if (filters.status) result = result.filter((r) => r.review_status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.reviewer_id) result = result.filter((r) => r.reviewer_id === filters.reviewer_id);
  if (filters.review_mode) result = result.filter((r) => r.review_mode === filters.review_mode);
  if (filters.overdue) result = result.filter((r) => r.sla_status === 'Overdue');
  if (filters.revision_requested) result = result.filter((r) => r.revision_requested);
  if (filters.in_progress) result = result.filter((r) => r.review_status === 'Under Review');
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.review_number.toLowerCase().includes(q) ||
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.reviewer_name.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getPendingReviews(records: DocumentReviewRecord[]) {
  return records.filter((r) => ['Pending Review', 'Under Review'].includes(r.review_status));
}

export function getOverdueReviews(records: DocumentReviewRecord[]) {
  return records.filter((r) => r.sla_status === 'Overdue' && r.review_status !== 'Completed');
}

export function getRecentCompleted(records: DocumentReviewRecord[]) {
  return records.filter((r) => r.review_status === 'Completed')
    .sort((a, b) => (b.completed_date || b.updated_at).localeCompare(a.completed_date || a.updated_at)).slice(0, 20);
}

export function getRevisionRequests(records: DocumentReviewRecord[]) {
  return records.filter((r) => r.revision_requested || r.review_decision === 'Revision Required');
}

export function getReviewerQueue(records: DocumentReviewRecord[], reviewerId?: string) {
  return records.filter((r) =>
    ['Pending Review', 'Under Review'].includes(r.review_status) &&
    (!reviewerId || r.reviewer_id === reviewerId),
  );
}

export function getReviewHistory(records: DocumentReviewRecord[]) {
  return [...records].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export const REVIEW_KPI_FILTER_MAP: Record<string, Partial<ReviewFilters>> = {
  pending: { status: 'Pending Review' },
  in_progress: { in_progress: true },
  completed: { status: 'Completed' },
  overdue: { overdue: true },
  revision: { revision_requested: true },
};
