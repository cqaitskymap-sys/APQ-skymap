import { z } from 'zod';
import { CC_DEPARTMENTS, CC_RISK_CATEGORIES } from '@/lib/change-control-types';
import { computeCcRiskScores, isMitigationRequired } from '@/lib/cc-risk-records';

const score = z.coerce.number().int().min(1, 'Min 1').max(10, 'Max 10');

export const ccRiskHeaderSchema = z.object({
  change_id: z.string().min(1, 'Change control is required'),
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessed_by: z.string().min(1, 'Assessor is required'),
  assessed_by_name: z.string().optional(),
  department: z.enum(CC_DEPARTMENTS as unknown as [string, ...string[]]),
});

export const ccRiskRowSchema = z.object({
  change_id: z.string().min(1),
  assessment_id: z.string().optional(),
  risk_description: z.string().min(3, 'Risk description is required'),
  risk_category: z.enum(CC_RISK_CATEGORIES as unknown as [string, ...string[]]),
  potential_failure_mode: z.string().optional().default(''),
  potential_impact: z.string().optional().default(''),
  potential_cause: z.string().optional().default(''),
  existing_controls: z.string().optional().default(''),
  severity: score,
  occurrence: score,
  detection: score,
  mitigation_plan: z.string().optional().default(''),
  residual_severity: score.nullable().optional(),
  residual_occurrence: score.nullable().optional(),
  residual_detection: score.nullable().optional(),
  capa_required: z.boolean().optional().default(false),
  validation_required: z.boolean().optional().default(false),
  linked_capa_id: z.string().nullable().optional(),
  linked_capa_number: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  const { risk_level } = computeCcRiskScores(data.severity, data.occurrence, data.detection);
  if (isMitigationRequired(risk_level) && !data.mitigation_plan?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Mitigation plan required for High/Critical risk', path: ['mitigation_plan'] });
  }
  if (data.mitigation_plan?.trim()) {
    if (!data.residual_severity || !data.residual_occurrence || !data.residual_detection) {
      ctx.addIssue({ code: 'custom', message: 'Residual scores required after mitigation', path: ['residual_severity'] });
    }
  }
});

export const ccRiskQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().min(1, 'QA comments are required'),
  head_qa_comments: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.decision === 'rejected' && !data.qa_comments.trim()) {
    ctx.addIssue({ code: 'custom', message: 'QA comments required for rejection', path: ['qa_comments'] });
  }
});

export type CcRiskHeaderInput = z.infer<typeof ccRiskHeaderSchema>;
export type CcRiskRowFormInput = z.infer<typeof ccRiskRowSchema>;
export type CcRiskQaReviewFormInput = z.infer<typeof ccRiskQaReviewSchema>;
