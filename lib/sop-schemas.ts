import { z } from 'zod';
import { SOP_CATEGORIES, SOP_STATUSES } from './sop-types';

export const sopCreateSchema = z.object({
  sop_title: z.string().min(1, 'Title is required'),
  short_title: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  category: z.enum(SOP_CATEGORIES as unknown as [string, ...string[]]).default('Quality Assurance'),
  owner_name: z.string().min(1, 'Owner is required'),
  approver_name: z.string().min(1, 'Approver is required'),
  author_name: z.string().optional(),
  business_unit: z.string().optional(),
  site: z.string().optional(),
  area: z.string().optional(),
  process: z.string().optional(),
  sub_process: z.string().optional(),
  version: z.string().default('1.0'),
  effective_date: z.string().nullable().optional(),
  review_due_date: z.string().min(1, 'Review due date is mandatory'),
  training_required: z.boolean().default(true),
  training_before_effective: z.boolean().default(false),
  electronic_signature_required: z.boolean().default(true),
  linked_change_control: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  confidentiality: z.string().default('Internal'),
  language: z.string().default('English'),
});

export const sopUpdateSchema = sopCreateSchema.partial();

export const sopTransitionSchema = z.object({
  sop_id: z.string().min(1),
  to_status: z.string().min(1),
  comments: z.string().optional(),
  effective_date: z.string().optional(),
});

export const sopFilterSchema = z.object({
  status: z.string().optional(),
  department: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  review_due: z.boolean().optional(),
  overdue: z.boolean().optional(),
  training_pending: z.boolean().optional(),
  favorites: z.boolean().optional(),
});

export const sopBulkActionSchema = z.object({
  sop_ids: z.array(z.string()).min(1),
  action: z.enum(['archive', 'retire', 'schedule_review']),
  reason: z.string().min(1),
});

export type SopCreateInput = z.infer<typeof sopCreateSchema>;
export type SopUpdateInput = z.infer<typeof sopUpdateSchema>;
export type SopTransitionInput = z.infer<typeof sopTransitionSchema>;
export type SopBulkActionInput = z.infer<typeof sopBulkActionSchema>;

export function validateSopEffective(
  effectiveDate: string | null | undefined,
  reviewDueDate: string | null | undefined,
  workflowStatus: string,
  trainingBeforeEffective: boolean,
  trainingComplete: boolean,
): string | null {
  if (!effectiveDate) return 'Effective date is mandatory';
  if (!reviewDueDate) return 'Review due date is mandatory';
  if (!['approved', 'Scheduled'].includes(workflowStatus) && workflowStatus !== 'Approved') {
    return 'Cannot become Effective until approvals complete';
  }
  if (trainingBeforeEffective && !trainingComplete) {
    return 'Cannot become Effective until mandatory training completed';
  }
  return null;
}
