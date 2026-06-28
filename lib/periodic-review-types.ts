export const PRM_MODULE = 'Periodic Review Management';

export const PRM_COLLECTIONS = {
  reviews: 'periodic_reviews',
  schedules: 'review_schedules',
  templates: 'review_templates',
  checklists: 'review_checklists',
  decisions: 'review_decisions',
  comments: 'review_comments',
  assignments: 'review_assignments',
  documents: 'documents',
  versions: 'document_versions',
  changeControls: 'change_controls',
  trainingAssignments: 'training_assignments',
  riskAssessments: 'risk_assessments',
  capa: 'capa_records',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  users: 'users',
  roles: 'roles',
} as const;

export const REVIEW_FREQUENCIES = [
  'Quarterly', 'Semi-Annual', 'Annual', 'Every 2 Years', 'Every 3 Years', 'Custom',
] as const;

export const REVIEW_TRIGGERS = [
  'Scheduled', 'Regulatory Change', 'Process Change', 'Deviation', 'CAPA',
  'Risk Assessment', 'Audit Finding', 'Manual',
] as const;

export const PERIODIC_REVIEW_DECISIONS = [
  'No Change Required', 'Minor Revision', 'Major Revision', 'Retire Document',
  'Merge Documents', 'Replace Document',
] as const;

export const REVIEW_STATUSES = [
  'Scheduled', 'Pending', 'In Progress', 'Awaiting QA', 'Awaiting Approval',
  'Completed', 'Overdue', 'Cancelled',
] as const;

export const REVIEW_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

export type ReviewFrequency = (typeof REVIEW_FREQUENCIES)[number];
export type ReviewTrigger = (typeof REVIEW_TRIGGERS)[number];
export type PeriodicReviewDecision = (typeof PERIODIC_REVIEW_DECISIONS)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ReviewChecklistItem {
  id: string;
  label: string;
  required: boolean;
  checked: boolean;
}

export interface PeriodicReviewRecord {
  id: string;
  review_id: string;
  review_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  current_version: string;
  department: string;
  business_unit: string;
  site: string;
  owner: string;
  owner_name: string;
  reviewer_id: string;
  reviewer_name: string;
  qa_reviewer_id: string;
  qa_reviewer_name: string;
  review_frequency: ReviewFrequency | string;
  review_cycle: number;
  review_trigger: ReviewTrigger | string;
  scheduled_date: string;
  due_date: string;
  started_date: string | null;
  completed_date: string | null;
  decision: PeriodicReviewDecision | string | null;
  status: ReviewStatus | string;
  outcome: string;
  revision_required: boolean;
  change_control_required: boolean;
  risk_assessment_required: boolean;
  capa_required: boolean;
  training_impact: boolean;
  electronic_signature_required: boolean;
  review_checklist: ReviewChecklistItem[];
  review_comments: string;
  attachments: string[];
  priority: string;
  linked_change_control_id: string | null;
  linked_capa_id: string | null;
  linked_risk_assessment_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PeriodicReviewKpis {
  scheduledReviews: number;
  dueThisMonth: number;
  overdueReviews: number;
  completedReviews: number;
  majorRevisions: number;
  minorRevisions: number;
  documentsRetired: number;
  averageReviewDurationDays: number;
}

export interface PeriodicReviewCharts {
  statusDistribution: { name: string; value: number }[];
  frequencyDistribution: { name: string; value: number }[];
  departmentTrend: { month: string; count: number }[];
  overdueTrend: { month: string; count: number }[];
  decisionTrend: { month: string; count: number }[];
  revisionTrend: { month: string; minor: number; major: number }[];
}

export interface PeriodicReviewFilters {
  status?: string;
  department?: string;
  document_type?: string;
  frequency?: string;
  trigger?: string;
  priority?: string;
  search?: string;
  upcoming?: boolean;
  overdue?: boolean;
  completed?: boolean;
  due_this_month?: boolean;
  assigned_to_me?: string;
}

export interface PeriodicReviewActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const REVIEWER = [...QA, 'document_controller', 'regulatory_affairs'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewPeriodicReviews(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || DEPT_HEAD.includes(role)
    || REVIEWER.includes(role) || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canManagePeriodicReviews(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApprovePeriodicReview(role: string): boolean { return QA.includes(role); }
export function isPeriodicReviewReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportPeriodicReviews(role: string): boolean { return canViewPeriodicReviews(role); }
export function canBulkScheduleReviews(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function isReviewerOnly(role: string): boolean {
  return !DOC_CONTROLLER.includes(role) && !QA.includes(role) && !DEPT_HEAD.includes(role)
    && (REVIEWER.includes(role) || role === 'employee');
}
export function isEmployeeEffectiveView(role: string): boolean {
  return EMPLOYEE.includes(role) && !DOC_CONTROLLER.includes(role) && !QA.includes(role);
}

export function reviewStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Scheduled: 'bg-blue-100 text-blue-800',
    Pending: 'bg-slate-100 text-slate-700',
    'In Progress': 'bg-indigo-100 text-indigo-800',
    'Awaiting QA': 'bg-amber-100 text-amber-800',
    'Awaiting Approval': 'bg-purple-100 text-purple-800',
    Completed: 'bg-green-100 text-green-800',
    Overdue: 'bg-red-100 text-red-700',
    Cancelled: 'bg-gray-100 text-gray-600',
  };
  return colors[status] || colors.Pending;
}

export const DEFAULT_REVIEW_CHECKLIST: ReviewChecklistItem[] = [
  { id: '1', label: 'Document content remains accurate and current', required: true, checked: false },
  { id: '2', label: 'Regulatory requirements reviewed', required: true, checked: false },
  { id: '3', label: 'Process changes assessed', required: true, checked: false },
  { id: '4', label: 'Training impact evaluated', required: false, checked: false },
  { id: '5', label: 'References and cross-links verified', required: false, checked: false },
];

export const REMINDER_DAYS_BEFORE = [30, 7, 1];
export const TASK_GENERATION_DAYS_BEFORE = 30;

export function frequencyToMonths(frequency: string): number {
  const map: Record<string, number> = {
    Quarterly: 3, 'Semi-Annual': 6, Annual: 12,
    'Every 2 Years': 24, 'Every 3 Years': 36,
  };
  return map[frequency] || 12;
}

export function addMonthsToDate(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}
