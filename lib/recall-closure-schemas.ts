import { z } from 'zod';

export const recallClosureDraftSchema = z.object({
  pending_quantity_justification: z.string().optional().default(''),
  customer_communication_completed: z.boolean().default(false),
  product_disposal_completed: z.boolean().default(false),
  qa_closure_comments: z.string().optional().default(''),
  head_qa_comments: z.string().optional().default(''),
  final_recall_conclusion: z.string().optional().default(''),
});

export const recallClosureFormSchema = recallClosureDraftSchema.superRefine((data, ctx) => {
  if (!data.qa_closure_comments?.trim() || data.qa_closure_comments.trim().length < 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'QA closure comments are required', path: ['qa_closure_comments'] });
  }
  if (!data.final_recall_conclusion?.trim() || data.final_recall_conclusion.trim().length < 10) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Final recall conclusion is required (min 10 characters)', path: ['final_recall_conclusion'] });
  }
});

export const recallClosureCloseSchema = recallClosureFormSchema.superRefine((data, ctx) => {
  // pending justification validated at service layer with recovery percent
});

export const recallReopenSchema = z.object({
  reopen_reason: z.string().min(10, 'Reopen reason is required (min 10 characters)'),
  e_signature: z.string().optional().default(''),
});

export type RecallClosureDraftInput = z.infer<typeof recallClosureDraftSchema>;
export type RecallClosureFormInput = z.infer<typeof recallClosureFormSchema>;
export type RecallReopenInput = z.infer<typeof recallReopenSchema>;
