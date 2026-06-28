import type { DocumentRecord } from './dms-types';
import type {
  DocumentVersionRecord, VersionControlKpis, VersionControlCharts, VersionControlFilters,
} from './document-version-control-types';
import {
  parseVersionNumber, mapDmsStatusToVersionStatus, inferRevisionType,
} from './document-version-control-types';

export function mapDocumentToVersion(
  doc: DocumentRecord,
  meta?: Record<string, unknown>,
  effectiveVersion?: string | null,
): DocumentVersionRecord {
  const m = meta || {};
  const vp = parseVersionNumber(doc.version || '1.0');
  const isLatest = doc.is_latest !== false;
  const prevVersion = doc.supersedes_document_id ? (m.previous_version as string) || null : null;

  return {
    id: doc.id,
    version_id: (m.version_id as string) || doc.id,
    version_number: doc.version || '1.0',
    major_version: (m.major_version as number) ?? vp.major,
    minor_version: (m.minor_version as number) ?? vp.minor,
    revision_number: doc.revision_number || 1,
    document_id: doc.id,
    document_number: doc.document_number,
    document_title: doc.document_title,
    document_type: doc.document_type,
    department: doc.department,
    previous_version: prevVersion || (doc.revision_number > 1 ? 'prior' : null),
    next_version: (m.next_version as string) || null,
    current_effective_version: effectiveVersion || (doc.status === 'effective' ? doc.version : null),
    revision_type: (m.revision_type as string) || (prevVersion ? inferRevisionType(prevVersion, doc.version) : 'Major'),
    revision_reason: doc.reason_for_revision || (m.revision_reason as string) || '',
    change_summary: (m.change_summary as string) || doc.remarks || '',
    change_control_id: doc.change_control_id || (m.change_control_id as string) || null,
    training_required: doc.training_required ?? Boolean(m.training_required),
    electronic_signature_required: Boolean(m.electronic_signature_required),
    review_required: m.review_required !== false,
    approval_required: m.approval_required !== false,
    status: (m.status as string) || mapDmsStatusToVersionStatus(doc.status, isLatest),
    author: doc.prepared_by || doc.created_by,
    author_name: doc.prepared_by_name || doc.created_by_name,
    reviewer: doc.reviewed_by || '',
    reviewer_name: doc.reviewed_by_name || '',
    approver: doc.approved_by || '',
    approver_name: doc.approved_by_name || '',
    is_latest: isLatest,
    is_effective: doc.status === 'effective',
    parent_document_id: doc.parent_document_id,
    rollback_status: (m.rollback_status as string) || null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    created_by: doc.created_by,
    created_by_name: doc.created_by_name,
    updated_by: doc.updated_by,
    updated_by_name: doc.updated_by_name,
  };
}

export function mapVersionRaw(raw: Record<string, unknown> & { id: string }): DocumentVersionRecord {
  const vp = parseVersionNumber((raw.version_number as string) || '1.0');
  return {
    id: raw.id,
    version_id: (raw.version_id as string) || raw.id,
    version_number: (raw.version_number as string) || '1.0',
    major_version: (raw.major_version as number) ?? vp.major,
    minor_version: (raw.minor_version as number) ?? vp.minor,
    revision_number: (raw.revision_number as number) || 1,
    document_id: (raw.document_id as string) || raw.id,
    document_number: (raw.document_number as string) || '',
    document_title: (raw.document_title as string) || '',
    document_type: (raw.document_type as string) || '',
    department: (raw.department as string) || '',
    previous_version: (raw.previous_version as string) || null,
    next_version: (raw.next_version as string) || null,
    current_effective_version: (raw.current_effective_version as string) || null,
    revision_type: (raw.revision_type as string) || 'Minor',
    revision_reason: (raw.revision_reason as string) || '',
    change_summary: (raw.change_summary as string) || '',
    change_control_id: (raw.change_control_id as string) || null,
    training_required: Boolean(raw.training_required),
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    review_required: raw.review_required !== false,
    approval_required: raw.approval_required !== false,
    status: (raw.status as string) || 'Draft',
    author: (raw.author as string) || '',
    author_name: (raw.author_name as string) || '',
    reviewer: (raw.reviewer as string) || '',
    reviewer_name: (raw.reviewer_name as string) || '',
    approver: (raw.approver as string) || '',
    approver_name: (raw.approver_name as string) || '',
    is_latest: raw.is_latest !== false,
    is_effective: Boolean(raw.is_effective),
    parent_document_id: (raw.parent_document_id as string) || null,
    rollback_status: (raw.rollback_status as string) || null,
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
  };
}

export function emptyVersionKpis(): VersionControlKpis {
  return {
    totalVersions: 0, currentEffective: 0, draftVersions: 0, pendingReview: 0,
    pendingApproval: 0, supersededVersions: 0, archivedVersions: 0, majorRevisions: 0, minorRevisions: 0,
  };
}

export function emptyVersionCharts(): VersionControlCharts {
  return {
    versionGrowthTrend: [], revisionTypeDistribution: [], documentTypeDistribution: [],
    departmentDistribution: [], approvalTimeline: [], supersededTrend: [],
  };
}

