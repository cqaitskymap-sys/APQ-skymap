export const DEVIATION_COLLECTIONS = {
  deviations: 'deviations',
  investigations: 'deviation_investigations',
  impactAssessments: 'deviation_impact_assessments',
  capaLinks: 'deviation_capa_links',
  closures: 'deviation_closure',
  trends: 'deviation_trends',
  reports: 'deviation_reports',
  approvals: 'deviation_approvals',
  approvalHistory: 'deviation_approval_history',
  attachments: 'deviation_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  capa: 'capa_records',
} as const;

export const DEVIATION_CATEGORIES = [
  'Process', 'Equipment', 'Utility', 'Material', 'Documentation',
  'Environmental', 'Cleaning', 'Sterilization', 'Testing', 'Packaging',
  'Software / CSV', 'Warehouse', 'Training', 'Other',
] as const;

export const IMPACT_OPTION_VALUES = ['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as const;
export const BATCH_IMPACT_OPTIONS = ['Yes', 'No', 'Not Applicable'] as const;
export const IMPACT_ASSESSMENT_STATUSES = ['Draft', 'Submitted', 'QA Review', 'Approved', 'Rejected'] as const;
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const TRI_STATE_IMPACT_OPTIONS = ['Yes', 'No', 'Under Evaluation'] as const;
export const YES_NO_OPTIONS = ['Yes', 'No'] as const;

export const DEVIATION_PLANNED_TYPES = ['Planned', 'Unplanned'] as const;
export const DEVIATION_CRITICALITIES = ['Minor', 'Major', 'Critical'] as const;
export const RCA_METHODS = [
  '5 Why', 'Fishbone', 'Fault Tree Analysis', 'Human Error Analysis',
  'Equipment Failure Analysis', 'Manual RCA',
] as const;

export const INVESTIGATION_STATUSES = [
  'Not Started', 'In Progress', 'QA Review', 'CAPA Required', 'Completed', 'Rejected', 'Closed',
] as const;

export const DEVIATION_STATUSES = [
  'draft', 'submitted', 'under_investigation', 'qa_review',
  'capa_required', 'approved', 'rejected', 'closed', 'overdue',
] as const;

export const OPEN_DEVIATION_STATUSES = [
  'draft', 'submitted', 'under_investigation', 'qa_review',
  'capa_required', 'overdue', 'open', 'capa_raised',
] as const;

export const DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse',
  'Regulatory', 'Microbiology', 'Packaging', 'Maintenance',
] as const;

export type DeviationCategory = typeof DEVIATION_CATEGORIES[number];
export type DeviationPlannedType = typeof DEVIATION_PLANNED_TYPES[number];
export type DeviationCriticality = typeof DEVIATION_CRITICALITIES[number];
export type DeviationStatus = typeof DEVIATION_STATUSES[number];
export type RcaMethod = typeof RCA_METHODS[number];

export interface DeviationRecord {
  id: string;
  deviation_number: string;
  deviation_date: string;
  title: string;
  department: string;
  product_name: string;
  product_id: string | null;
  batch_number: string;
  batch_id: string | null;
  area: string;
  reported_by: string;
  reported_by_name: string;
  detected_by: string;
  detected_by_name: string;
  category: DeviationCategory | string;
  planned_type: DeviationPlannedType;
  criticality: DeviationCriticality;
  /** Legacy field for PQR/CPV compatibility */
  deviation_type: 'minor' | 'major' | 'critical';
  description: string;
  immediate_action: string;
  batch_impacted: boolean;
  product_quality_impacted: boolean;
  patient_safety_impacted: boolean;
  regulatory_impact: boolean;
  repeat_deviation: boolean;
  capa_required: boolean;
  linked_capa_number: string | null;
  linked_capa_id: string | null;
  target_closure_date: string | null;
  actual_closure_date: string | null;
  status: DeviationStatus | string;
  qa_remarks: string;
  assigned_investigator: string | null;
  assigned_investigator_name: string | null;
  source: 'manual' | 'cpv_cpp' | 'cpv_cqa' | 'batch' | 'pqr';
  source_reference: string | null;
  pqr_id: string | null;
  cpv_record_id: string | null;
  risk_assessment: 'low' | 'medium' | 'high' | 'critical';
  /** Legacy */
  detected_date: string;
  root_cause: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_by: string;
  updated_by_name: string;
  updated_at: string;
  /** Extended create-module fields */
  deviation_time?: string;
  product_code?: string;
  market?: string;
  manufacturing_date?: string;
  expiry_date?: string;
  batch_impact?: string;
  product_quality_impact?: string;
  patient_safety_impact?: string;
  regulatory_impact_status?: string;
  previous_deviation_reference?: string;
  investigation_required?: boolean;
  qa_reviewer?: string | null;
  qa_reviewer_name?: string | null;
  head_qa_approval_required?: boolean;
  cpv_batch_id?: string | null;
  is_deleted?: boolean;
  remarks?: string;
}

