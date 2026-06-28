import { z } from 'zod';
import { EBMR_STATUSES, PROCESS_STAGES, IPC_CHECK_NAMES, STEP_STATUSES, COMPLIANCE_STATUSES } from './ebmr-mgmt-types';

export const ebmrCreateSchema = z.object({
  product_name: z.string().min(1, 'Product name required'),
  generic_name: z.string().default(''),
  strength: z.string().default(''),
  batch_number: z.string().min(1, 'Batch number required'),
  batch_size: z.string().default(''),
  batch_size_litres: z.coerce.number().positive().optional().nullable(),
  std_fill_volume_ml: z.coerce.number().positive().optional().nullable(),
  batch_size_nos: z.coerce.number().int().positive().optional().nullable(),
  mfg_date: z.string().min(1),
  exp_date: z.string().min(1),
  mfr_number: z.string().default(''),
  bmr_version: z.string().default('1.0'),
  manufacturing_license_no: z.string().default(''),
  manufacturing_area: z.string().default(''),
  market: z.string().default(''),
  customer: z.string().default(''),
  remarks: z.string().default(''),
});

export const lineClearanceSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  area_name: z.string().min(1),
  room_number: z.string().default(''),
  previous_product: z.string().default(''),
  previous_batch_number: z.string().default(''),
  area_cleaned: z.boolean().default(false),
  equipment_cleaned: z.boolean().default(false),
  documents_removed: z.boolean().default(false),
  material_removed: z.boolean().default(false),
  status_label_verified: z.boolean().default(false),
  checked_by_name: z.string().default(''),
  clearance_datetime: z.string().min(1),
  qa_verified: z.boolean().default(false),
  remarks: z.string().default(''),
});

export const ebmrDispensingSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  material_type: z.enum(['API', 'Excipient', 'Primary Packing', 'Secondary Packing', 'Other'] as const).default('API'),
  material_name: z.string().min(1),
  material_code: z.string().default(''),
  ar_number: z.string().min(1),
  material_mfg_date: z.string().default(''),
  material_exp_date: z.string().default(''),
  vendor_name: z.string().default(''),
  required_quantity: z.coerce.number().positive(),
  dispensed_quantity: z.coerce.number().min(0),
  unit: z.string().default('kg'),
  checked_by_name: z.string().default(''),
  qa_verified_by_name: z.string().default(''),
  verified: z.boolean().default(false),
  remarks: z.string().default(''),
});

export const manufacturingStepSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  step_number: z.coerce.number().int().positive(),
  process_stage: z.enum(PROCESS_STAGES as unknown as [string, ...string[]]),
  instruction: z.string().default(''),
  start_datetime: z.string().default(''),
  end_datetime: z.string().default(''),
  observed_value: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  status: z.enum(STEP_STATUSES as unknown as [string, ...string[]]).default('Completed'),
  checked_by_name: z.string().default(''),
  remarks: z.string().default(''),
});

export const equipmentUsageSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  equipment_doc_id: z.string().min(1),
  equipment_id: z.string().min(1),
  equipment_name: z.string().min(1),
  process_stage: z.string().default(''),
  cleaning_status: z.enum(COMPLIANCE_STATUSES as unknown as [string, ...string[]]).default('Compliant'),
  sterilization_status: z.enum(COMPLIANCE_STATUSES as unknown as [string, ...string[]]).default('Compliant'),
  qualification_status: z.enum(COMPLIANCE_STATUSES as unknown as [string, ...string[]]).default('Compliant'),
  calibration_status: z.string().default('Calibrated'),
  usage_start_time: z.string().default(''),
  usage_end_time: z.string().default(''),
  remarks: z.string().default(''),
});

export const cppRecordSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  process_stage: z.string().min(1),
  parameter_name: z.string().min(1),
  target: z.coerce.number(),
  lsl: z.coerce.number(),
  usl: z.coerce.number(),
  observed_value: z.coerce.number(),
  unit: z.string().default(''),
  recorded_time: z.string().min(1),
  remarks: z.string().default(''),
});

export const ipcCheckSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  check_name: z.enum(IPC_CHECK_NAMES as unknown as [string, ...string[]]),
  frequency: z.string().default(''),
  specification: z.string().default(''),
  observed_result: z.string().min(1),
  unit: z.string().default(''),
  check_datetime: z.string().min(1),
  remarks: z.string().default(''),
});

export const ebmrReviewSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  review_type: z.string().default('QA Review'),
  decision: z.enum(['Approved', 'Rejected', 'Hold'] as const),
  comments: z.string().default(''),
});

export const ebmrReleaseSchema = z.object({
  ebmr_doc_id: z.string().min(1),
  decision: z.enum(['Released', 'Rejected'] as const),
  remarks: z.string().default(''),
});

export type EbmrCreateInput = z.infer<typeof ebmrCreateSchema>;
export type LineClearanceInput = z.infer<typeof lineClearanceSchema>;
export type EbmrDispensingInput = z.infer<typeof ebmrDispensingSchema>;
export type ManufacturingStepInput = z.infer<typeof manufacturingStepSchema>;
export type EquipmentUsageInput = z.infer<typeof equipmentUsageSchema>;
export type CppRecordInput = z.infer<typeof cppRecordSchema>;
export type IpcCheckInput = z.infer<typeof ipcCheckSchema>;
export type EbmrReviewInput = z.infer<typeof ebmrReviewSchema>;
export type EbmrReleaseInput = z.infer<typeof ebmrReleaseSchema>;