export function computeVersionKpis(records: DocumentVersionRecord[]): VersionControlKpis {
  return {
    totalVersions: records.length,
    currentEffective: records.filter((r) => r.status === 'Effective' || r.is_effective).length,
    draftVersions: records.filter((r) => r.status === 'Draft').length,
    pendingReview: records.filter((r) => r.status === 'Under Review').length,
    pendingApproval: records.filter((r) => r.status === 'Pending Approval').length,
    supersededVersions: records.filter((r) => r.status === 'Superseded' || r.status === 'Obsolete').length,
    archivedVersions: records.filter((r) => r.status === 'Archived').length,
    majorRevisions: records.filter((r) => r.revision_type === 'Major' || r.revision_type === 'Emergency').length,
    minorRevisions: records.filter((r) => r.revision_type === 'Minor').length,
  };
}

export function computeVersionCharts(records: DocumentVersionRecord[]): VersionControlCharts {
  const byMonth = new Map<string, number>();
  const byType = new Map<string, number>();
  const byDocType = new Map<string, number>();
  const byDept = new Map<string, number>();
  const approvalByMonth = new Map<string, number>();
  const supersededByMonth = new Map<string, number>();
  const revType = new Map<string, number>();

  for (const r of records) {
    const m = (r.created_at || '').slice(0, 7);
    if (m) byMonth.set(m, (byMonth.get(m) || 0) + 1);
    revType.set(r.revision_type, (revType.get(r.revision_type) || 0) + 1);
    byDocType.set(r.document_type || 'Other', (byDocType.get(r.document_type || 'Other') || 0) + 1);
    byDept.set(r.department || 'Unassigned', (byDept.get(r.department || 'Unassigned') || 0) + 1);
    if (r.status === 'Approved' || r.status === 'Effective') {
      const am = (r.updated_at || r.created_at || '').slice(0, 7);
      if (am) approvalByMonth.set(am, (approvalByMonth.get(am) || 0) + 1);
    }
    if (r.status === 'Superseded' || r.status === 'Obsolete') {
      const sm = (r.updated_at || '').slice(0, 7);
      if (sm) supersededByMonth.set(sm, (supersededByMonth.get(sm) || 0) + 1);
    }
  }

  return {
    versionGrowthTrend: Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    revisionTypeDistribution: Array.from(revType.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    documentTypeDistribution: Array.from(byDocType.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    departmentDistribution: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    approvalTimeline: Array.from(approvalByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
    supersededTrend: Array.from(supersededByMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, count]) => ({ month, count })),
  };
}

export function filterVersionRecords(records: DocumentVersionRecord[], filters: VersionControlFilters): DocumentVersionRecord[] {
  let result = [...records];
  if (filters.status) result = result.filter((r) => r.status === filters.status);
  if (filters.revision_type) result = result.filter((r) => r.revision_type === filters.revision_type);
  if (filters.document_type) result = result.filter((r) => r.document_type === filters.document_type);
  if (filters.department) result = result.filter((r) => r.department === filters.department);
  if (filters.effective_only) result = result.filter((r) => r.is_effective || r.status === 'Effective');
  if (filters.latest_only) result = result.filter((r) => r.is_latest);
  if (filters.major_only) result = result.filter((r) => r.revision_type === 'Major' || r.revision_type === 'Emergency');
  if (filters.minor_only) result = result.filter((r) => r.revision_type === 'Minor');
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((r) =>
      r.document_number.toLowerCase().includes(q) ||
      r.document_title.toLowerCase().includes(q) ||
      r.version_number.toLowerCase().includes(q),
    );
  }
  return result;
}

export function getCurrentVersions(records: DocumentVersionRecord[]) {
  const byNumber = new Map<string, DocumentVersionRecord>();
  for (const r of records) {
    const ex = byNumber.get(r.document_number);
    if (!ex || r.is_latest) byNumber.set(r.document_number, r);
  }
  return Array.from(byNumber.values());
}

export function getVersionHistory(records: DocumentVersionRecord[]) {
  return [...records].sort((a, b) => b.revision_number - a.revision_number || b.created_at.localeCompare(a.created_at));
}

export function getPendingRevisions(records: DocumentVersionRecord[]) {
  return records.filter((r) => ['Draft', 'Under Review', 'Pending Approval'].includes(r.status));
}

export function getRecentMajorRevisions(records: DocumentVersionRecord[]) {
  return records.filter((r) => r.revision_type === 'Major' || r.revision_type === 'Emergency')
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
}

export function getRecentMinorRevisions(records: DocumentVersionRecord[]) {
  return records.filter((r) => r.revision_type === 'Minor')
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
}

export function getArchivedVersions(records: DocumentVersionRecord[]) {
  return records.filter((r) => r.status === 'Archived' || r.status === 'Retired');
}

export function buildVersionLineage(records: DocumentVersionRecord[], documentNumber: string): DocumentVersionRecord[] {
  return records
    .filter((r) => r.document_number === documentNumber)
    .sort((a, b) => a.revision_number - b.revision_number);
}

export const VERSION_KPI_FILTER_MAP: Record<string, Partial<VersionControlFilters>> = {
  effective: { effective_only: true },
  draft: { status: 'Draft' },
  pending_review: { status: 'Under Review' },
  pending_approval: { status: 'Pending Approval' },
  superseded: { status: 'Superseded' },
  archived: { status: 'Archived' },
  major: { major_only: true },
  minor: { minor_only: true },
};
