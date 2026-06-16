import { z } from 'zod';
import {
  BATCH_IMPACT_OPTIONS,
  DEVIATION_CATEGORIES,
  DEVIATION_PLANNED_TYPES,
  DEVIATION_CRITICALITIES,
  RCA_METHODS,
  DEPARTMENTS,
  TRI_STATE_IMPACT_OPTIONS,
  YES_NO_OPTIONS,
} from './deviation-types';

const impactRefine = (data: {
  deviation_date: string;
  target_closure_date?: string | null;
  investigation_required?: boolean;
  assigned_investigator_name?: string;
  product_quality_impact?: string;
  capa_required?: boolean;
}, ctx: z.RefinementCtx) => {
  if (data.target_closure_date && data.target_closure_date <= data.deviation_date) {
    ctx.addIssue({ code: 'custom', message: 'Target closure date must be after deviation date', path: ['target_closure_date'] });
  }
  if (data.investigation_required && !data.assigned_investigator_name?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Assigned investigator is required when investigation is required', path: ['assigned_investigator_name'] });
  }
  if (data.product_quality_impact === 'Yes' && data.capa_required === false) {
    ctx.addIssue({ code: 'custom', message: 'CAPA cannot be No when product quality impact is Yes', path: ['capa_required'] });
  }
};

export const deviationCreateBaseSchema = z.object({
  deviation_date: z.string().min(1, 'Deviation date is required'),
  deviation_time: z.string().optional().default(''),
  department: z.string().min(1, 'Department is required'),
  area: z.string().min(1, 'Area / location is required'),
  reported_by_name: z.string().min(1, 'Reported by is required'),
  detected_by_name: z.string().min(1, 'Detected by is required'),
  product_name: z.string().min(1, 'Product name is required'),
  product_code: z.string().optional().default(''),
  product_id: z.string().optional().nullable(),
  batch_number: z.string().optional().default(''),
  market: z.string().optional().default(''),
  manufacturing_date: z.string().optional().default(''),
  expiry_date: z.string().optional().default(''),
  planned_type: z.enum(DEVIATION_PLANNED_TYPES as unknown as [string, ...string[]]),
  category: z.enum(DEVIATION_CATEGORIES as unknown as [string, ...string[]]),
  criticality: z.enum(DEVIATION_CRITICALITIES as unknown as [string, ...string[]]),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  immediate_action: z.string().min(5, 'Immediate action is required'),
  batch_impact: z.enum(BATCH_IMPACT_OPTIONS as unknown as [string, ...string[]]).default('No'),
  product_quality_impact: z.enum(TRI_STATE_IMPACT_OPTIONS as unknown as [string, ...string[]]).default('No'),
  patient_safety_impact: z.enum(TRI_STATE_IMPACT_OPTIONS as unknown as [string, ...string[]]).default('No'),
  regulatory_impact_status: z.enum(TRI_STATE_IMPACT_OPTIONS as unknown as [string, ...string[]]).default('No'),
  repeat_deviation: z.enum(YES_NO_OPTIONS as unknown as [string, ...string[]]).default('No'),
  previous_deviation_reference: z.string().optional().default(''),
  investigation_required: z.boolean().default(true),
  capa_required: z.boolean().default(false),
  assigned_investigator_name: z.string().optional().default(''),
  qa_reviewer_name: z.string().optional().default(''),
  target_closure_date: z.string().min(1, 'Target closure date is required'),
  qa_remarks: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
  head_qa_approval_required: z.boolean().optional().default(false),
  source: z.string().optional(),
  source_reference: z.string().optional().nullable(),
  cpv_record_id: z.string().optional().nullable(),
});

export const deviationCreateSchema = deviationCreateBaseSchema.superRefine(impactRefine);

export const deviationStep1Schema = deviationCreateBaseSchema.pick({
  deviation_date: true, deviation_time: true, department: true, area: true,
  reported_by_name: true, detected_by_name: true,
});

export const deviationStep2Schema = deviationCreateBaseSchema.pick({
  product_name: true, product_code: true, batch_number: true, market: true,
  manufacturing_date: true, expiry_date: true,
});

