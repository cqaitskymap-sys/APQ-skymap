import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  CC_DEPARTMENTS,
  CC_MANAGEMENT_REPORT_TYPES,
  CC_REPORT_TYPES,
  CC_STATUSES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES,
  CHANGE_TYPES,
  isCcClosed,
  type CcManagementReviewSummary,
  type CcReportAnalyticsMetrics,
  type CcReportChartData,
  type CcReportPreviewRow,
  type CcReportRecord,
  type CcReportType,
  type ChangeControlRecord,
  type ChangeEffectivenessReview,
  type ChangeImplementationAction,
  type ChangeRiskAssessment,
} from '@/lib/change-control-types';

export {
  CC_REPORT_TYPES,
  CC_MANAGEMENT_REPORT_TYPES,
};

export const REPORTS_MODULE = 'Change Control Reports & Analytics';
export const CLOSURE_TARGET_DAYS = 90;

export type CcReportActor = { id: string; name: string; role?: string };

export interface CcReportFilterInput {
  report_type: CcReportType;
  review_period_from: string;
  review_period_to: string;
  change_number?: string;
  department?: string;
  product?: string;
  change_type?: string;
  category?: string;
  priority?: string;
  status?: string;
  validation_impact?: boolean;
  csv_impact?: boolean;
  training_impact?: boolean;
  regulatory_impact?: boolean;
  owner?: string;
}

