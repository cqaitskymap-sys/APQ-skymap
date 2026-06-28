import { z } from 'zod';
import { REVIEW_MODES, REVIEW_DECISIONS, REVIEW_PRIORITIES } from './document-review-types';

export const reviewCreateSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  version: z.string().min(1, 'Version is required'),
  workflow_id: z.string().min(1, 'Workflow is required'),
  review_mode: z.enum(REVIEW_MODES as unknown as [string, ...string[]]),
  reviewer_id: z.string().min(1, 'Reviewer is required'),
  reviewer_name: z.string().min(1, 'Reviewer name is required'),
  reviewer_role: z.string().default(''),
  department: z.string().min(1, 'Department is required'),
  due_date: z.string().min(1, 'Due date is required'),
  priority: z.enum(REVIEW_PRIORITIES as unknown as [string, ...string[]]).default('Normal'),
});

export const reviewCompleteSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS as unknown as [string, ...string[]]),
  comments: z.string().default(''),
  revision_summary: z.string().optional(),
  checklist: z.array(z.object({
    id: z.string(), label: z.string(), required: z.boolean(), checked: z.boolean(),
  })).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === 'Revision Required' && !data.revision_summary?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Revision summary required', path: ['revision_summary'] });
  }
});

export const reviewCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required'),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewCompleteInput = z.infer<typeof reviewCompleteSchema>;
