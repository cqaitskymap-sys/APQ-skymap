import { z } from 'zod';
import { FINAL_RISK_EVALUATIONS } from '@/lib/risk-closure-records';

export const riskClosureDraftSchema = z.object({
  risk_assessment_approved: z.boolean().default(false),
  fmea_completed: z.boolean().default(false),
  mitigation_actions_completed: z.boolean().default(false),
  residual_risk_evaluated: z.boolean().default(false),
  risk_review_completed: z.boolean().default(false),
  effectiveness_verified: z.boolean().default(false),
  capa_completed: z.boolean().default(false),
  change_control_completed: z.boolean().default(false),
  training_completed: z.boolean().default(false),
  validation_completed: z.boolean().default(false),
  final_approval_completed: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  change_control_required: z.boolean().default(false),
  training_required: z.boolean().default(false),
  validation_required: z.boolean().default(false),
  closure_justification: z.string().trim().optional().default(''),
  final_risk_evaluation: z.enum(FINAL_RISK_EVALUATIONS).default('Acceptable'),
  qa_closure_comments: z.string().trim().optional().default(''),
  head_qa_comments: z.string().trim().optional().default(''),
});

export const riskClosureSubmitSchema = riskClosureDraftSchema.extend({
  closure_justification: z.string().trim().min(10, 'Closure justification is required'),
  final_risk_evaluation: z.enum(FINAL_RISK_EVALUATIONS, { required_error: 'Final risk evaluation is required' }),
  qa_closure_comments: z.string().trim().min(10, 'QA closure comments are required'),
});

export const riskClosureReopenSchema = z.object({
  reason: z.string().trim().min(5, 'Reopen reason is required'),
});

export type RiskClosureDraftInput = z.infer<typeof riskClosureDraftSchema>;
export type RiskClosureSubmitInput = z.infer<typeof riskClosureSubmitSchema>;
