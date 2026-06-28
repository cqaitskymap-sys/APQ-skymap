import type {
  DocumentAcknowledgementRecord, AcknowledgementKpis, AcknowledgementCharts, AcknowledgementFilters,
} from './document-acknowledgement-types';
import { isAckOverdue, isAckComplete } from './document-acknowledgement-types';

export function mapAcknowledgementRaw(raw: Record<string, unknown> & { id: string }): DocumentAcknowledgementRecord {
  const status = (raw.acknowledgement_status as string) || 'Pending';
  const dueDate = (raw.due_date as string) || null;
  const resolvedStatus = isAckOverdue(dueDate, status) && !isAckComplete(status) ? 'Overdue' : status;
  return {
    id: raw.id,
    acknowledgement_id: (raw.acknowledgement_id as string) || raw.id,
    acknowledgement_number: (raw.acknowledgement_number as string) || `ACK-LEGACY-${raw.id.slice(0, 6)}`,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_version: (raw.document_version as string) || '',
    document_type: (raw.document_type as string) || '',
    distribution_id: (raw.distribution_id as string) || null,
    employee_id: (raw.employee_id as string) || '',
    employee_name: (raw.employee_name as string) || '',
    department: (raw.department as string) || '',
    role: (raw.role as string) || '',
    assigned_date: (raw.assigned_date as string) || (raw.created_at as string)?.split('T')[0] || '',
    due_date: dueDate,
    viewed_date: (raw.viewed_date as string) || null,
    read_confirmation_date: (raw.read_confirmation_date as string) || null,
    acknowledgement_date: (raw.acknowledgement_date as string) || null,
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    electronic_signature_status: (raw.electronic_signature_status as string) || 'not_required',
    acknowledgement_status: resolvedStatus,
    completion_status: (raw.completion_status as string) || (status === 'Acknowledged' ? 'Completed' : 'Incomplete'),
    training_required: Boolean(raw.training_required),
    training_pending: Boolean(raw.training_pending),
    comments: (raw.comments as string) || '',
    ip_address: (raw.ip_address as string) || null,
    device_information: (raw.device_information as string) || null,
    browser_information: (raw.browser_information as string) || null,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyAckKpis(): AcknowledgementKpis {
  return { totalAcknowledgements: 0, pending: 0, completed: 0, viewedOnly: 0, overdue: 0, expired: 0, readConfirmed: 0, trainingPending: 0 };
}

export function emptyAckCharts(): AcknowledgementCharts {
  return { acknowledgementTrend: [], completionRate: [], departmentCompletion: [], overdueTrend: [], documentTypeDistribution: [], trainingAssignmentTrend: [] };
}

export function computeAckKpis(records: DocumentAcknowledgementRecord[]): AcknowledgementKpis {
  return {
    totalAcknowledgements: records.length,
    pending: records.filter((r) => r.acknowledgement_status === 'Pending').length,
    completed: records.filter((r) => r.completion_status === 'Completed' || r.acknowledgement_status === 'Acknowledged').length,
    viewedOnly: records.filter((r) => r.acknowledgement_status === 'Viewed').length,
    overdue: records.filter((r) => r.acknowledgement_status === 'Overdue').length,
    expired: records.filter((r) => r.acknowledgement_status === 'Expired').length,
    readConfirmed: records.filter((r) => r.acknowledgement_status === 'Read Confirmed').length,
    trainingPending: records.filter((r) => r.training_required && r.training_pending).length,
  };
}

export function computeAckCharts(records: DocumentAcknowledgementRecord[]): AcknowledgementCharts {
  const byMonth = new Map<string, number>();
  const byType = new Map<string, number>();
  const byDept = new Map<string, { total: number; completed: number }>();
  const overdueByMonth = new Map<string, number>();
  const trainingByMonth = new Map<string, number>();
  let completed = 0;

  for (const r of records) {
    const m = (r.assigned_date || r.created_at || '').slice(0, 7);
    if (m) byMonth.set(m, (byMonth.get(m) || 0) + 1);
    byType.set(r.document_type || 'Other', (byType.get(r.document_type || 'Other') || 0) + 1);
    const dept = r.department || 'Unassigned';
    const d = byDept.get(dept) || { total: 0, completed: 0 };
    d.total++;
    if (r.completion_status === 'Completed') { d.completed++; completed++; }
    byDept.set(dept, d);
    if (r.acknowledgement_status === 'Overdue') {
      const om = (r.due_date || r.assigned_date || '').slice(0, 7);
      if (om) overdueByMonth.set(om, (overdueByMonth.get(om) || 0) + 1);
    }
    if (r.training_required && r.training_pending && r.assigned_date) {
      const tm = r.assigned_date.slice(0, 7);
      trainingByMonth.set(tm, (trainingByMonth.get(tm) || 0) + 1);
    }
  }

  return {
    acknowledgementTrend: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    completionRate: [
      { name: 'Completed', value: completed },
      { name: 'Incomplete', value: records.length - completed },
    ].filter((x) => x.value > 0),
    departmentCompletion: Array.from(byDept.entries()).map(([name, v]) => ({ name, value: v.completed, pct: v.total ? Math.round((v.completed / v.total) * 100) : 0 })).sort((a, b) => b.pct - a.pct),
    overdueTrend: Array.from(overdueByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    documentTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    trainingAssignmentTrend: Array.from(trainingByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
  };
}

export function filterAckRecords(records: DocumentAcknowledgementRecord[], filters: AcknowledgementFilters): DocumentAcknowledgementRecord[] {
  let result = [...records];
  if (filters.status) result = result.filter((r) => r.acknowledgement_status === filters.status);
  if (filters.completion_status) result = result.filter((r) => r.completion_status === filters.completion_status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.employee_id) result = result.filter((r) => r.employee_id === filters.employee_id);
  if (filters.overdue) result = result.filter((r) => r.acknowledgement_status === 'Overdue');
  if (filters.training_pending) result = result.filter((r) => r.training_required && r.training_pending);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.acknowledgement_number.toLowerCase().includes(q) ||
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.employee_name.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getPendingAcknowledgements(records: DocumentAcknowledgementRecord[]) {
  return records.filter((r) => ['Pending', 'Viewed', 'Read Confirmed'].includes(r.acknowledgement_status));
}

export function getOverdueAcknowledgements(records: DocumentAcknowledgementRecord[]) {
  return records.filter((r) => r.acknowledgement_status === 'Overdue');
}

export function getRecentCompletions(records: DocumentAcknowledgementRecord[]) {
  return records.filter((r) => r.acknowledgement_status === 'Acknowledged')
    .sort((a, b) => (b.acknowledgement_date || b.updated_at).localeCompare(a.acknowledgement_date || a.updated_at))
    .slice(0, 20);
}

export function getEmployeesNotAcknowledged(records: DocumentAcknowledgementRecord[]) {
  return records.filter((r) => r.completion_status === 'Incomplete' && !['Cancelled', 'Expired'].includes(r.acknowledgement_status));
}

export function getRecentlyViewed(records: DocumentAcknowledgementRecord[]) {
  return records.filter((r) => r.viewed_date)
    .sort((a, b) => (b.viewed_date || '').localeCompare(a.viewed_date || ''))
    .slice(0, 20);
}

export function getRecentReadConfirmations(records: DocumentAcknowledgementRecord[]) {
  return records.filter((r) => r.read_confirmation_date)
    .sort((a, b) => (b.read_confirmation_date || '').localeCompare(a.read_confirmation_date || ''))
    .slice(0, 20);
}

export const ACK_KPI_FILTER_MAP: Record<string, Partial<AcknowledgementFilters>> = {
  pending: { status: 'Pending' },
  completed: { completion_status: 'Completed' },
  viewed: { status: 'Viewed' },
  overdue: { overdue: true },
  expired: { status: 'Expired' },
  read_confirmed: { status: 'Read Confirmed' },
  training_pending: { training_pending: true },
};