export const deviationStep3Schema = deviationCreateBaseSchema.pick({
  planned_type: true, category: true, criticality: true, title: true,
  description: true, immediate_action: true,
});

export const deviationStep4Schema = deviationCreateBaseSchema.pick({
  batch_impact: true, product_quality_impact: true, patient_safety_impact: true,
  regulatory_impact_status: true, repeat_deviation: true, previous_deviation_reference: true,
});

export const deviationStep5Schema = deviationCreateBaseSchema.pick({
  investigation_required: true, capa_required: true, assigned_investigator_name: true,
  qa_reviewer_name: true, target_closure_date: true, deviation_date: true,
  product_quality_impact: true,
}).superRefine(impactRefine);

export const deviationUpdateSchema = deviationCreateBaseSchema.partial();

export const investigationSchema = z.object({
  investigation_summary: z.string().min(10, 'Investigation summary required'),
  detailed_investigation: z.string().optional().default(''),
  rca_method: z.enum(RCA_METHODS as unknown as [string, ...string[]]),
  root_cause_details: z.string().min(10, 'Root cause details required'),
  root_cause: z.string().optional().default(''),
  contributing_factors: z.string().optional().default(''),
  immediate_correction: z.string().optional().default(''),
  corrective_action_required: z.boolean().optional().default(false),
  preventive_action_required: z.boolean().optional().default(false),
  capa_required: z.boolean().optional().default(false),
  impact_on_batch: z.enum(['Yes', 'No', 'Not Applicable', 'Under Evaluation'] as unknown as [string, ...string[]]).optional().default('No'),
  impact_on_product_quality: z.enum(['Yes', 'No', 'Under Evaluation'] as unknown as [string, ...string[]]).optional().default('No'),
  impact_on_patient_safety: z.enum(['Yes', 'No', 'Under Evaluation'] as unknown as [string, ...string[]]).optional().default('No'),
  impact_on_regulatory_compliance: z.enum(['Yes', 'No', 'Under Evaluation'] as unknown as [string, ...string[]]).optional().default('No'),
  other_batches_impacted: z.enum(['Yes', 'No'] as unknown as [string, ...string[]]).optional().default('No'),
  other_batches_details: z.string().optional().default(''),
  final_investigation_conclusion: z.string().optional().default(''),
  investigation_due_date: z.string().optional().default(''),
  five_why: z.object({
    why1: z.string().optional(), why2: z.string().optional(), why3: z.string().optional(),
    why4: z.string().optional(), why5: z.string().optional(), rootCause: z.string().optional(),
  }).optional(),
});

export const investigationSubmitSchema = investigationSchema.extend({
  final_investigation_conclusion: z.string().min(10, 'Final conclusion required before completion'),
  root_cause_details: z.string().min(10, 'Root cause required before completion'),
});

export const investigationQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().min(1, 'QA comments required'),
}).superRefine((data, ctx) => {
  if (data.decision === 'rejected' && data.qa_comments.trim().length < 5) {
    ctx.addIssue({ code: 'custom', message: 'Rejection requires detailed QA comments', path: ['qa_comments'] });
  }
});

const impactAssessmentRefine = (data: {
  batch_impact: string;
  product_quality_impact: string;
  patient_safety_impact: string;
  regulatory_impact: string;
  stability_impact: string;
  validation_impact: string;
  equipment_impact: string;
  utility_impact: string;
  material_impact: string;
  packaging_impact: string;
  cleaning_impact: string;
  documentation_impact: string;
  training_impact: string;
  market_impact: string;
  other_batches_impacted: string;
  impacted_batch_numbers?: string;
  capa_required: boolean;
  conclusion?: string;
}, ctx: z.RefinementCtx, requireConclusion = false) => {
  const fields = [
    data.batch_impact, data.product_quality_impact, data.patient_safety_impact, data.regulatory_impact,
    data.stability_impact, data.validation_impact, data.equipment_impact, data.utility_impact,
    data.material_impact, data.packaging_impact, data.cleaning_impact, data.documentation_impact,
    data.training_impact, data.market_impact,
  ];
  if (!fields.some((f) => f && f !== 'Not Applicable') && data.other_batches_impacted !== 'Yes') {
    ctx.addIssue({ code: 'custom', message: 'At least one impact field must be assessed', path: ['batch_impact'] });
  }
  if (data.other_batches_impacted === 'Yes' && !data.impacted_batch_numbers?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Impacted batch numbers required', path: ['impacted_batch_numbers'] });
  }
  if (data.product_quality_impact === 'Yes' && !data.capa_required) {
    ctx.addIssue({ code: 'custom', message: 'CAPA required when product quality impact is Yes', path: ['capa_required'] });
  }
  if (requireConclusion && !data.conclusion?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Conclusion required before submit', path: ['conclusion'] });
  } else if (requireConclusion && (data.conclusion?.trim().length || 0) < 10) {
    ctx.addIssue({ code: 'custom', message: 'Conclusion required before submit', path: ['conclusion'] });
  }
};

