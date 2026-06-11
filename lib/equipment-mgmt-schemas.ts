import { z } from 'zod';
import {
  EQUIPMENT_TYPES, EQUIPMENT_STATUSES, EQUIPMENT_DEPARTMENTS,
  CALIBRATION_STATUSES, CALIBRATION_TYPES, PM_STATUSES, PM_TYPES, BREAKDOWN_STATUSES,
} from './equipment-mgmt-types';

export const equipmentCreateSchema = z.object({
  equipment_name: z.string().min(1, 'Equipment name required'),
  equipment_type: z.enum(EQUIPMENT_TYPES as unknown as [string, ...string[]]),
  department: z.enum(EQUIPMENT_DEPARTMENTS as unknown as [string, ...string[]]),
  area_room_no: z.string().default(''),
  make: z.string().default(''),
  model: z.string().default(''),
  serial_no: z.string().default(''),
  capacity: z.string().default(''),
  installation_date: z.string().nullable().optional(),
  calibration_required: z.boolean().default(true),
  pm_required: z.boolean().default(true),
  qualification_required: z.boolean().default(false),
  cleaning_required: z.boolean().default(false),
  equipment_status: z.enum(EQUIPMENT_STATUSES as unknown as [string, ...string[]]).default('Active'),
  calibration_due_date: z.string().nullable().optional(),
  pm_due_date: z.string().nullable().optional(),
  validation_id: z.string().nullable().optional(),
  remarks: z.string().default(''),
});

export const calibrationSchema = z.object({
  equipment_doc_id: z.string().min(1),
  equipment_id: z.string().min(1),
  equipment_name: z.string().min(1),
  calibration_type: z.enum(CALIBRATION_TYPES as unknown as [string, ...string[]]).default('External'),
  calibration_date: z.string().min(1),
  calibration_due_date: z.string().min(1),
  calibration_agency: z.string().default(''),
  certificate_no: z.string().default(''),
  acceptance_criteria: z.string().default(''),
  observed_result: z.string().default(''),
  calibration_status: z.enum(CALIBRATION_STATUSES as unknown as [string, ...string[]]).default('Calibrated'),
  remarks: z.string().default(''),
});

export const pmSchema = z.object({
  equipment_doc_id: z.string().min(1),
  equipment_id: z.string().min(1),
  equipment_name: z.string().min(1),
  pm_type: z.enum(PM_TYPES as unknown as [string, ...string[]]).default('Scheduled'),
  pm_date: z.string().min(1),
  next_pm_due_date: z.string().min(1),
  checklist_completed: z.boolean().default(true),
  observation: z.string().default(''),
  spare_parts_used: z.string().default(''),
  pm_status: z.enum(PM_STATUSES as unknown as [string, ...string[]]).default('Completed'),
  remarks: z.string().default(''),
});

export const breakdownSchema = z.object({
  equipment_doc_id: z.string().min(1),
  equipment_id: z.string().min(1),
  equipment_name: z.string().min(1),
  breakdown_date: z.string().min(1),
  problem_description: z.string().min(1),
  impact_on_batch: z.boolean().default(false),
  impact_on_product_quality: z.boolean().default(false),
  immediate_action: z.string().default(''),
  root_cause: z.string().default(''),
  corrective_action: z.string().default(''),
  start_time: z.string().default(''),
  end_time: z.string().default(''),
  status: z.enum(BREAKDOWN_STATUSES as unknown as [string, ...string[]]).default('Open'),
  capa_required: z.boolean().default(false),
  deviation_required: z.boolean().default(false),
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type CalibrationInput = z.infer<typeof calibrationSchema>;
export type PmInput = z.infer<typeof pmSchema>;
export type BreakdownInput = z.infer<typeof breakdownSchema>;
