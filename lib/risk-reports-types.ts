export const REPORTS_MODULE = 'Risk Reports & Analytics';
export const RISK_REPORTS_COLLECTION = 'risk_reports';

export const RISK_REPORT_TYPES = [
  'Risk Register Report',
  'Open Risk Report',
  'Closed Risk Report',
  'Critical Risk Report',
  'Residual Risk Report',
  'FMEA Report',
  'Risk Mitigation Report',
  'Overdue Risk Report',
  'Department-wise Risk Report',
  'Product-wise Risk Report',
  'Regulatory Risk Report',
  'CSV/Data Integrity Risk Report',
  'Patient Safety Risk Report',
  'Risk Trend Report',
  'Management Review Report',
] as const;

export type RiskReportType = typeof RISK_REPORT_TYPES[number];

export interface RiskReportActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

function roleKey(role?: string | null): string {
  return (role || '').toLowerCase().replace(/\s+/g, '_');
}

export function canGenerateRiskReportsModule(role?: string | null): boolean {
  const r = roleKey(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager'].includes(r);
}

export function canExportRiskReportsModule(role?: string | null): boolean {
  return canGenerateRiskReportsModule(role);
}

export function canViewRegulatoryRiskReportsModule(role?: string | null): boolean {
  const r = roleKey(role);
  return canGenerateRiskReportsModule(r) || ['regulatory_affairs', 'regulatory'].includes(r);
}

export function canViewCsvRiskReportsModule(role?: string | null): boolean {
  const r = roleKey(role);
  return canGenerateRiskReportsModule(r) || ['csv_manager', 'it_admin', 'validation_manager'].includes(r);
}

export function canViewManagementReviewModule(role?: string | null): boolean {
  const r = roleKey(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'risk_manager'].includes(r);
}

export function isRiskReportsReadOnlyModule(role?: string | null): boolean {
  return roleKey(role) === 'auditor';
}

export function canGenerateRiskReportTypeModule(
  role: string | undefined | null,
  reportType: RiskReportType,
): boolean {
  if (isRiskReportsReadOnlyModule(role)) return false;
  if (reportType === 'Management Review Report') return canViewManagementReviewModule(role);
  if (reportType === 'Regulatory Risk Report') return canViewRegulatoryRiskReportsModule(role);
  if (reportType === 'CSV/Data Integrity Risk Report') return canViewCsvRiskReportsModule(role);
  return canGenerateRiskReportsModule(role);
}

export function canExportRiskReportTypeModule(
  role: string | undefined | null,
  reportType: RiskReportType,
): boolean {
  return canGenerateRiskReportTypeModule(role, reportType);
}

export function canViewRiskReportsModule(role?: string | null): boolean {
  return canGenerateRiskReportsModule(role)
    || canViewRegulatoryRiskReportsModule(role)
    || canViewCsvRiskReportsModule(role)
    || isRiskReportsReadOnlyModule(role);
}