const impactAssessmentBaseSchema = z.object({
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessed_by_name: z.string().min(1, 'Assessed by is required'),
  department: z.string().optional().default(''),
  batch_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]),
  product_quality_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]),
  patient_safety_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]),
  regulatory_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]),
  stability_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  validation_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  equipment_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  utility_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  material_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  packaging_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  cleaning_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  documentation_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  training_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  market_impact: z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]).default('Not Applicable'),
  other_batches_impacted: z.enum(['Yes', 'No'] as unknown as [string, ...string[]]).default('No'),
  impacted_batch_numbers: z.string().optional().default(''),
  impact_description: z.string().optional().default(''),
  impact_summary: z.string().min(10, 'Impact summary required'),
  batch_impact_details: z.string().optional().default(''),
  product_quality_impact_details: z.string().optional().default(''),
  patient_safety_impact_details: z.string().optional().default(''),
  regulatory_impact_details: z.string().optional().default(''),
  severity: z.coerce.number().min(1).max(10).default(3),
  occurrence: z.coerce.number().min(1).max(10).default(3),
  detection: z.coerce.number().min(1).max(10).default(3),
  capa_required: z.boolean().default(false),
  capa_justification: z.string().optional().default(''),
  recall_evaluation_required: z.boolean().default(false),
  conclusion: z.string().optional().default(''),
  qa_comments: z.string().optional().default(''),
});

export const impactAssessmentSchema = impactAssessmentBaseSchema.superRefine((data, ctx) => {
  impactAssessmentRefine(data, ctx, false);
});

export const impactAssessmentSubmitSchema = impactAssessmentBaseSchema.superRefine((data, ctx) => {
  impactAssessmentRefine(data, ctx, true);
});

export const impactQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().optional().default(''),
});

const capaLinkRefine = (data: {
  capa_required: boolean;
  capa_number?: string;
  corrective_action: string;
  preventive_action: string;
  responsible_person_name: string;
  target_completion_date: string;
}, ctx: z.RefinementCtx) => {
  if (data.capa_required) {
    if (!data.capa_number?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'CAPA number required when CAPA is required', path: ['capa_number'] });
    }
    if (!data.corrective_action.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Corrective action is required', path: ['corrective_action'] });
    }
    if (!data.preventive_action.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Preventive action is required', path: ['preventive_action'] });
    }
    if (!data.responsible_person_name.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Responsible person is required', path: ['responsible_person_name'] });
    }
    if (!data.target_completion_date) {
      ctx.addIssue({ code: 'custom', message: 'Target completion date is required', path: ['target_completion_date'] });
    }
  }
};

export const capaRequirementSchema = z.object({
  capa_required: z.boolean(),
  remarks: z.string().optional().default(''),
});

export const capaLinkExistingSchema = z.object({
  capa_number: z.string().min(1, 'CAPA number is required'),
  remarks: z.string().optional().default(''),
});

