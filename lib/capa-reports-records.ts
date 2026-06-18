import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  applyCapaDashboardFilters,
  computeCapaChartData,
  computeExtendedCapaDashboardMetrics,
  getCapaDaysOverdue,
  isCapaOverdue,
  type CapaDashboardChartData,
} from '@/lib/capa-dashboard-records';
import {
  CAPA_DEPARTMENTS,
  CAPA_MANAGEMENT_REPORT_TYPES,
  CAPA_PRIORITIES,
  CAPA_REPORT_TYPES,
  CAPA_SOURCES,
  CAPA_STATUSES,
  EFFECTIVENESS_RESULTS,
  isCapaClosed,
  type CapaCorrectiveAction,
  type CapaManagementReviewSummary,
  type CapaPreventiveAction,
  type CapaRecord,
  type CapaReportAnalyticsMetrics,
  type CapaReportChartData,
  type CapaReportPreviewRow,
  type CapaReportRecord,
  type CapaReportType,
} from '@/lib/capa-types';

export {
  CAPA_REPORT_TYPES,
  CAPA_MANAGEMENT_REPORT_TYPES,
};

export const REPORTS_MODULE = 'CAPA Reports & Analytics';
export const CLOSURE_TARGET_DAYS = 45;

export type CapaReportActor = { id: string; name: string; role?: string };

export interface CapaReportFilterInput {
  report_type: CapaReportType;
  review_period_from: string;
  review_period_to: string;
  capa_number?: string;
  department?: string;
  product?: string;
  capa_source?: string;
  priority?: string;
  status?: string;
  effectiveness_result?: string;
  owner?: string;
  overdue_only?: boolean;
  critical_only?: boolean;
}

