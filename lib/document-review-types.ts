export const DRW_MODULE = 'Document Review Workflow';

export const DRW_COLLECTIONS = {
  reviews: 'document_reviews',
  workflows: 'review_workflows',
  steps: 'review_steps',
  comments: 'review_comments',
  checklists: 'review_checklists',
  documents: 'documents',
  versions: 'document_versions',
  users: 'users',
  roles: 'roles',
  departments: 'departments',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
} as const;

export const REVIEW_MODES = ['Sequential', 'Parallel', 'Hybrid'] as const;
export const REVIEW_DECISIONS = ['Approved', 'Approved with Comments', 'Revision Required', 'Rejected'] as const;
export const REVIEW_STATUSES = ['Draft', 'Pending Review', 'Under Review', 'Returned for Revision', 'Completed', 'Cancelled', 'Expired'] as const;
export const SLA_STATUSES = ['On Track', 'At Risk', 'Overdue', 'Completed'] as const;
export const REVIEW_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

export type ReviewMode = (typeof REVIEW_MODES)[number];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ReviewChecklistItem {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
}

export interface DocumentReviewRecord {
  id: string;
  review_id: string;
  review_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  version: string;
  workflow_type: string;
  review_mode: ReviewMode | string;
  current_step: number;
  total_steps: number;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  department: string;
  due_date: string;
  completed_date: string | null;
  review_decision: ReviewDecision | string | null;
  review_status: ReviewStatus | string;
  review_checklist: ReviewChecklistItem[];
  review_comments: string;
  revision_requested: boolean;
  revision_summary: string;
  priority: string;
  sla_status: string;
  workflow_id: string | null;
  step_id: string | null;
  started_at: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewWorkflowDefinition {
  id: string;
  name: string;
  review_mode: ReviewMode;
  steps: Array<{ order: number; name: string; role: string; department?: string; mandatory: boolean }>;
  active: boolean;
}

export interface ReviewKpis {
  pendingReviews: number;
  inProgress: number;
  completedReviews: number;
  overdueReviews: number;
  revisionRequests: number;
  averageReviewTimeDays: number;
  slaCompliancePct: number;
  departmentQueue: number;
}

export interface ReviewCharts {
  statusDistribution: { name: string; value: number }[];
  completionTrend: { month: string; count: number }[];
  averageReviewTime: { month: string; days: number }[];
  departmentLoad: { name: string; value: number }[];
  reviewerWorkload: { name: string; value: number }[];
  slaComplianceTrend: { month: string; pct: number }[];
}

export interface ReviewFilters {
  status?: string;
  department?: string;
  document_type?: string;
  reviewer_id?: string;
  review_mode?: string;
  search?: string;
  overdue?: boolean;
  revision_requested?: boolean;
  in_progress?: boolean;
}

export interface ReviewActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const REVIEWER = [...QA, ...DEPT_HEAD, 'production_executive', 'qc_executive'];
const AUTHOR = [...DOC_CONTROLLER, 'production_manager', 'qc_manager', 'production_executive'];
const AUDITOR = ['auditor'];

export function canViewReviews(role: string): boolean { return role !== 'viewer' && role !== 'employee'; }
export function canManageReviews(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canCompleteReviews(role: string): boolean { return REVIEWER.includes(role); }
export function canRespondToRevisions(role: string): boolean { return AUTHOR.includes(role); }
export function isReviewReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportReviews(role: string): boolean { return canViewReviews(role); }
export function canDesignWorkflows(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canViewAssignedOnly(role: string): boolean {
  return ['production_executive', 'qc_executive'].includes(role) && !DEPT_HEAD.includes(role);
}

export function reviewStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Review': 'bg-blue-100 text-blue-800',
    'Under Review': 'bg-amber-100 text-amber-800',
    'Returned for Revision': 'bg-orange-100 text-orange-800',
    Completed: 'bg-green-100 text-green-800',
    Cancelled: 'bg-purple-100 text-purple-800',
    Expired: 'bg-red-100 text-red-700',
  };
  return colors[status] || colors.Draft;
}

export function slaStatusColor(sla: string): string {
  const colors: Record<string, string> = {
    'On Track': 'bg-green-100 text-green-800',
    'At Risk': 'bg-amber-100 text-amber-800',
    Overdue: 'bg-red-100 text-red-700',
    Completed: 'bg-blue-100 text-blue-800',
  };
  return colors[sla] || colors['On Track'];
}

export function computeSlaStatus(dueDate: string, status: string, completedDate?: string | null): string {
  if (status === 'Completed') return 'Completed';
  const today = new Date().toISOString().split('T')[0];
  if (dueDate < today) return 'Overdue';
  const due = new Date(dueDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);
  if (due <= threshold) return 'At Risk';
  return 'On Track';
}

export const DEFAULT_CHECKLIST: ReviewChecklistItem[] = [
  { id: '1', label: 'Document format complies with SOP', required: true, checked: false },
  { id: '2', label: 'Content is accurate and complete', required: true, checked: false },
  { id: '3', label: 'References are current and valid', required: true, checked: false },
  { id: '4', label: 'Change control reference verified', required: false, checked: false },
  { id: '5', label: 'Training impact assessed', required: false, checked: false },
];

export const DEFAULT_WORKFLOWS: ReviewWorkflowDefinition[] = [
  {
    id: 'seq-standard', name: 'Standard Sequential Review', review_mode: 'Sequential', active: true,
    steps: [
      { order: 1, name: 'Department Review', role: 'production_manager', mandatory: true },
      { order: 2, name: 'QA Review', role: 'qa_manager', mandatory: true },
    ],
  },
  {
    id: 'par-standard', name: 'Parallel Department + QA', review_mode: 'Parallel', active: true,
    steps: [
      { order: 1, name: 'Department Review', role: 'production_manager', mandatory: true },
      { order: 1, name: 'QA Review', role: 'qa_manager', mandatory: true },
    ],
  },
];
