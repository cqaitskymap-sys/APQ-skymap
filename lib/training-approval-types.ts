export const TRAINING_APPROVAL_COLLECTIONS = {
  workflows: 'approval_workflows',
  requests: 'approval_requests',
  steps: 'approval_steps',
  esignRecords: 'esign_records',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  assignments: 'training_assignments',
  records: 'training_records',
  effectiveness: 'training_effectiveness',
  certificates: 'training_certificates',
  retraining: 'retraining_records',
} as const;

export const TRAINING_APPROVAL_MODULE = 'Training Approval Workflow';

export const WORKFLOW_TYPES = [
  'Training Assignment Approval',
  'Training Completion Review',
  'Assessment Approval',
  'Competency Approval',
  'Training Effectiveness Approval',
  'Certificate Approval',
  'Certificate Renewal Approval',
  'Retraining Approval',
  'Training Exception Approval',
  'Training Waiver Approval',
] as const;

export const WORKFLOW_STATUSES = [
  'Draft', 'Pending Approval', 'Under Review', 'Approved', 'Rejected',
  'Returned for Revision', 'Cancelled', 'Closed',
] as const;

export const APPROVAL_ACTIONS = [
  'Approve', 'Reject', 'Return for Revision', 'Delegate', 'Escalate', 'Cancel', 'Close',
] as const;

export const PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;

export type WorkflowType = typeof WORKFLOW_TYPES[number];
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number];
export type ApprovalAction = typeof APPROVAL_ACTIONS[number];
export type Priority = typeof PRIORITIES[number];

