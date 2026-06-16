import { z } from 'zod';
import { displayCpvStatus } from '@/lib/cpv';

export const CPV_REPORTS_COLLECTION = 'reports';
export const CPV_REPORT_EXPORTS_COLLECTION = 'report_exports';
export const CPV_REPORTS_MODULE = 'CPV Reports & Analytics';

export const REPORT_STATUSES = ['Draft', 'Generated', 'Exported', 'Archived', 'Failed'] as const;
export const EXPORT_TYPES = ['PDF', 'Excel', 'CSV', 'Print'] as const;

export const CPV_REPORT_TYPES = [
  'CPV Dashboard Summary Report',
  'Product-wise CPV Report',
  'Batch-wise CPV Report',
  'CPP Monitoring Report',
  'CQA Monitoring Report',
  'Raw Material Monitoring Report',
  'Packing Material Monitoring Report',
  'Utility Monitoring Report',
  'Environmental Monitoring Report',
  'Yield Monitoring Report',
  'Stability Monitoring Report',
  'Hold Time Monitoring Report',
  'Process Capability Report',
  'Trend Analysis Report',
  'Statistical Process Control Report',
  'Risk Assessment Report',
  'Annual CPV Review Report',
  'OOT/OOS Summary Report',
  'CAPA Linked CPV Report',
  'Deviation Linked CPV Report',
  'Management Review Report',
] as const;

export type CpvReportType = (typeof CPV_REPORT_TYPES)[number];
export type CpvReportStatus = (typeof REPORT_STATUSES)[number];
export type CpvExportType = (typeof EXPORT_TYPES)[number];

export interface CpvReportFilters {
  productName?: string;
  productCode?: string;
  batchNumber?: string;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
  reportType: CpvReportType;
}

export interface CpvReportMetrics {
  totalBatches: number;
  cppCompliancePct: number;
  cqaCompliancePct: number;
  ootCount: number;
  oosCount: number;
  deviationCount: number;
  capaCount: number;
  averageCpk: number;
  averageYield: number;
  openRiskCount: number;
  highRiskCount: number;
  criticalRiskCount: number;
  cpvCompliancePct: number;
  healthScore: number;
  healthLabel: string;
  totalRecords: number;
}

export interface CpvReportRecord extends Record<string, unknown> {
  id: string;
  reportId: string;
  reportNumber: string;
  reportType: CpvReportType;
  productName: string;
  productCode: string;
  batchNumber: string;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
  generatedBy: string;
  generatedDate: string;
  reportStatus: CpvReportStatus;
  exportType: CpvExportType | '';
  fileUrl: string;
  fileName: string;
  filtersApplied: CpvReportFilters;
  totalRecords: number;
  metrics: CpvReportMetrics;
  previewRows: Record<string, unknown>[];
  charts: Record<string, unknown>;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface CpvReportExportRecord extends Record<string, unknown> {
  id?: string;
  reportId: string;
  reportNumber: string;
  exportType: CpvExportType;
  fileUrl: string;
  fileName: string;
  exportedBy: string;
  exportedAt: string;
  createdAt?: string;
  createdBy?: string;
  isDeleted?: boolean;
}

export interface CpvReportsAnalyticsSummary {
  totalReports: number;
  reportsThisMonth: number;
  failedReports: number;
  pdfExports: number;
  excelExports: number;
  highRiskProducts: number;
  oosCount: number;
  ootCount: number;
  averageCpk: number;
  cpvCompliancePct: number;
}

const requiredText = z.string().trim().min(1, 'Required');

export const cpvReportFormSchema = z.object({
  reportType: z.enum(CPV_REPORT_TYPES),
  productName: requiredText,
  productCode: z.string().trim().optional().default(''),
  batchNumber: z.string().trim().optional().default(''),
  reviewPeriodFrom: requiredText,
  reviewPeriodTo: requiredText,
  remarks: z.string().trim().optional().default(''),
}).refine((d) => new Date(d.reviewPeriodTo) >= new Date(d.reviewPeriodFrom), {
  message: 'Review period end must be on or after start date',
  path: ['reviewPeriodTo'],
});

export type CpvReportFormData = z.infer<typeof cpvReportFormSchema>;

export function buildReportId(productCode: string): string {
  const code = (productCode || 'ALL').replace(/\s+/g, '-').toUpperCase();
  return `CPV-RPT-${code}-${Date.now()}`;
}

export function generateReportNumber(year: number, existingCount: number): string {
  return `CPV-RPT/${year}/${String(existingCount + 1).padStart(4, '0')}`;
}

export function reportStatusLabel(status: string): string {
  return status || 'Draft';
}

export function healthScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Needs Attention';
  return 'Critical';
}

export function healthScoreTone(score: number): 'green' | 'blue' | 'amber' | 'red' {
  if (score >= 90) return 'green';
  if (score >= 75) return 'blue';
  if (score >= 60) return 'amber';
  return 'red';
}

