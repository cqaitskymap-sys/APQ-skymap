import { z } from 'zod';
import { RETRAINING_STATUSES, RETRAINING_TRIGGER_TYPES } from './training-retraining-types';

export const createRetrainingSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  employee_name: z.string().min(1),
  department: z.string().min(1),
  designation: z.string().default(''),
  training_topic: z.string().min(1, 'Training topic is required'),
  training_type: z.string().default('GMP Training'),
  original_training_id: z.string().default(''),
  original_completion_date: z.string().nullable().optional(),
  trigger_type: z.enum(RETRAINING_TRIGGER_TYPES as unknown as [string, ...string[]], { message: 'Trigger type is required' }),
  trigger_reference: z.string().default(''),
  document_number: z.string().default(''),
  document_version: z.string().default(''),
  sop_number: z.string().default(''),
  reason: z.string().default(''),
  assigned_date: z.string().optional(),
  due_date: z.string().min(1, 'Due date is required'),
  trainer: z.string().min(1, 'Trainer is required'),
  training_mode: z.string().default('Classroom'),
  assessment_required: z.boolean().default(true),
  passing_score: z.number().default(80),
  remarks: z.string().default(''),
});

export const scheduleRetrainingSchema = z.object({
  retraining_id: z.string().min(1),
  scheduled_event_id: z.string().optional(),
  trainer: z.string().optional(),
  training_mode: z.string().optional(),
});

export const completeRetrainingSchema = z.object({
  retraining_id: z.string().min(1),
  obtained_score: z.number().nullable().optional(),
  result: z.string().default('Pass'),
  competency_status: z.string().default('Competent'),
  certificate_number: z.string().nullable().optional(),
  remarks: z.string().default(''),
});

export const bulkAssignRetrainingSchema = z.object({
  employee_ids: z.array(z.string()).min(1),
  training_topic: z.string().min(1),
  training_type: z.string().default('GMP Training'),
  trigger_type: z.enum(RETRAINING_TRIGGER_TYPES as unknown as [string, ...string[]]),
  trigger_reference: z.string().default(''),
  due_date: z.string().min(1),
  trainer: z.string().min(1),
  reason: z.string().default(''),
});

export type CreateRetrainingInput = z.input<typeof createRetrainingSchema>;
export type ScheduleRetrainingInput = z.infer<typeof scheduleRetrainingSchema>;
export type CompleteRetrainingInput = z.infer<typeof completeRetrainingSchema>;
export type BulkAssignRetrainingInput = z.infer<typeof bulkAssignRetrainingSchema>;

export { RETRAINING_STATUSES, RETRAINING_TRIGGER_TYPES };
