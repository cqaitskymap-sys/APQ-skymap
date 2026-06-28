export const AM_MODULE = 'Archive Management';

export const AM_COLLECTIONS = {
  archives: 'document_archive',
  jobs: 'archive_jobs',
  policies: 'archive_policies',
  requests: 'archive_requests',
  restorationRequests: 'archive_restoration_requests',
  locations: 'archive_locations',
  retentionPolicies: 'retention_policies',
  documents: 'documents',
  versions: 'document_versions',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  signatures: 'electronic_signatures',
  users: 'users',
  roles: 'roles',
} as const;

export const ARCHIVE_CATEGORIES = [
  'Superseded', 'Obsolete', 'Retired', 'Expired', 'Cancelled',
  'Historical Record', 'Regulatory Archive', 'Quality Archive',
] as const;

export const ARCHIVE_STATUSES = [
  'Pending', 'Approved', 'Archived', 'Restoration Requested',
  'Restored', 'Retention Complete', 'Destroyed',
] as const;

export const STORAGE_CLASSES = ['Standard', 'Nearline', 'Coldline', 'Archive'] as const;
export const STORAGE_TIERS = ['Primary', 'Secondary', 'Offsite', 'Regulatory Vault'] as const;

export type ArchiveCategory = (typeof ARCHIVE_CATEGORIES)[number];
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];

export interface ArchiveRecord {
  id: string;
  archive_id: string;
  archive_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  document_category: string;
  department: string;
  business_unit: string;
  site: string;
  version: string;
  revision: string;
  current_status: string;
  archive_status: ArchiveStatus | string;
  archive_reason: string;
  archive_category: ArchiveCategory | string;
  archive_date: string | null;
  archive_location: string;
  retention_policy: string;
  retention_expiry_date: string | null;
  original_effective_date: string | null;
  superseded_date: string | null;
  obsolete_date: string | null;
  retired_date: string | null;
  destroyed_date: string | null;
  requested_by: string;
  requested_by_name: string;
  approved_by: string;
  approved_by_name: string;
  electronic_signature_required: boolean;
  restoration_allowed: boolean;
  restoration_status: string | null;
  restoration_reason: string | null;
  checksum: string;
  checksum_verified: boolean;
  checksum_verified_at: string | null;
  storage_class: string;
  storage_tier: string;
  legal_hold: boolean;
  regulatory_hold: boolean;
  inspection_mode: boolean;
  storage_bytes: number;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ArchiveKpis {
  archivedDocuments: number;
  pendingArchive: number;
  restorationRequests: number;
  retentionExpiring: number;
  destroyedRecords: number;
  legalHolds: number;
  regulatoryHolds: number;
  archiveStorageUsage: number;
}

export interface ArchiveCharts {
  archiveTrend: { month: string; count: number }[];
  documentTypeDistribution: { name: string; value: number }[];
  archiveCategoryDistribution: { name: string; value: number }[];
  departmentArchiveTrend: { month: string; count: number }[];
  retentionExpiryTrend: { month: string; count: number }[];
  restorationTrend: { month: string; count: number }[];
}

export interface ArchiveFilters {
  status?: string;
  department?: string;
  document_type?: string;
  archive_category?: string;
  search?: string;
  pending?: boolean;
  archived?: boolean;
  restoration?: boolean;
  retention_expiring?: boolean;
  destroyed?: boolean;
  legal_hold?: boolean;
  regulatory_hold?: boolean;
  inspection_mode?: boolean;
  department_only?: string;
}

export interface ArchiveActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'document_controller', 'regulatory_affairs', 'head_qa'];
const RECORDS_MANAGER = [...ADMIN, 'document_controller', 'regulatory_affairs'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewArchiveRecords(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || RECORDS_MANAGER.includes(role)
    || DEPT_HEAD.includes(role) || AUDITOR.includes(role);
}
export function canManageArchive(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || RECORDS_MANAGER.includes(role);
}
export function canApproveArchive(role: string): boolean { return QA.includes(role); }
export function canRestoreArchive(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || RECORDS_MANAGER.includes(role);
}
export function isArchiveReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportArchive(role: string): boolean { return canViewArchiveRecords(role); }
export function isEmployeeEffectiveOnly(role: string): boolean {
  return EMPLOYEE.includes(role) && !canViewArchiveRecords(role);
}
export function canApplyLegalHold(role: string): boolean {
  return ADMIN.includes(role) || QA.includes(role) || RECORDS_MANAGER.includes(role);
}

export function archiveStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800',
    Archived: 'bg-purple-100 text-purple-800',
    'Restoration Requested': 'bg-orange-100 text-orange-800',
    Restored: 'bg-green-100 text-green-800',
    'Retention Complete': 'bg-slate-100 text-slate-700',
    Destroyed: 'bg-red-100 text-red-800',
  };
  return colors[status] || colors.Pending;
}

export const DEFAULT_RETENTION_YEARS = 7;
export const RETENTION_WARNING_DAYS = 90;

export const DEFAULT_ARCHIVE_LOCATIONS = [
  'Primary Archive Vault',
  'Regulatory Archive',
  'Quality Records Archive',
  'Offsite Cold Storage',
];