export function computeCpvHealthScore(input: {
  criticalRiskCount: number;
  highRiskCount: number;
  oosCount: number;
  ootCount: number;
  overdueCapaCount: number;
  averageCpk: number;
}): number {
  let score = 100;
  score -= input.criticalRiskCount * 10;
  score -= input.highRiskCount * 5;
  score -= input.oosCount * 5;
  score -= input.ootCount * 3;
  score -= input.overdueCapaCount * 2;
  if (input.averageCpk < 1.33) score -= 5;
  return Math.max(0, Math.min(100, score));
}

export function countCppCqaCompliance(records: Array<{ status?: string }>) {
  let pass = 0;
  let oot = 0;
  let oos = 0;
  records.forEach((r) => {
    const d = displayCpvStatus(r.status || '');
    if (d === 'Pass') pass++;
    else if (d === 'OOT') oot++;
    else oos++;
  });
  const total = records.length;
  return {
    pass,
    oot,
    oos,
    compliancePct: total ? (pass / total) * 100 : 100,
  };
}

export function summarizeReportsAnalytics(
  reports: CpvReportRecord[],
  metrics?: CpvReportMetrics,
): CpvReportsAnalyticsSummary {
  const active = reports.filter((r) => !r.isDeleted);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    totalReports: active.length,
    reportsThisMonth: active.filter((r) => new Date(r.generatedDate || r.createdAt) >= monthStart).length,
    failedReports: active.filter((r) => r.reportStatus === 'Failed').length,
    pdfExports: active.filter((r) => r.exportType === 'PDF').length,
    excelExports: active.filter((r) => r.exportType === 'Excel').length,
    highRiskProducts: active.filter((r) => (r.metrics?.criticalRiskCount || 0) > 0 || (r.metrics?.highRiskCount || 0) > 0).length,
    oosCount: metrics?.oosCount ?? active.reduce((s, r) => s + (r.metrics?.oosCount || 0), 0),
    ootCount: metrics?.ootCount ?? active.reduce((s, r) => s + (r.metrics?.ootCount || 0), 0),
    averageCpk: metrics?.averageCpk ?? (active.length
      ? active.reduce((s, r) => s + (r.metrics?.averageCpk || 0), 0) / active.length
      : 0),
    cpvCompliancePct: metrics?.cpvCompliancePct ?? (active.length
      ? active.reduce((s, r) => s + (r.metrics?.cpvCompliancePct || 0), 0) / active.length
      : 100),
  };
}

export function buildReportCharts(metrics: CpvReportMetrics, previewRows: Record<string, unknown>[]) {
  const productMap = new Map<string, { cpp: number; cqa: number; total: number; pass: number }>();
  previewRows.forEach((row) => {
    const product = String(row.productName || row.product_name || 'Unknown');
    const mod = String(row._module || row.module || '');
    const entry = productMap.get(product) || { cpp: 0, cqa: 0, total: 0, pass: 0 };
    entry.total++;
    if (displayCpvStatus(String(row.status || '')) === 'Pass') entry.pass++;
    if (mod === 'CPP') entry.cpp++;
    if (mod === 'CQA') entry.cqa++;
    productMap.set(product, entry);
  });

  return {
    productCompliance: Array.from(productMap.entries()).map(([name, v]) => ({
      name,
      compliance: v.total ? Math.round((v.pass / v.total) * 100) : 100,
    })),
    cppVsCqa: [
      { name: 'CPP', value: metrics.cppCompliancePct },
      { name: 'CQA', value: metrics.cqaCompliancePct },
    ],
    ootOosTrend: [
      { name: 'OOT', value: metrics.ootCount },
      { name: 'OOS', value: metrics.oosCount },
    ],
    riskDistribution: [
      { name: 'Critical', value: metrics.criticalRiskCount },
      { name: 'High', value: metrics.highRiskCount },
      { name: 'Open', value: metrics.openRiskCount },
    ],
    cpkByProduct: [{ name: 'Average', value: Number(metrics.averageCpk.toFixed(2)) }],
    yieldSummary: [{ name: 'Yield Avg %', value: Number(metrics.averageYield.toFixed(1)) }],
    reportGenerationTrend: [{ name: 'Records', value: metrics.totalRecords }],
  };
}

export function canGenerateReportType(role: string | undefined, reportType: CpvReportType): boolean {
  if (!role) return false;
  if (['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager'].includes(role)) return true;
  if (['viewer', 'auditor'].includes(role)) return false;
  if (['qc', 'qc_manager'].includes(role)) {
    return ['CQA Monitoring Report', 'Stability Monitoring Report', 'OOT/OOS Summary Report', 'Product-wise CPV Report'].includes(reportType);
  }
  if (['production', 'production_manager'].includes(role)) {
    return ['CPP Monitoring Report', 'Yield Monitoring Report', 'Batch-wise CPV Report', 'Product-wise CPV Report'].includes(reportType);
  }
  if (['engineering', 'engineering_manager'].includes(role)) {
    return ['Utility Monitoring Report', 'Environmental Monitoring Report', 'Product-wise CPV Report'].includes(reportType);
  }
  return reportType === 'CPV Dashboard Summary Report' || reportType === 'Management Review Report';
}

export function reportTypeRequiresProduct(reportType: CpvReportType): boolean {
  return reportType !== 'CPV Dashboard Summary Report' && reportType !== 'Management Review Report';
}
