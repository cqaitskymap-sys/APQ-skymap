import { z } from 'zod';
import {
  VALIDATION_TYPES, VALIDATION_STATUSES, VALIDATION_DEPARTMENTS,
  PASS_FAIL, GXP_IMPACTS, CSV_RISK_CATEGORIES,
} from './validation-mgmt-types';

export const validationCreateSchema = z.object({
  validation_type: z.enum(VALIDATION_TYPES as unknown as [string, ...string[]]),
  validation_title: z.string().min(1, 'Title is required'),
  department: z.enum(VALIDATION_DEPARTMENTS as unknown as [string, ...string[]]),
  product_name: z.string().default(''),
  batch_number: z.string().default(''),
  equipment_name: z.string().default(''),
  equipment_id: z.string().default(''),
  system_name: z.string().default(''),
  protocol_number: z.string().default(''),
  protocol_version: z.string().default('1.0'),
  report_number: z.string().default(''),
  validation_start_date: z.string().min(1, 'Start date required'),
  validation_end_date: z.string().default(''),
  revalidation_due_date: z.string().nullable().optional(),
  validation_status: z.enum(VALIDATION_STATUSES as unknown as [string, ...string[]]).default('Draft'),
  deviation_observed: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  change_control_linked: z.boolean().default(false),
  change_control_id: z.string().nullable().optional(),
  change_control_number: z.string().default(''),
  remarks: z.string().default(''),
  is_vmp: z.boolean().default(false),
  vmp_year: z.string().nullable().optional(),
});

export const protocolSchema = z.object({
  validation_id: z.string().min(1),
  objective: z.string().default(''),
  scope: z.string().default(''),
  responsibility: z.string().default(''),
  reference_documents: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  pre_requisites: z.string().default(''),
  test_scripts: z.string().default(''),
  deviation_handling: z.string().default(''),
  version: z.string().default('1.0'),
});

export const executionStepSchema = z.object({
  validation_id: z.string().min(1),
  test_step_no: z.coerce.number().min(1),
  test_description: z.string().min(1, 'Description required'),
  expected_result: z.string().min(1, 'Expected result required'),
  actual_result: z.string().default(''),
  pass_fail: z.enum(PASS_FAIL as unknown as [string, ...string[]]).default('N/A'),
  execution_date: z.string().default(''),
  remarks: z.string().default(''),
});

export const approvalSchema = z.object({
  validation_id: z.string().min(1),
  approval_level: z.string().default('Final'),
  decision: z.enum(['approved', 'rejected'] as const),
  comments: z.string().default(''),
});

export const processValidationSchema = z.object({
  validation_id: z.string().min(1),
  product: z.string().min(1),
  batch_no: z.string().default(''),
  stage: z.string().default(''),
  cpp_parameter: z.string().default(''),
  cqa_parameter: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  observed_result: z.string().default(''),
  conclusion: z.string().default(''),
});

export const cleaningValidationSchema = z.object({
  validation_id: z.string().min(1),
  product_from: z.string().min(1),
  product_to: z.string().default(''),
  equipment: z.string().default(''),
  swab_location: z.string().default(''),
  maco_limit: z.string().default(''),
  observed_residue: z.string().default(''),
  result: z.string().default(''),
  cleaning_status: z.string().default('Pending'),
});

export const csvValidationSchema = z.object({
  validation_id: z.string().min(1),
  system_name: z.string().min(1),
  gxp_impact: z.enum(GXP_IMPACTS as unknown as [string, ...string[]]).default('Direct GxP'),
  risk_category: z.enum(CSV_RISK_CATEGORIES as unknown as [string, ...string[]]).default('Medium'),
  urs_number: z.string().default(''),
  frs_number: z.string().default(''),
  ds_number: z.string().default(''),
  iq_protocol: z.string().default(''),
  oq_protocol: z.string().default(''),
  pq_protocol: z.string().default(''),
  traceability_matrix: z.string().default(''),
  part11_assessment: z.string().default(''),
  validation_status: z.string().default('Draft'),
});

export type ValidationCreateInput = z.infer<typeof validationCreateSchema>;
export type ProtocolInput = z.infer<typeof protocolSchema>;
export type ExecutionStepInput = z.infer<typeof executionStepSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type ProcessValidationInput = z.infer<typeof processValidationSchema>;
export type CleaningValidationInput = z.infer<typeof cleaningValidationSchema>;
export type CsvValidationInput = z.infer<typeof csvValidationSchema>;
