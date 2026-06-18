import { normalizeRole } from '@/lib/permissions';
import type {
  ComplaintActivityEntry,
  ComplaintDashboardChartData,
  ComplaintDashboardMetrics,
  ComplaintFilters,
  ComplaintRecord,
} from '@/lib/complaint-types';
import {
  canExportComplaintDashboard,
  canViewComplaintDashboard,
  isComplaintClosed,
  isComplaintDashboardReadOnly,
} from '@/lib/complaint-types';

export const COMPLAINT_DASHBOARD_MODULE = 'Complaint Dashboard';

export type ComplaintDashboardActor = {
  id: string;
  name: string;
  role?: string;
  department?: string;
};

export const KPI_FILTER_MAP: Record<string, Partial<ComplaintFilters>> = {
  total: {},
  open: { kpi_filter: 'open' },
  closed: { kpi_filter: 'closed' },
  critical: { kpi_filter: 'critical' },
  major: { kpi_filter: 'major' },
  minor: { kpi_filter: 'minor' },
  under_investigation: { kpi_filter: 'under_investigation' },
  capa_required: { kpi_filter: 'capa_required' },
  capa_linked: { kpi_filter: 'capa_linked' },
  recall_evaluation: { kpi_filter: 'recall_evaluation' },
  overdue: { kpi_filter: 'overdue' },
  product_quality_impact: { kpi_filter: 'product_quality_impact' },
  market_impact: { kpi_filter: 'market_impact' },
  repeat: { kpi_filter: 'repeat' },
};

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function yesValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  return false;
}

export function isComplaintCapaLinked(record: ComplaintRecord): boolean {
  return Boolean(record.linked_capa_number || record.linked_capa_id);
}

export function isRecallEvaluationRequired(record: ComplaintRecord): boolean {
  if (yesValue(record.recall_evaluation_required)) return true;
  return record.status === 'recall_evaluation';
}

export function isProductQualityImpact(record: ComplaintRecord): boolean {
  if (yesValue(record.product_quality_impact)) return true;
  return Boolean(record.product_safety_impact);
}

export function isMarketImpact(record: ComplaintRecord): boolean {
  return yesValue(record.market_impact);
}

export function isRepeatComplaint(record: ComplaintRecord): boolean {
  return record.is_repeat_complaint === true;
}

export function isComplaintOverdue(record: ComplaintRecord): boolean {
  if (isComplaintClosed(record.status)) return false;
  if (record.status === 'overdue') return true;
  if (record.due_date && record.due_date < todayIso()) return true;
  return false;
}

export function getComplaintDaysOverdue(record: ComplaintRecord): number {
  if (!isComplaintOverdue(record)) return 0;
  const due = record.due_date || record.complaint_date;
  if (!due) return 0;
  return daysBetween(due, todayIso());
}

