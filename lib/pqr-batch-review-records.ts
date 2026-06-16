import { z } from 'zod';

export const PQR_BATCH_REVIEW_MODULE = 'PQR Batch Review';

export const PQR_BATCH_REVIEW_COLLECTIONS = {
  batchReview: 'pqr_batch_review',
  sections: 'pqr_sections',
  records: 'pqr_records',
  recordsLegacy: 'pqr_documents',
  batches: 'batches',
  cpvBatches: 'cpv_batches',
  deviations: 'deviations',
  oosRecords: 'oos_records',
  capaRecords: 'capa_records',
} as const;

export const BATCH_REVIEW_STATUSES = [
  'Manufactured', 'Under QC Testing', 'Under QA Review', 'Released', 'Rejected',
  'Hold', 'Reworked', 'Reprocessed', 'Cancelled',
] as const;

export const BATCH_RELEASE_STATUSES = [
  'Released', 'Rejected', 'On Hold', 'Pending', 'Not Applicable',
] as const;

export type BatchReviewStatus = (typeof BATCH_REVIEW_STATUSES)[number];
export type BatchReleaseStatus = (typeof BATCH_RELEASE_STATUSES)[number];

export interface PqrOption {
  id: string;
  pqrNumber: string;
  productName: string;
  productCode: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
}

export interface PqrBatchReviewRecord {
  id?: string;
  batchReviewId: string;
  pqrId: string;
  pqrNumber: string;
  product: string;
  productCode: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  reviewPeriodFrom: string;
  reviewPeriodTo: string;
  batchNumber: string;
  semiFinishedBatchNumber: string;
  finishedProductBatchNumber: string;
  packingBatchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  batchSize: number;
  batchSizeUnit: string;
  manufacturedFor: string;
  customerName: string;
  market: string;
  batchStatus: BatchReviewStatus | string;
  releaseStatus: BatchReleaseStatus | string;
  releaseDate: string;
  qaReleasedBy: string;
  rejectionReason: string;
  holdReason: string;
  reworkRequired: boolean;
  reprocessRequired: boolean;
  linkedDeviationCount: number;
  linkedOosCount: number;
  linkedCapaCount: number;
  remarks: string;
  sourceType?: 'manual' | 'batch_master' | 'cpv_batch';
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface PqrBatchReviewSummary {
  totalBatches: number;
  releasedBatches: number;
  rejectedBatches: number;
  holdBatches: number;
  reworkedBatches: number;
  reprocessedBatches: number;
  releasePct: number;
  rejectionPct: number;
}

export interface PqrBatchReviewCharts {
  statusDistribution: Array<{ name: string; value: number }>;
  monthlyManufacturing: Array<{ month: string; count: number }>;
  releaseRejectTrend: Array<{ month: string; released: number; rejected: number }>;
  productTrend: Array<{ product: string; count: number }>;
  manufacturedForTrend: Array<{ name: string; count: number }>;
}

export interface PqrBatchReviewFilters {
  pqrNumber?: string;
  product?: string;
  batchStatus?: string;
  releaseStatus?: string;
  manufacturedFor?: string;
  customer?: string;
  mfgDateFrom?: string;
  mfgDateTo?: string;
  expDateFrom?: string;
  expDateTo?: string;
}

export const batchReviewFormSchema = z.object({
  pqrId: z.string().min(1, 'PQR selection is required'),
  product: z.string().min(1, 'Product is required'),
  productCode: z.string().min(1, 'Product code is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  batchSize: z.coerce.number().positive('Batch size must be numeric'),
  batchSizeUnit: z.string().default('Vials'),
  genericName: z.string().default(''),
  strength: z.string().default(''),
  dosageForm: z.string().default(''),
  semiFinishedBatchNumber: z.string().default(''),
  finishedProductBatchNumber: z.string().default(''),
  packingBatchNumber: z.string().default(''),
  manufacturedFor: z.string().default(''),
  customerName: z.string().default(''),
  market: z.string().default(''),
  batchStatus: z.enum(BATCH_REVIEW_STATUSES).default('Manufactured'),
  releaseStatus: z.enum(BATCH_RELEASE_STATUSES).default('Pending'),
  releaseDate: z.string().default(''),
  qaReleasedBy: z.string().default(''),
  rejectionReason: z.string().default(''),
  holdReason: z.string().default(''),
  reworkRequired: z.boolean().default(false),
  reprocessRequired: z.boolean().default(false),
  remarks: z.string().default(''),
}).refine((d) => d.expiryDate > d.manufacturingDate, {
  message: 'Expiry date must be after manufacturing date',
  path: ['expiryDate'],
}).refine((d) => d.batchStatus !== 'Rejected' || d.rejectionReason.trim().length > 0, {
  message: 'Rejection reason is required for rejected batches',
  path: ['rejectionReason'],
}).refine((d) => d.batchStatus !== 'Hold' || d.holdReason.trim().length > 0, {
  message: 'Hold reason is required for hold batches',
  path: ['holdReason'],
});

export type BatchReviewFormData = z.infer<typeof batchReviewFormSchema>;

export function canViewBatchReview(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'qc', 'qc_manager', 'qc_executive',
    'production', 'production_manager', 'production_executive',
    'warehouse', 'warehouse_manager', 'warehouse_executive',
    'auditor', 'viewer',
  ].includes(role || '');
}

export function canManageBatchReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive'].includes(role || '');
}

