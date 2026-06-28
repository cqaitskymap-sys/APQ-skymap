import type {
  ControlledDistributionRecord, DistributionKpis, DistributionCharts, DistributionFilters,
} from './controlled-distribution-types';
import { isDistributionActive, isDistributionExpired } from './controlled-distribution-types';

export function mapDistributionRaw(raw: Record<string, unknown> & { id: string }): ControlledDistributionRecord {
  const assignedUsers = (raw.assigned_users as string[]) || (raw.user_id ? [raw.user_id as string] : []);
  const assignedNames = (raw.assigned_user_names as string[]) || (raw.user_name ? [raw.user_name as string] : []);
  const status = (raw.status as string) || (raw.acknowledged ? 'Completed' : 'Distributed');
  return {
    id: raw.id,
    distribution_id: (raw.distribution_id as string) || raw.id,
    distribution_number: (raw.distribution_number as string) || `DIST-LEGACY-${raw.id.slice(0, 6)}`,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    document_version: (raw.document_version as string) || '',
    distribution_type: (raw.distribution_type as string) || 'Department',
    distribution_group: (raw.distribution_group as string) || '',
    department: (raw.department as string) || '',
    site: (raw.site as string) || '',
    plant: (raw.plant as string) || '',
    assigned_users: assignedUsers,
    assigned_user_names: assignedNames,
    assigned_roles: (raw.assigned_roles as string[]) || [],
    assigned_departments: (raw.assigned_departments as string[]) || (raw.department ? [raw.department as string] : []),
    distribution_date: (raw.distribution_date as string) || (raw.distributed_at as string) || null,
    effective_date: (raw.effective_date as string) || (raw.distributed_at as string)?.split('T')[0] || '',
    expiry_date: (raw.expiry_date as string) || null,
    acknowledgement_required: raw.acknowledgement_required !== false,
    training_required: Boolean(raw.training_required),
    read_confirmation_required: Boolean(raw.read_confirmation_required),
    status,
    reason: (raw.reason as string) || '',
    pending_acknowledgements: (raw.pending_acknowledgements as number) ?? (raw.acknowledged === false ? 1 : 0),
    pending_training: (raw.pending_training as number) ?? 0,
    pending_read_confirmations: (raw.pending_read_confirmations as number) ?? 0,
    withdrawn_at: (raw.withdrawn_at as string) || null,
    withdrawn_reason: (raw.withdrawn_reason as string) || null,
    is_immutable: Boolean(raw.is_immutable) || ['Completed', 'Withdrawn', 'Expired', 'Cancelled'].includes(status),
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || assignedNames[0] || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || (raw.distributed_at as string) || '',
    updated_at: (raw.updated_at as string) || (raw.distributed_at as string) || '',
  };
}

export function emptyDistributionKpis(): DistributionKpis {
  return {
    totalDistributions: 0, activeDistributions: 0, pendingAcknowledgements: 0,
    completed: 0, expired: 0, cancelled: 0, trainingPending: 0, readConfirmationsPending: 0,
  };
}

export function emptyDistributionCharts(): DistributionCharts {
  return {
    distributionTrend: [], departmentDistribution: [], documentTypeDistribution: [],
    acknowledgementStatus: [], trainingAssignmentTrend: [], siteDistribution: [],
  };
}

export function computeDistributionKpis(records: ControlledDistributionRecord[]): DistributionKpis {
  return {
    totalDistributions: records.length,
    activeDistributions: records.filter((r) => isDistributionActive(r.status)).length,
    pendingAcknowledgements: records.filter((r) => r.status === 'Pending Acknowledgement' || r.pending_acknowledgements > 0).length,
    completed: records.filter((r) => r.status === 'Completed').length,
    expired: records.filter((r) => r.status === 'Expired' || isDistributionExpired(r.expiry_date)).length,
    cancelled: records.filter((r) => r.status === 'Cancelled').length,
    trainingPending: records.filter((r) => r.training_required && r.pending_training > 0).length,
    readConfirmationsPending: records.filter((r) => r.read_confirmation_required && r.pending_read_confirmations > 0).length,
  };
}

function monthKey(iso: string): string {
  if (!iso) return 'Unknown';
  return iso.slice(0, 7);
}