export interface DeviationInvestigation {
  id: string;
  deviation_id: string;
  deviation_number?: string;
  investigation_start_date?: string;
  investigation_due_date?: string;
  rca_method: RcaMethod | string;
  root_cause_details: string;
  root_cause?: string;
  contributing_factors?: string;
  investigation_summary: string;
  detailed_investigation?: string;
  immediate_correction?: string;
  corrective_action_required?: boolean;
  preventive_action_required?: boolean;
  capa_required?: boolean;
  linked_capa_number?: string | null;
  impact_on_batch?: string;
  impact_on_product_quality?: string;
  impact_on_patient_safety?: string;
  impact_on_regulatory_compliance?: string;
  other_batches_impacted?: string;
  other_batches_details?: string;
  final_investigation_conclusion?: string;
  investigation_status?: string;
  reviewed_by_qa?: string | null;
  reviewed_by_qa_name?: string | null;
  qa_review_date?: string | null;
  qa_comments?: string;
  five_why?: {
    why1?: string; why2?: string; why3?: string; why4?: string; why5?: string; rootCause?: string;
  };
  investigator_id: string;
  investigator_name: string;
  department?: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  created_by_name?: string;
  updated_by_name?: string;
  is_deleted?: boolean;
}

export interface DeviationImpactAssessment {
  id: string;
  deviation_id: string;
  deviation_number?: string;
  product?: string;
  batch_number?: string;
  assessment_date?: string;
  assessed_by: string;
  assessed_by_name: string;
  department?: string;
  batch_impact?: string;
  product_quality_impact?: string;
  patient_safety_impact?: string;
  regulatory_impact?: string;
  stability_impact?: string;
  validation_impact?: string;
  equipment_impact?: string;
  utility_impact?: string;
  material_impact?: string;
  packaging_impact?: string;
  cleaning_impact?: string;
  documentation_impact?: string;
  training_impact?: string;
  market_impact?: string;
  other_batches_impacted?: string;
  impacted_batch_numbers?: string;
  impact_description?: string;
  impact_summary: string;
  batch_impact_details: string;
  product_quality_impact_details: string;
  patient_safety_impact_details: string;
  regulatory_impact_details: string;
  severity?: number;
  occurrence?: number;
  detection?: number;
  risk_score?: number;
  risk_level?: string;
  capa_required: boolean;
  capa_justification: string;
  recall_evaluation_required?: boolean;
  conclusion?: string;
  qa_comments?: string;
  status?: string;
  reviewed_by_qa?: string | null;
  reviewed_by_qa_name?: string | null;
  qa_review_date?: string | null;
  assessed_at: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  created_by_name?: string;
  updated_by_name?: string;
  is_deleted?: boolean;
}

export const CAPA_LINK_DISPLAY_STATUSES = [
  'Draft', 'Open', 'Under Implementation', 'Effectiveness Pending', 'Closed', 'Overdue',
] as const;

export interface DeviationCapaLink {
  id: string;
  deviation_id: string;
  deviation_number: string;
  capa_required: boolean;
  capa_number: string;
  capa_id: string | null;
  capa_title: string;
  capa_source: string;
  root_cause: string;
  corrective_action: string;
  preventive_action: string;
  responsible_person: string;
  responsible_person_name: string;
  target_completion_date: string | null;
  capa_status: string;
  effectiveness_check_required: boolean;
  effectiveness_check_date: string | null;
  effectiveness_result: string;
  linked_by: string;
  linked_by_name: string;
  linked_date: string;
  remarks: string;
  is_active: boolean;
  unlink_reason?: string;
  unlinked_at?: string | null;
  unlinked_by?: string | null;
  unlinked_by_name?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
}

