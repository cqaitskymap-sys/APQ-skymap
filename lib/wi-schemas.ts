import { z } from 'zod';
import { WI_CATEGORIES } from './wi-types';

export const wiCreateSchema = z.object({
  wi_title: z.string().min(1, 'Title is required'),
  short_title: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  category: z.enum(WI_CATEGORIES as unknown as [string, ...string[]]).default('Production'),
  owner_name: z.string().min(1, 'Owner is required'),
  approver_name: z.string().min(1, 'Approver is required'),
  author_name: z.string().optional(),
  business_unit: z.string().optional(),
  site: z.string().optional(),
  area: z.string().optional(),
  equipment: z.string().optional(),
  equipment_id: z.string().nullable().optional(),
  production_line: z.string().optional(),
  production_line_id: z.string().nullable().optional(),
  related_sop: z.string().optional(),
  related_sop_id: z.string().nullable().optional(),
  version: z.string().default('1.0'),
  effective_date: z.string().min(1, 'Effective date is required'),
  review_due_date: z.string().min(1, 'Review due date is required'),
  training_required: z.boolean().default(true),
  electronic_signature_required: z.boolean().default(true),
  linked_change_control: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  confidentiality: z.string().default('Internal'),
  language: z.string().default('English'),
});

export const wiUpdateSchema = wiCreateSchema.partial();
export const wiBulkActionSchema = z.object({
  wi_ids: z.array(z.string()).min(1),
  action: z.enum(['archive', 'retire', 'schedule_review']),
  reason: z.string().min(1),
});

export type WiCreateInput = z.infer<typeof wiCreateSchema>;
export type WiUpdateInput = z.infer<typeof wiUpdateSchema>;
export type WiBulkActionInput = z.infer<typeof wiBulkActionSchema>;

export function validateWiEffective(
  effectiveDate: string | null | undefined,
  reviewDueDate: string | null | undefined,
  status: string,
  approvalsComplete: boolean,
): string | null {
  if (!effectiveDate) return 'Effective date is required';
  if (!reviewDueDate) return 'Review due date is required';
  if (!approvalsComplete && !['Approved', 'Scheduled'].includes(status)) {
    return 'Cannot become Effective until approval is complete';
  }
  return null;
}
