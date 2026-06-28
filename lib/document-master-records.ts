import type { DocumentRecord } from './dms-types';
import type {
  DocumentMasterRecord,
  DocumentMasterKpis,
  DocumentMasterCharts,
  DocumentMasterFilters,
  DocumentMasterTableRow,
} from './document-master-types';
import {
  mapDmsStatusToMaster,
  parseVersionParts,
  isDocumentExpired,
  isReviewDue,
  isDocumentReadOnly,
} from './document-master-types';

export function normalizeDocumentCategory(documentType: string): string {
  const typeMap: Record<string, string> = {
    SOP: 'SOP',
    STP: 'Work Instruction',
    Specification: 'Specification',
    BMR: 'Batch Record',
    BPR: 'Batch Record',
    MFR: 'Batch Record',
    Protocol: 'Protocol',
    Report: 'Regulatory Document',
    PQR: 'Regulatory Document',
    'CPV Report': 'Regulatory Document',
    'Validation Document': 'Validation',
    'Calibration Document': 'Qualification',
    'Training Document': 'Manual',
    Policy: 'Policy',
    Form: 'Form',
    Other: 'Procedure',
  };
  return typeMap[documentType] ?? documentType;
}

export function mapDocumentToMaster(raw: DocumentRecord & Record<string, unknown>): DocumentMasterRecord {
  const isLatest = raw.is_latest !== false;
  const status = mapDmsStatusToMaster(raw.status, isLatest);
  const versionParts = parseVersionParts(raw.version || '1.0');
  const meta = raw as Record<string, unknown>;

  return {
    id: raw.id,
    document_id: raw.id,
    document_number: raw.document_number,
    document_title: raw.document_title,
    short_title: (meta.short_title as string) || raw.document_title.slice(0, 60),
    document_category: (meta.document_category as string) || normalizeDocumentCategory(raw.document_type),
    document_type: raw.document_type,
    department: raw.department,
    business_unit: (meta.business_unit as string) || '',
    site: (meta.site as string) || '',
    plant: (meta.plant as string) || '',
    process: (meta.process as string) || '',
    sub_process: (meta.sub_process as string) || '',
    owner: (meta.owner as string) || raw.prepared_by || raw.created_by,
    owner_name: (meta.owner_name as string) || raw.prepared_by_name || raw.created_by_name,
    author: raw.prepared_by || raw.created_by,
    author_name: raw.prepared_by_name || raw.created_by_name,
    reviewer: raw.reviewed_by || '',
    reviewer_name: raw.reviewed_by_name || '',
    approver: raw.approved_by || '',
    approver_name: raw.approved_by_name || '',
    document_status: status,
    version: raw.version || '1.0',
    major_version: (meta.major_version as number) ?? versionParts.major,
    minor_version: (meta.minor_version as number) ?? versionParts.minor,
    revision_number: raw.revision_number ?? 1,
    effective_date: raw.effective_date,
    review_due_date: raw.next_review_date,
    expiry_date: (meta.expiry_date as string) || null,
    language: (meta.language as string) || 'English',
    country: (meta.country as string) || '',
    region: (meta.region as string) || '',
    keywords: (meta.keywords as string[]) || [],
    tags: (meta.tags as string[]) || [],
    confidentiality: (meta.confidentiality as string) || 'Internal',
    classification: (meta.classification as string) || '',
    training_required: raw.training_required ?? false,
    change_control_required: Boolean(raw.change_control_ref || raw.change_control_id),
    electronic_signature_required: (meta.electronic_signature_required as boolean) ?? true,
    current_workflow: (meta.current_workflow as string) || raw.status,
    linked_training: (meta.linked_training as string) || null,
    linked_change_control: raw.change_control_ref || raw.change_control_id || null,
    linked_capa: (meta.linked_capa as string) || null,
    linked_deviation: (meta.linked_deviation as string) || null,
    linked_risk_assessment: (meta.linked_risk_assessment as string) || null,
    created_by: raw.created_by,
    created_by_name: raw.created_by_name,
    updated_by: raw.updated_by,
    updated_by_name: raw.updated_by_name,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    is_latest: isLatest,
    is_favorite: Boolean(meta.is_favorite),
    is_read_only: isDocumentReadOnly(status, isLatest),
    product_name: raw.product_name,
  };
}

