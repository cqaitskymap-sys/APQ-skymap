import { normalizeRole } from '@/lib/permissions';
import type { RiskLevel } from '@/lib/cpv';
import {
  buildRiskAssessmentHeatMap,
  buildRiskAssessmentMatrix,
  calculateRiskAssessment,
  isOverdue,
  type RiskAssessmentRecord,
} from '@/lib/cpv-risk-assessment-records';
import {
  estimateResidualRpn,
  getMitigationStatus,
  inferRiskDepartment,
  isCsvDataIntegrityRisk,
  isRegulatoryRisk,
} from '@/lib/risk-reports-records';
import { RISK_CREATE_CATEGORIES } from '@/lib/risk-create-records';

export const RISK_DASHBOARD_MODULE = 'Risk Assessment Dashboard';

export const RISK_DASHBOARD_CATEGORIES = RISK_CREATE_CATEGORIES;

export type RiskDashboardKpiFilter =
  | 'all'
  | 'open'
  | 'closed'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'pending_mitigation'
  | 'mitigation_in_progress'
  | 'overdue'
  | 'residual_high'
  | 'approved'
  | 'rejected'
  | 'under_review';

export interface RiskDashboardFilters {
  department: string;
  product: string;
  risk_category: string;
  risk_level: string;
  date_from: string;
  date_to: string;
  kpi_filter: RiskDashboardKpiFilter;
}

export interface RiskDashboardMetrics {
  totalRisks: number;
  openRisks: number;
  closedRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  pendingMitigation: number;
  mitigationInProgress: number;
  overdueRisks: number;
  residualHighRisks: number;
  approvedRisks: number;
  rejectedRisks: number;
  risksUnderReview: number;
}

export interface RiskDashboardChartData {
  riskLevelDistribution: { name: string; count: number }[];
  monthlyRiskTrend: { name: string; count: number }[];
  riskCategoryTrend: { name: string; count: number }[];
  departmentRiskTrend: { name: string; count: number }[];
  openVsClosed: { name: string; open: number; closed: number }[];
  residualRiskTrend: { name: string; count: number }[];
  mitigationStatusTrend: { name: string; pending: number; in_progress: number; completed: number }[];
  criticalRiskTrend: { name: string; count: number }[];
  riskClosureTrend: { name: string; closed: number; open: number }[];
}

export interface RiskDashboardTableRow {
  id: string;
  risk_number: string;
  risk_title: string;
  risk_category: string;
  department: string;
  risk_level: string;
  rpn: number;
  residual_rpn: number;
  risk_owner: string;
  status: string;
  mitigation_status: string;
  target_date: string;
  days_overdue: number;
  initial_rpn: number;
}

export interface RiskDashboardWidgetData {
  top10Critical: RiskDashboardTableRow[];
  heatMap: ReturnType<typeof buildRiskAssessmentHeatMap>;
  matrix: ReturnType<typeof buildRiskAssessmentMatrix>;
  departmentRanking: { name: string; count: number; critical: number }[];
  pendingMitigationTasks: { risk_number: string; title: string; owner: string; due_date: string; status: string }[];
  upcomingReviews: { risk_number: string; review_date: string; reviewer: string; status: string }[];
}

export interface RiskDashboardActivityEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
  recordId?: string;
}

export interface RiskDashboardData {
  metrics: RiskDashboardMetrics;
  charts: RiskDashboardChartData;
  recentRisks: RiskDashboardTableRow[];
  criticalRisks: RiskDashboardTableRow[];
  overdueRisks: RiskDashboardTableRow[];
  residualHighRisks: RiskDashboardTableRow[];
  widgets: RiskDashboardWidgetData;
  activity: RiskDashboardActivityEntry[];
  departments: string[];
  products: string[];
  filteredCount: number;
}

export function getSafeRpn(r: RiskAssessmentRecord): number {
  const n = Number(r.rpnScore);
  if (Number.isFinite(n) && n > 0) return n;
  const calc = calculateRiskAssessment(
    Number(r.severityScore) || 1,
    Number(r.occurrenceScore) || 1,
    Number(r.detectionScore) || 1,
  );
  return calc.rpnScore;
}

