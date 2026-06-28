import type {
  RetentionPolicyRecord, RetentionScheduleRecord, DisposalRequestRecord,
  DisposalCertificateRecord, RetentionDisposalKpis, RetentionDisposalCharts, RetentionDisposalFilters,
} from './retention-disposal-types';
import { RETENTION_WARNING_DAYS } from './retention-disposal-types';

function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthKey(d: string) { return d.slice(0, 7); }

function daysUntil(dateStr: string): number {
  const ms = new Date(`${dateStr}T12:00:00`).getTime() - new Date(`${todayStr()}T12:00:00`).getTime();
  return Math.ceil(ms / 86400000);
}

export function mapPolicyRaw(raw: Record<string, unknown> & { id: string }): RetentionPolicyRecord {
  return {
    id: raw.id,
    retention_policy_id: (raw.retention_policy_id as string) || raw.id,
    policy_number: (raw.policy_number as string) || '',
    policy_name: (raw.policy_name as string) || '',
    description: (raw.description as string) || '',
    document_type: (raw.document_type as string) || '',
    document_category: (raw.document_category as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    applicable_regulations: Array.isArray(raw.applicable_regulations) ? raw.applicable_regulations as string[] : [],
    retention_trigger: (raw.retention_trigger as string) || 'Effective Date',
    retention_period: (raw.retention_period as number) || 7,
    retention_unit: (raw.retention_unit as string) || 'Years',
    archive_required: Boolean(raw.archive_required),
    disposal_method: (raw.disposal_method as string) || 'Secure Digital Deletion',
    legal_hold_allowed: raw.legal_hold_allowed !== false,
    regulatory_hold_allowed: raw.regulatory_hold_allowed !== false,
    approval_workflow: (raw.approval_workflow as string) || 'QA Approval',
    status: (raw.status as string) || 'Draft',
    effective_date: (raw.effective_date as string) || '',
    review_frequency: (raw.review_frequency as string) || 'Annual',
    owner: (raw.owner as string) || '',
    owner_name: (raw.owner_name as string) || '',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapScheduleRaw(raw: Record<string, unknown> & { id: string }): RetentionScheduleRecord {
  return {
    id: raw.id,
    schedule_id: (raw.schedule_id as string) || raw.id,
    schedule_number: (raw.schedule_number as string) || '',
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    department: (raw.department as string) || '',
    policy_id: (raw.policy_id as string) || '',
    policy_number: (raw.policy_number as string) || '',
    policy_name: (raw.policy_name as string) || '',
    retention_trigger: (raw.retention_trigger as string) || '',
    trigger_date: (raw.trigger_date as string) || '',
    retention_expiry_date: (raw.retention_expiry_date as string) || null,
    retention_status: (raw.retention_status as string) || 'Active',
    archive_id: (raw.archive_id as string) || null,
    legal_hold: Boolean(raw.legal_hold),
    regulatory_hold: Boolean(raw.regulatory_hold),
    disposal_request_id: (raw.disposal_request_id as string) || null,
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapDisposalRequestRaw(raw: Record<string, unknown> & { id: string }): DisposalRequestRecord {
  return {
    id: raw.id,
    request_id: (raw.request_id as string) || raw.id,
    request_number: (raw.request_number as string) || '',
    schedule_id: (raw.schedule_id as string) || '',
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    disposal_method: (raw.disposal_method as string) || '',
    disposal_reason: (raw.disposal_reason as string) || '',
    status: (raw.status as string) || 'Pending',
    requested_by: (raw.requested_by as string) || '',
    requested_by_name: (raw.requested_by_name as string) || '',
    approved_by: (raw.approved_by as string) || '',
    approved_by_name: (raw.approved_by_name as string) || '',
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    certificate_id: (raw.certificate_id as string) || null,
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapCertificateRaw(raw: Record<string, unknown> & { id: string }): DisposalCertificateRecord {
  return {
    id: raw.id,
    certificate_id: (raw.certificate_id as string) || raw.id,
    certificate_number: (raw.certificate_number as string) || '',
    disposal_request_id: (raw.disposal_request_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    disposal_method: (raw.disposal_method as string) || '',
    disposed_by: (raw.disposed_by as string) || '',
    disposed_by_name: (raw.disposed_by_name as string) || '',
    disposal_date: (raw.disposal_date as string) || '',
    witness: (raw.witness as string) || '',
    witness_name: (raw.witness_name as string) || '',
    created_at: (raw.created_at as string) || '',
  };
}

export function emptyRetentionKpis(): RetentionDisposalKpis {
  return {
    activePolicies: 0, documentsUnderRetention: 0, retentionExpiringSoon: 0,
    pendingDisposal: 0, disposedRecords: 0, legalHolds: 0, regulatoryHolds: 0, permanentRecords: 0,
  };
}

export function emptyRetentionCharts(): RetentionDisposalCharts {
  return {
    retentionExpiryTrend: [], retentionByDocumentType: [], departmentRetentionDistribution: [],
    disposalTrend: [], legalHoldTrend: [], regulatoryHoldTrend: [],
  };
}

export function isRetentionExpiringSoon(s: RetentionScheduleRecord): boolean {
  if (!s.retention_expiry_date || s.retention_status === 'Disposed') return false;
  const days = daysUntil(s.retention_expiry_date);
  return days >= 0 && days <= RETENTION_WARNING_DAYS;
}

export function computeRetentionKpis(
  policies: RetentionPolicyRecord[],
  schedules: RetentionScheduleRecord[],
  disposals: DisposalRequestRecord[],
): RetentionDisposalKpis {
  return {
    activePolicies: policies.filter((p) => p.status === 'Active').length,
    documentsUnderRetention: schedules.filter((s) => !['Disposed'].includes(s.retention_status)).length,
    retentionExpiringSoon: schedules.filter(isRetentionExpiringSoon).length,
    pendingDisposal: disposals.filter((d) => ['Pending', 'Pending Approval'].includes(d.status)).length,
    disposedRecords: schedules.filter((s) => s.retention_status === 'Disposed').length,
    legalHolds: schedules.filter((s) => s.legal_hold || s.retention_status === 'Legal Hold').length,
    regulatoryHolds: schedules.filter((s) => s.regulatory_hold || s.retention_status === 'Regulatory Hold').length,
    permanentRecords: schedules.filter((s) => !s.retention_expiry_date).length,
  };
}

export function computeRetentionCharts(
  schedules: RetentionScheduleRecord[],
  disposals: DisposalRequestRecord[],
): RetentionDisposalCharts {
  const expiryByMonth = new Map<string, number>();
  const byType = new Map<string, number>();
  const byDept = new Map<string, number>();
  const disposalByMonth = new Map<string, number>();
  const legalByMonth = new Map<string, number>();
  const regByMonth = new Map<string, number>();

  for (const s of schedules) {
    byType.set(s.document_type || 'Unknown', (byType.get(s.document_type || 'Unknown') || 0) + 1);
    byDept.set(s.department || 'Unknown', (byDept.get(s.department || 'Unknown') || 0) + 1);
    if (s.retention_expiry_date) {
      expiryByMonth.set(monthKey(s.retention_expiry_date), (expiryByMonth.get(monthKey(s.retention_expiry_date)) || 0) + 1);
    }
    if (s.legal_hold) legalByMonth.set(monthKey(s.updated_at || s.created_at), (legalByMonth.get(monthKey(s.updated_at || s.created_at)) || 0) + 1);
    if (s.regulatory_hold) regByMonth.set(monthKey(s.updated_at || s.created_at), (regByMonth.get(monthKey(s.updated_at || s.created_at)) || 0) + 1);
  }
  for (const d of disposals.filter((x) => x.status === 'Completed')) {
    disposalByMonth.set(monthKey(d.updated_at || d.created_at), (disposalByMonth.get(monthKey(d.updated_at || d.created_at)) || 0) + 1);
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

  return {
    retentionExpiryTrend: toSorted(expiryByMonth),
    retentionByDocumentType: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    departmentRetentionDistribution: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })),
    disposalTrend: toSorted(disposalByMonth),
    legalHoldTrend: toSorted(legalByMonth),
    regulatoryHoldTrend: toSorted(regByMonth),
  };
}

export function filterSchedules(schedules: RetentionScheduleRecord[], filters: RetentionDisposalFilters): RetentionScheduleRecord[] {
  let result = [...schedules];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((s) =>
      s.document_number.toLowerCase().includes(q) ||
      s.document_title.toLowerCase().includes(q) ||
      s.policy_number.toLowerCase().includes(q),
    );
  }
  if (filters.department) result = result.filter((s) => s.department === filters.department);
  if (filters.document_type) result = result.filter((s) => s.document_type === filters.document_type);
  if (filters.retention_status) result = result.filter((s) => s.retention_status === filters.retention_status);
  if (filters.expiring) result = result.filter(isRetentionExpiringSoon);
  if (filters.disposed) result = result.filter((s) => s.retention_status === 'Disposed');
  if (filters.legal_hold) result = result.filter((s) => s.legal_hold);
  if (filters.regulatory_hold) result = result.filter((s) => s.regulatory_hold);
  if (filters.permanent) result = result.filter((s) => !s.retention_expiry_date);
  if (filters.department_only) result = result.filter((s) => s.department === filters.department_only);
  return result;
}

export function filterDisposals(disposals: DisposalRequestRecord[], filters: RetentionDisposalFilters): DisposalRequestRecord[] {
  let result = [...disposals];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((d) =>
      d.document_number.toLowerCase().includes(q) || d.request_number.toLowerCase().includes(q),
    );
  }
  if (filters.pending_disposal) result = result.filter((d) => ['Pending', 'Pending Approval'].includes(d.status));
  if (filters.disposed) result = result.filter((d) => d.status === 'Completed');
  return result;
}

export const RDM_KPI_FILTER_MAP: Record<string, RetentionDisposalFilters> = {
  policies: { policy_status: 'Active' },
  retention: { status: 'Active' },
  expiring: { expiring: true },
  disposal: { pending_disposal: true },
  disposed: { disposed: true },
  legal: { legal_hold: true },
  regulatory: { regulatory_hold: true },
  permanent: { permanent: true },
};

export function getUpcomingExpiry(schedules: RetentionScheduleRecord[]): RetentionScheduleRecord[] {
  return schedules.filter(isRetentionExpiringSoon).sort((a, b) =>
    (a.retention_expiry_date || '').localeCompare(b.retention_expiry_date || ''),
  );
}
export function getPendingDisposal(disposals: DisposalRequestRecord[]): DisposalRequestRecord[] {
  return disposals.filter((d) => ['Pending', 'Pending Approval'].includes(d.status));
}
export function getDisposedSchedules(schedules: RetentionScheduleRecord[]): RetentionScheduleRecord[] {
  return schedules.filter((s) => s.retention_status === 'Disposed');
}
export function getLegalHoldSchedules(schedules: RetentionScheduleRecord[]): RetentionScheduleRecord[] {
  return schedules.filter((s) => s.legal_hold || s.retention_status === 'Legal Hold');
}
export function getRegulatoryHoldSchedules(schedules: RetentionScheduleRecord[]): RetentionScheduleRecord[] {
  return schedules.filter((s) => s.regulatory_hold || s.retention_status === 'Regulatory Hold');
}

export function addRetentionPeriod(triggerDate: string, period: number, unit: string): string | null {
  if (unit === 'Permanent') return null;
  const d = new Date(`${triggerDate}T12:00:00`);
  if (unit === 'Days') d.setDate(d.getDate() + period);
  else if (unit === 'Months') d.setMonth(d.getMonth() + period);
  else d.setFullYear(d.getFullYear() + period);
  return d.toISOString().split('T')[0];
}
