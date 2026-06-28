export const EDM_MODULE = 'External Document Management';

export const EDM_COLLECTIONS = {
  documents: 'external_documents',
  versions: 'external_document_versions',
  reviews: 'external_document_reviews',
  distribution: 'external_document_distribution',
  sources: 'external_document_sources',
  categories: 'external_document_categories',
  supplierDocs: 'supplier_documents',
  regulatoryDocs: 'regulatory_documents',
  standardsDocs: 'standards_documents',
  safetyDocs: 'safety_documents',
  linkedInternal: 'linked_internal_documents',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  signatures: 'electronic_signatures',
  internalDocuments: 'documents',
  users: 'users',
  roles: 'roles',
} as const;

export const EXTERNAL_DOC_TYPES = [
  'Regulation', 'Guideline', 'Standard', 'Pharmacopoeia', 'Supplier Document',
  'Equipment Manual', 'Calibration Procedure', 'Safety Data Sheet (SDS)', 'Certificate',
  'Customer Specification', 'Technical Bulletin', 'Policy', 'Reference Manual',
] as const;

export const EXTERNAL_DOC_CATEGORIES = [
  'Regulatory', 'Quality', 'Engineering', 'Manufacturing', 'Laboratory',
  'Validation', 'IT', 'Maintenance', 'EHS', 'Warehouse', 'Procurement',
] as const;

export const EXTERNAL_DOC_STATUSES = [
  'Draft', 'Pending Review', 'Approved for Use', 'Effective',
  'Superseded', 'Obsolete', 'Archived', 'Expired',
] as const;

export const REVIEW_FREQUENCIES = [
  'Quarterly', 'Semi-Annual', 'Annual', 'Every 2 Years', 'Every 3 Years', 'Custom',
] as const;

export const RISK_CLASSIFICATIONS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type ExternalDocType = (typeof EXTERNAL_DOC_TYPES)[number];
export type ExternalDocCategory = (typeof EXTERNAL_DOC_CATEGORIES)[number];
export type ExternalDocStatus = (typeof EXTERNAL_DOC_STATUSES)[number];

export interface LinkedInternalDocument {
  id: string;
  internal_document_id: string;
  internal_document_number: string;
  internal_document_title: string;
  link_type: string;
  linked_at: string;
}

export interface ExternalDocumentVersion {
  id: string;
  version_id: string;
  document_id: string;
  revision_number: string;
  revision_date: string;
  change_summary: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface ExternalDocumentReview {
  id: string;
  review_id: string;
  document_id: string;
  document_number: string;
  reviewer_id: string;
  reviewer_name: string;
  review_due_date: string;
  review_status: string;
  review_outcome: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ExternalDocumentRecord {
  id: string;
  external_document_id: string;
  document_number: string;
  external_reference_number: string;
  title: string;
  short_title: string;
  document_type: ExternalDocType | string;
  document_category: ExternalDocCategory | string;
  source_organization: string;
  source_contact: string;
  source_url: string;
  issuing_authority: string;
  publication_date: string | null;
  revision_number: string;
  revision_date: string | null;
  current_version: string;
  language: string;
  country_region: string;
  department_owner: string;
  business_unit: string;
  site: string;
  risk_classification: string;
  criticality: string;
  review_frequency: string;
  next_review_date: string | null;
  status: ExternalDocStatus | string;
  approval_required: boolean;
  distribution_required: boolean;
  training_required: boolean;
  linked_internal_documents: LinkedInternalDocument[];
  supplier: string;
  manufacturer: string;
  effective_date: string | null;
  expiry_date: string | null;
  electronic_signature_required: boolean;
  revision_available: boolean;
  owner_id: string;
  owner_name: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalDocumentKpis {
  totalDocuments: number;
  approvedForUse: number;
  pendingReviews: number;
  expiringSoon: number;
  supersededDocuments: number;
  supplierDocuments: number;
  regulatoryDocuments: number;
  standardsDocuments: number;
}

export interface ExternalDocumentCharts {
  documentTypeDistribution: { name: string; value: number }[];
  reviewStatus: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  sourceOrganizationDistribution: { name: string; value: number }[];
  reviewTrend: { month: string; count: number }[];
  revisionTrend: { month: string; count: number }[];
}

export interface ExternalDocumentFilters {
  status?: string;
  department?: string;
  document_type?: string;
  document_category?: string;
  search?: string;
  pending_review?: boolean;
  approved?: boolean;
  expiring?: boolean;
  superseded?: boolean;
  supplier?: boolean;
  regulatory?: boolean;
  standards?: boolean;
  department_only?: string;
}

export interface ExternalDocumentActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'document_controller', 'regulatory_affairs', 'head_qa'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewExternalDocuments(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || DEPT_HEAD.includes(role)
    || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canManageExternalDocuments(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApproveExternalDocument(role: string): boolean { return QA.includes(role); }
export function canReviewExternalDocument(role: string): boolean {
  return QA.includes(role) || DEPT_HEAD.includes(role) || DOC_CONTROLLER.includes(role);
}
export function isExternalDocumentReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportExternalDocuments(role: string): boolean { return canViewExternalDocuments(role); }
export function isEmployeeApprovedView(role: string): boolean {
  return EMPLOYEE.includes(role) && !DOC_CONTROLLER.includes(role) && !QA.includes(role);
}

export function externalDocStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Review': 'bg-amber-100 text-amber-800',
    'Approved for Use': 'bg-blue-100 text-blue-800',
    Effective: 'bg-green-100 text-green-800',
    Superseded: 'bg-gray-100 text-gray-600',
    Obsolete: 'bg-red-100 text-red-800',
    Archived: 'bg-purple-100 text-purple-800',
    Expired: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || colors.Draft;
}

export const EXPIRY_WARNING_DAYS = 90;

export function frequencyToMonths(frequency: string): number {
  const map: Record<string, number> = {
    Quarterly: 3, 'Semi-Annual': 6, Annual: 12,
    'Every 2 Years': 24, 'Every 3 Years': 36,
  };
  return map[frequency] || 12;
}

export function isSupplierDocument(d: ExternalDocumentRecord): boolean {
  return d.document_type === 'Supplier Document' || d.document_category === 'Procurement';
}
export function isRegulatoryDocument(d: ExternalDocumentRecord): boolean {
  return d.document_category === 'Regulatory' ||
    ['Regulation', 'Guideline', 'Pharmacopoeia'].includes(d.document_type);
}
export function isStandardsDocument(d: ExternalDocumentRecord): boolean {
  return d.document_type === 'Standard' || d.document_category === 'Quality';
}
