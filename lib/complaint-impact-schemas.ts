import { z } from 'zod';

const complaintImpactOption = z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]);
const complaintImpactYesNo = z.enum(['Yes', 'No'] as unknown as [string, ...string[]]);

const complaintImpactRefine = (
  data: {
    product_quality_impact: string;
    patient_safety_impact: string;
    regulatory_impact: string;
    market_impact: string;
    batch_impact: string;
    distribution_impact: string;
    other_batches_impacted: string;
    impacted_batch_numbers?: string;
    capa_required: boolean;
    recall_evaluation_required: boolean;
    recall_evaluation_reason?: string;
    scientific_justification?: string;
    conclusion?: string;
  },
  ctx: z.RefinementCtx,
  requireSubmit = false,
) => {
  const fields = [
    data.product_quality_impact, data.patient_safety_impact, data.regulatory_impact,
    data.market_impact, data.batch_impact, data.distribution_impact,
  ];
  if (!fields.some((f) => f && f !== 'Not Applicable') && data.other_batches_impacted !== 'Yes') {
    ctx.addIssue({ code: 'custom', message: 'At least one impact area must be assessed', path: ['product_quality_impact'] });
  }
  if (data.other_batches_impacted === 'Yes' && !data.impacted_batch_numbers?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Impacted batch numbers required when other batches are impacted', path: ['impacted_batch_numbers'] });
  }
  if (data.product_quality_impact === 'Yes' && !data.capa_required) {
    ctx.addIssue({ code: 'custom', message: 'CAPA required when product quality impact is Yes', path: ['capa_required'] });
  }
  if (data.market_impact === 'Yes' && requireSubmit && !data.recall_evaluation_reason?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Recall evaluation reason required when market impact is Yes', path: ['recall_evaluation_reason'] });
  }
  if (requireSubmit && (!data.scientific_justification?.trim() || (data.scientific_justification?.trim().length || 0) < 10)) {
    ctx.addIssue({ code: 'custom', message: 'Scientific justification is required', path: ['scientific_justification'] });
  }
  if (requireSubmit && (!data.conclusion?.trim() || (data.conclusion?.trim().length || 0) < 10)) {
    ctx.addIssue({ code: 'custom', message: 'Impact conclusion is required', path: ['conclusion'] });
  }
};

export const complaintImpactObjectSchema = z.object({
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessed_by_name: z.string().min(1, 'Assessed by is required'),
  product_quality_impact: complaintImpactOption,
  patient_safety_impact: complaintImpactOption,
  regulatory_impact: complaintImpactOption,
  market_impact: complaintImpactOption.default('Not Applicable'),
  batch_impact: complaintImpactOption.default('No'),
  distribution_impact: complaintImpactOption.default('Not Applicable'),
  distribution_notes: z.string().optional().default(''),
  other_batches_impacted: complaintImpactYesNo.default('No'),
  impacted_batch_numbers: z.string().optional().default(''),
  impact_description: z.string().optional().default(''),
  scientific_justification: z.string().optional().default(''),
  severity: z.coerce.number().min(1).max(10).default(3),
  occurrence: z.coerce.number().min(1).max(10).default(3),
  detection: z.coerce.number().min(1).max(10).default(3),
  capa_required: z.boolean().default(false),
  recall_evaluation_required: z.boolean().default(false),
  recall_evaluation_reason: z.string().optional().default(''),
  conclusion: z.string().optional().default(''),
  qa_comments: z.string().optional().default(''),
});

export const complaintImpactSchema = complaintImpactObjectSchema.superRefine((data, ctx) => {
  complaintImpactRefine(data, ctx, false);
});

export const complaintImpactSubmitSchema = complaintImpactObjectSchema.superRefine((data, ctx) => {
  complaintImpactRefine(data, ctx, true);
});

export const complaintImpactQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().min(5, 'QA comments required'),
});

export type ComplaintImpactInput = z.infer<typeof complaintImpactObjectSchema>;
export type ComplaintImpactSubmitInput = z.infer<typeof complaintImpactSubmitSchema>;
export type ComplaintImpactQaReviewInput = z.infer<typeof complaintImpactQaReviewSchema>;
