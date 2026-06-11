export const VALIDATION_COLLECTIONS = {
  records: 'validation_records',
  protocols: 'validation_protocols',
  execution: 'validation_execution',
  reports: 'validation_reports',
  processValidation: 'process_validation',
  cleaningValidation: 'cleaning_validation',
  csvValidation: 'csv_validation',
  approvals: 'validation_approvals',
  attachments: 'validation_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  capa: 'capa_records',
  deviations: 'deviations',
} as const;

export const VALIDATION_TYPES = [
  'DQ', 'IQ', 'OQ', 'PQ', 'Process Validation', 'Cleaning Validation',
  'Method Validation', 'Computer System Validation', 'Utility Qualification', 'Equipment Requalification',
] as const;

export const VALIDATION_STATUSES = [
  'Draft', 'Protocol Under Review', 'Protocol Approved', 'Execution In Progress',
  'Deviation Observed', 'Report Under Review', 'Approved', 'Rejected', 'Closed', 'Revalidation Due',
] as const;

export const VALIDATION_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory',
  'Microbiology', 'Packaging', 'Maintenance', 'IT / CSV', 'Validation', 'PQR', 'CPV',
] as const;

export const PASS_FAIL = ['Pass', 'Fail', 'N/A'] as const;

export const GXP_IMPACTS = ['Direct GxP', 'Indirect GxP', 'Non-GxP'] as const;

export const CSV_RISK_CATEGORIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export const APPROVAL_DECISIONS = ['pending', 'approved', 'rejected'] as const;

export type ValidationType = typeof VALIDATION_TYPES[number];
export type ValidationStatus = typeof VALIDATION_STATUSES[number];

export interface ValidationActor {
  id: string;
  name: string;
  role: string;
}

export interface ValidationRecord {
  id: string;
  validation_number: string;
  validation_type: ValidationType | string;
  validation_title: string;
  department: string;
  product_name: string;
  batch_number: string;
  equipment_name: string;
  equipment_id: string;
  system_name: string;
  protocol_number: string;
  protocol_version: string;
  report_number: string;
  validation_start_date: string;
  validation_end_date: string;
  revalidation_due_date: string | null;
  validation_status: ValidationStatus | string;
  deviation_observed: boolean;
  capa_required: boolean;
  change_control_linked: boolean;
  change_control_id: string | null;
  change_control_number: string | null;
  linked_deviation_id: string | null;
  linked_deviation_number: string | null;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  prepared_by: string;
  prepared_by_name: string;
  reviewed_by: string;
  reviewed_by_name: string;
  approved_by: string;
  approved_by_name: string;
  remarks: string;
  is_vmp: boolean;
  vmp_year: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface ValidationProtocol {
  id: string;
  validation_id: string;
  objective: string;
  scope: string;
  responsibility: string;
  reference_documents: string;
  acceptance_criteria: string;
  pre_requisites: string;
  test_scripts: string;
  deviation_handling: string;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface ValidationExecutionStep {
  id: string;
  validation_id: string;
  test_step_no: number;
  test_description: string;
  expected_result: string;
  actual_result: string;
  pass_fail: string;
  executed_by: string;
  executed_by_name: string;
  execution_date: string;
  evidence_url: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface ValidationApproval {
  id: string;
  validation_id: string;
  approval_level: string;
  approver_id: string;
  approver_name: string;
  decision: string;
  comments: string;
  approved_at: string;
}

export interface ValidationAttachment {
  id: string;
  validation_id: string;
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

export interface ProcessValidationData {
  id: string;
  validation_id: string;
  product: string;
  batch_no: string;
  stage: string;
  cpp_parameter: string;
  cqa_parameter: string;
  acceptance_criteria: string;
  observed_result: string;
  conclusion: string;
  created_at: string;
}

export interface CleaningValidationData {
  id: string;
  validation_id: string;
  product_from: string;
  product_to: string;
  equipment: string;
  swab_location: string;
  maco_limit: string;
  observed_residue: string;
  result: string;
  cleaning_status: string;
  created_at: string;
}

export interface CsvValidationData {
  id: string;
  validation_id: string;
  system_name: string;
  gxp_impact: string;
  risk_category: string;
  urs_number: string;
  frs_number: string;
  ds_number: string;
  iq_protocol: string;
  oq_protocol: string;
  pq_protocol: string;
  traceability_matrix: string;
  part11_assessment: string;
  validation_status: string;
  created_at: string;
}

export interface ValidationFilters {
  validation_type?: string;
  validation_status?: string;
  department?: string;
  search?: string;
  is_vmp?: boolean;
}

export interface ValidationDashboardMetrics {
  total: number;
  open: number;
  approved: number;
  rejected: number;
  deviationObserved: number;
  capaLinked: number;
  revalidationDue: number;
  overdue: number;
}

export function isValidationOpen(status: string): boolean {
  return !['Approved', 'Rejected', 'Closed'].includes(status);
}

export function isValidationReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageValidation(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa_validation'].includes(role);
}

export function canExecuteValidation(role: string, validationType: string): boolean {
  if (canManageValidation(role)) return true;
  if (['engineering', 'maintenance'].includes(role) && ['DQ', 'IQ', 'OQ', 'PQ', 'Utility Qualification', 'Equipment Requalification'].includes(validationType)) return true;
  if (['production', 'production_manager'].includes(role) && validationType === 'Process Validation') return true;
  if (['qc', 'qc_manager'].includes(role) && validationType === 'Method Validation') return true;
  if (['it', 'csv', 'it_csv'].includes(role) && validationType === 'Computer System Validation') return true;
  return false;
}

export function canApproveValidation(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}
