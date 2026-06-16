import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  applyOosDashboardFilters,
  computeExtendedOosDashboardMetrics,
} from '@/lib/oos-dashboard-records';
import {
  OOS_TREND_STATUSES,
  ROOT_CAUSE_CATEGORIES,
  type OosDashboardMetrics,
  type OosImpactAssessment,
  type OosPhase1,
  type OosPhase2,
  type OosRecord,
  type OosTrendRecord,
} from '@/lib/oos-types';

export { OOS_TREND_STATUSES };

export const CLOSURE_TARGET_DAYS = 30;
export const TREND_MODULE = 'OOS Trend Analysis';

export type OosTrendActor = { id: string; name: string; role?: string };

export interface OosTrendFilterInput {
  review_period_from: string;
  review_period_to: string;
  department?: string;
  product?: string;
  test_name?: string;
  parameter_name?: string;
  root_cause_category?: string;
}

export interface OosTrendAnalysisResult {
  metrics: OosDashboardMetrics & { byParameter: { name: string; count: number }[]; repeatOos: number };
  alerts: string[];
  trend_status: typeof OOS_TREND_STATUSES[number];
  risk_level: string;
  conclusion_draft: string;
  recommendation_draft: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Review period is required');

export const oosTrendFilterSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().optional(),
  product: z.string().optional(),
  test_name: z.string().optional(),
  parameter_name: z.string().optional(),
  root_cause_category: z.string().optional(),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export const oosTrendSaveSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().default('All'),
  product: z.string().default('All'),
  test_name: z.string().default('All'),
  parameter_name: z.string().default('All'),
  root_cause_category: z.string().default('All'),
  conclusion: z.string().trim().min(1, 'Conclusion is required'),
  recommendation: z.string().trim().min(1, 'Recommendation is required'),
});

export type OosTrendFilterForm = z.infer<typeof oosTrendFilterSchema>;
export type OosTrendSaveForm = z.infer<typeof oosTrendSaveSchema>;

