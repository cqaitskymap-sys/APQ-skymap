import { z } from 'zod';
import {
  DEVIATION_CATEGORIES, DEVIATION_PLANNED_TYPES, DEVIATION_CRITICALITIES,
  RCA_METHODS, DEPARTMENTS,
} from './deviation-types';

export const deviationCreateSchema = z.object({
  deviation_date: z.string().min(1, 'Deviation date is required'),
  department: z.string().min(1, 'Department is required'),
  product_name: z.string().min(1, 'Product name is required'),
  batch_number: z.string().optional().default(''),
  area: z.string().min(1, 'Area / location is required'),
  reported_by_name: z.string().min(1, 'Reported by is required'),
  detected_by_name: z.string().min(1, 'Detected by is required'),
  category: z.enum(DEVIATION_CATEGORIES as unknown as [string, ...string[]]),
  planned_type: z.enum(DEVIATION_PLANNED_TYPES as unknown as [string, ...string[]]),
  criticality: z.enum(DEVIATION_CRITICALITIES as unknown as [string, ...string[]]),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  immediate_action: z.string().min(5, 'Immediate action is required'),
  batch_impacted: z.boolean().default(false),
  product_quality_impacted: z.boolean().default(false),
  patient_safety_impacted: z.boolean().default(false),
  regulatory_impact: z.boolean().default(false),
  repeat_deviation: z.boolean().default(false),
  target_closure_date: z.string().optional().nullable(),
  qa_remarks: z.string().optional().default(''),
});

export const deviationUpdateSchema = deviationCreateSchema.partial();

export const investigationSchema = z.object({
  rca_method: z.enum(RCA_METHODS as unknown as [string, ...string[]]),
  root_cause_details: z.string().min(10, 'Root cause details required'),
  investigation_summary: z.string().min(10, 'Investigation summary required'),
});

export const impactAssessmentSchema = z.object({
  impact_summary: z.string().min(10, 'Impact summary required'),
  batch_impact_details: z.string().optional().default(''),
  product_quality_impact_details: z.string().optional().default(''),
  patient_safety_impact_details: z.string().optional().default(''),
  regulatory_impact_details: z.string().optional().default(''),
  capa_required: z.boolean(),
  capa_justification: z.string().optional().default(''),
});

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5, 'Comments required'),
  e_signature: z.string().min(3, 'E-signature required (typed full name)'),
});

export const assignInvestigatorSchema = z.object({
  assigned_investigator_name: z.string().min(1, 'Investigator name required'),
});

export type DeviationCreateInput = z.infer<typeof deviationCreateSchema>;
export type InvestigationInput = z.infer<typeof investigationSchema>;
export type ImpactAssessmentInput = z.infer<typeof impactAssessmentSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;

export { DEPARTMENTS, DEVIATION_CATEGORIES, DEVIATION_PLANNED_TYPES, DEVIATION_CRITICALITIES, RCA_METHODS };
