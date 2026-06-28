import type { EffectiveDateRecord, EffectiveDateKpis, EffectiveDateCharts, EffectiveDateFilters } from './effective-date-types';

function todayStr() { return new Date().toISOString().split('T')[0]; }

export function mapEffectiveDateRaw(raw: Record<string, unknown> & { id: string }): EffectiveDateRecord {
  return {
    id: raw.id,
    effective_date_id: (raw.effective_date_id as string) || raw.id,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    version: (raw.version as string) || '',
    approval_date: (raw.approval_date as string) || null,
    effective_date: (raw.effective_date as string) || '',
    activation_time: (raw.activation_time as string) || '00:00',
    time_zone: (raw.time_zone as string) || 'UTC',
    training_required: Boolean(raw.training_required),
    training_completion_status: (raw.training_completion_status as string) || 'Not Required',
    distribution_status: (raw.distribution_status as string) || 'Not Started',
    superseded_version: (raw.superseded_version as string) || null,
    current_effective_version: (raw.current_effective_version as string) || (raw.version as string) || '',
    activation_status: (raw.activation_status as string) || 'Pending',
    activation_method: (raw.activation_method as string) || 'Scheduled',
    rollback_allowed: raw.rollback_allowed !== false,
    rollback_window_hours: (raw.rollback_window_hours as number) || 72,
    reason: (raw.reason as string) || '',
    department: (raw.department as string) || '',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
    activated_at: (raw.activated_at as string) || null,
    rolled_back_at: (raw.rolled_back_at as string) || null,
  };
}

export function emptyEffectiveDateKpis(): EffectiveDateKpis {
  return {
    pendingActivations: 0, todaysActivations: 0, delayedActivations: 0, cancelledActivations: 0,
    awaitingTraining: 0, activeEffectiveDocuments: 0, rollbackEvents: 0, upcomingEffectiveDates: 0,
  };
}

export function emptyEffectiveDateCharts(): EffectiveDateCharts {
  return {
    activationTrend: [], departmentActivations: [], documentTypeDistribution: [],
    trainingDependencyTrend: [], rollbackTrend: [], activationSuccessRate: [],
  };
}

export function computeEffectiveDateKpis(records: EffectiveDateRecord[]): EffectiveDateKpis {
  const today = todayStr();
  return {
    pendingActivations: records.filter((r) => ['Pending', 'Scheduled', 'Ready'].includes(r.activation_status)).length,
    todaysActivations: records.filter((r) => r.effective_date === today && r.activation_status === 'Activated').length,
    delayedActivations: records.filter((r) => r.activation_status === 'Delayed').length,
    cancelledActivations: records.filter((r) => r.activation_status === 'Cancelled').length,
    awaitingTraining: records.filter((r) => r.activation_status === 'Waiting For Training').length,
    activeEffectiveDocuments: records.filter((r) => r.activation_status === 'Activated').length,
    rollbackEvents: records.filter((r) => r.activation_status === 'Rolled Back').length,
    upcomingEffectiveDates: records.filter((r) =>
      ['Scheduled', 'Ready', 'Waiting For Training'].includes(r.activation_status) && r.effective_date >= today,
    ).length,
  };
}

export function computeEffectiveDateCharts(records: EffectiveDateRecord[]): EffectiveDateCharts {
  const byMonth = new Map<string, number>();
  const byDept = new Map<string, number>();
  const byType = new Map<string, number>();
  const trainingByMonth = new Map<string, number>();
  const rollbackByMonth = new Map<string, number>();
  const successByMonth = new Map<string, { ok: number; total: number }>();

  for (const r of records) {
    byType.set(r.document_type || 'Unknown', (byType.get(r.document_type || 'Unknown') || 0) + 1);
    if (r.activation_status === 'Activated' && r.activated_at) {
      const m = r.activated_at.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
      byDept.set(r.department || 'Unassigned', (byDept.get(r.department || 'Unassigned') || 0) + 1);
      const s = successByMonth.get(m) || { ok: 0, total: 0 };
      s.total++; s.ok++;
      successByMonth.set(m, s);
    }
    if (r.activation_status === 'Waiting For Training') {
      const m = r.effective_date.slice(0, 7);
      trainingByMonth.set(m, (trainingByMonth.get(m) || 0) + 1);
    }
    if (r.activation_status === 'Rolled Back' && r.rolled_back_at) {
      const m = r.rolled_back_at.slice(0, 7);
      rollbackByMonth.set(m, (rollbackByMonth.get(m) || 0) + 1);
    }
    if (r.activation_status === 'Delayed') {
      const m = r.effective_date.slice(0, 7);
      const s = successByMonth.get(m) || { ok: 0, total: 0 };
      s.total++;
      successByMonth.set(m, s);
    }
  }

  return {
    activationTrend: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    departmentActivations: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    documentTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    trainingDependencyTrend: Array.from(trainingByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    rollbackTrend: Array.from(rollbackByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    activationSuccessRate: Array.from(successByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([month, v]) => ({ month, pct: v.total ? Math.round((v.ok / v.total) * 100) : 100 })),
  };
}

export function filterEffectiveDateRecords(records: EffectiveDateRecord[], filters: EffectiveDateFilters): EffectiveDateRecord[] {
  let result = [...records];
  const today = todayStr();
  if (filters.status) result = result.filter((r) => r.activation_status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.activation_method) result = result.filter((r) => r.activation_method === filters.activation_method);
  if (filters.upcoming) result = result.filter((r) => r.effective_date >= today && r.activation_status !== 'Activated');
  if (filters.today) result = result.filter((r) => r.effective_date === today);
  if (filters.delayed) result = result.filter((r) => r.activation_status === 'Delayed');
  if (filters.training_blocked) result = result.filter((r) => r.activation_status === 'Waiting For Training');
  if (filters.activated) result = result.filter((r) => r.activation_status === 'Activated');
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.effective_date_id.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getUpcomingActivations(records: EffectiveDateRecord[]) {
  const today = todayStr();
  return records.filter((r) =>
    ['Scheduled', 'Ready', 'Waiting For Training', 'Pending'].includes(r.activation_status) && r.effective_date >= today,
  ).sort((a, b) => a.effective_date.localeCompare(b.effective_date));
}

export function getTodaysActivations(records: EffectiveDateRecord[]) {
  const today = todayStr();
  return records.filter((r) => r.effective_date === today);
}

export function getDelayedActivations(records: EffectiveDateRecord[]) {
  return records.filter((r) => r.activation_status === 'Delayed');
}

export function getRollbackHistory(records: EffectiveDateRecord[]) {
  return records.filter((r) => r.activation_status === 'Rolled Back')
    .sort((a, b) => (b.rolled_back_at || b.updated_at).localeCompare(a.rolled_back_at || a.updated_at));
}

export function getTrainingBlocked(records: EffectiveDateRecord[]) {
  return records.filter((r) => r.activation_status === 'Waiting For Training');
}

export function getRecentlyActivated(records: EffectiveDateRecord[]) {
  return records.filter((r) => r.activation_status === 'Activated')
    .sort((a, b) => (b.activated_at || b.updated_at).localeCompare(a.activated_at || a.updated_at)).slice(0, 20);
}

export const EDM_KPI_FILTER_MAP: Record<string, Partial<EffectiveDateFilters>> = {
  pending: { status: 'Scheduled' },
  today: { today: true },
  delayed: { delayed: true },
  training: { training_blocked: true },
  activated: { activated: true },
  upcoming: { upcoming: true },
  rollback: { status: 'Rolled Back' },
};
