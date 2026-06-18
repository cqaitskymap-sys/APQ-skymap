import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import { computeRecallChartData, computeRecallDashboardMetrics } from '@/lib/recall-dashboard-records';
import {
  isRecallClosed,
  isRecallComplaintLinked,
  isRecallCritical,
  isRegulatoryPending,
  RECALL_CLASSIFICATIONS,
  RECALL_SOURCES,
  RECALL_TREND_STATUSES,
  RECALL_TYPES,
  type RecallClosure,
  type RecallRecord,
  type RecallTrendMetrics,
  type RecallTrendRecord,
} from '@/lib/recall-types';

export { RECALL_TREND_STATUSES };

export const RECALL_TREND_MODULE = 'Recall Trend Analysis';
export const RECALL_CLOSURE_TARGET_DAYS = 30;

export type RecallTrendActor = { id: string; name: string; role?: string };

export interface RecallTrendFilterInput {
  review_period_from: string;
  review_period_to: string;
  product?: string;
  market_region?: string;
  recall_type?: string;
  recall_classification?: string;
  recall_source?: string;
}

export interface RecallTrendAnalysisResult {
  metrics: RecallTrendMetrics;
  charts: RecallTrendMetrics;
  alerts: string[];
  trend_status: typeof RECALL_TREND_STATUSES[number];
  risk_level: string;
  conclusion_draft: string;
  recommendation_draft: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Review period is required');

export const recallTrendFilterSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  product: z.string().optional(),
  market_region: z.string().optional(),
  recall_type: z.string().optional(),
  recall_classification: z.string().optional(),
  recall_source: z.string().optional(),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export const recallTrendSaveSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  product: z.string().default('All'),
  market_region: z.string().default('All'),
  recall_type: z.string().default('All'),
  recall_classification: z.string().default('All'),
  recall_source: z.string().default('All'),
  conclusion: z.string().trim().min(1, 'Conclusion is required'),
  recommendation: z.string().trim().min(1, 'Recommendation is required'),
});

export type RecallTrendFilterForm = z.infer<typeof recallTrendFilterSchema>;
export type RecallTrendSaveForm = z.infer<typeof recallTrendSaveSchema>;

export const RECALL_TREND_FILTER_OPTIONS = {
  products: ['All'],
  markets: ['All'],
  types: ['All', ...RECALL_TYPES],
  classifications: ['All', ...RECALL_CLASSIFICATIONS],
  sources: ['All', ...RECALL_SOURCES],
};

