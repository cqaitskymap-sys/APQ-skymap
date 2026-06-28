import { z } from 'zod';
import { APPROVAL_TYPES, APPROVAL_DECISIONS, APPROVAL_PRIORITIES } from './document-approval-types';

export const approvalCreateSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  version: z.string().min(1, 'Version is required'),
  workflow_id: z.string().min(1, 'Workflow is required'),
  approval_type: z.enum(APPROVAL_TYPES as unknown as [string, ...string[]]),
  approver_id: z.string().min(1, 'Approver is required'),
  approver_name: z.string().min(1, 'Approver name is required'),
  approver_role: z.string().default(''),
  department: z.string().min(1, 'Department is required'),
  due_date: z.string().min(1, 'Due date is required'),
  priority: z.enum(APPROVAL_PRIORITIES as unknown as [string, ...string[]]).default('Normal'),
});

export const approvalCompleteSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS as unknown as [string, ...string[]]),
  comments: z.string().default(''),
  esign_record_id: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.decision === 'Returned For Revision' && !data.comments?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Comments required when returning for revision', path: ['comments'] });
  }
});

export const approvalDelegateSchema = z.object({
  delegate_to_id: z.string().min(1, 'Delegate is required'),
  delegate_to_name: z.string().min(1, 'Delegate name is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export const approvalCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required'),
});

export type ApprovalCreateInput = z.infer<typeof approvalCreateSchema>;
export type ApprovalCompleteInput = z.infer<typeof approvalCompleteSchema>;
export type ApprovalDelegateInput = z.infer<typeof approvalDelegateSchema>;
