export const DTL_MODULE = 'Document Training Linkage';

export const DTL_COLLECTIONS = {
  links: 'document_training_links',
  documents: 'documents',
  versions: 'document_versions',
  assignments: 'training_assignments',
  programs: 'training_master',
  records: 'training_records',
  matrix: 'training_matrix',
  competency: 'competency_records',
  employeeRoles: 'roles',
  employees: 'users',
  departments: 'departments',
  changeControls: 'change_controls',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  signatures: 'electronic_signatures',
} as const;

export const TRAINING_LINK_TYPES = [
  'Read & Acknowledge', 'Classroom', 'Instructor Led', 'Self Learning', 'eLearning',
  'Assessment', 'Practical Demonstration', 'On-the-Job Training', 'Hybrid',
] as const;

export const ASSIGNMENT_METHODS = [
  'Automatic', 'Manual', 'Role Based', 'Department Based', 'Site Based', 'Business Unit Based',
] as const;

export const TRAINING_LINK_STATUSES = [
  'Draft', 'Pending Assignment', 'Assigned', 'In Progress', 'Completed',
  'Overdue', 'Expired', 'Cancelled',
] as const;

export const RETRAINING_TRIGGERS = [
  'Major Revision', 'Minor Revision', 'Periodic', 'Competency Gap', 'Manual',
] as const;

export type TrainingLinkType = (typeof TRAINING_LINK_TYPES)[number];
export type AssignmentMethod = (typeof ASSIGNMENT_METHODS)[number];
export type TrainingLinkStatus = (typeof TRAINING_LINK_STATUSES)[number];

export interface DocumentTrainingLinkRecord {
  id: string;
  training_link_id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  version: string;
  department: string;
  site: string;
  business_unit: string;
  training_required: boolean;
  training_type: TrainingLinkType | string;
  training_program: string;
  training_program_id: string | null;
  qualification_required: boolean;
  competency_level: string;
  employee_groups: string[];
  assigned_employees: string[];
  assignment_method: AssignmentMethod | string;
  training_due_date: string;
  grace_period_days: number;
  retraining_required: boolean;
  retraining_trigger: string;
  completion_requirement: string;
  assessment_required: boolean;
  passing_score: number;
  electronic_signature_required: boolean;
  acknowledgement_required: boolean;
  status: TrainingLinkStatus | string;
  assignments_count: number;
  completed_count: number;
  overdue_count: number;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingLinkageKpis {
  linkedDocuments: number;
  activeAssignments: number;
  completedTraining: number;
  overdueTraining: number;
  retrainingAssignments: number;
  awaitingQualification: number;
  compliancePct: number;
  acknowledgementsPending: number;
}

export interface TrainingLinkageCharts {
  completionTrend: { month: string; count: number }[];
  assignmentTrend: { month: string; count: number }[];
  departmentCompliance: { name: string; value: number }[];
  roleCompliance: { name: string; value: number }[];
  trainingTypeDistribution: { name: string; value: number }[];
  retrainingTrend: { month: string; count: number }[];
  assessmentPassRate: { month: string; pct: number }[];
}

export interface TrainingLinkageFilters {
  status?: string;
  department?: string;
  document_type?: string;
  training_type?: string;
  assignment_method?: string;
  search?: string;
  overdue?: boolean;
  active?: boolean;
  completed?: boolean;
  retraining?: boolean;
}

export interface TrainingLinkageActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const TRAINING_ADMIN = [...ADMIN, 'training_coordinator', 'head_qa', 'qa_manager'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewTrainingLinkage(role: string): boolean {
  return TRAINING_ADMIN.includes(role) || DOC_CONTROLLER.includes(role) || QA.includes(role)
    || DEPT_HEAD.includes(role) || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canManageTrainingLinkage(role: string): boolean {
  return TRAINING_ADMIN.includes(role) || DOC_CONTROLLER.includes(role);
}
export function canReviewTrainingCompliance(role: string): boolean { return QA.includes(role); }
export function isTrainingLinkageReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportTrainingLinkage(role: string): boolean { return canViewTrainingLinkage(role); }
export function canBulkAssignTraining(role: string): boolean { return TRAINING_ADMIN.includes(role); }
export function canBulkCompleteTraining(role: string): boolean { return TRAINING_ADMIN.includes(role); }
export function isEmployeeTrainingView(role: string): boolean {
  return EMPLOYEE.includes(role) && !TRAINING_ADMIN.includes(role) && !DOC_CONTROLLER.includes(role);
}

export function trainingLinkStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Assignment': 'bg-amber-100 text-amber-800',
    Assigned: 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-indigo-100 text-indigo-800',
    Completed: 'bg-green-100 text-green-800',
    Overdue: 'bg-red-100 text-red-700',
    Expired: 'bg-gray-100 text-gray-600',
    Cancelled: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || colors.Draft;
}

export const DEFAULT_GRACE_PERIOD_DAYS = 7;
export const DEFAULT_PASSING_SCORE = 80;
export const REMINDER_DAYS = [14, 7, 3, 1];