export function canAddBatchReview(role?: string): boolean {
  return [
    'super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'qa_executive',
    'production', 'production_manager', 'production_executive',
  ].includes(role || '');
}

export function canExportBatchReview(role?: string): boolean {
  return ['super_admin', 'admin', 'qa', 'head_qa', 'qa_manager', 'auditor'].includes(role || '');
}

export function isBatchReviewViewOnly(role?: string): boolean {
  return ['auditor', 'viewer', 'qc', 'qc_manager', 'qc_executive',
    'warehouse', 'warehouse_manager', 'warehouse_executive'].includes(role || '');
}

export function batchStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('release')) return 'bg-green-50 text-green-700 border-green-200';
  if (s.includes('reject')) return 'bg-red-50 text-red-700 border-red-200';
  if (s.includes('hold')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (s.includes('rework') || s.includes('reprocess')) return 'bg-orange-50 text-orange-800 border-orange-200';
  if (s.includes('cancel')) return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

export function releaseStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'released') return 'bg-green-50 text-green-700 border-green-200';
  if (s === 'rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (s.includes('hold')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (s === 'pending') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function computeBatchSummary(records: PqrBatchReviewRecord[]): PqrBatchReviewSummary {
  const active = records.filter((r) => !r.isDeleted);
  const total = active.length;
  const released = active.filter((r) =>
    strMatch(r.batchStatus, 'released') || strMatch(r.releaseStatus, 'released'),
  ).length;
  const rejected = active.filter((r) =>
    strMatch(r.batchStatus, 'rejected') || strMatch(r.releaseStatus, 'rejected'),
  ).length;
  const hold = active.filter((r) =>
    strMatch(r.batchStatus, 'hold') || strMatch(r.releaseStatus, 'hold'),
  ).length;
  const reworked = active.filter((r) => strMatch(r.batchStatus, 'rework') || r.reworkRequired).length;
  const reprocessed = active.filter((r) => strMatch(r.batchStatus, 'reprocess') || r.reprocessRequired).length;

  return {
    totalBatches: total,
    releasedBatches: released,
    rejectedBatches: rejected,
    holdBatches: hold,
    reworkedBatches: reworked,
    reprocessedBatches: reprocessed,
    releasePct: total ? Math.round((released / total) * 1000) / 10 : 0,
    rejectionPct: total ? Math.round((rejected / total) * 1000) / 10 : 0,
  };
}

