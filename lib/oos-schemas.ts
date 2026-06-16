import { z } from 'zod';
import { requiresBatchNumber, OOS_SAMPLE_TYPES } from '@/lib/oos-create-records';
import { DEPARTMENTS, PHASE1_OUTCOMES, PHASE2_OUTCOMES } from './oos-types';

export { DEPARTMENTS, PHASE1_OUTCOMES };

const batchRefine = (data: {
  sample_type?: string;
  batch_number?: string;
  target_closure_date?: string;
  oos_date?: string;
}, ctx: z.RefinementCtx) => {
  if (requiresBatchNumber(data.sample_type) && !data.batch_number?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Batch number is required for this sample type', path: ['batch_number'] });
  }
  if (data.target_closure_date && data.oos_date && data.target_closure_date <= data.oos_date) {
    ctx.addIssue({ code: 'custom', message: 'Target closure date must be after OOS date', path: ['target_closure_date'] });
  }
};

const oosCreateObjectSchema = z.object({
  oos_date: z.string().min(1, 'OOS date is required'),
  department: z.string().min(1, 'Department is required'),
  sample_type: z.enum(OOS_SAMPLE_TYPES as unknown as [string, ...string[]]).default('Finished Product'),
  product_name: z.string().min(1, 'Product is required'),
  product_id: z.string().optional().nullable(),
  batch_number: z.string().optional().default(''),
  test_name: z.string().min(1, 'Test name is required'),
  test_method: z.string().min(1, 'Test method is required'),
  stp_number: z.string().min(1, 'STP number is required'),
  specification_number: z.string().min(1, 'Specification number is required'),
  parameter_name: z.string().min(1, 'Parameter name is required'),
  spec_lower_limit: z.coerce.number(),
  spec_upper_limit: z.coerce.number(),
  observed_result: z.coerce.number({ invalid_type_error: 'Observed result is required' }),
  unit: z.string().min(1, 'Unit is required'),
  analyst_name: z.string().min(1, 'Analyst is required'),
  instrument_used: z.string().min(1, 'Instrument used is required'),
  initial_observation: z.string().min(5, 'Initial observation is required'),
  immediate_action: z.string().min(5, 'Immediate action is required'),
  is_critical_test: z.boolean().default(false),
  batch_release_blocked: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  assigned_investigator_name: z.string().min(1, 'Assigned investigator is required'),
  assigned_to: z.string().optional().nullable(),
  target_closure_date: z.string().min(1, 'Target closure date is required'),
  remarks: z.string().optional().default(''),
  source: z.string().optional(),
  source_reference: z.string().optional().nullable(),
  cpv_record_id: z.string().optional().nullable(),
  stability_record_id: z.string().optional().nullable(),
  cqa_result_id: z.string().optional().nullable(),
});

export const oosCreateBaseSchema = oosCreateObjectSchema.refine((v) => v.spec_lower_limit < v.spec_upper_limit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['spec_upper_limit'],
});

export const oosCreateSchema = oosCreateObjectSchema.superRefine(batchRefine).refine(
  (v) => v.spec_lower_limit < v.spec_upper_limit,
  { message: 'Upper limit must be greater than lower limit', path: ['spec_upper_limit'] },
);

export const oosStep1Schema = oosCreateObjectSchema.pick({
  oos_date: true, department: true, sample_type: true,
});

export const oosStep2Schema = oosCreateObjectSchema.pick({
  product_name: true, product_id: true, batch_number: true, sample_type: true,
}).superRefine((data: { sample_type?: string; batch_number?: string }, ctx: z.RefinementCtx) => {
  if (requiresBatchNumber(data.sample_type) && !data.batch_number?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Batch number is required for this sample type', path: ['batch_number'] });
  }
});

export const oosStep3Schema = oosCreateObjectSchema.pick({
  test_name: true, test_method: true, stp_number: true, specification_number: true,
  parameter_name: true, spec_lower_limit: true, spec_upper_limit: true, unit: true,
}).refine((v) => v.spec_lower_limit < v.spec_upper_limit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['spec_upper_limit'],
});

export const oosStep4Schema = oosCreateObjectSchema.pick({
  observed_result: true, analyst_name: true, instrument_used: true,
  initial_observation: true, immediate_action: true, is_critical_test: true,
  spec_lower_limit: true, spec_upper_limit: true,
});

export const oosStep5Schema = oosCreateObjectSchema.pick({
  batch_release_blocked: true, capa_required: true, assigned_investigator_name: true,
  assigned_to: true, target_closure_date: true, remarks: true, oos_date: true,
}).superRefine(batchRefine);