export function buildOosTrendId(from: string, to: string): string {
  return `OTA-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
}

function monthlyCriticalTrend(records: OosRecord[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.is_critical_test && !/sterility|endotoxin|assay|content|dissolution/i.test(r.test_name)) continue;
    const month = r.oos_date?.slice(0, 7) || r.created_at?.slice(0, 7) || 'Unknown';
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

function computeRepeatOosCount(records: OosRecord[]): number {
  const comboCounts = new Map<string, number>();
  for (const r of records) {
    const key = `${r.test_name}::${r.parameter_name}`;
    comboCounts.set(key, (comboCounts.get(key) || 0) + 1);
  }
  let repeat = 0;
  Array.from(comboCounts.values()).forEach((count) => {
    if (count >= 2) repeat += count;
  });
  return repeat;
}

function computeTrendStatus(
  metrics: OosDashboardMetrics,
  alerts: string[],
): typeof OOS_TREND_STATUSES[number] {
  if (metrics.total === 0) return 'Insufficient Data';
  if (alerts.some((a) => /critical oos|risk alert/i.test(a)) || metrics.critical >= 3) return 'Critical';
  const months = metrics.monthlyTrend.filter((m) => (m.count ?? 0) > 0);
  if (months.length >= 2) {
    const mid = Math.floor(months.length / 2);
    const first = months.slice(0, mid).reduce((s, m) => s + (m.count ?? 0), 0);
    const second = months.slice(mid).reduce((s, m) => s + (m.count ?? 0), 0);
    if (second > first * 1.1) return 'Increasing';
    if (second < first * 0.85 && metrics.closed >= metrics.open) return 'Improving';
  }
  if (alerts.some((a) => /repeat oos alert/i.test(a))) return 'Increasing';
  return 'Stable';
}

function computeRiskLevel(metrics: OosDashboardMetrics, alerts: string[], repeatOos: number): string {
  if (metrics.total === 0) return 'Low';
  let score = 0;
  if (metrics.critical > 0) score += metrics.critical * 2;
  if (repeatOos > 0) score += Math.min(repeatOos, 5);
  if (metrics.avgClosureDays > CLOSURE_TARGET_DAYS) score += 3;
  if (alerts.some((a) => /risk alert/i.test(a))) score += 4;
  if (score >= 12) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

export function filterOosForTrend(
  records: OosRecord[],
  filters: OosTrendFilterInput,
  phase1Map?: Map<string, OosPhase1>,
  phase2Map?: Map<string, OosPhase2>,
  impactMap?: Map<string, OosImpactAssessment>,
): OosRecord[] {
  return applyOosDashboardFilters(records, {
    date_from: filters.review_period_from,
    date_to: filters.review_period_to,
    department: filters.department && filters.department !== 'All' ? filters.department : undefined,
    product_name: filters.product && filters.product !== 'All' ? filters.product : undefined,
    test_name: filters.test_name && filters.test_name !== 'All' ? filters.test_name : undefined,
    root_cause: filters.root_cause_category && filters.root_cause_category !== 'All' ? filters.root_cause_category : undefined,
  }, phase1Map, phase2Map, impactMap).filter((r) => {
    if (filters.parameter_name && filters.parameter_name !== 'All') {
      if (!r.parameter_name.toLowerCase().includes(filters.parameter_name.toLowerCase())) return false;
    }
    return r.status !== 'draft';
  });
}

export function computeOosTrendAnalysis(
  allRecords: OosRecord[],
  phase1List: OosPhase1[],
  phase2List: OosPhase2[],
  impactList: OosImpactAssessment[],
  filters: OosTrendFilterInput,
): OosTrendAnalysisResult {
  const phase1Map = new Map(phase1List.map((p) => [p.oos_id, p]));
  const phase2Map = new Map(phase2List.map((p) => [p.oos_id, p]));
  const impactMap = new Map(impactList.map((p) => [p.oos_id, p]));

  const filtered = filterOosForTrend(allRecords, filters, phase1Map, phase2Map, impactMap);
  const baseMetrics = computeExtendedOosDashboardMetrics(filtered, phase1List, phase2List, impactList);

  const paramMap = new Map<string, number>();
  for (const r of filtered) {
    const p = r.parameter_name || 'Unknown';
    paramMap.set(p, (paramMap.get(p) || 0) + 1);
  }
  const byParameter = Array.from(paramMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const repeatOos = computeRepeatOosCount(filtered);
  const metrics = { ...baseMetrics, byParameter, repeatOos };
  const alerts: string[] = [];

  const testParamCounts = new Map<string, number>();
  for (const r of filtered) {
    const key = `${r.test_name} / ${r.parameter_name}`;
    testParamCounts.set(key, (testParamCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of Array.from(testParamCounts.entries())) {
    if (count >= 2) {
      alerts.push(`Repeat OOS Alert: "${key}" occurred ${count} times in review period`);
    }
  }

  const criticalSeries = monthlyCriticalTrend(filtered);
  if (isIncreasing(criticalSeries)) {
    alerts.push('Risk Alert: Critical OOS events are increasing over the review period');
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
  const risk_level = computeRiskLevel(metrics, alerts, repeatOos);

  const conclusion_draft = metrics.total === 0
    ? 'Insufficient OOS data for the selected review period and filters.'
    : `During ${filters.review_period_from} to ${filters.review_period_to}, ${metrics.total} OOS record(s) were analyzed `
      + `(${metrics.open} open, ${metrics.closed} closed). Trend status: ${trend_status}. `
      + `${repeatOos} repeat OOS event(s) and ${metrics.capaLinked} CAPA-linked record(s) observed. `
      + `Average closure time: ${metrics.avgClosureDays} days. Suitable for PQR and management dashboard summary.`;

  const recommendation_draft = alerts.length
    ? alerts.map((a) => `• ${a}`).join('\n')
    : 'Continue monitoring OOS metrics. No immediate corrective action indicated.';

  return {
    metrics,
    alerts,
    trend_status,
    risk_level,
    conclusion_draft,
    recommendation_draft,
    filtered_count: filtered.length,
  };
}

export function mapOosTrendToRecord(
  input: OosTrendSaveForm & OosTrendFilterInput,
  analysis: OosTrendAnalysisResult,
  actor: OosTrendActor,
): Omit<OosTrendRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    trend_id: buildOosTrendId(input.review_period_from, input.review_period_to),
    review_period_from: input.review_period_from,
    review_period_to: input.review_period_to,
    department: input.department || 'All',
    product: input.product || 'All',
    test_name: input.test_name || 'All',
    parameter_name: input.parameter_name || 'All',
    root_cause_category: input.root_cause_category || 'All',
    total_oos: analysis.metrics.total,
    open_oos: analysis.metrics.open,
    closed_oos: analysis.metrics.closed,
    phase1_oos: analysis.metrics.phase1,
    phase2_oos: analysis.metrics.phase2,
    capa_linked_oos: analysis.metrics.capaLinked,
    repeat_oos: analysis.metrics.repeatOos,
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
      test_name: input.test_name || 'All',
      parameter_name: input.parameter_name || 'All',
      root_cause_category: input.root_cause_category || 'All',
    },
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function canViewOosTrend(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canGenerateOosTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'qc_manager', 'qc'].includes(normalizeRole(role));
}

export function canReviewOosTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role));
}

export function canApproveOosTrend(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role));
}

export function canExportOosTrend(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isOosTrendReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function oosTrendStatusColor(status: string): string {
  const map: Record<string, string> = {
    Improving: 'bg-green-100 text-green-800',
    Stable: 'bg-slate-100 text-slate-700',
    Increasing: 'bg-amber-100 text-amber-800',
    Critical: 'bg-red-100 text-red-800',
    'Insufficient Data': 'bg-gray-100 text-gray-600',
  };
  return map[status] || map.Stable;
}

export function oosTrendRiskColor(level: string): string {
  const map: Record<string, string> = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[level] || map.Low;
}

export const OOS_TREND_ROOT_CAUSES = ['All', ...ROOT_CAUSE_CATEGORIES];
