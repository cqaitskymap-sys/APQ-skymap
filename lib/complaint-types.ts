export const COMPLAINT_COLLECTIONS = {
  records: 'complaints',
  investigations: 'complaint_investigations',
  attachments: 'complaint_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  recalls: 'recalls',
} as const;

export const COMPLAINT_CATEGORIES = [
  'Quality Defect', 'Packaging Defect', 'Labeling Issue', 'Leakage', 'Particles',
  'Short Fill', 'Wrong Product', 'Adverse Event', 'Efficacy Issue', 'Other',
] as const;

export const COMPLAINT_CRITICALITIES = ['Minor', 'Major', 'Critical'] as const;

export const COMPLAINT_STATUSES = [
  'draft', 'received', 'under_investigation', 'qa_review', 'capa_required', 'closed', 'rejected', 'overdue',
] as const;

export const RECEIVED_FROM_OPTIONS = ['Customer', 'Distributor', 'Regulatory Authority', 'Internal', 'Other'] as const;

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
  customer_contact: string;
  market_region: string;
  product_name: string;
  batch_number: string;
  mfg_date: string;
  exp_date: string;
  complaint_category: ComplaintCategory | string;
  complaint_description: string;
  sample_received: boolean;
  retain_sample_required: boolean;
  complaint_criticality: ComplaintCriticality | string;
  initial_assessment: string;
  investigation_required: boolean;
  product_safety_impact: boolean;
  root_cause: string;
  impact_assessment: string;
  capa_required: boolean;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  linked_recall_id: string | null;
  linked_recall_number: string | null;
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
  investigation_summary: string;
  findings: string;
  root_cause: string;
  impact_assessment: string;
  sample_analysis: string;
  batch_review: string;
  conclusion: string;
  capa_required: boolean;
  investigated_by: string;
  investigated_by_name: string;
  investigated_at: string;
  created_at: string;
  updated_at: string;
}

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
}

export interface ComplaintDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  critical: number;
  capaLinked: number;
  overdue: number;
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
  return !['auditor', 'viewer'].includes(role);
}

export function canApproveComplaint(role: string): boolean {
  return ['super_admin', 'admin', 'qa', 'qa_manager', 'head_qa'].includes(role);
}