export function riskLevelFromRpn(rpn: number): RiskLevel {
  if (rpn > 200) return 'Critical';
  if (rpn >= 101) return 'High';
  if (rpn >= 51) return 'Medium';
  return 'Low';
}

export function getRiskDepartment(r: RiskAssessmentRecord): string {
  const dept = (r as Record<string, unknown>).department;
  if (typeof dept === 'string' && dept.trim()) return dept.trim();
  return inferRiskDepartment(r);
}

export function getRiskTitle(r: RiskAssessmentRecord): string {
  const title = (r as Record<string, unknown>).riskTitle;
  if (typeof title === 'string' && title.trim()) return title.trim();
  if (r.parameterName?.trim()) return r.parameterName;
  return (r.riskDescription || 'Risk').slice(0, 80);
}

export function getResidualRpn(r: RiskAssessmentRecord): number {
  const residual = (r as Record<string, unknown>).residualRpn;
  if (typeof residual === 'number' && Number.isFinite(residual) && residual > 0) return residual;
  const residualSnake = (r as Record<string, unknown>).residual_rpn;
  if (typeof residualSnake === 'number' && Number.isFinite(residualSnake) && residualSnake > 0) return residualSnake;
  return estimateResidualRpn(r);
}

export function isOpenRisk(r: RiskAssessmentRecord): boolean {
  return !['Closed', 'Rejected'].includes(r.riskStatus);
}

export function isClosedRisk(r: RiskAssessmentRecord): boolean {
  return ['Closed', 'Accepted'].includes(r.riskStatus);
}

export function toDashboardRow(r: RiskAssessmentRecord): RiskDashboardTableRow {
  const rpn = getSafeRpn(r);
  const due = r.targetCompletionDate || '';
  let daysOverdue = 0;
  if (due && isOverdue(r)) {
    const diff = Date.now() - new Date(`${due}T23:59:59`).getTime();
    daysOverdue = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  return {
    id: r.id,
    risk_number: r.riskNumber || '—',
    risk_title: getRiskTitle(r),
    risk_category: r.riskCategory || 'Other',
    department: getRiskDepartment(r),
    risk_level: riskLevelFromRpn(rpn),
    rpn,
    residual_rpn: getResidualRpn(r),
    risk_owner: r.riskOwner || '—',
    status: r.riskStatus || 'Draft',
    mitigation_status: getMitigationStatus(r),
    target_date: due || '—',
    days_overdue: daysOverdue,
    initial_rpn: rpn,
  };
}

function inDateRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!dateStr) return !from && !to;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(`${to}T23:59:59`)) return false;
  return true;
}

export function applyKpiFilter(records: RiskAssessmentRecord[], filter: RiskDashboardKpiFilter): RiskAssessmentRecord[] {
  switch (filter) {
    case 'open': return records.filter(isOpenRisk);
    case 'closed': return records.filter(isClosedRisk);
    case 'critical': return records.filter((r) => getSafeRpn(r) > 200);
    case 'high': return records.filter((r) => { const rpn = getSafeRpn(r); return rpn >= 101 && rpn <= 200; });
    case 'medium': return records.filter((r) => { const rpn = getSafeRpn(r); return rpn >= 51 && rpn <= 100; });
    case 'low': return records.filter((r) => getSafeRpn(r) <= 50);
    case 'pending_mitigation': return records.filter((r) => getMitigationStatus(r) === 'Pending');
    case 'mitigation_in_progress': return records.filter((r) => getMitigationStatus(r) === 'In Progress' || r.riskStatus === 'Mitigation In Progress');
    case 'overdue': return records.filter(isOverdue);
    case 'residual_high': return records.filter((r) => getResidualRpn(r) >= 101);
    case 'approved': return records.filter((r) => r.riskStatus === 'Approved');
    case 'rejected': return records.filter((r) => r.riskStatus === 'Rejected');
    case 'under_review': return records.filter((r) => r.riskStatus === 'Under Review' || r.workflowStatus === 'Review');
    default: return records;
  }
}

