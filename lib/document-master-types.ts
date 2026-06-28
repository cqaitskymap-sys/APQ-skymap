export const DOCUMENT_MASTER_MODULE = 'Document Master';

export const DOCUMENT_MASTER_COLLECTIONS = {
  documents: 'documents',
  documentCategories: 'document_categories',
  documentTypes: 'document_types',
  documentMetadata: 'document_metadata',
  documentTags: 'document_tags',
  departments: 'departments',
  sites: 'sites',
  plants: 'plants',
  users: 'users',
  roles: 'roles',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
} as const;

export const DOCUMENT_CATEGORIES = [
  'SOP',
  'Policy',
  'Procedure',
  'Work Instruction',
  'Specification',
  'Protocol',
  'Validation',
  'Qualification',
  'Template',
  'Form',
  'Checklist',
  'Logbook',
  'Batch Record',
  'Manual',
  'Quality Agreement',
  'Regulatory Document',
  'Engineering Document',
  'IT Document',
] as const;

export const DOCUMENT_MASTER_STATUSES = [
  'Draft',
  'Under Review',
  'Pending Approval',
  'Approved',
  'Effective',
  'Superseded',
  'Archived',
  'Obsolete',
  'Retired',
  'Cancelled',
] as const;

export const CONFIDENTIALITY_LEVELS = [
  'Public',
  'Internal',
  'Confidential',
  'Restricted',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];
export type DocumentMasterStatus = (typeof DOCUMENT_MASTER_STATUSES)[number];

