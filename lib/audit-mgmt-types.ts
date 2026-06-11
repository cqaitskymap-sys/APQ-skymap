export const AUDIT_COLLECTIONS = {
  audits: 'audits',
  checklists: 'audit_checklists',
  findings: 'audit_findings',
  capaLinks: 'audit_capa_links',
  approvals: 'audit_approvals',
  attachments: 'audit_attachments',
  schedule: 'audit_schedule',
  reports: 'audit_reports',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  capa: 'capa_records',
} as const;

export const AUDIT_TYPES = [
  'Internal Audit', 'Self Inspection', 'Supplier Audit', 'Customer Audit',
  'Regulatory Audit', 'External Audit', 'GMP Audit', 'CSV Audit', 'Data Integrity Audit',
] as const;

export const AUDIT_STATUSES = [
  'planned', 'scheduled', 'in_progress', 'completed', 'report_drafted',
  'capa_required', 'capa_in_progress', 'closed', 'cancelled', 'overdue',
] as const;

export const COMPLIANCE_STATUSES = [
  'Compliant', 'Partially Compliant', 'Non-Compliant', 'Not Applicable',
] as const;

export const FINDING_TYPES = [
  'Critical', 'Major', 'Minor', 'Observation', 'Opportunity for Improvement',
] as const;

export const FINDING_CATEGORIES = [
  'GMP', 'GDP', 'Data Integrity', 'Documentation', 'Training', 'Equipment',
  'Process', 'Cleaning', 'Validation', 'CSV', 'Warehouse', 'QC', 'QA', 'Production', 'Engineering', 'IT',
] as const;

export const FINDING_STATUSES = [
  'open', 'under_review', 'capa_in_progress', 'closed', 'overdue', 'cancelled',
] as const;

export const AUDIT_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory',
  'Microbiology', 'Packaging', 'Maintenance', 'IT / CSV', 'PQR', 'CPV',
] as const;

export const APPROVAL_DECISIONS = ['pending', 'approved', 'rejected'] as const;

export type AuditType = typeof AUDIT_TYPES[number];
export type AuditStatus = typeof AUDIT_STATUSES[number];
export type FindingType = typeof FINDING_TYPES[number];
export type ComplianceStatus = typeof COMPLIANCE_STATUSES[number];

export interface AuditActor {
  id: string;
  name: string;
  role: string;
}

export interface AuditRecord {
  id: string;
  audit_number: string;
  audit_type: AuditType | string;
  audit_title: string;
  department: string;
  audit_scope: string;
  audit_criteria: string;
  audit_date: string;
  audit_start_time: string;
  audit_end_time: string;
  lead_auditor: string;
  lead_auditor_name: string;
  auditor_team: string;
  auditee: string;
  status: AuditStatus | string;
  remarks: string;
  total_findings: number;
  critical_findings: number;
  capa_required_count: number;
  linked_pqr_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuditChecklistItem {
  id: string;
  audit_id: string;
  checklist_number: string;
  audit_area: string;
  checklist_question: string;
  requirement_reference: string;
  expected_evidence: string;
  observation: string;
  compliance_status: ComplianceStatus | string;
  auditor_remarks: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuditFinding {
  id: string;
  finding_number: string;
  audit_id: string;
  audit_number: string;
  finding_type: FindingType | string;
  finding_category: string;
  department: string;
  observation: string;
  requirement_reference: string;
  evidence: string;
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  risk_level: string;
  root_cause: string;
  correction: string;
  capa_required: boolean;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  responsible_person: string;
  responsible_person_name: string;
  target_closure_date: string | null;
  actual_closure_date: string | null;
  finding_status: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AuditCapaLink {
  id: string;
  audit_id: string;
  finding_id: string;
  capa_id: string;
  capa_number: string;
  linked_at: string;
  linked_by: string;
  linked_by_name: string;
}

export interface AuditApproval {
  id: string;
  audit_id: string;
  approver_id: string;
  approver_name: string;
  decision: string;
  comments: string;
  signed_at: string | null;
  created_at: string;
}

export interface AuditAttachment {
  id: string;
  audit_id: string;
  finding_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  download_url: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface AuditScheduleEntry {
  id: string;
  audit_id: string | null;
  audit_number: string;
  audit_title: string;
  audit_type: string;
  department: string;
  planned_date: string;
  lead_auditor_name: string;
  status: string;
  created_at: string;
}

export interface AuditFilters {
  status?: string;
  audit_type?: string;
  department?: string;
  search?: string;
}

export interface AuditDashboardMetrics {
  total: number;
  planned: number;
  completed: number;
  openFindings: number;
  closedFindings: number;
  criticalFindings: number;
  capaRequired: number;
  overdueFindings: number;
}

export function calculateRpn(severity: number, occurrence: number, detectability: number): number {
  return severity * occurrence * detectability;
}

export function rpnToLevel(rpn: number): string {
  if (rpn >= 100) return 'Critical';
  if (rpn >= 50) return 'High';
  if (rpn >= 20) return 'Medium';
  return 'Low';
}

export function isAuditReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canCreateAudit(role: string): boolean {
  return !isAuditReadOnly(role);
}

export function canManageFindings(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'auditor'].includes(role)
    || role === 'qa';
}

export function canApproveAudit(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isFindingOverdue(targetDate: string | null, status: string): boolean {
  if (!targetDate || status === 'closed') return false;
  return new Date(targetDate) < new Date();
}
