export const CAPA_COLLECTIONS = {
  records: 'capa_records',
  actions: 'capa_actions',
  effectiveness: 'capa_effectiveness',
  approvals: 'capa_approvals',
  attachments: 'capa_attachments',
  sourceLinks: 'capa_source_links',
  investigations: 'capa_investigations',
  rootCauseAnalysis: 'capa_root_cause_analysis',
  correctiveActions: 'capa_corrective_actions',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  deviations: 'deviations',
  oos: 'oos_records',
  risks: 'cpv_risk_assessment',
  batches: 'batches',
  products: 'products',
  complaints: 'complaints',
  changeControls: 'change_controls',
  audits: 'audits',
  departments: 'departments',
  users: 'users',
} as const;

export const CAPA_SOURCES = [
  'Deviation', 'OOS', 'Audit', 'Market Complaint', 'Recall', 'Change Control',
  'CPV Risk', 'Self Inspection', 'Vendor Audit', 'Other',
] as const;

export const CAPA_STATUSES = [
  'draft', 'submitted', 'assigned', 'under_implementation', 'implemented',
  'effectiveness_pending', 'effectiveness_completed', 'qa_review',
  'approved', 'rejected', 'closed', 'overdue',
] as const;

export const CLOSED_CAPA_STATUSES = ['closed', 'approved'] as const;
export const OPEN_CAPA_STATUSES = [
  'draft', 'submitted', 'assigned', 'under_implementation', 'implemented',
  'effectiveness_pending', 'effectiveness_completed', 'qa_review', 'overdue',
] as const;

export const EFFECTIVENESS_RESULTS = ['Effective', 'Not Effective', 'Pending', 'N/A'] as const;
export const CAPA_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const CAPA_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse',
  'Regulatory', 'Microbiology', 'Packaging', 'Maintenance',
] as const;

export type CapaSource = typeof CAPA_SOURCES[number];
export type CapaStatus = typeof CAPA_STATUSES[number];
export type EffectivenessResult = typeof EFFECTIVENESS_RESULTS[number];
export type CapaPriority = typeof CAPA_PRIORITIES[number];

export interface CapaActor {
  id: string;
  name: string;
  role: string;
}

export interface CapaRecord {
  id: string;
  capa_number: string;
  capa_date: string;
  capa_source: CapaSource | string;
  source_reference_number: string;
  department: string;
  product_name: string;
  batch_number: string;
  capa_title: string;
  problem_description: string;
  root_cause: string;
  corrective_action: string;
  preventive_action: string;
  action_owner: string;
  action_owner_name: string;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  effectiveness_check_required: boolean;
  effectiveness_check_date: string | null;
  effectiveness_criteria: string;
  effectiveness_result: EffectivenessResult | string;
  capa_status: CapaStatus | string;
  qa_remarks: string;
  priority: CapaPriority | string;
  criticality?: string;
  qa_reviewer?: string;
  qa_reviewer_name?: string;
  head_qa_approval_required?: boolean;
  /** Linked source IDs */
  deviation_id: string | null;
  oos_id: string | null;
  cpv_risk_id: string | null;
  change_control_id: string | null;
  pqr_id: string | null;
  complaint_id: string | null;
  audit_id: string | null;
  batch_id: string | null;
  extension_capa_id: string | null;
  parent_capa_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CapaAction {
  id: string;
  capa_id: string;
  action_type: 'corrective' | 'preventive' | 'implementation';
  description: string;
  owner: string;
  owner_name: string;
  target_date: string | null;
  completed_date: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  evidence: string;
  created_at: string;
  updated_at: string;
}

export interface CapaEffectiveness {
  id: string;
  capa_id: string;
  check_date: string;
  criteria: string;
  result: EffectivenessResult | string;
  evidence: string;
  checked_by: string;
  checked_by_name: string;
  follow_up_required: boolean;
  follow_up_capa_id: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface CapaApproval {
  id: string;
  capa_id: string;
  approval_level: 'qa_review' | 'head_qa' | 'final';
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected';
  comments: string;
  e_signature: string;
  signed_at: string;
  created_at: string;
}

export interface CapaAttachment {
  id: string;
  capa_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface CapaSourceLink {
  id: string;
  capa_id: string;
  source_type: string;
  source_id: string;
  source_number: string;
  linked_at: string;
  linked_by: string;
  linked_by_name: string;
}

export interface CapaFilters {
  status?: string;
  source?: string;
  department?: string;
  priority?: string;
  search?: string;
  due_this_week?: boolean;
  capa_number?: string;
  owner?: string;
  effectiveness_result?: string;
  date_from?: string;
  date_to?: string;
  overdue_only?: boolean;
  kpi_filter?: string;
}

export interface CapaActivityEntry {
  date: string;
  title: string;
  description: string;
  user: string;
  capa_id?: string;
  capa_number?: string;
}

export interface CapaDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  draft: number;
  underImplementation: number;
  effectivenessPending: number;
  overdue: number;
  critical: number;
  highPriority: number;
  effective: number;
  notEffective: number;
  dueThisWeek: number;
  deviationLinked: number;
  oosLinked: number;
  auditLinked: number;
  avgClosureDays: number;
}

export function isCapaClosed(status: string): boolean {
  return CLOSED_CAPA_STATUSES.includes(status as typeof CLOSED_CAPA_STATUSES[number]) || status === 'closed';
}

export function isCapaOpen(status: string): boolean {
  return !isCapaClosed(status) && status !== 'rejected';
}

export function requiresHeadQaApproval(priority: string): boolean {
  return priority === 'critical';
}

import { normalizeRole } from '@/lib/permissions';

export function canUserAccessCapa(role: string): boolean {
  const r = normalizeRole(role);
  return Boolean(r) && ![''].includes(r);
}

export function canCreateCapa(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'qa_manager', 'head_qa', 'qa', 'qa_executive'].includes(r)) return true;
  if (['qc_manager', 'qc', 'production_manager', 'production'].includes(r)) return true;
  return false;
}

