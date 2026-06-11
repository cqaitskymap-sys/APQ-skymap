export const CC_COLLECTIONS = {
  records: 'change_controls',
  impact: 'change_impact_assessments',
  risk: 'change_risk_assessments',
  implementation: 'change_implementation_actions',
  effectiveness: 'change_effectiveness_reviews',
  approvals: 'change_approvals',
  attachments: 'change_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  capa: 'capa_records',
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
  qa_remarks: string;
  status: CcStatus | string;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  pqr_id: string | null;
  batch_id: string | null;
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
  quality_impact: string;
  safety_impact: string;
  efficacy_impact: string;
  process_impact: string;
  equipment_impact: string;
  utility_impact: string;
  cleaning_impact: string;
  validation_impact: string;
  stability_impact: string;
  regulatory_impact: string;
  documentation_impact: string;
  training_impact: string;
  computerized_system_impact: string;
  remarks: string;
  assessed_by: string;
  assessed_by_name: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeRiskAssessment {
  id: string;
  change_id: string;
  severity: number;
  occurrence: number;
  detectability: number;
  rpn: number;
  risk_level: string;
  mitigation_plan: string;
  assessed_by: string;
  assessed_by_name: string;
  assessed_at: string;
  created_at: string;
  updated_at: string;
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
  change_id: string;
  effectiveness_criteria: string;
  review_date: string;
  reviewed_by: string;
  reviewed_by_name: string;
  result: string;
  conclusion: string;
  further_action_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChangeApproval {
  id: string;
  change_id: string;
  approval_level: 'department' | 'qa_review' | 'regulatory' | 'head_qa' | 'final';
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected';
  comments: string;
  e_signature: string;
  signed_at: string;
  created_at: string;
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
  if (rpn >= 80) return 'Critical';
  if (rpn >= 50) return 'High';
  if (rpn >= 20) return 'Medium';
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
  return !['auditor', 'viewer'].includes(role);
}

export function canApproveChange(role: string): boolean {
  const r = role;
  return ['super_admin', 'head_qa', 'qa_manager', 'admin', 'qa', 'regulatory_affairs'].includes(r)
    || r === 'super_admin' || r === 'qa';
}
