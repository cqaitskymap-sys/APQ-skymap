import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  CAPA_DEPARTMENTS,
  CAPA_PRIORITIES,
  CAPA_SOURCES,
  CAPA_TREND_STATUSES,
  type CapaRecord,
  type CapaTrendMetrics,
  type CapaTrendRecord,
} from '@/lib/capa-types';
import {
  computeCapaChartData,
  computeExtendedCapaDashboardMetrics,
} from '@/lib/capa-dashboard-records';

export { CAPA_TREND_STATUSES };

export const CAPA_TREND_MODULE = 'CAPA Trend Analysis';
export const CAPA_CLOSURE_TARGET_DAYS = 45;

export type CapaTrendActor = { id: string; name: string; role?: string };

export interface CapaTrendFilterInput {
  review_period_from: string;
  review_period_to: string;
  department?: string;
  product?: string;
  capa_source?: string;
  root_cause_category?: string;
  priority?: string;
}

export interface CapaTrendAnalysisResult {
  metrics: CapaTrendMetrics;
  charts: CapaTrendMetrics;
  alerts: string[];
  trend_status: typeof CAPA_TREND_STATUSES[number];
  risk_level: string;
  conclusion_draft: string;
  recommendation_draft: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Review period is required');

export const capaTrendFilterSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().optional(),
  product: z.string().optional(),
  capa_source: z.string().optional(),
  root_cause_category: z.string().optional(),
  priority: z.string().optional(),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export const capaTrendSaveSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().default('All'),
  product: z.string().default('All'),
  capa_source: z.string().default('All'),
  root_cause_category: z.string().default('All'),
  priority: z.string().default('All'),
  conclusion: z.string().trim().min(1, 'Conclusion is required'),
  recommendation: z.string().trim().min(1, 'Recommendation is required'),
});

export type CapaTrendFilterForm = z.infer<typeof capaTrendFilterSchema>;
export type CapaTrendSaveForm = z.infer<typeof capaTrendSaveSchema>;

export const CAPA_TREND_FILTER_OPTIONS = {
  departments: ['All', ...CAPA_DEPARTMENTS],
  sources: ['All', ...CAPA_SOURCES],
  priorities: ['All', ...CAPA_PRIORITIES],
};

