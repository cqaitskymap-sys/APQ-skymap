import { z } from 'zod';
import { MITIGATION_STATUSES, MITIGATION_TYPES } from '@/lib/risk-mitigation-records';

export const riskMitigationDraftSchema = z.object({
  mitigation_title: z.string().trim().min(1, 'Mitigation title is required'),
  mitigation_description: z.string().trim().min(1, 'Mitigation description is required'),
  mitigation_type: z.enum(MITIGATION_TYPES),
  action_owner: z.string().trim().min(1, 'Action owner is required'),
  department: z.string().trim().optional().default(''),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  target_completion_date: z.string().trim().min(1, 'Target completion date is required'),
  mitigation_status: z.enum(MITIGATION_STATUSES).default('Draft'),
  effectiveness_required: z.boolean().default(true),
  effectiveness_review_date: z.string().trim().optional().default(''),
  residual_severity: z.coerce.number().int().min(1).max(10),
  residual_occurrence: z.coerce.number().int().min(1).max(10),
  residual_detection: z.coerce.number().int().min(1).max(10),
  capa_required: z.boolean().default(false),
  capa_number: z.string().trim().optional().default(''),
  change_control_required: z.boolean().default(false),
  change_control_number: z.string().trim().optional().default(''),
  training_required: z.boolean().default(false),
  training_reference: z.string().trim().optional().default(''),
  validation_required: z.boolean().default(false),
  validation_reference: z.string().trim().optional().default(''),
  remarks: z.string().trim().optional().default(''),
});

export const riskMitigationSubmitSchema = riskMitigationDraftSchema.superRefine((data, ctx) => {
  if (data.capa_required && !data.capa_number.trim()) {
    ctx.addIssue({ code: 'custom', path: ['capa_number'], message: 'CAPA reference is required if CAPA required' });
  }
  if (data.change_control_required && !data.change_control_number.trim()) {
    ctx.addIssue({ code: 'custom', path: ['change_control_number'], message: 'Change control reference is required' });
  }
  if (data.training_required && !data.training_reference.trim()) {
    ctx.addIssue({ code: 'custom', path: ['training_reference'], message: 'Training reference is required' });
  }
  if (data.validation_required && !data.validation_reference.trim()) {
    ctx.addIssue({ code: 'custom', path: ['validation_reference'], message: 'Validation reference is required' });
  }
});

export type RiskMitigationDraftInput = z.infer<typeof riskMitigationDraftSchema>;
export type RiskMitigationSubmitInput = z.infer<typeof riskMitigationSubmitSchema>;
