export const RISK_AUDIT_TRAIL_MODULE = 'Risk Audit Trail';

export const RISK_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'FMEA Created',
  'Failure Mode Added',
  'RPN Calculated',
  'Mitigation Created',
  'Residual Risk Calculated',
  'Review Started',
  'Review Completed',
  'Approved',
  'Rejected',
  'Sent Back',
  'Closed',
  'Reopened',
  'E-Signature Applied',
  'Exported',
] as const;

export const RISK_AUDIT_MODULES = [
  'Risk Management',
  'Risk Assessment',
  'CPV Risk Assessment Worksheet',
  'Risk FMEA',
  'Risk Mitigation',
  'Risk Review',
  'Risk Approval',
  'Risk Closure',
  'Risk Audit Trail',
  'Risk Dashboard',
] as const;

export const RISK_TIMELINE_SECTIONS = [
  'Risk Creation',
  'FMEA Activities',
  'Risk Scoring',
  'Mitigation Activities',
  'Residual Risk Review',
  'Approval Workflow',
  'Monitoring Review',
  'Closure Activities',
  'Reopen Activities',
] as const;

export interface RiskAuditFilters {
  search?: string;
  risk_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

export interface RiskAuditEntry {
  id: string;
  audit_id: string;
  risk_assessment_id: string;
  risk_number: string;
  module_name: string;
  action_type: string;
  action_description: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_by_name: string;
  changed_by_role: string;
  department: string;
  reason: string;
  ip_address: string;
  device_info: string;
  date_time: string;
  status: string;
}

export interface RiskAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  fmeaActivities: number;
  scoringActivities: number;
  mitigationActivities: number;
  approvalActivities: number;
  closureActivities: number;
  reopenedRisks: number;
  exportActivities: number;
}

export interface RiskAuditActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

function roleKey(role?: string | null): string {
  return (role || '').toLowerCase().replace(/\s+/g, '_');
}

export function canViewRiskAuditTrailModule(role?: string | null): boolean {
  const r = roleKey(role);
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'auditor', 'viewer',
  ].includes(r);
}

export function canExportRiskAuditTrailModule(role?: string | null): boolean {
  const r = roleKey(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager'].includes(r);
}

export function isRiskAuditTrailReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(roleKey(role));
}
