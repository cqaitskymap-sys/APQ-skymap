import { z } from 'zod';
import { normalizeRole } from '@/lib/permissions';
import {
  applyOosDashboardFilters,
  computeExtendedOosDashboardMetrics,
} from '@/lib/oos-dashboard-records';
import {
  OOS_REPORT_TYPES,
  OOS_STATUSES,
  ROOT_CAUSE_CATEGORIES,
  getDaysOverdueOos,
  isCriticalOosTest,
  isOpenOosStatus,
  type OosChartPoint,
  type OosDashboardMetrics,
  type OosImpactAssessment,
  type OosPhase1,
  type OosPhase2,
  type OosRecord,
  type OosReportRecord,
  type OosReportType,
} from '@/lib/oos-types';

export { OOS_REPORT_TYPES };

export const REPORTS_MODULE = 'OOS Reports & Analytics';
export const CLOSURE_TARGET_DAYS = 30;

export type OosReportActor = { id: string; name: string; role?: string };

export interface OosReportFilterInput {
  report_type: OosReportType;
  review_period_from: string;
  review_period_to: string;
  department?: string;
  product?: string;
  batch_number?: string;
  test_name?: string;
  status?: string;
  root_cause_category?: string;
}

export interface OosReportPreviewRow {
  oos_number: string;
  oos_date: string;
  department: string;
  product_name: string;
  batch_number: string;
  test_name: string;
  parameter_name: string;
  status: string;
  root_cause: string;
  capa_linked: string;
  phase: string;
  closure_days: string | number;
}

export interface OosReportAnalyticsResult {
  metrics: OosDashboardMetrics;
  byStatus: OosChartPoint[];
  previewRows: OosReportPreviewRow[];
  summary: string;
  investigation_summary: string;
  capa_summary: string;
  phase1_completed: number;
  phase2_completed: number;
  filtered_count: number;
}

const requiredDate = z.string().trim().min(1, 'Date range is required');
const requiredType = z.enum(OOS_REPORT_TYPES, { required_error: 'Report type is required' });

