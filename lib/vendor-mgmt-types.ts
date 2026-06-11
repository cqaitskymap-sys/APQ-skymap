export const VENDOR_COLLECTIONS = {
  vendors: 'vendors',
  avl: 'approved_vendor_list',
  qualifications: 'vendor_qualifications',
  supplierAudits: 'supplier_audits',
  agreements: 'technical_agreements',
  performance: 'vendor_performance',
  attachments: 'vendor_attachments',
  reviews: 'vendor_reviews',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  capa: 'capa_records',
} as const;

export const VENDOR_TYPES = [
  'API Manufacturer', 'API Supplier', 'Raw Material Manufacturer', 'Raw Material Supplier',
  'Packing Material Manufacturer', 'Packing Material Supplier', 'Service Provider',
  'Contract Manufacturer', 'Contract Testing Lab', 'Equipment Supplier', 'Calibration Agency',
  'Transporter', 'Other',
] as const;

export const APPROVAL_STATUSES = [
  'Not Qualified', 'Under Qualification', 'Approved', 'Conditionally Approved',
  'Rejected', 'Blocked', 'Expired',
] as const;

export const RISK_CATEGORIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const VENDOR_STATUSES = ['Active', 'Inactive', 'Blocked'] as const;

export const QUALIFICATION_TYPES = [
  'New Vendor', 'Requalification', 'Periodic Review', 'Emergency Approval', 'Alternate Vendor',
] as const;

export const QUALIFICATION_DECISIONS = [
  'Approved', 'Conditionally Approved', 'Rejected', 'More Information Required',
] as const;

export const SUPPLIER_AUDIT_TYPES = [
  'On-site Audit', 'Remote Audit', 'Desktop Audit', 'Questionnaire Audit', 'Follow-up Audit',
] as const;

export const AUDIT_RATINGS = ['Excellent', 'Satisfactory', 'Conditional', 'Unsatisfactory'] as const;

export const AGREEMENT_TYPES = [
  'Quality Agreement', 'Technical Agreement', 'Service Agreement', 'Supply Agreement',
  'Contract Manufacturing Agreement', 'Contract Testing Agreement',
] as const;

export const AGREEMENT_STATUSES = ['Draft', 'Under Review', 'Approved', 'Effective', 'Expired', 'Obsolete'] as const;

export const PERFORMANCE_RATINGS = ['Excellent', 'Good', 'Conditional', 'Unsatisfactory'] as const;

export type VendorType = typeof VENDOR_TYPES[number];
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];
export type RiskCategory = typeof RISK_CATEGORIES[number];

export interface VendorActor {
  id: string;
  name: string;
  role: string;
}

export interface VendorRecord {
  id: string;
  vendor_code: string;
  vendor_name: string;
  vendor_type: VendorType | string;
  material_service_supplied: string;
  manufacturer_name: string;
  supplier_name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contact_person: string;
  email: string;
  phone: string;
  gst_tax_no: string;
  license_no: string;
  approval_status: ApprovalStatus | string;
  risk_category: RiskCategory | string;
  vendor_status: string;
  remarks: string;
  next_audit_due: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AvlRecord {
  id: string;
  avl_number: string;
  vendor_id: string;
  vendor_name: string;
  material_service: string;
  approval_date: string;
  approval_expiry_date: string;
  approved_by: string;
  approved_by_name: string;
  qualification_ref: string;
  audit_required: boolean;
  audit_frequency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VendorQualification {
  id: string;
  qualification_number: string;
  vendor_id: string;
  vendor_name: string;
  vendor_type: string;
  qualification_type: string;
  material_service: string;
  questionnaire_sent_date: string | null;
  questionnaire_received_date: string | null;
  document_review_status: string;
  sample_evaluation_required: boolean;
  sample_evaluation_status: string;
  audit_required: boolean;
  audit_date: string | null;
  audit_status: string;
  risk_assessment_score: number;
  qualification_decision: string;
  approved_by: string;
  approved_by_name: string;
  approval_date: string | null;
  next_review_date: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierAuditRecord {
  id: string;
  audit_number: string;
  vendor_id: string;
  vendor_name: string;
  audit_type: string;
  audit_date: string;
  audit_scope: string;
  lead_auditor: string;
  audit_team: string;
  audit_status: string;
  findings_count: number;
  critical_findings: number;
  major_findings: number;
  minor_findings: number;
  capa_required: boolean;
  capa_status: string;
  final_audit_rating: string;
  created_at: string;
  updated_at: string;
}

export interface TechnicalAgreement {
  id: string;
  agreement_number: string;
  vendor_id: string;
  vendor_name: string;
  agreement_type: string;
  material_service: string;
  effective_date: string;
  expiry_date: string;
  agreement_status: string;
  responsible_department: string;
  uploaded_agreement_url: string;
  review_due_date: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface VendorPerformance {
  id: string;
  vendor_id: string;
  vendor_name: string;
  review_period: string;
  material_service: string;
  total_lots_received: number;
  approved_lots: number;
  rejected_lots: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  complaints: number;
  deviations: number;
  oos_linked: number;
  capa_linked: number;
  audit_findings: number;
  approval_percent: number;
  rejection_percent: number;
  on_time_percent: number;
  complaint_rate: number;
  performance_score: number;
  performance_rating: string;
  risk_level: string;
  recommendation: string;
  created_at: string;
}

export interface VendorAttachment {
  id: string;
  vendor_id: string;
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

export interface VendorFilters {
  approval_status?: string;
  vendor_type?: string;
  risk_category?: string;
  vendor_status?: string;
  search?: string;
}

export interface VendorDashboardMetrics {
  total: number;
  approved: number;
  underQualification: number;
  blocked: number;
  expired: number;
  highRisk: number;
  auditDue: number;
  agreementExpired: number;
  conditional: number;
}

export function calcPerformanceScore(p: {
  total_lots_received: number; approved_lots: number; rejected_lots: number;
  on_time_deliveries: number; delayed_deliveries: number; complaints: number;
}): { approval_percent: number; rejection_percent: number; on_time_percent: number; complaint_rate: number; performance_score: number; performance_rating: string } {
  const total = p.total_lots_received || 1;
  const approval_percent = Math.round((p.approved_lots / total) * 100);
  const rejection_percent = Math.round((p.rejected_lots / total) * 100);
  const deliveries = p.on_time_deliveries + p.delayed_deliveries || 1;
  const on_time_percent = Math.round((p.on_time_deliveries / deliveries) * 100);
  const complaint_rate = Math.round((p.complaints / total) * 100);
  const performance_score = Math.round(
    approval_percent * 0.4 + on_time_percent * 0.3 + (100 - rejection_percent) * 0.2 + (100 - complaint_rate) * 0.1,
  );
  let performance_rating = 'Unsatisfactory';
  if (performance_score >= 90) performance_rating = 'Excellent';
  else if (performance_score >= 75) performance_rating = 'Good';
  else if (performance_score >= 60) performance_rating = 'Conditional';
  return { approval_percent, rejection_percent, on_time_percent, complaint_rate, performance_score, performance_rating };
}

export function isVendorUsable(v: Pick<VendorRecord, 'approval_status' | 'vendor_status'>): boolean {
  return !['Blocked', 'Rejected', 'Expired', 'Not Qualified'].includes(v.approval_status)
    && v.vendor_status !== 'Blocked';
}

export function isVendorReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageVendors(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive'].includes(role);
}

export function canApproveVendor(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(role);
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}
