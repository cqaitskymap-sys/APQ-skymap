export const RDM_MODULE = 'Retention & Disposal Management';

export const RDM_COLLECTIONS = {
  policies: 'retention_policies',
  schedules: 'retention_schedules',
  reviews: 'retention_reviews',
  events: 'retention_events',
  disposalRequests: 'disposal_requests',
  disposalApprovals: 'disposal_approvals',
  disposalCertificates: 'disposal_certificates',
  legalHolds: 'legal_holds',
  regulatoryHolds: 'regulatory_holds',
  archives: 'document_archive',
  documents: 'documents',
  notifications: 'notifications',
  auditTrail: 'audit_trail',
  signatures: 'electronic_signatures',
  users: 'users',
  roles: 'roles',
} as const;

export const RETENTION_TRIGGERS = [
  'Approval Date', 'Effective Date', 'Superseded Date', 'Archive Date',
  'Retirement Date', 'Closure Date', 'Custom Trigger',
] as const;

export const RETENTION_UNITS = ['Days', 'Months', 'Years', 'Permanent'] as const;

export const DISPOSAL_METHODS = [
  'Secure Digital Deletion', 'Cryptographic Erasure', 'Physical Destruction',
  'Third-Party Certified Destruction', 'Manual Disposal', 'Permanent Archive',
] as const;

export const RETENTION_STATUSES = [
  'Draft', 'Active', 'Pending Review', 'Expired', 'Archived',
  'Disposed', 'Legal Hold', 'Regulatory Hold',
] as const;

export const POLICY_STATUSES = ['Draft', 'Active', 'Pending Review', 'Retired'] as const;

export const DISPOSAL_STATUSES = ['Pending', 'Pending Approval', 'Approved', 'Rejected', 'Completed', 'Cancelled'] as const;

export type RetentionTrigger = (typeof RETENTION_TRIGGERS)[number];
export type RetentionUnit = (typeof RETENTION_UNITS)[number];
export type DisposalMethod = (typeof DISPOSAL_METHODS)[number];
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

export interface RetentionPolicyRecord {
  id: string;
  retention_policy_id: string;
  policy_number: string;
  policy_name: string;
  description: string;
  document_type: string;
  document_category: string;
  department: string;
  business_unit: string;
  site: string;
  applicable_regulations: string[];
  retention_trigger: RetentionTrigger | string;
  retention_period: number;
  retention_unit: RetentionUnit | string;
  archive_required: boolean;
  disposal_method: DisposalMethod | string;
  legal_hold_allowed: boolean;
  regulatory_hold_allowed: boolean;
  approval_workflow: string;
  status: string;
  effective_date: string;
  review_frequency: string;
  owner: string;
  owner_name: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface RetentionScheduleRecord {
  id: string;
  schedule_id: string;
  schedule_number: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_type: string;
  department: string;
  policy_id: string;
  policy_number: string;
  policy_name: string;
  retention_trigger: string;
  trigger_date: string;
  retention_expiry_date: string | null;
  retention_status: RetentionStatus | string;
  archive_id: string | null;
  legal_hold: boolean;
  regulatory_hold: boolean;
  disposal_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisposalRequestRecord {
  id: string;
  request_id: string;
  request_number: string;
  schedule_id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  disposal_method: DisposalMethod | string;
  disposal_reason: string;
  status: string;
  requested_by: string;
  requested_by_name: string;
  approved_by: string;
  approved_by_name: string;
  electronic_signature_required: boolean;
  certificate_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisposalCertificateRecord {
  id: string;
  certificate_id: string;
  certificate_number: string;
  disposal_request_id: string;
  document_number: string;
  document_title: string;
  disposal_method: string;
  disposed_by: string;
  disposed_by_name: string;
  disposal_date: string;
  witness: string;
  witness_name: string;
  created_at: string;
}

export interface RetentionDisposalKpis {
  activePolicies: number;
  documentsUnderRetention: number;
  retentionExpiringSoon: number;
  pendingDisposal: number;
  disposedRecords: number;
  legalHolds: number;
  regulatoryHolds: number;
  permanentRecords: number;
}

export interface RetentionDisposalCharts {
  retentionExpiryTrend: { month: string; count: number }[];
  retentionByDocumentType: { name: string; value: number }[];
  departmentRetentionDistribution: { name: string; value: number }[];
  disposalTrend: { month: string; count: number }[];
  legalHoldTrend: { month: string; count: number }[];
  regulatoryHoldTrend: { month: string; count: number }[];
}

export interface RetentionDisposalFilters {
  status?: string;
  department?: string;
  document_type?: string;
  retention_status?: string;
  policy_status?: string;
  search?: string;
  expiring?: boolean;
  pending_disposal?: boolean;
  disposed?: boolean;
  legal_hold?: boolean;
  regulatory_hold?: boolean;
  permanent?: boolean;
  department_only?: string;
}

export interface RetentionDisposalActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

const ADMIN = ['super_admin', 'admin'];
const RECORDS_MANAGER = [...ADMIN, 'document_controller', 'regulatory_affairs'];
const DOC_CONTROLLER = [...RECORDS_MANAGER, 'head_qa'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive'];
const COMPLIANCE = [...ADMIN, 'regulatory_affairs', 'head_qa', 'qa_manager'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewRetentionDisposal(role: string): boolean {
  return DOC_CONTROLLER.includes(role) || QA.includes(role) || COMPLIANCE.includes(role)
    || DEPT_HEAD.includes(role) || AUDITOR.includes(role);
}
export function canManagePolicies(role: string): boolean { return RECORDS_MANAGER.includes(role); }
export function canManageDisposal(role: string): boolean { return DOC_CONTROLLER.includes(role) || RECORDS_MANAGER.includes(role); }
export function canApproveDisposal(role: string): boolean { return QA.includes(role); }
export function canManageHolds(role: string): boolean { return COMPLIANCE.includes(role) || QA.includes(role); }
export function isRetentionReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function canExportRetention(role: string): boolean { return canViewRetentionDisposal(role); }
export function isEmployeeNoDisposal(role: string): boolean {
  return EMPLOYEE.includes(role) && !canViewRetentionDisposal(role);
}

export function retentionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    Active: 'bg-green-100 text-green-800',
    'Pending Review': 'bg-amber-100 text-amber-800',
    Expired: 'bg-orange-100 text-orange-800',
    Archived: 'bg-purple-100 text-purple-800',
    Disposed: 'bg-red-100 text-red-800',
    'Legal Hold': 'bg-red-100 text-red-900',
    'Regulatory Hold': 'bg-amber-100 text-amber-900',
  };
  return colors[status] || colors.Active;
}

export const RETENTION_WARNING_DAYS = 90;
export const DEFAULT_RETENTION_PERIOD = 7;
export const DEFAULT_RETENTION_UNIT = 'Years';
