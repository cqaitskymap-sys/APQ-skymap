export const CC_COLLECTIONS = {
  records: 'change_controls',
  impact: 'change_impact_assessments',
  risk: 'change_risk_assessments',
  implementation: 'change_implementation_actions',
  implementationPlans: 'change_implementation_plans',
  implementationTasks: 'change_implementation_tasks',
  effectiveness: 'change_effectiveness_reviews',
  approvals: 'change_approvals',
  approvalHistory: 'change_approval_history',
  attachments: 'change_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  capa: 'capa_records',
  reports: 'change_reports',
  closure: 'change_closure',
  validation: 'validation_assessments',
  csvAssessment: 'csv_assessments',
} as const;

export const CHANGE_TYPES = [
  'Process Change', 'Equipment Change', 'Utility Change', 'Facility Change',
  'Document Change', 'Software / CSV Change', 'Raw Material Change',
  'Packing Material Change', 'Vendor Change', 'Specification Change',
  'Method Change', 'Cleaning Change', 'Validation Change', 'Other',
] as const;

export const CHANGE_CATEGORIES = ['Minor', 'Major', 'Critical'] as const;
export const CHANGE_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const TEMPORARY_OPTIONS = ['Temporary', 'Permanent'] as const;

export const CC_STATUSES = [
  'draft', 'submitted', 'under_qa_review', 'impact_assessment', 'risk_assessment',
  'approved_for_implementation', 'implementation_in_progress', 'implemented',
  'effectiveness_pending', 'effectiveness_completed', 'final_qa_review',
  'approved', 'rejected', 'closed', 'cancelled', 'overdue',
] as const;

export const CC_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory',
  'Microbiology', 'Packaging', 'Maintenance', 'IT / CSV',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const EFFECTIVENESS_RESULTS = ['Effective', 'Not Effective', 'Partially Effective'] as const;
export const IMPL_STATUSES = ['pending', 'in_progress', 'completed'] as const;

export type ChangeType = typeof CHANGE_TYPES[number];
export type ChangeCategory = typeof CHANGE_CATEGORIES[number];
export type ChangePriority = typeof CHANGE_PRIORITIES[number];
export type CcStatus = typeof CC_STATUSES[number];

export interface CcActor {
  id: string;
  name: string;
  role: string;
}

