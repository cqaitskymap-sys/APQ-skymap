import type {
  ArchiveRecord, ArchiveKpis, ArchiveCharts, ArchiveFilters,
} from './archive-management-types';
import { RETENTION_WARNING_DAYS } from './archive-management-types';

function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthKey(d: string) { return d.slice(0, 7); }

function daysUntil(dateStr: string): number {
  const ms = new Date(`${dateStr}T12:00:00`).getTime() - new Date(`${todayStr()}T12:00:00`).getTime();
  return Math.ceil(ms / 86400000);
}

export function mapArchiveRaw(raw: Record<string, unknown> & { id: string }): ArchiveRecord {
  return {
    id: raw.id,
    archive_id: (raw.archive_id as string) || raw.id,
    archive_number: (raw.archive_number as string) || '',
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    document_category: (raw.document_category as string) || '',
    department: (raw.department as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    version: (raw.version as string) || '',
    revision: (raw.revision as string) || '',
    current_status: (raw.current_status as string) || '',
    archive_status: (raw.archive_status as string) || 'Pending',
    archive_reason: (raw.archive_reason as string) || '',
    archive_category: (raw.archive_category as string) || '',
    archive_date: (raw.archive_date as string) || null,
    archive_location: (raw.archive_location as string) || '',
    retention_policy: (raw.retention_policy as string) || '',
    retention_expiry_date: (raw.retention_expiry_date as string) || null,
    original_effective_date: (raw.original_effective_date as string) || null,
    superseded_date: (raw.superseded_date as string) || null,
    obsolete_date: (raw.obsolete_date as string) || null,
    retired_date: (raw.retired_date as string) || null,
    destroyed_date: (raw.destroyed_date as string) || null,
    requested_by: (raw.requested_by as string) || '',
    requested_by_name: (raw.requested_by_name as string) || '',
    approved_by: (raw.approved_by as string) || '',
    approved_by_name: (raw.approved_by_name as string) || '',
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    restoration_allowed: raw.restoration_allowed !== false,
    restoration_status: (raw.restoration_status as string) || null,
    restoration_reason: (raw.restoration_reason as string) || null,
    checksum: (raw.checksum as string) || '',
    checksum_verified: Boolean(raw.checksum_verified),
    checksum_verified_at: (raw.checksum_verified_at as string) || null,
    storage_class: (raw.storage_class as string) || 'Standard',
    storage_tier: (raw.storage_tier as string) || 'Primary',
    legal_hold: Boolean(raw.legal_hold),
    regulatory_hold: Boolean(raw.regulatory_hold),
    inspection_mode: Boolean(raw.inspection_mode),
    storage_bytes: (raw.storage_bytes as number) || 0,
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function emptyArchiveKpis(): ArchiveKpis {
  return {
    archivedDocuments: 0, pendingArchive: 0, restorationRequests: 0,
    retentionExpiring: 0, destroyedRecords: 0, legalHolds: 0,
    regulatoryHolds: 0, archiveStorageUsage: 0,
  };
}

export function emptyArchiveCharts(): ArchiveCharts {
  return {
    archiveTrend: [], documentTypeDistribution: [], archiveCategoryDistribution: [],
    departmentArchiveTrend: [], retentionExpiryTrend: [], restorationTrend: [],
  };
}

export function isRetentionExpiringSoon(r: ArchiveRecord): boolean {
  if (!r.retention_expiry_date || r.archive_status === 'Destroyed') return false;
  const days = daysUntil(r.retention_expiry_date);
  return days >= 0 && days <= RETENTION_WARNING_DAYS;
}

export function computeArchiveKpis(records: ArchiveRecord[]): ArchiveKpis {
  return {
    archivedDocuments: records.filter((r) => r.archive_status === 'Archived').length,
    pendingArchive: records.filter((r) => ['Pending', 'Approved'].includes(r.archive_status)).length,
    restorationRequests: records.filter((r) => r.archive_status === 'Restoration Requested').length,
    retentionExpiring: records.filter(isRetentionExpiringSoon).length,
    destroyedRecords: records.filter((r) => r.archive_status === 'Destroyed').length,
    legalHolds: records.filter((r) => r.legal_hold).length,
    regulatoryHolds: records.filter((r) => r.regulatory_hold).length,
    archiveStorageUsage: records.reduce((sum, r) => sum + (r.storage_bytes || 0), 0),
  };
}

export function computeArchiveCharts(records: ArchiveRecord[]): ArchiveCharts {
  const archiveByMonth = new Map<string, number>();
  const byType = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const deptByMonth = new Map<string, number>();
  const retentionByMonth = new Map<string, number>();
  const restoreByMonth = new Map<string, number>();

  for (const r of records) {
    byType.set(r.document_type || 'Unknown', (byType.get(r.document_type || 'Unknown') || 0) + 1);
    byCategory.set(r.archive_category || 'Unknown', (byCategory.get(r.archive_category || 'Unknown') || 0) + 1);
    if (r.archive_date) {
      const m = monthKey(r.archive_date);
      archiveByMonth.set(m, (archiveByMonth.get(m) || 0) + 1);
      deptByMonth.set(m, (deptByMonth.get(m) || 0) + 1);
    }
    if (r.retention_expiry_date) {
      retentionByMonth.set(monthKey(r.retention_expiry_date), (retentionByMonth.get(monthKey(r.retention_expiry_date)) || 0) + 1);
    }
    if (r.restoration_status === 'Approved' || r.archive_status === 'Restored') {
      const d = r.updated_at || r.archive_date;
      if (d) restoreByMonth.set(monthKey(d), (restoreByMonth.get(monthKey(d)) || 0) + 1);
    }
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

  return {
    archiveTrend: toSorted(archiveByMonth),
    documentTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    archiveCategoryDistribution: Array.from(byCategory.entries()).map(([name, value]) => ({ name, value })),
    departmentArchiveTrend: toSorted(deptByMonth),
    retentionExpiryTrend: toSorted(retentionByMonth),
    restorationTrend: toSorted(restoreByMonth),
  };
}

export function filterArchiveRecords(records: ArchiveRecord[], filters: ArchiveFilters): ArchiveRecord[] {
  let result = [...records];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.archive_number.toLowerCase().includes(q) ||
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q),
    );
  }
  if (filters.status) result = result.filter((r) => r.archive_status === filters.status);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.archive_category) result = result.filter((r) => r.archive_category === filters.archive_category);
  if (filters.pending) result = result.filter((r) => ['Pending', 'Approved'].includes(r.archive_status));
  if (filters.archived) result = result.filter((r) => r.archive_status === 'Archived');
  if (filters.restoration) result = result.filter((r) => r.archive_status === 'Restoration Requested');
  if (filters.retention_expiring) result = result.filter(isRetentionExpiringSoon);
  if (filters.destroyed) result = result.filter((r) => r.archive_status === 'Destroyed');
  if (filters.legal_hold) result = result.filter((r) => r.legal_hold);
  if (filters.regulatory_hold) result = result.filter((r) => r.regulatory_hold);
  if (filters.inspection_mode) result = result.filter((r) => r.inspection_mode);
  if (filters.department_only) result = result.filter((r) => r.department === filters.department_only);
  return result;
}