export const DEVIATION_WORKFLOW_STEPS = [
  'Draft', 'Submitted', 'Department Review', 'Investigation Review',
  'QA Review', 'Head QA Review', 'Final Approval', 'Closed',
] as const;

export const DEVIATION_APPROVAL_STATUSES = [
  'Pending', 'Approved', 'Rejected', 'Sent Back', 'Escalated', 'Completed',
] as const;

export interface DeviationApproval {
  id: string;
  deviation_id: string;
  deviation_number?: string;
  approval_id?: string;
  current_workflow_step?: string;
  current_approver?: string;
  current_approver_name?: string;
  current_role?: string;
  approval_level: number | string;
  approval_status?: string;
  approval_level_legacy?: 'qa_review' | 'head_qa' | 'final';
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected' | 'pending' | 'sent_back' | 'escalated';
  comments: string;
  rejection_reason?: string;
  send_back_reason?: string;
  e_signature_required?: boolean;
  e_signature: string;
  e_signature_status?: string;
  signed_at: string | null;
  due_date?: string | null;
  completed_date?: string | null;
  escalation_status?: string;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
}

export interface DeviationApprovalHistoryEntry {
  id?: string;
  deviation_id: string;
  deviation_number: string;
  approval_id: string;
  action: string;
  workflow_step: string;
  user_id: string;
  user_name: string;
  user_role: string;
  comments: string;
  rejection_reason?: string;
  send_back_reason?: string;
  e_signature_status?: string;
  created_at: string;
  created_by: string;
  is_deleted?: boolean;
}

export const CLOSURE_STATUSES = [
  'Pending', 'Ready For Closure', 'QA Review', 'Closed', 'Rejected', 'Reopened',
] as const;

export interface DeviationClosure {
  id: string;
  closure_id?: string;
  deviation_id: string;
  deviation_number: string;
  closure_date: string | null;
  closed_by: string;
  closed_by_name: string;
  department: string;
  investigation_completed: boolean;
  impact_assessment_completed: boolean;
  root_cause_identified: boolean;
  capa_required: boolean;
  capa_linked: boolean;
  capa_completed: boolean;
  effectiveness_check_completed: boolean;
  product_quality_impact_resolved: boolean;
  patient_safety_impact_resolved: boolean;
  regulatory_impact_resolved: boolean;
  all_attachments_reviewed: boolean;
  qa_closure_comments: string;
  final_closure_conclusion: string;
  closure_status: string;
  e_signature_required: boolean;
  signed_by: string;
  signed_date: string | null;
  reopen_reason?: string;
  readiness_percent?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  is_deleted?: boolean;
}

export interface DeviationAttachment {
  id: string;
  deviation_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface DeviationFilters {
  search?: string;
  deviation_number?: string;
  department?: string;
  product_name?: string;
  batch_number?: string;
  category?: string;
  criticality?: string;
  status?: string;
  capa_required?: boolean;
  date_from?: string;
  date_to?: string;
  assigned_to?: string;
  overdue_only?: boolean;
  kpi_filter?: DeviationKpiFilter;
}

export type DeviationKpiFilter =
  | 'all'
  | 'open'
  | 'closed'
  | 'draft'
  | 'under_investigation'
  | 'qa_review'
  | 'capa_required'
  | 'capa_linked'
  | 'overdue'
  | 'critical'
  | 'major'
  | 'minor'
  | 'repeat'
  | 'batch_impacted'
  | 'product_quality'
  | 'patient_safety';

export interface DeviationChartPoint {
  name: string;
  count: number;
  month?: string;
  open?: number;
  closed?: number;
  required?: number;
  notRequired?: number;
  avgDays?: number;
}

export interface DeviationDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  draft: number;
  underInvestigation: number;
  qaReviewPending: number;
  capaRequired: number;
  capaLinked: number;
  overdue: number;
  critical: number;
  major: number;
  minor: number;
  repeat: number;
  batchImpacted: number;
  productQualityImpact: number;
  patientSafetyImpact: number;
  avgClosureDays: number;
  byDepartment: DeviationChartPoint[];
  byCategory: DeviationChartPoint[];
  byCriticality: DeviationChartPoint[];
  byProduct: DeviationChartPoint[];
  monthlyTrend: DeviationChartPoint[];
  openClosedTrend: DeviationChartPoint[];
  capaTrend: DeviationChartPoint[];
  batchImpactTrend: DeviationChartPoint[];
  repeatTrend: DeviationChartPoint[];
  closureTimeTrend: DeviationChartPoint[];
  byRootCause?: DeviationChartPoint[];
  capaLinkedTrend?: DeviationChartPoint[];
}