export interface ChangeControlRecord {
  id: string;
  change_control_number: string;
  change_date: string;
  department: string;
  initiated_by: string;
  initiated_by_name: string;
  product_name: string;
  batch_number: string;
  change_title: string;
  change_description: string;
  current_system: string;
  proposed_change: string;
  reason_for_change: string;
  change_type: ChangeType | string;
  change_category: ChangeCategory | string;
  change_priority: ChangePriority | string;
  temporary_permanent: string;
  planned_implementation_date: string | null;
  target_closure_date?: string | null;
  actual_implementation_date: string | null;
  affected_documents: string;
  affected_equipment: string;
  affected_material: string;
  affected_vendor: string;
  affected_process: string;
  affected_product: string;
  regulatory_impact: boolean;
  validation_impact: boolean;
  csv_impact: boolean;
  training_impact: boolean;
  stability_impact: boolean;
  quality_impact: boolean;
  patient_safety_impact: boolean;
  market_impact: boolean;
  risk_assessment_required: boolean;
  capa_required: boolean;
  effectiveness_check_required: boolean;
  assigned_owner?: string;
  assigned_owner_name?: string;
  qa_reviewer?: string;
  qa_reviewer_name?: string;
  remarks?: string;
  qa_remarks: string;
  status: CcStatus | string;
  overall_risk_level?: string;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  pqr_id: string | null;
  batch_id: string | null;
  cpv_id?: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeImpactAssessment {
  id: string;
  change_id: string;
  impact_assessment_id?: string;
  change_control_number?: string;
  assessment_date?: string;
  assessed_by: string;
  assessed_by_name: string;
  department?: string;
  product_impact?: string;
  process_impact: string;
  equipment_impact: string;
  utility_impact: string;
  facility_impact?: string;
  document_impact?: string;
  training_impact: string;
  validation_impact: string;
  csv_impact?: string;
  regulatory_impact: string;
  quality_impact: string;
  patient_safety_impact?: string;
  stability_impact: string;
  market_impact?: string;
  business_impact?: string;
  supplier_impact?: string;
  environmental_impact?: string;
  data_integrity_impact?: string;
  safety_impact: string;
  efficacy_impact: string;
  cleaning_impact: string;
  documentation_impact: string;
  computerized_system_impact: string;
  impact_description?: string;
  scientific_justification?: string;
  recommended_actions?: string;
  recommendations?: string[];
  validation_required?: boolean;
  training_required?: boolean;
  document_revision_required?: boolean;
  regulatory_submission_required?: boolean;
  capa_required?: boolean;
  overall_impact_rating?: string;
  impact_severity?: string;
  impact_likelihood?: string;
  qa_comments?: string;
  head_qa_comments?: string;
  status?: string;
  remarks: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted?: boolean;
}

export const CC_IMPACT_OPTIONS = ['Yes', 'No', 'Not Applicable', 'Under Evaluation'] as const;
export const CC_IMPACT_RATINGS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const CC_IMPACT_STATUSES = ['Draft', 'Under Review', 'QA Review', 'Approved', 'Rejected'] as const;
export const CC_IMPACT_SEVERITIES = ['Negligible', 'Minor', 'Major', 'Critical'] as const;
export const CC_IMPACT_LIKELIHOODS = ['Rare', 'Possible', 'Likely', 'Almost Certain'] as const;

export interface CcImpactDashboardMetrics {
  totalAssessments: number;
  pendingReview: number;
  approvedAssessments: number;
  criticalImpactChanges: number;
  validationImpactChanges: number;
  csvImpactChanges: number;
  trainingImpactChanges: number;
  regulatoryImpactChanges: number;
}

export interface CcImpactMatrixCell {
  severity: string;
  likelihood: string;
  count: number;
  rating: string;
}

export interface ChangeRiskAssessment {
  id: string;
  change_id: string;
  record_type?: 'header' | 'risk_row';
  risk_assessment_id?: string;
  change_control_number?: string;
  assessment_date?: string;
  assessed_by: string;
  assessed_by_name: string;
  department?: string;
  risk_description?: string;
  risk_category?: string;
  potential_failure_mode?: string;
  potential_impact?: string;
  potential_cause?: string;
  existing_controls?: string;
  severity: number;
  occurrence: number;
  detectability: number;
  detection?: number;
  rpn: number;
  risk_level: string;
  mitigation_required?: boolean;
  mitigation_plan: string;
  residual_severity?: number | null;
  residual_occurrence?: number | null;
  residual_detection?: number | null;
  residual_rpn?: number | null;
  residual_risk_level?: string | null;
  capa_required?: boolean;
  validation_required?: boolean;
  linked_capa_id?: string | null;
  linked_capa_number?: string | null;
  mitigation_status?: string;
  qa_comments?: string;
  status?: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted?: boolean;
}

export const CC_RISK_CATEGORIES = [
  'Product Quality', 'Patient Safety', 'Regulatory Compliance', 'Process', 'Equipment',
  'Utility', 'Facility', 'Document', 'Training', 'Validation', 'CSV / Data Integrity',
  'Material', 'Vendor', 'Stability', 'Market', 'Business', 'Other',
] as const;

export const CC_RISK_STATUSES = [
  'Draft', 'Under Review', 'QA Review', 'Approved', 'Rejected',
] as const;

export interface CcRiskDashboardMetrics {
  totalRisks: number;
  lowRisks: number;
  mediumRisks: number;
  highRisks: number;
  criticalRisks: number;
  mitigationRequired: number;
  residualHighRisks: number;
  capaLinkedRisks: number;
}

export interface CcRiskChartData {
  riskLevelDistribution: { name: string; count: number }[];
  residualRiskDistribution: { name: string; count: number }[];
  categoryTrend: { name: string; count: number }[];
  highRiskChanges: { name: string; count: number }[];
  mitigationStatus: { name: string; count: number }[];
}

export interface CcRiskMatrixCell {
  severity: number;
  occurrence: number;
  count: number;
  maxRpn: number;
  level: string;
}

export interface ChangeImplementationAction {
  id: string;
  change_id: string;
  action_item: string;
  responsible_person: string;
  responsible_person_name: string;
  target_date: string | null;
  completion_date: string | null;
  status: string;
  evidence: string;
  remarks: string;
  action_type: 'general' | 'validation' | 'training' | 'csv';
  created_at: string;
  updated_at: string;
}

export interface ChangeEffectivenessReview {
  id: string;
  effectiveness_review_id?: string;
  change_id: string;
  change_control_number?: string;
  effectiveness_criteria: string;
  review_date: string;
  review_owner?: string;
  review_owner_name?: string;
  reviewed_by: string;
  reviewed_by_name: string;
  department?: string;
  review_period_start?: string;
  review_period_end?: string;
  change_objective_achieved?: boolean;
  implementation_successful?: boolean;
  validation_successful?: boolean;
  csv_requirements_met?: boolean;
  training_completed?: boolean;
  no_adverse_quality_impact?: boolean;
  no_regulatory_impact?: boolean;
  no_data_integrity_impact?: boolean;
  no_patient_safety_impact?: boolean;
  performance_improved?: boolean;
  process_improved?: boolean;
  risk_reduced?: boolean;
  deviation_generated?: boolean;
  oos_generated?: boolean;
  complaint_generated?: boolean;
  capa_generated?: boolean;
  effectiveness_score?: number;
  result: string;
  effectiveness_result?: string;
  conclusion: string;
  review_findings?: string;
  recommendations?: string;
  additional_actions_required?: boolean;
  capa_recommended?: boolean;
  capa_recommendation_notes?: string;
  qa_comments?: string;
  head_qa_comments?: string;
  status?: string;
  further_action_required: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  is_deleted?: boolean;
}

export const CC_EFFECTIVENESS_RESULTS = [
  'Effective',
  'Partially Effective',
  'Not Effective',
  'Pending Review',
] as const;

export const CC_EFFECTIVENESS_STATUSES = [
  'Draft',
  'Under Review',
  'QA Review',
  'Head QA Review',
  'Approved',
  'Rejected',
  'Closed',
] as const;

export interface CcEffectivenessDashboardMetrics {
  total: number;
  pendingReviews: number;
  effective: number;
  partiallyEffective: number;
  notEffective: number;
  capaRecommended: number;
  criticalUnderReview: number;
  averageScore: number;
}

export interface CcEffectivenessChartData {
  resultDistribution: { name: string; count: number }[];
  monthlyTrend: { name: string; count: number }[];
  byDepartment: { name: string; count: number; avgScore?: number }[];
  byChangeType: { name: string; count: number; avgScore?: number }[];
}

export interface ChangeApproval {
  id: string;
  approval_id?: string;
  change_id: string;
  change_control_number?: string;
  current_workflow_step?: string;
  current_approver?: string;
  current_approver_name?: string;
  current_role?: string;
  current_approver_role?: string;
  approval_level: number | 'department' | 'qa_review' | 'regulatory' | 'head_qa' | 'final';
  approval_status?: string;
  approval_comments?: string;
  rejection_reason?: string;
  send_back_reason?: string;
  due_date?: string;
  escalation_status?: string;
  e_signature_required?: boolean;
  e_signature_status?: string;
  signed_by?: string;
  signed_date?: string;
  completed_date?: string | null;
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision?: 'approved' | 'rejected' | 'pending' | 'sent_back';
  comments: string;
  e_signature: string;
  signed_at: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  updated_by_name?: string;
  is_deleted?: boolean;
}

export interface CcApprovalHistoryEntry {
  id: string;
  change_id: string;
  change_control_number?: string;
  approval_id?: string;
  action: string;
  workflow_step?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  comments?: string;
  rejection_reason?: string;
  send_back_reason?: string;
  e_signature_status?: string;
  created_at: string;
  created_by?: string;
  is_deleted?: boolean;
}

export interface CcApprovalDashboardCounts {
  pendingApprovals: number;
  approvedChanges: number;
  rejectedChanges: number;
  criticalPending: number;
  csvReviewsPending: number;
  validationReviewsPending: number;
  regulatoryReviewsPending: number;
  headQaPending: number;
  myPendingApprovals: number;
  overdueApprovals: number;
}

export interface ChangeAttachment {
  id: string;
  change_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface CcFilters {
  status?: string;
  change_type?: string;
  change_category?: string;
  department?: string;
  search?: string;
}

export interface CcDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  critical: number;
  validationImpact: number;
  csvImpact: number;
  trainingPending: number;
  regulatoryImpact: number;
}

export function isCcClosed(status: string): boolean {
  return ['closed', 'cancelled'].includes(status);
}

export function calculateRpn(severity: number, occurrence: number, detectability: number): number {
  return severity * occurrence * detectability;
}

export function rpnToLevel(rpn: number): string {
  if (rpn >= 201) return 'Critical';
  if (rpn >= 101) return 'High';
  if (rpn >= 51) return 'Medium';
  return 'Low';
}

export function requiresHeadQaApproval(category: string): boolean {
  return category === 'Critical';
}

export function requiresRegulatoryReview(record: Pick<ChangeControlRecord, 'regulatory_impact'>): boolean {
  return record.regulatory_impact;
}

export function isCcReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canCreateChange(role: string): boolean {
  const r = (role || '').toLowerCase();
  if (['auditor', 'viewer'].includes(r)) return false;
  return true;
}

export function canCreateCcChange(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  const r = role || '';
  if (['auditor', 'viewer'].includes(raw)) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)
    || raw.includes('production') || raw.includes('engineering') || raw.includes('qc')
    || raw.includes('warehouse') || raw.includes('regulatory') || raw.includes('csv');
}