export function buildCapaTrendId(from: string, to: string): string {
  return `CTA-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
}

function inPeriod(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(d.getTime())) return false;
  return d >= f && d <= t;
}

function rootCauseLabel(r: CapaRecord): string {
  const rc = (r.root_cause || 'Not Documented').trim();
  return rc.length > 50 ? `${rc.slice(0, 50)}…` : rc;
}

export function filterCapasForTrend(records: CapaRecord[], filters: CapaTrendFilterInput): CapaRecord[] {
  return records.filter((r) => {
    const date = r.capa_date || r.created_at?.slice(0, 10);
    if (!inPeriod(date, filters.review_period_from, filters.review_period_to)) return false;
    if (filters.department && filters.department !== 'All' && r.department !== filters.department) return false;
    if (filters.product && filters.product !== 'All' && r.product_name !== filters.product) return false;
    if (filters.capa_source && filters.capa_source !== 'All' && r.capa_source !== filters.capa_source) return false;
    if (filters.priority && filters.priority !== 'All' && r.priority !== filters.priority) return false;
    if (filters.root_cause_category && filters.root_cause_category !== 'All') {
      if (rootCauseLabel(r) !== filters.root_cause_category) return false;
    }
    return true;
  });
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
    .slice(0, 12);
}

function computePriorityTrend(records: CapaRecord[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const p = r.priority || 'medium';
    map.set(p, (map.get(p) || 0) + 1);
  }
  return CAPA_PRIORITIES.map((p) => ({ name: p, count: map.get(p) || 0 }));
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

function isSeriesIncreasing(series: { count?: number }[]): boolean {
  if (series.length < 2) return false;
  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid).reduce((s, m) => s + (m.count ?? 0), 0);
  const second = series.slice(mid).reduce((s, m) => s + (m.count ?? 0), 0);
  return second > first;
}

function computeTrendStatus(metrics: CapaTrendMetrics, alerts: string[]): typeof CAPA_TREND_STATUSES[number] {
  if (metrics.total === 0) return 'Insufficient Data';
  if (metrics.avgClosureDays > CAPA_CLOSURE_TARGET_DAYS && metrics.closed > 0) return 'Critical';
  if (alerts.some((a) => /high risk alert|critical/i.test(a))) return 'Critical';
  const months = metrics.monthlyTrend.filter((m) => (m.count ?? 0) > 0);
  if (months.length >= 2) {
    const mid = Math.floor(months.length / 2);
    const first = months.slice(0, mid).reduce((s, m) => s + (m.count ?? 0), 0);
    const second = months.slice(mid).reduce((s, m) => s + (m.count ?? 0), 0);
    if (second > first * 1.1) return 'Increasing';
    if (second < first * 0.85 && metrics.closed >= metrics.open) return 'Improving';
  }
  if (alerts.some((a) => /repeat capa trend alert/i.test(a))) return 'Increasing';
  return 'Stable';
}

function computeRiskLevel(metrics: CapaTrendMetrics, alerts: string[]): string {
  if (metrics.total === 0) return 'Low';
  let score = 0;
  if (metrics.overdue > 0) score += metrics.overdue;
  if (metrics.notEffective > 0) score += metrics.notEffective * 2;
  if (metrics.avgClosureDays > CAPA_CLOSURE_TARGET_DAYS) score += 4;
  if (alerts.some((a) => /high risk alert/i.test(a))) score += 5;
  if (score >= 12) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

export function computeCapaTrendMetrics(records: CapaRecord[]): CapaTrendMetrics {
  const base = computeExtendedCapaDashboardMetrics(records);
  const charts = computeCapaChartData(records);
  return {
    total: base.total,
    open: base.open,
    closed: base.closed,
    overdue: base.overdue,
    effective: base.effective,
    notEffective: base.notEffective,
    avgClosureDays: base.avgClosureDays,
    monthlyTrend: charts.monthlyTrend,
    bySource: charts.bySource,
    byDepartment: charts.byDepartment,
    byRootCause: computeRootCauseTrend(records),
    byPriority: computePriorityTrend(records),
    openClosedTrend: charts.openClosedTrend,
    overdueTrend: charts.overdueTrend,
    effectivenessTrend: computeEffectivenessTrend(records),
    closureTimeTrend: charts.closureTimeTrend,
  };
}

export function computeCapaTrendAnalysis(
  allRecords: CapaRecord[],
  filters: CapaTrendFilterInput,
): CapaTrendAnalysisResult {
  const filtered = filterCapasForTrend(allRecords, filters);
  const metrics = computeCapaTrendMetrics(filtered);
  const alerts: string[] = [];

  for (const rc of metrics.byRootCause) {
    if ((rc.count ?? 0) >= 3) {
      alerts.push(`Repeat CAPA Trend Alert: "${rc.name}" occurred ${rc.count} times in review period`);
    }
  }

  if (isSeriesIncreasing(metrics.effectivenessTrend.map((m) => ({ count: m.notEffective })))) {
    alerts.push('High Risk Alert: Not Effective CAPA count is increasing over the review period');
  }

  if (isSeriesIncreasing(metrics.overdueTrend)) {
    alerts.push('Overdue Trend: Overdue CAPA volume is increasing — QA Head notification recommended');
  }

  if (metrics.avgClosureDays > CAPA_CLOSURE_TARGET_DAYS && metrics.closed > 0) {
    alerts.push(`Closure Performance: Average closure time (${metrics.avgClosureDays} days) exceeds target (${CAPA_CLOSURE_TARGET_DAYS} days)`);
  }

  const trend_status = computeTrendStatus(metrics, alerts);
  const risk_level = computeRiskLevel(metrics, alerts);

  const conclusion_draft = metrics.total === 0
    ? 'Insufficient CAPA data for the selected review period and filters.'
    : `During ${filters.review_period_from} to ${filters.review_period_to}, ${metrics.total} CAPA record(s) were analyzed `
      + `(${metrics.open} open, ${metrics.closed} closed, ${metrics.overdue} overdue). `
      + `Effectiveness: ${metrics.effective} effective, ${metrics.notEffective} not effective. `
      + `Trend status: ${trend_status}. Average closure: ${metrics.avgClosureDays} days.`;

  const recommendation_draft = alerts.length
    ? alerts.map((a) => `• ${a}`).join('\n')
    : 'Continue monitoring CAPA metrics. No immediate escalation indicated. Review during next management review.';

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

export function mapCapaTrendToRecord(
  input: CapaTrendSaveForm & CapaTrendFilterInput,
  analysis: CapaTrendAnalysisResult,
  actor: CapaTrendActor,
): Omit<CapaTrendRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    trend_id: buildCapaTrendId(input.review_period_from, input.review_period_to),
    review_period_from: input.review_period_from,
    review_period_to: input.review_period_to,
    department: input.department || 'All',
    product: input.product || 'All',
    capa_source: input.capa_source || 'All',
    root_cause_category: input.root_cause_category || 'All',
    priority: input.priority || 'All',
    total_capa: analysis.metrics.total,
    open_capa: analysis.metrics.open,
    closed_capa: analysis.metrics.closed,
    overdue_capa: analysis.metrics.overdue,
    effective_capa: analysis.metrics.effective,
    not_effective_capa: analysis.metrics.notEffective,
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
      capa_source: input.capa_source || 'All',
      root_cause_category: input.root_cause_category || 'All',
      priority: input.priority || 'All',
    },
    created_at: now,
    updated_at: now,
    created_by: actor.id,
    updated_by: actor.id,
    is_deleted: false,
  };
}

export function getCapaTrendSummaryForDashboard(analysis: CapaTrendAnalysisResult | null): string {
  if (!analysis || analysis.filtered_count === 0) return 'No CAPA trend data available for management summary.';
  return `${analysis.trend_status} CAPA trend (${analysis.metrics.total} records): ${analysis.conclusion_draft.slice(0, 280)}`;
}

export function canViewCapaTrend(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canGenerateCapaTrend(role?: string | null): boolean {
  return ['super_admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canReviewCapaTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role || ''));
}

export function canApproveCapaTrend(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canExportCapaTrend(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isCapaTrendReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
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

export function extractRootCauseOptions(records: CapaRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) set.add(rootCauseLabel(r));
  return ['All', ...Array.from(set).sort().slice(0, 50)];
}

export function extractProductOptions(records: CapaRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) {
    if (r.product_name?.trim()) set.add(r.product_name.trim());
  }
  return ['All', ...Array.from(set).sort()];
}
