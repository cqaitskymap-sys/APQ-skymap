export const RECALL_COLLECTIONS = {
  records: 'recalls',
  distribution: 'recall_distribution',
  recovery: 'recall_recovery',
  attachments: 'recall_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  complaints: 'complaints',
} as const;

export const RECALL_TYPES = ['Voluntary', 'Regulatory Directed', 'Mock Recall'] as const;
export const RECALL_CLASSIFICATIONS = ['Class I', 'Class II', 'Class III', 'Mock'] as const;

export const RECALL_STATUSES = [
  'draft', 'initiated', 'in_progress', 'regulatory_notified',
  'recovery_in_progress', 'completed', 'closed',
] as const;

export type RecallType = typeof RECALL_TYPES[number];
export type RecallClassification = typeof RECALL_CLASSIFICATIONS[number];
export type RecallStatus = typeof RECALL_STATUSES[number];

export interface RecallActor {
  id: string;
  name: string;
  role: string;
}

export interface RecallRecord {
  id: string;
  recall_number: string;
  recall_date: string;
  recall_type: RecallType | string;
  recall_classification: RecallClassification | string;
  product_name: string;
  batch_number: string;
  market_region: string;
  reason_for_recall: string;
  recall_initiated_by: string;
  recall_initiated_by_name: string;
  regulatory_notification_required: boolean;
  regulatory_notified: boolean;
  stock_quantity: number;
  distributed_quantity: number;
  recovered_quantity: number;
  recovery_percent: number;
  impact_assessment: string;
  risk_assessment: string;
  capa_required: boolean;
  linked_capa_id: string | null;
  linked_capa_number: string | null;
  linked_complaint_id: string | null;
  linked_complaint_number: string | null;
  linked_deviation_id: string | null;
  linked_oos_id: string | null;
  recall_status: RecallStatus | string;
  qa_remarks: string;
  batch_id: string | null;
  pqr_id: string | null;
  head_qa_approved: boolean;
  regulatory_approved: boolean;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface RecallDistribution {
  id: string;
  recall_id: string;
  customer_name: string;
  market_region: string;
  quantity_distributed: number;
  distribution_date: string;
  contact_details: string;
  created_at: string;
  updated_at: string;
}

export interface RecallRecovery {
  id: string;
  recall_id: string;
  recovery_date: string;
  quantity_recovered: number;
  recovered_from: string;
  recovery_status: string;
  remarks: string;
  recorded_by: string;
  recorded_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface RecallAttachment {
  id: string;
  recall_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface RecallFilters {
  recall_type?: string;
  recall_classification?: string;
  recall_status?: string;
  product?: string;
  batch_number?: string;
  market_region?: string;
  search?: string;
}

export interface RecallDashboardMetrics {
  total: number;
  open: number;
  closed: number;
  mockRecalls: number;
  avgRecoveryPercent: number;
  regulatoryPending: number;
}

export function isRecallClosed(status: string): boolean {
  return ['closed', 'completed'].includes(status);
}

export function requiresClassIApproval(classification: string): boolean {
  return classification === 'Class I';
}

export function calcRecoveryPercent(distributed: number, recovered: number): number {
  if (!distributed || distributed <= 0) return 0;
  return Math.round((recovered / distributed) * 10000) / 100;
}

export function isRecallReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canCreateRecall(role: string): boolean {
  return !['auditor', 'viewer'].includes(role);
}

export function canApproveRecall(role: string): boolean {
  return ['super_admin', 'admin', 'qa', 'qa_manager', 'head_qa', 'regulatory_affairs'].includes(role);
}
