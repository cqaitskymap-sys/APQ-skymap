import { z } from 'zod';
import {
  WAREHOUSE_MATERIAL_TYPES, RECEIPT_STATUSES, QC_STATUSES,
  RELEASE_STATUSES, DISPENSING_STATUSES, FG_STATUSES, STORAGE_CONDITIONS,
} from './warehouse-mgmt-types';

export const receiptSchema = z.object({
  receipt_date: z.string().min(1),
  material_type: z.enum(WAREHOUSE_MATERIAL_TYPES as unknown as [string, ...string[]]),
  material_code: z.string().min(1),
  material_name: z.string().min(1),
  vendor_doc_id: z.string().nullable().optional(),
  vendor_name: z.string().min(1),
  manufacturer_name: z.string().default(''),
  supplier_name: z.string().default(''),
  invoice_number: z.string().default(''),
  po_number: z.string().default(''),
  batch_lot_number: z.string().min(1),
  mfg_date: z.string().nullable().optional(),
  exp_date: z.string().nullable().optional(),
  retest_date: z.string().nullable().optional(),
  received_quantity: z.coerce.number().positive(),
  unit: z.string().default('kg'),
  container_count: z.coerce.number().int().default(1),
  storage_condition: z.string().default('Room Temperature (15-25°C)'),
  coa_available: z.boolean().default(false),
  remarks: z.string().default(''),
});

export const samplingSchema = z.object({
  receipt_doc_id: z.string().min(1),
  grn_number: z.string().min(1),
  material_name: z.string().min(1),
  ar_number: z.string().min(1),
  sample_quantity: z.coerce.number().positive(),
  sampling_date: z.string().min(1),
  qc_status: z.enum(QC_STATUSES as unknown as [string, ...string[]]).default('Under Test'),
  remarks: z.string().default(''),
});

export const releaseSchema = z.object({
  receipt_doc_id: z.string().min(1),
  grn_number: z.string().min(1),
  ar_number: z.string().min(1),
  qc_result: z.enum(QC_STATUSES as unknown as [string, ...string[]]).default('Approved'),
  released_quantity: z.coerce.number().min(0),
  rejected_quantity: z.coerce.number().min(0).default(0),
  release_date: z.string().min(1),
  status: z.enum(RELEASE_STATUSES as unknown as [string, ...string[]]).default('Released'),
  remarks: z.string().default(''),
});

export const dispensingSchema = z.object({
  product_name: z.string().min(1),
  batch_number: z.string().min(1),
  material_name: z.string().min(1),
  material_code: z.string().min(1),
  ar_number: z.string().min(1),
  receipt_doc_id: z.string().min(1),
  required_quantity: z.coerce.number().positive(),
  dispensed_quantity: z.coerce.number().positive(),
  dispensing_date: z.string().min(1),
  checked_by_name: z.string().default(''),
  qa_verified_by_name: z.string().default(''),
  remarks: z.string().default(''),
});

export const finishedGoodsSchema = z.object({
  fg_batch_number: z.string().min(1),
  product_name: z.string().min(1),
  mfg_date: z.string().min(1),
  exp_date: z.string().min(1),
  packed_quantity: z.coerce.number().positive(),
  customer: z.string().default(''),
  market: z.string().default(''),
  source_batch_number: z.string().default(''),
  remarks: z.string().default(''),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;
export type SamplingInput = z.infer<typeof samplingSchema>;
export type ReleaseInput = z.infer<typeof releaseSchema>;
export type DispensingInput = z.infer<typeof dispensingSchema>;
export type FinishedGoodsInput = z.infer<typeof finishedGoodsSchema>;
