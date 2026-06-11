export const CAPA_COLLECTIONS = {
  records: 'capa_records',
  actions: 'capa_actions',
  effectiveness: 'capa_effectiveness',
  approvals: 'capa_approvals',
  attachments: 'capa_attachments',
  sourceLinks: 'capa_source_links',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  deviations: 'deviations',
  oos: 'oos_records',
  risks: 'cpv_risk_assessment',
  batches: 'batches',
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
}

export interface CapaDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  overdue: number;
  effective: number;
  notEffective: number;
  critical: number;
  dueThisWeek: number;
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
  return Boolean(role);
}

export function canCreateCapa(role: string): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'qa_manager', 'head_qa', 'qc_manager', 'production_manager'].includes(r)
    || role === 'qa' || role === 'super_admin';
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