export function canApproveChange(role: string): boolean {
  const r = role;
  return ['super_admin', 'head_qa', 'qa_manager', 'admin', 'qa', 'regulatory_affairs'].includes(r)
    || r === 'super_admin' || r === 'qa';
}

export const CC_REPORT_TYPES = [
  'Change Control Register',
  'Open Change Report',
  'Closed Change Report',
  'Overdue Change Report',
  'Critical Change Report',
  'Department-wise Change Report',
  'Change Type Report',
  'Validation Impact Report',
  'CSV Impact Report',
  'Training Impact Report',
  'Regulatory Impact Report',
  'Implementation Status Report',
  'Effectiveness Review Report',
  'Change Closure Report',
  'Trend Analysis Report',
  'Management Review Report',
] as const;

export type CcReportType = typeof CC_REPORT_TYPES[number];

export const CC_MANAGEMENT_REPORT_TYPES: CcReportType[] = [
  'Management Review Report',
  'Trend Analysis Report',
];

export interface CcReportPreviewRow {
  change_number: string;
  title: string;
  change_type: string;
  category: string;
  department: string;
  product: string;
  priority: string;
  owner: string;
  planned_date: string;
  closure_date: string;
  status: string;
  validation_impact: string;
  csv_impact: string;
  training_impact: string;
  regulatory_impact: string;
  risk_level: string;
}