/** @deprecated use oosCreateBaseSchema fields */
export const oosCreateSchemaLegacy = z.object({
  oos_date: z.string().min(1, 'OOS date is required'),
  department: z.string().min(1, 'Department is required'),
  product_name: z.string().min(1, 'Product name is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  test_name: z.string().min(1, 'Test name is required'),
  test_method: z.string().min(1, 'Test method is required'),
  stp_number: z.string().min(1, 'STP number is required'),
  specification_number: z.string().min(1, 'Specification number is required'),
  parameter_name: z.string().min(1, 'Parameter name is required'),
  spec_lower_limit: z.coerce.number(),
  spec_upper_limit: z.coerce.number(),
  observed_result: z.coerce.number(),
  unit: z.string().min(1, 'Unit is required'),
  is_critical_test: z.boolean().default(false),
  target_closure_date: z.string().optional().nullable(),
}).refine((v) => v.spec_lower_limit < v.spec_upper_limit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['spec_upper_limit'],
});

export const phase1ObjectSchema = z.object({
  qc_investigator: z.string().optional(),
  qc_investigator_id: z.string().optional(),
  analyst_name: z.string().min(1, 'Analyst name required'),
  instrument_used: z.string().min(1, 'Instrument required'),
  instrument_id: z.string().optional(),
  instrument_calibration_status: z.string().min(1, 'Calibration status required'),
  standard_used: z.string().min(1, 'Standard required'),
  standard_lot_number: z.string().optional(),
  reagent_used: z.string().min(1, 'Reagent required'),
  reagent_lot_number: z.string().optional(),
  glassware_verified: z.boolean().optional().default(false),
  calculation_verified: z.boolean(),
  method_followed_correctly: z.boolean().optional().default(false),
  sample_preparation_verified: z.boolean().optional().default(false),
  data_review_completed: z.boolean().optional().default(false),
  chromatogram_attached: z.boolean().optional().default(false),
  raw_data_attached: z.boolean().optional().default(false),
  chromatogram_raw_data_reviewed: z.boolean().optional().default(false),
  analyst_interview_completed: z.boolean().optional().default(false),
  lab_error_observed: z.boolean().optional().default(false),
  assignable_cause_identified: z.boolean().optional().default(false),
  investigation_findings: z.string().min(10, 'Findings required'),
  root_cause_identified: z.string().optional().default(''),
  root_cause: z.string().optional().default(''),
  corrective_action: z.string().optional().default(''),
  phase1_conclusion: z.string().min(10, 'Conclusion required'),
  phase1_outcome: z.enum(PHASE1_OUTCOMES as unknown as [string, ...string[]]).optional(),
});

export const phase1Schema = phase1ObjectSchema;

export const phase1SubmitSchema = phase1ObjectSchema.superRefine((data, ctx) => {
  if (!data.calculation_verified) {
    ctx.addIssue({ code: 'custom', message: 'Calculation verification is required', path: ['calculation_verified'] });
  }
  if (!data.phase1_outcome) {
    ctx.addIssue({ code: 'custom', message: 'Phase-I outcome is required', path: ['phase1_outcome'] });
  }
  if (data.phase1_outcome === 'Laboratory Error') {
    if (!data.root_cause_identified?.trim() && !data.root_cause?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Root cause required for Laboratory Error', path: ['root_cause_identified'] });
    }
    if (!data.corrective_action?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Corrective action required for Laboratory Error', path: ['corrective_action'] });
    }
  }
});

export const phase1QaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_review_comments: z.string().min(5, 'QA review comments required'),
});

/** @deprecated minimal schema for detail view */
export const phase1SchemaLegacy = z.object({
  analyst_name: z.string().min(1, 'Analyst name required'),
  instrument_used: z.string().min(1, 'Instrument required'),
  instrument_calibration_status: z.string().min(1, 'Calibration status required'),
  standard_used: z.string().min(1, 'Standard required'),
  reagent_used: z.string().min(1, 'Reagent required'),
  calculation_verified: z.boolean(),
  data_review_completed: z.boolean(),
  chromatogram_attached: z.boolean(),
  raw_data_attached: z.boolean(),
  investigation_findings: z.string().min(10, 'Findings required'),
  root_cause_identified: z.string().min(5, 'Root cause required'),
  phase1_conclusion: z.string().min(10, 'Conclusion required'),
  phase1_outcome: z.enum(PHASE1_OUTCOMES as unknown as [string, ...string[]]),
});

