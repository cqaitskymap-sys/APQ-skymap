import { z } from 'zod';
import {
  SYSTEM_TYPES, HOSTING_TYPES, GXP_CLASSIFICATIONS, CSV_STATUSES,
  REQUIREMENT_TYPES, TEST_PHASES, PASS_FAIL, CSV_DEPARTMENTS,
} from './csv-mgmt-types';

export const systemCreateSchema = z.object({
  system_name: z.string().min(1, 'System name required'),
  system_owner: z.string().min(1, 'System owner required'),
  department: z.enum(CSV_DEPARTMENTS as unknown as [string, ...string[]]),
  vendor: z.string().default(''),
  system_type: z.enum(SYSTEM_TYPES as unknown as [string, ...string[]]),
  business_process: z.string().default(''),
  gxp_impact: z.boolean().default(false),
  data_criticality: z.string().default('Medium'),
  regulatory_impact: z.boolean().default(false),
  hosting_type: z.enum(HOSTING_TYPES as unknown as [string, ...string[]]).default('On-Premise'),
  authentication_type: z.string().default(''),
  backup_required: z.boolean().default(true),
  audit_trail_required: z.boolean().default(false),
  e_signature_required: z.boolean().default(false),
  validation_status: z.enum(CSV_STATUSES as unknown as [string, ...string[]]).default('Draft'),
  go_live_date: z.string().nullable().optional(),
  retirement_date: z.string().nullable().optional(),
  next_review_due: z.string().nullable().optional(),
  remarks: z.string().default(''),
});

export const gxpAssessmentSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  used_for_gmp: z.boolean().default(false),
  stores_gmp_data: z.boolean().default(false),
  generates_batch_data: z.boolean().default(false),
  controls_equipment: z.boolean().default(false),
  manages_e_records: z.boolean().default(false),
  uses_e_signatures: z.boolean().default(false),
  gxp_classification: z.enum(GXP_CLASSIFICATIONS as unknown as [string, ...string[]]),
  assessment_conclusion: z.string().default(''),
  assessment_date: z.string().min(1),
});

export const riskAssessmentSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  requirement_id: z.string().default(''),
  risk_description: z.string().min(1),
  severity: z.coerce.number().min(1).max(10),
  occurrence: z.coerce.number().min(1).max(10),
  detectability: z.coerce.number().min(1).max(10),
  mitigation: z.string().default(''),
  residual_risk: z.string().default(''),
  approval_status: z.string().default('Pending'),
});

export const ursSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  requirement_no: z.string().min(1),
  requirement_description: z.string().min(1),
  requirement_type: z.enum(REQUIREMENT_TYPES as unknown as [string, ...string[]]),
  priority: z.string().default('Medium'),
  gxp_critical: z.boolean().default(false),
  acceptance_criteria: z.string().default(''),
  status: z.string().default('Draft'),
});

export const frsSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  linked_urs_no: z.string().min(1),
  functional_specification: z.string().min(1),
  system_response: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  status: z.string().default('Draft'),
});

export const designSpecSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  linked_frs_no: z.string().min(1),
  design_description: z.string().min(1),
  technical_design: z.string().default(''),
  database_collection: z.string().default(''),
  api_function: z.string().default(''),
  ui_component: z.string().default(''),
  status: z.string().default('Draft'),
});

export const testScriptSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  test_phase: z.enum(TEST_PHASES as unknown as [string, ...string[]]),
  test_script_no: z.string().min(1),
  linked_requirement: z.string().default(''),
  test_objective: z.string().default(''),
  precondition: z.string().default(''),
  test_steps: z.string().default(''),
  expected_result: z.string().min(1),
  actual_result: z.string().default(''),
  pass_fail: z.enum(PASS_FAIL as unknown as [string, ...string[]]).default('N/A'),
  execution_date: z.string().default(''),
  remarks: z.string().default(''),
});

export const traceabilitySchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  urs_no: z.string().default(''),
  frs_no: z.string().default(''),
  ds_no: z.string().default(''),
  iq_test_no: z.string().default(''),
  oq_test_no: z.string().default(''),
  pq_test_no: z.string().default(''),
  status: z.string().default('Draft'),
  gap_identified: z.boolean().default(false),
});

export const part11Schema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  audit_trail_available: z.boolean().default(false),
  audit_trail_secure: z.boolean().default(false),
  audit_trail_reviewable: z.boolean().default(false),
  e_signature_available: z.boolean().default(false),
  password_policy_available: z.boolean().default(false),
  user_access_control: z.boolean().default(false),
  data_backup: z.boolean().default(false),
  record_retention: z.boolean().default(false),
  time_stamped_records: z.boolean().default(false),
  system_security: z.boolean().default(false),
  assessment_result: z.string().default('Pending'),
  gap_action: z.string().default(''),
});

export const validationReportSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  validation_summary: z.string().default(''),
  deviations_observed: z.coerce.number().min(0).default(0),
  open_issues: z.coerce.number().min(0).default(0),
  test_summary: z.string().default(''),
  requirement_coverage_percent: z.coerce.number().min(0).max(100).default(0),
  final_conclusion: z.string().default(''),
  recommended_status: z.string().default('Validated'),
});

export const periodicReviewSchema = z.object({
  system_id: z.string().min(1),
  system_name: z.string().min(1),
  review_period: z.string().min(1),
  incidents: z.coerce.number().min(0).default(0),
  changes: z.coerce.number().min(0).default(0),
  deviations: z.coerce.number().min(0).default(0),
  access_review_completed: z.boolean().default(false),
  backup_review_completed: z.boolean().default(false),
  audit_trail_review_completed: z.boolean().default(false),
  system_performance_review: z.string().default(''),
  validation_status: z.string().default('Validated'),
  recommendation: z.string().default(''),
  next_review_due: z.string().min(1),
});

export type SystemCreateInput = z.infer<typeof systemCreateSchema>;
export type GxpAssessmentInput = z.infer<typeof gxpAssessmentSchema>;
export type RiskAssessmentInput = z.infer<typeof riskAssessmentSchema>;
export type UrsInput = z.infer<typeof ursSchema>;
export type FrsInput = z.infer<typeof frsSchema>;
export type DesignSpecInput = z.infer<typeof designSpecSchema>;
export type TestScriptInput = z.infer<typeof testScriptSchema>;
export type TraceabilityInput = z.infer<typeof traceabilitySchema>;
export type Part11Input = z.infer<typeof part11Schema>;
export type ValidationReportInput = z.infer<typeof validationReportSchema>;
export type PeriodicReviewInput = z.infer<typeof periodicReviewSchema>;
