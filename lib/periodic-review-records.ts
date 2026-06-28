import type {
  PeriodicReviewRecord, PeriodicReviewKpis, PeriodicReviewCharts, PeriodicReviewFilters,
} from './periodic-review-types';

function todayStr() { return new Date().toISOString().split('T')[0]; }

export function mapPeriodicReviewRaw(raw: Record<string, unknown> & { id: string }): PeriodicReviewRecord {
  return {
    id: raw.id,
    review_id: (raw.review_id as string) || raw.id,
    review_number: (raw.review_number as string) || '',
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    current_version: (raw.current_version as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    owner: (raw.owner as string) || '',
    owner_name: (raw.owner_name as string) || '',
    reviewer_id: (raw.reviewer_id as string) || '',
    reviewer_name: (raw.reviewer_name as string) || '',
    qa_reviewer_id: (raw.qa_reviewer_id as string) || '',
    qa_reviewer_name: (raw.qa_reviewer_name as string) || '',
    review_frequency: (raw.review_frequency as string) || 'Annual',
    review_cycle: (raw.review_cycle as number) || 1,
    review_trigger: (raw.review_trigger as string) || 'Scheduled',
    scheduled_date: (raw.scheduled_date as string) || '',
    due_date: (raw.due_date as string) || '',
    started_date: (raw.started_date as string) || null,
    completed_date: (raw.completed_date as string) || null,
    decision: (raw.decision as string) || null,
    status: (raw.status as string) || 'Scheduled',
    outcome: (raw.outcome as string) || '',
    revision_required: Boolean(raw.revision_required),
    change_control_required: Boolean(raw.change_control_required),
    risk_assessment_required: Boolean(raw.risk_assessment_required),
    capa_required: Boolean(raw.capa_required),
    training_impact: Boolean(raw.training_impact),
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    review_checklist: Array.isArray(raw.review_checklist) ? raw.review_checklist as PeriodicReviewRecord['review_checklist'] : [],
    review_comments: (raw.review_comments as string) || '',
    attachments: Array.isArray(raw.attachments) ? raw.attachments as string[] : [],
    priority: (raw.priority as string) || 'Normal',
    linked_change_control_id: (raw.linked_change_control_id as string) || null,
    linked_capa_id: (raw.linked_capa_id as string) || null,
    linked_risk_assessment_id: (raw.linked_risk_assessment_id as string) || null,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyPeriodicReviewKpis(): PeriodicReviewKpis {
  return {
    scheduledReviews: 0, dueThisMonth: 0, overdueReviews: 0, completedReviews: 0,
    majorRevisions: 0, minorRevisions: 0, documentsRetired: 0, averageReviewDurationDays: 0,
  };
}

export function emptyPeriodicReviewCharts(): PeriodicReviewCharts {
  return {
    statusDistribution: [], frequencyDistribution: [], departmentTrend: [],
    overdueTrend: [], decisionTrend: [], revisionTrend: [],
  };
}

function monthKey(d: string) { return d.slice(0, 7); }

function isDueThisMonth(dueDate: string): boolean {
  const today = new Date();
  const due = new Date(`${dueDate}T12:00:00`);
  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth();
}

function reviewDurationDays(r: PeriodicReviewRecord): number | null {
  if (!r.started_date || !r.completed_date) return null;
  const ms = new Date(r.completed_date).getTime() - new Date(r.started_date).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function computePeriodicReviewKpis(records: PeriodicReviewRecord[]): PeriodicReviewKpis {
  const completed = records.filter((r) => r.status === 'Completed');
  const durations = completed.map(reviewDurationDays).filter((d): d is number => d !== null);
  return {
    scheduledReviews: records.filter((r) => ['Scheduled', 'Pending'].includes(r.status)).length,
    dueThisMonth: records.filter((r) => r.due_date && isDueThisMonth(r.due_date) && r.status !== 'Completed').length,
    overdueReviews: records.filter((r) => r.status === 'Overdue').length,
    completedReviews: completed.length,
    majorRevisions: records.filter((r) => r.decision === 'Major Revision').length,
    minorRevisions: records.filter((r) => r.decision === 'Minor Revision').length,
    documentsRetired: records.filter((r) => r.decision === 'Retire Document').length,
    averageReviewDurationDays: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
  };
}

export function computePeriodicReviewCharts(records: PeriodicReviewRecord[]): PeriodicReviewCharts {
  const byStatus = new Map<string, number>();
  const byFreq = new Map<string, number>();
  const deptByMonth = new Map<string, number>();
  const overdueByMonth = new Map<string, number>();
  const decisionByMonth = new Map<string, number>();
  const revisionByMonth = new Map<string, { minor: number; major: number }>();

  for (const r of records) {
    byStatus.set(r.status, (byStatus.get(r.status) || 0) + 1);
    byFreq.set(r.review_frequency || 'Annual', (byFreq.get(r.review_frequency || 'Annual') || 0) + 1);
    if (r.completed_date) {
      const m = monthKey(r.completed_date);
      deptByMonth.set(m, (deptByMonth.get(m) || 0) + 1);
      if (r.decision) decisionByMonth.set(m, (decisionByMonth.get(m) || 0) + 1);
      const rev = revisionByMonth.get(m) || { minor: 0, major: 0 };
      if (r.decision === 'Minor Revision') rev.minor++;
      if (r.decision === 'Major Revision') rev.major++;
      revisionByMonth.set(m, rev);
    }
    if (r.status === 'Overdue' && r.due_date) {
      const m = monthKey(r.due_date);
      overdueByMonth.set(m, (overdueByMonth.get(m) || 0) + 1);
    }
  }

  const sortMonths = (entries: [string, number][]) =>
    entries.sort(([a], [b]) => a.localeCompare(b)).slice(-12);

  return {
    statusDistribution: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
    frequencyDistribution: Array.from(byFreq.entries()).map(([name, value]) => ({ name, value })),
    departmentTrend: sortMonths(Array.from(deptByMonth.entries())).map(([month, count]) => ({ month, count })),
    overdueTrend: sortMonths(Array.from(overdueByMonth.entries())).map(([month, count]) => ({ month, count })),
    decisionTrend: sortMonths(Array.from(decisionByMonth.entries())).map(([month, count]) => ({ month, count })),
    revisionTrend: Array.from(revisionByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, v]) => ({ month, minor: v.minor, major: v.major })),
  };
}

export function filterPeriodicReviewRecords(records: PeriodicReviewRecord[], filters: PeriodicReviewFilters): PeriodicReviewRecord[] {
  let result = [...records];
  const today = todayStr();
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.frequency) result = result.filter((r) => r.review_frequency === filters.frequency);
  if (filters.trigger) result = result.filter((r) => r.review_trigger === filters.trigger);
  if (filters.priority) result = result.filter((r) => r.priority === filters.priority);
  if (filters.upcoming) result = result.filter((r) => r.due_date >= today && !['Completed', 'Cancelled'].includes(r.status));
  if (filters.overdue) result = result.filter((r) => r.status === 'Overdue');
  if (filters.completed) result = result.filter((r) => r.status === 'Completed');
  if (filters.due_this_month) result = result.filter((r) => r.due_date && isDueThisMonth(r.due_date));
  if (filters.assigned_to_me) {
    result = result.filter((r) =>
      r.reviewer_id === filters.assigned_to_me || r.qa_reviewer_id === filters.assigned_to_me,
    );
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.review_number.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getUpcomingReviews(records: PeriodicReviewRecord[]) {
  const today = todayStr();
  return records.filter((r) =>
    r.due_date >= today && !['Completed', 'Cancelled', 'Overdue'].includes(r.status),
  ).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function getOverdueReviews(records: PeriodicReviewRecord[]) {
  return records.filter((r) => r.status === 'Overdue')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function getCompletedReviews(records: PeriodicReviewRecord[]) {
  return records.filter((r) => r.status === 'Completed')
    .sort((a, b) => (b.completed_date || b.updated_at).localeCompare(a.completed_date || a.updated_at));
}

export function getReviewDecisions(records: PeriodicReviewRecord[]) {
  return records.filter((r) => r.decision && r.status === 'Completed')
    .sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || ''));
}

export function getRecentlyRevised(records: PeriodicReviewRecord[]) {
  return records.filter((r) => ['Minor Revision', 'Major Revision'].includes(r.decision || ''))
    .sort((a, b) => (b.completed_date || '').localeCompare(a.completed_date || '')).slice(0, 20);
}

export function getDueNextMonth(records: PeriodicReviewRecord[]) {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const startStr = nextMonth.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  return records.filter((r) =>
    r.due_date >= startStr && r.due_date <= endStr && !['Completed', 'Cancelled'].includes(r.status),
  );
}

export const PRM_KPI_FILTER_MAP: Record<string, Partial<PeriodicReviewFilters>> = {
  scheduled: { status: 'Scheduled' },
  due_month: { due_this_month: true },
  overdue: { overdue: true },
  completed: { completed: true },
  major: { status: 'Completed' },
  upcoming: { upcoming: true },
};
