import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  computeComplaintChartData,
  computeComplaintDashboardMetrics,
  exportComplaintDashboardCsv,
  getComplaintDaysOverdue,
  isComplaintCapaLinked,
  isComplaintOverdue,
  isMarketImpact,
  isRecallEvaluationRequired,
  isRepeatComplaint,
} from '@/lib/complaint-dashboard-records';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CRITICALITIES,
  COMPLAINT_REPORT_TYPES,
  COMPLAINT_STATUSES,
  isComplaintClosed,
  type ComplaintDashboardChartData,
  type ComplaintDashboardMetrics,
  type ComplaintRecord,
  type ComplaintReportRecord,
  type ComplaintReportType,
} from '@/lib/complaint-types';

export { COMPLAINT_REPORT_TYPES };

export const COMPLAINT_REPORTS_MODULE = 'Complaint Reports & Analytics';
export const COMPLAINT_CLOSURE_TARGET_DAYS = 30;

export type ComplaintReportActor = { id: string; name: string; role?: string };

export interface ComplaintChartPoint {
  name: string;
  count: number;
}

export interface ComplaintReportFilterInput {
  report_type: ComplaintReportType;
  review_period_from: string;
  review_period_to: string;
  complaint_number?: string;
  product?: string;
  batch_number?: string;
  market_region?: string;
  customer_name?: string;
  complaint_category?: string;
  criticality?: string;
  status?: string;
  capa_required?: string;
  recall_required?: string;
}

export interface ComplaintReportPreviewRow {
  complaint_number: string;
  complaint_date: string;
  customer_name: string;
  market_region: string;
  product_name: string;
  batch_number: string;
  complaint_category: string;
  complaint_criticality: string;
  status: string;
  capa_linked: string;
  recall_required: string;
  repeat: string;
  closure_days: string | number;
  root_cause: string;
  investigation_status: string;
}

