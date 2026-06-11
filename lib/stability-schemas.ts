import { z } from 'zod';
import {
  STUDY_TYPES, STORAGE_CONDITIONS, STUDY_STATUSES, SAMPLE_PULL_STATUSES,
  STABILITY_PARAMETERS, RESULT_STATUSES, TESTING_INTERVALS,
} from './stability-types';

export const studyCreateSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  generic_name: z.string().optional().default(''),
  strength: z.string().min(1, 'Strength is required'),
  dosage_form: z.string().min(1, 'Dosage form is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  batch_size: z.string().optional().default(''),
  manufacturing_date: z.string().min(1, 'Manufacturing date is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  study_type: z.enum(STUDY_TYPES as unknown as [string, ...string[]]),
  storage_condition: z.enum(STORAGE_CONDITIONS as unknown as [string, ...string[]]),
  market: z.string().optional().default('Domestic'),
  protocol_number: z.string().min(1, 'Protocol number is required'),
  protocol_version: z.string().min(1, 'Protocol version is required'),
  study_initiation_date: z.string().min(1, 'Study initiation date is required'),
  study_end_date: z.string().optional().nullable(),
  remarks: z.string().optional().default(''),
});

export const samplePullSchema = z.object({
  interval: z.string().min(1, 'Interval is required'),
  pulling_due_date: z.string().min(1, 'Due date is required'),
  actual_pulling_date: z.string().optional().nullable(),
  sample_quantity: z.string().min(1, 'Sample quantity is required'),
  pulled_by_name: z.string().min(1, 'Pulled by is required'),
  checked_by_name: z.string().min(1, 'Checked by is required'),
  status: z.enum(SAMPLE_PULL_STATUSES as unknown as [string, ...string[]]).default('Pending'),
  remarks: z.string().optional().default(''),
});

export const resultEntrySchema = z.object({
  interval: z.string().min(1, 'Interval is required'),
  test_date: z.string().min(1, 'Test date is required'),
  parameter_name: z.enum(STABILITY_PARAMETERS as unknown as [string, ...string[]]),
  specification: z.string().min(1, 'Specification is required'),
  spec_lower_limit: z.coerce.number().optional().nullable(),
  spec_upper_limit: z.coerce.number().optional().nullable(),
  observed_result: z.union([z.coerce.number(), z.string()]),
  unit: z.string().optional().default(''),
  analyst_name: z.string().min(1, 'Analyst is required'),
  reviewed_by_name: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
});

export const stabilityApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5, 'Comments are required'),
  e_signature: z.string().min(3, 'E-signature required'),
});

export type StudyCreateInput = z.infer<typeof studyCreateSchema>;
export type SamplePullInput = z.infer<typeof samplePullSchema>;
export type ResultEntryInput = z.infer<typeof resultEntrySchema>;
export type StabilityApprovalInput = z.infer<typeof stabilityApprovalSchema>;

export {
  STUDY_TYPES, STORAGE_CONDITIONS, STUDY_STATUSES, SAMPLE_PULL_STATUSES,
  STABILITY_PARAMETERS, RESULT_STATUSES, TESTING_INTERVALS,
};
