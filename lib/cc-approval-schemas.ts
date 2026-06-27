import { z } from 'zod';

export const ccApprovalActionSchema = z.object({
  change_id: z.string().min(1, 'Change control is required'),
  approval_id: z.string().min(1, 'Approval action is required'),
  action: z.enum(['approve', 'reject', 'send_back', 'escalate']),
  comments: z.string().optional().default(''),
  rejection_reason: z.string().optional().default(''),
  send_back_reason: z.string().optional().default(''),
  e_signature: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.action === 'reject' && !data.rejection_reason.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Rejection reason is mandatory', path: ['rejection_reason'] });
  }
  if (data.action === 'send_back' && !data.send_back_reason.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Send back reason is mandatory', path: ['send_back_reason'] });
  }
});

export const ccApprovalRejectSchema = z.object({
  rejection_reason: z.string().trim().min(5, 'Rejection reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const ccApprovalSendBackSchema = z.object({
  send_back_reason: z.string().trim().min(5, 'Send back reason is mandatory'),
  comments: z.string().optional().default(''),
});

export const ccApprovalApproveSchema = z.object({
  comments: z.string().optional().default(''),
  e_signature: z.string().optional().default(''),
});

export type CcApprovalActionInput = z.infer<typeof ccApprovalActionSchema>;
