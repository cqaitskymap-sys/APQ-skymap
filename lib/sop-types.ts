export const SOP_MODULE = 'SOP Management';

export const SOP_COLLECTIONS = {
  master: 'sop_master',
  versions: 'sop_versions',
  reviews: 'sop_reviews',
  approvals: 'sop_approvals',
  trainingLinks: 'sop_training_links',
  distribution: 'sop_distribution',
  acknowledgements: 'sop_acknowledgements',
  periodicReviews: 'sop_periodic_reviews',
  archive: 'sop_archive',
  legacy: 'sop_management',
  documents: 'documents',
  changeControls: 'change_controls',
  trainingAssignments: 'training_assignments',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  employees: 'employees',
  departments: 'departments',
} as const;

export const SOP_CATEGORIES = [
  'Production', 'Quality Assurance', 'Quality Control', 'Warehouse', 'Engineering',
  'Maintenance', 'Validation', 'Calibration', 'Microbiology', 'IT', 'CSV',
  'Data Integrity', 'Regulatory Affairs', 'HR', 'Health & Safety', 'Administration',
] as const;

export const SOP_STATUSES = [
  'Draft', 'Under Author Review', 'Department Review', 'QA Review', 'Pending Approval',
  'Approved', 'Scheduled', 'Effective', 'Periodic Review', 'Revision Required',
  'Superseded', 'Archived', 'Obsolete', 'Retired',
] as const;

export const SOP_WORKFLOW = [
  'Draft', 'Under Author Review', 'Department Review', 'QA Review', 'Pending Approval',
  'Approved', 'Training Assignment', 'Effective', 'Periodic Review', 'Revision Required',
  'Superseded', 'Archived', 'Retired',
] as const;

export type SopCategory = (typeof SOP_CATEGORIES)[number];
export type SopStatus = (typeof SOP_STATUSES)[number];

export interface SopMasterRecord {
  id: string;
  sop_id: string;
  sop_number: string;
  sop_title: string;
  short_title: string;
  department: string;
  business_unit: string;
  site: string;
  area: string;
  category: string;
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
  version: string;
  major_version: number;
  minor_version: number;
  status: SopStatus | string;
  current_workflow: string;
  effective_date: string | null;
  review_due_date: string | null;
  superseded_date: string | null;
  archive_date: string | null;
  retention_period: string | null;
  training_required: boolean;
  training_before_effective: boolean;
  electronic_signature_required: boolean;
  linked_change_control: string | null;
  linked_risk_assessment: string | null;
  linked_capa: string | null;
  linked_validation: string | null;
  linked_forms: string[];
  linked_work_instructions: string[];
  linked_templates: string[];
  keywords: string[];
  confidentiality: string;
  language: string;
  document_id: string | null;
  is_latest: boolean;
  is_favorite: boolean;
  training_pending: boolean;
  training_completion_pct: number;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface SopVersion {
  id: string;
  sop_id: string;
  sop_number: string;
  version: string;
  major_version: number;
  minor_version: number;
  reason: string;
  status: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface SopKpis {
  totalSops: number;
  effectiveSops: number;
  draftSops: number;
  pendingReview: number;
  pendingApproval: number;
  trainingPending: number;
  reviewDue: number;
  overdueReviews: number;
  archivedSops: number;
  obsoleteSops: number;
}

export interface SopCharts {
  statusDistribution: { name: string; value: number }[];
  departmentDistribution: { name: string; value: number }[];
  reviewDueTrend: { month: string; count: number }[];
  versionTrend: { month: string; count: number }[];
  trainingCompletionTrend: { month: string; pct: number }[];
  approvalTimeline: { month: string; count: number }[];
  periodicReviewTrend: { month: string; count: number }[];
  revisionTrend: { month: string; count: number }[];
}

export interface SopFilters {
  status?: string;
  department?: string;
  category?: string;
  owner?: string;
  search?: string;
  review_due?: boolean;
  overdue?: boolean;
  training_pending?: boolean;
  favorites?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface SopActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const AUTHOR = [...DOC_CONTROLLER, 'production_manager', 'qc_manager', 'engineering_manager', 'production_executive'];
const AUDITOR = ['auditor', 'viewer'];

export function canViewSop(_role: string): boolean { return true; }
export function canManageSop(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApproveSop(role: string): boolean { return QA.includes(role); }
export function canReviewSop(role: string): boolean { return QA.includes(role) || DEPT_HEAD.includes(role); }
export function canCreateSop(role: string): boolean { return AUTHOR.includes(role) && !AUDITOR.includes(role); }
export function canReadEffectiveSopOnly(role: string): boolean { return role === 'viewer'; }
export function isSopReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportSop(role: string): boolean { return !isSopReadOnly(role) || role === 'auditor'; }
export function canBulkSop(role: string): boolean { return DOC_CONTROLLER.includes(role); }

export function sopStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Under Author Review': 'bg-indigo-100 text-indigo-800',
    'Department Review': 'bg-violet-100 text-violet-800',
    'QA Review': 'bg-purple-100 text-purple-800',
    'Pending Approval': 'bg-amber-100 text-amber-800',
    Approved: 'bg-blue-100 text-blue-800',
    Scheduled: 'bg-cyan-100 text-cyan-800',
    Effective: 'bg-green-100 text-green-800',
    'Periodic Review': 'bg-teal-100 text-teal-800',
    'Revision Required': 'bg-orange-100 text-orange-800',
    Superseded: 'bg-gray-100 text-gray-600',
    Archived: 'bg-purple-100 text-purple-800',
    Obsolete: 'bg-red-100 text-red-700',
    Retired: 'bg-stone-100 text-stone-600',
  };
  return colors[status] || colors.Draft;
}

export function parseSopVersion(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return { major: parseInt(parts[0] || '1', 10) || 1, minor: parseInt(parts[1] || '0', 10) || 0 };
}

export function incrementSopVersion(current: string, isMajor: boolean): string {
  const { major, minor } = parseSopVersion(current);
  return isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export function isSopReviewOverdue(date: string | null): boolean {
  if (!date) return false;
  return date < new Date().toISOString().split('T')[0];
}

export function isSopReviewDueSoon(date: string | null, days = 30): boolean {
  if (!date) return false;
  const due = new Date(date);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);
  return due <= threshold;
}

export function isSopEditable(status: string): boolean {
  return ['Draft', 'Under Author Review'].includes(status);
}

export function isSopReadOnlyStatus(status: string): boolean {
  return ['Superseded', 'Archived', 'Obsolete', 'Retired'].includes(status);
}

export const DEPT_SOP_PREFIX: Record<string, string> = {
  Production: 'PRD', 'Quality Assurance': 'QA', 'Quality Control': 'QC', Warehouse: 'WH',
  Engineering: 'ENG', Maintenance: 'MNT', Validation: 'VAL', Calibration: 'CAL',
  Microbiology: 'MIC', IT: 'IT', CSV: 'CSV', 'Data Integrity': 'DI',
  'Regulatory Affairs': 'REG', HR: 'HR', 'Health & Safety': 'HS', Administration: 'ADM',
};
