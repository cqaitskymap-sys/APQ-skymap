import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import { computeExtendedDashboardMetrics } from '@/lib/deviation-dashboard-metrics';
import {
  DEVIATION_CATEGORIES,
  DEPARTMENTS,
  DEVIATION_CRITICALITIES,
  TREND_STATUSES,
  type DeviationDashboardMetrics,
  type DeviationRecord,
  type DeviationTrendRecord,
} from '@/lib/deviation-types';

export { TREND_STATUSES };

export const CLOSURE_TARGET_DAYS = 30;
export const TREND_MODULE = 'Deviation Trend Analysis';

export type TrendActor = { id: string; name: string; role?: string };

export interface TrendFilterInput {
  review_period_from: string;
  review_period_to: string;
  department?: string;
  product?: string;
  deviation_category?: string;
  criticality?: string;
  root_cause_category?: string;
}

export interface TrendAnalysisResult {
  metrics: DeviationDashboardMetrics;
  alerts: string[];
  trend_status: typeof TREND_STATUSES[number];
  risk_level: string;
  high_risk_count: number;
  conclusion_draft: string;
  recommendation_draft: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Review period is required');

export const trendFilterSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().optional(),
  product: z.string().optional(),
  deviation_category: z.string().optional(),
  criticality: z.string().optional(),
  root_cause_category: z.string().optional(),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export const trendSaveSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().default('All'),
  product: z.string().default('All'),
  deviation_category: z.string().default('All'),
  criticality: z.string().default('All'),
  root_cause_category: z.string().default('All'),
  conclusion: z.string().trim().min(1, 'Conclusion is required'),
  recommendation: z.string().trim().min(1, 'Recommendation is required'),
});

export type TrendFilterForm = z.infer<typeof trendFilterSchema>;
export type TrendSaveForm = z.infer<typeof trendSaveSchema>;

export function buildTrendId(from: string, to: string): string {
  const f = from.replace(/-/g, '');
  const t = to.replace(/-/g, '');
  return `DTA-${f}-${t}-${Date.now().toString(36).toUpperCase()}`;
}

function inPeriod(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(d.getTime())) return false;
  return d >= f && d <= t;
}

export function filterDeviationsForTrend(
  records: DeviationRecord[],
  filters: TrendFilterInput,
): DeviationRecord[] {
  return records.filter((r) => {
    const date = r.deviation_date || r.created_at?.slice(0, 10);
    if (!inPeriod(date, filters.review_period_from, filters.review_period_to)) return false;
    if (filters.department && filters.department !== 'All' && r.department !== filters.department) return false;
    if (filters.product && filters.product !== 'All' && r.product_name !== filters.product) return false;
    if (filters.deviation_category && filters.deviation_category !== 'All' && r.category !== filters.deviation_category) return false;
    if (filters.criticality && filters.criticality !== 'All' && r.criticality !== filters.criticality) return false;
    if (filters.root_cause_category && filters.root_cause_category !== 'All') {
      const rc = (r.root_cause || 'Not Documented').slice(0, 40);
      if (rc !== filters.root_cause_category) return false;
    }
    return true;
  });
}

function monthlyCriticalTrend(records: DeviationRecord[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.criticality !== 'Critical') continue;
    const month = r.deviation_date?.slice(0, 7) || r.created_at?.slice(0, 7) || 'Unknown';
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function isIncreasing(series: { count: number }[]): boolean {
  if (series.length < 2) return false;
  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid).reduce((s, m) => s + m.count, 0);
  const second = series.slice(mid).reduce((s, m) => s + m.count, 0);
  return second > first;
}

function computeTrendStatus(
  metrics: DeviationDashboardMetrics,
  alerts: string[],
): typeof TREND_STATUSES[number] {
  if (metrics.total === 0) return 'Insufficient Data';
  if (alerts.some((a) => /critical deviation/i.test(a)) || metrics.critical >= 5) return 'Critical';
  const months = metrics.monthlyTrend.filter((m) => (m.count ?? 0) > 0);
  if (months.length >= 2) {
    const mid = Math.floor(months.length / 2);
    const first = months.slice(0, mid).reduce((s, m) => s + (m.count ?? 0), 0);
    const second = months.slice(mid).reduce((s, m) => s + (m.count ?? 0), 0);
    if (second > first * 1.1) return 'Increasing';
    if (second < first * 0.85 && metrics.closed >= metrics.open) return 'Improving';
  }
  if (alerts.some((a) => /repeat trend alert/i.test(a))) return 'Increasing';
  return 'Stable';
}

