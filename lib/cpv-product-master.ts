import { z } from 'zod';
import { DOSAGE_FORMS, MARKET_OPTIONS } from '@/lib/admin/constants';

export const CPV_PRODUCT_COLLECTION = 'cpv_products';
export const CPV_PRODUCT_MODULE = 'CPV Product Master';

export const CPV_PRODUCT_STATUSES = [
  'Active',
  'Inactive',
  'Under Review',
  'Discontinued',
] as const;

export const CPV_REVIEW_FREQUENCIES = [
  'Monthly',
  'Quarterly',
  'Half Yearly',
  'Yearly',
] as const;

const requiredText = z.string().trim().min(1, 'Required');

export const cpvProductFormSchema = z.object({
  adminProductId: requiredText,
  productCode: requiredText,
  productName: requiredText,
  genericName: z.string().trim().default(''),
  brandName: z.string().trim().default(''),
  strength: requiredText,
  dosageForm: requiredText,
  routeOfAdministration: z.string().trim().default(''),
  packSize: z.string().trim().default(''),
  market: z.string().trim().default(''),
  shelfLife: z.string().trim().default(''),
  storageCondition: z.string().trim().default(''),
  standardBatchSize: z.string().trim().default(''),
  manufacturingLicenseNumber: z.string().trim().default(''),
  mfrNumber: z.string().trim().default(''),
  bmrNumber: z.string().trim().default(''),
  bprNumber: z.string().trim().default(''),
  specificationNumber: z.string().trim().default(''),
  stpNumber: z.string().trim().default(''),
  cpvStatus: z.enum(CPV_PRODUCT_STATUSES).default('Active'),
  cpvStartDate: requiredText,
  cpvReviewFrequency: z.enum(CPV_REVIEW_FREQUENCIES),
  cpvOwner: requiredText,
  qaReviewer: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
  linkedCppParameterIds: z.array(z.string()).default([]),
  linkedCqaParameterIds: z.array(z.string()).default([]),
});

export type CpvProductFormData = z.infer<typeof cpvProductFormSchema>;

export interface CpvProductRecord extends CpvProductFormData, Record<string, unknown> {
  id: string;
  cpvProductId: string;
  nextReviewDueDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
  status?: string;
}

export interface LinkedParameterRow {
  id: string;
  parameterCode: string;
  parameterName: string;
  parameterType: string;
  processStage: string;
  lsl: string;
  usl: string;
  target: string;
  unit: string;
  criticality: string;
  status: string;
}

export interface CpvProductSummary {
  total: number;
  active: number;
  inactive: number;
  underReview: number;
  withoutCppLink: number;
  withoutCqaLink: number;
  dueForReview: number;
}

export function buildCpvProductId(productCode: string): string {
  return `CPV-${productCode.toUpperCase().replace(/\s+/g, '-')}`;
}

export function computeNextReviewDueDate(
  startDate: string,
  frequency: typeof CPV_REVIEW_FREQUENCIES[number],
  fromDate?: string,
): string {
  const base = fromDate || startDate;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return '';
  const months =
    frequency === 'Monthly' ? 1
      : frequency === 'Quarterly' ? 3
        : frequency === 'Half Yearly' ? 6
          : 12;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function isCpvProductOperational(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'active' || s === 'under review';
}

export function summarizeCpvProducts(products: CpvProductRecord[]): CpvProductSummary {
  const today = new Date().toISOString().split('T')[0];
  return {
    total: products.length,
    active: products.filter((p) => p.cpvStatus === 'Active').length,
    inactive: products.filter((p) => p.cpvStatus === 'Inactive').length,
    underReview: products.filter((p) => p.cpvStatus === 'Under Review').length,
    withoutCppLink: products.filter((p) => !p.linkedCppParameterIds?.length).length,
    withoutCqaLink: products.filter((p) => !p.linkedCqaParameterIds?.length).length,
    dueForReview: products.filter((p) => {
      if (!isCpvProductOperational(p.cpvStatus)) return false;
      const due = p.nextReviewDueDate || computeNextReviewDueDate(p.cpvStartDate, p.cpvReviewFrequency);
      return due && due <= today;
    }).length,
  };
}

export const DOSAGE_FORM_FILTER_OPTIONS = [...DOSAGE_FORMS];
export const MARKET_FILTER_OPTIONS = [...MARKET_OPTIONS];
