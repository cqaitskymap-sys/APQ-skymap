import { z } from 'zod';
import {
  CC_GAMP_CATEGORIES,
  CC_VALIDATION_CATEGORIES,
  CC_VALIDATION_DELIVERABLES,
  CC_VALIDATION_SYSTEM_TYPES,
} from '@/lib/change-control-types';

export const ccValidationAssessmentSchema = z.object({
  change_id: z.string().min(1, 'Change Control ID is required'),
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessed_by: z.string().min(1, 'Assessed by is required'),
  assessed_by_name: z.string().optional().default(''),
  department: z.string().min(1, 'Department is required'),
  validation_impact: z.boolean().default(false),
  qualification_impact: z.boolean().default(false),
  csv_impact: z.boolean().default(false),
  data_integrity_impact: z.boolean().default(false),
  regulatory_impact: z.boolean().default(false),
  revalidation_required: z.boolean().default(false),
  validation_category: z.enum(CC_VALIDATION_CATEGORIES as unknown as [string, ...string[]], {
    required_error: 'Validation category is required',
  }),
  system_type: z.enum(CC_VALIDATION_SYSTEM_TYPES as unknown as [string, ...string[]]).default('Process'),
  affected_system: z.string().optional().default(''),
  affected_equipment: z.string().optional().default(''),
  affected_documents: z.string().optional().default(''),
  affected_sops: z.string().optional().default(''),
  affected_process: z.string().optional().default(''),
  validation_scope: z.string().optional().default(''),
  validation_justification: z.string().trim().min(10, 'Validation justification is required'),
  risk_based_rationale: z.string().optional().default(''),
  validation_deliverables: z.array(z.enum(CC_VALIDATION_DELIVERABLES as unknown as [string, ...string[]])).default([]),
  validation_owner: z.string().min(1, 'Validation owner is required'),
  validation_owner_name: z.string().optional().default(''),
  target_completion_date: z.string().min(1, 'Target completion date is required'),
  qa_comments: z.string().optional().default(''),
  head_qa_comments: z.string().optional().default(''),
  gamp_category: z.enum(CC_GAMP_CATEGORIES as unknown as [string, ...string[]]).optional(),
  electronic_records_impact: z.boolean().default(false),
  electronic_signature_impact: z.boolean().default(false),
  audit_trail_impact: z.boolean().default(false),
  security_impact: z.boolean().default(false),
  backup_impact: z.boolean().default(false),
  disaster_recovery_impact: z.boolean().default(false),
  part_11_impact: z.boolean().default(false),
  annex_11_impact: z.boolean().default(false),
  annex_11_review_completed: z.boolean().default(false),
  csv_assessment_completed: z.boolean().default(false),
  qualification_review_completed: z.boolean().default(false),
  recommendations: z.string().optional().default(''),
});

export const ccValidationQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().trim().min(10, 'QA comments are required'),
  head_qa_comments: z.string().optional().default(''),
});

export type CcValidationAssessmentInput = z.infer<typeof ccValidationAssessmentSchema>;
