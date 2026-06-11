import { z } from 'zod';
import {
  CLEANROOM_GRADES, MONITORING_TYPES, UTILITY_TYPES, UTILITY_PARAMETERS,
  MONITORING_STATUSES, AREA_STATUSES, MONITORING_DEPARTMENTS,
} from './monitoring-mgmt-types';

export const areaCreateSchema = z.object({
  area_name: z.string().min(1, 'Area name required'),
  department: z.enum(MONITORING_DEPARTMENTS as unknown as [string, ...string[]]),
  room_number: z.string().default(''),
  cleanroom_grade: z.enum(CLEANROOM_GRADES as unknown as [string, ...string[]]).default('Grade D'),
  process_area: z.string().default(''),
  monitoring_required: z.boolean().default(true),
  temperature_limit_lower: z.coerce.number().nullable().optional(),
  temperature_limit_upper: z.coerce.number().nullable().optional(),
  rh_limit_lower: z.coerce.number().nullable().optional(),
  rh_limit_upper: z.coerce.number().nullable().optional(),
  dp_limit_lower: z.coerce.number().nullable().optional(),
  dp_limit_upper: z.coerce.number().nullable().optional(),
  area_status: z.enum(AREA_STATUSES as unknown as [string, ...string[]]).default('Active'),
  remarks: z.string().default(''),
});

export const environmentalSchema = z.object({
  area_doc_id: z.string().min(1),
  area_name: z.string().min(1),
  room_number: z.string().default(''),
  cleanroom_grade: z.string().default('Grade D'),
  product_name: z.string().default(''),
  batch_number: z.string().default(''),
  monitoring_type: z.enum(MONITORING_TYPES as unknown as [string, ...string[]]),
  parameter_name: z.string().min(1),
  monitoring_date: z.string().min(1),
  monitoring_time: z.string().default(''),
  observed_value: z.coerce.number(),
  lower_limit: z.coerce.number(),
  upper_limit: z.coerce.number(),
  unit: z.string().default(''),
  remarks: z.string().default(''),
});

export const utilitySchema = z.object({
  utility_type: z.enum(UTILITY_TYPES as unknown as [string, ...string[]]),
  sampling_point: z.string().min(1),
  parameter_name: z.enum(UTILITY_PARAMETERS as unknown as [string, ...string[]]),
  monitoring_date: z.string().min(1),
  monitoring_time: z.string().default(''),
  observed_value: z.coerce.number(),
  lower_limit: z.coerce.number(),
  upper_limit: z.coerce.number(),
  unit: z.string().default(''),
  remarks: z.string().default(''),
});

export const excursionCloseSchema = z.object({
  status: z.enum(['Closed'] as const),
  remarks: z.string().default(''),
});

export type AreaCreateInput = z.infer<typeof areaCreateSchema>;
export type EnvironmentalInput = z.infer<typeof environmentalSchema>;
export type UtilityInput = z.infer<typeof utilitySchema>;
export type ExcursionCloseInput = z.infer<typeof excursionCloseSchema>;
