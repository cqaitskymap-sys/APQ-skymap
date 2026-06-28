import type {
  ExternalDocumentRecord, ExternalDocumentKpis, ExternalDocumentCharts,
  ExternalDocumentFilters, ExternalDocumentReview,
} from './external-document-types';
import {
  EXPIRY_WARNING_DAYS, isSupplierDocument, isRegulatoryDocument, isStandardsDocument,
} from './external-document-types';

function todayStr() { return new Date().toISOString().split('T')[0]; }
function monthKey(d: string) { return d.slice(0, 7); }

function daysUntil(dateStr: string): number {
  const ms = new Date(`${dateStr}T12:00:00`).getTime() - new Date(`${todayStr()}T12:00:00`).getTime();
  return Math.ceil(ms / 86400000);
}

export function mapExternalDocumentRaw(raw: Record<string, unknown> & { id: string }): ExternalDocumentRecord {
  return {
    id: raw.id,
    external_document_id: (raw.external_document_id as string) || raw.id,
    document_number: (raw.document_number as string) || '',
    external_reference_number: (raw.external_reference_number as string) || '',
    title: (raw.title as string) || '',
    short_title: (raw.short_title as string) || '',
    document_type: (raw.document_type as string) || '',
    document_category: (raw.document_category as string) || '',
    source_organization: (raw.source_organization as string) || '',
    source_contact: (raw.source_contact as string) || '',
    source_url: (raw.source_url as string) || '',
    issuing_authority: (raw.issuing_authority as string) || '',
    publication_date: (raw.publication_date as string) || null,
    revision_number: (raw.revision_number as string) || '1.0',
    revision_date: (raw.revision_date as string) || null,
    current_version: (raw.current_version as string) || '1.0',
    language: (raw.language as string) || 'English',
    country_region: (raw.country_region as string) || '',
    department_owner: (raw.department_owner as string) || '',
    business_unit: (raw.business_unit as string) || '',
    site: (raw.site as string) || '',
    risk_classification: (raw.risk_classification as string) || 'Medium',
    criticality: (raw.criticality as string) || 'Normal',
    review_frequency: (raw.review_frequency as string) || 'Annual',
    next_review_date: (raw.next_review_date as string) || null,
    status: (raw.status as string) || 'Draft',
    approval_required: raw.approval_required !== false,
    distribution_required: Boolean(raw.distribution_required),
    training_required: Boolean(raw.training_required),
    linked_internal_documents: Array.isArray(raw.linked_internal_documents)
      ? raw.linked_internal_documents as ExternalDocumentRecord['linked_internal_documents'] : [],
    supplier: (raw.supplier as string) || '',
    manufacturer: (raw.manufacturer as string) || '',
    effective_date: (raw.effective_date as string) || null,
    expiry_date: (raw.expiry_date as string) || null,
    electronic_signature_required: Boolean(raw.electronic_signature_required),
    revision_available: Boolean(raw.revision_available),
    owner_id: (raw.owner_id as string) || '',
    owner_name: (raw.owner_name as string) || '',
    created_by: (raw.created_by as string) || '',
    created_by_name: (raw.created_by_name as string) || '',
    updated_by: (raw.updated_by as string) || '',
    updated_by_name: (raw.updated_by_name as string) || '',
    created_at: (raw.created_at as string) || '',
    updated_at: (raw.updated_at as string) || '',
  };
}

export function mapReviewRaw(raw: Record<string, unknown> & { id: string }): ExternalDocumentReview {
  return {
    id: raw.id,
    review_id: (raw.review_id as string) || raw.id,
    document_id: (raw.document_id as string) || '',
    document_number: (raw.document_number as string) || '',
    reviewer_id: (raw.reviewer_id as string) || '',
    reviewer_name: (raw.reviewer_name as string) || '',
    review_due_date: (raw.review_due_date as string) || '',
    review_status: (raw.review_status as string) || 'Pending',
    review_outcome: (raw.review_outcome as string) || null,
    completed_at: (raw.completed_at as string) || null,
    created_at: (raw.created_at as string) || '',
  };
}

export function emptyExternalKpis(): ExternalDocumentKpis {
  return {
    totalDocuments: 0, approvedForUse: 0, pendingReviews: 0, expiringSoon: 0,
    supersededDocuments: 0, supplierDocuments: 0, regulatoryDocuments: 0, standardsDocuments: 0,
  };
}

export function emptyExternalCharts(): ExternalDocumentCharts {
  return {
    documentTypeDistribution: [], reviewStatus: [], departmentDistribution: [],
    sourceOrganizationDistribution: [], reviewTrend: [], revisionTrend: [],
  };
}

export function isExpiringSoon(d: ExternalDocumentRecord): boolean {
  if (!d.expiry_date || ['Obsolete', 'Archived', 'Expired'].includes(d.status)) return false;
  const days = daysUntil(d.expiry_date);
  return days >= 0 && days <= EXPIRY_WARNING_DAYS;
}

export function isReviewDue(d: ExternalDocumentRecord): boolean {
  if (!d.next_review_date) return false;
  return daysUntil(d.next_review_date) <= 30;
}