export interface CapaReportAnalyticsResult {
  metrics: CapaReportAnalyticsMetrics;
  charts: CapaReportChartData;
  previewRows: CapaReportPreviewRow[];
  summary: string;
  recommendations: string;
  managementReview: CapaManagementReviewSummary;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Date range is required');
const requiredType = z.enum(CAPA_REPORT_TYPES, { required_error: 'Report type is required' });

export const capaReportFormSchema = z.object({
  report_type: requiredType,
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  capa_number: z.string().default(''),
  department: z.string().default('All'),
  product: z.string().default('All'),
  capa_source: z.string().default('All'),
  priority: z.string().default('All'),
  status: z.string().default('All'),
  effectiveness_result: z.string().default('All'),
  owner: z.string().default('All'),
  overdue_only: z.boolean().default(false),
  critical_only: z.boolean().default(false),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export type CapaReportFormData = z.infer<typeof capaReportFormSchema>;

export const CAPA_REPORT_FILTER_OPTIONS = {
  departments: ['All', ...CAPA_DEPARTMENTS],
  sources: ['All', ...CAPA_SOURCES],
  priorities: ['All', ...CAPA_PRIORITIES],
  statuses: ['All', ...CAPA_STATUSES],
  effectiveness: ['All', ...EFFECTIVENESS_RESULTS],
};

export const CAPA_PREVIEW_COLUMNS = [
  { key: 'capa_number', header: 'CAPA No' },
  { key: 'capa_source', header: 'Source' },
  { key: 'source_reference', header: 'Source Ref' },
  { key: 'department', header: 'Department' },
  { key: 'product', header: 'Product' },
  { key: 'root_cause', header: 'Root Cause' },
  { key: 'priority', header: 'Priority' },
  { key: 'owner', header: 'Owner' },
  { key: 'target_date', header: 'Target Date' },
  { key: 'closure_date', header: 'Closure Date' },
  { key: 'status', header: 'Status' },
  { key: 'effectiveness_result', header: 'Effectiveness' },
  { key: 'risk_level', header: 'Risk' },
] as const;

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function rootCauseLabel(r: CapaRecord): string {
  const rc = (r.root_cause || 'Not Documented').trim();
  return rc.length > 60 ? `${rc.slice(0, 60)}…` : rc;
}

function riskLevel(record: CapaRecord): string {
  if (record.priority === 'critical') return 'Critical';
  if (record.priority === 'high') return 'High';
  if (isCapaOverdue(record)) return 'Medium';
  return 'Low';
}

export function buildCapaReportId(reportType: string): string {
  const code = reportType.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'CAPA';
  return `CAPA-RPT-${code}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateCapaReportNumber(year: number, existingCount: number): string {
  return `CAPA-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function filterByCapaReportType(
  records: CapaRecord[],
  reportType: CapaReportType,
  correctiveCapaIds?: Set<string>,
  preventiveCapaIds?: Set<string>,
): CapaRecord[] {
  switch (reportType) {
    case 'Open CAPA Report':
      return records.filter((r) => !isCapaClosed(r.capa_status) && r.capa_status !== 'rejected');
    case 'Closed CAPA Report':
      return records.filter((r) => r.capa_status === 'closed' || r.capa_status === 'approved');
    case 'Overdue CAPA Report':
      return records.filter(isCapaOverdue);
    case 'CAPA Effectiveness Report':
      return records.filter((r) =>
        r.effectiveness_check_required
        || r.effectiveness_result !== 'N/A',
      );
    case 'Corrective Action Report':
      return records.filter((r) => correctiveCapaIds?.has(r.id) || Boolean(r.corrective_action?.trim()));
    case 'Preventive Action Report':
      return records.filter((r) => preventiveCapaIds?.has(r.id) || Boolean(r.preventive_action?.trim()));
    case 'CAPA Closure Report':
      return records.filter((r) => isCapaClosed(r.capa_status));
    case 'Department-wise CAPA Report':
    case 'Source-wise CAPA Report':
    case 'CAPA Trend Report':
    case 'Management Review Report':
    case 'CAPA Register':
    default:
      return records.filter((r) => r.capa_status !== 'draft');
  }
}

export function applyCapaReportFilters(
  records: CapaRecord[],
  filters: CapaReportFilterInput,
  correctiveCapaIds?: Set<string>,
  preventiveCapaIds?: Set<string>,
): CapaRecord[] {
  const byType = filterByCapaReportType(
    records,
    filters.report_type,
    correctiveCapaIds,
    preventiveCapaIds,
  );
  let results = applyCapaDashboardFilters(byType, {
    date_from: filters.review_period_from,
    date_to: filters.review_period_to,
    department: filters.department && filters.department !== 'All' ? filters.department : undefined,
    source: filters.capa_source && filters.capa_source !== 'All' ? filters.capa_source : undefined,
    priority: filters.priority && filters.priority !== 'All' ? filters.priority : undefined,
    status: filters.status && filters.status !== 'All' ? filters.status : undefined,
    effectiveness_result: filters.effectiveness_result && filters.effectiveness_result !== 'All'
      ? filters.effectiveness_result
      : undefined,
    owner: filters.owner && filters.owner !== 'All' ? filters.owner : undefined,
    capa_number: filters.capa_number?.trim() || undefined,
    overdue_only: filters.overdue_only,
  });

  if (filters.product && filters.product !== 'All') {
    results = results.filter((r) => r.product_name === filters.product);
  }
  if (filters.critical_only) {
    results = results.filter((r) => r.priority === 'critical');
  }
  return results;
}

function computePriorityTrend(records: CapaRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const p = r.priority || 'medium';
    map.set(p, (map.get(p) || 0) + 1);
  }
  return CAPA_PRIORITIES.map((p) => ({ name: p, count: map.get(p) || 0 }));
}

function computeRootCauseTrend(records: CapaRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const label = rootCauseLabel(r);
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function computeRiskDistribution(records: CapaRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const level = riskLevel(r);
    map.set(level, (map.get(level) || 0) + 1);
  }
  return ['Critical', 'High', 'Medium', 'Low'].map((name) => ({
    name,
    count: map.get(name) || 0,
  }));
}

function computeEffectivenessTrend(records: CapaRecord[]): { name: string; effective: number; notEffective: number }[] {
  const map = new Map<string, { effective: number; notEffective: number }>();
  for (const r of records) {
    const month = r.capa_date?.slice(0, 7) || r.created_at?.slice(0, 7) || 'Unknown';
    const cur = map.get(month) || { effective: 0, notEffective: 0 };
    if (r.effectiveness_result === 'Effective') cur.effective++;
    if (r.effectiveness_result === 'Not Effective') cur.notEffective++;
    map.set(month, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({ name, ...v }));
}

function computeRepeatCapa(records: CapaRecord[]): number {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = rootCauseLabel(r).toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.values()).filter((c) => c >= 2).length;
}

export function computeCapaReportMetrics(records: CapaRecord[]): CapaReportAnalyticsMetrics {
  const base = computeExtendedCapaDashboardMetrics(records);
  const closed = base.closed || 0;
  const total = base.total || 0;
  const effReviews = records.filter((r) =>
    ['Effective', 'Not Effective', 'Pending'].includes(r.effectiveness_result || ''),
  ).length;
  const effectiveReviews = records.filter((r) => r.effectiveness_result === 'Effective').length;

  return {
    ...base,
    capaSuccessRate: closed > 0 ? Math.round((base.effective / closed) * 100) : 0,
    overdueRate: total > 0 ? Math.round((base.overdue / total) * 100) : 0,
    effectivenessRate: effReviews > 0 ? Math.round((effectiveReviews / effReviews) * 100) : 0,
    repeatCapa: computeRepeatCapa(records),
    highRiskCapa: records.filter((r) => r.priority === 'critical' || r.priority === 'high').length,
  };
}

export function buildCapaReportCharts(
  records: CapaRecord[],
  baseCharts: CapaDashboardChartData,
): CapaReportChartData {
  return {
    monthlyTrend: baseCharts.monthlyTrend,
    bySource: baseCharts.bySource,
    byDepartment: baseCharts.byDepartment,
    byPriority: computePriorityTrend(records),
    byStatus: baseCharts.byStatus,
    effectivenessTrend: computeEffectivenessTrend(records),
    closurePerformanceTrend: baseCharts.closureTimeTrend,
    overdueTrend: baseCharts.overdueTrend,
    rootCauseTrend: computeRootCauseTrend(records),
    riskDistribution: computeRiskDistribution(records),
  };
}

export function toCapaPreviewRow(record: CapaRecord): CapaReportPreviewRow {
  const closureDate = record.actual_completion_date
    || (isCapaClosed(record.capa_status) ? record.updated_at?.split('T')[0] : '')
    || '—';
  return {
    capa_number: record.capa_number,
    capa_source: record.capa_source || '—',
    source_reference: record.source_reference_number || '—',
    department: record.department || '—',
    product: record.product_name || '—',
    root_cause: rootCauseLabel(record),
    priority: record.priority || '—',
    owner: record.action_owner_name || record.action_owner || '—',
    target_date: record.target_completion_date || '—',
    closure_date: closureDate,
    status: record.capa_status.replace(/_/g, ' '),
    effectiveness_result: record.effectiveness_result || '—',
    risk_level: riskLevel(record),
  };
}

export function buildCapaReportSummary(
  filters: CapaReportFilterInput,
  metrics: CapaReportAnalyticsMetrics,
  count: number,
): string {
  return `${filters.report_type} for ${filters.review_period_from} to ${filters.review_period_to}: `
    + `${count} CAPA record(s). Open: ${metrics.open}, Closed: ${metrics.closed}, Overdue: ${metrics.overdue} `
    + `(${metrics.overdueRate}%). Effective: ${metrics.effective}, Not Effective: ${metrics.notEffective}. `
    + `Success rate: ${metrics.capaSuccessRate}%, Avg closure: ${metrics.avgClosureDays} days.`;
}

export function buildCapaReportRecommendations(
  metrics: CapaReportAnalyticsMetrics,
  management: CapaManagementReviewSummary,
): string {
  const items = [...management.improvementOpportunities];
  if (metrics.overdue > 0) items.push(`Address ${metrics.overdue} overdue CAPA (${metrics.overdueRate}% overdue rate).`);
  if (metrics.notEffective > 0) items.push(`Review ${metrics.notEffective} not-effective CAPA for reassessment.`);
  if (metrics.repeatCapa > 0) items.push(`Investigate ${metrics.repeatCapa} repeat root cause pattern(s).`);
  if (!items.length) items.push('Continue routine CAPA monitoring and management review.');
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

export function buildManagementReviewSummary(records: CapaRecord[]): CapaManagementReviewSummary {
  const rootMap = new Map<string, number>();
  const deptMap = new Map<string, number>();
  for (const r of records) {
    const rc = rootCauseLabel(r);
    rootMap.set(rc, (rootMap.get(rc) || 0) + 1);
    deptMap.set(r.department || 'Unknown', (deptMap.get(r.department || 'Unknown') || 0) + 1);
  }
  const topRootCauses = Array.from(rootMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topDepartments = Array.from(deptMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const metrics = computeCapaReportMetrics(records);
  const repeatIssues = topRootCauses.filter((r) => r.count >= 2).map((r) => `${r.name} (${r.count}×)`);
  const improvementOpportunities: string[] = [];
  if (metrics.overdueRate > 10) improvementOpportunities.push('Reduce overdue CAPA rate below 10%.');
  if (metrics.capaSuccessRate < 85 && metrics.closed > 0) {
    improvementOpportunities.push('Improve CAPA effectiveness success rate above 85%.');
  }
  if (metrics.avgClosureDays > CLOSURE_TARGET_DAYS) {
    improvementOpportunities.push(`Target average closure within ${CLOSURE_TARGET_DAYS} days.`);
  }
  if (metrics.repeatCapa > 0) improvementOpportunities.push('Eliminate repeat root causes through preventive CAPA.');

  const narrative = `Management review: ${metrics.total} CAPA created, ${metrics.closed} closed `
    + `(${metrics.total > 0 ? Math.round((metrics.closed / metrics.total) * 100) : 0}% closure). `
    + `Overdue: ${metrics.overdueRate}%. Effectiveness: ${metrics.effectivenessRate}%. `
    + `Top department: ${topDepartments[0]?.name || 'N/A'}. Top root cause: ${topRootCauses[0]?.name || 'N/A'}.`;

  return {
    totalCapaCreated: metrics.total,
    totalCapaClosed: metrics.closed,
    overdueCapaPct: metrics.overdueRate,
    capaEffectivenessPct: metrics.effectivenessRate,
    topRootCauses,
    topDepartments,
    repeatIssues,
    improvementOpportunities,
    narrative,
  };
}

export function computeCapaReportAnalytics(
  allRecords: CapaRecord[],
  filters: CapaReportFilterInput,
  correctiveActions: CapaCorrectiveAction[] = [],
  preventiveActions: CapaPreventiveAction[] = [],
): CapaReportAnalyticsResult {
  const correctiveCapaIds = new Set(correctiveActions.map((a) => a.capa_id));
  const preventiveCapaIds = new Set(preventiveActions.map((a) => a.capa_id));
  const filtered = applyCapaReportFilters(
    allRecords,
    filters,
    correctiveCapaIds,
    preventiveCapaIds,
  );
  const metrics = computeCapaReportMetrics(filtered);
  const baseCharts = computeCapaChartData(filtered);
  const charts = buildCapaReportCharts(filtered, baseCharts);
  const previewRows = filtered.map(toCapaPreviewRow);
  const managementReview = buildManagementReviewSummary(filtered);

  return {
    metrics,
    charts,
    previewRows,
    summary: buildCapaReportSummary(filters, metrics, filtered.length),
    recommendations: buildCapaReportRecommendations(metrics, managementReview),
    managementReview,
    filtered_count: filtered.length,
  };
}

export function mapCapaReportToRecord(
  form: CapaReportFormData,
  analytics: CapaReportAnalyticsResult,
  actor: CapaReportActor,
  reportNumber: string,
): Omit<CapaReportRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    report_id: buildCapaReportId(form.report_type),
    report_name: form.report_type,
    report_number: reportNumber,
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    department: form.department || 'All',
    product: form.product || 'All',
    capa_source: form.capa_source || 'All',
    priority: form.priority || 'All',
    status_filter: form.status || 'All',
    effectiveness_result: form.effectiveness_result || 'All',
    capa_number: form.capa_number || '',
    owner: form.owner || 'All',
    overdue_only: form.overdue_only,
    critical_only: form.critical_only,
    generated_by: actor.id,
    generated_by_name: actor.name,
    generated_at: now,
    generated_date: now.split('T')[0],
    total_records: analytics.filtered_count,
    export_type: '',
    file_url: '',
    report_status: 'Generated',
    filters_applied: {
      department: form.department || 'All',
      product: form.product || 'All',
      capa_source: form.capa_source || 'All',
      priority: form.priority || 'All',
      status: form.status || 'All',
      effectiveness_result: form.effectiveness_result || 'All',
      owner: form.owner || 'All',
      overdue_only: form.overdue_only,
      critical_only: form.critical_only,
    },
    preview_rows: analytics.previewRows as unknown as Record<string, unknown>[],
    chart_snapshot: analytics.charts as unknown as Record<string, unknown>,
    metrics_snapshot: analytics.metrics as unknown as Record<string, unknown>,
    management_summary: analytics.managementReview,
    summary: analytics.summary,
    recommendations: analytics.recommendations,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function summarizeCapaReportsDashboard(records: CapaRecord[]): CapaReportAnalyticsResult {
  const year = new Date().getFullYear();
  return computeCapaReportAnalytics(records, {
    report_type: 'CAPA Register',
    review_period_from: `${year}-01-01`,
    review_period_to: `${year}-12-31`,
  });
}

export function canViewCapaReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer',
    'production_manager', 'production'].includes(r);
}

export function canGenerateCapaReports(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canReviewCapaReports(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(normalizeRole(role || ''));
}

export function canViewManagementReview(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'production_manager'].includes(r);
}

export function canGenerateCapaReportType(role?: string | null, reportType?: CapaReportType): boolean {
  if (!reportType) return canGenerateCapaReports(role);
  const r = normalizeRole(role || '');
  if (CAPA_MANAGEMENT_REPORT_TYPES.includes(reportType)) {
    return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'production_manager'].includes(r);
  }
  return canGenerateCapaReports(role);
}

export function canExportCapaReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isCapaReportsReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function reportStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-amber-100 text-amber-800',
    Generated: 'bg-blue-100 text-blue-800',
    Exported: 'bg-green-100 text-green-800',
    Scheduled: 'bg-purple-100 text-purple-800',
    Archived: 'bg-slate-100 text-slate-600',
    Failed: 'bg-red-100 text-red-800',
  };
  return map[status] || map.Generated;
}

export function extractCapaReportProductOptions(records: CapaRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.product_name?.trim()) set.add(r.product_name.trim());
  }
  return ['All', ...Array.from(set).sort()];
}

export function extractCapaReportOwnerOptions(records: CapaRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.action_owner_name?.trim()) set.add(r.action_owner_name.trim());
  }
  return ['All', ...Array.from(set).sort().slice(0, 50)];
}