function strMatch(val: string, token: string): boolean {
  return String(val || '').toLowerCase().includes(token);
}

export function generateBatchNarrative(summary: PqrBatchReviewSummary): string {
  const parts: string[] = [];
  if (summary.totalBatches === 0) {
    return 'No batch manufacturing records were identified for the selected PQR review period.';
  }
  if (summary.rejectedBatches === 0 && summary.releasedBatches === summary.totalBatches) {
    parts.push('All batches manufactured during the review period were released and no batch was rejected.');
  } else if (summary.rejectedBatches > 0) {
    parts.push(`During the review period, ${summary.rejectedBatches} batches were rejected. Details are summarized in the batch review table.`);
  }
  if (summary.holdBatches > 0) {
    parts.push(`${summary.holdBatches} batches were kept on hold during the review period and were reviewed for quality impact.`);
  }
  if (summary.reworkedBatches === 0 && summary.reprocessedBatches === 0) {
    parts.push('No rework or reprocessing was performed during the review period.');
  } else {
    if (summary.reworkedBatches > 0) parts.push(`${summary.reworkedBatches} batch(es) underwent rework.`);
    if (summary.reprocessedBatches > 0) parts.push(`${summary.reprocessedBatches} batch(es) were reprocessed.`);
  }
  parts.push(`Total ${summary.totalBatches} batches manufactured with ${summary.releasePct}% release rate and ${summary.rejectionPct}% rejection rate.`);
  return parts.join(' ');
}

export function buildBatchCharts(records: PqrBatchReviewRecord[]): PqrBatchReviewCharts {
  const active = records.filter((r) => !r.isDeleted);
  const statusMap = new Map<string, number>();
  const monthMap = new Map<string, number>();
  const releaseMap = new Map<string, { released: number; rejected: number }>();
  const productMap = new Map<string, number>();
  const mfgForMap = new Map<string, number>();

  active.forEach((r) => {
    statusMap.set(r.batchStatus, (statusMap.get(r.batchStatus) || 0) + 1);
    const month = r.manufacturingDate?.slice(0, 7) || 'Unknown';
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
    const rm = releaseMap.get(month) || { released: 0, rejected: 0 };
    if (strMatch(r.releaseStatus, 'release') && !strMatch(r.releaseStatus, 'reject')) rm.released += 1;
    if (strMatch(r.releaseStatus, 'reject') || strMatch(r.batchStatus, 'reject')) rm.rejected += 1;
    releaseMap.set(month, rm);
    productMap.set(r.product, (productMap.get(r.product) || 0) + 1);
    const mf = r.manufacturedFor || r.customerName || 'Internal';
    mfgForMap.set(mf, (mfgForMap.get(mf) || 0) + 1);
  });

  const sortEntries = (entries: [string, unknown][]) =>
    entries.sort(([a], [b]) => a.localeCompare(b)).slice(-8);

  return {
    statusDistribution: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
    monthlyManufacturing: sortEntries(Array.from(monthMap.entries())).map(([month, count]) => ({
      month, count: count as number,
    })),
    releaseRejectTrend: sortEntries(Array.from(releaseMap.entries())).map(([month, v]) => ({
      month, ...(v as { released: number; rejected: number }),
    })),
    productTrend: Array.from(productMap.entries()).map(([product, count]) => ({ product, count })),
    manufacturedForTrend: Array.from(mfgForMap.entries()).slice(0, 8).map(([name, count]) => ({ name, count })),
  };
}

export const emptyCharts = (): PqrBatchReviewCharts => ({
  statusDistribution: [],
  monthlyManufacturing: [],
  releaseRejectTrend: [],
  productTrend: [],
  manufacturedForTrend: [],
});

export const PQR_TABLE_COLUMNS = [
  'Sr. No.', 'Batch No.', 'Semi Finish Batch No.', 'Finished Product Batch No.',
  'MFG Date', 'EXP Date', 'Batch Size', 'Manufactured For', 'Status', 'Remarks',
] as const;