export function computeExternalKpis(records: ExternalDocumentRecord[], reviews: ExternalDocumentReview[]): ExternalDocumentKpis {
  return {
    totalDocuments: records.length,
    approvedForUse: records.filter((d) => ['Approved for Use', 'Effective'].includes(d.status)).length,
    pendingReviews: reviews.filter((r) => r.review_status === 'Pending').length +
      records.filter((d) => d.status === 'Pending Review').length,
    expiringSoon: records.filter(isExpiringSoon).length,
    supersededDocuments: records.filter((d) => d.status === 'Superseded').length,
    supplierDocuments: records.filter(isSupplierDocument).length,
    regulatoryDocuments: records.filter(isRegulatoryDocument).length,
    standardsDocuments: records.filter(isStandardsDocument).length,
  };
}

export function computeExternalCharts(records: ExternalDocumentRecord[], reviews: ExternalDocumentReview[]): ExternalDocumentCharts {
  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byDept = new Map<string, number>();
  const bySource = new Map<string, number>();
  const reviewByMonth = new Map<string, number>();
  const revisionByMonth = new Map<string, number>();

  for (const d of records) {
    byType.set(d.document_type || 'Unknown', (byType.get(d.document_type || 'Unknown') || 0) + 1);
    byStatus.set(d.status, (byStatus.get(d.status) || 0) + 1);
    byDept.set(d.department_owner || 'Unknown', (byDept.get(d.department_owner || 'Unknown') || 0) + 1);
    bySource.set(d.source_organization || 'Unknown', (bySource.get(d.source_organization || 'Unknown') || 0) + 1);
    if (d.revision_date) revisionByMonth.set(monthKey(d.revision_date), (revisionByMonth.get(monthKey(d.revision_date)) || 0) + 1);
  }
  for (const r of reviews.filter((x) => x.completed_at)) {
    reviewByMonth.set(monthKey(r.completed_at!), (reviewByMonth.get(monthKey(r.completed_at!)) || 0) + 1);
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

  return {
    documentTypeDistribution: Array.from(byType.entries()).map(([name, value]) => ({ name, value })),
    reviewStatus: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
    departmentDistribution: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })),
    sourceOrganizationDistribution: Array.from(bySource.entries()).slice(0, 10).map(([name, value]) => ({ name, value })),
    reviewTrend: toSorted(reviewByMonth),
    revisionTrend: toSorted(revisionByMonth),
  };
}

export function filterExternalDocuments(records: ExternalDocumentRecord[], filters: ExternalDocumentFilters): ExternalDocumentRecord[] {
  let result = [...records];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((d) =>
      d.title.toLowerCase().includes(q) || d.document_number.toLowerCase().includes(q) ||
      d.source_organization.toLowerCase().includes(q) || d.external_reference_number.toLowerCase().includes(q),
    );
  }
  if (filters.status) result = result.filter((d) => d.status === filters.status);
  if (filters.department) result = result.filter((d) => d.department_owner === filters.department);
  if (filters.document_type) result = result.filter((d) => d.document_type === filters.document_type);
  if (filters.document_category) result = result.filter((d) => d.document_category === filters.document_category);
  if (filters.pending_review) result = result.filter((d) => d.status === 'Pending Review');
  if (filters.approved) result = result.filter((d) => ['Approved for Use', 'Effective'].includes(d.status));
  if (filters.expiring) result = result.filter(isExpiringSoon);
  if (filters.superseded) result = result.filter((d) => d.status === 'Superseded');
  if (filters.supplier) result = result.filter(isSupplierDocument);
  if (filters.regulatory) result = result.filter(isRegulatoryDocument);
  if (filters.standards) result = result.filter(isStandardsDocument);
  if (filters.department_only) result = result.filter((d) => d.department_owner === filters.department_only);
  return result;
}

export const EDM_KPI_FILTER_MAP: Record<string, ExternalDocumentFilters> = {
  total: {},
  approved: { approved: true },
  review: { pending_review: true },
  expiring: { expiring: true },
  superseded: { superseded: true },
  supplier: { supplier: true },
  regulatory: { regulatory: true },
  standards: { standards: true },
};

export function getRecentlyAdded(records: ExternalDocumentRecord[]): ExternalDocumentRecord[] {
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}
export function getPendingReviewDocs(records: ExternalDocumentRecord[]): ExternalDocumentRecord[] {
  return records.filter((d) => d.status === 'Pending Review');
}
export function getUpcomingReviews(records: ExternalDocumentRecord[]): ExternalDocumentRecord[] {
  return records.filter(isReviewDue).sort((a, b) => (a.next_review_date || '').localeCompare(b.next_review_date || ''));
}
export function getExpiringDocs(records: ExternalDocumentRecord[]): ExternalDocumentRecord[] {
  return records.filter(isExpiringSoon);
}
export function getSupplierDocs(records: ExternalDocumentRecord[]): ExternalDocumentRecord[] {
  return records.filter(isSupplierDocument);
}
export function getRegulatoryDocs(records: ExternalDocumentRecord[]): ExternalDocumentRecord[] {
  return records.filter(isRegulatoryDocument);
}

export function addMonthsToDate(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}