export interface CcReportAnalyticsMetrics extends CcDashboardMetrics {
  closureRate: number;
  overdueRate: number;
  validationImpactRate: number;
  csvImpactRate: number;
  trainingImpactRate: number;
  regulatoryImpactRate: number;
  implementationSuccessRate: number;
  effectivenessPending: number;
  implementationPending: number;
  trainingImpactChanges: number;
  avgClosureDays: number;
}

export interface CcReportChartData {
  monthlyTrend: { name: string; count?: number }[];
  byDepartment: { name: string; count?: number }[];
  byType: { name: string; count?: number }[];
  byPriority: { name: string; count?: number }[];
  byStatus: { name: string; count?: number }[];
  validationImpactTrend: { name: string; count?: number }[];
  csvImpactTrend: { name: string; count?: number }[];
  trainingImpactTrend: { name: string; count?: number }[];
  regulatoryImpactTrend: { name: string; count?: number }[];
  implementationPerformanceTrend: { name: string; count?: number }[];
  effectivenessTrend: { name: string; count?: number }[];
  closurePerformanceTrend: { name: string; avgDays?: number }[];
}

export interface CcManagementReviewSummary {
  totalChangesInitiated: number;
  totalChangesClosed: number;
  overdueChangePct: number;
  validationImpactPct: number;
  csvImpactPct: number;
  trainingImpactPct: number;
  topChangeTypes: { name: string; count: number }[];
  topDepartments: { name: string; count: number }[];
  criticalChanges: number;
  improvementOpportunities: string[];
  narrative: string;
}

