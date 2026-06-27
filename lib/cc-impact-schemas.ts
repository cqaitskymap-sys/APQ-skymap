import { z } from 'zod';
import {
  CC_DEPARTMENTS,
  CC_IMPACT_LIKELIHOODS,
  CC_IMPACT_OPTIONS,
  CC_IMPACT_RATINGS,
  CC_IMPACT_SEVERITIES,
} from '@/lib/change-control-types';

const impactOption = z.enum(CC_IMPACT_OPTIONS as unknown as [string, ...string[]]);

export const ccImpactFormSchema = z.object({
  change_id: z.string().min(1, 'Change control is required'),
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessed_by: z.string().min(1, 'Assessed by is required'),
  assessed_by_name: z.string().optional(),
  department: z.enum(CC_DEPARTMENTS as unknown as [string, ...string[]]),
  product_impact: impactOption,
  process_impact: impactOption,
  equipment_impact: impactOption,
  utility_impact: impactOption,
  facility_impact: impactOption,
  document_impact: impactOption,
  training_impact: impactOption,
  validation_impact: impactOption,
  csv_impact: impactOption,
  regulatory_impact: impactOption,
  quality_impact: impactOption,
  patient_safety_impact: impactOption,
  stability_impact: impactOption,
  market_impact: impactOption,
  business_impact: impactOption,
  supplier_impact: impactOption,
  environmental_impact: impactOption,
  data_integrity_impact: impactOption,
  impact_description: z.string().min(10, 'Impact description is required'),
  scientific_justification: z.string().min(10, 'Scientific justification is required'),
  recommended_actions: z.string().optional().default(''),
  impact_severity: z.enum(CC_IMPACT_SEVERITIES as unknown as [string, ...string[]]),
  impact_likelihood: z.enum(CC_IMPACT_LIKELIHOODS as unknown as [string, ...string[]]),
  overall_impact_rating: z.enum(CC_IMPACT_RATINGS as unknown as [string, ...string[]]),
  qa_comments: z.string().optional().default(''),
});

export const ccImpactQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().min(1, 'QA comments are required'),
  head_qa_comments: z.string().optional(),
});

export type CcImpactFormInput = z.infer<typeof ccImpactFormSchema>;
export type CcImpactQaReviewFormInput = z.infer<typeof ccImpactQaReviewSchema>;
