export const ACK_MODULE = 'Document Acknowledgement & Read Confirmation';

export const ACK_COLLECTIONS = {
  acknowledgements: 'document_acknowledgements',
  readConfirmations: 'read_confirmations',
  documents: 'documents',
  distribution: 'document_distribution',
  trainingAssignments: 'training_assignments',
  employees: 'employees',
  departments: 'departments',
  roles: 'roles',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
} as const;

export const ACK_STATUSES = [
  'Pending', 'Viewed', 'Read Confirmed', 'Acknowledged', 'Overdue', 'Expired', 'Cancelled',
] as const;

export const COMPLETION_STATUSES = ['Incomplete', 'Completed'] as const;

export type AckStatus = (typeof ACK_STATUSES)[number];
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export interface DocumentAcknowledgementRecord {
  id: string;
  acknowledgement_id: string;
  acknowledgement_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_version: string;
  document_type: string;
  distribution_id: string | null;
  employee_id: string;
  employee_name: string;
  department: string;
  role: string;
  assigned_date: string;
  due_date: string | null;
  viewed_date: string | null;
  read_confirmation_date: string | null;
  acknowledgement_date: string | null;
  electronic_signature_required: boolean;
  electronic_signature_status: string;
  acknowledgement_status: AckStatus | string;
  completion_status: CompletionStatus | string;
  training_required: boolean;
  training_pending: boolean;
  comments: string;
  ip_address: string | null;
  device_information: string | null;
  browser_information: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AcknowledgementKpis {
  totalAcknowledgements: number;
  pending: number;
  completed: number;
  viewedOnly: number;
  overdue: number;
  expired: number;
  readConfirmed: number;
  trainingPending: number;
}

export interface AcknowledgementCharts {
  acknowledgementTrend: { month: string; count: number }[];
  completionRate: { name: string; value: number }[];
  departmentCompletion: { name: string; value: number; pct: number }[];
  overdueTrend: { month: string; count: number }[];
  documentTypeDistribution: { name: string; value: number }[];
  trainingAssignmentTrend: { month: string; count: number }[];
}

export interface AcknowledgementFilters {
  status?: string;
  completion_status?: string;
  department?: string;
  document_type?: string;
  employee_id?: string;
  search?: string;
  overdue?: boolean;
  training_pending?: boolean;
}

export interface AcknowledgementActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const DOC_CONTROLLER = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'];
const AUDITOR = ['auditor'];

export function canViewAcknowledgements(_role: string): boolean { return true; }
export function canManageAcknowledgements(role: string): boolean { return DOC_CONTROLLER.includes(role); }
export function canReviewAcknowledgements(role: string): boolean { return QA.includes(role); }
export function canViewDeptAcknowledgements(role: string): boolean { return DEPT_HEAD.includes(role); }
export function canAcknowledgeOwn(role: string): boolean { return !AUDITOR.includes(role); }
export function isAcknowledgementReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportAcknowledgements(role: string): boolean { return !isAcknowledgementReadOnly(role) || role === 'auditor'; }
export function canSendReminders(role: string): boolean { return DOC_CONTROLLER.includes(role) || DEPT_HEAD.includes(role); }
export function canViewOwnOnly(role: string): boolean { return role === 'viewer' || role === 'employee' || role === 'production_executive' || role === 'qc_executive'; }

export function ackStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-700',
    Viewed: 'bg-blue-100 text-blue-800',
    'Read Confirmed': 'bg-indigo-100 text-indigo-800',
    Acknowledged: 'bg-green-100 text-green-800',
    Overdue: 'bg-red-100 text-red-700',
    Expired: 'bg-gray-100 text-gray-600',
    Cancelled: 'bg-purple-100 text-purple-800',
  };
  return colors[status] || colors.Pending;
}

export function isAckOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || ['Acknowledged', 'Expired', 'Cancelled'].includes(status)) return false;
  return dueDate < new Date().toISOString().split('T')[0];
}

export function isAckComplete(status: string): boolean {
  return status === 'Acknowledged';
}
