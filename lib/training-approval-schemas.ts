import { z } from 'zod';
import { WORKFLOW_TYPES, PRIORITIES } from './training-approval-types';

export const createApprovalRequestSchema = z.object({
  workflow_type: z.enum(WORKFLOW_TYPES as unknown as [string, ...string[]]),
  reference_id: z.string().min(1, 'Reference record is required'),
  reference_number: z.string().min(1),
  department: z.string().min(1),
  priority: z.enum(PRIORITIES as unknown as [string, ...string[]]).default('Normal'),
  approval_comments: z.string().default(''),
  assigned_approver: z.string().optional(),
});

export const approvalActionSchema = z.object({
  request_id: z.string().min(1),
  action: z.enum(['Approve', 'Reject', 'Return for Revision', 'Delegate', 'Escalate', 'Cancel', 'Close']),
  comments: z.string().default(''),
  rejection_reason: z.string().optional(),
  delegate_to: z.string().optional(),
  e_signature_id: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.action === 'Reject' && !(data.rejection_reason || data.comments).trim()) {
    ctx.addIssue({ code: 'custom', message: 'Rejection reason is required', path: ['rejection_reason'] });
  }
  if (data.action === 'Return for Revision' && !data.comments.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Revision comments are required', path: ['comments'] });
  }
  if (data.action === 'Delegate' && !data.delegate_to?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Delegate is required', path: ['delegate_to'] });
  }
});

export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
