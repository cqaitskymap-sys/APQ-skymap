import { z } from 'zod';
import {
  REVIEW_FREQUENCIES, REVIEW_TRIGGERS, PERIODIC_REVIEW_DECISIONS, REVIEW_PRIORITIES,
} from './periodic-review-types';

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  required: z.boolean(),
  checked: z.boolean(),
});

export const scheduleReviewSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  reviewer_id: z.string().min(1, 'Reviewer is required'),
  reviewer_name: z.string().min(1, 'Reviewer name is required'),
  qa_reviewer_id: z.string().optional().default(''),
  qa_reviewer_name: z.string().optional().default(''),
  review_frequency: z.enum(REVIEW_FREQUENCIES as unknown as [string, ...string[]]),
  review_trigger: z.enum(REVIEW_TRIGGERS as unknown as [string, ...string[]]).default('Scheduled'),
  due_date: z.string().min(1, 'Due date is required'),
  scheduled_date: z.string().optional().default(''),
  priority: z.enum(REVIEW_PRIORITIES as unknown as [string, ...string[]]).default('Normal'),
  review_comments: z.string().optional().default(''),
});

export const startReviewSchema = z.object({
  review_id: z.string().min(1),
});

export const completeReviewSchema = z.object({
  decision: z.enum(PERIODIC_REVIEW_DECISIONS as unknown as [string, ...string[]], {
    required_error: 'Decision is required before completion',
  }),
  outcome: z.string().min(1, 'Outcome summary is required'),
  review_comments: z.string().optional().default(''),
  review_checklist: z.array(checklistItemSchema).default([]),
  revision_required: z.boolean().default(false),
  change_control_required: z.boolean().default(false),
  risk_assessment_required: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  training_impact: z.boolean().default(false),
  electronic_signature_required: z.boolean().default(false),
  signature_meaning: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  const requiredUnchecked = data.review_checklist.filter((i) => i.required && !i.checked);
  if (requiredUnchecked.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Complete all required checklist items', path: ['review_checklist'] });
  }
  if (['Minor Revision', 'Major Revision'].includes(data.decision) && !data.revision_required) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Revision required for this decision', path: ['revision_required'] });
  }
  if (data.electronic_signature_required && !data.signature_meaning?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Signature meaning required', path: ['signature_meaning'] });
  }
});

export const bulkScheduleSchema = z.object({
  review_ids: z.array(z.string()).min(1),
  due_date: z.string().min(1, 'Due date is required'),
});

export type ScheduleReviewInput = z.infer<typeof scheduleReviewSchema>;
export type CompleteReviewInput = z.infer<typeof completeReviewSchema>;
export type BulkScheduleInput = z.infer<typeof bulkScheduleSchema>;