export const oosReportFormSchema = z.object({
  report_type: requiredType,
  review_period_from: requiredDate,
  review_period_to: requiredDate,
  department: z.string().default('All'),
  product: z.string().default('All'),
  batch_number: z.string().default('All'),
  test_name: z.string().default('All'),
  status: z.string().default('All'),
  root_cause_category: z.string().default('All'),
}).refine((d) => {
  const from = new Date(d.review_period_from);
  const to = new Date(d.review_period_to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['review_period_to'] });

export type OosReportFormData = z.infer<typeof oosReportFormSchema>;

const QC_ALLOWED_REPORTS: OosReportType[] = [
  'OOS Register',
  'Test-wise OOS Report',
  'Phase-I Investigation Report',
  'Phase-II Investigation Report',
  'Open OOS Report',
];

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

export function buildOosReportId(reportType: string): string {
  const code = reportType.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'OOS';
  return `OOS-RPT-${code}-${Date.now().toString(36).toUpperCase()}`;
}

export function generateOosReportNumber(year: number, existingCount: number): string {
  return `OOS-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

function applyOverdue(record: OosRecord): OosRecord {
  if (!record.target_closure_date || ['closed', 'rejected', 'approved'].includes(record.status)) return record;
  const today = new Date().toISOString().split('T')[0];
  if (record.target_closure_date < today && isOpenOosStatus(record.status)) {
    return { ...record, status: 'overdue' };
  }
  return record;
}

export function filterByOosReportType(
  records: OosRecord[],
  reportType: OosReportType,
  phase1Map?: Map<string, OosPhase1>,
  phase2Map?: Map<string, OosPhase2>,
): OosRecord[] {
  const checked = records.map(applyOverdue);
  switch (reportType) {
    case 'Open OOS Report':
      return checked.filter((r) => isOpenOosStatus(r.status) && r.status !== 'rejected');
    case 'Closed OOS Report':
    case 'OOS Closure Report':
      return checked.filter((r) => r.status === 'closed' || r.status === 'approved');
    case 'Overdue OOS Report':
      return checked.filter((r) => r.status === 'overdue' || getDaysOverdueOos(r) > 0);
    case 'Critical OOS Report':
      return checked.filter((r) => isCriticalOosTest(r.test_name) || r.is_critical_test);
    case 'CAPA Linked OOS Report':
      return checked.filter((r) => Boolean(r.linked_capa_number));
    case 'Phase-I Investigation Report':
      return checked.filter((r) =>
        r.status === 'phase1_investigation'
        || phase1Map?.get(r.id)?.status === 'Completed'
        || Boolean(phase1Map?.get(r.id)?.phase1_conclusion),
      );
    case 'Phase-II Investigation Report':
      return checked.filter((r) =>
        r.status === 'phase2_investigation'
        || ['Completed', 'CAPA Required'].includes(phase2Map?.get(r.id)?.status || ''),
      );
    case 'Product-wise OOS Report':
    case 'Test-wise OOS Report':
    case 'OOS Trend Report':
    case 'OOS Register':
    default:
      return checked.filter((r) => r.status !== 'draft');
  }
}

export function applyOosReportFilters(
  records: OosRecord[],
  filters: OosReportFilterInput,
  phase1Map?: Map<string, OosPhase1>,
  phase2Map?: Map<string, OosPhase2>,
  impactMap?: Map<string, OosImpactAssessment>,
): OosRecord[] {
  const byType = filterByOosReportType(records, filters.report_type, phase1Map, phase2Map);
  return applyOosDashboardFilters(byType, {
    date_from: filters.review_period_from,
    date_to: filters.review_period_to,
    department: filters.department && filters.department !== 'All' ? filters.department : undefined,
    product_name: filters.product && filters.product !== 'All' ? filters.product : undefined,
    batch_number: filters.batch_number && filters.batch_number !== 'All' ? filters.batch_number : undefined,
    test_name: filters.test_name && filters.test_name !== 'All' ? filters.test_name : undefined,
    status: filters.status && filters.status !== 'All' ? filters.status : undefined,
    root_cause: filters.root_cause_category && filters.root_cause_category !== 'All' ? filters.root_cause_category : undefined,
  }, phase1Map, phase2Map, impactMap);
}

function computeStatusDistribution(records: OosRecord[]): OosChartPoint[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const label = r.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function toOosPreviewRow(
  record: OosRecord,
  phase1?: OosPhase1 | null,
  phase2?: OosPhase2 | null,
): OosReportPreviewRow {
  const closureDays = record.actual_closure_date && record.oos_date
    ? daysBetween(record.oos_date, record.actual_closure_date)
    : '—';
  const phase = phase2?.status === 'Completed' || record.status === 'phase2_investigation'
    ? 'Phase-II'
    : phase1?.status === 'Completed' || record.status === 'phase1_investigation'
      ? 'Phase-I'
      : record.phase?.replace('phase', 'Phase-') || '—';
  return {
    oos_number: record.oos_number,
    oos_date: record.oos_date,
    department: record.department,
    product_name: record.product_name,
    batch_number: record.batch_number,
    test_name: record.test_name,
    parameter_name: record.parameter_name,
    status: record.status.replace(/_/g, ' '),
    root_cause: (record.root_cause || phase2?.root_cause || phase1?.phase1_outcome || '—').slice(0, 80),
    capa_linked: record.linked_capa_number || '—',
    phase,
    closure_days: closureDays,
  };
}

export function buildOosReportSummary(
  filters: OosReportFilterInput,
  metrics: OosDashboardMetrics,
  count: number,
): string {
  return `${filters.report_type} covering ${filters.review_period_from} to ${filters.review_period_to}: `
    + `${count} OOS record(s). Open: ${metrics.open}, Closed: ${metrics.closed}, Overdue: ${metrics.overdue}, `
    + `Critical: ${metrics.critical}, CAPA Linked: ${metrics.capaLinked}, `
    + `Average closure: ${metrics.avgClosureDays} days (target ${CLOSURE_TARGET_DAYS} days).`;
}

export function buildInvestigationSummary(
  filtered: OosRecord[],
  phase1Map: Map<string, OosPhase1>,
  phase2Map: Map<string, OosPhase2>,
): string {
  const p1Complete = filtered.filter((r) => phase1Map.get(r.id)?.status === 'Completed').length;
  const p2Complete = filtered.filter((r) => ['Completed', 'CAPA Required'].includes(phase2Map.get(r.id)?.status || '')).length;
  const labError = filtered.filter((r) => phase1Map.get(r.id)?.phase1_outcome === 'Laboratory Error').length;
  return `Investigation summary: ${p1Complete} Phase-I completed, ${p2Complete} Phase-II completed, `
    + `${labError} laboratory error outcome(s), ${filtered.length - p1Complete} pending Phase-I completion.`;
}

export function buildCapaSummary(filtered: OosRecord[]): string {
  const linked = filtered.filter((r) => r.linked_capa_number).length;
  const required = filtered.filter((r) => r.capa_required).length;
  return `CAPA summary: ${required} OOS requiring CAPA, ${linked} CAPA-linked, `
    + `${Math.max(0, required - linked)} pending CAPA linkage.`;
}

export function computeOosReportAnalytics(
  allRecords: OosRecord[],
  phase1List: OosPhase1[],
  phase2List: OosPhase2[],
  impactList: OosImpactAssessment[],
  filters: OosReportFilterInput,
): OosReportAnalyticsResult {
  const phase1Map = new Map(phase1List.map((p) => [p.oos_id, p]));
  const phase2Map = new Map(phase2List.map((p) => [p.oos_id, p]));
  const impactMap = new Map(impactList.map((p) => [p.oos_id, p]));

  const filtered = applyOosReportFilters(allRecords, filters, phase1Map, phase2Map, impactMap);
  const metrics = computeExtendedOosDashboardMetrics(filtered, phase1List, phase2List, impactList);
  const byStatus = computeStatusDistribution(filtered);
  const previewRows = filtered.map((r) => toOosPreviewRow(r, phase1Map.get(r.id), phase2Map.get(r.id)));
  const phase1_completed = filtered.filter((r) => phase1Map.get(r.id)?.status === 'Completed').length;
  const phase2_completed = filtered.filter((r) => ['Completed', 'CAPA Required'].includes(phase2Map.get(r.id)?.status || '')).length;

  return {
    metrics,
    byStatus,
    previewRows,
    summary: buildOosReportSummary(filters, metrics, filtered.length),
    investigation_summary: buildInvestigationSummary(filtered, phase1Map, phase2Map),
    capa_summary: buildCapaSummary(filtered),
    phase1_completed,
    phase2_completed,
    filtered_count: filtered.length,
  };
}

export function mapOosReportToRecord(
  form: OosReportFormData,
  analytics: OosReportAnalyticsResult,
  actor: OosReportActor,
  reportNumber: string,
): Omit<OosReportRecord, 'id'> {
  const now = new Date().toISOString();
  return {
    report_id: buildOosReportId(form.report_type),
    report_number: reportNumber,
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    department: form.department || 'All',
    product: form.product || 'All',
    batch_number: form.batch_number || 'All',
    test_name: form.test_name || 'All',
    root_cause_category: form.root_cause_category || 'All',
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
      batch_number: form.batch_number || 'All',
      test_name: form.test_name || 'All',
      status: form.status || 'All',
      root_cause_category: form.root_cause_category || 'All',
    },
    preview_rows: analytics.previewRows as unknown as Record<string, unknown>[],
    chart_snapshot: { ...analytics.metrics, byStatus: analytics.byStatus } as unknown as Record<string, unknown>,
    metrics_snapshot: analytics.metrics as unknown as Record<string, unknown>,
    summary: analytics.summary,
    investigation_summary: analytics.investigation_summary,
    capa_summary: analytics.capa_summary,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
}

export function summarizeOosReportsDashboard(
  records: OosRecord[],
  phase1List: OosPhase1[] = [],
  phase2List: OosPhase2[] = [],
  impactList: OosImpactAssessment[] = [],
): OosReportAnalyticsResult {
  const year = new Date().getFullYear();
  return computeOosReportAnalytics(records, phase1List, phase2List, impactList, {
    report_type: 'OOS Register',
    review_period_from: `${year}-01-01`,
    review_period_to: `${year}-12-31`,
    department: 'All',
    product: 'All',
    batch_number: 'All',
    test_name: 'All',
    status: 'All',
    root_cause_category: 'All',
  });
}

export function canViewOosReports(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canGenerateOosReports(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'qc_manager', 'qc'].includes(normalizeRole(role));
}

export function canGenerateOosReportType(role?: string | null, reportType?: OosReportType): boolean {
  if (!canGenerateOosReports(role)) return false;
  const r = normalizeRole(role);
  if (['qc', 'qc_manager'].includes(r) && reportType) {
    return QC_ALLOWED_REPORTS.includes(reportType);
  }
  return true;
}

export function canReviewOosReports(role?: string | null): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager'].includes(normalizeRole(role));
}

export function canExportOosReports(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isOosReportsReadOnly(role?: string | null): boolean {
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

export const OOS_REPORT_FILTER_OPTIONS = {
  statuses: ['All', ...OOS_STATUSES],
  rootCauses: ['All', ...ROOT_CAUSE_CATEGORIES],
};

export const OOS_PREVIEW_COLUMNS = [
  { key: 'oos_number', header: 'OOS No' },
  { key: 'oos_date', header: 'Date' },
  { key: 'department', header: 'Department' },
  { key: 'product_name', header: 'Product' },
  { key: 'batch_number', header: 'Batch' },
  { key: 'test_name', header: 'Test' },
  { key: 'parameter_name', header: 'Parameter' },
  { key: 'status', header: 'Status' },
  { key: 'root_cause', header: 'Root Cause' },
  { key: 'capa_linked', header: 'CAPA' },
  { key: 'phase', header: 'Phase' },
  { key: 'closure_days', header: 'Closure Days' },
] as const;
