export const EDM_MODULE = 'Effective Date Management';

export const EDM_COLLECTIONS = {
  effectiveDates: 'document_effective_dates',
  documents: 'documents',
  versions: 'document_versions',
  distribution: 'document_distribution',
  trainingAssignments: 'training_assignments',
  trainingRecords: 'training_records',
  acknowledgements: 'document_acknowledgements',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  users: 'users',
  roles: 'roles',
} as const;

export const ACTIVATION_STATUSES = [
  'Pending', 'Scheduled', 'Waiting For Training', 'Ready', 'Activated',
  'Delayed', 'Cancelled', 'Rolled Back',
] as const;

export const ACTIVATION_METHODS = ['Automatic', 'Manual', 'Scheduled'] as const;
export const TRAINING_STATUSES = ['Not Required', 'Pending', 'In Progress', 'Completed', 'Blocked'] as const;
export const DISTRIBUTION_STATUSES = ['Not Started', 'Pending', 'In Progress', 'Completed'] as const;

export type ActivationStatus = (typeof ACTIVATION_STATUSES)[number];
export type ActivationMethod = (typeof ACTIVATION_METHODS)[number];

export interface EffectiveDateRecord {
  id: string;
  effective_date_id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  version: string;
  approval_date: string | null;
  effective_date: string;
  activation_time: string;
  time_zone: string;
  training_required: boolean;
  training_completion_status: string;
  distribution_status: string;
  superseded_version: string | null;
  current_effective_version: string;
  activation_status: ActivationStatus | string;
  activation_method: ActivationMethod | string;
  rollback_allowed: boolean;
  rollback_window_hours: number;
  reason: string;
  department: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
  rolled_back_at: string | null;
}

export interface EffectiveDateKpis {
  pendingActivations: number;
  todaysActivations: number;
  delayedActivations: number;
  cancelledActivations: number;
  awaitingTraining: number;
  activeEffectiveDocuments: number;
  rollbackEvents: number;
  upcomingEffectiveDates: number;
}

export interface EffectiveDateCharts {
  activationTrend: { month: string; count: number }[];
  departmentActivations: { name: string; value: number }[];
  documentTypeDistribution: { name: string; value: number }[];
  trainingDependencyTrend: { month: string; count: number }[];
  rollbackTrend: { month: string; count: number }[];
  activationSuccessRate: { month: string; pct: number }[];
}

export interface EffectiveDateFilters {
  status?: string;
  department?: string;
  document_type?: string;
  activation_method?: string;
  search?: string;
  upcoming?: boolean;
  today?: boolean;
  delayed?: boolean;
  training_blocked?: boolean;
  activated?: boolean;
}

export interface EffectiveDateActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewEffectiveDates(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || DEPT_HEAD.includes(role)
    || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function isEmployeeEffectiveDateView(role: string): boolean {
  return EMPLOYEE.includes(role) && !DOC_CONTROLLER.includes(role) && !QA.includes(role) && !DEPT_HEAD.includes(role);
}
export function canManageEffectiveDates(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApproveOverride(role: string): boolean { return QA.includes(role); }
export function isEffectiveDateReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportEffectiveDates(role: string): boolean { return canViewEffectiveDates(role); }
export function canBulkActivate(role: string): boolean { return DOC_CONTROLLER.includes(role); }

export function activationStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-700',
    Scheduled: 'bg-blue-100 text-blue-800',
    'Waiting For Training': 'bg-amber-100 text-amber-800',
    Ready: 'bg-indigo-100 text-indigo-800',
    Activated: 'bg-green-100 text-green-800',
    Delayed: 'bg-red-100 text-red-700',
    Cancelled: 'bg-purple-100 text-purple-800',
    'Rolled Back': 'bg-orange-100 text-orange-800',
  };
  return colors[status] || colors.Pending;
}

export const DEFAULT_ROLLBACK_WINDOW_HOURS = 72;
export const DEFAULT_TIME_ZONE = 'UTC';