export const phase2ObjectSchema = z.object({
  assigned_investigator: z.string().min(1, 'Assigned investigator is required'),
  assigned_investigator_id: z.string().optional(),
  manufacturing_review: z.string().min(5, 'Manufacturing review is required'),
  batch_record_review: z.string().min(5, 'Batch record review is required'),
  raw_material_review: z.string().min(5, 'Raw material review is required'),
  packing_material_review: z.string().optional().default(''),
  equipment_review: z.string().min(5, 'Equipment review is required'),
  cleaning_review: z.string().optional().default(''),
  utility_review: z.string().optional().default(''),
  environmental_review: z.string().min(5, 'Environmental review is required'),
  operator_review: z.string().min(5, 'Operator review is required'),
  process_parameter_review: z.string().optional().default(''),
  process_review: z.string().optional().default(''),
  deviation_review: z.string().optional().default(''),
  change_control_review: z.string().optional().default(''),
  previous_batch_trend_review: z.string().optional().default(''),
  other_batch_impact_review: z.string().optional().default(''),
  other_batches_impacted_list: z.string().optional().default(''),
  root_cause: z.string().optional().default(''),
  contributing_factors: z.string().optional().default(''),
  impact_assessment: z.string().min(10, 'Impact assessment is required'),
  product_quality_impact: z.enum(['Yes', 'No', 'Unknown']).optional().default('No'),
  corrective_action: z.string().optional().default(''),
  preventive_action: z.string().optional().default(''),
  capa_required: z.boolean().optional().default(false),
  linked_capa_number: z.string().optional().default(''),
  final_investigation_conclusion: z.string().min(10, 'Final conclusion is required'),
  conclusion: z.string().optional().default(''),
  phase2_outcome: z.enum(PHASE2_OUTCOMES as unknown as [string, ...string[]]).optional(),
  qa_justification: z.string().optional().default(''),
});

export const phase2Schema = phase2ObjectSchema;

export const phase2QaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_review_comments: z.string().min(5, 'QA review comments required'),
});

/** @deprecated minimal schema for detail view */
export const phase2SchemaLegacy = z.object({
  raw_material_review: z.string().min(5),
  equipment_review: z.string().min(5),
  environmental_review: z.string().min(5),
  process_review: z.string().min(5),
  operator_review: z.string().min(5),
  deviation_review: z.string().min(3).optional().default(''),
  change_control_review: z.string().min(3).optional().default(''),
  batch_record_review: z.string().min(5),
  root_cause: z.string().min(10),
  impact_assessment: z.string().min(10),
  corrective_action: z.string().min(5),
  preventive_action: z.string().min(5),
  conclusion: z.string().min(10),
});

export const impactAssessmentSchemaLegacy = z.object({
  product_impact: z.string().min(5),
  batch_impact: z.string().min(5),
  market_impact: z.string().optional().default(''),
  patient_safety_impact: z.string().min(5),
  regulatory_impact: z.string().min(5),
  other_batches_impacted: z.string().optional().default(''),
  recall_required: z.boolean(),
});

const oosImpactOption = z.enum(['Yes', 'No', 'Under Evaluation', 'Not Applicable'] as unknown as [string, ...string[]]);
const oosImpactYesNo = z.enum(['Yes', 'No'] as unknown as [string, ...string[]]);

const oosImpactRefine = (
  data: {
    product_quality_impact: string;
    batch_impact: string;
    patient_safety_impact: string;
    regulatory_impact: string;
    market_impact: string;
    stability_impact: string;
    validation_impact: string;
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
    data.product_quality_impact, data.batch_impact, data.patient_safety_impact,
    data.regulatory_impact, data.market_impact, data.stability_impact, data.validation_impact,
  ];
  if (!fields.some((f) => f && f !== 'Not Applicable') && data.other_batches_impacted !== 'Yes') {
    ctx.addIssue({ code: 'custom', message: 'At least one impact area must be assessed', path: ['product_quality_impact'] });
  }
  if (data.other_batches_impacted === 'Yes' && !data.impacted_batch_numbers?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Impacted batch numbers required', path: ['impacted_batch_numbers'] });
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

export const oosImpactObjectSchema = z.object({
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessed_by_name: z.string().min(1, 'Assessed by is required'),
  product_quality_impact: oosImpactOption,
  batch_impact: oosImpactOption,
  patient_safety_impact: oosImpactOption,
  regulatory_impact: oosImpactOption,
  market_impact: oosImpactOption.default('Not Applicable'),
  stability_impact: oosImpactOption.default('Not Applicable'),
  validation_impact: oosImpactOption.default('Not Applicable'),
  other_batches_impacted: oosImpactYesNo.default('No'),
  impacted_batch_numbers: z.string().optional().default(''),
  impact_description: z.string().optional().default(''),
  scientific_justification: z.string().optional().default(''),
  severity: z.coerce.number().min(1).max(10).default(3),
  occurrence: z.coerce.number().min(1).max(10).default(3),
  detection: z.coerce.number().min(1).max(10).default(3),
  capa_required: z.boolean().default(false),
  deviation_required: z.boolean().default(false),
  recall_evaluation_required: z.boolean().default(false),
  recall_evaluation_reason: z.string().optional().default(''),
  conclusion: z.string().optional().default(''),
  qa_comments: z.string().optional().default(''),
});

export const oosImpactSchema = oosImpactObjectSchema.superRefine((data, ctx) => {
  oosImpactRefine(data, ctx, false);
});

export const oosImpactSubmitSchema = oosImpactObjectSchema.superRefine((data, ctx) => {
  oosImpactRefine(data, ctx, true);
});

export const oosImpactQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().min(5, 'QA comments required'),
});