function toSorted(m: Map<string, number>) {
  return Array.from(m.entries())
    .map(([name, count]) => ({ name, count, value: count }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

export function applyComplaintDashboardFilters(
  records: ComplaintRecord[],
  filters?: ComplaintFilters,
): ComplaintRecord[] {
  let results = [...records];
  const f = filters || {};

  if (f.kpi_filter === 'open') {
    results = results.filter((r) => !isComplaintClosed(r.status));
  }
  if (f.kpi_filter === 'closed') {
    results = results.filter((r) => r.status === 'closed');
  }
  if (f.kpi_filter === 'critical') {
    results = results.filter((r) => r.complaint_criticality === 'Critical');
  }
  if (f.kpi_filter === 'major') {
    results = results.filter((r) => r.complaint_criticality === 'Major');
  }
  if (f.kpi_filter === 'minor') {
    results = results.filter((r) => r.complaint_criticality === 'Minor');
  }
  if (f.kpi_filter === 'under_investigation') {
    results = results.filter((r) => r.status === 'under_investigation');
  }
  if (f.kpi_filter === 'capa_required') {
    results = results.filter((r) => r.capa_required || r.status === 'capa_required');
  }
  if (f.kpi_filter === 'capa_linked') {
    results = results.filter(isComplaintCapaLinked);
  }
  if (f.kpi_filter === 'recall_evaluation') {
    results = results.filter(isRecallEvaluationRequired);
  }
  if (f.kpi_filter === 'overdue') {
    results = results.filter(isComplaintOverdue);
  }
  if (f.kpi_filter === 'product_quality_impact') {
    results = results.filter(isProductQualityImpact);
  }
  if (f.kpi_filter === 'market_impact') {
    results = results.filter(isMarketImpact);
  }
  if (f.kpi_filter === 'repeat') {
    results = results.filter(isRepeatComplaint);
  }

  if (f.status && f.status !== 'all') {
    results = results.filter((r) => r.status === f.status);
  }
  if (f.complaint_category && f.complaint_category !== 'all') {
    results = results.filter((r) => r.complaint_category === f.complaint_category);
  }
  if (f.complaint_criticality && f.complaint_criticality !== 'all') {
    results = results.filter((r) => r.complaint_criticality === f.complaint_criticality);
  }
  if (f.product) {
    const q = f.product.toLowerCase();
    results = results.filter((r) => (r.product_name || '').toLowerCase().includes(q));
  }
  if (f.batch_number) {
    results = results.filter((r) => (r.batch_number || '').includes(f.batch_number!));
  }
  if (f.market_region) {
    const q = f.market_region.toLowerCase();
    results = results.filter((r) => (r.market_region || '').toLowerCase().includes(q));
  }
  if (f.date_from) {
    results = results.filter((r) => (r.complaint_date || '') >= f.date_from!);
  }
  if (f.date_to) {
    results = results.filter((r) => (r.complaint_date || '') <= f.date_to!);
  }
  if (f.search) {
    const q = f.search.toLowerCase();
    results = results.filter((r) =>
      (r.complaint_number || '').toLowerCase().includes(q)
      || (r.product_name || '').toLowerCase().includes(q)
      || (r.customer_name || '').toLowerCase().includes(q)
      || (r.batch_number || '').toLowerCase().includes(q)
      || (r.market_region || '').toLowerCase().includes(q),
    );
  }

  return results;
}

export function filterComplaintsByRole(
  records: ComplaintRecord[],
  role?: string | null,
  userId?: string,
): ComplaintRecord[] {
  const r = normalizeRole(role || '');
  if ([
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'auditor', 'viewer', 'regulatory_affairs',
  ].includes(r)) {
    return records;
  }
  return records.filter((rec) =>
    rec.assigned_to === userId
    || rec.created_by === userId
    || rec.updated_by === userId,
  );
}

export function computeComplaintDashboardMetrics(records: ComplaintRecord[]): ComplaintDashboardMetrics {
  const closedRecords = records.filter((r) => r.status === 'closed' && r.closure_date && r.complaint_date);
  const closureDays = closedRecords
    .map((r) => daysBetween(r.complaint_date, r.closure_date!))
    .filter((d) => d >= 0);
  const avgClosureDays = closureDays.length
    ? Math.round(closureDays.reduce((a, b) => a + b, 0) / closureDays.length)
    : 0;

  return {
    total: records.length,
    open: records.filter((r) => !isComplaintClosed(r.status)).length,
    closed: records.filter((r) => r.status === 'closed').length,
    critical: records.filter((r) => r.complaint_criticality === 'Critical').length,
    major: records.filter((r) => r.complaint_criticality === 'Major').length,
    minor: records.filter((r) => r.complaint_criticality === 'Minor').length,
    underInvestigation: records.filter((r) => r.status === 'under_investigation').length,
    capaRequired: records.filter((r) => r.capa_required || r.status === 'capa_required').length,
    capaLinked: records.filter(isComplaintCapaLinked).length,
    recallEvaluationRequired: records.filter(isRecallEvaluationRequired).length,
    overdue: records.filter(isComplaintOverdue).length,
    productQualityImpact: records.filter(isProductQualityImpact).length,
    marketImpact: records.filter(isMarketImpact).length,
    repeatComplaints: records.filter(isRepeatComplaint).length,
    avgClosureDays,
  };
}

export function computeComplaintChartData(records: ComplaintRecord[]): ComplaintDashboardChartData {
  const monthTrend = new Map<string, number>();
  const openClosed = new Map<string, { open: number; closed: number }>();
  const capaLinkedTrend = new Map<string, number>();
  const recallTrend = new Map<string, number>();
  const repeatTrend = new Map<string, number>();
  const closureTime = new Map<string, { total: number; count: number }>();
  const productMap = new Map<string, number>();
  const marketMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const criticalityMap = new Map<string, number>();
  const rootCauseMap = new Map<string, number>();
  const customerMap = new Map<string, number>();
  const batchMap = new Map<string, number>();

  for (const r of records) {
    const month = r.complaint_date?.slice(0, 7) || r.created_at?.slice(0, 7) || 'Unknown';
    monthTrend.set(month, (monthTrend.get(month) || 0) + 1);

    const oc = openClosed.get(month) || { open: 0, closed: 0 };
    if (r.status === 'closed') oc.closed += 1;
    else if (!isComplaintClosed(r.status)) oc.open += 1;
    openClosed.set(month, oc);

    if (isComplaintCapaLinked(r)) {
      capaLinkedTrend.set(month, (capaLinkedTrend.get(month) || 0) + 1);
    }
    if (isRecallEvaluationRequired(r)) {
      recallTrend.set(month, (recallTrend.get(month) || 0) + 1);
    }
    if (isRepeatComplaint(r)) {
      repeatTrend.set(month, (repeatTrend.get(month) || 0) + 1);
    }

    if (r.status === 'closed' && r.closure_date && r.complaint_date) {
      const ct = closureTime.get(month) || { total: 0, count: 0 };
      ct.total += daysBetween(r.complaint_date, r.closure_date);
      ct.count += 1;
      closureTime.set(month, ct);
    }

    productMap.set(r.product_name || 'Unknown', (productMap.get(r.product_name || 'Unknown') || 0) + 1);
    marketMap.set(r.market_region || 'Unknown', (marketMap.get(r.market_region || 'Unknown') || 0) + 1);
    categoryMap.set(r.complaint_category || 'Other', (categoryMap.get(r.complaint_category || 'Other') || 0) + 1);
    criticalityMap.set(r.complaint_criticality || 'Unknown', (criticalityMap.get(r.complaint_criticality || 'Unknown') || 0) + 1);
    const rc = (r.root_cause || 'Not Documented').trim().slice(0, 50) || 'Not Documented';
    rootCauseMap.set(rc, (rootCauseMap.get(rc) || 0) + 1);
    customerMap.set(r.customer_name || 'Unknown', (customerMap.get(r.customer_name || 'Unknown') || 0) + 1);
    batchMap.set(r.batch_number || 'Unknown', (batchMap.get(r.batch_number || 'Unknown') || 0) + 1);
  }

  const sortedMonths = Array.from(new Set([
    ...Array.from(monthTrend.keys()),
    ...Array.from(openClosed.keys()),
    ...Array.from(repeatTrend.keys()),
  ])).sort();

  return {
    monthlyTrend: sortedMonths.map((month) => ({ name: month, month, count: monthTrend.get(month) || 0 })),
    byProduct: toSorted(productMap),
    byMarket: toSorted(marketMap),
    byCategory: toSorted(categoryMap),
    byCriticality: toSorted(criticalityMap),
    byRootCause: toSorted(rootCauseMap),
    byCustomer: toSorted(customerMap),
    byBatch: toSorted(batchMap),
    openClosedTrend: sortedMonths.map((month) => ({
      name: month,
      open: openClosed.get(month)?.open || 0,
      closed: openClosed.get(month)?.closed || 0,
    })),
    capaLinkedTrend: sortedMonths.map((month) => ({
      name: month,
      count: capaLinkedTrend.get(month) || 0,
    })),
    recallEvaluationTrend: sortedMonths.map((month) => ({
      name: month,
      count: recallTrend.get(month) || 0,
    })),
    repeatComplaintTrend: sortedMonths.map((month) => ({
      name: month,
      count: repeatTrend.get(month) || 0,
    })),
    closureTimeTrend: sortedMonths.map((month) => {
      const ct = closureTime.get(month);
      return {
        name: month,
        avgDays: ct?.count ? Math.round(ct.total / ct.count) : 0,
      };
    }),
  };
}

export function buildComplaintActivityTimeline(records: ComplaintRecord[]): ComplaintActivityEntry[] {
  return [...records]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 15)
    .map((r) => ({
      date: r.updated_at || r.created_at || r.complaint_date,
      title: `${r.complaint_number} — ${(r.status || 'unknown').replace(/_/g, ' ')}`,
      description: (r.complaint_description || r.initial_assessment || '').slice(0, 120),
      user: r.updated_by_name || r.created_by_name || 'System',
      complaint_number: r.complaint_number,
    }));
}

export function getRecentComplaints(records: ComplaintRecord[], limit = 10): ComplaintRecord[] {
  return [...records]
    .sort((a, b) => (b.updated_at || b.complaint_date || '').localeCompare(a.updated_at || a.complaint_date || ''))
    .slice(0, limit);
}

export function getOverdueComplaints(records: ComplaintRecord[]): ComplaintRecord[] {
  return records
    .filter(isComplaintOverdue)
    .sort((a, b) => getComplaintDaysOverdue(b) - getComplaintDaysOverdue(a));
}

export function getCriticalComplaints(records: ComplaintRecord[]): ComplaintRecord[] {
  return records
    .filter((r) => r.complaint_criticality === 'Critical' && !isComplaintClosed(r.status))
    .sort((a, b) => (b.complaint_date || '').localeCompare(a.complaint_date || ''));
}

export function exportComplaintDashboardCsv(records: ComplaintRecord[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Complaint No', 'Date', 'Customer', 'Market', 'Product', 'Batch', 'Category',
    'Criticality', 'Status', 'Assigned To', 'Due Date', 'CAPA Linked', 'Recall Required',
  ];
  const rows = records.map((r) => [
    r.complaint_number || '',
    r.complaint_date || '',
    r.customer_name || '',
    r.market_region || '',
    r.product_name || '',
    r.batch_number || '',
    r.complaint_category || '',
    r.complaint_criticality || '',
    r.status || '',
    r.assigned_to_name || r.assigned_to || '',
    r.due_date || '',
    r.linked_capa_number || '',
    yesValue(r.recall_required) ? 'Yes' : 'No',
  ]);
  return { headers, rows };
}

export {
  canViewComplaintDashboard,
  canExportComplaintDashboard,
  isComplaintDashboardReadOnly,
};
