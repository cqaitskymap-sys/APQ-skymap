import { z } from 'zod';
import { DOCUMENT_TYPES, DMS_DEPARTMENTS } from './dms-types';

export const documentCreateSchema = z.object({
  document_title: z.string().min(1, 'Title is required'),
  document_type: z.enum(DOCUMENT_TYPES as unknown as [string, ...string[]], { required_error: 'Type is required' }),
  department: z.enum(DMS_DEPARTMENTS as unknown as [string, ...string[]], { required_error: 'Department is required' }),
  product_name: z.string().default(''),
  version: z.string().min(1, 'Revision / version is required'),
  effective_date: z.string().nullable().optional(),
  next_review_date: z.string().nullable().optional(),
  prepared_by_name: z.string().min(1, 'Prepared by is required'),
  change_control_ref: z.string().default(''),
  change_control_id: z.string().nullable().optional(),
  supersedes_document_no: z.string().default(''),
  supersedes_document_id: z.string().nullable().optional(),
  reason_for_revision: z.string().default(''),
  remarks: z.string().default(''),
  linked_pqr_id: z.string().nullable().optional(),
  linked_cpv_id: z.string().nullable().optional(),
});

export const documentUpdateSchema = documentCreateSchema.partial();

export const documentSubmitSchema = z.object({
  comments: z.string().default(''),
});

export const documentApprovalSchema = z.object({
  stage: z.enum(['department_review', 'qa_review', 'head_qa_approval']),
  decision: z.enum(['approved', 'rejected', 'returned']),
  comments: z.string().default(''),
});

export const documentRevisionSchema = z.object({
  version: z.string().min(1, 'New version is required'),
  reason_for_revision: z.string().min(1, 'Reason for revision is required'),
  effective_date: z.string().nullable().optional(),
  next_review_date: z.string().nullable().optional(),
  change_control_ref: z.string().default(''),
  change_control_id: z.string().nullable().optional(),
  supersedes_document_no: z.string().default(''),
  remarks: z.string().default(''),
});

export const distributionSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  user_name: z.string().min(1, 'User name is required'),
});

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentApprovalInput = z.infer<typeof documentApprovalSchema>;
export type DocumentRevisionInput = z.infer<typeof documentRevisionSchema>;
export type DistributionInput = z.infer<typeof distributionSchema>;
