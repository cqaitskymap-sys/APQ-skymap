import { z } from 'zod';
import { FORM_TYPES, FORM_CATEGORIES } from './forms-templates-types';

export const formCreateSchema = z.object({
  form_title: z.string().min(1, 'Title is required'),
  short_title: z.string().optional(),
  form_type: z.enum(FORM_TYPES as unknown as [string, ...string[]]).default('Form'),
  category: z.enum(FORM_CATEGORIES as unknown as [string, ...string[]]).default('Production'),
  department: z.string().min(1, 'Department is required'),
  owner_name: z.string().min(1, 'Owner is required'),
  approver_name: z.string().min(1, 'Approver is required'),
  author_name: z.string().optional(),
  business_unit: z.string().optional(),
  site: z.string().optional(),
  related_sop: z.string().optional(),
  related_sop_id: z.string().nullable().optional(),
  related_wi: z.string().optional(),
  related_wi_id: z.string().nullable().optional(),
  version: z.string().default('1.0'),
  effective_date: z.string().min(1, 'Effective date is required'),
  review_due_date: z.string().min(1, 'Review due date is required'),
  training_required: z.boolean().default(false),
  electronic_signature_required: z.boolean().default(true),
  linked_change_control: z.string().nullable().optional(),
  keywords: z.array(z.string()).default([]),
  confidentiality: z.string().default('Internal'),
  language: z.string().default('English'),
});

export type FormCreateInput = z.infer<typeof formCreateSchema>;

export function validateFormEffective(
  effectiveDate: string | null | undefined,
  reviewDueDate: string | null | undefined,
  status: string,
): string | null {
  if (!effectiveDate) return 'Effective date is required';
  if (!reviewDueDate) return 'Review due date is required';
  if (!['Approved', 'Scheduled'].includes(status)) {
    return 'Effective status only after approvals';
  }
  return null;
}