export function applyDashboardFilters(
  records: RiskAssessmentRecord[],
  filters: RiskDashboardFilters,
): RiskAssessmentRecord[] {
  let results = records.filter((r) => !r.isDeleted);
  results = applyKpiFilter(results, filters.kpi_filter);

  if (filters.department && filters.department !== 'All') {
    results = results.filter((r) => getRiskDepartment(r) === filters.department);
  }
  if (filters.product && filters.product !== 'All') {
    results = results.filter((r) => r.productName === filters.product);
  }
  if (filters.risk_category && filters.risk_category !== 'All') {
    results = results.filter((r) => r.riskCategory === filters.risk_category);
  }
  if (filters.risk_level && filters.risk_level !== 'All') {
    results = results.filter((r) => riskLevelFromRpn(getSafeRpn(r)) === filters.risk_level);
  }
  if (filters.date_from || filters.date_to) {
    results = results.filter((r) => inDateRange(r.createdAt || r.updatedAt, filters.date_from, filters.date_to));
  }
  return results;
}

export function filterRecordsForRole(
  records: RiskAssessmentRecord[],
  role?: string,
  actorDepartment?: string,
): RiskAssessmentRecord[] {
  const raw = (role || '').toLowerCase();
  if (raw === 'department_head' && actorDepartment?.trim()) {
    const dept = actorDepartment.trim().toLowerCase();
    return records.filter((r) => getRiskDepartment(r).toLowerCase() === dept);
  }
  if (raw === 'regulatory_affairs' || raw === 'regulatory') {
    return records.filter(isRegulatoryRisk);
  }
  if (raw.includes('csv')) {
    return records.filter(isCsvDataIntegrityRisk);
  }
  return records;
}

export function computeDashboardMetrics(records: RiskAssessmentRecord[]): RiskDashboardMetrics {
  return {
    totalRisks: records.length,
    openRisks: records.filter(isOpenRisk).length,
    closedRisks: records.filter(isClosedRisk).length,
    criticalRisks: records.filter((r) => getSafeRpn(r) > 200).length,
    highRisks: records.filter((r) => { const rpn = getSafeRpn(r); return rpn >= 101 && rpn <= 200; }).length,
    mediumRisks: records.filter((r) => { const rpn = getSafeRpn(r); return rpn >= 51 && rpn <= 100; }).length,
    lowRisks: records.filter((r) => getSafeRpn(r) <= 50).length,
    pendingMitigation: records.filter((r) => getMitigationStatus(r) === 'Pending').length,
    mitigationInProgress: records.filter((r) =>
      getMitigationStatus(r) === 'In Progress' || r.riskStatus === 'Mitigation In Progress',
    ).length,
    overdueRisks: records.filter(isOverdue).length,
    residualHighRisks: records.filter((r) => getResidualRpn(r) >= 101).length,
    approvedRisks: records.filter((r) => r.riskStatus === 'Approved').length,
    rejectedRisks: records.filter((r) => r.riskStatus === 'Rejected').length,
    risksUnderReview: records.filter((r) => r.riskStatus === 'Under Review').length,
  };
}