function computeRiskLevel(metrics: DeviationDashboardMetrics, alerts: string[]): string {
  if (metrics.total === 0) return 'Low';
  let score = 0;
  if (metrics.critical > 0) score += metrics.critical * 2;
  if (metrics.repeat > 0) score += metrics.repeat;
  if (metrics.avgClosureDays > CLOSURE_TARGET_DAYS) score += 3;
  if (alerts.some((a) => /risk alert/i.test(a))) score += 4;
  if (score >= 12) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

export function computeTrendAnalysis(
  allRecords: DeviationRecord[],
  filters: TrendFilterInput,
): TrendAnalysisResult {
  const filtered = filterDeviationsForTrend(allRecords, filters);
  const metrics = computeExtendedDashboardMetrics(filtered);
  const alerts: string[] = [];

  const categoryCounts = new Map<string, number>();
  for (const r of filtered) {
    const cat = r.category || 'Other';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  for (const [cat, count] of Array.from(categoryCounts.entries())) {
    if (count >= 3) {
      alerts.push(`Repeat Trend Alert: "${cat}" occurred ${count} times in review period`);
    }
  }

  const criticalSeries = monthlyCriticalTrend(filtered);
  if (isIncreasing(criticalSeries)) {
    alerts.push('Risk Alert: Critical deviations are increasing over the review period');
  }

  if (metrics.avgClosureDays > CLOSURE_TARGET_DAYS && metrics.closed > 0) {
    alerts.push(`Overdue Trend: Average closure time (${metrics.avgClosureDays} days) exceeds target (${CLOSURE_TARGET_DAYS} days)`);
  }

  const repeatedRootCauses = (metrics.byRootCause || []).filter((r) => (r.count ?? 0) >= 2);
  if (repeatedRootCauses.length) {
    const names = repeatedRootCauses.map((r) => `"${r.name}" (${r.count})`).join(', ');
    alerts.push(`CAPA Suggestion: Repeated root causes identified — ${names}`);
  }

  const trend_status = computeTrendStatus(metrics, alerts);
  const risk_level = computeRiskLevel(metrics, alerts);
  const high_risk_count = alerts.filter((a) => /alert|overdue|critical/i.test(a)).length;

  const conclusion_draft = metrics.total === 0
    ? 'Insufficient deviation data for the selected review period and filters.'
    : `During ${filters.review_period_from} to ${filters.review_period_to}, ${metrics.total} deviation(s) were recorded `
      + `(${metrics.open} open, ${metrics.closed} closed). Trend status: ${trend_status}. `
      + `${metrics.repeat} repeat deviation(s) and ${metrics.capaLinked} CAPA-linked record(s) were observed. `
      + `Average closure time: ${metrics.avgClosureDays} days.`;

  const recommendation_draft = alerts.length
    ? alerts.map((a) => `• ${a}`).join('\n')
    : 'Continue monitoring deviation metrics. No immediate corrective action indicated.';

  return {
    metrics,
    alerts,
    trend_status,
    risk_level,
    high_risk_count,
    conclusion_draft,
    recommendation_draft,
    filtered_count: filtered.length,
  };
}

export function mapTrendToRecord(
  input: TrendSaveForm & TrendFilterInput,
  analysis: TrendAnalysisResult,
  actor: TrendActor,
): Omit<DeviationTrendRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    trend_id: buildTrendId(input.review_period_from, input.review_period_to),
    review_period_from: input.review_period_from,
    review_period_to: input.review_period_to,
    department: input.department || 'All',
    product: input.product || 'All',
    deviation_category: input.deviation_category || 'All',
    criticality: input.criticality || 'All',
    root_cause_category: input.root_cause_category || 'All',
    total_deviations: analysis.metrics.total,
    open_deviations: analysis.metrics.open,
    closed_deviations: analysis.metrics.closed,
    repeat_deviations: analysis.metrics.repeat,
    capa_linked_deviations: analysis.metrics.capaLinked,
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
      department: input.department || 'All',
      product: input.product || 'All',
      deviation_category: input.deviation_category || 'All',
      criticality: input.criticality || 'All',
      root_cause_category: input.root_cause_category || 'All',
    },
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function canViewTrend(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canGenerateTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role));
}

export function canReviewTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role));
}

export function canApproveTrend(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}

export function canExportTrend(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isTrendReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function trendStatusColor(status: string): string {
  const map: Record<string, string> = {
    Improving: 'bg-green-100 text-green-800',
    Stable: 'bg-slate-100 text-slate-700',
    Increasing: 'bg-amber-100 text-amber-800',
    Critical: 'bg-red-100 text-red-800',
    'Insufficient Data': 'bg-gray-100 text-gray-600',
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

export const TREND_FILTER_OPTIONS = {
  departments: ['All', ...DEPARTMENTS],
  categories: ['All', ...DEVIATION_CATEGORIES],
  criticalities: ['All', ...DEVIATION_CRITICALITIES],
};
