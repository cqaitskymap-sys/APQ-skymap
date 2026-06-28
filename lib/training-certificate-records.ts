import {
  type TrainingCertificateRecord, type CertificateFilters,
  type CertificateDashboardKpis, type CertificateDashboardCharts,
  type CertificateDashboardData, type CertificateVerificationLog,
  computeCertificateStatus,
} from './training-certificate-types';
import { normalizeRole } from '@/lib/permissions';
import {
  canManageCertificates, canApproveCertificates, isEmployeeCertificateView,
} from './training-certificate-types';

export function filterCertificatesByRole(
  certs: TrainingCertificateRecord[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingCertificateRecord[] {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa', 'auditor', 'viewer', 'training_coordinator'].includes(r)) {
    return certs;
  }
  if (isEmployeeCertificateView(r) && userId) {
    return certs.filter((c) => c.employee_id === userId);
  }
  if (userDepartment) {
    const dept = userDepartment.toLowerCase();
    return certs.filter((c) => c.department?.toLowerCase() === dept);
  }
  if (userId) return certs.filter((c) => c.employee_id === userId);
  return certs;
}

export function applyCertificateFilters(
  certs: TrainingCertificateRecord[],
  filters: CertificateFilters,
): TrainingCertificateRecord[] {
  const q = filters.search?.toLowerCase() || '';
  return certs.filter((c) => {
    const matchSearch = !q
      || c.certificate_number.toLowerCase().includes(q)
      || c.employee_name.toLowerCase().includes(q)
      || c.training_topic.toLowerCase().includes(q)
      || c.verification_code.toLowerCase().includes(q);
    const matchDept = !filters.department || c.department === filters.department;
    const matchEmp = !filters.employee_id || c.employee_id === filters.employee_id;
    const matchType = !filters.training_type || c.training_type === filters.training_type;
    const matchStatus = !filters.certificate_status || filters.certificate_status === 'all'
      || c.certificate_status === filters.certificate_status;
    const matchApproval = !filters.approval_status || filters.approval_status === 'all'
      || c.approval_status === filters.approval_status;
    const matchTrainer = !filters.trainer || c.trainer === filters.trainer;
    const matchIssueFrom = !filters.issue_date_from || c.issue_date >= filters.issue_date_from;
    const matchIssueTo = !filters.issue_date_to || c.issue_date <= filters.issue_date_to;
    const matchExpFrom = !filters.expiry_date_from || c.expiry_date >= filters.expiry_date_from;
    const matchExpTo = !filters.expiry_date_to || c.expiry_date <= filters.expiry_date_to;
    return matchSearch && matchDept && matchEmp && matchType && matchStatus
      && matchApproval && matchTrainer && matchIssueFrom && matchIssueTo && matchExpFrom && matchExpTo;
  });
}

export function computeCertificateDashboard(
  certs: TrainingCertificateRecord[],
  verificationLog: CertificateVerificationLog[],
): CertificateDashboardData {
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStart = todayStr.slice(0, 7);

  const active = certs.filter((c) => ['Active', 'Issued', 'Renewed'].includes(String(c.certificate_status)));
  const expiring = certs.filter((c) => c.certificate_status === 'Expiring Soon'
    || (c.expiry_date && c.expiry_date >= todayStr && computeCertificateStatus(c.expiry_date) === 'Expiring Soon'));
  const expired = certs.filter((c) => c.certificate_status === 'Expired');
  const renewed = certs.filter((c) => c.certificate_status === 'Renewed');
  const revoked = certs.filter((c) => c.certificate_status === 'Revoked');
  const pending = certs.filter((c) => c.approval_status === 'Pending');
  const issuedMonth = certs.filter((c) => c.issue_date?.startsWith(monthStart));
  const renewalQueue = certs.filter((c) =>
    c.renewal_required && (c.certificate_status === 'Expiring Soon' || c.certificate_status === 'Expired'),
  );

  const compliance = certs.length > 0
    ? Math.round((active.length / certs.length) * 100) : 100;

  const issueTrend: Record<string, number> = {};
  const expiryTrend: Record<string, number> = {};
  const deptMap: Record<string, number> = {};
  const typeMap: Record<string, number> = {};
  const renewalTrend: Record<string, number> = {};

  certs.forEach((c) => {
    if (c.issue_date) issueTrend[c.issue_date.slice(0, 7)] = (issueTrend[c.issue_date.slice(0, 7)] || 0) + 1;
    if (c.expiry_date) expiryTrend[c.expiry_date.slice(0, 7)] = (expiryTrend[c.expiry_date.slice(0, 7)] || 0) + 1;
    deptMap[c.department] = (deptMap[c.department] || 0) + 1;
    typeMap[c.training_type] = (typeMap[c.training_type] || 0) + 1;
    if (c.certificate_status === 'Renewed' && c.updated_at) {
      renewalTrend[c.updated_at.slice(0, 7)] = (renewalTrend[c.updated_at.slice(0, 7)] || 0) + 1;
    }
  });

  const last6: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6.push(d.toISOString().slice(0, 7));
  }

  const kpis: CertificateDashboardKpis = {
    totalCertificates: certs.length,
    activeCertificates: active.length,
    expiringSoon: expiring.length,
    expired: expired.length,
    renewed: renewed.length,
    revoked: revoked.length,
    pendingApproval: pending.length,
    issuedThisMonth: issuedMonth.length,
    renewalsDue: renewalQueue.length,
    compliancePercent: compliance,
  };

  const charts: CertificateDashboardCharts = {
    issueTrend: Object.entries(issueTrend).sort().map(([month, count]) => ({ month, count })),
    expiryTrend: Object.entries(expiryTrend).sort().map(([month, count]) => ({ month, count })),
    departmentCertificates: Object.entries(deptMap).map(([name, value]) => ({ name, value })),
    trainingTypeDistribution: Object.entries(typeMap).map(([name, value]) => ({ name, value })),
    renewalTrend: Object.entries(renewalTrend).sort().map(([month, count]) => ({ month, count })),
    complianceTrend: last6.map((month) => ({
      month: month.slice(5),
      percent: certs.filter((c) => c.issue_date?.slice(0, 7) <= month
        && (!c.expiry_date || c.expiry_date >= `${month}-28`)).length > 0
        ? Math.round((certs.filter((c) => ['Active', 'Issued', 'Renewed'].includes(String(c.certificate_status))
          && c.issue_date?.slice(0, 7) <= month).length / Math.max(1, certs.filter((c) => c.issue_date?.slice(0, 7) <= month).length)) * 100)
        : compliance,
    })),
  };

  return {
    kpis,
    charts,
    certificates: certs,
    recent: [...certs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20),
    expiring,
    expired,
    renewalQueue,
    pendingApproval: pending,
    verificationLog: verificationLog.slice(0, 50),
  };
}

export {
  canManageCertificates, canApproveCertificates, isEmployeeCertificateView,
};
