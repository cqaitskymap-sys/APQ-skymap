import { z } from 'zod';
import {
  ASSESSMENT_TYPES, IMPACT_RATINGS, ASSESSMENT_STATUSES,
} from './change-impact-assessment-types';

const ratingEnum = z.enum(IMPACT_RATINGS as unknown as [string, ...string[]]);

export const createImpactAssessmentSchema = z.object({
  related_document_id: z.string().min(1, 'Document is required'),
  related_change_control_id: z.string().optional().default(''),
  assessment_type: z.enum(ASSESSMENT_TYPES as unknown as [string, ...string[]]),
  assessment_reason: z.string().min(5, 'Assessment reason is required'),
  change_summary: z.string().min(5, 'Change summary is required'),
  business_justification: z.string().min(5, 'Business justification is required'),
  department: z.string().min(1, 'Department is required'),
  site: z.string().optional().default(''),
  business_unit: z.string().optional().default(''),
  product_impact: ratingEnum.default('None'),
  process_impact: ratingEnum.default('None'),
  equipment_impact: ratingEnum.default('None'),
  facility_impact: ratingEnum.default('None'),
  validation_impact: ratingEnum.default('None'),
  qualification_impact: ratingEnum.default('None'),
  csv_impact: ratingEnum.default('None'),
  training_impact: ratingEnum.default('None'),
  regulatory_impact: ratingEnum.default('None'),
  customer_impact: ratingEnum.default('None'),
  supplier_impact: ratingEnum.default('None'),
  material_impact: ratingEnum.default('None'),
  risk_assessment_required: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  revalidation_required: z.boolean().default(false),
  retraining_required: z.boolean().default(false),
  regulatory_notification_required: z.boolean().default(false),
  effective_date_impact: z.string().optional().nullable(),
  priority: z.string().default('Normal'),
  overall_impact_rating: ratingEnum,
  reviewer_id: z.string().min(1, 'Reviewer is required'),
  reviewer_name: z.string().min(1, 'Reviewer name is required'),
  approver_id: z.string().min(1, 'Approver is required'),
  approver_name: z.string().min(1, 'Approver name is required'),
  electronic_signature_required: z.boolean().default(false),
});

export const approveImpactSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  // signature validated at service level when e-sign required
});

export const rejectImpactSchema = z.object({
  reason: z.string().min(5, 'Rejection reason is required'),
});

export type CreateImpactAssessmentInput = z.infer<typeof createImpactAssessmentSchema>;
export type ApproveImpactInput = z.infer<typeof approveImpactSchema>;
export type RejectImpactInput = z.infer<typeof rejectImpactSchema>;