export interface CcReportAnalyticsResult {
  metrics: CcReportAnalyticsMetrics;
  charts: CcReportChartData;
  previewRows: CcReportPreviewRow[];
  summary: string;
  recommendations: string;
  managementReview: CcManagementReviewSummary;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Date range is required');
const requiredType = z.enum(CC_REPORT_TYPES, { required_error: 'Report type is required' });

export const ccReportFormSchema = z.object({
  report_type: requiredType,
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  change_number: z.string().default(''),
  department: z.string().default('All'),
  product: z.string().default('All'),
  change_type: z.string().default('All'),
  category: z.string().default('All'),
  priority: z.string().default('All'),
  status: z.string().default('All'),
  validation_impact: z.boolean().default(false),
  csv_impact: z.boolean().default(false),
  training_impact: z.boolean().default(false),
  regulatory_impact: z.boolean().default(false),
  owner: z.string().default('All'),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export type CcReportFormData = z.infer<typeof ccReportFormSchema>;

export const CC_REPORT_FILTER_OPTIONS = {
  departments: ['All', ...CC_DEPARTMENTS],
  changeTypes: ['All', ...CHANGE_TYPES],
  categories: ['All', ...CHANGE_CATEGORIES],
  priorities: ['All', ...CHANGE_PRIORITIES],
  statuses: ['All', ...CC_STATUSES],
};

export const CC_PREVIEW_COLUMNS = [
  { key: 'change_number', header: 'Change No' },
  { key: 'title', header: 'Title' },
  { key: 'change_type', header: 'Type' },
  { key: 'category', header: 'Category' },
  { key: 'department', header: 'Department' },
  { key: 'product', header: 'Product' },
  { key: 'priority', header: 'Priority' },
  { key: 'owner', header: 'Owner' },
  { key: 'planned_date', header: 'Planned Date' },
  { key: 'closure_date', header: 'Closure Date' },
  { key: 'status', header: 'Status' },
  { key: 'validation_impact', header: 'Validation' },
  { key: 'risk_level', header: 'Risk' },
] as const;

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function inDateRange(record: ChangeControlRecord, from: string, to: string): boolean {
  const d = record.change_date || record.created_at?.split('T')[0] || '';
  if (!d) return true;
  return d >= from && d <= to;
}

function isCcOverdue(record: ChangeControlRecord): boolean {
  if (record.status === 'overdue') return true;
  if (isCcClosed(record.status)) return false;
  const today = new Date().toISOString().split('T')[0];
  return Boolean(record.planned_implementation_date && record.planned_implementation_date < today
    && !['implemented', 'effectiveness_completed', 'approved', 'closed'].includes(record.status));
}

function isImplementationPending(record: ChangeControlRecord): boolean {
  return ['approved_for_implementation', 'implementation_in_progress'].includes(record.status);
}

function isEffectivenessPending(record: ChangeControlRecord): boolean {
  return record.status === 'effectiveness_pending' || (
    record.effectiveness_check_required && !isCcClosed(record.status)
    && ['implemented', 'effectiveness_pending'].includes(record.status)
  );
}

function isImplemented(record: ChangeControlRecord): boolean {
  return ['implemented', 'effectiveness_completed', 'effectiveness_pending', 'final_qa_review', 'approved', 'closed']
    .includes(record.status);
}

function riskLevelFor(record: ChangeControlRecord, risksByChange: Map<string, ChangeRiskAssessment>): string {
  const risk = risksByChange.get(record.id);
  if (risk?.risk_level) return risk.risk_level;
  if (record.change_category === 'Critical') return 'Critical';
  if (record.change_priority === 'Urgent' || record.change_priority === 'High') return 'High';
  return 'Medium';
}

export function buildCcReportId(reportType: string): string {
  const code = reportType.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'CC';
  return `CC-RPT-${code}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateCcReportNumber(year: number, existingCount: number): string {
  return `CC-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function filterByCcReportType(records: ChangeControlRecord[], reportType: CcReportType): ChangeControlRecord[] {
  switch (reportType) {
    case 'Open Change Report':
      return records.filter((r) => !isCcClosed(r.status) && r.status !== 'rejected' && r.status !== 'cancelled');
    case 'Closed Change Report':
      return records.filter((r) => r.status === 'closed');
    case 'Overdue Change Report':
      return records.filter(isCcOverdue);
    case 'Critical Change Report':
      return records.filter((r) => r.change_category === 'Critical');
    case 'Validation Impact Report':
      return records.filter((r) => r.validation_impact);
    case 'CSV Impact Report':
      return records.filter((r) => r.csv_impact);
    case 'Training Impact Report':
      return records.filter((r) => r.training_impact);
    case 'Regulatory Impact Report':
      return records.filter((r) => r.regulatory_impact);
    case 'Implementation Status Report':
      return records.filter((r) => isImplementationPending(r) || isImplemented(r));
    case 'Effectiveness Review Report':
      return records.filter((r) => r.effectiveness_check_required || r.status.includes('effectiveness'));
    case 'Change Closure Report':
      return records.filter((r) => isCcClosed(r.status));
    case 'Department-wise Change Report':
    case 'Change Type Report':
    case 'Trend Analysis Report':
    case 'Management Review Report':
    case 'Change Control Register':
    default:
      return records.filter((r) => r.status !== 'draft');
  }
}

export function applyCcReportFilters(
  records: ChangeControlRecord[],
  filters: CcReportFilterInput,
): ChangeControlRecord[] {
  let results = filterByCcReportType(records, filters.report_type);
  results = results.filter((r) => inDateRange(r, filters.review_period_from, filters.review_period_to));

  if (filters.change_number?.trim()) {
    const q = filters.change_number.trim().toLowerCase();
    results = results.filter((r) => r.change_control_number.toLowerCase().includes(q));
  }
  if (filters.department && filters.department !== 'All') {
    results = results.filter((r) => r.department === filters.department);
  }
  if (filters.product && filters.product !== 'All') {
    results = results.filter((r) => r.product_name === filters.product);
  }
  if (filters.change_type && filters.change_type !== 'All') {
    results = results.filter((r) => r.change_type === filters.change_type);
  }
  if (filters.category && filters.category !== 'All') {
    results = results.filter((r) => r.change_category === filters.category);
  }
  if (filters.priority && filters.priority !== 'All') {
    results = results.filter((r) => r.change_priority === filters.priority);
  }
  if (filters.status && filters.status !== 'All') {
    results = results.filter((r) => r.status === filters.status);
  }
  if (filters.validation_impact) results = results.filter((r) => r.validation_impact);
  if (filters.csv_impact) results = results.filter((r) => r.csv_impact);
  if (filters.training_impact) results = results.filter((r) => r.training_impact);
  if (filters.regulatory_impact) results = results.filter((r) => r.regulatory_impact);
  if (filters.owner && filters.owner !== 'All') {
    results = results.filter((r) => r.initiated_by_name === filters.owner);
  }
  return results;
}

function monthlyCount(records: ChangeControlRecord[], predicate?: (r: ChangeControlRecord) => boolean) {
  const map = new Map<string, number>();
  for (const r of records) {
    if (predicate && !predicate(r)) continue;
    const month = r.created_at?.slice(0, 7) || r.change_date?.slice(0, 7) || 'Unknown';
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

function groupCount(records: ChangeControlRecord[], keyFn: (r: ChangeControlRecord) => string) {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = keyFn(r) || 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

function closurePerformanceTrend(records: ChangeControlRecord[]) {
  const map = new Map<string, { total: number; days: number }>();
  for (const r of records) {
    if (!isCcClosed(r.status)) continue;
    const month = r.updated_at?.slice(0, 7) || 'Unknown';
    const cur = map.get(month) || { total: 0, days: 0 };
    cur.total += 1;
    cur.days += daysBetween(r.created_at, r.updated_at);
    map.set(month, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({ name, avgDays: v.total ? Math.round(v.days / v.total) : 0 }));
}

function effectivenessTrend(
  records: ChangeControlRecord[],
  effectiveness: ChangeEffectivenessReview[],
) {
  const effByChange = new Map(effectiveness.map((e) => [e.change_id, e]));
  const map = new Map<string, number>();
  for (const r of records) {
    const eff = effByChange.get(r.id);
    if (!eff) continue;
    const month = eff.review_date?.slice(0, 7) || eff.created_at?.slice(0, 7) || 'Unknown';
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

function implementationTrend(records: ChangeControlRecord[]) {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!isImplemented(r)) continue;
    const month = r.actual_implementation_date?.slice(0, 7)
      || r.updated_at?.slice(0, 7) || 'Unknown';
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

export function computeCcReportMetrics(records: ChangeControlRecord[]): CcReportAnalyticsMetrics {
  const total = records.length;
  const open = records.filter((r) => !isCcClosed(r.status) && r.status !== 'rejected').length;
  const closed = records.filter((r) => r.status === 'closed').length;
  const overdue = records.filter(isCcOverdue).length;
  const critical = records.filter((r) => r.change_category === 'Critical').length;
  const validationImpact = records.filter((r) => r.validation_impact).length;
  const csvImpact = records.filter((r) => r.csv_impact).length;
  const trainingImpactChanges = records.filter((r) => r.training_impact).length;
  const trainingPending = records.filter((r) => r.training_impact && !isCcClosed(r.status)).length;
  const regulatoryImpact = records.filter((r) => r.regulatory_impact).length;
  const implementationPending = records.filter(isImplementationPending).length;
  const effectivenessPending = records.filter(isEffectivenessPending).length;
  const implemented = records.filter(isImplemented).length;

  const closedRecords = records.filter((r) => isCcClosed(r.status));
  const avgClosureDays = closedRecords.length
    ? Math.round(closedRecords.reduce((s, r) => s + daysBetween(r.created_at, r.updated_at), 0) / closedRecords.length)
    : 0;

  return {
    total,
    open,
    closed,
    overdue,
    critical,
    validationImpact,
    csvImpact,
    trainingPending,
    trainingImpactChanges,
    regulatoryImpact,
    implementationPending,
    effectivenessPending,
    closureRate: total > 0 ? Math.round((closed / total) * 100) : 0,
    overdueRate: total > 0 ? Math.round((overdue / total) * 100) : 0,
    validationImpactRate: total > 0 ? Math.round((validationImpact / total) * 100) : 0,
    csvImpactRate: total > 0 ? Math.round((csvImpact / total) * 100) : 0,
    trainingImpactRate: total > 0 ? Math.round((trainingImpactChanges / total) * 100) : 0,
    regulatoryImpactRate: total > 0 ? Math.round((regulatoryImpact / total) * 100) : 0,
    implementationSuccessRate: total > 0 ? Math.round((implemented / total) * 100) : 0,
    avgClosureDays,
  };
}

export function buildCcReportCharts(
  records: ChangeControlRecord[],
  effectiveness: ChangeEffectivenessReview[] = [],
): CcReportChartData {
  return {
    monthlyTrend: monthlyCount(records),
    byDepartment: groupCount(records, (r) => r.department),
    byType: groupCount(records, (r) => r.change_type),
    byPriority: groupCount(records, (r) => r.change_priority),
    byStatus: groupCount(records, (r) => r.status.replace(/_/g, ' ')),
    validationImpactTrend: monthlyCount(records, (r) => r.validation_impact),
    csvImpactTrend: monthlyCount(records, (r) => r.csv_impact),
    trainingImpactTrend: monthlyCount(records, (r) => r.training_impact),
    regulatoryImpactTrend: monthlyCount(records, (r) => r.regulatory_impact),
    implementationPerformanceTrend: implementationTrend(records),
    effectivenessTrend: effectivenessTrend(records, effectiveness),
    closurePerformanceTrend: closurePerformanceTrend(records),
  };
}

export function toCcPreviewRow(
  record: ChangeControlRecord,
  risksByChange: Map<string, ChangeRiskAssessment>,
): CcReportPreviewRow {
  const closureDate = isCcClosed(record.status)
    ? (record.updated_at?.split('T')[0] || '—')
    : '—';
  return {
    change_number: record.change_control_number,
    title: ((record.change_title || '').trim() || 'Untitled').length > 50
      ? `${(record.change_title || 'Untitled').slice(0, 50)}…`
      : (record.change_title || 'Untitled'),
    change_type: record.change_type || '—',
    category: record.change_category || '—',
    department: record.department || '—',
    product: record.product_name || '—',
    priority: record.change_priority || '—',
    owner: record.initiated_by_name || '—',
    planned_date: record.planned_implementation_date || '—',
    closure_date: closureDate,
    status: record.status.replace(/_/g, ' '),
    validation_impact: record.validation_impact ? 'Yes' : 'No',
    csv_impact: record.csv_impact ? 'Yes' : 'No',
    training_impact: record.training_impact ? 'Yes' : 'No',
    regulatory_impact: record.regulatory_impact ? 'Yes' : 'No',
    risk_level: riskLevelFor(record, risksByChange),
  };
}

export function buildCcReportSummary(
  filters: CcReportFilterInput,
  metrics: CcReportAnalyticsMetrics,
  count: number,
): string {
  return `${filters.report_type} for ${filters.review_period_from} to ${filters.review_period_to}: `
    + `${count} change record(s). Open: ${metrics.open}, Closed: ${metrics.closed}, Overdue: ${metrics.overdue} `
    + `(${metrics.overdueRate}%). Validation impact: ${metrics.validationImpactRate}%. `
    + `Implementation success: ${metrics.implementationSuccessRate}%. Avg closure: ${metrics.avgClosureDays} days.`;
}

export function buildCcReportRecommendations(
  metrics: CcReportAnalyticsMetrics,
  management: CcManagementReviewSummary,
): string {
  const items = [...management.improvementOpportunities];
  if (metrics.overdue > 0) items.push(`Address ${metrics.overdue} overdue changes (${metrics.overdueRate}% overdue rate).`);
  if (metrics.implementationPending > 0) items.push(`Complete ${metrics.implementationPending} pending implementation(s).`);
  if (metrics.effectivenessPending > 0) items.push(`Conduct ${metrics.effectivenessPending} pending effectiveness review(s).`);
  if (!items.length) items.push('Continue routine change control monitoring and management review.');
  return items.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

export function buildManagementReviewSummary(records: ChangeControlRecord[]): CcManagementReviewSummary {
  const typeMap = new Map<string, number>();
  const deptMap = new Map<string, number>();
  for (const r of records) {
    typeMap.set(r.change_type || 'Unknown', (typeMap.get(r.change_type || 'Unknown') || 0) + 1);
    deptMap.set(r.department || 'Unknown', (deptMap.get(r.department || 'Unknown') || 0) + 1);
  }
  const topChangeTypes = Array.from(typeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topDepartments = Array.from(deptMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const metrics = computeCcReportMetrics(records);
  const improvementOpportunities: string[] = [];
  if (metrics.overdueRate > 10) improvementOpportunities.push('Reduce overdue change rate below 10%.');
  if (metrics.closureRate < 70 && metrics.total > 0) improvementOpportunities.push('Improve change closure rate above 70%.');
  if (metrics.avgClosureDays > CLOSURE_TARGET_DAYS) {
    improvementOpportunities.push(`Target average closure within ${CLOSURE_TARGET_DAYS} days.`);
  }
  if (metrics.critical > 0) improvementOpportunities.push(`Prioritize ${metrics.critical} critical change(s) for expedited review.`);

  const narrative = `Management review: ${metrics.total} changes initiated, ${metrics.closed} closed `
    + `(${metrics.closureRate}% closure). Overdue: ${metrics.overdueRate}%. `
    + `Validation impact: ${metrics.validationImpactRate}%. CSV impact: ${metrics.csvImpactRate}%. `
    + `Top department: ${topDepartments[0]?.name || 'N/A'}. Top change type: ${topChangeTypes[0]?.name || 'N/A'}.`;

  return {
    totalChangesInitiated: metrics.total,
    totalChangesClosed: metrics.closed,
    overdueChangePct: metrics.overdueRate,
    validationImpactPct: metrics.validationImpactRate,
    csvImpactPct: metrics.csvImpactRate,
    trainingImpactPct: metrics.trainingImpactRate,
    topChangeTypes,
    topDepartments,
    criticalChanges: metrics.critical,
    improvementOpportunities,
    narrative,
  };
}

export function computeCcReportAnalytics(
  allRecords: ChangeControlRecord[],
  filters: CcReportFilterInput,
  risks: ChangeRiskAssessment[] = [],
  effectiveness: ChangeEffectivenessReview[] = [],
  _implementation: ChangeImplementationAction[] = [],
): CcReportAnalyticsResult {
  const filtered = applyCcReportFilters(allRecords, filters);
  const risksByChange = new Map(risks.map((r) => [r.change_id, r]));
  const metrics = computeCcReportMetrics(filtered);
  const charts = buildCcReportCharts(filtered, effectiveness);
  const previewRows = filtered.map((r) => toCcPreviewRow(r, risksByChange));
  const managementReview = buildManagementReviewSummary(filtered);

  return {
    metrics,
    charts,
    previewRows,
    summary: buildCcReportSummary(filters, metrics, filtered.length),
    recommendations: buildCcReportRecommendations(metrics, managementReview),
    managementReview,
    filtered_count: filtered.length,
  };
}

export function mapCcReportToRecord(
  form: CcReportFormData,
  analytics: CcReportAnalyticsResult,
  actor: CcReportActor,
  reportNumber: string,
): Omit<CcReportRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    report_id: buildCcReportId(form.report_type),
    report_name: form.report_type,
    report_number: reportNumber,
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    change_number: form.change_number || '',
    department: form.department || 'All',
    product: form.product || 'All',
    change_type: form.change_type || 'All',
    category: form.category || 'All',
    priority: form.priority || 'All',
    status_filter: form.status || 'All',
    validation_impact: form.validation_impact,
    csv_impact: form.csv_impact,
    training_impact: form.training_impact,
    regulatory_impact: form.regulatory_impact,
    owner: form.owner || 'All',
    generated_by: actor.id,
    generated_by_name: actor.name,
    generated_at: now,
    generated_date: now.split('T')[0],
    total_records: analytics.filtered_count,
    export_type: '',
    file_url: '',
    report_status: 'Generated',
    filters_applied: { ...form },
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

export function summarizeCcReportsDashboard(
  records: ChangeControlRecord[],
  risks: ChangeRiskAssessment[] = [],
  effectiveness: ChangeEffectivenessReview[] = [],
): CcReportAnalyticsResult {
  const year = new Date().getFullYear();
  return computeCcReportAnalytics(records, {
    report_type: 'Change Control Register',
    review_period_from: `${year}-01-01`,
    review_period_to: `${year}-12-31`,
  }, risks, effectiveness);
}

const VALIDATION_REPORT_TYPES: CcReportType[] = [
  'Validation Impact Report',
  'Implementation Status Report',
  'Effectiveness Review Report',
];

const CSV_REPORT_TYPES: CcReportType[] = [
  'CSV Impact Report',
  'Implementation Status Report',
];

const REGULATORY_REPORT_TYPES: CcReportType[] = [
  'Regulatory Impact Report',
  'Management Review Report',
];

export function canViewCcReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || raw.includes('validation') || raw.includes('csv') || raw === 'regulatory_affairs' || raw === 'regulatory';
}

export function canGenerateCcReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function canViewManagementReview(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(r);
}

export function canGenerateCcReportType(role?: string | null, reportType?: CcReportType): boolean {
  if (!reportType) return canGenerateCcReports(role);
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (CC_MANAGEMENT_REPORT_TYPES.includes(reportType)) {
    return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(r);
  }
  if (VALIDATION_REPORT_TYPES.includes(reportType)) {
    return canGenerateCcReports(role) || raw.includes('validation');
  }
  if (CSV_REPORT_TYPES.includes(reportType)) {
    return canGenerateCcReports(role) || raw.includes('csv');
  }
  if (REGULATORY_REPORT_TYPES.includes(reportType)) {
    return canGenerateCcReports(role) || raw === 'regulatory_affairs' || raw === 'regulatory';
  }
  return canGenerateCcReports(role);
}

export function canExportCcReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (r === 'auditor' || r === 'viewer') return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isCcReportsReadOnly(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return r === 'auditor' || r === 'viewer';
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

export function extractCcReportProductOptions(records: ChangeControlRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.product_name?.trim()) set.add(r.product_name.trim());
  }
  return ['All', ...Array.from(set).sort()];
}

export function extractCcReportOwnerOptions(records: ChangeControlRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.initiated_by_name?.trim()) set.add(r.initiated_by_name.trim());
  }
  return ['All', ...Array.from(set).sort().slice(0, 50)];
}

export function exportCcReportCsv(rows: CcReportPreviewRow[]): { headers: string[]; data: string[][] } {
  const headers = CC_PREVIEW_COLUMNS.map((c) => c.header);
  const data = rows.map((r) => CC_PREVIEW_COLUMNS.map((c) => String(r[c.key as keyof CcReportPreviewRow] ?? '')));
  return { headers, data };
}
