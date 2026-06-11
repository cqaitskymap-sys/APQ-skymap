export const DEVIATION_COLLECTIONS = {
  deviations: 'deviations',
  investigations: 'deviation_investigations',
  impactAssessments: 'deviation_impact_assessments',
  approvals: 'deviation_approvals',
  attachments: 'deviation_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  capa: 'capa_records',
} as const;

export const DEVIATION_CATEGORIES = [
  'Process', 'Equipment', 'Utility', 'Material', 'Documentation',
  'Environmental', 'Cleaning', 'Sterilization', 'Testing', 'Packaging',
  'Software / CSV', 'Other',
] as const;

export const DEVIATION_PLANNED_TYPES = ['Planned', 'Unplanned'] as const;
export const DEVIATION_CRITICALITIES = ['Minor', 'Major', 'Critical'] as const;
export const RCA_METHODS = ['5 Why', 'Fishbone', 'Manual RCA'] as const;

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
}

export interface DeviationInvestigation {
  id: string;
  deviation_id: string;
  rca_method: RcaMethod | string;
  root_cause_details: string;
  investigation_summary: string;
  investigator_id: string;
  investigator_name: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviationImpactAssessment {
  id: string;
  deviation_id: string;
  impact_summary: string;
  batch_impact_details: string;
  product_quality_impact_details: string;
  patient_safety_impact_details: string;
  regulatory_impact_details: string;
  capa_required: boolean;
  capa_justification: string;
  assessed_by: string;
  assessed_by_name: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeviationApproval {
  id: string;
  deviation_id: string;
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
}

export interface DeviationDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  critical: number;
  repeat: number;
  capaRequired: number;
  byDepartment: { name: string; count: number }[];
  byCategory: { name: string; count: number }[];
  byCriticality: { name: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  openClosedTrend: { month: string; open: number; closed: number }[];
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
  if (record.product_quality_impacted) return true;
  if (record.criticality === 'Critical') return true;
  return Boolean(record.capa_required);
}

export function requiresHeadQaApproval(criticality: string): boolean {
  return criticality === 'Critical';
}