export function toTableRow(record: DocumentMasterRecord): DocumentMasterTableRow {
  return {
    id: record.id,
    document_number: record.document_number,
    document_title: record.document_title,
    document_category: record.document_category,
    department: record.department,
    owner_name: record.owner_name,
    document_status: record.document_status,
    version: record.version,
    effective_date: record.effective_date,
    review_due_date: record.review_due_date,
    updated_at: record.updated_at,
  };
}

export function emptyDocumentMasterKpis(): DocumentMasterKpis {
  return {
    totalDocuments: 0,
    effectiveDocuments: 0,
    draftDocuments: 0,
    pendingReview: 0,
    pendingApproval: 0,
    expiredDocuments: 0,
    documentsDueForReview: 0,
    archivedDocuments: 0,
    obsoleteDocuments: 0,
  };
}

export function emptyDocumentMasterCharts(): DocumentMasterCharts {
  return {
    statusDistribution: [],
    categoryDistribution: [],
    departmentDistribution: [],
    monthlyCreation: [],
    reviewDueTrend: [],
    versionTrend: [],
    documentGrowth: [],
    approvalTrend: [],
  };
}

function inDateRange(dateStr: string | null | undefined, from?: string, to?: string): boolean {
  if (!dateStr) return !from && !to;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function filterDocumentMasterRecords(
  records: DocumentMasterRecord[],
  filters?: DocumentMasterFilters,
): DocumentMasterRecord[] {
  let rows = [...records];

  if (filters?.category) {
    rows = rows.filter((r) => r.document_category === filters.category);
  }
  if (filters?.department) {
    rows = rows.filter((r) => r.department === filters.department);
  }
  if (filters?.owner) {
    rows = rows.filter((r) => r.owner_name === filters.owner || r.owner === filters.owner);
  }
  if (filters?.status) {
    rows = rows.filter((r) => r.document_status === filters.status);
  }
  if (filters?.version) {
    rows = rows.filter((r) => r.version === filters.version);
  }
  if (filters?.site) {
    rows = rows.filter((r) => r.site === filters.site);
  }
  if (filters?.plant) {
    rows = rows.filter((r) => r.plant === filters.plant);
  }
  if (filters?.language) {
    rows = rows.filter((r) => r.language === filters.language);
  }
  if (filters?.date_from || filters?.date_to) {
    rows = rows.filter((r) => inDateRange(r.created_at?.split('T')[0], filters.date_from, filters.date_to));
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    rows = rows.filter((r) =>
      r.document_number.toLowerCase().includes(q)
      || r.document_title.toLowerCase().includes(q)
      || r.short_title.toLowerCase().includes(q)
      || r.owner_name.toLowerCase().includes(q)
      || r.department.toLowerCase().includes(q)
      || r.document_category.toLowerCase().includes(q)
      || r.tags.some((t) => t.toLowerCase().includes(q))
      || r.keywords.some((k) => k.toLowerCase().includes(q))
      || (r.product_name?.toLowerCase().includes(q) ?? false),
    );
  }

  return rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function computeDocumentMasterKpis(records: DocumentMasterRecord[]): DocumentMasterKpis {
  return {
    totalDocuments: records.length,
    effectiveDocuments: records.filter((r) => r.document_status === 'Effective').length,
    draftDocuments: records.filter((r) => r.document_status === 'Draft').length,
    pendingReview: records.filter((r) => r.document_status === 'Under Review').length,
    pendingApproval: records.filter((r) => r.document_status === 'Pending Approval' || r.document_status === 'Approved').length,
    expiredDocuments: records.filter((r) => isDocumentExpired(r.expiry_date)).length,
    documentsDueForReview: records.filter((r) =>
      r.document_status === 'Effective' && isReviewDue(r.review_due_date),
    ).length,
    archivedDocuments: records.filter((r) => r.document_status === 'Archived').length,
    obsoleteDocuments: records.filter((r) => r.document_status === 'Obsolete').length,
  };
}

export function computeDocumentMasterCharts(records: DocumentMasterRecord[]): DocumentMasterCharts {
  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byDept: Record<string, number> = {};
  const monthlyCreation: Record<string, number> = {};
  const reviewDueTrend: Record<string, number> = {};
  const versionTrend: Record<string, number> = {};
  const approvalTrend: Record<string, number> = {};
  const growthByMonth: Record<string, number> = {};

  for (const r of records) {
    byStatus[r.document_status] = (byStatus[r.document_status] || 0) + 1;
    byCategory[r.document_category] = (byCategory[r.document_category] || 0) + 1;
    byDept[r.department] = (byDept[r.department] || 0) + 1;

    const month = r.created_at?.slice(0, 7) ?? 'unknown';
    monthlyCreation[month] = (monthlyCreation[month] || 0) + 1;
    growthByMonth[month] = (growthByMonth[month] || 0) + 1;

    if (r.revision_number > 1) {
      versionTrend[month] = (versionTrend[month] || 0) + 1;
    }

    if (r.review_due_date && isReviewDue(r.review_due_date, 90)) {
      const rm = r.review_due_date.slice(0, 7);
      reviewDueTrend[rm] = (reviewDueTrend[rm] || 0) + 1;
    }

    if (['Approved', 'Effective'].includes(r.document_status) && r.updated_at) {
      const am = r.updated_at.slice(0, 7);
      approvalTrend[am] = (approvalTrend[am] || 0) + 1;
    }
  }

  const toChart = (obj: Record<string, number>) =>
    Object.entries(obj)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

  const sortedMonths = Object.keys(growthByMonth).sort();
  let cumulative = 0;
  const documentGrowth = sortedMonths.map((month) => {
    cumulative += growthByMonth[month];
    return { month, cumulative };
  });

  return {
    statusDistribution: toChart(byStatus),
    categoryDistribution: toChart(byCategory),
    departmentDistribution: toChart(byDept),
    monthlyCreation: sortedMonths.map((month) => ({ month, count: monthlyCreation[month] || 0 })),
    reviewDueTrend: Object.entries(reviewDueTrend).sort().map(([month, count]) => ({ month, count })),
    versionTrend: Object.entries(versionTrend).sort().map(([month, count]) => ({ month, count })),
    documentGrowth,
    approvalTrend: Object.entries(approvalTrend).sort().map(([month, count]) => ({ month, count })),
  };
}

export function buildDocumentMasterTables(records: DocumentMasterRecord[]) {
  const recentDocuments = records.slice(0, 15).map(toTableRow);
  const pendingReviews = records
    .filter((r) => r.document_status === 'Under Review')
    .slice(0, 10)
    .map(toTableRow);
  const pendingApprovals = records
    .filter((r) => r.document_status === 'Pending Approval' || r.document_status === 'Approved')
    .slice(0, 10)
    .map(toTableRow);
  const recentlyUpdated = [...records]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10)
    .map(toTableRow);
  const expiredDocuments = records
    .filter((r) => isDocumentExpired(r.expiry_date))
    .slice(0, 10)
    .map(toTableRow);
  const documentsDueForReview = records
    .filter((r) => r.document_status === 'Effective' && isReviewDue(r.review_due_date))
    .slice(0, 10)
    .map(toTableRow);

  return {
    recentDocuments,
    pendingReviews,
    pendingApprovals,
    recentlyUpdated,
    expiredDocuments,
    documentsDueForReview,
  };
}

export type DocumentMasterData = {
  records: DocumentMasterRecord[];
  kpis: DocumentMasterKpis;
  charts: DocumentMasterCharts;
  tables: ReturnType<typeof buildDocumentMasterTables>;
  filterOptions: {
    categories: string[];
    departments: string[];
    owners: string[];
    statuses: string[];
    sites: string[];
    plants: string[];
    languages: string[];
  };
};

export function buildFilterOptions(records: DocumentMasterRecord[]) {
  const uniq = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort();
  return {
    categories: uniq(records.map((r) => r.document_category)),
    departments: uniq(records.map((r) => r.department)),
    owners: uniq(records.map((r) => r.owner_name)),
    statuses: uniq(records.map((r) => r.document_status)),
    sites: uniq(records.map((r) => r.site)),
    plants: uniq(records.map((r) => r.plant)),
    languages: uniq(records.map((r) => r.language)),
  };
}
