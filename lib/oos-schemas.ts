import { z } from 'zod';
import { DEPARTMENTS, PHASE1_OUTCOMES } from './oos-types';

export const oosCreateSchema = z.object({
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

export const phase1Schema = z.object({
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

export const phase2Schema = z.object({
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

export const impactAssessmentSchema = z.object({
  product_impact: z.string().min(5),
  batch_impact: z.string().min(5),
  market_impact: z.string().optional().default(''),
  patient_safety_impact: z.string().min(5),
  regulatory_impact: z.string().min(5),
  other_batches_impacted: z.string().optional().default(''),
  recall_required: z.boolean(),
});

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5),
  e_signature: z.string().min(3),
});

export type OosCreateInput = z.infer<typeof oosCreateSchema>;
export type Phase1Input = z.infer<typeof phase1Schema>;
export type Phase2Input = z.infer<typeof phase2Schema>;
export type OosImpactInput = z.infer<typeof impactAssessmentSchema>;
export type OosApprovalInput = z.infer<typeof approvalSchema>;

export { DEPARTMENTS, PHASE1_OUTCOMES };
