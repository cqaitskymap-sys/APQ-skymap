import { z } from 'zod';

export const riskApprovalActionSchema = z.object({
  risk_assessment_id: z.string().trim().min(1, 'Risk assessment is required'),
  approval_id: z.string().trim().min(1, 'Approval step is required'),
  action: z.enum(['approve', 'reject', 'send_back']),
  comments: z.string().trim().optional().default(''),
  rejection_reason: z.string().trim().optional().default(''),
  send_back_reason: z.string().trim().optional().default(''),
  e_signature: z.string().trim().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.action === 'reject' && !data.rejection_reason.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Reject reason is mandatory', path: ['rejection_reason'] });
  }
  if (data.action === 'send_back' && !data.send_back_reason.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Send back reason is mandatory', path: ['send_back_reason'] });
  }
});

export type RiskApprovalActionInput = z.infer<typeof riskApprovalActionSchema>;
