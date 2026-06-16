import { z } from 'zod';
import {
  BATCH_STATUSES,
  RELEASE_STATUSES,
  BATCH_SIZE_UNITS,
} from '@/lib/admin/constants';
import { CPV_REVIEW_FREQUENCIES } from '@/lib/cpv-product-master';

export const CPV_BATCH_COLLECTION = 'cpv_batches';
export const CPV_BATCH_MODULE = 'CPV Batch Registration';

export const CPV_BATCH_STATUSES = BATCH_STATUSES;
export const CPV_RELEASE_STATUSES = RELEASE_STATUSES;

const requiredText = z.string().trim().min(1, 'Required');

export const cpvBatchFormSchema = z.object({
  cpvProductId: requiredText,
  batchNumber: requiredText,
  productCode: requiredText,
  productName: requiredText,
  genericName: z.string().trim().default(''),
  strength: z.string().trim().default(''),
  dosageForm: z.string().trim().default(''),
  packSize: z.string().trim().default(''),
  market: z.string().trim().default(''),
  batchSize: z.coerce.number().positive('Batch size must be numeric'),
  batchSizeUnit: z.enum(BATCH_SIZE_UNITS).default('Vials'),
  manufacturingDate: requiredText,
  expiryDate: requiredText,
  manufacturingSite: requiredText,
  manufacturingLine: z.string().trim().default(''),
  shift: z.string().trim().default('A'),
  mfrNumber: z.string().trim().default(''),
  bmrNumber: z.string().trim().default(''),
  bprNumber: z.string().trim().default(''),
  semiFinishedBatchNumber: z.string().trim().default(''),
  finishedProductBatchNumber: z.string().trim().default(''),
  packingBatchNumber: z.string().trim().default(''),
  manufacturedFor: z.string().trim().default(''),
  customerName: z.string().trim().default(''),
  cpvReviewPeriod: z.enum(CPV_REVIEW_FREQUENCIES).default('Yearly'),
  batchStatus: z.enum(CPV_BATCH_STATUSES).default('Planned'),
  releaseStatus: z.enum(CPV_RELEASE_STATUSES).default('Pending'),
  qaReleaseDate: z.string().trim().default(''),
  qaReleasedBy: z.string().trim().default(''),
  statusChangeReason: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
}).superRefine((data, ctx) => {
  const mfg = new Date(data.manufacturingDate);
  const exp = new Date(data.expiryDate);
  if (!Number.isNaN(mfg.getTime()) && !Number.isNaN(exp.getTime()) && exp <= mfg) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expiry date must be after manufacturing date',
      path: ['expiryDate'],
    });
  }
  if (data.batchStatus === 'Rejected' && !data.statusChangeReason.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Rejection reason is required',
      path: ['statusChangeReason'],
    });
  }
  if (data.batchStatus === 'Hold' && !data.statusChangeReason.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Hold reason is required',
      path: ['statusChangeReason'],
    });
  }
});

export type CpvBatchFormData = z.infer<typeof cpvBatchFormSchema>;

export interface CpvBatchRecord extends CpvBatchFormData, Record<string, unknown> {
  id: string;
  cpvBatchId: string;
  specificationNumber?: string;
  stpNumber?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
  status?: string;
}

export interface CpvBatchSummary {
  total: number;
  planned: number;
  manufacturing: number;
  qcTesting: number;
  qaReview: number;
  released: number;
  rejected: number;
  hold: number;
  dueForReview: number;
}

export function buildCpvBatchId(batchNumber: string): string {
  return `CPV-BATCH-${batchNumber.toUpperCase().replace(/\s+/g, '-')}`;
}

export function isBatchFieldLocked(batchStatus: string): boolean {
  return batchStatus === 'Released';
}

export function summarizeCpvBatches(batches: CpvBatchRecord[]): CpvBatchSummary {
  const today = new Date().toISOString().split('T')[0];
  return {
    total: batches.length,
    planned: batches.filter((b) => b.batchStatus === 'Planned').length,
    manufacturing: batches.filter((b) => b.batchStatus === 'Manufacturing').length,
    qcTesting: batches.filter((b) => b.batchStatus === 'Under QC Testing').length,
    qaReview: batches.filter((b) => b.batchStatus === 'Under QA Review').length,
    released: batches.filter((b) => b.batchStatus === 'Released').length,
    rejected: batches.filter((b) => b.batchStatus === 'Rejected').length,
    hold: batches.filter((b) => b.batchStatus === 'Hold').length,
    dueForReview: batches.filter((b) => {
      if (b.batchStatus === 'Cancelled') return false;
      const due = b.qaReleaseDate || b.expiryDate;
      return due && due <= today && b.batchStatus !== 'Released';
    }).length,
  };
}
