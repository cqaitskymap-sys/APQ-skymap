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
});

export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;
export type ApprovalActionInput = z.infer<typeof approvalActionSchema>;