export interface CcReportRecord {
  id: string;
  report_id: string;
  report_name: string;
  report_number: string;
  report_type: CcReportType | string;
  review_period_from: string;
  review_period_to: string;
  change_number: string;
  department: string;
  product: string;
  change_type: string;
  category: string;
  priority: string;
  status_filter: string;
  validation_impact: boolean;
  csv_impact: boolean;
  training_impact: boolean;
  regulatory_impact: boolean;
  owner: string;
  generated_by: string;
  generated_by_name: string;
  generated_at: string;
  generated_date: string;
  total_records: number;
  export_type: string;
  file_url: string;
  file_name?: string;
  report_status: string;
  filters_applied: Record<string, unknown>;
  preview_rows: Record<string, unknown>[];
  chart_snapshot: Record<string, unknown>;
  metrics_snapshot: Record<string, unknown>;
  management_summary: CcManagementReviewSummary;
  summary: string;
  recommendations: string;
  scheduled?: boolean;
  schedule_frequency?: string;
  schedule_next_run?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export const CC_CLOSURE_STATUSES = [
  'Pending',
  'Ready For Closure',
  'QA Review',
  'Head QA Review',
  'Closed',
  'Rejected',
  'Reopened',
] as const;

export type CcClosureStatus = typeof CC_CLOSURE_STATUSES[number];

export interface ChangeClosure {
  id: string;
  closure_id: string;
  change_control_id: string;
  change_control_number: string;
  closure_date: string | null;
  closed_by: string;
  closed_by_name?: string;
  department: string;
  impact_assessment_completed: boolean;
  risk_assessment_completed: boolean;
  validation_assessment_completed: boolean;
  implementation_completed: boolean;
  training_completed: boolean;
  document_revision_completed: boolean;
  validation_completed: boolean;
  csv_completed: boolean;
  regulatory_action_completed: boolean;
  effectiveness_review_completed: boolean;
  effectiveness_result: string;
  capa_required: boolean;
  capa_linked: boolean;
  capa_completed: boolean;
  all_evidence_reviewed: boolean;
  qa_closure_comments: string;
  head_qa_comments: string;
  final_closure_conclusion: string;
  closure_status: CcClosureStatus | string;
  readiness_percent?: number;
  e_signature_required: boolean;
  e_signature?: string;
  e_signature_status?: string;
  signed_by: string;
  signed_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
  updated_by_name?: string;
  is_deleted: boolean;
}

export interface CcClosureDashboardMetrics {
  readyForClosure: number;
  pendingReview: number;
  closed: number;
  rejected: number;
  reopened: number;
  effectiveClosures: number;
  partiallyEffective: number;
  notEffective: number;
}

export interface CcClosureTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export const CC_VALIDATION_CATEGORIES = [
  'No Validation Required',
  'Partial Revalidation',
  'Full Revalidation',
  'Prospective Validation',
  'Concurrent Validation',
  'Retrospective Assessment',
  'CSV Validation',
] as const;

export const CC_VALIDATION_SYSTEM_TYPES = [
  'Process', 'Equipment', 'Utility', 'Facility', 'Software', 'Spreadsheet',
  'ERP', 'LIMS', 'QMS', 'MES', 'SCADA', 'Other',
] as const;

export const CC_VALIDATION_DELIVERABLES = [
  'URS', 'FS', 'DS', 'RA', 'TM', 'IQ', 'OQ', 'PQ',
  'CSV Validation Plan', 'Traceability Matrix', 'Validation Report', 'SOP Revision', 'Training Record',
] as const;

export const CC_VALIDATION_STATUSES = [
  'Draft',
  'Under Assessment',
  'QA Review',
  'Approved',
  'Rejected',
  'Closed',
] as const;

export const CC_GAMP_CATEGORIES = ['1', '3', '4', '5'] as const;

export interface CcValidationAssessment {
  id: string;
  validation_assessment_id?: string;
  change_id: string;
  change_control_number?: string;
  assessment_date: string;
  assessed_by: string;
  assessed_by_name?: string;
  department: string;
  validation_impact: boolean;
  qualification_impact: boolean;
  csv_impact: boolean;
  data_integrity_impact: boolean;
  regulatory_impact: boolean;
  revalidation_required: boolean;
  validation_category: string;
  system_type: string;
  affected_system: string;
  affected_equipment: string;
  affected_documents: string;
  affected_sops: string;
  affected_process: string;
  validation_scope: string;
  validation_justification: string;
  risk_based_rationale: string;
  validation_deliverables: string[];
  validation_owner: string;
  validation_owner_name?: string;
  target_completion_date: string;
  qa_comments?: string;
  head_qa_comments?: string;
  status: string;
  gamp_category?: string;
  electronic_records_impact?: boolean;
  electronic_signature_impact?: boolean;
  audit_trail_impact?: boolean;
  security_impact?: boolean;
  backup_impact?: boolean;
  disaster_recovery_impact?: boolean;
  part_11_impact?: boolean;
  annex_11_impact?: boolean;
  annex_11_review_completed?: boolean;
  csv_assessment_completed?: boolean;
  qualification_review_completed?: boolean;
  head_qa_review_pending?: boolean;
  recommendations?: string;
  progress_percent?: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  is_deleted?: boolean;
}

export interface CcValidationDashboardMetrics {
  total: number;
  validationRequired: number;
  csvAssessments: number;
  revalidationRequired: number;
  equipmentQualificationRequired: number;
  annex11Reviews: number;
  approved: number;
  pendingReviews: number;
}

export interface CcValidationChartData {
  impactDistribution: { name: string; count: number }[];
  csvImpactTrend: { name: string; count: number }[];
  qualificationTrend: { name: string; count: number }[];
  revalidationTrend: { name: string; count: number }[];
}

export const CC_IMPL_STATUSES = [
  'Draft',
  'Approved For Implementation',
  'In Progress',
  'Partially Completed',
  'Completed',
  'Pending Verification',
  'Verified',
  'Closed',
] as const;

export const CC_IMPL_TASK_STATUSES = [
  'Not Started',
  'Assigned',
  'In Progress',
  'Pending Review',
  'Completed',
  'Rejected',
  'On Hold',
  'Overdue',
] as const;

export const CC_IMPL_TASK_CATEGORIES = [
  'Validation',
  'Training',
  'Document Update',
  'Equipment Modification',
  'Software / CSV',
  'Process Change',
  'Material Change',
  'Vendor Change',
  'Qualification',
  'Testing',
  'Regulatory Submission',
  'CAPA Action',
  'Other',
] as const;

export const CC_IMPL_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export interface CcImplementationPlan {
  id: string;
  implementation_plan_id?: string;
  change_id: string;
  change_control_number?: string;
  implementation_title: string;
  implementation_description: string;
  implementation_owner: string;
  implementation_owner_name?: string;
  department: string;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  implementation_status: string;
  implementation_progress: number;
  validation_required: boolean;
  training_required: boolean;
  document_revision_required: boolean;
  capa_required: boolean;
  overall_remarks?: string;
  qa_comments?: string;
  qa_review_completed?: boolean;
  head_qa_review_pending?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  is_deleted?: boolean;
}

export interface CcImplementationTask {
  id: string;
  task_id?: string;
  task_number?: string;
  change_id: string;
  plan_id?: string;
  task_title: string;
  task_description: string;
  task_category: string;
  assigned_to: string;
  assigned_to_name?: string;
  department: string;
  priority: string;
  dependency_task_id?: string | null;
  dependency_task_number?: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  completion_percentage: number;
  evidence_attached?: boolean;
  evidence_url?: string;
  task_status: string;
  remarks?: string;
  is_mandatory?: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted?: boolean;
}

export interface CcImplementationDashboardMetrics {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  criticalTasks: number;
  validationTasks: number;
  trainingTasks: number;
  documentTasks: number;
}

export interface CcImplementationChartData {
  statusDistribution: { name: string; count: number }[];
  progressTrend: { name: string; count: number }[];
  byDepartment: { name: string; count: number }[];
  overdueTrend: { name: string; count: number }[];
}

export interface CcGanttItem {
  id: string;
  label: string;
  start: string;
  end: string;
  progress: number;
  status: string;
  category: string;
}