export interface TrainingApprovalActor {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export interface ApprovalWorkflowTemplate {
  id: string;
  workflow_id: string;
  workflow_number: string;
  workflow_name: string;
  workflow_type: WorkflowType | string;
  module: string;
  total_steps: number;
  steps_config: ApprovalStepConfig[];
  electronic_signature_required: boolean;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface ApprovalStepConfig {
  step_number: number;
  step_name: string;
  approver_role: string;
  due_days: number;
  e_signature_required: boolean;
  comment_required: boolean;
}

export interface ApprovalRequest {
  id: string;
  workflow_id: string;
  workflow_number: string;
  workflow_name: string;
  workflow_type: WorkflowType | string;
  reference_id: string;
  reference_number: string;
  current_status: WorkflowStatus | string;
  priority: Priority | string;
  initiated_by: string;
  initiated_by_name: string;
  assigned_approver: string;
  assigned_approver_name: string;
  approval_level: number;
  current_step: number;
  total_steps: number;
  due_date: string;
  completed_date: string | null;
  electronic_signature_required: boolean;
  approval_decision: string;
  approval_comments: string;
  rejection_reason: string;
  department: string;
  module: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface ApprovalStep {
  id: string;
  request_id: string;
  step_number: number;
  step_name: string;
  approver_role: string;
  approver_id: string;
  approver_name: string;
  status: 'Waiting' | 'Pending' | 'Approved' | 'Rejected' | 'Returned' | 'Delegated' | 'Escalated' | 'Skipped';
  due_date: string;
  completed_date: string | null;
  e_signature_required: boolean;
  comment_required?: boolean;
  e_signature_id: string | null;
  comments: string;
  rejection_reason: string;
  delegated_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalHistoryEntry {
  id: string;
  request_id: string;
  workflow_number: string;
  action: string;
  step_name: string;
  user_id: string;
  user_name: string;
  user_role: string;
  comments: string;
  created_at: string;
}

export interface ApprovalFilters {
  workflowType?: string;
  status?: string;
  approver?: string;
  requester?: string;
  department?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ApprovalDashboardKpis {
  pendingApprovals: number;
  approvedToday: number;
  rejectedToday: number;
  overdueApprovals: number;
  averageApprovalTimeHours: number;
  slaCompliancePercent: number;
  electronicSignaturesCompleted: number;
  escalatedRequests: number;
}

export interface ApprovalDashboardCharts {
  statusDistribution: { name: string; value: number }[];
  approvalTrend: { date: string; approved: number; rejected: number }[];
  avgApprovalTime: { type: string; hours: number }[];
  departmentApprovals: { name: string; value: number }[];
  workflowTypeDistribution: { name: string; value: number }[];
  slaComplianceTrend: { date: string; percent: number }[];
}

export interface ApprovalDashboardData {
  kpis: ApprovalDashboardKpis;
  charts: ApprovalDashboardCharts;
  requests: ApprovalRequest[];
  steps: ApprovalStep[];
  pendingApprovals: ApprovalRequest[];
  recentDecisions: ApprovalRequest[];
  overdueApprovals: ApprovalRequest[];
  escalatedRequests: ApprovalRequest[];
  history: ApprovalHistoryEntry[];
  workflows: ApprovalWorkflowTemplate[];
}

export function generateWorkflowNumber(): string {
  const year = new Date().getFullYear();
  return `TAW-${year}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function generateRequestNumber(): string {
  return `TAR-${Date.now().toString(36).toUpperCase()}`;
}

export function isApprovalReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageApprovalWorkflows(role: string): boolean {
  return ['super_admin', 'admin'].includes(role);
}

export function canApproveTraining(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(role);
}

export function canInitiateTrainingApproval(role: string): boolean {
  return canApproveTraining(role)
    || ['training_coordinator'].includes(role)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

export function canViewTrainingApproval(role: string): boolean {
  return canInitiateTrainingApproval(role) || isApprovalReadOnly(role)
    || ['employee', 'production', 'qc', 'warehouse'].includes(role);
}

export function isEmployeeApprovalView(role: string): boolean {
  return ['employee', 'production', 'qc', 'warehouse'].includes(role)
    && !canInitiateTrainingApproval(role) && !isApprovalReadOnly(role);
}

export function roleMatchesApprover(userRole: string, stepRole: string): boolean {
  if (['super_admin', 'admin'].includes(userRole)) return true;
  if (userRole === stepRole) return true;
  if (stepRole === 'qa_manager' && ['qa_manager', 'head_qa'].includes(userRole)) return true;
  if (stepRole === 'qa_executive' && ['qa', 'qa_executive', 'qa_manager'].includes(userRole)) return true;
  if (stepRole === 'training_coordinator' && userRole === 'training_coordinator') return true;
  if (stepRole === 'department_head' && ['department_head', 'production_manager', 'qc_manager'].includes(userRole)) return true;
  if (stepRole === 'trainer' && userRole === 'trainer') return true;
  return false;
}

export function buildDefaultSteps(workflowType: string): ApprovalStepConfig[] {
  const base: ApprovalStepConfig[] = [
    { step_number: 1, step_name: 'Coordinator Review', approver_role: 'training_coordinator', due_days: 3, e_signature_required: false, comment_required: true },
    { step_number: 2, step_name: 'Department Head Approval', approver_role: 'department_head', due_days: 5, e_signature_required: true, comment_required: true },
    { step_number: 3, step_name: 'QA Review', approver_role: 'qa_manager', due_days: 7, e_signature_required: true, comment_required: true },
  ];
  if (workflowType.includes('Certificate') || workflowType.includes('Effectiveness')) {
    base.push({ step_number: 4, step_name: 'Head QA Final Approval', approver_role: 'head_qa', due_days: 5, e_signature_required: true, comment_required: true });
  }
  if (workflowType.includes('Waiver') || workflowType.includes('Exception')) {
    return [
      { step_number: 1, step_name: 'Department Head Review', approver_role: 'department_head', due_days: 3, e_signature_required: true, comment_required: true },
      { step_number: 2, step_name: 'QA Manager Approval', approver_role: 'qa_manager', due_days: 5, e_signature_required: true, comment_required: true },
      { step_number: 3, step_name: 'Head QA Authorization', approver_role: 'head_qa', due_days: 7, e_signature_required: true, comment_required: true },
    ];
  }
  return base;
}