export function buildRecallTrendId(from: string, to: string): string {
  return `RTA-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
}

function inPeriod(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(d.getTime())) return false;
  return d >= f && d <= t;
}

export function filterRecallsForTrend(records: RecallRecord[], filters: RecallTrendFilterInput): RecallRecord[] {
  return records.filter((r) => {
    const date = r.recall_date || r.created_at?.slice(0, 10);
    if (!inPeriod(date, filters.review_period_from, filters.review_period_to)) return false;
    if (filters.product && filters.product !== 'All' && r.product_name !== filters.product) return false;
    if (filters.market_region && filters.market_region !== 'All' && r.market_region !== filters.market_region) return false;
    if (filters.recall_type && filters.recall_type !== 'All' && r.recall_type !== filters.recall_type) return false;
    if (filters.recall_classification && filters.recall_classification !== 'All' && r.recall_classification !== filters.recall_classification) return false;
    if (filters.recall_source && filters.recall_source !== 'All' && (r.recall_source || '') !== filters.recall_source) return false;
    return true;
  });
}

function computeByType(records: RecallRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const t = r.recall_type || 'Unknown';
    map.set(t, (map.get(t) || 0) + 1);
  }
  return RECALL_TYPES.map((t) => ({ name: t, count: map.get(t) || 0 }));
}

function computeBySource(records: RecallRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const s = r.recall_source || 'Other';
    map.set(s, (map.get(s) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function computeRegulatoryTrend(records: RecallRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.regulatory_notification_required && !isRecallCritical(r)) continue;
    const month = (r.recall_date || r.created_at || '').slice(0, 7);
    if (!month) continue;
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}

function computeClosureTimeTrend(
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

function isRecoveryDecreasing(recoveryTrend: { name: string; avgPercent: number }[]): boolean {
  if (recoveryTrend.length < 2) return false;
  const mid = Math.floor(recoveryTrend.length / 2);
  const first = recoveryTrend.slice(0, mid);
  const second = recoveryTrend.slice(mid);
  const avgFirst = first.reduce((s, m) => s + m.avgPercent, 0) / (first.length || 1);
  const avgSecond = second.reduce((s, m) => s + m.avgPercent, 0) / (second.length || 1);
  return avgSecond < avgFirst - 5;
}

function isComplaintLinkedIncreasing(records: RecallRecord[]): boolean {
  const byMonth = new Map<string, number>();
  for (const r of records.filter(isRecallComplaintLinked)) {
    const month = (r.recall_date || '').slice(0, 7);
    if (month) byMonth.set(month, (byMonth.get(month) || 0) + 1);
  }
  const months = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
  if (months.length < 2) return false;
  const mid = Math.floor(months.length / 2);
  const first = months.slice(0, mid).reduce((s, [, c]) => s + c, 0);
  const second = months.slice(mid).reduce((s, [, c]) => s + c, 0);
  return second > first;
}

function computeTrendStatus(
  metrics: RecallTrendMetrics,
  alerts: string[],
  records: RecallRecord[],
): typeof RECALL_TREND_STATUSES[number] {
  if (metrics.total === 0) return 'Insufficient Data';
  if (records.some(isRecallCritical) || alerts.some((a) => /class i|critical/i.test(a))) return 'Critical';
  if (metrics.avgClosureDays > RECALL_CLOSURE_TARGET_DAYS && metrics.closed > 0) return 'Critical';
  if (alerts.some((a) => /increasing|overdue trend/i.test(a))) return 'Increasing';
  const months = metrics.monthlyTrend.filter((m) => m.count > 0);
  if (months.length >= 2) {
    const mid = Math.floor(months.length / 2);
    const first = months.slice(0, mid).reduce((s, m) => s + m.count, 0);
    const second = months.slice(mid).reduce((s, m) => s + m.count, 0);
    if (second > first * 1.1) return 'Increasing';
    if (second < first * 0.85 && metrics.closed >= metrics.open) return 'Improving';
  }
  return 'Stable';
}

function computeRiskLevel(metrics: RecallTrendMetrics, alerts: string[]): string {
  if (metrics.total === 0) return 'Low';
  let score = 0;
  if (metrics.classI > 0) score += metrics.classI * 5;
  if (metrics.avgRecoveryPercent < 80 && metrics.total > 0) score += 3;
  if (metrics.avgClosureDays > RECALL_CLOSURE_TARGET_DAYS) score += 4;
  if (alerts.some((a) => /product risk alert/i.test(a))) score += 4;
  if (score >= 12) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

export function computeRecallTrendMetrics(
  records: RecallRecord[],
  closures: RecallClosure[] = [],
): RecallTrendMetrics {
  const dash = computeRecallDashboardMetrics(records);
  const charts = computeRecallChartData(records);

  return {
    total: dash.total,
    open: dash.open,
    closed: dash.closed,
    classI: dash.classI,
    classII: dash.classII,
    classIII: dash.classIII,
    mockRecalls: dash.mockRecalls,
    avgRecoveryPercent: dash.avgRecoveryPercent,
    capaLinkedCount: dash.capaLinked,
    regulatoryNotificationCount: records.filter((r) => r.regulatory_notification_required || isRegulatoryPending(r)).length,
    complaintLinkedCount: dash.complaintLinked,
    avgClosureDays: computeAvgClosureDays(records.filter((r) => isRecallClosed(r.recall_status)), closures),
    monthlyTrend: charts.monthlyTrend,
    byProduct: charts.byProduct,
    byMarket: charts.byMarket,
    byClassification: charts.byClassification,
    byType: computeByType(records),
    bySource: computeBySource(records),
    recoveryTrend: charts.recoveryTrend.map((r) => ({ name: r.name, avgPercent: r.avgPercent ?? r.percent ?? 0 })),
    capaLinkedTrend: charts.capaLinkedTrend,
    regulatoryTrend: computeRegulatoryTrend(records),
    closureTimeTrend: computeClosureTimeTrend(records, closures),
  };
}

export function computeRecallTrendAnalysis(
  allRecords: RecallRecord[],
  filters: RecallTrendFilterInput,
  closures: RecallClosure[] = [],
): RecallTrendAnalysisResult {
  const filtered = filterRecallsForTrend(allRecords, filters);
  const metrics = computeRecallTrendMetrics(filtered, closures);
  const alerts: string[] = [];

  for (const p of metrics.byProduct) {
    if ((p.count ?? 0) >= 2) {
      alerts.push(`Product Risk Alert: "${p.name}" had ${p.count} recall(s) in review period`);
    }
  }

  if (filtered.some(isRecallCritical)) {
    alerts.push('Critical Trend: Class I recall occurred in review period');
  }

  if (isRecoveryDecreasing(metrics.recoveryTrend)) {
    alerts.push('Recovery Performance Alert: Average recovery percentage is decreasing — notify QA and Regulatory');
  }

  if (metrics.avgClosureDays > RECALL_CLOSURE_TARGET_DAYS && metrics.closed > 0) {
    alerts.push(`Overdue Trend: Average closure time (${metrics.avgClosureDays} days) exceeds target (${RECALL_CLOSURE_TARGET_DAYS} days)`);
  }

  if (isComplaintLinkedIncreasing(filtered)) {
    alerts.push('Complaint-Linked Recall Trend: Increasing complaint-linked recalls — recommend complaint trend review');
  }

  const trend_status = computeTrendStatus(metrics, alerts, filtered);
  const risk_level = computeRiskLevel(metrics, alerts);

  const conclusion_draft = metrics.total === 0
    ? 'Insufficient recall data for the selected review period and filters.'
    : `During ${filters.review_period_from} to ${filters.review_period_to}, ${metrics.total} recall(s) were analyzed `
      + `(${metrics.open} open, ${metrics.closed} closed). Class I: ${metrics.classI}, Class II: ${metrics.classII}, Class III: ${metrics.classIII}. `
      + `Average recovery: ${metrics.avgRecoveryPercent}%. CAPA linked: ${metrics.capaLinkedCount}. `
      + `Trend status: ${trend_status}. Average closure: ${metrics.avgClosureDays} days.`;

  const recommendation_draft = alerts.length
    ? alerts.map((a) => `• ${a}`).join('\n')
    : 'Continue monitoring recall metrics. No immediate escalation indicated. Include summary in PQR and management review.';

  return {
    metrics,
    charts: metrics,
    alerts,
    trend_status,
    risk_level,
    conclusion_draft,
    recommendation_draft,
    filtered_count: filtered.length,
  };
}

export function mapRecallTrendToRecord(
  input: RecallTrendSaveForm & RecallTrendFilterInput,
  analysis: RecallTrendAnalysisResult,
  actor: RecallTrendActor,
): Omit<RecallTrendRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    trend_id: buildRecallTrendId(input.review_period_from, input.review_period_to),
    review_period_from: input.review_period_from,
    review_period_to: input.review_period_to,
    product: input.product || 'All',
    market_region: input.market_region || 'All',
    recall_type: input.recall_type || 'All',
    recall_classification: input.recall_classification || 'All',
    recall_source: input.recall_source || 'All',
    total_recalls: analysis.metrics.total,
    open_recalls: analysis.metrics.open,
    closed_recalls: analysis.metrics.closed,
    class_i_recalls: analysis.metrics.classI,
    class_ii_recalls: analysis.metrics.classII,
    class_iii_recalls: analysis.metrics.classIII,
    mock_recalls: analysis.metrics.mockRecalls,
    average_recovery_percent: analysis.metrics.avgRecoveryPercent,
    capa_linked_count: analysis.metrics.capaLinkedCount,
    regulatory_notification_count: analysis.metrics.regulatoryNotificationCount,
    average_closure_days: analysis.metrics.avgClosureDays,
    trend_status: analysis.trend_status,
    risk_level: analysis.risk_level,
    conclusion: input.conclusion,
    recommendation: input.recommendation,
    generated_by: actor.id,
    generated_by_name: actor.name,
    generated_date: now.split('T')[0],
    alerts: analysis.alerts,
    chart_snapshot: analysis.metrics as unknown as Record<string, unknown>,
    filters: {
      product: input.product || 'All',
      market_region: input.market_region || 'All',
      recall_type: input.recall_type || 'All',
      recall_classification: input.recall_classification || 'All',
      recall_source: input.recall_source || 'All',
    },
    include_in_pqr_review: true,
    created_at: now,
    updated_at: now,
    created_by: actor.id,
    updated_by: actor.id,
    is_deleted: false,
  };
}

export function getRecallTrendSummaryForDashboard(analysis: RecallTrendAnalysisResult | null): string {
  if (!analysis || analysis.filtered_count === 0) return 'No recall trend data available for management summary.';
  return `${analysis.trend_status} recall trend (${analysis.metrics.total} records): ${analysis.conclusion_draft.slice(0, 280)}`;
}

export function extractRecallProductOptions(records: RecallRecord[]): string[] {
  const set = new Set(records.map((r) => r.product_name).filter(Boolean));
  return ['All', ...Array.from(set).sort()];
}

export function extractRecallMarketOptions(records: RecallRecord[]): string[] {
  const set = new Set(records.map((r) => r.market_region).filter(Boolean));
  return ['All', ...Array.from(set).sort()];
}

export function canViewRecallTrendModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function canGenerateRecallTrendModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canGenerateRecallTrendRegulatoryModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'regulatory_affairs', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canApproveRecallTrendModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canExportRecallTrendModule(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs'].includes(normalizeRole(role || ''));
}

export function isRecallTrendReadOnlyModule(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function trendStatusColor(status: string): string {
  const map: Record<string, string> = {
    Improving: 'bg-green-100 text-green-800 border-green-200',
    Stable: 'bg-slate-100 text-slate-700 border-slate-200',
    Increasing: 'bg-amber-100 text-amber-800 border-amber-200',
    Critical: 'bg-red-100 text-red-800 border-red-200',
    'Insufficient Data': 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return map[status] || map.Stable;
}

export function riskLevelColor(level: string): string {
  const map: Record<string, string> = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[level] || map.Low;
}
