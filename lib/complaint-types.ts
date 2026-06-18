import { normalizeRole } from '@/lib/permissions';

export const COMPLAINT_COLLECTIONS = {
  records: 'complaints',
  investigations: 'complaint_investigations',
  impactAssessments: 'complaint_impact_assessment',
  capaLinks: 'complaint_capa_links',
  approvals: 'complaint_approvals',
  approvalHistory: 'complaint_approval_history',
  closures: 'complaint_closure',
  trends: 'complaint_trends',
  reports: 'complaint_reports',
  attachments: 'complaint_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  products: 'products',
  customers: 'customers',
  users: 'users',
  recalls: 'recalls',
} as const;

export const COMPLAINT_SOURCES = [
  'Customer', 'Distributor', 'Hospital', 'Pharmacy', 'Regulatory Authority',
  'Internal', 'Medical Representative', 'Other',
] as const;

export const COMPLAINT_CUSTOMER_TYPES = [
  'Retail', 'Wholesale', 'Distributor', 'Hospital', 'Government', 'Export Customer',
] as const;

export const COMPLAINT_CATEGORIES = [
  'Quality Defect', 'Packaging Defect', 'Labeling Issue', 'Leakage', 'Particles',
  'Broken Product', 'Short Fill', 'Wrong Product', 'Mix-up', 'Adverse Event',
  'Efficacy Issue', 'Stability Issue', 'Other',
] as const;

export const COMPLAINT_SUBCATEGORIES = [
  'Visual Defect', 'Functional Defect', 'Contamination', 'Documentation', 'Shipping Damage', 'Other',
] as const;

export const COMPLAINT_CRITICALITIES = ['Minor', 'Major', 'Critical'] as const;

export const COMPLAINT_STATUSES = [
  'draft', 'received', 'under_investigation', 'qa_review', 'capa_required',
  'recall_evaluation', 'closed', 'rejected', 'overdue',
] as const;

/** @deprecated use COMPLAINT_SOURCES */
export const RECEIVED_FROM_OPTIONS = COMPLAINT_SOURCES;

export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number];
export type ComplaintCriticality = typeof COMPLAINT_CRITICALITIES[number];
export type ComplaintStatus = typeof COMPLAINT_STATUSES[number];

export interface ComplaintActor {
  id: string;
  name: string;
  role: string;
}

