import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  computeComplaintChartData,
  computeComplaintDashboardMetrics,
  isMarketImpact,
} from '@/lib/complaint-dashboard-records';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CRITICALITIES,
  COMPLAINT_TREND_STATUSES,
  type ComplaintDashboardChartData,
  type ComplaintDashboardMetrics,
  type ComplaintRecord,
  type ComplaintTrendRecord,
} from '@/lib/complaint-types';

export { COMPLAINT_TREND_STATUSES };

export const COMPLAINT_CLOSURE_TARGET_DAYS = 30;
export const COMPLAINT_TREND_MODULE = 'Complaint Trend Analysis';

export type ComplaintTrendActor = { id: string; name: string; role?: string };

export interface ComplaintTrendFilterInput {
  review_period_from: string;
  review_period_to: string;
  product?: string;
  market_region?: string;
  complaint_category?: string;
  criticality?: string;
  root_cause_category?: string;
}

export interface ComplaintTrendAnalysisResult {
  metrics: ComplaintDashboardMetrics;
  charts: ComplaintDashboardChartData;
  alerts: string[];
  trend_status: typeof COMPLAINT_TREND_STATUSES[number];
  risk_level: string;
  high_risk_count: number;
  conclusion_draft: string;
  recommendation_draft: string;
  pqr_summary_draft: string;
  management_summary_draft: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Review period is required');

export const complaintTrendFilterSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  product: z.string().optional(),
  market_region: z.string().optional(),
  complaint_category: z.string().optional(),
  criticality: z.string().optional(),
  root_cause_category: z.string().optional(),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export const complaintTrendSaveSchema = z.object({
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  product: z.string().default('All'),
  market_region: z.string().default('All'),
  complaint_category: z.string().default('All'),
  criticality: z.string().default('All'),
  root_cause_category: z.string().default('All'),
  conclusion: z.string().trim().min(1, 'Conclusion is required'),
  recommendation: z.string().trim().min(1, 'Recommendation is required'),
  pqr_summary: z.string().optional().default(''),
  management_summary: z.string().optional().default(''),
});

export type ComplaintTrendFilterForm = z.infer<typeof complaintTrendFilterSchema>;
export type ComplaintTrendSaveForm = z.infer<typeof complaintTrendSaveSchema>;

export function buildComplaintTrendId(from: string, to: string): string {
  const f = from.replace(/-/g, '');
  const t = to.replace(/-/g, '');
  return `CTA-${f}-${t}-${Date.now().toString(36).toUpperCase()}`;
}

function inPeriod(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(d.getTime())) return false;
  return d >= f && d <= t;
}

export function filterComplaintsForTrend(
  records: ComplaintRecord[],
  filters: ComplaintTrendFilterInput,
): ComplaintRecord[] {
  return records.filter((r) => {
    if (r.status === 'draft') return false;
    const date = r.complaint_date || r.created_at?.slice(0, 10);
    if (!inPeriod(date, filters.review_period_from, filters.review_period_to)) return false;
    if (filters.product && filters.product !== 'All' && r.product_name !== filters.product) return false;
    if (filters.market_region && filters.market_region !== 'All' && r.market_region !== filters.market_region) return false;
    if (filters.complaint_category && filters.complaint_category !== 'All' && r.complaint_category !== filters.complaint_category) return false;
    if (filters.criticality && filters.criticality !== 'All' && r.complaint_criticality !== filters.criticality) return false;
    if (filters.root_cause_category && filters.root_cause_category !== 'All') {
      const rc = (r.root_cause || 'Not Documented').trim().slice(0, 50) || 'Not Documented';
      if (rc !== filters.root_cause_category) return false;
    }
    return true;
  });
}