export interface DocumentMasterFilters {
  category?: string;
  department?: string;
  owner?: string;
  status?: string;
  version?: string;
  site?: string;
  plant?: string;
  language?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface DocumentMasterKpis {
  totalDocuments: number;
  effectiveDocuments: number;
  draftDocuments: number;
  pendingReview: number;
  pendingApproval: number;
  expiredDocuments: number;
  documentsDueForReview: number;
  archivedDocuments: number;
  obsoleteDocuments: number;
}

export interface DocumentMasterCharts {
  statusDistribution: { name: string; value: number }[];
  categoryDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  monthlyCreation: { month: string; count: number }[];
  reviewDueTrend: { month: string; count: number }[];
  versionTrend: { month: string; count: number }[];
  documentGrowth: { month: string; cumulative: number }[];
  approvalTrend: { month: string; count: number }[];
}

export interface DocumentMasterRecord {
  id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  short_title: string;
  document_category: string;
  document_type: string;
  department: string;
  business_unit: string;
  site: string;
  plant: string;
  process: string;
  sub_process: string;
  owner: string;
  owner_name: string;
  author: string;
  author_name: string;
  reviewer: string;
  reviewer_name: string;
  approver: string;
  approver_name: string;
  document_status: DocumentMasterStatus | string;
  version: string;
  major_version: number;
  minor_version: number;
  revision_number: number;
  effective_date: string | null;
  review_due_date: string | null;
  expiry_date: string | null;
  language: string;
  country: string;
  region: string;
  keywords: string[];
  tags: string[];
  confidentiality: string;
  classification: string;
  training_required: boolean;
  change_control_required: boolean;
  electronic_signature_required: boolean;
  current_workflow: string;
  linked_training: string | null;
  linked_change_control: string | null;
  linked_capa: string | null;
  linked_deviation: string | null;
  linked_risk_assessment: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
  is_latest: boolean;
  is_favorite?: boolean;
  is_read_only: boolean;
  product_name?: string;
}

export interface DocumentMasterTableRow {
  id: string;
  document_number: string;
  document_title: string;
  document_category: string;
  department: string;
  owner_name: string;
  document_status: string;
  version: string;
  effective_date: string | null;
  review_due_date: string | null;
  updated_at: string;
}

export interface DocumentMasterActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN_ROLES = ['super_admin', 'admin'];
const DOC_CONTROLLER_ROLES = [
  ...ADMIN_ROLES,
  'regulatory_affairs',
  'head_qa',
  'qa_manager',
];
const QA_ROLES = [...ADMIN_ROLES, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD_ROLES = [
  ...ADMIN_ROLES,
  'head_qa',
  'qa_manager',
  'production_manager',
  'qc_manager',
  'engineering_manager',
  'warehouse_manager',
];
const AUTHOR_ROLES = [
  ...DOC_CONTROLLER_ROLES,
  'production_manager',
  'qc_manager',
  'engineering_manager',
];
const AUDITOR_ROLES = ['auditor', 'viewer'];

export function canViewDocumentMaster(role: string): boolean {
  return true;
}

export function canCreateDocumentMaster(role: string): boolean {
  return DOC_CONTROLLER_ROLES.includes(role) || AUTHOR_ROLES.includes(role);
}

export function canEditDocumentMaster(role: string, record?: DocumentMasterRecord, actorId?: string): boolean {
  if (record?.is_read_only) return false;
  if (DOC_CONTROLLER_ROLES.includes(role)) return true;
  if (AUTHOR_ROLES.includes(role) && record && actorId) {
    return record.document_status === 'Draft' && record.author === actorId;
  }
  return false;
}

export function canReviewDocumentMaster(role: string): boolean {
  return QA_ROLES.includes(role) || DEPT_HEAD_ROLES.includes(role);
}

export function canApproveDocumentMaster(role: string): boolean {
  return QA_ROLES.includes(role) || DEPT_HEAD_ROLES.includes(role);
}

export function canArchiveDocumentMaster(role: string): boolean {
  return DOC_CONTROLLER_ROLES.includes(role);
}

export function canBulkDocumentMaster(role: string): boolean {
  return DOC_CONTROLLER_ROLES.includes(role);
}

export function canExportDocumentMaster(role: string): boolean {
  return !AUDITOR_ROLES.includes(role) || role === 'auditor';
}

export function isDocumentMasterReadOnly(role: string): boolean {
  return AUDITOR_ROLES.includes(role);
}

export function canViewEffectiveOnly(role: string): boolean {
  return role === 'viewer';
}

export function mapDmsStatusToMaster(status: string, isLatest: boolean): DocumentMasterStatus {
  if (!isLatest && status === 'effective') return 'Superseded';
  if (!isLatest && status === 'obsolete') return 'Superseded';
  const map: Record<string, DocumentMasterStatus> = {
    draft: 'Draft',
    under_review: 'Under Review',
    returned_for_correction: 'Under Review',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    effective: 'Effective',
    superseded: 'Superseded',
    archived: 'Archived',
    obsolete: 'Obsolete',
    retired: 'Retired',
    cancelled: 'Cancelled',
  };
  return map[status] ?? 'Draft';
}

export function mapMasterStatusToDms(status: string): string {
  const map: Record<string, string> = {
    Draft: 'draft',
    'Under Review': 'under_review',
    'Pending Approval': 'pending_approval',
    Approved: 'approved',
    Effective: 'effective',
    Superseded: 'superseded',
    Archived: 'archived',
    Obsolete: 'obsolete',
    Retired: 'retired',
    Cancelled: 'cancelled',
  };
  return map[status] ?? status.toLowerCase().replace(/\s+/g, '_');
}

export function masterStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function parseVersionParts(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0] || '1', 10) || 1,
    minor: parseInt(parts[1] || '0', 10) || 0,
  };
}

export function isDocumentExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return expiryDate < new Date().toISOString().split('T')[0];
}

export function isReviewDue(reviewDueDate: string | null, daysAhead = 30): boolean {
  if (!reviewDueDate) return false;
  const due = new Date(reviewDueDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysAhead);
  return due <= threshold;
}

export function isDocumentReadOnly(status: string, isLatest: boolean): boolean {
  const readOnlyStatuses = ['Superseded', 'Archived', 'Obsolete', 'Retired', 'Cancelled'];
  return readOnlyStatuses.includes(status) || (!isLatest && status !== 'Draft');
}

export const CATEGORY_PREFIX: Record<string, string> = {
  SOP: 'SOP',
  Policy: 'POL',
  Procedure: 'PRO',
  'Work Instruction': 'WI',
  Specification: 'SPEC',
  Protocol: 'PROT',
  Validation: 'VAL',
  Qualification: 'QUAL',
  Template: 'TPL',
  Form: 'FRM',
  Checklist: 'CHK',
  Logbook: 'LOG',
  'Batch Record': 'BMR',
  Manual: 'MAN',
  'Quality Agreement': 'QA',
  'Regulatory Document': 'REG',
  'Engineering Document': 'ENG',
  'IT Document': 'IT',
};
