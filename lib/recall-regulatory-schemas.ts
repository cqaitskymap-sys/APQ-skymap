import { z } from 'zod';
import {
  RECALL_REGULATORY_APPROVAL_STATUSES,
  RECALL_REGULATORY_NOTIFICATION_STATUSES,
} from '@/lib/recall-types';

export const recallRegulatoryDetailsSchema = z.object({
  regulatory_authority: z.string().optional().default(''),
  notification_required: z.boolean().default(false),
  notification_due_date: z.string().optional().nullable(),
  market_region: z.string().optional().default(''),
  qa_comments: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.notification_required) {
    if (!data.regulatory_authority?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Regulatory authority is required', path: ['regulatory_authority'] });
    }
    if (!data.notification_due_date?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Notification due date is required', path: ['notification_due_date'] });
    }
  }
});

export const recallRegulatorySubmissionSchema = z.object({
  notification_date: z.string().min(1, 'Notification date is required'),
  submission_reference_number: z.string().min(1, 'Submission reference number is required'),
  submission_document: z.string().optional().default(''),
  regulatory_comments: z.string().optional().default(''),
});

export const recallRegulatoryResponseSchema = z.object({
  authority_response: z.string().min(5, 'Authority response is required'),
  response_date: z.string().min(1, 'Response date is required'),
  notification_status: z.enum(RECALL_REGULATORY_NOTIFICATION_STATUSES as unknown as [string, ...string[]]).optional(),
});

export const recallRegulatoryFollowUpSchema = z.object({
  follow_up_required: z.boolean().default(false),
  follow_up_due_date: z.string().optional().nullable(),
  regulatory_comments: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.follow_up_required && !data.follow_up_due_date?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Follow up due date is required', path: ['follow_up_due_date'] });
  }
});

export const recallRegulatoryApprovalSchema = z.object({
  qa_comments: z.string().min(5, 'QA comments are required for approval'),
  head_qa_comments: z.string().optional().default(''),
  decision: z.enum(['approved', 'rejected']).default('approved'),
  e_signature: z.string().optional().default(''),
});

export type RecallRegulatoryDetailsInput = z.infer<typeof recallRegulatoryDetailsSchema>;
export type RecallRegulatorySubmissionInput = z.infer<typeof recallRegulatorySubmissionSchema>;
export type RecallRegulatoryResponseInput = z.infer<typeof recallRegulatoryResponseSchema>;
export type RecallRegulatoryFollowUpInput = z.infer<typeof recallRegulatoryFollowUpSchema>;
export type RecallRegulatoryApprovalInput = z.infer<typeof recallRegulatoryApprovalSchema>;

export { RECALL_REGULATORY_NOTIFICATION_STATUSES, RECALL_REGULATORY_APPROVAL_STATUSES };