function monthlyCriticalTrend(records: ComplaintRecord[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.complaint_criticality !== 'Critical') continue;
    const month = r.complaint_date?.slice(0, 7) || r.created_at?.slice(0, 7) || 'Unknown';
    map.set(month, (map.get(month) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function productMonthlyTrend(records: ComplaintRecord[], product: string): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (product !== 'All' && r.product_name !== product) continue;
    const month = r.complaint_date?.slice(0, 7) || r.created_at?.slice(0, 7) || 'Unknown';
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
  metrics: ComplaintDashboardMetrics,
  charts: ComplaintDashboardChartData,
  alerts: string[],
): typeof COMPLAINT_TREND_STATUSES[number] {
  if (metrics.total === 0) return 'Insufficient Data';
  if (alerts.some((a) => /critical complaint/i.test(a)) || metrics.critical >= 5) return 'Critical';
  const months = charts.monthlyTrend.filter((m) => (m.count ?? 0) > 0);
  if (months.length >= 2) {
    const mid = Math.floor(months.length / 2);
    const first = months.slice(0, mid).reduce((s, m) => s + (m.count ?? 0), 0);
    const second = months.slice(mid).reduce((s, m) => s + (m.count ?? 0), 0);
    if (second > first * 1.1) return 'Increasing';
    if (second < first * 0.85 && metrics.closed >= metrics.open) return 'Improving';
  }
  if (alerts.some((a) => /repeat complaint alert|product risk alert/i.test(a))) return 'Increasing';
  return 'Stable';
}

function computeRiskLevel(metrics: ComplaintDashboardMetrics, alerts: string[]): string {
  if (metrics.total === 0) return 'Low';
  let score = 0;
  if (metrics.critical > 0) score += metrics.critical * 2;
  if (metrics.repeatComplaints > 0) score += metrics.repeatComplaints;
  if (metrics.avgClosureDays > COMPLAINT_CLOSURE_TARGET_DAYS) score += 3;
  if (metrics.recallEvaluationRequired > 0) score += 2;
  if (alerts.some((a) => /risk alert|repeat complaint alert/i.test(a))) score += 4;
  if (score >= 12) return 'Critical';
  if (score >= 7) return 'High';
  if (score >= 3) return 'Medium';
  return 'Low';
}

export function computeComplaintTrendAnalysis(
  allRecords: ComplaintRecord[],
  filters: ComplaintTrendFilterInput,
): ComplaintTrendAnalysisResult {
  const filtered = filterComplaintsForTrend(allRecords, filters);
  const metrics = computeComplaintDashboardMetrics(filtered);
  const charts = computeComplaintChartData(filtered);
  const alerts: string[] = [];

  const categoryCounts = new Map<string, number>();
  for (const r of filtered) {
    const cat = r.complaint_category || 'Other';
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  for (const [cat, count] of Array.from(categoryCounts.entries())) {
    if (count >= 3) {
      alerts.push(`Repeat Complaint Alert: "${cat}" occurred ${count} times in review period`);
    }
  }

  const productCounts = new Map<string, number>();
  for (const r of filtered) {
    const p = r.product_name || 'Unknown';
    productCounts.set(p, (productCounts.get(p) || 0) + 1);
  }
  for (const [product, count] of Array.from(productCounts.entries())) {
    if (product === 'Unknown') continue;
    const series = productMonthlyTrend(filtered, product);
    if (count >= 2 && isIncreasing(series)) {
      alerts.push(`Product Risk Alert: Complaints for "${product}" are increasing (${count} in period)`);
    }
  }

  const criticalSeries = monthlyCriticalTrend(filtered);
  if (isIncreasing(criticalSeries)) {
    alerts.push('Critical Complaint Alert: Critical complaints are increasing — Head QA notification recommended');
  }

  const marketImpactRecords = filtered.filter(isMarketImpact);
  if (marketImpactRecords.length >= 2) {
    alerts.push(`Recall Evaluation Recommendation: ${marketImpactRecords.length} market-impact complaint(s) — evaluate recall need`);
  }

  if (metrics.avgClosureDays > COMPLAINT_CLOSURE_TARGET_DAYS && metrics.closed > 0) {
    alerts.push(`Closure Performance: Average closure time (${metrics.avgClosureDays} days) exceeds target (${COMPLAINT_CLOSURE_TARGET_DAYS} days)`);
  }

  const repeatedRootCauses = (charts.byRootCause || []).filter((r) => (r.count ?? 0) >= 2);
  if (repeatedRootCauses.length) {
    const names = repeatedRootCauses.map((r) => `"${r.name}" (${r.count})`).join(', ');
    alerts.push(`Root Cause Trend: Repeated root causes — ${names}`);
  }

  const trend_status = computeTrendStatus(metrics, charts, alerts);
  const risk_level = computeRiskLevel(metrics, alerts);
  const high_risk_count = alerts.filter((a) => /alert|recommendation|performance/i.test(a)).length;

  const conclusion_draft = metrics.total === 0
    ? 'Insufficient complaint data for the selected review period and filters.'
    : `During ${filters.review_period_from} to ${filters.review_period_to}, ${metrics.total} complaint(s) were recorded `
      + `(${metrics.open} open, ${metrics.closed} closed). Trend status: ${trend_status}. `
      + `${metrics.repeatComplaints} repeat complaint(s), ${metrics.capaLinked} CAPA-linked, and ${metrics.recallEvaluationRequired} recall evaluation case(s) observed. `
      + `Average closure time: ${metrics.avgClosureDays} days.`;

  const recommendation_draft = alerts.length
    ? alerts.map((a) => `• ${a}`).join('\n')
    : 'Continue monitoring complaint metrics. No immediate corrective action indicated.';

  const pqr_summary_draft = metrics.total === 0
    ? 'No complaint trend data available for PQR section in selected period.'
    : `PQR Complaint Summary (${filters.review_period_from} to ${filters.review_period_to}): `
      + `${metrics.total} complaints; ${metrics.critical} critical, ${metrics.major} major; `
      + `CAPA linked ${metrics.capaLinked}; avg closure ${metrics.avgClosureDays} days. Status: ${trend_status}.`;

  const management_summary_draft = metrics.total === 0
    ? 'Management dashboard: no complaint trends in selected filters.'
    : `Complaint trend ${trend_status} with ${metrics.total} records. Risk: ${risk_level}. `
      + `${high_risk_count} alert(s) require management attention.`;

  return {
    metrics,
    charts,
    alerts,
    trend_status,
    risk_level,
    high_risk_count,
    conclusion_draft,
    recommendation_draft,
    pqr_summary_draft,
    management_summary_draft,
    filtered_count: filtered.length,
  };
}

export function mapComplaintTrendToRecord(
  input: ComplaintTrendSaveForm & ComplaintTrendFilterInput,
  analysis: ComplaintTrendAnalysisResult,
  actor: ComplaintTrendActor,
): Omit<ComplaintTrendRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    trend_id: buildComplaintTrendId(input.review_period_from, input.review_period_to),
    review_period_from: input.review_period_from,
    review_period_to: input.review_period_to,
    product: input.product || 'All',
    market_region: input.market_region || 'All',
    complaint_category: input.complaint_category || 'All',
    criticality: input.criticality || 'All',
    root_cause_category: input.root_cause_category || 'All',
    total_complaints: analysis.metrics.total,
    open_complaints: analysis.metrics.open,
    closed_complaints: analysis.metrics.closed,
    repeat_complaints: analysis.metrics.repeatComplaints,
    capa_linked_complaints: analysis.metrics.capaLinked,
    recall_evaluation_complaints: analysis.metrics.recallEvaluationRequired,
    average_closure_days: analysis.metrics.avgClosureDays,
    trend_status: analysis.trend_status,
    risk_level: analysis.risk_level,
    conclusion: input.conclusion,
    recommendation: input.recommendation,
    pqr_summary: input.pqr_summary?.trim() || analysis.pqr_summary_draft,
    management_summary: input.management_summary?.trim() || analysis.management_summary_draft,
    generated_by: actor.id,
    generated_by_name: actor.name,
    generated_date: now.split('T')[0],
    alerts: analysis.alerts,
    chart_snapshot: { metrics: analysis.metrics, charts: analysis.charts } as unknown as Record<string, unknown>,
    filters: {
      product: input.product || 'All',
      market_region: input.market_region || 'All',
      complaint_category: input.complaint_category || 'All',
      criticality: input.criticality || 'All',
      root_cause_category: input.root_cause_category || 'All',
    },
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function canViewComplaintTrend(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return ['regulatory_affairs', 'qc_manager', 'qc'].includes(r);
}

export function canGenerateComplaintTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role || ''));
}

