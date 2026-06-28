import type { DocumentRecord, DocumentApproval } from './dms-types';

export const DLM_MODULE = 'Document Lifecycle Management';

export const DLM_COLLECTIONS = {
  documents: 'documents',
  versions: 'document_versions',
  lifecycle: 'document_lifecycle',
  reviews: 'document_reviews',
  approvals: 'document_approvals',
  effectiveDates: 'document_effective_dates',
  distribution: 'document_distribution',
  archives: 'document_archives',
  obsolete: 'document_obsolete',
  trainingLinks: 'document_training_links',
  changeControls: 'change_controls',
  trainingAssignments: 'training_assignments',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  users: 'users',
  roles: 'roles',
} as const;

export const LIFECYCLE_STAGES = [
  'Draft',
  'Author Review',
  'Department Review',
  'QA Review',
  'Pending Approval',
  'Approved',
  'Scheduled',
  'Effective',
  'Periodic Review',
  'Revision Required',
  'Superseded',
  'Archived',
  'Obsolete',
  'Retired',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const WORKFLOW_STAGES: LifecycleStage[] = [
  'Draft',
  'Author Review',
  'Department Review',
  'QA Review',
  'Pending Approval',
  'Approved',
  'Effective',
  'Periodic Review',
  'Revision Required',
  'Superseded',
  'Archived',
  'Retired',
];

export interface DocumentLifecycleRecord {
  id: string;
  lifecycle_id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  current_version: string;
  major_version: number;
  minor_version: number;
  current_stage: LifecycleStage;
  current_owner: string;
  current_owner_name: string;
  current_reviewer: string;
  current_reviewer_name: string;
  current_approver: string;
  current_approver_name: string;
  effective_date: string | null;
  review_due_date: string | null;
  revision_due_date: string | null;
  archive_date: string | null;
  retention_period: string | null;
  disposal_date: string | null;
  linked_change_control: string | null;
  linked_training: string | null;
  linked_capa: string | null;
  linked_deviation: string | null;
  linked_risk_assessment: string | null;
  electronic_signature_status: string;
  workflow_status: string;
  department: string;
  document_type: string;
  training_required: boolean;
  is_latest: boolean;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface LifecycleEvent {
  id: string;
  lifecycle_id: string;
  document_id: string;
  from_stage: LifecycleStage | null;
  to_stage: LifecycleStage;
  actor_id: string;
  actor_name: string;
  comments: string;
  created_at: string;
}

export interface DocumentLifecycleKpis {
  totalDocuments: number;
  draft: number;
  underReview: number;
  pendingApproval: number;
  effective: number;
  scheduled: number;
  reviewDue: number;
  overdueReview: number;
  revisionRequired: number;
  archived: number;
  obsolete: number;
  retired: number;
}

export interface DocumentLifecycleCharts {
  lifecycleDistribution: { name: string; value: number }[];
  reviewDueTrend: { month: string; count: number }[];
  revisionTrend: { month: string; count: number }[];
  documentAging: { bucket: string; count: number }[];
  departmentLifecycle: { name: string; value: number }[];
  approvalTimeline: { month: string; count: number }[];
  effectiveTrend: { month: string; count: number }[];
  retiredTrend: { month: string; count: number }[];
}

export interface DocumentLifecycleFilters {
  stage?: LifecycleStage | string;
  department?: string;
  document_type?: string;
  owner?: string;
  search?: string;
  review_due?: boolean;
  overdue?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface DocumentLifecycleActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const AUTHOR = [...DOC_CONTROLLER, 'production_manager', 'qc_manager', 'engineering_manager', 'production_executive', 'qc_executive'];
const AUDITOR = ['auditor', 'viewer'];

export function canViewLifecycle(role: string): boolean {
  return true;
}

export function canManageLifecycle(role: string): boolean {
  return DOC_CONTROLLER.includes(role);
}

export function canReviewLifecycle(role: string): boolean {
  return QA.includes(role) || DEPT_HEAD.includes(role);
}

export function canApproveLifecycle(role: string): boolean {
  return QA.includes(role);
}

export function canCreateDraft(role: string): boolean {
  return AUTHOR.includes(role) && !AUDITOR.includes(role);
}

export function canReadEffectiveOnly(role: string): boolean {
  return role === 'viewer';
}

export function isLifecycleReadOnly(role: string): boolean {
  return AUDITOR.includes(role);
}

export function canExportLifecycle(role: string): boolean {
  return !isLifecycleReadOnly(role) || role === 'auditor';
}

export function canBulkLifecycleActions(role: string): boolean {
  return DOC_CONTROLLER.includes(role);
}

export function stageColor(stage: LifecycleStage | string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    'Author Review': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    'Department Review': 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    'QA Review': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    'Pending Approval': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    Scheduled: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300',
    Effective: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    'Periodic Review': 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
    'Revision Required': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    Superseded: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    Archived: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
    Obsolete: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    Retired: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  };
  return colors[stage] || colors.Draft;
}

export function isStageEditable(stage: LifecycleStage): boolean {
  return stage === 'Draft' || stage === 'Author Review';
}

export function isStageReadOnly(stage: LifecycleStage): boolean {
  return ['Superseded', 'Archived', 'Obsolete', 'Retired'].includes(stage);
}

export function parseVersion(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0] || '1', 10) || 1,
    minor: parseInt(parts[1] || '0', 10) || 0,
  };
}

export function incrementVersion(current: string, isMajor: boolean): string {
  const { major, minor } = parseVersion(current);
  return isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

export function isReviewOverdue(reviewDate: string | null): boolean {
  if (!reviewDate) return false;
  return reviewDate < new Date().toISOString().split('T')[0];
}

export function isReviewDueSoon(reviewDate: string | null, daysAhead = 30): boolean {
  if (!reviewDate) return false;
  const due = new Date(reviewDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysAhead);
  return due <= threshold;
}

export function determineLifecycleStage(
  doc: DocumentRecord,
  approvals?: DocumentApproval[],
): LifecycleStage {
  const isLatest = doc.is_latest !== false;
  const today = new Date().toISOString().split('T')[0];
  const meta = doc as unknown as Record<string, unknown>;

  if (meta.lifecycle_stage && typeof meta.lifecycle_stage === 'string') {
    return meta.lifecycle_stage as LifecycleStage;
  }

  if (doc.status === 'retired') return 'Retired';
  if (doc.status === 'archived') return 'Archived';
  if (doc.status === 'obsolete') return isLatest ? 'Obsolete' : 'Superseded';
  if (!isLatest && ['effective', 'approved', 'obsolete'].includes(doc.status)) return 'Superseded';

  if (doc.status === 'draft') return 'Draft';
  if (doc.status === 'returned_for_correction') return 'Author Review';

  if (doc.status === 'under_review' || doc.status === 'pending_approval') {
    if (approvals?.length) {
      const pending = [...approvals].reverse().find((a) => a.decision === 'pending');
      if (pending?.stage === 'department_review') return 'Department Review';
      if (pending?.stage === 'qa_review') return 'QA Review';
      if (pending?.stage === 'head_qa_approval') return 'Pending Approval';
    }
    return 'Department Review';
  }

  if (doc.status === 'approved') {
    if (doc.effective_date && doc.effective_date > today) return 'Scheduled';
    return 'Approved';
  }

  if (doc.status === 'effective') {
    if (isReviewOverdue(doc.next_review_date)) return 'Revision Required';
    if (isReviewDueSoon(doc.next_review_date, 60)) return 'Periodic Review';
    return 'Effective';
  }

  return 'Draft';
}