export interface ComplaintRecord {
  id: string;
  complaint_number: string;
  complaint_date: string;
  received_from: string;
  customer_name: string;
  customer_type?: string;
  customer_contact: string;
  contact_person?: string;
  country?: string;
  market_region: string;
  product_name: string;
  product_code?: string;
  batch_number: string;
  mfg_date: string;
  exp_date: string;
  complaint_category: ComplaintCategory | string;
  complaint_subcategory?: string;
  complaint_description: string;
  issue_reported?: string;
  quantity_involved?: string | number;
  sample_received: boolean;
  photographs_available?: boolean;
  retain_sample_required: boolean;
  complaint_criticality: ComplaintCriticality | string;
  initial_assessment: string;
  investigation_required: boolean;
  product_safety_impact: boolean;
  product_quality_impact?: boolean | string;
  regulatory_impact?: boolean | string;
  root_cause: string;
  impact_assessment: string;
  capa_required: boolean;
  capa_recommendation_required?: boolean;
  head_qa_approval_required?: boolean;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  linked_recall_id: string | null;
  linked_recall_number: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  recall_evaluation_required?: boolean | string;
  recall_required?: boolean | string;
  is_repeat_complaint?: boolean;
  market_impact?: boolean | string;
  risk_level?: string;
  cpv_product_id?: string | null;
  closure_date: string | null;
  status: ComplaintStatus | string;
  qa_remarks: string;
  batch_id: string | null;
  pqr_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ComplaintInvestigation {
  id: string;
  complaint_id: string;
  complaint_number?: string;
  investigation_start_date?: string;
  investigation_due_date?: string;
  assigned_investigator?: string;
  assigned_investigator_name?: string;
  department?: string;
  product_name?: string;
  batch_number?: string;
  customer_complaint_summary?: string;
  retain_sample_available?: boolean | string;
  complaint_sample_received?: boolean | string;
  sample_condition?: string;
  batch_record_review?: string;
  qc_result_review?: string;
  stability_data_review?: string;
  manufacturing_process_review?: string;
  packaging_review?: string;
  distribution_review?: string;
  previous_complaint_review?: string;
  root_cause_method?: string;
  investigation_summary: string;
  findings: string;
  root_cause: string;
  impact_assessment: string;
  sample_analysis: string;
  batch_review: string;
  conclusion: string;
  capa_required: boolean;
  recall_evaluation_required?: boolean;
  qa_review_comments?: string;
  qa_justification?: string;
  investigation_status?: string;
  investigated_by: string;
  investigated_by_name: string;
  investigated_at: string;
  reviewed_by_qa?: string;
  reviewed_by_qa_name?: string;
  qa_review_date?: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export const COMPLAINT_INVESTIGATION_STATUSES = [
  'Not Started', 'In Progress', 'QA Review', 'CAPA Required', 'Recall Evaluation', 'Completed', 'Rejected',
] as const;

export const COMPLAINT_IMPACT_OPTIONS = [
  'Yes', 'No', 'Under Evaluation', 'Not Applicable',
] as const;

export const COMPLAINT_IMPACT_STATUSES = [
  'Draft', 'In Progress', 'Submitted', 'QA Review', 'Approved', 'Rejected',
] as const;

export type ComplaintImpactOption = typeof COMPLAINT_IMPACT_OPTIONS[number];
export type ComplaintImpactStatus = typeof COMPLAINT_IMPACT_STATUSES[number];

export interface ComplaintImpactAssessment {
  id: string;
  impact_assessment_id: string;
  complaint_id: string;
  complaint_number: string;
  assessment_date: string;
  assessed_by: string;
  assessed_by_name: string;
  product_name: string;
  batch_number: string;
  complaint_category: string;
  product_quality_impact: string;
  patient_safety_impact: string;
  regulatory_impact: string;
  market_impact: string;
  batch_impact: string;
  other_batches_impacted: string;
  impacted_batch_numbers: string;
  distribution_impact: string;
  distribution_notes?: string;
  recall_evaluation_required: boolean;
  recall_evaluation_reason?: string;
  capa_required: boolean;
  severity: number;
  occurrence: number;
  detection: number;
  risk_score: number;
  risk_level: string;
  impact_description: string;
  scientific_justification: string;
  conclusion: string;
  qa_comments?: string;
  qa_decision?: string;
  qa_reviewer_id?: string;
  qa_reviewer_name?: string;
  qa_reviewed_at?: string;
  status: ComplaintImpactStatus | string;
  assessed_at?: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export const COMPLAINT_CAPA_LINK_STATUSES = [
  'Draft', 'Open', 'Under Implementation', 'Pending Verification',
  'Effectiveness Check Pending', 'Closed', 'Overdue',
] as const;

export type ComplaintCapaLinkStatus = typeof COMPLAINT_CAPA_LINK_STATUSES[number];

export interface ComplaintCapaLink {
  id: string;
  complaint_capa_link_id: string;
  complaint_id: string;
  complaint_number: string;
  capa_required: boolean;
  capa_number: string;
  capa_id: string | null;
  capa_title: string;
  capa_source: string;
  root_cause: string;
  corrective_action: string;
  preventive_action: string;
  action_owner: string;
  action_owner_name: string;
  department: string;
  target_completion_date: string | null;
  capa_status: string;
  implementation_date: string | null;
  effectiveness_check_required: boolean;
  effectiveness_check_date: string | null;
  effectiveness_result: string;
  capa_closure_date: string | null;
  remarks: string;
  linked_by: string;
  linked_by_name: string;
  linked_date: string;
  is_active: boolean;
  unlink_reason?: string;
  unlinked_at?: string | null;
  unlinked_by?: string | null;
  unlinked_by_name?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export const COMPLAINT_WORKFLOW_STEPS = [
  'Draft', 'Received', 'Investigation Review', 'Impact Assessment Review',
  'CAPA Review', 'Recall Evaluation Review', 'QA Review', 'Head QA Approval', 'Closed',
] as const;

export const COMPLAINT_APPROVAL_STATUSES = [
  'Pending', 'Approved', 'Rejected', 'Sent Back', 'Escalated', 'Completed', 'Waiting',
] as const;

export interface ComplaintApproval {
  id: string;
  complaint_id: string;
  complaint_number?: string;
  approval_id?: string;
  current_workflow_step?: string;
  current_approver?: string;
  current_approver_name?: string;
  current_role?: string;
  approval_level: number | string;
  approval_status?: string;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected' | 'pending' | 'sent_back' | 'escalated' | 'waiting';
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

export const COMPLAINT_CLOSURE_STATUSES = [
  'Pending', 'Ready For Closure', 'QA Review', 'Closed', 'Rejected', 'Reopened',
] as const;

export type ComplaintClosureStatus = typeof COMPLAINT_CLOSURE_STATUSES[number];

export interface ComplaintClosure {
  id: string;
  closure_id: string;
  complaint_id: string;
  complaint_number: string;
  closure_date: string | null;
  closed_by: string;
  closed_by_name: string;
  investigation_completed: boolean;
  impact_assessment_completed: boolean;
  capa_required: boolean;
  capa_linked: boolean;
  capa_completed: boolean;
  recall_evaluation_required: boolean;
  recall_evaluation_completed: boolean;
  product_quality_impact_resolved: boolean;
  patient_safety_impact_resolved: boolean;
  regulatory_impact_resolved: boolean;
  customer_response_required: boolean;
  customer_response_sent: boolean;
  final_complaint_conclusion: string;
  qa_closure_comments: string;
  closure_status: ComplaintClosureStatus | string;
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

export interface ComplaintApprovalHistoryEntry {
  id?: string;
  complaint_id: string;
  complaint_number: string;
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
  created_by?: string;
}

export const COMPLAINT_RCA_METHODS = [
  '5 Why', 'Fishbone', 'Manual RCA', 'No Assignable Cause',
] as const;

export interface ComplaintAttachment {
  id: string;
  complaint_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ComplaintFilters {
  status?: string;
  complaint_category?: string;
  complaint_criticality?: string;
  product?: string;
  batch_number?: string;
  market_region?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  kpi_filter?: string;
}

export interface ComplaintDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  critical: number;
  major: number;
  minor: number;
  underInvestigation: number;
  capaRequired: number;
  capaLinked: number;
  recallEvaluationRequired: number;
  overdue: number;
  productQualityImpact: number;
  marketImpact: number;
  repeatComplaints: number;
  avgClosureDays: number;
}

export interface ComplaintDashboardChartData {
  monthlyTrend: { name: string; month?: string; count?: number }[];
  byProduct: { name: string; count?: number; value?: number }[];
  byMarket: { name: string; count?: number; value?: number }[];
  byCategory: { name: string; count?: number; value?: number }[];
  byCriticality: { name: string; count?: number; value?: number }[];
  byRootCause: { name: string; count?: number; value?: number }[];
  byCustomer: { name: string; count?: number; value?: number }[];
  byBatch: { name: string; count?: number; value?: number }[];
  openClosedTrend: { name: string; open?: number; closed?: number }[];
  capaLinkedTrend: { name: string; count?: number }[];
  recallEvaluationTrend: { name: string; count?: number }[];
  repeatComplaintTrend: { name: string; count?: number }[];
  closureTimeTrend: { name: string; avgDays?: number }[];
}

export interface ComplaintActivityEntry {
  date: string;
  title: string;
  description: string;
  user: string;
  complaint_number?: string;
}

export const COMPLAINT_TREND_STATUSES = [
  'Improving', 'Stable', 'Increasing', 'Critical', 'Insufficient Data',
] as const;

export type ComplaintTrendStatus = typeof COMPLAINT_TREND_STATUSES[number];

export const COMPLAINT_REPORT_TYPES = [
  'Complaint Register',
  'Open Complaint Report',
  'Closed Complaint Report',
  'Overdue Complaint Report',
  'Critical Complaint Report',
  'Product-wise Complaint Report',
  'Market-wise Complaint Report',
  'Category-wise Complaint Report',
  'CAPA Linked Complaint Report',
  'Recall Evaluation Complaint Report',
  'Complaint Trend Report',
  'Complaint Closure Report',
] as const;

export type ComplaintReportType = typeof COMPLAINT_REPORT_TYPES[number];

export interface ComplaintReportRecord {
  id: string;
  report_id: string;
  report_number: string;
  report_type: ComplaintReportType | string;
  review_period_from: string;
  review_period_to: string;
  complaint_number_filter: string;
  product: string;
  batch_number: string;
  market_region: string;
  customer_name: string;
  complaint_category: string;
  criticality: string;
  status_filter: string;
  capa_required_filter: string;
  recall_required_filter: string;
  generated_by: string;
  generated_by_name: string;
  generated_date: string;
  total_records: number;
  export_type: string;
  file_url: string;
  file_name?: string;
  report_status: string;
  filters_applied?: Record<string, string>;
  preview_rows?: Record<string, unknown>[];
  chart_snapshot?: Record<string, unknown>;
  metrics_snapshot?: Record<string, unknown>;
  summary: string;
  management_summary?: string;
  investigation_summary?: string;
  capa_summary?: string;
  recall_summary?: string;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export interface ComplaintTrendRecord {
  id: string;
  trend_id: string;
  review_period_from: string;
  review_period_to: string;
  product: string;
  market_region: string;
  complaint_category: string;
  criticality: string;
  root_cause_category: string;
  total_complaints: number;
  open_complaints: number;
  closed_complaints: number;
  repeat_complaints: number;
  capa_linked_complaints: number;
  recall_evaluation_complaints: number;
  average_closure_days: number;
  trend_status: ComplaintTrendStatus | string;
  risk_level: string;
  conclusion: string;
  recommendation: string;
  pqr_summary?: string;
  management_summary?: string;
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

export function isComplaintClosed(status: string): boolean {
  return ['closed', 'rejected'].includes(status);
}

export function isSafetyCategory(category: string): boolean {
  return ['Adverse Event', 'Wrong Product', 'Efficacy Issue'].includes(category);
}

export function isComplaintReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canCreateComplaint(role: string): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canApproveComplaint(role: string): boolean {
  return ['super_admin', 'admin', 'qa', 'qa_manager', 'head_qa'].includes(role);
}

export function canViewComplaintDashboard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'qc', 'qc_manager',
    'production', 'production_manager', 'warehouse', 'regulatory_affairs', 'auditor', 'viewer'].includes(r);
}

export function canExportComplaintDashboard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isComplaintDashboardReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}