/** @deprecated minimal schema for OOS detail view tab */
export const impactAssessmentSchema = impactAssessmentSchemaLegacy;

export const oosCapaRequirementSchema = z.object({
  capa_required: z.boolean(),
  remarks: z.string().optional().default(''),
});

export const oosCapaLinkExistingSchema = z.object({
  capa_number: z.string().min(1, 'CAPA number is required'),
  remarks: z.string().optional().default(''),
});

export const oosCapaCreateSchema = z.object({
  capa_required: z.boolean().default(true),
  capa_title: z.string().min(3, 'CAPA title is required'),
  capa_source: z.string().default('OOS'),
  root_cause: z.string().min(3, 'Root cause is required'),
  corrective_action: z.string().min(3, 'Corrective action is required'),
  preventive_action: z.string().min(3, 'Preventive action is required'),
  action_owner_name: z.string().min(1, 'Action owner is required'),
  department: z.string().optional().default(''),
  target_completion_date: z.string().min(1, 'Target completion date is required'),
  effectiveness_check_required: z.boolean().default(true),
  remarks: z.string().optional().default(''),
});

export const oosCapaImplementationSchema = z.object({
  capa_status: z.string().min(1, 'CAPA status is required'),
  implementation_date: z.string().optional(),
  corrective_action: z.string().optional(),
  preventive_action: z.string().optional(),
  remarks: z.string().optional().default(''),
});

export const oosCapaEffectivenessSchema = z.object({
  effectiveness_result: z.enum(['Effective', 'Partially Effective', 'Not Effective', 'Under Review'] as unknown as [string, ...string[]]),
  effectiveness_check_date: z.string().min(1, 'Effectiveness check date is required'),
  remarks: z.string().optional().default(''),
});

export const oosCapaCloseSchema = z.object({
  effectiveness_result: z.enum(['Effective', 'Partially Effective', 'Not Effective', 'Under Review'] as unknown as [string, ...string[]]).optional(),
  capa_closure_date: z.string().optional(),
  remarks: z.string().optional().default(''),
});

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5),
  e_signature: z.string().min(3),
});

export type OosCreateInput = z.infer<typeof oosCreateSchema>;
export type Phase1Input = z.infer<typeof phase1ObjectSchema>;
export type Phase1SubmitInput = z.infer<typeof phase1SubmitSchema>;
export type Phase1QaReviewInput = z.infer<typeof phase1QaReviewSchema>;
export type Phase2Input = z.infer<typeof phase2ObjectSchema>;
export type Phase2QaReviewInput = z.infer<typeof phase2QaReviewSchema>;
export type OosImpactInput = z.infer<typeof oosImpactObjectSchema>;
export type OosImpactSubmitInput = z.infer<typeof oosImpactSubmitSchema>;
export type OosImpactQaReviewInput = z.infer<typeof oosImpactQaReviewSchema>;
export type OosImpactLegacyInput = z.infer<typeof impactAssessmentSchemaLegacy>;
export type OosCapaRequirementInput = z.infer<typeof oosCapaRequirementSchema>;
export type OosCapaLinkExistingInput = z.infer<typeof oosCapaLinkExistingSchema>;
export type OosCapaCreateInput = z.infer<typeof oosCapaCreateSchema>;
export type OosCapaImplementationInput = z.infer<typeof oosCapaImplementationSchema>;
export type OosCapaEffectivenessInput = z.infer<typeof oosCapaEffectivenessSchema>;
export type OosCapaCloseInput = z.infer<typeof oosCapaCloseSchema>;
export type OosApprovalInput = z.infer<typeof approvalSchema>;
