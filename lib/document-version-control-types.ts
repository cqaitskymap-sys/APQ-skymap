export const VC_MODULE = 'Document Version Control';

export const VC_COLLECTIONS = {
  versions: 'document_versions',
  documents: 'documents',
  revisions: 'document_revisions',
  reviews: 'document_reviews',
  approvals: 'document_approvals',
  sopMaster: 'sop_master',
  workInstructions: 'work_instructions',
  formsTemplates: 'forms_templates',
  changeControls: 'change_controls',
  trainingAssignments: 'training_assignments',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  users: 'users',
  roles: 'roles',
} as const;

export const REVISION_TYPES = ['Major', 'Minor', 'Editorial', 'Administrative', 'Emergency'] as const;

export const VERSION_STATUSES = [
  'Draft', 'Under Review', 'Pending Approval', 'Approved', 'Scheduled',
  'Effective', 'Superseded', 'Archived', 'Obsolete', 'Retired',
] as const;

export type RevisionType = (typeof REVISION_TYPES)[number];
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export interface DocumentVersionRecord {
  id: string;
  version_id: string;
  version_number: string;
  major_version: number;
  minor_version: number;
  revision_number: number;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  department: string;
  previous_version: string | null;
  next_version: string | null;
  current_effective_version: string | null;
  revision_type: RevisionType | string;
  revision_reason: string;
  change_summary: string;
  change_control_id: string | null;
  training_required: boolean;
  electronic_signature_required: boolean;
  review_required: boolean;
  approval_required: boolean;
  status: VersionStatus | string;
  author: string;
  author_name: string;
  reviewer: string;
  reviewer_name: string;
  approver: string;
  approver_name: string;
  is_latest: boolean;
  is_effective: boolean;
  parent_document_id: string | null;
  rollback_status: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface VersionControlKpis {
  totalVersions: number;
  currentEffective: number;
  draftVersions: number;
  pendingReview: number;
  pendingApproval: number;
  supersededVersions: number;
  archivedVersions: number;
  majorRevisions: number;
  minorRevisions: number;
}

export interface VersionControlCharts {
  versionGrowthTrend: { month: string; count: number }[];
  revisionTypeDistribution: { name: string; value: number }[];
  documentTypeDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  approvalTimeline: { month: string; count: number }[];
  supersededTrend: { month: string; count: number }[];
}

export interface VersionControlFilters {
  status?: string;
  revision_type?: string;
  document_type?: string;
  department?: string;
  search?: string;
  effective_only?: boolean;
  latest_only?: boolean;
  major_only?: boolean;
  minor_only?: boolean;
}

export interface VersionControlActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const AUTHOR = [...DOC_CONTROLLER, 'production_manager', 'qc_manager', 'production_executive'];
const AUDITOR = ['auditor'];

export function canViewVersions(_role: string): boolean { return true; }
export function canManageVersions(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canReviewVersions(role: string): boolean { return QA.includes(role) || DEPT_HEAD.includes(role); }
export function canApproveVersions(role: string): boolean { return QA.includes(role); }
export function canCreateRevisions(role: string): boolean { return AUTHOR.includes(role) && !AUDITOR.includes(role); }
export function canViewHistoricalOnly(role: string): boolean { return role === 'viewer' || role === 'employee'; }
export function isVersionReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportVersions(role: string): boolean { return !isVersionReadOnly(role) || role === 'auditor'; }
export function canRollback(role: string): boolean { return DOC_CONTROLLER.includes(role); }

export function versionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Review': 'bg-amber-100 text-amber-800',
    'Pending Approval': 'bg-orange-100 text-orange-800',
    Approved: 'bg-blue-100 text-blue-800',
    Scheduled: 'bg-cyan-100 text-cyan-800',
    Effective: 'bg-green-100 text-green-800',
    Superseded: 'bg-gray-100 text-gray-600',
    Archived: 'bg-purple-100 text-purple-800',
    Obsolete: 'bg-red-100 text-red-700',
    Retired: 'bg-stone-100 text-stone-600',
  };
  return colors[status] || colors.Draft;
}

export function parseVersionNumber(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return { major: parseInt(parts[0] || '1', 10) || 1, minor: parseInt(parts[1] || '0', 10) || 0 };
}

export function incrementVersionNumber(current: string, revisionType: RevisionType | string): string {
  const { major, minor } = parseVersionNumber(current);
  switch (revisionType) {
    case 'Major':
    case 'Emergency':
      return `${major + 1}.0`;
    case 'Minor':
    case 'Administrative':
      return `${major}.${minor + 1}`;
    case 'Editorial':
      return `${major}.${minor + 1}`;
    default:
      return `${major}.${minor + 1}`;
  }
}

export function mapDmsStatusToVersionStatus(status: string, isLatest: boolean): VersionStatus {
  if (!isLatest && ['effective', 'approved', 'obsolete'].includes(status)) return 'Superseded';
  if (status === 'retired') return 'Retired';
  if (status === 'archived') return 'Archived';
  if (status === 'obsolete') return 'Obsolete';
  if (status === 'draft') return 'Draft';
  if (status === 'returned_for_correction') return 'Under Review';
  if (status === 'under_review') return 'Under Review';
  if (status === 'pending_approval') return 'Pending Approval';
  if (status === 'approved') return 'Approved';
  if (status === 'effective') return 'Effective';
  return 'Draft';
}

export function inferRevisionType(fromVersion: string, toVersion: string): RevisionType {
  const from = parseVersionNumber(fromVersion);
  const to = parseVersionNumber(toVersion);
  if (to.major > from.major) return 'Major';
  if (to.minor > from.minor) return 'Minor';
  return 'Editorial';
}
