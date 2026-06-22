import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  applyRecallDashboardFilters,
  computeRecallChartData,
  computeRecallDashboardMetrics,
  filterRecallsByRole,
} from '@/lib/recall-dashboard-records';
import {
  RECALL_CLASSIFICATIONS,
  RECALL_MANAGEMENT_REPORT_TYPES,
  RECALL_REGULATORY_REPORT_TYPES,
  RECALL_RECOVERY_REPORT_TYPES,
  RECALL_REPORT_TYPES,
  RECALL_STATUSES,
  RECALL_TYPES,
  getRecallRecoveryPercent,
  isMockRecall,
  isRecallCapaLinked,
  isRecallClosed,
  isRecallOpen,
  isRecoveryInProgress,
  isRegulatoryPending,
  type RecallClosure,
  type RecallDistribution,
  type RecallManagementReviewSummary,
  type RecallRecord,
  type RecallRecovery,
  type RecallRegulatoryNotification,
  type RecallReportAnalyticsMetrics,
  type RecallReportChartData,
  type RecallReportPreviewRow,
  type RecallReportRecord,
  type RecallReportType,
} from '@/lib/recall-types';

export {
  RECALL_REPORT_TYPES,
  RECALL_MANAGEMENT_REPORT_TYPES,
  RECALL_REGULATORY_REPORT_TYPES,
  RECALL_RECOVERY_REPORT_TYPES,
};

export const REPORTS_MODULE = 'Recall Reports & Analytics';
export const CLOSURE_TARGET_DAYS = 30;

export type RecallReportActor = { id: string; name: string; role?: string };

export interface RecallReportFilterInput {
  report_type: RecallReportType;
  review_period_from: string;
  review_period_to: string;
  recall_number?: string;
  product?: string;
  batch_number?: string;
  market_region?: string;
  recall_type?: string;
  recall_classification?: string;
  status?: string;
  regulatory_notification_required?: string;
  capa_required?: string;
}

export interface RecallReportContext {
  distributions: RecallDistribution[];
  recoveries: RecallRecovery[];
  regulatoryNotifications: RecallRegulatoryNotification[];
  closures: RecallClosure[];
}

