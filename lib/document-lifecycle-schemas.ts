import { z } from 'zod';
import { LIFECYCLE_STAGES } from './document-lifecycle-types';

export const lifecycleTransitionSchema = z.object({
  document_id: z.string().min(1),
  to_stage: z.enum(LIFECYCLE_STAGES as unknown as [string, ...string[]]),
  comments: z.string().optional(),
  effective_date: z.string().optional(),
  review_due_date: z.string().optional(),
});

export const lifecycleCreateSchema = z.object({
  document_number: z.string().min(1, 'Document number is required'),
  document_title: z.string().min(1, 'Title is required'),
  document_type: z.string().min(1),
  department: z.string().min(1),
  owner_name: z.string().min(1, 'Owner is required'),
  current_stage: z.enum(LIFECYCLE_STAGES as unknown as [string, ...string[]]).default('Draft'),
  version: z.string().default('1.0'),
  effective_date: z.string().nullable().optional(),
  review_due_date: z.string().nullable().optional(),
  training_required: z.boolean().default(false),
  linked_change_control: z.string().nullable().optional(),
});

export const lifecycleUpdateSchema = lifecycleCreateSchema.partial().extend({
  retention_period: z.string().nullable().optional(),
  linked_capa: z.string().nullable().optional(),
  linked_deviation: z.string().nullable().optional(),
  linked_risk_assessment: z.string().nullable().optional(),
});

export const lifecycleFilterSchema = z.object({
  stage: z.string().optional(),
  department: z.string().optional(),
  document_type: z.string().optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
  review_due: z.boolean().optional(),
  overdue: z.boolean().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export const bulkLifecycleActionSchema = z.object({
  document_ids: z.array(z.string()).min(1),
  action: z.enum(['archive', 'retire', 'schedule_review']),
  reason: z.string().min(1),
});

export type LifecycleTransitionInput = z.infer<typeof lifecycleTransitionSchema>;
export type LifecycleCreateInput = z.infer<typeof lifecycleCreateSchema>;
export type LifecycleUpdateInput = z.infer<typeof lifecycleUpdateSchema>;
export type LifecycleFilterInput = z.infer<typeof lifecycleFilterSchema>;
export type BulkLifecycleActionInput = z.infer<typeof bulkLifecycleActionSchema>;

export function validateEffectiveTransition(
  toStage: string,
  effectiveDate: string | null | undefined,
  currentWorkflowStatus: string,
): string | null {
  if (toStage === 'Effective' && !effectiveDate) {
    return 'Effective date is mandatory before Effective status';
  }
  if (toStage === 'Effective' && !['approved', 'Scheduled'].includes(currentWorkflowStatus)) {
    return 'Only approved documents can become Effective';
  }
  return null;
}
