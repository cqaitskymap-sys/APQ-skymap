import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import { applyOverdueCheck, computeExtendedDashboardMetrics, getDaysOverdue } from '@/lib/deviation-dashboard-metrics';
import {
  DEPARTMENTS,
  DEVIATION_CRITICALITIES,
  DEVIATION_REPORT_TYPES,
  DEVIATION_STATUSES,
  isOpenStatus,
  type DeviationChartPoint,
  type DeviationDashboardMetrics,
  type DeviationRecord,
  type DeviationReportRecord,
  type DeviationReportType,
} from '@/lib/deviation-types';

export { DEVIATION_REPORT_TYPES };

export const REPORTS_MODULE = 'Deviation Reports & Analytics';
export const CLOSURE_TARGET_DAYS = 30;

export type ReportActor = { id: string; name: string; role?: string };

export interface ReportFilterInput {
  report_type: DeviationReportType;
  review_period_from: string;
  review_period_to: string;
  department?: string;
  product?: string;
  criticality?: string;
  status?: string;
}

export interface ReportPreviewRow {
  deviation_number: string;
  deviation_date: string;
  department: string;
  product_name: string;
  batch_number: string;
  category: string;
  criticality: string;
  status: string;
  capa_linked: string;
  repeat: string;
  closure_days: string | number;
  root_cause: string;
}

