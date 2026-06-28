export const TRAINING_CERTIFICATE_MODULE = 'Training Certificate Management';

export const CERTIFICATE_STATUSES = [
  'Draft', 'Issued', 'Active', 'Expiring Soon', 'Expired', 'Renewed', 'Cancelled', 'Revoked',
] as const;

export const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;

export const CERTIFICATE_COLLECTION = 'training_certificates';

export type CertificateStatus = typeof CERTIFICATE_STATUSES[number];
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];

export interface TrainingCertificateRecord {
  id: string;
  certificate_id: string;
  certificate_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  training_record_id: string;
  training_topic: string;
  training_type: string;
  document_number: string;
  document_version: string;
  sop_number: string;
  trainer: string;
  assessment_score: number | null;
  result: string;
  competency_level: string;
  issue_date: string;
  effective_date: string;
  expiry_date: string;
  renewal_required: boolean;
  renewal_due_date: string | null;
  certificate_status: CertificateStatus | string;
  approval_status: ApprovalStatus | string;
  approved_by: string | null;
  approved_date: string | null;
  digital_signature: string | null;
  certificate_version: string;
  certificate_pdf_url: string | null;
  verification_code: string;
  qr_code_data: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  // LMS legacy fields (optional)
  connection_id?: string;
  external_id?: string;
  course_title?: string;
  imported_at?: string;
}

export interface CertificateFilters {
  department?: string;
  employee_id?: string;
  training_type?: string;
  certificate_status?: string;
  approval_status?: string;
  issue_date_from?: string;
  issue_date_to?: string;
  expiry_date_from?: string;
  expiry_date_to?: string;
  trainer?: string;
  search?: string;
}

export interface CertificateDashboardKpis {
  totalCertificates: number;
  activeCertificates: number;
  expiringSoon: number;
  expired: number;
  renewed: number;
  revoked: number;
  pendingApproval: number;
  issuedThisMonth: number;
  renewalsDue: number;
  compliancePercent: number;
}

export interface CertificateDashboardCharts {
  issueTrend: { month: string; count: number }[];
  expiryTrend: { month: string; count: number }[];
  departmentCertificates: { name: string; value: number }[];
  trainingTypeDistribution: { name: string; value: number }[];
  renewalTrend: { month: string; count: number }[];
  complianceTrend: { month: string; percent: number }[];
}

export interface CertificateVerificationLog {
  id: string;
  certificate_id: string;
  certificate_number: string;
  verification_code: string;
  verified_at: string;
  verified_by: string;
  result: 'Valid' | 'Invalid' | 'Expired';
}

export interface CertificateDashboardData {
  kpis: CertificateDashboardKpis;
  charts: CertificateDashboardCharts;
  certificates: TrainingCertificateRecord[];
  recent: TrainingCertificateRecord[];
  expiring: TrainingCertificateRecord[];
  expired: TrainingCertificateRecord[];
  renewalQueue: TrainingCertificateRecord[];
  pendingApproval: TrainingCertificateRecord[];
  verificationLog: CertificateVerificationLog[];
}

export interface CertificateActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  return `TCERT-${year}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

export function generateVerificationCode(certNumber: string): string {
  const hash = certNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return `VER-${Date.now().toString(36).toUpperCase()}-${(hash % 99999).toString().padStart(5, '0')}`;
}

export function generateQrPlaceholder(certNumber: string, verificationCode: string): string {
  return `TRAINING-CERT:${certNumber}:${verificationCode}`;
}

export function computeCertificateStatus(expiryDate: string, current?: string): CertificateStatus {
  if (current === 'Revoked' || current === 'Cancelled' || current === 'Draft') return current as CertificateStatus;
  const today = new Date().toISOString().slice(0, 10);
  if (!expiryDate) return 'Active';
  if (expiryDate < today) return 'Expired';
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  if (expiryDate <= thirtyDays.toISOString().slice(0, 10)) return 'Expiring Soon';
  if (current === 'Renewed') return 'Renewed';
  return current === 'Issued' ? 'Issued' : 'Active';
}

export function canManageCertificates(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator'].includes(r);
}

export function canApproveCertificates(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageCertificates(r) || ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function canIssueCertificates(role?: string | null): boolean {
  return canApproveCertificates(role);
}

export function canViewCertificates(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canApproveCertificates(r)
    || ['auditor', 'viewer'].includes(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)
    || ['employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function isCertificateReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isEmployeeCertificateView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['employee', 'production', 'qc', 'warehouse'].includes(r) && !canManageCertificates(r);
}

export function canDownloadCertificate(role?: string | null): boolean {
  return canViewCertificates(role);
}

export function certificateStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Issued: 'bg-blue-100 text-blue-800',
    Active: 'bg-green-100 text-green-800',
    'Expiring Soon': 'bg-amber-100 text-amber-800',
    Expired: 'bg-red-100 text-red-800',
    Renewed: 'bg-teal-100 text-teal-800',
    Cancelled: 'bg-slate-100 text-slate-600',
    Revoked: 'bg-red-100 text-red-800',
    Pending: 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };
  return map[status] || map.Draft;
}
