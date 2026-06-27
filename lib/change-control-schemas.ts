import { z } from 'zod';
import {
  CHANGE_TYPES, CHANGE_CATEGORIES, CHANGE_PRIORITIES, TEMPORARY_OPTIONS, CC_DEPARTMENTS,
} from './change-control-types';

const yesNoImpact = z.boolean().default(false);

const baseFields = {
  change_date: z.string().min(1, 'Change date is required'),
  department: z.enum(CC_DEPARTMENTS as unknown as [string, ...string[]]),
  initiated_by_name: z.string().min(1, 'Initiated by is required'),
  change_type: z.enum(CHANGE_TYPES as unknown as [string, ...string[]]),
  change_category: z.enum(CHANGE_CATEGORIES as unknown as [string, ...string[]]),
  change_priority: z.enum(CHANGE_PRIORITIES as unknown as [string, ...string[]]),
  temporary_permanent: z.enum(TEMPORARY_OPTIONS as unknown as [string, ...string[]]).default('Permanent'),
};

export const ccCreateStep1Schema = z.object({
  ...baseFields,
});

export const ccCreateStep2Schema = z.object({
  change_title: z.string().min(3, 'Title must be at least 3 characters'),
  change_description: z.string().min(10, 'Description is required'),
  current_system: z.string().min(5, 'Current system/process is required'),
  proposed_change: z.string().min(5, 'Proposed change is required'),
  reason_for_change: z.string().min(5, 'Reason for change is required'),
});

export const ccCreateStep3Schema = z.object({
  product_name: z.string().optional().default(''),
  batch_number: z.string().optional().default(''),
  affected_documents: z.string().optional().default(''),
  affected_equipment: z.string().optional().default(''),
  affected_material: z.string().optional().default(''),
  affected_vendor: z.string().optional().default(''),
  affected_process: z.string().optional().default(''),
  affected_product: z.string().optional().default(''),
});

export const ccCreateStep4Schema = z.object({
  regulatory_impact: yesNoImpact,
  validation_impact: yesNoImpact,
  csv_impact: yesNoImpact,
  training_impact: yesNoImpact,
  stability_impact: yesNoImpact,
  quality_impact: yesNoImpact,
  patient_safety_impact: yesNoImpact,
  market_impact: yesNoImpact,
  risk_assessment_required: z.boolean().default(true),
  capa_required: z.boolean().default(false),
  effectiveness_check_required: z.boolean().default(true),
});

export const ccCreateStep5Schema = z.object({
  planned_implementation_date: z.string().min(1, 'Planned implementation date is required'),
  target_closure_date: z.string().optional().default(''),
  assigned_owner: z.string().min(1, 'Assigned owner is required'),
  assigned_owner_name: z.string().optional().default(''),
  qa_reviewer: z.string().min(1, 'QA reviewer is required'),
  qa_reviewer_name: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
  qa_remarks: z.string().optional().default(''),
});

export const changeCreateSchema = ccCreateStep1Schema
  .merge(ccCreateStep2Schema)
  .merge(ccCreateStep3Schema)
  .merge(ccCreateStep4Schema)
  .merge(ccCreateStep5Schema);

export type ChangeCreateInput = z.infer<typeof changeCreateSchema>;

export {
  CHANGE_TYPES, CHANGE_CATEGORIES, CHANGE_PRIORITIES, CC_DEPARTMENTS, TEMPORARY_OPTIONS,
};

// Legacy exports for other modules
export const impactAssessmentSchema = z.object({
  quality_impact: z.string().min(3, 'Required'),
  safety_impact: z.string().min(3, 'Required'),
  efficacy_impact: z.string().min(3, 'Required'),
  process_impact: z.string().min(3, 'Required'),
  equipment_impact: z.string().optional().default(''),
  utility_impact: z.string().optional().default(''),
  cleaning_impact: z.string().optional().default(''),
  validation_impact: z.string().optional().default(''),
  stability_impact: z.string().optional().default(''),
  regulatory_impact: z.string().optional().default(''),
  documentation_impact: z.string().optional().default(''),
  training_impact: z.string().optional().default(''),
  computerized_system_impact: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
});

export const riskAssessmentSchema = z.object({
  severity: z.coerce.number().int().min(1).max(5),
  occurrence: z.coerce.number().int().min(1).max(5),
  detectability: z.coerce.number().int().min(1).max(5),
  mitigation_plan: z.string().min(5, 'Mitigation plan is required'),
});

export const implementationActionSchema = z.object({
  action_item: z.string().min(5, 'Action item is required'),
  responsible_person_name: z.string().min(1, 'Responsible person is required'),
  target_date: z.string().optional().nullable(),
  evidence: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
  action_type: z.enum(['general', 'validation', 'training', 'csv']).default('general'),
});

export const effectivenessReviewSchema = z.object({
  effectiveness_criteria: z.string().min(5, 'Criteria is required'),
  review_date: z.string().min(1, 'Review date is required'),
  result: z.enum(['Effective', 'Not Effective', 'Partially Effective']),
  conclusion: z.string().min(5, 'Conclusion is required'),
  further_action_required: z.boolean().default(false),
});

export const changeApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5, 'Comments are required'),
  e_signature: z.string().min(3, 'E-signature required'),
});

export type ImpactAssessmentInput = z.infer<typeof impactAssessmentSchema>;
export type RiskAssessmentInput = z.infer<typeof riskAssessmentSchema>;
export type ImplementationActionInput = z.infer<typeof implementationActionSchema>;
export type EffectivenessReviewInput = z.infer<typeof effectivenessReviewSchema>;
export type ChangeApprovalInput = z.infer<typeof changeApprovalSchema>;