export function computeDistributionCharts(records: ControlledDistributionRecord[]): DistributionCharts {
  const byMonth = new Map<string, number>();
  const byDept = new Map<string, number>();
  const byType = new Map<string, number>();
  const bySite = new Map<string, number>();
  const ackStatus = { Acknowledged: 0, Pending: 0, 'Not Required': 0 };
  const trainingByMonth = new Map<string, number>();

  for (const r of records) {
    const m = monthKey(r.distribution_date || r.created_at);
    byMonth.set(m, (byMonth.get(m) || 0) + 1);
    const dept = r.department || r.assigned_departments[0] || 'Unassigned';
    byDept.set(dept, (byDept.get(dept) || 0) + 1);
    byType.set(r.document_type || 'Other', (byType.get(r.document_type || 'Other') || 0) + 1);
    if (r.site) bySite.set(r.site, (bySite.get(r.site) || 0) + 1);
    if (r.acknowledgement_required) {
      if (r.pending_acknowledgements > 0) ackStatus.Pending++;
      else if (r.status === 'Completed') ackStatus.Acknowledged++;
    } else ackStatus['Not Required']++;
    if (r.training_required && r.distribution_date) {
      const tm = monthKey(r.distribution_date);
      trainingByMonth.set(tm, (trainingByMonth.get(tm) || 0) + 1);
    }
  }

  return {
    distributionTrend: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    departmentDistribution: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    documentTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    acknowledgementStatus: Object.entries(ackStatus).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0),
    trainingAssignmentTrend: Array.from(trainingByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    siteDistribution: Array.from(bySite.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}

export function filterDistributionRecords(records: ControlledDistributionRecord[], filters: DistributionFilters): ControlledDistributionRecord[] {
  let result = [...records];
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  if (filters.distribution_type) result = result.filter((r) => r.distribution_type === filters.distribution_type);
  if (filters.department) result = result.filter((r) => r.department === filters.department || r.assigned_departments.includes(filters.department!));
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.site) result = result.filter((r) => r.site === filters.site);
  if (filters.pending_ack) result = result.filter((r) => r.pending_acknowledgements > 0 || r.status === 'Pending Acknowledgement');
  if (filters.training_pending) result = result.filter((r) => r.training_required && r.pending_training > 0);
  if (filters.expiring) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 30);
    const limit = threshold.toISOString().split('T')[0];
    result = result.filter((r) => r.expiry_date && r.expiry_date <= limit && r.status !== 'Expired');
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.distribution_number.toLowerCase().includes(q) ||
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getRecentDistributions(records: ControlledDistributionRecord[]) {
  return [...records].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 20);
}

export function getPendingAcknowledgements(records: ControlledDistributionRecord[]) {
  return records.filter((r) => r.pending_acknowledgements > 0 || r.status === 'Pending Acknowledgement');
}

export function getUpcomingExpiry(records: ControlledDistributionRecord[]) {
  const today = new Date().toISOString().split('T')[0];
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 30);
  const limit = threshold.toISOString().split('T')[0];
  return records.filter((r) => r.expiry_date && r.expiry_date >= today && r.expiry_date <= limit && !['Expired', 'Cancelled', 'Withdrawn'].includes(r.status));
}

export function getTrainingPending(records: ControlledDistributionRecord[]) {
  return records.filter((r) => r.training_required && r.pending_training > 0);
}

export function getDistributionHistory(records: ControlledDistributionRecord[]) {
  return records.filter((r) => r.is_immutable).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export function getRecentlyWithdrawn(records: ControlledDistributionRecord[]) {
  return records.filter((r) => r.status === 'Withdrawn').sort((a, b) => (b.withdrawn_at || b.updated_at || '').localeCompare(a.withdrawn_at || a.updated_at || '')).slice(0, 20);
}

export const DISTRIBUTION_KPI_FILTER_MAP: Record<string, Partial<DistributionFilters>> = {
  active: { status: 'Distributed' },
  pending_ack: { pending_ack: true },
  completed: { status: 'Completed' },
  expired: { status: 'Expired' },
  cancelled: { status: 'Cancelled' },
  training_pending: { training_pending: true },
  expiring: { expiring: true },
};