export interface ReportAnalyticsResult {
  metrics: DeviationDashboardMetrics;
  byStatus: DeviationChartPoint[];
  previewRows: ReportPreviewRow[];
  summary: string;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Date range is required');
const requiredType = z.enum(DEVIATION_REPORT_TYPES, { required_error: 'Report type is required' });

export const deviationReportFormSchema = z.object({
  report_type: requiredType,
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().default('All'),
  product: z.string().default('All'),
  criticality: z.string().default('All'),
  status: z.string().default('All'),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export type DeviationReportFormData = z.infer<typeof deviationReportFormSchema>;

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

export function buildReportId(reportType: string): string {
  const code = reportType.replace(/[^A-Z]/gi, '').slice(0, 6).toUpperCase() || 'DEV';
  return `DEV-RPT-${code}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateReportNumber(year: number, existingCount: number): string {
  return `DEV-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function filterByReportType(records: DeviationRecord[], reportType: DeviationReportType): DeviationRecord[] {
  const checked = records.map(applyOverdueCheck);
  switch (reportType) {
    case 'Open Deviation Report':
      return checked.filter((r) => isOpenStatus(r.status) && r.status !== 'rejected');
    case 'Closed Deviation Report':
      return checked.filter((r) => r.status === 'closed' || r.status === 'approved');
    case 'Overdue Deviation Report':
      return checked.filter((r) => r.status === 'overdue' || getDaysOverdue(r) > 0);
    case 'Critical Deviation Report':
      return checked.filter((r) => r.criticality === 'Critical');
    case 'Repeat Deviation Report':
      return checked.filter((r) => r.repeat_deviation);
    case 'CAPA Linked Deviation Report':
      return checked.filter((r) => Boolean(r.linked_capa_number));
    case 'Deviation Investigation Report':
      return checked.filter((r) => !['draft'].includes(r.status));
    case 'Department-wise Deviation Report':
    case 'Product-wise Deviation Report':
    case 'Deviation Trend Report':
    case 'Deviation Register':
    default:
      return checked;
  }
}

export function applyReportFilters(
  records: DeviationRecord[],
  filters: ReportFilterInput,
): DeviationRecord[] {
  const byType = filterByReportType(records, filters.report_type);
  return byType.filter((r) => {
    const date = r.deviation_date || r.created_at?.slice(0, 10);
    if (!inPeriod(date, filters.review_period_from, filters.review_period_to)) return false;
    if (filters.department && filters.department !== 'All' && r.department !== filters.department) return false;
    if (filters.product && filters.product !== 'All' && r.product_name !== filters.product) return false;
    if (filters.criticality && filters.criticality !== 'All' && r.criticality !== filters.criticality) return false;
    if (filters.status && filters.status !== 'All' && r.status !== filters.status) return false;
    return true;
  });
}

function computeStatusDistribution(records: DeviationRecord[]): DeviationChartPoint[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const label = r.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function toPreviewRow(record: DeviationRecord): ReportPreviewRow {
  const closureDays = record.actual_closure_date && record.deviation_date
    ? daysBetween(record.deviation_date, record.actual_closure_date)
    : '—';
  return {
    deviation_number: record.deviation_number,
    deviation_date: record.deviation_date,
    department: record.department,
    product_name: record.product_name,
    batch_number: record.batch_number || '—',
    category: record.category,
    criticality: record.criticality,
    status: record.status.replace(/_/g, ' '),
    capa_linked: record.linked_capa_number || '—',
    repeat: record.repeat_deviation ? 'Yes' : 'No',
    closure_days: closureDays,
    root_cause: (record.root_cause || '—').slice(0, 80),
  };
}

export function buildReportSummary(
  filters: ReportFilterInput,
  metrics: DeviationDashboardMetrics,
  count: number,
): string {
  return `${filters.report_type} covering ${filters.review_period_from} to ${filters.review_period_to}: `
    + `${count} record(s). Open: ${metrics.open}, Closed: ${metrics.closed}, Overdue: ${metrics.overdue}, `
    + `Critical: ${metrics.critical}, Repeat: ${metrics.repeat}, CAPA Linked: ${metrics.capaLinked}, `
    + `Average closure: ${metrics.avgClosureDays} days (target ${CLOSURE_TARGET_DAYS} days).`;
}

export function computeReportAnalytics(
  allRecords: DeviationRecord[],
  filters: ReportFilterInput,
): ReportAnalyticsResult {
  const filtered = applyReportFilters(allRecords, filters);
  const metrics = computeExtendedDashboardMetrics(filtered);
  const byStatus = computeStatusDistribution(filtered);
  const previewRows = filtered.map(toPreviewRow);
  const summary = buildReportSummary(filters, metrics, filtered.length);
  return {
    metrics,
    byStatus,
    previewRows,
    summary,
    filtered_count: filtered.length,
  };
}

export function mapReportToRecord(
  form: DeviationReportFormData,
  analytics: ReportAnalyticsResult,
  actor: ReportActor,
  reportNumber: string,
): Omit<DeviationReportRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    report_id: buildReportId(form.report_type),
    report_number: reportNumber,
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    department: form.department || 'All',
    product: form.product || 'All',
    criticality: form.criticality || 'All',
    status_filter: form.status || 'All',
    generated_by: actor.id,
    generated_by_name: actor.name,
    generated_date: now.split('T')[0],
    total_records: analytics.filtered_count,
    export_type: '',
    file_url: '',
    report_status: 'Generated',
    filters_applied: {
      department: form.department || 'All',
      product: form.product || 'All',
      criticality: form.criticality || 'All',
      status: form.status || 'All',
    },
    preview_rows: analytics.previewRows as unknown as Record<string, unknown>[],
    chart_snapshot: { ...analytics.metrics, byStatus: analytics.byStatus } as unknown as Record<string, unknown>,
    metrics_snapshot: analytics.metrics as unknown as Record<string, unknown>,
    summary: analytics.summary,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function summarizeReportsDashboard(records: DeviationRecord[]): DeviationDashboardMetrics {
  return computeExtendedDashboardMetrics(records.map(applyOverdueCheck));
}

export function canViewDeviationReports(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canGenerateDeviationReports(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(normalizeRole(role));
}

export function canReviewDeviationReports(role?: string | null): boolean {
  return ['super_admin', 'head_qa', 'qa_manager'].includes(normalizeRole(role));
}

export function canExportDeviationReports(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isDeviationReportsReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function reportStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-amber-100 text-amber-800',
    Generated: 'bg-blue-100 text-blue-800',
    Exported: 'bg-green-100 text-green-800',
    Archived: 'bg-slate-100 text-slate-600',
    Failed: 'bg-red-100 text-red-800',
  };
  return map[status] || map.Draft;
}

export const REPORT_FILTER_OPTIONS = {
  departments: ['All', ...DEPARTMENTS],
  criticalities: ['All', ...DEVIATION_CRITICALITIES],
  statuses: ['All', ...DEVIATION_STATUSES],
};

export const PREVIEW_COLUMNS = [
  { key: 'deviation_number', header: 'Deviation No' },
  { key: 'deviation_date', header: 'Date' },
  { key: 'department', header: 'Department' },
  { key: 'product_name', header: 'Product' },
  { key: 'batch_number', header: 'Batch' },
  { key: 'category', header: 'Category' },
  { key: 'criticality', header: 'Criticality' },
  { key: 'status', header: 'Status' },
  { key: 'capa_linked', header: 'CAPA' },
  { key: 'repeat', header: 'Repeat' },
  { key: 'closure_days', header: 'Closure Days' },
] as const;
