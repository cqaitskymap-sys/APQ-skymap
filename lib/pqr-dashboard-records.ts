import { z } from 'zod';

export const PQR_DASHBOARD_MODULE = 'PQR Dashboard';

export const PQR_DASHBOARD_COLLECTIONS = {
  records: 'pqr_records',
  recordsLegacy: 'pqr_documents',
  reviews: 'pqr_reviews',
  approvals: 'pqr_approvals',
  products: 'products',
  batches: 'batches',
  cpvBatches: 'cpv_batches',
  cppResults: 'cpp_results',
  cqaResults: 'cqa_results',
  yieldMonitoring: 'yield_monitoring',
  stabilityMonitoring: 'stability_monitoring',
  deviations: 'deviations',
  oosRecords: 'oos_records',
  capaRecords: 'capa_records',
  changeControls: 'change_controls',
  complaints: 'complaints',
  recalls: 'recalls',
  validationRecords: 'validation_records',
  riskAssessment: 'risk_assessment',
  processCapability: 'process_capability',
} as const;

export const PQR_STATUSES = ['Draft', 'Under Review', 'Approved', 'Rejected', 'Archived'] as const;
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

export type PqrStatus = (typeof PQR_STATUSES)[number];

export interface PqrDashboardFilters {
  product?: string;
  reviewYear?: string;
  reviewPeriod?: string;
  status?: string;
  preparedBy?: string;
  pendingWith?: string;
  riskLevel?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PqrDashboardKpis {
  totalPqrs: number;
  draftPqrs: number;
  underReviewPqrs: number;
  approvedPqrs: number;
  rejectedPqrs: number;
  archivedPqrs: number;
  pqrsDueThisMonth: number;
  overduePqrs: number;
  totalProductsReviewed: number;
  totalBatchesReviewed: number;
  releasedBatches: number;
  rejectedBatches: number;
  deviationCount: number;
  oosCount: number;
  capaCount: number;
  changeControlCount: number;
  marketComplaintCount: number;
  recallCount: number;
  averageYieldPct: number;
  averageAssayPct: number;
  averageCpk: number;
  openRisks: number;
  pendingApprovals: number;
}

export interface PqrRecordRow {
  id: string;
  pqrNumber: string;
  product: string;
  reviewPeriod: string;
  status: string;
  preparedBy: string;
  pendingWith: string;
  createdDate: string;
  dueDate?: string;
  reviewYear?: number;
}

export interface PqrDueRow {
  id: string;
  product: string;
  reviewYear: number;
  dueDate: string;
  daysOverdue: number;
  owner: string;
  status: string;
}

export interface PqrPendingApprovalRow {
  id: string;
  pqrNumber: string;
  product: string;
  currentStep: string;
  pendingWith: string;
  dueDate: string;
  priority: string;
  pqrId?: string;
}

export interface PqrCriticalAlertRow {
  id: string;
  product: string;
  batchNo: string;
  source: string;
  issue: string;
  riskLevel: string;
  status: string;
}

export interface PqrActivityEntry {
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export interface PqrDashboardCharts {
  statusDistribution: Array<{ name: string; value: number }>;
  monthlyCreationTrend: Array<{ month: string; value: number }>;
  productStatus: Array<{ product: string; draft: number; review: number; approved: number }>;
  batchReleaseTrend: Array<{ month: string; released: number; rejected: number }>;
  qualityTrend: Array<{ month: string; deviations: number; oos: number; capa: number }>;
  yieldTrend: Array<{ month: string; value: number }>;
  assayTrend: Array<{ month: string; value: number }>;
  stabilityTrend: Array<{ month: string; value: number }>;
  complaintRecallTrend: Array<{ month: string; complaints: number; recalls: number }>;
  approvalPendingTrend: Array<{ month: string; value: number }>;
}

export interface PqrDashboardData {
  kpis: PqrDashboardKpis;
  charts: PqrDashboardCharts;
  recentPqrs: PqrRecordRow[];
  duePqrs: PqrDueRow[];
  pendingApprovals: PqrPendingApprovalRow[];
  criticalAlerts: PqrCriticalAlertRow[];
  activity: PqrActivityEntry[];
  generatedAt: string;
}

export function normalizePqrStatus(raw?: string): PqrStatus | string {
  const s = String(raw || 'Draft').toLowerCase().replace(/_/g, ' ').trim();
  if (s === 'draft') return 'Draft';
  if (s === 'under review' || s === 'in review') return 'Under Review';
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'archived') return 'Archived';
  return raw || 'Draft';
}

export function statusColor(status: string): string {
  const s = normalizePqrStatus(status);
  if (s === 'Draft') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (s === 'Under Review') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (s === 'Approved') return 'bg-green-50 text-green-700 border-green-200';
  if (s === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (s === 'Archived') return 'bg-slate-50 text-slate-600 border-slate-300';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function riskColor(level: string): string {
  if (level === 'Critical') return 'bg-red-900/10 text-red-900 border-red-300';
  if (level === 'High') return 'bg-red-50 text-red-700 border-red-200';
  if (level === 'Medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
}

export function canViewPqrDashboard(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'qc', 'qc_manager', 'qc_executive',
    'production', 'production_manager', 'production_executive',
    'warehouse', 'warehouse_manager', 'warehouse_executive',
    'engineering', 'engineering_manager', 'engineering_executive',
    'management', 'department_head', 'auditor', 'viewer',
  ].includes(role || '');
}

export function canExportPqrDashboard(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor'].includes(role || '');
}

export function isPqrDashboardViewOnly(role?: string): boolean {
  return ['auditor', 'viewer'].includes(role || '');
}

export const emptyKpis = (): PqrDashboardKpis => ({
  totalPqrs: 0, draftPqrs: 0, underReviewPqrs: 0, approvedPqrs: 0, rejectedPqrs: 0,
  archivedPqrs: 0, pqrsDueThisMonth: 0, overduePqrs: 0, totalProductsReviewed: 0,
  totalBatchesReviewed: 0, releasedBatches: 0, rejectedBatches: 0, deviationCount: 0,
  oosCount: 0, capaCount: 0, changeControlCount: 0, marketComplaintCount: 0,
  recallCount: 0, averageYieldPct: 0, averageAssayPct: 0, averageCpk: 0,
  openRisks: 0, pendingApprovals: 0,
});

export const emptyCharts = (): PqrDashboardCharts => ({
  statusDistribution: [],
  monthlyCreationTrend: [],
  productStatus: [],
  batchReleaseTrend: [],
  qualityTrend: [],
  yieldTrend: [],
  assayTrend: [],
  stabilityTrend: [],
  complaintRecallTrend: [],
  approvalPendingTrend: [],
});
