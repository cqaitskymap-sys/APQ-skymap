export const CAPA_COLLECTIONS = {
  records: 'capa_records',
  actions: 'capa_actions',
  effectiveness: 'capa_effectiveness',
  approvals: 'capa_approvals',
  approvalHistory: 'capa_approval_history',
  closure: 'capa_closure',
  trends: 'capa_trends',
  reports: 'capa_reports',
  attachments: 'capa_attachments',
  sourceLinks: 'capa_source_links',
  investigations: 'capa_investigations',
  rootCauseAnalysis: 'capa_root_cause_analysis',
  correctiveActions: 'capa_corrective_actions',
  preventiveActions: 'capa_preventive_actions',
  trainingRecords: 'training_records',
  sopManagement: 'sop_management',
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

export const CAPA_EFF_REVIEW_RESULTS = [
  'Effective', 'Partially Effective', 'Not Effective', 'Pending Review',
] as const;

export const CAPA_EFF_REVIEW_STATUSES = [
  'draft', 'scheduled', 'under_review', 'qa_review', 'approved', 'rejected', 'closed', 'reassessment_required',
] as const;

export const CAPA_EFF_EVALUATION_CRITERIA = [
  'No repeat deviation',
  'No repeat OOS',
  'No repeat complaint',
  'No repeat audit finding',
  'Risk reduction achieved',
  'Process improvement achieved',
  'Compliance maintained',
  'Training effectiveness verified',
  'SOP effectiveness verified',
] as const;
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
  patient_safety_impact?: boolean | string;
  regulatory_impact?: boolean | string;
  is_locked?: boolean;
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
  effectiveness_id?: string;
  capa_id: string;
  capa_number?: string;
  source_type?: string;
  source_reference_number?: string;
  effectiveness_required?: boolean;
  effectiveness_due_date?: string | null;
  effectiveness_review_date?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
  department?: string;
  review_period?: string;
  evaluation_criteria?: string[];
  evidence_reviewed?: string;
  data_reviewed?: string;
  repeat_issue_observed?: boolean;
  issue_reoccurred?: boolean;
  risk_reduced?: boolean;
  root_cause_eliminated?: boolean;
  corrective_action_effective?: boolean;
  preventive_action_effective?: boolean;
  effectiveness_result?: string;
  effectiveness_score?: number;
  qa_comments?: string;
  head_qa_comments?: string;
  final_conclusion?: string;
  status?: string;
  follow_up_required?: boolean;
  follow_up_capa_id?: string | null;
  new_capa_recommended?: boolean;
  capa_closure_recommended?: boolean;
  is_deleted?: boolean;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  /** Legacy fields */
  check_date: string;
  criteria: string;
  result: EffectivenessResult | string;
  evidence: string;
  checked_by: string;
  checked_by_name: string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface CapaEffectivenessDashboardMetrics {
  total: number;
  pendingReviews: number;
  effective: number;
  partiallyEffective: number;
  notEffective: number;
  reassessmentRequired: number;
  overdue: number;
  readyForClosure: number;
}

export interface CapaEffectivenessChartData {
  resultDistribution: { name: string; count: number }[];
  monthlyTrend: { name: string; count: number; effective: number; notEffective: number }[];
  byDepartment: { name: string; count: number }[];
  bySource: { name: string; count: number }[];
  effectiveTrend: { name: string; effective: number; notEffective: number }[];
}

export interface CapaEffectivenessTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export interface CapaApproval {
  id: string;
  capa_id: string;
  capa_number?: string;
  approval_id?: string;
  current_workflow_step?: string;
  current_approver?: string;
  current_approver_name?: string;
  current_approver_role?: string;
  current_role?: string;
  approval_level: number | string;
  approval_level_legacy?: 'qa_review' | 'head_qa' | 'final';
  approval_status?: string;
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
  signed_by?: string;
  signed_date?: string | null;
  due_date?: string | null;
  completed_date?: string | null;
  escalation_status?: string;
  created_by?: string;
  created_by_name?: string;
  updated_by?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at?: string;
  is_deleted?: boolean;
}

export interface CapaApprovalHistoryEntry {
  id?: string;
  capa_id: string;
  capa_number: string;
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

export interface CapaApprovalDashboardCounts {
  pendingApprovals: number;
  myPendingApprovals: number;
  approvedCapa: number;
  rejectedCapa: number;
  sentBackCapa: number;
  criticalPending: number;
  overdueApprovals: number;
  headQaPending: number;
  readyForClosure: number;
}

export interface CapaApprovalTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
  workflow_step?: string;
}

export const CAPA_CLOSURE_STATUSES = [
  'Pending', 'Ready For Closure', 'QA Review', 'Head QA Review', 'Closed', 'Rejected', 'Reopened',
] as const;

export interface CapaClosure {
  id: string;
  closure_id: string;
  capa_id: string;
  capa_number: string;
  source_type?: string;
  source_reference_number?: string;
  closure_date: string | null;
  closed_by: string;
  closed_by_name?: string;
  department: string;
  rca_approved?: boolean;
  corrective_actions_completed: boolean;
  preventive_actions_completed: boolean;
  implementation_verified?: boolean;
  evidence_uploaded?: boolean;
  effectiveness_check_completed: boolean;
  effectiveness_result: string;
  risk_reduced?: boolean;
  root_cause_eliminated?: boolean;
  recurrence_prevented?: boolean;
  training_completed?: boolean;
  sop_updated?: boolean;
  change_control_completed?: boolean;
  all_evidence_reviewed?: boolean;
  qa_approval_completed?: boolean;
  qa_closure_comments: string;
  head_qa_comments?: string;
  final_closure_conclusion: string;
  closure_status: string;
  closure_recommendation?: string;
  new_capa_recommended?: boolean;
  additional_monitoring_recommended?: boolean;
  readiness_percent?: number;
  e_signature_required?: boolean;
  e_signature?: string;
  e_signature_status?: string;
  signed_by?: string;
  signed_date?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name?: string;
  updated_by: string;
  updated_by_name?: string;
  is_deleted: boolean;
}

export interface CapaClosureDashboardMetrics {
  readyForClosure: number;
  pendingReview: number;
  closed: number;
  rejected: number;
  reopened: number;
  effectiveClosures: number;
  partiallyEffective: number;
  notEffective: number;
}

export interface CapaClosureTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export const CAPA_TREND_STATUSES = [
  'Improving', 'Stable', 'Increasing', 'Critical', 'Insufficient Data',
] as const;

export interface CapaTrendMetrics {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  effective: number;
  notEffective: number;
  avgClosureDays: number;
  monthlyTrend: { name: string; month?: string; count?: number }[];
  bySource: { name: string; count?: number }[];
  byDepartment: { name: string; count?: number }[];
  byRootCause: { name: string; count?: number }[];
  byPriority: { name: string; count?: number }[];
  openClosedTrend: { name: string; open?: number; closed?: number }[];
  overdueTrend: { name: string; count?: number }[];
  effectivenessTrend: { name: string; effective?: number; notEffective?: number }[];
  closureTimeTrend: { name: string; avgDays?: number }[];
}

export interface CapaTrendRecord {
  id: string;
  trend_id: string;
  review_period_from: string;
  review_period_to: string;
  department: string;
  product: string;
  capa_source: string;
  root_cause_category: string;
  priority: string;
  total_capa: number;
  open_capa: number;
  closed_capa: number;
  overdue_capa: number;
  effective_capa: number;
  not_effective_capa: number;
  average_closure_days: number;
  trend_status: string;
  risk_level: string;
  conclusion: string;
  recommendation: string;
  generated_by: string;
  generated_by_name?: string;
  generated_date: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_date?: string | null;
  alerts?: string[];
  chart_snapshot?: Record<string, unknown>;
  filters?: Record<string, string>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

export const CAPA_REPORT_TYPES = [
  'CAPA Register',
  'Open CAPA Report',
  'Closed CAPA Report',
  'Overdue CAPA Report',
  'CAPA Effectiveness Report',
  'Department-wise CAPA Report',
  'Source-wise CAPA Report',
  'Corrective Action Report',
  'Preventive Action Report',
  'CAPA Closure Report',
  'CAPA Trend Report',
  'Management Review Report',
] as const;

export type CapaReportType = typeof CAPA_REPORT_TYPES[number];

export const CAPA_MANAGEMENT_REPORT_TYPES: CapaReportType[] = [
  'Management Review Report',
  'CAPA Trend Report',
];

export interface CapaReportPreviewRow {
  capa_number: string;
  capa_source: string;
  source_reference: string;
  department: string;
  product: string;
  root_cause: string;
  priority: string;
  owner: string;
  target_date: string;
  closure_date: string;
  status: string;
  effectiveness_result: string;
  risk_level: string;
}

export interface CapaReportAnalyticsMetrics extends CapaDashboardMetrics {
  capaSuccessRate: number;
  overdueRate: number;
  effectivenessRate: number;
  repeatCapa: number;
  highRiskCapa: number;
}

export interface CapaReportChartData {
  monthlyTrend: { name: string; count?: number }[];
  bySource: { name: string; count?: number }[];
  byDepartment: { name: string; count?: number }[];
  byPriority: { name: string; count?: number }[];
  byStatus: { name: string; count?: number }[];
  effectivenessTrend: { name: string; effective?: number; notEffective?: number }[];
  closurePerformanceTrend: { name: string; avgDays?: number }[];
  overdueTrend: { name: string; count?: number }[];
  rootCauseTrend: { name: string; count?: number }[];
  riskDistribution: { name: string; count?: number }[];
}

export interface CapaManagementReviewSummary {
  totalCapaCreated: number;
  totalCapaClosed: number;
  overdueCapaPct: number;
  capaEffectivenessPct: number;
  topRootCauses: { name: string; count: number }[];
  topDepartments: { name: string; count: number }[];
  repeatIssues: string[];
  improvementOpportunities: string[];
  narrative: string;
}

export interface CapaReportRecord {
  id: string;
  report_id: string;
  report_name: string;
  report_number: string;
  report_type: CapaReportType | string;
  review_period_from: string;
  review_period_to: string;
  department: string;
  product: string;
  capa_source: string;
  priority: string;
  status_filter: string;
  effectiveness_result: string;
  capa_number: string;
  owner: string;
  overdue_only: boolean;
  critical_only: boolean;
  generated_by: string;
  generated_by_name?: string;
  generated_at: string;
  generated_date: string;
  total_records: number;
  export_type: string;
  file_url: string;
  file_name?: string;
  report_status: string;
  scheduled?: boolean;
  schedule_frequency?: string;
  schedule_next_run?: string | null;
  filters_applied: Record<string, string | boolean>;
  preview_rows?: Record<string, unknown>[];
  chart_snapshot?: Record<string, unknown>;
  metrics_snapshot?: Record<string, unknown>;
  management_summary?: CapaManagementReviewSummary | Record<string, unknown>;
  summary: string;
  recommendations?: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
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

export function requiresHeadQaApproval(priority: string, capa?: Partial<CapaRecord>): boolean {
  if (priority === 'critical') return true;
  if (capa?.head_qa_approval_required) return true;
  const ps = capa?.patient_safety_impact;
  if (ps === true || ps === 'yes' || ps === 'Yes') return true;
  const reg = capa?.regulatory_impact;
  if (reg === true || reg === 'yes' || reg === 'Yes') return true;
  if (/patient|regulatory|critical/i.test(capa?.criticality || '')) return true;
  if (['Market Complaint', 'Recall'].includes(capa?.capa_source || '')) return true;
  return false;
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

export const CAPA_PA_RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type CapaPaRiskLevel = typeof CAPA_PA_RISK_LEVELS[number];

export interface CapaPreventiveActionEvidence {
  id: string;
  file_name: string;
  description: string;
  file_url?: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
}

export interface CapaPreventiveAction {
  id: string;
  preventive_action_id: string;
  capa_id: string;
  capa_number: string;
  action_number: string;
  risk_reference: string;
  root_cause_reference: string;
  preventive_action_description: string;
  objective: string;
  expected_outcome: string;
  action_owner: string;
  action_owner_name: string;
  department: string;
  priority: CapaCaPriority | string;
  risk_level: CapaPaRiskLevel | string;
  target_completion_date: string;
  actual_completion_date: string | null;
  implementation_status: CapaCaImplementationStatus | string;
  implementation_evidence: string;
  evidence_items: CapaPreventiveActionEvidence[];
  training_required: boolean;
  training_reference: string;
  training_record_id: string | null;
  sop_revision_required: boolean;
  sop_reference: string;
  sop_record_id: string | null;
  change_control_required: boolean;
  change_control_reference: string;
  change_control_id: string | null;
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

export interface CapaPreventiveActionDashboardMetrics {
  total: number;
  open: number;
  implemented: number;
  trainingLinked: number;
  sopRevision: number;
  changeControlLinked: number;
  qaVerificationPending: number;
  overdue: number;
  closed: number;
}

export interface CapaPreventiveActionTimelineEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

