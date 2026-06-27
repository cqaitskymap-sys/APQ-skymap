import { z } from 'zod';
import {
  RISK_CREATE_CATEGORIES,
  RISK_CREATE_SOURCES,
  REVIEW_FREQUENCIES,
} from '@/lib/risk-create-records';

const score = z.coerce.number().int().min(1, 'Score must be 1–10').max(10, 'Score must be 1–10');
const dateRequired = z.string().trim().min(1, 'Date is required');
const sourceEnum = z.enum(RISK_CREATE_SOURCES as unknown as [string, ...string[]]);
const categoryEnum = z.enum(RISK_CREATE_CATEGORIES as unknown as [string, ...string[]]);
const reviewFreqEnum = z.enum(REVIEW_FREQUENCIES as unknown as [string, ...string[]]);

export const riskCreateBaseSchema = z.object({
  risk_date: dateRequired,
  risk_title: z.string().trim().min(3, 'Risk title is required'),
  risk_source: sourceEnum.default('Manual'),
  source_reference_number: z.string().trim().optional().default(''),
  department: z.string().trim().min(1, 'Department is required'),
  product_name: z.string().trim().optional().default(''),
  product_code: z.string().trim().optional().default(''),
  batch_number: z.string().trim().optional().default(''),
  risk_category: categoryEnum.default('Process Risk'),
  process_area: z.string().trim().optional().default(''),
  risk_description: z.string().trim().min(10, 'Risk description is required'),
  potential_failure_mode: z.string().trim().optional().default(''),
  potential_impact: z.string().trim().min(5, 'Potential impact is required'),
  potential_cause: z.string().trim().min(5, 'Potential cause is required'),
  existing_controls: z.string().trim().optional().default(''),
  severity_score: score.default(5),
  occurrence_score: score.default(4),
  detection_score: score.default(5),
  risk_owner: z.string().trim().min(1, 'Risk owner is required'),
  risk_owner_name: z.string().trim().optional().default(''),
  mitigation_required: z.boolean().default(false),
  mitigation_plan: z.string().trim().optional().default(''),
  target_completion_date: z.string().trim().optional().default(''),
  review_frequency: reviewFreqEnum.default('Annual'),
  residual_severity: score.default(4),
  residual_occurrence: score.default(3),
  residual_detection: score.default(4),
  remarks: z.string().trim().optional().default(''),
});

function applyRiskCreateRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: z.infer<typeof riskCreateBaseSchema>, ctx) => {
    const rpn = data.severity_score * data.occurrence_score * data.detection_score;
    const needsMitigation = rpn >= 101;
    if (needsMitigation && !data.mitigation_plan.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Mitigation plan is required for High/Critical risk',
        path: ['mitigation_plan'],
      });
    }
    if (needsMitigation && !data.target_completion_date.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target completion date is required when mitigation is required',
        path: ['target_completion_date'],
      });
    }
    const needsRef = !['Manual', 'Other'].includes(data.risk_source);
    if (needsRef && !data.source_reference_number.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source reference number is required for selected source',
        path: ['source_reference_number'],
      });
    }
  });
}

export const riskCreateSchema = applyRiskCreateRefinements(riskCreateBaseSchema);

export const riskStep1Schema = riskCreateBaseSchema.pick({
  risk_date: true,
  risk_title: true,
  risk_source: true,
  source_reference_number: true,
  department: true,
});

export const riskStep2Schema = riskCreateBaseSchema.pick({
  product_name: true,
  product_code: true,
  batch_number: true,
  risk_category: true,
  process_area: true,
});

export const riskStep3Schema = riskCreateBaseSchema.pick({
  risk_description: true,
  potential_failure_mode: true,
  potential_impact: true,
  potential_cause: true,
  existing_controls: true,
  severity_score: true,
  occurrence_score: true,
  detection_score: true,
  risk_owner: true,
  risk_owner_name: true,
});

export const riskStep4Schema = riskCreateBaseSchema.pick({
  mitigation_plan: true,
  target_completion_date: true,
  review_frequency: true,
  residual_severity: true,
  residual_occurrence: true,
  residual_detection: true,
  remarks: true,
});

export type RiskCreateInput = z.infer<typeof riskCreateSchema>;

type StepValidationResult =
  | { success: true }
  | { success: false; issues: z.ZodIssue[] };

function mitigationIssues(values: Pick<RiskCreateInput, 'severity_score' | 'occurrence_score' | 'detection_score' | 'mitigation_plan' | 'target_completion_date'>): z.ZodIssue[] {
  const issues: z.ZodIssue[] = [];
  const rpn = values.severity_score * values.occurrence_score * values.detection_score;
  if (rpn >= 101 && !values.mitigation_plan.trim()) {
    issues.push({
      code: z.ZodIssueCode.custom,
      message: 'Mitigation plan is required for High/Critical risk',
      path: ['mitigation_plan'],
    });
  }
  if (rpn >= 101 && !values.target_completion_date.trim()) {
    issues.push({
      code: z.ZodIssueCode.custom,
      message: 'Target completion date is required when mitigation is required',
      path: ['target_completion_date'],
    });
  }
  return issues;
}

function sourceRefIssues(values: Pick<RiskCreateInput, 'risk_source' | 'source_reference_number'>): z.ZodIssue[] {
  const needsRef = !['Manual', 'Other'].includes(values.risk_source);
  if (needsRef && !values.source_reference_number.trim()) {
    return [{
      code: z.ZodIssueCode.custom,
      message: 'Source reference number is required for selected source',
      path: ['source_reference_number'],
    }];
  }
  return [];
}

/** Step-aware validation using full form values (wizard passes complete state each step). */
export function validateRiskCreateStep(step: number, values: RiskCreateInput): StepValidationResult {
  const schemas = [riskStep1Schema, riskStep2Schema, riskStep3Schema, riskStep4Schema, riskCreateSchema];
  const schema = schemas[step - 1];
  if (!schema) return { success: false, issues: [{ code: z.ZodIssueCode.custom, message: 'Invalid step', path: [] }] };

  const parsed = schema.safeParse(values);
  if (!parsed.success) return { success: false, issues: parsed.error.issues };

  if (step === 1) {
    const issues = sourceRefIssues(values);
    if (issues.length) return { success: false, issues };
  }
  if (step === 4) {
    const issues = mitigationIssues(values);
    if (issues.length) return { success: false, issues };
  }
  return { success: true };
}

export { RISK_CREATE_SOURCES, RISK_CREATE_CATEGORIES, REVIEW_FREQUENCIES };
