import { z } from 'zod';

export const capaApprovalActionSchema = z.object({
  capa_id: z.string().trim().min(1, 'CAPA is required'),
  approval_id: z.string().trim().min(1, 'Approval step is required'),
  action: z.enum(['approve', 'reject', 'send_back']),
  comments: z.string().trim().optional().default(''),
  rejection_reason: z.string().trim().optional().default(''),
  send_back_reason: z.string().trim().optional().default(''),
  e_signature: z.string().trim().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.action === 'reject' && !data.rejection_reason.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Rejection reason is mandatory', path: ['rejection_reason'] });
  }
  if (data.action === 'send_back' && !data.send_back_reason.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Send back reason is mandatory', path: ['send_back_reason'] });
  }
});

export const capaApprovalReopenSchema = z.object({
  capa_id: z.string().trim().min(1),
  reason: z.string().trim().min(5, 'Reopen reason is required'),
});

export type CapaApprovalActionInput = z.infer<typeof capaApprovalActionSchema>;
export type CapaApprovalReopenInput = z.infer<typeof capaApprovalReopenSchema>;