export const TREND_STATUSES = [
  'Improving', 'Stable', 'Increasing', 'Critical', 'Insufficient Data',
] as const;

export interface DeviationTrendRecord {
  id: string;
  trend_id: string;
  review_period_from: string;
  review_period_to: string;
  department: string;
  product: string;
  deviation_category: string;
  criticality: string;
  root_cause_category: string;
  total_deviations: number;
  open_deviations: number;
  closed_deviations: number;
  repeat_deviations: number;
  capa_linked_deviations: number;
  average_closure_days: number;
  trend_status: string;
  risk_level: string;
  conclusion: string;
  recommendation: string;
  generated_by: string;
  generated_by_name: string;
  generated_date: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_date?: string;
  alerts?: string[];
  chart_snapshot?: Record<string, unknown>;
  filters?: Record<string, string>;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export const DEVIATION_REPORT_TYPES = [
  'Deviation Register',
  'Open Deviation Report',
  'Closed Deviation Report',
  'Overdue Deviation Report',
  'Critical Deviation Report',
  'Repeat Deviation Report',
  'Department-wise Deviation Report',
  'Product-wise Deviation Report',
  'CAPA Linked Deviation Report',
  'Deviation Trend Report',
  'Deviation Investigation Report',
] as const;

export const DEVIATION_REPORT_STATUSES = ['Draft', 'Generated', 'Exported', 'Archived', 'Failed'] as const;
export const DEVIATION_EXPORT_TYPES = ['PDF', 'Excel', 'CSV', 'Print'] as const;

export type DeviationReportType = typeof DEVIATION_REPORT_TYPES[number];
export type DeviationReportStatus = typeof DEVIATION_REPORT_STATUSES[number];
export type DeviationExportType = typeof DEVIATION_EXPORT_TYPES[number];

export interface DeviationReportRecord {
  id: string;
  report_id: string;
  report_number: string;
  report_type: DeviationReportType | string;
  review_period_from: string;
  review_period_to: string;
  department: string;
  product: string;
  criticality: string;
  status_filter: string;
  generated_by: string;
  generated_by_name: string;
  generated_date: string;
  total_records: number;
  export_type: string;
  file_url: string;
  file_name?: string;
  report_status: DeviationReportStatus | string;
  filters_applied?: Record<string, string>;
  preview_rows?: Record<string, unknown>[];
  chart_snapshot?: Record<string, unknown>;
  metrics_snapshot?: Record<string, unknown>;
  summary?: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export interface DeviationActivityEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
  deviationId?: string;
}

export interface DeviationActor {
  id: string;
  name: string;
  role: string;
}

export function criticalityToLegacy(c: DeviationCriticality): 'minor' | 'major' | 'critical' {
  return c.toLowerCase() as 'minor' | 'major' | 'critical';
}

export function isOpenStatus(status: string): boolean {
  return OPEN_DEVIATION_STATUSES.includes(status as typeof OPEN_DEVIATION_STATUSES[number]);
}

export function computeCapaRequired(record: Partial<DeviationRecord>): boolean {
  if (record.product_quality_impacted || record.product_quality_impact === 'Yes') return true;
  if (record.patient_safety_impacted || record.patient_safety_impact === 'Yes') return true;
  if (record.repeat_deviation) return true;
  if (record.criticality === 'Critical') return true;
  return Boolean(record.capa_required);
}

export function requiresHeadQaApproval(criticality: string): boolean {
  return criticality === 'Critical';
}
