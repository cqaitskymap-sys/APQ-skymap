import { z } from 'zod';
import { CC_EFFECTIVENESS_RESULTS } from '@/lib/change-control-types';

export const ccEffectivenessReviewSchema = z.object({
  change_id: z.string().min(1, 'Change Control ID is required'),
  review_date: z.string().min(1, 'Review date is required'),
  review_owner: z.string().min(1, 'Review owner is required'),
  review_owner_name: z.string().optional().default(''),
  department: z.string().min(1, 'Department is required'),
  review_period_start: z.string().min(1, 'Review period start is required'),
  review_period_end: z.string().min(1, 'Review period end is required'),
  change_objective_achieved: z.boolean().default(false),
  implementation_successful: z.boolean().default(false),
  validation_successful: z.boolean().default(false),
  csv_requirements_met: z.boolean().default(false),
  training_completed: z.boolean().default(false),
  no_adverse_quality_impact: z.boolean().default(false),
  no_regulatory_impact: z.boolean().default(false),
  no_data_integrity_impact: z.boolean().default(true),
  no_patient_safety_impact: z.boolean().default(false),
  performance_improved: z.boolean().default(false),
  process_improved: z.boolean().default(false),
  risk_reduced: z.boolean().default(false),
  deviation_generated: z.boolean().default(false),
  oos_generated: z.boolean().default(false),
  complaint_generated: z.boolean().default(false),
  capa_generated: z.boolean().default(false),
  review_findings: z.string().trim().min(10, 'Review findings are required'),
  recommendations: z.string().optional().default(''),
  additional_actions_required: z.boolean().default(false),
  qa_comments: z.string().optional().default(''),
  head_qa_comments: z.string().optional().default(''),
  effectiveness_criteria: z.string().optional().default(''),
  conclusion: z.string().optional().default(''),
}).refine((d) => {
  const from = new Date(d.review_period_start);
  const to = new Date(d.review_period_end);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from;
}, { message: 'Review period end must be after start', path: ['review_period_end'] });

export const ccEffectivenessSubmitSchema = z.object({
  change_id: z.string().min(1),
  review_date: z.string().min(1),
  review_owner: z.string().min(1),
  department: z.string().min(1),
  review_period_start: z.string().min(1),
  review_period_end: z.string().min(1),
  review_findings: z.string().trim().min(10),
  qa_comments: z.string().trim().min(10, 'QA comments are required'),
  effectiveness_result: z.enum(CC_EFFECTIVENESS_RESULTS as unknown as [string, ...string[]], {
    required_error: 'Effectiveness result is required',
  }),
});

export const ccEffectivenessQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().trim().min(10, 'QA comments are required'),
  head_qa_comments: z.string().optional().default(''),
});

export type CcEffectivenessReviewInput = z.infer<typeof ccEffectivenessReviewSchema>;
export type CcEffectivenessSubmitInput = z.infer<typeof ccEffectivenessSubmitSchema>;
