export const DAW_MODULE = 'Document Approval Workflow';

export const DAW_COLLECTIONS = {
  approvals: 'document_approvals',
  workflows: 'approval_workflows',
  steps: 'approval_steps',
  delegations: 'approval_delegations',
  escalations: 'approval_escalations',
  comments: 'approval_comments',
  documents: 'documents',
  versions: 'document_versions',
  users: 'users',
  roles: 'roles',
  departments: 'departments',
  esignatures: 'electronic_signatures',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
} as const;

export const DAW_MODULE_TAG = 'Document Approval';

export const APPROVAL_TYPES = ['Single Level', 'Multi Level', 'Sequential', 'Parallel', 'Hybrid'] as const;
export const APPROVAL_DECISIONS = ['Approved', 'Approved With Comments', 'Rejected', 'Returned For Revision', 'Cancelled'] as const;
export const APPROVAL_STATUSES = ['Draft', 'Pending Approval', 'In Progress', 'Approved', 'Rejected', 'Returned', 'Cancelled', 'Expired'] as const;
export const SLA_STATUSES = ['On Track', 'At Risk', 'Overdue', 'Completed'] as const;
export const APPROVAL_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;
export const ESIGN_STATUSES = ['Not Required', 'Pending', 'Completed', 'Failed'] as const;

export type ApprovalType = (typeof APPROVAL_TYPES)[number];
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface DocumentApprovalRecord {
  id: string;
  approval_id: string;
  approval_number: string;
  workflow_id: string | null;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  version: string;
  approval_type: ApprovalType | string;
  current_step: number;
  total_steps: number;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  department: string;
  priority: string;
  due_date: string;
  approval_date: string | null;
  approval_decision: ApprovalDecision | string | null;
  approval_status: ApprovalStatus | string;
  approval_comments: string;
  electronic_signature_required: boolean;
  electronic_signature_status: string;
  delegated_to: string | null;
  delegated_to_name: string | null;
  escalated: boolean;
  escalation_level: number;
  sla_status: string;
  step_id: string | null;
  started_at: string | null;
  module: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflowDefinition {
  id: string;
  name: string;
  approval_type: ApprovalType;
  module: string;
  steps: Array<{
    order: number;
    name: string;
    role: string;
    department?: string;
    mandatory: boolean;
    e_signature_required: boolean;
    due_days: number;
  }>;
  active: boolean;
}

export interface ApprovalKpis {
  pendingApprovals: number;
  approvedToday: number;
  rejectedToday: number;
  returnedForRevision: number;
  overdueApprovals: number;
  averageApprovalTimeDays: number;
  slaCompliancePct: number;
  delegatedApprovals: number;
  escalatedApprovals: number;
}

export interface ApprovalCharts {
  statusDistribution: { name: string; value: number }[];
  approvalTimeline: { month: string; count: number }[];
  departmentApprovals: { name: string; value: number }[];
  approverWorkload: { name: string; value: number }[];
  averageApprovalDuration: { month: string; days: number }[];
  slaComplianceTrend: { month: string; pct: number }[];
  escalationTrend: { month: string; count: number }[];
}

export interface ApprovalFilters {
  status?: string;
  department?: string;
  document_type?: string;
  approver_id?: string;
  approval_type?: string;
  search?: string;
  overdue?: boolean;
  delegated?: boolean;
  escalated?: boolean;
  in_progress?: boolean;
  approved_today?: boolean;
  rejected_today?: boolean;
  returned?: boolean;
}

export interface ApprovalActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const FUNCTIONAL_HEAD = [...DEPT_HEAD, 'regulatory_affairs'];
const QUALITY_HEAD = [...ADMIN, 'head_qa', 'qa_manager'];
const APPROVER = [...QA, ...DEPT_HEAD, ...FUNCTIONAL_HEAD];
const AUTHOR = [...DOC_CONTROLLER, 'production_manager', 'qc_manager', 'production_executive'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewApprovals(role: string): boolean {
  return !EMPLOYEE.includes(role);
}
export function canManageApprovals(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canApproveDocuments(role: string): boolean { return APPROVER.includes(role); }
export function canViewApprovalStatus(role: string): boolean { return AUTHOR.includes(role) || canApproveDocuments(role); }
export function isApprovalReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportApprovals(role: string): boolean { return canViewApprovals(role); }
export function canDesignApprovalWorkflows(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canBulkApprove(role: string): boolean { return QUALITY_HEAD.includes(role) || DOC_CONTROLLER.includes(role); }
export function canViewAssignedApprovalsOnly(role: string): boolean {
  return ['production_executive', 'qc_executive'].includes(role) && !DEPT_HEAD.includes(role);
}

export function approvalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    'Pending Approval': 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-700',
    Returned: 'bg-orange-100 text-orange-800',
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

export function computeApprovalSlaStatus(dueDate: string, status: string, completedDate?: string | null): string {
  if (status === 'Approved' || status === 'Rejected' || status === 'Cancelled') return 'Completed';
  const today = new Date().toISOString().split('T')[0];
  if (dueDate < today) return 'Overdue';
  const due = new Date(dueDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 3);
  if (due <= threshold) return 'At Risk';
  return 'On Track';
}

export const DEFAULT_APPROVAL_WORKFLOWS: ApprovalWorkflowDefinition[] = [
  {
    id: 'daw-seq-standard', name: 'Standard Sequential Approval', approval_type: 'Sequential', module: DAW_MODULE_TAG, active: true,
    steps: [
      { order: 1, name: 'Department Head Approval', role: 'production_manager', mandatory: true, e_signature_required: false, due_days: 5 },
      { order: 2, name: 'QA Approval', role: 'qa_manager', mandatory: true, e_signature_required: true, due_days: 5 },
      { order: 3, name: 'Quality Head Approval', role: 'head_qa', mandatory: true, e_signature_required: true, due_days: 3 },
    ],
  },
  {
    id: 'daw-par-dept-qa', name: 'Parallel Department + QA', approval_type: 'Parallel', module: DAW_MODULE_TAG, active: true,
    steps: [
      { order: 1, name: 'Department Head', role: 'production_manager', mandatory: true, e_signature_required: false, due_days: 5 },
      { order: 1, name: 'QA Manager', role: 'qa_manager', mandatory: true, e_signature_required: true, due_days: 5 },
    ],
  },
  {
    id: 'daw-single-qa', name: 'Single Level QA Approval', approval_type: 'Single Level', module: DAW_MODULE_TAG, active: true,
    steps: [
      { order: 1, name: 'QA Head Approval', role: 'head_qa', mandatory: true, e_signature_required: true, due_days: 7 },
    ],
  },
];