export const AM_KPI_FILTER_MAP: Record<string, ArchiveFilters> = {
  archived: { archived: true },
  pending: { pending: true },
  restoration: { restoration: true },
  retention: { retention_expiring: true },
  destroyed: { destroyed: true },
  legal: { legal_hold: true },
  regulatory: { regulatory_hold: true },
};

export function getRecentlyArchived(records: ArchiveRecord[]): ArchiveRecord[] {
  return records.filter((r) => r.archive_status === 'Archived')
    .sort((a, b) => (b.archive_date || '').localeCompare(a.archive_date || '')).slice(0, 50);
}
export function getPendingArchive(records: ArchiveRecord[]): ArchiveRecord[] {
  return records.filter((r) => ['Pending', 'Approved'].includes(r.archive_status));
}
export function getRestorationRequests(records: ArchiveRecord[]): ArchiveRecord[] {
  return records.filter((r) => r.archive_status === 'Restoration Requested');
}
export function getRetentionExpiring(records: ArchiveRecord[]): ArchiveRecord[] {
  return records.filter(isRetentionExpiringSoon);
}
export function getDestroyedRecords(records: ArchiveRecord[]): ArchiveRecord[] {
  return records.filter((r) => r.archive_status === 'Destroyed');
}
export function getLegalHoldRecords(records: ArchiveRecord[]): ArchiveRecord[] {
  return records.filter((r) => r.legal_hold || r.regulatory_hold);
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
