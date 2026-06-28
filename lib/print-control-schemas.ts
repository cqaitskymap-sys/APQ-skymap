import { z } from 'zod';
import { PRINT_TYPES } from './print-control-types';

const printTypeEnum = z.enum(PRINT_TYPES as unknown as [string, ...string[]]);

export const createPrintRequestSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  print_reason: z.string().min(5, 'Print reason is required'),
  print_type: printTypeEnum,
  total_copies: z.number().min(1).max(50).default(1),
  print_location: z.string().min(1, 'Print location is required'),
  printer: z.string().optional().default(''),
  department: z.string().min(1, 'Department is required'),
  site: z.string().optional().default(''),
  issued_to_name: z.string().optional().default(''),
  approver_id: z.string().optional().default(''),
  approver_name: z.string().optional().default(''),
  electronic_signature_required: z.boolean().default(false),
  print_watermark: z.string().optional().default(''),
});

export const approvePrintSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional().default(''),
});

export const issueCopySchema = z.object({
  copy_id: z.string().min(1),
  issued_to: z.string().min(1),
  issued_to_name: z.string().min(1),
});

export const returnCopySchema = z.object({
  copy_id: z.string().min(1),
  return_notes: z.string().optional().default(''),
});

export const reconcileCopySchema = z.object({
  copy_id: z.string().min(1),
  notes: z.string().optional().default(''),
});

export const destroyCopySchema = z.object({
  copy_id: z.string().min(1),
  reason: z.string().min(5, 'Destruction reason is required'),
});

export const bulkApproveSchema = z.object({
  request_ids: z.array(z.string()).min(1),
});

export type CreatePrintRequestInput = z.infer<typeof createPrintRequestSchema>;
export type ApprovePrintInput = z.infer<typeof approvePrintSchema>;
export type IssueCopyInput = z.infer<typeof issueCopySchema>;
export type ReturnCopyInput = z.infer<typeof returnCopySchema>;
export type ReconcileCopyInput = z.infer<typeof reconcileCopySchema>;
export type DestroyCopyInput = z.infer<typeof destroyCopySchema>;
export type BulkApproveInput = z.infer<typeof bulkApproveSchema>;
