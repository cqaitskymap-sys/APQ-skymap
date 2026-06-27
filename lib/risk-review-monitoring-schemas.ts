import { z } from 'zod';
import {
  EFFECTIVENESS_EVALUATIONS,
  REVIEW_TYPES,
} from '@/lib/risk-review-monitoring-records';

export const riskReviewDraftSchema = z.object({
  review_date: z.string().trim().min(1, 'Review date is required'),
  review_type: z.enum(REVIEW_TYPES).default('Quarterly'),
  reviewer: z.string().trim().min(1, 'Reviewer is required'),
  review_frequency: z.string().trim().min(1, 'Review frequency is required'),
  effectiveness_evaluation: z.enum(EFFECTIVENESS_EVALUATIONS, { required_error: 'Effectiveness evaluation is required' }),
  new_risks_identified: z.boolean().default(false),
  repeat_events_observed: z.boolean().default(false),
  risk_reduction_achieved: z.boolean().default(false),
  further_mitigation_required: z.boolean().default(false),
  review_conclusion: z.string().trim().optional().default(''),
  recommendation: z.string().trim().optional().default(''),
  next_review_date: z.string().trim().optional().default(''),
  qa_comments: z.string().trim().optional().default(''),
});

export const riskReviewSubmitSchema = riskReviewDraftSchema.extend({
  review_conclusion: z.string().trim().min(10, 'Review conclusion is required'),
  next_review_date: z.string().trim().min(1, 'Next review date is required'),
});

export type RiskReviewDraftInput = z.infer<typeof riskReviewDraftSchema>;
export type RiskReviewSubmitInput = z.infer<typeof riskReviewSubmitSchema>;
