export const CSV_COLLECTIONS = {
  systems: 'csv_system_inventory',
  gxpAssessment: 'csv_gxp_assessment',
  riskAssessment: 'csv_risk_assessment',
  urs: 'csv_urs',
  frs: 'csv_frs',
  designSpec: 'csv_design_specification',
  testScripts: 'csv_test_scripts',
  traceability: 'csv_traceability_matrix',
  part11: 'csv_part11_assessment',
  validationReports: 'csv_validation_reports',
  periodicReviews: 'csv_periodic_reviews',
  attachments: 'csv_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
} as const;

export const SYSTEM_TYPES = [
  'QMS', 'LIMS', 'ERP', 'MES', 'SCADA', 'BMS', 'DMS', 'TMS',
  'Excel Sheet', 'Custom Software', 'Instrument Software', 'Utility Software', 'Other',
] as const;

export const HOSTING_TYPES = ['On-Premise', 'Cloud', 'Hybrid', 'Standalone'] as const;

export const GXP_CLASSIFICATIONS = ['GxP Critical', 'GxP Non-Critical', 'Non-GxP'] as const;

export const CSV_STATUSES = [
  'Draft', 'Under Review', 'Approved', 'In Execution', 'Deviation Observed',
  'Completed', 'Validated', 'Rejected', 'Retired',
] as const;

export const REQUIREMENT_TYPES = [
  'Functional', 'Security', 'Audit Trail', 'E-Signature', 'Backup', 'Reporting',
  'Data Integrity', 'Access Control', 'Interface', 'Performance',
] as const;

export const TEST_PHASES = ['IQ', 'OQ', 'PQ'] as const;

export const PASS_FAIL = ['Pass', 'Fail', 'N/A'] as const;

export const CSV_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory',
  'Microbiology', 'Packaging', 'Maintenance', 'IT / CSV', 'Validation', 'PQR', 'CPV',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export interface CsvActor {
  id: string;
  name: string;
  role: string;
}

export interface CsvSystem {
  id: string;
  system_id: string;
  system_name: string;
  system_owner: string;
  department: string;
  vendor: string;
  system_type: string;
  business_process: string;
  gxp_impact: boolean;
  data_criticality: string;
  regulatory_impact: boolean;
  hosting_type: string;
  authentication_type: string;
  backup_required: boolean;
  audit_trail_required: boolean;
  e_signature_required: boolean;
  validation_status: string;
  go_live_date: string | null;
  retirement_date: string | null;
  remarks: string;
  validation_package_required: boolean;
  part11_required: boolean;
  next_review_due: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface GxpAssessment {
  id: string;
  system_id: string;
  system_name: string;
  used_for_gmp: boolean;
  stores_gmp_data: boolean;
  generates_batch_data: boolean;
  controls_equipment: boolean;
  manages_e_records: boolean;
  uses_e_signatures: boolean;
  gxp_classification: string;
  assessment_conclusion: string;
  assessed_by: string;
  assessed_by_name: string;
  assessment_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CsvRiskAssessment {
  id: string;
  system_id: string;
  system_name: string;
  requirement_id: string;
  risk_description: string;
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  risk_level: string;
  mitigation: string;
  residual_risk: string;
  approval_status: string;
  created_at: string;
  updated_at: string;
}

export interface UrsRecord {
  id: string;
  system_id: string;
  system_name: string;
  urs_id: string;
  requirement_no: string;
  requirement_description: string;
  requirement_type: string;
  priority: string;
  gxp_critical: boolean;
  acceptance_criteria: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FrsRecord {
  id: string;
  system_id: string;
  system_name: string;
  frs_id: string;
  linked_urs_no: string;
  functional_specification: string;
  system_response: string;
  acceptance_criteria: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DesignSpecRecord {
  id: string;
  system_id: string;
  system_name: string;
  ds_id: string;
  linked_frs_no: string;
  design_description: string;
  technical_design: string;
  database_collection: string;
  api_function: string;
  ui_component: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TestScript {
  id: string;
  system_id: string;
  system_name: string;
  test_phase: string;
  test_script_no: string;
  linked_requirement: string;
  test_objective: string;
  precondition: string;
  test_steps: string;
  expected_result: string;
  actual_result: string;
  pass_fail: string;
  deviation_number: string | null;
  executed_by: string;
  executed_by_name: string;
  execution_date: string;
  evidence_url: string;
  remarks: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TraceabilityRow {
  id: string;
  system_id: string;
  system_name: string;
  urs_no: string;
  frs_no: string;
  ds_no: string;
  iq_test_no: string;
  oq_test_no: string;
  pq_test_no: string;
  status: string;
  gap_identified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Part11Assessment {
  id: string;
  system_id: string;
  system_name: string;
  audit_trail_available: boolean;
  audit_trail_secure: boolean;
  audit_trail_reviewable: boolean;
  e_signature_available: boolean;
  password_policy_available: boolean;
  user_access_control: boolean;
  data_backup: boolean;
  record_retention: boolean;
  time_stamped_records: boolean;
  system_security: boolean;
  assessment_result: string;
  gap_action: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CsvValidationReport {
  id: string;
  system_id: string;
  system_name: string;
  validation_summary: string;
  deviations_observed: number;
  open_issues: number;
  test_summary: string;
  requirement_coverage_percent: number;
  final_conclusion: string;
  recommended_status: string;
  approved_by: string;
  approved_by_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PeriodicReview {
  id: string;
  system_id: string;
  system_name: string;
  review_period: string;
  incidents: number;
  changes: number;
  deviations: number;
  access_review_completed: boolean;
  backup_review_completed: boolean;
  audit_trail_review_completed: boolean;
  system_performance_review: string;
  validation_status: string;
  recommendation: string;
  next_review_due: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CsvAttachment {
  id: string;
  system_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  storage_path: string;
  download_url: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface CsvFilters {
  system_type?: string;
  validation_status?: string;
  department?: string;
  gxp_impact?: boolean;
  search?: string;
}

export interface CsvDashboardMetrics {
  total: number;
  gxpCritical: number;
  validated: number;
  validationPending: number;
  periodicReviewDue: number;
  openDeviations: number;
  part11Gaps: number;
  retired: number;
}

export function calcRpn(severity: number, occurrence: number, detectability: number): { rpn: number; risk_level: string } {
  const rpn = severity * occurrence * detectability;
  let risk_level = 'Low';
  if (rpn >= 100) risk_level = 'Critical';
  else if (rpn >= 40) risk_level = 'High';
  else if (rpn >= 15) risk_level = 'Medium';
  return { rpn, risk_level };
}

export function calcTraceabilityCoverage(rows: TraceabilityRow[]): number {
  if (rows.length === 0) return 0;
  const complete = rows.filter((r) => r.urs_no && r.frs_no && r.ds_no && !r.gap_identified).length;
  return Math.round((complete / rows.length) * 100);
}

export function isCsvReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageCsv(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'it', 'csv', 'it_csv'].includes(role);
}

export function canApproveCsv(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}