function countBy(records: RiskAssessmentRecord[], keyFn: (r: RiskAssessmentRecord) => string, limit = 12) {
  const map = new Map<string, number>();
  records.forEach((r) => {
    const k = keyFn(r) || 'Unknown';
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function monthlyCount(records: RiskAssessmentRecord[], predicate?: (r: RiskAssessmentRecord) => boolean) {
  const map = new Map<string, number>();
  records.forEach((r) => {
    if (predicate && !predicate(r)) return;
    const month = (r.createdAt || '').slice(0, 7);
    if (!month) return;
    map.set(month, (map.get(month) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDashboardCharts(records: RiskAssessmentRecord[]): RiskDashboardChartData {
  const metrics = computeDashboardMetrics(records);
  const mitigationByMonth = new Map<string, { pending: number; in_progress: number; completed: number }>();
  records.forEach((r) => {
    const month = (r.createdAt || '').slice(0, 7);
    if (!month) return;
    const cur = mitigationByMonth.get(month) || { pending: 0, in_progress: 0, completed: 0 };
    const st = getMitigationStatus(r);
    if (st === 'Completed') cur.completed++;
    else if (st === 'In Progress') cur.in_progress++;
    else cur.pending++;
    mitigationByMonth.set(month, cur);
  });

  return {
    riskLevelDistribution: [
      { name: 'Low', count: metrics.lowRisks },
      { name: 'Medium', count: metrics.mediumRisks },
      { name: 'High', count: metrics.highRisks },
      { name: 'Critical', count: metrics.criticalRisks },
    ],
    monthlyRiskTrend: monthlyCount(records),
    riskCategoryTrend: countBy(records, (r) => r.riskCategory),
    departmentRiskTrend: countBy(records, getRiskDepartment),
    openVsClosed: monthlyCount(records).map((m) => {
      const monthRecords = records.filter((r) => (r.createdAt || '').startsWith(m.name));
      return {
        name: m.name,
        open: monthRecords.filter(isOpenRisk).length,
        closed: monthRecords.filter(isClosedRisk).length,
      };
    }),
    residualRiskTrend: monthlyCount(records, (r) => getResidualRpn(r) < getSafeRpn(r)),
    mitigationStatusTrend: Array.from(mitigationByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name, ...v })),
    criticalRiskTrend: monthlyCount(records, (r) => getSafeRpn(r) > 200),
    riskClosureTrend: monthlyCount(records).map((m) => {
      const monthRecords = records.filter((r) => (r.createdAt || '').startsWith(m.name));
      return {
        name: m.name,
        closed: monthRecords.filter(isClosedRisk).length,
        open: monthRecords.filter(isOpenRisk).length,
      };
    }),
  };
}

export function buildDashboardWidgets(records: RiskAssessmentRecord[]): RiskDashboardWidgetData {
  const rows = records.map(toDashboardRow);
  const deptMap = new Map<string, { count: number; critical: number }>();
  records.forEach((r) => {
    const dept = getRiskDepartment(r);
    const cur = deptMap.get(dept) || { count: 0, critical: 0 };
    cur.count++;
    if (getSafeRpn(r) > 200) cur.critical++;
    deptMap.set(dept, cur);
  });

  return {
    top10Critical: [...rows].filter((r) => r.rpn > 200).sort((a, b) => b.rpn - a.rpn).slice(0, 10),
    heatMap: buildRiskAssessmentHeatMap(records),
    matrix: buildRiskAssessmentMatrix(records),
    departmentRanking: Array.from(deptMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    pendingMitigationTasks: rows
      .filter((r) => r.mitigation_status === 'Pending')
      .slice(0, 10)
      .map((r) => ({
        risk_number: r.risk_number,
        title: r.risk_title,
        owner: r.risk_owner,
        due_date: r.target_date,
        status: r.mitigation_status,
      })),
    upcomingReviews: [],
  };
}

export function canViewRiskDashboard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['auditor', 'viewer'].includes(r)) return true;
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'qc_manager', 'production_manager', 'engineering_manager', 'regulatory_affairs',
  ].includes(r)
    || raw.includes('risk_manager')
    || raw === 'department_head'
    || raw.includes('csv');
}

export function canExportRiskDashboard(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)
    || raw.includes('risk_manager');
}

export function canCreateFromDashboard(role?: string | null): boolean {
  const raw = (role || '').toLowerCase();
  if (['auditor', 'viewer'].includes(normalizeRole(role || ''))) return false;
  return canViewRiskDashboard(role) && !raw.includes('auditor');
}

export function isRiskDashboardReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function riskLevelBadgeClass(level: string): string {
  const map: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-amber-100 text-amber-800 border-amber-300',
    Low: 'bg-green-100 text-green-800 border-green-300',
  };
  return map[level] || map.Low;
}

export function riskStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-700',
    Open: 'bg-blue-100 text-blue-800',
    'Under Review': 'bg-amber-100 text-amber-800',
    'Mitigation In Progress': 'bg-orange-100 text-orange-800',
    'Pending Approval': 'bg-purple-100 text-purple-800',
    Approved: 'bg-green-100 text-green-800',
    Closed: 'bg-emerald-100 text-emerald-800',
    Rejected: 'bg-red-100 text-red-800',
    Overdue: 'bg-red-100 text-red-800',
    Accepted: 'bg-green-100 text-green-800',
  };
  return map[status] || map.Draft;
}