export function canCreateCapaCreate(role?: string | null): boolean {
  return canCreateCapa(role) && !isCapaReadOnly(role || '');
}

export function canApproveCapa(role: string): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'head_qa', 'qa_manager', 'admin'].includes(r)
    || role === 'qa' || role === 'super_admin';
}

export function canImplementCapa(role: string): boolean {
  return !['auditor', 'viewer'].includes(role);
}

export function isCapaReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export const CAPA_INVESTIGATION_STATUSES = [
  'draft', 'under_investigation', 'qa_review', 'approved', 'rejected', 'closed',
] as const;

export const CAPA_RCA_METHODS = [
  '5 Why Analysis', 'Fishbone Diagram', 'Fault Tree Analysis', 'Human Error Analysis',
  'Risk Based RCA', 'Brainstorming', 'Other',
] as const;

export const CAPA_RCA_CATEGORIES = [
  'People', 'Process', 'Procedure', 'Equipment', 'Material', 'Environment',
  'Measurement', 'Management', 'Training', 'Software / CSV', 'Other',
] as const;

export const CAPA_FISHBONE_CATEGORIES = [
  'Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment',
] as const;

export type CapaInvestigationStatus = typeof CAPA_INVESTIGATION_STATUSES[number];
export type CapaRcaMethod = typeof CAPA_RCA_METHODS[number];
export type CapaRcaCategory = typeof CAPA_RCA_CATEGORIES[number];

export interface CapaFiveWhyAnalysis {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  final_root_cause: string;
}

export interface CapaFishboneAnalysis {
  Man: string;
  Machine: string;
  Method: string;
  Material: string;
  Measurement: string;
  Environment: string;
}

export interface CapaInvestigationEvidence {
  id: string;
  name: string;
  description: string;
  file_url?: string;
  added_at: string;
  added_by: string;
  added_by_name: string;
}

export interface CapaInvestigation {
  id: string;
  investigation_id: string;
  capa_id: string;
  capa_number: string;
  source_type: string;
  source_reference: string;
  investigation_date: string;
  investigator: string;
  investigator_name: string;
  department: string;
  problem_statement: string;
  observed_issue: string;
  issue_description: string;
  immediate_containment_action: string;
  root_cause_method: CapaRcaMethod | string;
  root_cause_category: CapaRcaCategory | string;
  root_cause_description: string;
  contributing_factors: string;
  evidence_summary: string;
  evidence_items: CapaInvestigationEvidence[];
  risk_assessment_result: string;
  corrective_action_recommendation: string;
  preventive_action_recommendation: string;
  investigation_conclusion: string;
  qa_review_comments: string;
  five_why: CapaFiveWhyAnalysis;
  fishbone: CapaFishboneAnalysis;
  auto_recommendations: string[];
  status: CapaInvestigationStatus | string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface CapaRootCauseAnalysis {
  id: string;
  investigation_id: string;
  capa_id: string;
  capa_number: string;
  root_cause_method: string;
  root_cause_category: string;
  root_cause_description: string;
  contributing_factors: string;
  five_why: CapaFiveWhyAnalysis;
  fishbone: CapaFishboneAnalysis;
  auto_recommendations: string[];
  status: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface CapaInvestigationDashboardMetrics {
  total: number;
  open: number;
  approved: number;
  rejected: number;
  pendingQaReview: number;
  trainingRelated: number;
  equipmentRelated: number;
  processRelated: number;
}

export interface CapaInvestigationTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export const CAPA_CA_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const CAPA_CA_IMPLEMENTATION_STATUSES = [
  'not_started', 'in_progress', 'implemented', 'delayed', 'rejected',
] as const;

export const CAPA_CA_ACTION_STATUSES = [
  'draft', 'assigned', 'under_implementation', 'implemented', 'qa_verification',
  'approved', 'rejected', 'closed', 'overdue',
] as const;

export type CapaCaPriority = typeof CAPA_CA_PRIORITIES[number];
export type CapaCaImplementationStatus = typeof CAPA_CA_IMPLEMENTATION_STATUSES[number];
export type CapaCaActionStatus = typeof CAPA_CA_ACTION_STATUSES[number];

export interface CapaCorrectiveActionEvidence {
  id: string;
  file_name: string;
  description: string;
  file_url?: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
}

export interface CapaCorrectiveAction {
  id: string;
  corrective_action_id: string;
  capa_id: string;
  capa_number: string;
  action_number: string;
  root_cause_reference: string;
  corrective_action_description: string;
  action_owner: string;
  action_owner_name: string;
  department: string;
  priority: CapaCaPriority | string;
  target_completion_date: string;
  actual_completion_date: string | null;
  implementation_status: CapaCaImplementationStatus | string;
  implementation_evidence: string;
  evidence_items: CapaCorrectiveActionEvidence[];
  verification_required: boolean;
  verified_by: string;
  verified_by_name: string;
  verification_date: string | null;
  verification_comments: string;
  qa_review_comments: string;
  action_status: CapaCaActionStatus | string;
  remarks: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface CapaCorrectiveActionDashboardMetrics {
  total: number;
  open: number;
  implemented: number;
  qaVerificationPending: number;
  overdue: number;
  rejected: number;
  closed: number;
}

export interface CapaCorrectiveActionTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

