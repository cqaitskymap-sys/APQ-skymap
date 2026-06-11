export const OOS_COLLECTIONS = {
  records: 'oos_records',
  phase1: 'oos_phase1',
  phase2: 'oos_phase2',
  impactAssessments: 'oos_impact_assessment',
  capaLinks: 'oos_capa_link',
  approvals: 'oos_approvals',
  attachments: 'oos_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  capa: 'capa_records',
} as const;

export const OOS_STATUSES = [
  'draft', 'submitted', 'phase1_investigation', 'qa_review',
  'phase2_investigation', 'capa_required', 'final_qa_review',
  'approved', 'rejected', 'closed', 'overdue',
] as const;

export const OPEN_OOS_STATUSES = [
  'draft', 'submitted', 'phase1_investigation', 'qa_review',
  'phase2_investigation', 'capa_required', 'final_qa_review',
  'overdue', 'open', 'under_investigation', 'confirmed',
] as const;

export const PHASE1_OUTCOMES = [
  'Laboratory Error', 'No Laboratory Error', 'Inconclusive',
] as const;

export const CRITICAL_TESTS = [
  'Assay', 'Sterility', 'Endotoxin', 'Particulate Matter',
  'Water Content', 'Related Substances', 'Microbial Limit',
  'Preservative Efficacy', 'pH', 'Osmolality',
] as const;

export const DEPARTMENTS = [
  'QC', 'QA', 'Production', 'Microbiology', 'Engineering', 'Warehouse',
] as const;

export type OosStatus = typeof OOS_STATUSES[number];
export type Phase1Outcome = typeof PHASE1_OUTCOMES[number];
export type ResultStatus = 'Pass' | 'OOS';

export interface OosRecord {
  id: string;
  oos_number: string;
  oos_date: string;
  department: string;
  product_name: string;
  product_id: string | null;
  batch_number: string;
  batch_id: string | null;
  test_name: string;
  test_method: string;
  stp_number: string;
  specification_number: string;
  parameter_name: string;
  spec_lower_limit: number;
  spec_upper_limit: number;
  observed_result: number;
  unit: string;
  result_status: ResultStatus;
  /** Legacy PQR field */
  test_parameter: string;
  specification: string;
  obtained_result: string;
  is_critical_test: boolean;
  batch_release_blocked: boolean;
  status: OosStatus | string;
  phase: 'phase1' | 'phase2' | 'phase3';
  capa_required: boolean;
  linked_capa_number: string | null;
  linked_capa_id: string | null;
  target_closure_date: string | null;
  actual_closure_date: string | null;
  root_cause: string;
  source: 'manual' | 'cpv_cqa' | 'cpv_cpp' | 'batch';
  source_reference: string | null;
  cpv_record_id: string | null;
  pqr_id: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_by: string;
  updated_by_name: string;
  updated_at: string;
}

export interface OosPhase1 {
  id: string;
  oos_id: string;
  analyst_name: string;
  instrument_used: string;
  instrument_calibration_status: string;
  standard_used: string;
  reagent_used: string;
  calculation_verified: boolean;
  data_review_completed: boolean;
  chromatogram_attached: boolean;
  raw_data_attached: boolean;
  investigation_findings: string;
  root_cause_identified: string;
  phase1_conclusion: string;
  phase1_outcome: Phase1Outcome | string;
  investigator_id: string;
  investigator_name: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OosPhase2 {
  id: string;
  oos_id: string;
  raw_material_review: string;
  equipment_review: string;
  environmental_review: string;
  process_review: string;
  operator_review: string;
  deviation_review: string;
  change_control_review: string;
  batch_record_review: string;
  root_cause: string;
  impact_assessment: string;
  corrective_action: string;
  preventive_action: string;
  conclusion: string;
  investigator_id: string;
  investigator_name: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OosImpactAssessment {
  id: string;
  oos_id: string;
  product_impact: string;
  batch_impact: string;
  market_impact: string;
  patient_safety_impact: string;
  regulatory_impact: string;
  other_batches_impacted: string;
  recall_required: boolean;
  assessed_by: string;
  assessed_by_name: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface OosCapaLink {
  id: string;
  oos_id: string;
  capa_required: boolean;
  capa_number: string;
  capa_id: string | null;
  capa_status: string;
  target_date: string | null;
  effectiveness_check: string;
  linked_by: string;
  linked_by_name: string;
  linked_at: string;
  created_at: string;
}

export interface OosApproval {
  id: string;
  oos_id: string;
  approval_level: 'qa_review' | 'head_qa' | 'final';
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected' | 'pending';
  comments: string;
  e_signature: string;
  signed_at: string | null;
  created_at: string;
}

export interface OosAttachment {
  id: string;
  oos_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: 'pdf' | 'excel' | 'chromatogram' | 'image' | 'report' | 'other';
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface OosFilters {
  search?: string;
  oos_number?: string;
  department?: string;
  product_name?: string;
  batch_number?: string;
  test_name?: string;
  status?: string;
  capa_linked?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface OosDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  critical: number;
  capaLinked: number;
  overdue: number;
  monthlyTrend: { month: string; count: number }[];
  byDepartment: { name: string; count: number }[];
  byProduct: { name: string; count: number }[];
  rootCauseTrend: { name: string; count: number }[];
  closureTrend: { month: string; open: number; closed: number }[];
}

export interface OosActor {
  id: string;
  name: string;
  role: string;
}

export function computeResultStatus(
  observed: number,
  lower: number,
  upper: number,
): ResultStatus {
  if (observed >= lower && observed <= upper) return 'Pass';
  return 'OOS';
}

export function isOpenOosStatus(status: string): boolean {
  return OPEN_OOS_STATUSES.includes(status as typeof OPEN_OOS_STATUSES[number]);
}

export function isCriticalTest(testName: string): boolean {
  return CRITICAL_TESTS.some((t) =>
    testName.toLowerCase().includes(t.toLowerCase()),
  );
}

export function buildLegacySpecification(lower: number, upper: number, unit: string): string {
  return `${lower} - ${upper} ${unit}`;
}
