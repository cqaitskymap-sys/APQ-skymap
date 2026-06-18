import { z } from 'zod';

export const capaClosureDraftSchema = z.object({
  corrective_actions_completed: z.boolean().default(false),
  preventive_actions_completed: z.boolean().default(false),
  implementation_verified: z.boolean().default(false),
  evidence_uploaded: z.boolean().default(false),
  effectiveness_check_completed: z.boolean().default(false),
  effectiveness_result: z.string().trim().min(1, 'Effectiveness result is required'),
  risk_reduced: z.boolean().default(false),
  root_cause_eliminated: z.boolean().default(false),
  recurrence_prevented: z.boolean().default(false),
  training_completed: z.boolean().default(false),
  sop_updated: z.boolean().default(false),
  change_control_completed: z.boolean().default(false),
  all_evidence_reviewed: z.boolean().default(false),
  qa_closure_comments: z.string().trim().optional().default(''),
  head_qa_comments: z.string().trim().optional().default(''),
  final_closure_conclusion: z.string().trim().optional().default(''),
});

export const capaClosureSubmitSchema = capaClosureDraftSchema.extend({
  qa_closure_comments: z.string().trim().min(10, 'QA closure comments are required'),
  final_closure_conclusion: z.string().trim().min(10, 'Final closure conclusion is required'),
});

export const capaClosureReopenSchema = z.object({
  reason: z.string().trim().min(5, 'Reopen reason is required'),
});

export type CapaClosureDraftInput = z.infer<typeof capaClosureDraftSchema>;
export type CapaClosureSubmitInput = z.infer<typeof capaClosureSubmitSchema>;