export const capaCreateFromDeviationSchema = z.object({
  capa_required: z.boolean().default(true),
  capa_title: z.string().min(3, 'CAPA title is required'),
  capa_source: z.string().default('Deviation'),
  root_cause: z.string().min(3, 'Root cause is required'),
  corrective_action: z.string().min(3, 'Corrective action is required'),
  preventive_action: z.string().min(3, 'Preventive action is required'),
  responsible_person_name: z.string().min(1, 'Responsible person is required'),
  target_completion_date: z.string().min(1, 'Target date is required'),
  effectiveness_check_required: z.boolean().default(true),
  remarks: z.string().optional().default(''),
});

export const capaUnlinkSchema = z.object({
  reason: z.string().min(5, 'Unlink reason is required'),
});

export const capaLinkFormSchema = z.object({
  capa_required: z.boolean(),
  capa_number: z.string().optional().default(''),
  capa_title: z.string().optional().default(''),
  capa_source: z.string().optional().default('Deviation'),
  root_cause: z.string().optional().default(''),
  corrective_action: z.string().optional().default(''),
  preventive_action: z.string().optional().default(''),
  responsible_person_name: z.string().optional().default(''),
  target_completion_date: z.string().optional().default(''),
  effectiveness_check_required: z.boolean().default(true),
  remarks: z.string().optional().default(''),
}).superRefine((data, ctx) => capaLinkRefine({
  capa_required: data.capa_required,
  capa_number: data.capa_number,
  corrective_action: data.corrective_action,
  preventive_action: data.preventive_action,
  responsible_person_name: data.responsible_person_name,
  target_completion_date: data.target_completion_date || '',
}, ctx));

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5, 'Comments required'),
  e_signature: z.string().min(3, 'E-signature required (typed full name)'),
});

export const assignInvestigatorSchema = z.object({
  assigned_investigator_name: z.string().min(1, 'Investigator name required'),
});

export const closureDraftSchema = z.object({
  investigation_completed: z.boolean().default(false),
  impact_assessment_completed: z.boolean().default(false),
  root_cause_identified: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  capa_linked: z.boolean().default(false),
  capa_completed: z.boolean().default(false),
  effectiveness_check_completed: z.boolean().default(false),
  product_quality_impact_resolved: z.boolean().default(false),
  patient_safety_impact_resolved: z.boolean().default(false),
  regulatory_impact_resolved: z.boolean().default(false),
  all_attachments_reviewed: z.boolean().default(false),
  qa_closure_comments: z.string().optional().default(''),
  final_closure_conclusion: z.string().optional().default(''),
});

export const closureFormSchema = closureDraftSchema.extend({
  qa_closure_comments: z.string().min(10, 'QA closure comments required'),
  final_closure_conclusion: z.string().min(10, 'Final closure conclusion required'),
});

export const closureReopenSchema = z.object({
  reason: z.string().min(5, 'Reopen reason is required'),
  e_signature: z.string().min(3, 'E-signature required'),
});

export { trendFilterSchema, trendSaveSchema } from '@/lib/deviation-trend-records';
export type { TrendFilterForm, TrendSaveForm } from '@/lib/deviation-trend-records';

export { deviationReportFormSchema } from '@/lib/deviation-reports-records';
export type { DeviationReportFormData } from '@/lib/deviation-reports-records';

export type ClosureFormInput = z.infer<typeof closureFormSchema>;
export type ClosureReopenInput = z.infer<typeof closureReopenSchema>;

export type DeviationCreateInput = z.infer<typeof deviationCreateBaseSchema>;
export type InvestigationInput = z.infer<typeof investigationSchema>;
export type InvestigationSubmitInput = z.infer<typeof investigationSubmitSchema>;
export type InvestigationQaReviewInput = z.infer<typeof investigationQaReviewSchema>;
export type ImpactAssessmentInput = z.infer<typeof impactAssessmentSchema>;
export type CapaRequirementInput = z.infer<typeof capaRequirementSchema>;
export type CapaLinkExistingInput = z.infer<typeof capaLinkExistingSchema>;
export type CapaCreateFromDeviationInput = z.infer<typeof capaCreateFromDeviationSchema>;
export type CapaUnlinkInput = z.infer<typeof capaUnlinkSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;

export { DEPARTMENTS, DEVIATION_CATEGORIES, DEVIATION_PLANNED_TYPES, DEVIATION_CRITICALITIES, RCA_METHODS };