export interface ComplaintReportAnalyticsResult {
  metrics: ComplaintDashboardMetrics & { customerResponsePending: number };
  charts: ComplaintDashboardChartData;
  byStatus: ComplaintChartPoint[];
  previewRows: ComplaintReportPreviewRow[];
  summary: string;
  management_summary: string;
  investigation_summary: string;
  capa_summary: string;
  recall_summary: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Date range is required');
const requiredType = z.enum(COMPLAINT_REPORT_TYPES, { required_error: 'Report type is required' });

export const complaintReportFormSchema = z.object({
  report_type: requiredType,
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  complaint_number: z.string().default(''),
  product: z.string().default('All'),
  batch_number: z.string().default(''),
  market_region: z.string().default('All'),
  customer_name: z.string().default(''),
  complaint_category: z.string().default('All'),
  criticality: z.string().default('All'),
  status: z.string().default('All'),
  capa_required: z.string().default('All'),
  recall_required: z.string().default('All'),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export type ComplaintReportFormData = z.infer<typeof complaintReportFormSchema>;

function inPeriod(dateStr: string | undefined, from: string, to: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(d.getTime())) return false;
  return d >= f && d <= t;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function yesFilter(value: string | undefined, recordValue: boolean): boolean {
  if (!value || value === 'All') return true;
  if (value === 'Yes') return recordValue;
  if (value === 'No') return !recordValue;
  return true;
}

function isCustomerResponsePending(record: ComplaintRecord): boolean {
  return record.received_from !== 'Internal'
    && Boolean(record.customer_name?.trim())
    && !isComplaintClosed(record.status);
}

export function buildComplaintReportId(reportType: string): string {
  const code = reportType.replace(/[^A-Z]/gi, '').slice(0, 6).toUpperCase() || 'CMP';
  return `CMP-RPT-${code}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateComplaintReportNumber(year: number, existingCount: number): string {
  return `CMP-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function filterByComplaintReportType(records: ComplaintRecord[], reportType: ComplaintReportType): ComplaintRecord[] {
  switch (reportType) {
    case 'Open Complaint Report':
      return records.filter((r) => !isComplaintClosed(r.status) && r.status !== 'draft');
    case 'Closed Complaint Report':
      return records.filter((r) => r.status === 'closed');
    case 'Overdue Complaint Report':
      return records.filter(isComplaintOverdue);
    case 'Critical Complaint Report':
      return records.filter((r) => r.complaint_criticality === 'Critical');
    case 'CAPA Linked Complaint Report':
      return records.filter(isComplaintCapaLinked);
    case 'Recall Evaluation Complaint Report':
      return records.filter(isRecallEvaluationRequired);
    case 'Complaint Closure Report':
      return records.filter((r) => r.status === 'closed' && Boolean(r.closure_date));
    case 'Complaint Trend Report':
    case 'Product-wise Complaint Report':
    case 'Market-wise Complaint Report':
    case 'Category-wise Complaint Report':
    case 'Complaint Register':
    default:
      return records.filter((r) => r.status !== 'draft');
  }
}

export function applyComplaintReportFilters(
  records: ComplaintRecord[],
  filters: ComplaintReportFilterInput,
): ComplaintRecord[] {
  const byType = filterByComplaintReportType(records, filters.report_type);
  return byType.filter((r) => {
    const date = r.complaint_date || r.created_at?.slice(0, 10);
    if (!inPeriod(date, filters.review_period_from, filters.review_period_to)) return false;
    if (filters.complaint_number?.trim()) {
      const q = filters.complaint_number.trim().toLowerCase();
      if (!(r.complaint_number || '').toLowerCase().includes(q)) return false;
    }
    if (filters.product && filters.product !== 'All' && r.product_name !== filters.product) return false;
    if (filters.batch_number?.trim() && !(r.batch_number || '').includes(filters.batch_number.trim())) return false;
    if (filters.market_region && filters.market_region !== 'All' && r.market_region !== filters.market_region) return false;
    if (filters.customer_name?.trim()) {
      const q = filters.customer_name.trim().toLowerCase();
      if (!(r.customer_name || '').toLowerCase().includes(q)) return false;
    }
    if (filters.complaint_category && filters.complaint_category !== 'All' && r.complaint_category !== filters.complaint_category) return false;
    if (filters.criticality && filters.criticality !== 'All' && r.complaint_criticality !== filters.criticality) return false;
    if (filters.status && filters.status !== 'All' && r.status !== filters.status) return false;
    if (!yesFilter(filters.capa_required, r.capa_required || r.status === 'capa_required')) return false;
    if (!yesFilter(filters.recall_required, isRecallEvaluationRequired(r))) return false;
    return true;
  });
}

function computeStatusDistribution(records: ComplaintRecord[]): ComplaintChartPoint[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const label = (r.status || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function toComplaintPreviewRow(record: ComplaintRecord): ComplaintReportPreviewRow {
  const closureDays = record.closure_date && record.complaint_date
    ? daysBetween(record.complaint_date, record.closure_date)
    : '—';
  return {
    complaint_number: record.complaint_number,
    complaint_date: record.complaint_date,
    customer_name: record.customer_name || '—',
    market_region: record.market_region || '—',
    product_name: record.product_name,
    batch_number: record.batch_number || '—',
    complaint_category: record.complaint_category || '—',
    complaint_criticality: record.complaint_criticality || '—',
    status: (record.status || '').replace(/_/g, ' '),
    capa_linked: record.linked_capa_number || '—',
    recall_required: isRecallEvaluationRequired(record) ? 'Yes' : 'No',
    repeat: isRepeatComplaint(record) ? 'Yes' : 'No',
    closure_days: closureDays,
    root_cause: (record.root_cause || '—').slice(0, 80),
    investigation_status: record.status === 'under_investigation' ? 'In Progress' : '—',
  };
}

export function buildComplaintReportSummary(
  filters: ComplaintReportFilterInput,
  metrics: ComplaintDashboardMetrics & { customerResponsePending?: number },
  count: number,
): string {
  return `${filters.report_type} covering ${filters.review_period_from} to ${filters.review_period_to}: `
    + `${count} record(s). Open: ${metrics.open}, Closed: ${metrics.closed}, Overdue: ${metrics.overdue}, `
    + `Critical: ${metrics.critical}, Repeat: ${metrics.repeatComplaints}, CAPA Linked: ${metrics.capaLinked}, `
    + `Recall Evaluation: ${metrics.recallEvaluationRequired}, Avg closure: ${metrics.avgClosureDays} days `
    + `(target ${COMPLAINT_CLOSURE_TARGET_DAYS} days).`;
}

function buildManagementSummary(
  filters: ComplaintReportFilterInput,
  metrics: ComplaintDashboardMetrics & { customerResponsePending: number },
  count: number,
): string {
  if (count === 0) return 'No complaint data available for management review in the selected period.';
  const overdueNote = metrics.overdue > 0 ? `${metrics.overdue} overdue complaint(s) require escalation.` : 'No overdue complaints in scope.';
  return `Management Review — ${filters.report_type}: ${count} complaint(s) in period. `
    + `${metrics.critical} critical, ${metrics.capaLinked} CAPA-linked, ${metrics.recallEvaluationRequired} recall evaluation. `
    + `${metrics.customerResponsePending} customer response(s) pending. ${overdueNote}`;
}

function buildInvestigationSummary(records: ComplaintRecord[]): string {
  const inv = records.filter((r) => ['under_investigation', 'qa_review', 'capa_required', 'recall_evaluation'].includes(r.status));
  if (!inv.length) return 'No active investigations in filtered scope.';
  return `${inv.length} complaint(s) under investigation or QA review workflow. `
    + `Statuses: ${Array.from(new Set(inv.map((r) => r.status))).join(', ').replace(/_/g, ' ')}.`;
}

function buildCapaSummary(records: ComplaintRecord[]): string {
  const linked = records.filter(isComplaintCapaLinked);
  const required = records.filter((r) => r.capa_required || r.status === 'capa_required');
  return `CAPA: ${linked.length} linked, ${required.length} CAPA-required in scope. `
    + (linked.length ? `Linked CAPA numbers: ${linked.slice(0, 5).map((r) => r.linked_capa_number).filter(Boolean).join(', ')}.` : 'No CAPA links in filtered records.');
}

function buildRecallSummary(records: ComplaintRecord[]): string {
  const recall = records.filter(isRecallEvaluationRequired);
  const market = records.filter(isMarketImpact);
  if (!recall.length && !market.length) return 'No recall evaluation cases in filtered scope.';
  return `Recall Evaluation: ${recall.length} case(s) flagged. Market impact: ${market.length}. `
    + (recall.filter((r) => r.linked_recall_number).length
      ? `${recall.filter((r) => r.linked_recall_number).length} linked to recall record(s).`
      : 'Review recall evaluation workflow for open cases.');
}

export function computeComplaintReportAnalytics(
  allRecords: ComplaintRecord[],
  filters: ComplaintReportFilterInput,
): ComplaintReportAnalyticsResult {
  const filtered = applyComplaintReportFilters(allRecords, filters);
  const baseMetrics = computeComplaintDashboardMetrics(filtered);
  const metrics = {
    ...baseMetrics,
    customerResponsePending: filtered.filter(isCustomerResponsePending).length,
  };
  const charts = computeComplaintChartData(filtered);
  const byStatus = computeStatusDistribution(filtered);
  const previewRows = filtered.map(toComplaintPreviewRow);
  const summary = buildComplaintReportSummary(filters, metrics, filtered.length);
  return {
    metrics,
    charts,
    byStatus,
    previewRows,
    summary,
    management_summary: buildManagementSummary(filters, metrics, filtered.length),
    investigation_summary: buildInvestigationSummary(filtered),
    capa_summary: buildCapaSummary(filtered),
    recall_summary: buildRecallSummary(filtered),
    filtered_count: filtered.length,
  };
}

export function mapComplaintReportToRecord(
  form: ComplaintReportFormData,
  analytics: ComplaintReportAnalyticsResult,
  actor: ComplaintReportActor,
  reportNumber: string,
): Omit<ComplaintReportRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    report_id: buildComplaintReportId(form.report_type),
    report_number: reportNumber,
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    complaint_number_filter: form.complaint_number || '',
    product: form.product || 'All',
    batch_number: form.batch_number || '',
    market_region: form.market_region || 'All',
    customer_name: form.customer_name || '',
    complaint_category: form.complaint_category || 'All',
    criticality: form.criticality || 'All',
    status_filter: form.status || 'All',
    capa_required_filter: form.capa_required || 'All',
    recall_required_filter: form.recall_required || 'All',
    generated_by: actor.id,
    generated_by_name: actor.name,
    generated_date: now.split('T')[0],
    total_records: analytics.filtered_count,
    export_type: '',
    file_url: '',
    report_status: 'Generated',
    filters_applied: {
      complaint_number: form.complaint_number || '',
      product: form.product || 'All',
      batch_number: form.batch_number || '',
      market_region: form.market_region || 'All',
      customer_name: form.customer_name || '',
      complaint_category: form.complaint_category || 'All',
      criticality: form.criticality || 'All',
      status: form.status || 'All',
      capa_required: form.capa_required || 'All',
      recall_required: form.recall_required || 'All',
    },
    preview_rows: analytics.previewRows as unknown as Record<string, unknown>[],
    chart_snapshot: { charts: analytics.charts, byStatus: analytics.byStatus } as unknown as Record<string, unknown>,
    metrics_snapshot: analytics.metrics as unknown as Record<string, unknown>,
    summary: analytics.summary,
    management_summary: analytics.management_summary,
    investigation_summary: analytics.investigation_summary,
    capa_summary: analytics.capa_summary,
    recall_summary: analytics.recall_summary,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function summarizeComplaintReportsDashboard(records: ComplaintRecord[]) {
  const active = records.filter((r) => r.status !== 'draft');
  const metrics = {
    ...computeComplaintDashboardMetrics(active),
    customerResponsePending: active.filter(isCustomerResponsePending).length,
  };
  const charts = computeComplaintChartData(active);
  const year = new Date().getFullYear();
  const byStatus = computeStatusDistribution(
    applyComplaintReportFilters(active, {
      report_type: 'Complaint Register',
      review_period_from: `${year}-01-01`,
      review_period_to: `${year}-12-31`,
    }),
  );
  return { metrics, charts, byStatus };
}

const REGULATORY_REPORT_TYPES: ComplaintReportType[] = [
  'Market-wise Complaint Report',
  'Recall Evaluation Complaint Report',
];

export function getAvailableComplaintReportTypes(role?: string | null): ComplaintReportType[] {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) {
    return [...COMPLAINT_REPORT_TYPES];
  }
  if (r === 'regulatory_affairs') return [...REGULATORY_REPORT_TYPES];
  return [];
}

export function canViewComplaintReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) return true;
  return ['regulatory_affairs', 'qc_manager', 'qc'].includes(r);
}

export function canGenerateComplaintReports(role?: string | null, reportType?: ComplaintReportType): boolean {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) return true;
  if (r === 'regulatory_affairs' && reportType) {
    return REGULATORY_REPORT_TYPES.includes(reportType);
  }
  if (r === 'regulatory_affairs' && !reportType) return true;
  return false;
}

export function canReviewComplaintManagementReports(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa'].includes(normalizeRole(role || ''));
}

export function canExportComplaintReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isComplaintReportsReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function complaintReportStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-amber-100 text-amber-800',
    Generated: 'bg-blue-100 text-blue-800',
    Exported: 'bg-green-100 text-green-800',
    Archived: 'bg-slate-100 text-slate-600',
    Failed: 'bg-red-100 text-red-800',
  };
  return map[status] || map.Draft;
}

export const COMPLAINT_REPORT_FILTER_OPTIONS = {
  categories: ['All', ...COMPLAINT_CATEGORIES],
  criticalities: ['All', ...COMPLAINT_CRITICALITIES],
  statuses: ['All', ...COMPLAINT_STATUSES],
  yesNo: ['All', 'Yes', 'No'] as const,
};

export const COMPLAINT_PREVIEW_COLUMNS = [
  { key: 'complaint_number', header: 'Complaint No' },
  { key: 'complaint_date', header: 'Date' },
  { key: 'customer_name', header: 'Customer' },
  { key: 'market_region', header: 'Market' },
  { key: 'product_name', header: 'Product' },
  { key: 'batch_number', header: 'Batch' },
  { key: 'complaint_category', header: 'Category' },
  { key: 'complaint_criticality', header: 'Criticality' },
  { key: 'status', header: 'Status' },
  { key: 'capa_linked', header: 'CAPA' },
  { key: 'recall_required', header: 'Recall' },
  { key: 'closure_days', header: 'Closure Days' },
] as const;

export { exportComplaintDashboardCsv, getComplaintDaysOverdue };