export function canReviewComplaintTrend(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa'].includes(normalizeRole(role || ''));
}

export function canApproveComplaintTrend(role?: string | null): boolean {
  return ['super_admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canExportComplaintTrend(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function canViewMarketComplaintTrend(role?: string | null): boolean {
  return canViewComplaintTrend(role);
}

export function isComplaintTrendReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function complaintTrendStatusColor(status: string): string {
  const map: Record<string, string> = {
    Improving: 'bg-green-100 text-green-800',
    Stable: 'bg-slate-100 text-slate-700',
    Increasing: 'bg-amber-100 text-amber-800',
    Critical: 'bg-red-100 text-red-800',
    'Insufficient Data': 'bg-gray-100 text-gray-600',
  };
  return map[status] || map.Stable;
}

export function complaintTrendRiskColor(level: string): string {
  const map: Record<string, string> = {
    Low: 'bg-slate-100 text-slate-700',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800',
  };
  return map[level] || map.Low;
}

export const COMPLAINT_TREND_FILTER_OPTIONS = {
  categories: ['All', ...COMPLAINT_CATEGORIES],
  criticalities: ['All', ...COMPLAINT_CRITICALITIES],
};

export function emptyComplaintChartData(): ComplaintDashboardChartData {
  return {
    monthlyTrend: [],
    byProduct: [],
    byMarket: [],
    byCategory: [],
    byCriticality: [],
    byRootCause: [],
    byCustomer: [],
    byBatch: [],
    openClosedTrend: [],
    capaLinkedTrend: [],
    recallEvaluationTrend: [],
    repeatComplaintTrend: [],
    closureTimeTrend: [],
  };
}
