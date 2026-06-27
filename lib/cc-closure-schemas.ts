import { z } from 'zod';

export const ccClosureDraftSchema = z.object({
  impact_assessment_completed: z.boolean().default(false),
  risk_assessment_completed: z.boolean().default(false),
  validation_assessment_completed: z.boolean().default(false),
  implementation_completed: z.boolean().default(false),
  training_completed: z.boolean().default(false),
  document_revision_completed: z.boolean().default(false),
  validation_completed: z.boolean().default(false),
  csv_completed: z.boolean().default(false),
  regulatory_action_completed: z.boolean().default(false),
  effectiveness_review_completed: z.boolean().default(false),
  effectiveness_result: z.string().trim().min(1, 'Effectiveness result is required'),
  capa_required: z.boolean().default(false),
  capa_linked: z.boolean().default(false),
  capa_completed: z.boolean().default(false),
  all_evidence_reviewed: z.boolean().default(false),
  qa_closure_comments: z.string().trim().optional().default(''),
  head_qa_comments: z.string().trim().optional().default(''),
  final_closure_conclusion: z.string().trim().optional().default(''),
});

export const ccClosureSubmitSchema = ccClosureDraftSchema.extend({
  qa_closure_comments: z.string().trim().min(10, 'QA closure comments are required'),
  final_closure_conclusion: z.string().trim().min(10, 'Final closure conclusion is required'),
});

export const ccClosureReopenSchema = z.object({
  reason: z.string().trim().min(5, 'Reopen reason is required'),
});

export type CcClosureDraftInput = z.infer<typeof ccClosureDraftSchema>;
export type CcClosureSubmitInput = z.infer<typeof ccClosureSubmitSchema>;
