export const DAT_MODULE = 'Document Audit Trail';

export const DAT_COLLECTIONS = {
  auditTrail: 'audit_trail',
  auditEvents: 'audit_events',
  auditExports: 'audit_exports',
  auditFilters: 'audit_filters',
  documents: 'documents',
  versions: 'document_versions',
  signatures: 'electronic_signatures',
  notifications: 'notifications',
  users: 'users',
  roles: 'roles',
} as const;

export const AUDIT_EVENT_TYPES = [
  'Created', 'Updated', 'Submitted', 'Reviewed', 'Approved', 'Rejected', 'Returned',
  'Version Created', 'Effective', 'Superseded', 'Acknowledged', 'Training Assigned',
  'Training Completed', 'Printed', 'Downloaded', 'Exported', 'Distributed', 'Viewed',
  'Archived', 'Restored', 'Retention Applied', 'Disposed', 'Watermark Applied',
  'Electronic Signature Applied', 'Login', 'Logout', 'Configuration Changed', 'Permission Changed',
] as const;

export const AUDIT_EVENT_CATEGORIES = [
  'Document Lifecycle', 'Approval Workflow', 'Review Workflow', 'Distribution',
  'Training', 'Print Control', 'Archive', 'Retention', 'Security', 'System',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export type AuditEventCategory = (typeof AUDIT_EVENT_CATEGORIES)[number];

export interface DocumentAuditEntry {
  id: string;
  audit_id: string;
  audit_number: string;
  entity_type: string;
  entity_id: string;
  module: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_version: string;
  event_type: string;
  event_category: string;
  previous_value: string;
  new_value: string;
  action_summary: string;
  reason_for_change: string;
  performed_by: string;
  performer_role: string;
  performer_name: string;
  department: string;
  business_unit: string;
  site: string;
  timestamp_utc: string;
  local_timestamp: string;
  ip_address: string;
  device_information: string;
  browser_information: string;
  session_id: string;
  correlation_id: string;
  electronic_signature_id: string;
  related_record_id: string;
  risk_level: string;
  compliance_impact: string;
  source_system: string;
  record_hash: string;
  digital_fingerprint: string;
  status: string;
  created_at: string;
}

export interface AuditExportRecord {
  id: string;
  export_id: string;
  format: string;
  record_count: number;
  filters_applied: string;
  exported_by: string;
  exported_by_name: string;
  exported_at: string;
  status: string;
}

export interface DocumentAuditKpis {
  auditEventsToday: number;
  totalAuditRecords: number;
  criticalEvents: number;
  electronicSignatureEvents: number;
  securityEvents: number;
  configurationChanges: number;
  exportRequests: number;
  tamperVerificationStatus: string;
}

export interface DocumentAuditCharts {
  dailyActivity: { date: string; count: number }[];
  eventTypeDistribution: { name: string; value: number }[];
  moduleActivity: { name: string; value: number }[];
  userActivity: { name: string; value: number }[];
  departmentActivity: { name: string; value: number }[];
  securityEventTrend: { date: string; count: number }[];
}

export interface DocumentAuditFilters {
  search?: string;
  module?: string;
  event_type?: string;
  event_category?: string;
  department?: string;
  user_id?: string;
  document_number?: string;
  entity_id?: string;
  correlation_id?: string;
  risk_level?: string;
  critical?: boolean;
  security?: boolean;
  e_signature?: boolean;
  configuration?: boolean;
  start_date?: string;
  end_date?: string;
  department_only?: string;
}

export interface DocumentAuditActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

export interface HashVerificationResult {
  audit_id: string;
  valid: boolean;
  stored_hash: string;
  computed_hash: string;
  message: string;
}

const ADMIN = ['super_admin', 'admin'];
const QA = [...ADMIN, 'head_qa', 'qa_manager', 'qa_executive', 'quality_assurance'];
const COMPLIANCE = [...ADMIN, 'compliance_officer', 'regulatory_affairs'];
const RECORDS = [...ADMIN, 'document_controller', 'records_manager'];
const DEPT_HEAD = [...ADMIN, 'head_qa', 'qa_manager', 'production_manager', 'qc_manager'];
const AUDITOR = ['auditor'];
const EMPLOYEE = ['employee', 'viewer'];

export function canViewDocumentAuditTrail(role: string): boolean {
  return QA.includes(role) || COMPLIANCE.includes(role) || RECORDS.includes(role)
    || DEPT_HEAD.includes(role) || AUDITOR.includes(role) || EMPLOYEE.includes(role);
}
export function canExportDocumentAuditTrail(role: string): boolean {
  return QA.includes(role) || COMPLIANCE.includes(role) || ADMIN.includes(role);
}
export function canReviewDocumentAuditTrail(role: string): boolean { return COMPLIANCE.includes(role); }
export function isDocumentAuditReadOnly(role: string): boolean { return AUDITOR.includes(role); }
export function isEmployeeOwnActivityView(role: string): boolean {
  return EMPLOYEE.includes(role) && !QA.includes(role) && !RECORDS.includes(role);
}
export function isDeptHeadAuditView(role: string): boolean {
  return DEPT_HEAD.includes(role) && !QA.includes(role) && !RECORDS.includes(role);
}

export function auditStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Success: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
    Verified: 'bg-blue-100 text-blue-800',
    Tampered: 'bg-red-100 text-red-800',
    Critical: 'bg-red-100 text-red-800',
    Pending: 'bg-amber-100 text-amber-800',
  };
  return colors[status] || colors.Success;
}

export function riskLevelColor(level: string): string {
  const colors: Record<string, string> = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return colors[level] || colors.Low;
}

export const DMS_AUDIT_MODULE_NAMES = [
  'DMS', 'Document Management', 'Document Master', 'Document Lifecycle',
  'SOP Management', 'Work Instructions', 'Forms & Templates', 'Forms Templates',
  'Controlled Distribution', 'Acknowledgements', 'Version Control',
  'Review Workflow', 'Approval Workflow', 'Effective Date Management',
  'Periodic Review Management', 'Document Training Linkage', 'Change Impact Assessment',
  'Archive Management', 'Retention & Disposal Management', 'External Document Management',
  'Print Control Management', 'Watermark Management', 'Document Audit Trail',
  'Electronic Signatures',
] as const;

export const CRITICAL_DMS_EVENTS = new Set([
  'Delete', 'Rejected', 'Permission Changed', 'Configuration Changed',
  'Disposed', 'Tamper Detected', 'Electronic Signature Applied',
]);

export const SECURITY_DMS_EVENTS = new Set([
  'Login', 'Logout', 'Permission Changed', 'Configuration Changed',
]);
