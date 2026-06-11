export const DMS_COLLECTIONS = {
  documents: 'documents',
  revisions: 'document_revisions',
  approvals: 'document_approvals',
  distribution: 'document_distribution',
  trainingLinks: 'document_training_links',
  attachments: 'document_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  changeControls: 'change_controls',
} as const;

export const DOCUMENT_TYPES = [
  'SOP', 'STP', 'Specification', 'BMR', 'BPR', 'MFR', 'Protocol', 'Report',
  'PQR', 'CPV Report', 'Validation Document', 'Calibration Document',
  'Training Document', 'Policy', 'Form', 'Other',
] as const;

export const DOCUMENT_TYPE_PREFIX: Record<string, string> = {
  SOP: 'SOP', STP: 'STP', Specification: 'SPEC', BMR: 'BMR', BPR: 'BPR', MFR: 'MFR',
  Protocol: 'PROT', Report: 'RPT', PQR: 'PQR', 'CPV Report': 'CPV', 'Validation Document': 'VAL',
  'Calibration Document': 'CAL', 'Training Document': 'TRN', Policy: 'POL', Form: 'FRM', Other: 'DOC',
};

export const DMS_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory',
  'Microbiology', 'Packaging', 'Maintenance', 'IT / CSV', 'PQR', 'CPV',
] as const;

export const DMS_STATUSES = [
  'draft', 'under_review', 'returned_for_correction', 'approved',
  'effective', 'obsolete', 'archived',
] as const;

export const APPROVAL_STAGES = ['department_review', 'qa_review', 'head_qa_approval'] as const;
export const APPROVAL_DECISIONS = ['pending', 'approved', 'rejected', 'returned'] as const;

export type DocumentType = typeof DOCUMENT_TYPES[number];
export type DmsStatus = typeof DMS_STATUSES[number];
export type ApprovalStage = typeof APPROVAL_STAGES[number];

export interface DmsActor {
  id: string;
  name: string;
  role: string;
}

export interface DocumentRecord {
  id: string;
  document_number: string;
  document_title: string;
  document_type: DocumentType | string;
  department: string;
  product_name: string;
  version: string;
  effective_date: string | null;
  next_review_date: string | null;
  prepared_by: string;
  prepared_by_name: string;
  reviewed_by: string;
  reviewed_by_name: string;
  approved_by: string;
  approved_by_name: string;
  status: DmsStatus | string;
  change_control_ref: string;
  change_control_id: string | null;
  supersedes_document_no: string;
  supersedes_document_id: string | null;
  reason_for_revision: string;
  remarks: string;
  is_latest: boolean;
  parent_document_id: string | null;
  revision_number: number;
  training_required: boolean;
  linked_pqr_id: string | null;
  linked_cpv_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRevision {
  id: string;
  document_id: string;
  document_number: string;
  version: string;
  revision_number: number;
  reason_for_revision: string;
  effective_date: string | null;
  status: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface DocumentApproval {
  id: string;
  document_id: string;
  stage: ApprovalStage | string;
  reviewer_id: string;
  reviewer_name: string;
  decision: string;
  comments: string;
  signed_at: string | null;
  created_at: string;
}

export interface DocumentDistribution {
  id: string;
  document_id: string;
  department: string;
  user_id: string;
  user_name: string;
  distributed_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface DocumentTrainingLink {
  id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  training_title: string;
  target_department: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  download_url: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface DmsFilters {
  status?: string;
  document_type?: string;
  department?: string;
  search?: string;
  effectiveOnly?: boolean;
  obsoleteOnly?: boolean;
  reviewDue?: boolean;
}

export interface DmsDashboardMetrics {
  total: number;
  draft: number;
  underReview: number;
  effective: number;
  obsolete: number;
  reviewDue: number;
  trainingPending: number;
  recentRevisions: number;
}

export function isDmsReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canCreateDocument(role: string): boolean {
  return !isDmsReadOnly(role);
}

export function canReviewDocument(role: string): boolean {
  return ['super_admin', 'admin', 'qa_manager', 'qa_executive', 'head_qa',
    'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

export function canApproveDocument(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}

export function canOnlyViewEffective(role: string): boolean {
  return role === 'viewer';
}

export function isDocumentEditable(status: string): boolean {
  return ['draft', 'returned_for_correction'].includes(status);
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isReviewDue(nextReviewDate: string | null, daysAhead = 30): boolean {
  if (!nextReviewDate) return false;
  const due = new Date(nextReviewDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysAhead);
  return due <= threshold;
}