export interface RecallReportAnalyticsResult {
  metrics: RecallReportAnalyticsMetrics;
  charts: RecallReportChartData;
  previewRows: RecallReportPreviewRow[];
  summary: string;
  recommendations: string;
  managementReview: RecallManagementReviewSummary;
  distributionSummary: Record<string, unknown>;
  recoverySummary: Record<string, unknown>;
  regulatorySummary: Record<string, unknown>;
  capaSummary: Record<string, unknown>;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Date range is required');
const requiredType = z.enum(RECALL_REPORT_TYPES, { required_error: 'Report type is required' });

export const recallReportFormSchema = z.object({
  report_type: requiredType,
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  recall_number: z.string().default(''),
  product: z.string().default('All'),
  batch_number: z.string().default(''),
  market_region: z.string().default('All'),
  recall_type: z.string().default('All'),
  recall_classification: z.string().default('All'),
  status: z.string().default('All'),
  regulatory_notification_required: z.string().default('All'),
  capa_required: z.string().default('All'),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export type RecallReportFormData = z.infer<typeof recallReportFormSchema>;

export const RECALL_REPORT_FILTER_OPTIONS = {
  types: ['All', ...RECALL_TYPES],
  classifications: ['All', ...RECALL_CLASSIFICATIONS],
  statuses: ['All', ...RECALL_STATUSES],
  yesNoAll: ['All', 'Yes', 'No'],
};

export const RECALL_PREVIEW_COLUMNS = [
  { key: 'recall_number', header: 'Recall No' },
  { key: 'recall_date', header: 'Date' },
  { key: 'product_name', header: 'Product' },
  { key: 'batch_number', header: 'Batch' },
  { key: 'market_region', header: 'Market' },
  { key: 'recall_type', header: 'Type' },
  { key: 'recall_classification', header: 'Classification' },
  { key: 'recall_status', header: 'Status' },
  { key: 'recovery_percent', header: 'Recovery %' },
  { key: 'regulatory_status', header: 'Regulatory' },
  { key: 'capa_linked', header: 'CAPA' },
  { key: 'closure_date', header: 'Closure Date' },
] as const;

function computeAvgClosureDays(records: RecallRecord[], closures: RecallClosure[]): number {
  const closureMap = new Map(closures.map((c) => [c.recall_id, c]));
  const days: number[] = [];
  for (const r of records) {
    const closure = closureMap.get(r.id);
    if (!closure?.closure_date) continue;
    const start = new Date(r.recall_date || r.created_at?.slice(0, 10) || '');
    const end = new Date(closure.closure_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    days.push(Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000)));
  }
  return days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : 0;
}

function computeByType(records: RecallRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const t = r.recall_type || 'Unknown';
    map.set(t, (map.get(t) || 0) + 1);
  }
  return RECALL_TYPES.map((t) => ({ name: t, count: map.get(t) || 0 }));
}

function computeRegulatoryTrend(records: RecallRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.regulatory_notification_required && !isRegulatoryPending(r)) continue;
    const month = (r.recall_date || r.created_at || '').slice(0, 7);
    if (!month) continue;
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

function computeClosurePerformanceTrend(
  records: RecallRecord[],
  closures: RecallClosure[],
): { name: string; avgDays: number }[] {
  const closureMap = new Map(closures.map((c) => [c.recall_id, c]));
  const byMonth = new Map<string, { sum: number; count: number }>();
  for (const r of records) {
    const closure = closureMap.get(r.id);
    if (!closure?.closure_date) continue;
    const start = new Date(r.recall_date || r.created_at?.slice(0, 10) || '');
    const end = new Date(closure.closure_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    const month = closure.closure_date.slice(0, 7);
    const cur = byMonth.get(month) || { sum: 0, count: 0 };
    cur.sum += days;
    cur.count += 1;
    byMonth.set(month, cur);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({ name, avgDays: v.count ? Math.round(v.sum / v.count) : 0 }));
}

export function buildRecallReportId(reportType: string): string {
  const code = reportType.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'RCL';
  return `RCL-RPT-${code}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateRecallReportNumber(year: number, existingCount: number): string {
  return `RCL-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function filterByRecallReportType(records: RecallRecord[], reportType: RecallReportType): RecallRecord[] {
  switch (reportType) {
    case 'Open Recall Report':
      return records.filter((r) => isRecallOpen(r.recall_status));
    case 'Closed Recall Report':
      return records.filter((r) => r.recall_status === 'closed');
    case 'Class I Recall Report':
      return records.filter((r) => r.recall_classification === 'Class I');
    case 'Class II Recall Report':
      return records.filter((r) => r.recall_classification === 'Class II');
    case 'Class III Recall Report':
      return records.filter((r) => r.recall_classification === 'Class III');
    case 'Mock Recall Report':
      return records.filter(isMockRecall);
    case 'Recovery Status Report':
      return records.filter((r) => isRecoveryInProgress(r) || (isRecallOpen(r.recall_status) && (r.distributed_quantity ?? 0) > 0));
    case 'Regulatory Notification Report':
      return records.filter((r) => r.regulatory_notification_required || isRegulatoryPending(r));
    case 'CAPA Linked Recall Report':
      return records.filter(isRecallCapaLinked);
    case 'Recall Closure Report':
      return records.filter((r) => r.recall_status === 'closed' || r.recall_status === 'completed');
    case 'Market-wise Recall Report':
    case 'Product-wise Recall Report':
    case 'Recall Trend Report':
    case 'Recall Register':
    default:
      return records.filter((r) => r.recall_status !== 'draft');
  }
}

export function applyRecallReportFilters(
  records: RecallRecord[],
  filters: RecallReportFilterInput,
): RecallRecord[] {
  const byType = filterByRecallReportType(records, filters.report_type);
  let results = applyRecallDashboardFilters(byType, {
    date_from: filters.review_period_from,
    date_to: filters.review_period_to,
    product: filters.product && filters.product !== 'All' ? filters.product : undefined,
    batch_number: filters.batch_number?.trim() || undefined,
    market_region: filters.market_region && filters.market_region !== 'All' ? filters.market_region : undefined,
    recall_type: filters.recall_type && filters.recall_type !== 'All' ? filters.recall_type : undefined,
    recall_classification: filters.recall_classification && filters.recall_classification !== 'All'
      ? filters.recall_classification
      : undefined,
    recall_status: filters.status && filters.status !== 'All' ? filters.status : undefined,
    search: filters.recall_number?.trim() || undefined,
  });

  if (filters.regulatory_notification_required === 'Yes') {
    results = results.filter((r) => r.regulatory_notification_required);
  } else if (filters.regulatory_notification_required === 'No') {
    results = results.filter((r) => !r.regulatory_notification_required);
  }
  if (filters.capa_required === 'Yes') {
    results = results.filter((r) => r.capa_required || isRecallCapaLinked(r));
  } else if (filters.capa_required === 'No') {
    results = results.filter((r) => !r.capa_required && !isRecallCapaLinked(r));
  }
  if (filters.recall_number?.trim()) {
    const q = filters.recall_number.trim().toLowerCase();
    results = results.filter((r) => r.recall_number.toLowerCase().includes(q));
  }
  return results;
}

export function buildRecallReportCharts(
  records: RecallRecord[],
  closures: RecallClosure[] = [],
): RecallReportChartData {
  const base = computeRecallChartData(records);
  return {
    monthlyTrend: base.monthlyTrend,
    byProduct: base.byProduct.map(({ name, count }) => ({ name, count })),
    byMarket: base.byMarket.map(({ name, count }) => ({ name, count })),
    byClassification: base.byClassification.map(({ name, count }) => ({ name, count })),
    byType: computeByType(records),
    recoveryTrend: base.recoveryTrend.map((r) => ({ name: r.name, avgPercent: r.avgPercent ?? r.percent ?? 0 })),
    regulatoryTrend: computeRegulatoryTrend(records),
    capaLinkageTrend: base.capaLinkedTrend,
    closurePerformanceTrend: computeClosurePerformanceTrend(records, closures),
  };
}

export function computeRecallReportMetrics(
  records: RecallRecord[],
  closures: RecallClosure[] = [],
): RecallReportAnalyticsMetrics {
  const base = computeRecallDashboardMetrics(records);
  return {
    ...base,
    avgClosureDays: computeAvgClosureDays(records.filter((r) => isRecallClosed(r.recall_status)), closures),
  };
}

function regulatoryStatusLabel(r: RecallRecord): string {
  if (!r.regulatory_notification_required) return 'Not Required';
  if (r.regulatory_notified) return r.notification_status || 'Notified';
  return isRegulatoryPending(r) ? 'Pending' : (r.notification_status || 'Pending');
}

export function toRecallPreviewRow(record: RecallRecord, closures: RecallClosure[] = []): RecallReportPreviewRow {
  const closure = closures.find((c) => c.recall_id === record.id);
  return {
    recall_number: record.recall_number,
    recall_date: record.recall_date,
    product_name: record.product_name,
    batch_number: record.batch_number,
    market_region: record.market_region,
    recall_type: record.recall_type,
    recall_classification: record.recall_classification,
    recall_status: record.recall_status.replace(/_/g, ' '),
    recovery_percent: `${getRecallRecoveryPercent(record)}%`,
    regulatory_status: regulatoryStatusLabel(record),
    capa_linked: isRecallCapaLinked(record) ? (record.linked_capa_number || 'Yes') : '—',
    closure_date: closure?.closure_date || (record.recall_status === 'closed' ? record.updated_at?.split('T')[0] : '—') || '—',
  };
}

function buildDistributionSummary(distributions: RecallDistribution[], recallIds: Set<string>) {
  const scoped = distributions.filter((d) => recallIds.has(d.recall_id));
  const totalQty = scoped.reduce((s, d) => s + (d.quantity_distributed || 0), 0);
  const customers = new Set(scoped.map((d) => d.customer_name).filter(Boolean));
  const markets = new Set(scoped.map((d) => d.market_region).filter(Boolean));
  return {
    total_lines: scoped.length,
    total_quantity_distributed: totalQty,
    unique_customers: customers.size,
    unique_markets: markets.size,
  };
}

function buildRecoverySummary(recoveries: RecallRecovery[], recallIds: Set<string>) {
  const scoped = recoveries.filter((r) => recallIds.has(r.recall_id));
  const totalDistributed = scoped.reduce((s, r) => s + (r.distributed_quantity || 0), 0);
  const totalRecovered = scoped.reduce((s, r) => s + (r.quantity_recovered || 0), 0);
  const totalPending = scoped.reduce((s, r) => s + (r.pending_quantity || 0), 0);
  const avgPercent = totalDistributed > 0 ? Math.round((totalRecovered / totalDistributed) * 100) : 0;
  return {
    total_recovery_entries: scoped.length,
    total_distributed: totalDistributed,
    total_recovered: totalRecovered,
    total_pending: totalPending,
    average_recovery_percent: avgPercent,
  };
}

function buildRegulatorySummary(notifications: RecallRegulatoryNotification[], recallIds: Set<string>) {
  const scoped = notifications.filter((n) => recallIds.has(n.recall_id));
  const pending = scoped.filter((n) => ['Pending', 'Overdue', 'Follow Up Required'].includes(n.notification_status)).length;
  const submitted = scoped.filter((n) => ['Submitted', 'Acknowledged', 'Response Received', 'Closed'].includes(n.notification_status)).length;
  return {
    total_notifications: scoped.length,
    pending,
    submitted,
    authorities: Array.from(new Set(scoped.map((n) => n.regulatory_authority).filter(Boolean))),
  };
}

function buildCapaSummary(records: RecallRecord[]) {
  const linked = records.filter(isRecallCapaLinked);
  return {
    capa_linked_count: linked.length,
    capa_required_count: records.filter((r) => r.capa_required).length,
    capa_numbers: linked.map((r) => r.linked_capa_number).filter(Boolean).slice(0, 20),
  };
}

export function buildRecallManagementReview(records: RecallRecord[], closures: RecallClosure[] = []): RecallManagementReviewSummary {
  const metrics = computeRecallReportMetrics(records, closures);
  const productMap = new Map<string, number>();
  const marketMap = new Map<string, number>();
  for (const r of records) {
    productMap.set(r.product_name || 'Unknown', (productMap.get(r.product_name || 'Unknown') || 0) + 1);
    marketMap.set(r.market_region || 'Unknown', (marketMap.get(r.market_region || 'Unknown') || 0) + 1);
  }
  const topProducts = Array.from(productMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  const topMarkets = Array.from(marketMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

  const recommendations: string[] = [];
  if (metrics.classI > 0) recommendations.push(`Review ${metrics.classI} Class I recall(s) for immediate risk mitigation.`);
  if (metrics.regulatoryPending > 0) recommendations.push(`Complete ${metrics.regulatoryPending} pending regulatory notification(s).`);
  if (metrics.avgRecoveryPercent < 80 && metrics.total > 0) recommendations.push('Improve recovery performance above 80% target.');
  if (metrics.avgClosureDays > CLOSURE_TARGET_DAYS) recommendations.push(`Reduce average closure time below ${CLOSURE_TARGET_DAYS} days.`);
  if (metrics.overdue > 0) recommendations.push(`Address ${metrics.overdue} overdue recall(s).`);
  if (!recommendations.length) recommendations.push('Continue routine recall monitoring and PQR review.');

  const narrative = `Management summary: ${metrics.total} recall(s), ${metrics.open} open, ${metrics.closed} closed. `
    + `Class I: ${metrics.classI}. Avg recovery: ${metrics.avgRecoveryPercent}%. `
    + `CAPA linked: ${metrics.capaLinked}. Regulatory pending: ${metrics.regulatoryPending}. `
    + `Avg closure: ${metrics.avgClosureDays} days. Top product: ${topProducts[0]?.name || 'N/A'}.`;

  return {
    totalRecalls: metrics.total,
    openRecalls: metrics.open,
    closedRecalls: metrics.closed,
    classIRecalls: metrics.classI,
    avgRecoveryPercent: metrics.avgRecoveryPercent,
    avgClosureDays: metrics.avgClosureDays,
    topProducts,
    topMarkets,
    regulatoryPending: metrics.regulatoryPending,
    capaLinked: metrics.capaLinked,
    overdueRecalls: metrics.overdue,
    narrative,
    recommendations,
  };
}

export function buildRecallReportSummary(filters: RecallReportFilterInput, metrics: RecallReportAnalyticsMetrics, count: number): string {
  return `${filters.report_type} for ${filters.review_period_from} to ${filters.review_period_to}: `
    + `${count} recall record(s). Open: ${metrics.open}, Closed: ${metrics.closed}, Mock: ${metrics.mockRecalls}. `
    + `Class I: ${metrics.classI}, Class II: ${metrics.classII}, Class III: ${metrics.classIII}. `
    + `Avg recovery: ${metrics.avgRecoveryPercent}%. CAPA linked: ${metrics.capaLinked}. Avg closure: ${metrics.avgClosureDays} days.`;
}

export function buildRecallReportRecommendations(management: RecallManagementReviewSummary): string {
  return management.recommendations.map((t, i) => `${i + 1}. ${t}`).join('\n');
}

export function computeRecallReportAnalytics(
  allRecords: RecallRecord[],
  filters: RecallReportFilterInput,
  context: RecallReportContext = { distributions: [], recoveries: [], regulatoryNotifications: [], closures: [] },
  role?: string,
  userId?: string,
): RecallReportAnalyticsResult {
  const scoped = filterRecallsByRole(allRecords, role, userId);
  const filtered = applyRecallReportFilters(scoped, filters);
  const recallIds = new Set(filtered.map((r) => r.id));
  const metrics = computeRecallReportMetrics(filtered, context.closures);
  const charts = buildRecallReportCharts(filtered, context.closures);
  const previewRows = filtered.map((r) => toRecallPreviewRow(r, context.closures));
  const managementReview = buildRecallManagementReview(filtered, context.closures);

  return {
    metrics,
    charts,
    previewRows,
    summary: buildRecallReportSummary(filters, metrics, filtered.length),
    recommendations: buildRecallReportRecommendations(managementReview),
    managementReview,
    distributionSummary: buildDistributionSummary(context.distributions, recallIds),
    recoverySummary: buildRecoverySummary(context.recoveries, recallIds),
    regulatorySummary: buildRegulatorySummary(context.regulatoryNotifications, recallIds),
    capaSummary: buildCapaSummary(filtered),
    filtered_count: filtered.length,
  };
}

export function mapRecallReportToRecord(
  form: RecallReportFormData,
  analytics: RecallReportAnalyticsResult,
  actor: RecallReportActor,
  reportNumber: string,
): Omit<RecallReportRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    report_id: buildRecallReportId(form.report_type),
    report_name: form.report_type,
    report_number: reportNumber,
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    recall_number: form.recall_number || '',
    product: form.product || 'All',
    batch_number: form.batch_number || '',
    market_region: form.market_region || 'All',
    recall_type_filter: form.recall_type || 'All',
    recall_classification: form.recall_classification || 'All',
    status_filter: form.status || 'All',
    regulatory_notification_required: form.regulatory_notification_required || 'All',
    capa_required: form.capa_required || 'All',
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
    distribution_summary: analytics.distributionSummary,
    recovery_summary: analytics.recoverySummary,
    regulatory_summary: analytics.regulatorySummary,
    capa_summary: analytics.capaSummary,
    summary: analytics.summary,
    recommendations: analytics.recommendations,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function summarizeRecallReportsDashboard(records: RecallRecord[], context?: RecallReportContext): RecallReportAnalyticsResult {
  const year = new Date().getFullYear();
  return computeRecallReportAnalytics(records, {
    report_type: 'Recall Register',
    review_period_from: `${year}-01-01`,
    review_period_to: `${year}-12-31`,
  }, context);
}

export function canViewRecallReportsModule(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'regulatory_affairs', 'warehouse', 'warehouse_manager', 'auditor', 'viewer',
  ].includes(r);
}

export function canGenerateRecallReportsModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canGenerateRecallReportTypeModule(role?: string | null, reportType?: RecallReportType): boolean {
  if (!reportType) return canGenerateRecallReportsModule(role);
  const r = normalizeRole(role || '');
  if (RECALL_REGULATORY_REPORT_TYPES.includes(reportType)) {
    return ['super_admin', 'admin', 'head_qa', 'regulatory_affairs'].includes(r);
  }
  if (RECALL_RECOVERY_REPORT_TYPES.includes(reportType)) {
    return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'warehouse', 'warehouse_manager'].includes(r);
  }
  if (RECALL_MANAGEMENT_REPORT_TYPES.includes(reportType)) {
    return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(r);
  }
  return canGenerateRecallReportsModule(role);
}

export function canExportRecallReportsModule(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor'].includes(r);
}

export function canViewRecallManagementReviewModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(normalizeRole(role || ''));
}

export function isRecallReportsReadOnlyModule(role?: string | null): boolean {
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

export function extractRecallReportProductOptions(records: RecallRecord[]): string[] {
  const set = new Set(records.map((r) => r.product_name).filter(Boolean));
  return ['All', ...Array.from(set).sort()];
}

export function extractRecallReportMarketOptions(records: RecallRecord[]): string[] {
  const set = new Set(records.map((r) => r.market_region).filter(Boolean));
  return ['All', ...Array.from(set).sort()];
}
