import { z } from 'zod';
import { DOCUMENT_CATEGORIES, CONFIDENTIALITY_LEVELS } from './document-master-types';

const documentMasterBaseSchema = z.object({
  document_title: z.string().min(1, 'Title is required'),
  short_title: z.string().optional(),
  document_category: z.enum(DOCUMENT_CATEGORIES as unknown as [string, ...string[]], {
    required_error: 'Category is required',
  }),
  document_type: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  business_unit: z.string().optional(),
  site: z.string().optional(),
  plant: z.string().optional(),
  process: z.string().optional(),
  sub_process: z.string().optional(),
  owner_name: z.string().min(1, 'Owner is required'),
  author_name: z.string().optional(),
  language: z.string().default('English'),
  country: z.string().optional(),
  region: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  confidentiality: z.enum(CONFIDENTIALITY_LEVELS as unknown as [string, ...string[]]).default('Internal'),
  classification: z.string().optional(),
  training_required: z.boolean().default(false),
  change_control_required: z.boolean().default(false),
  electronic_signature_required: z.boolean().default(true),
  effective_date: z.string().nullable().optional(),
  review_due_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  linked_change_control: z.string().nullable().optional(),
});

export const documentMasterCreateSchema = documentMasterBaseSchema.superRefine((data, ctx) => {
  if (data.effective_date && data.review_due_date && data.review_due_date <= data.effective_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Review due date must be after effective date',
      path: ['review_due_date'],
    });
  }
});

export const documentMasterUpdateSchema = documentMasterBaseSchema.partial();

export const documentMasterBulkArchiveSchema = z.object({
  document_ids: z.array(z.string()).min(1, 'Select at least one document'),
  reason: z.string().min(1, 'Reason is required'),
});

export type DocumentMasterCreateInput = z.infer<typeof documentMasterBaseSchema>;
export type DocumentMasterUpdateInput = z.infer<typeof documentMasterUpdateSchema>;
export type DocumentMasterBulkArchiveInput = z.infer<typeof documentMasterBulkArchiveSchema>;
