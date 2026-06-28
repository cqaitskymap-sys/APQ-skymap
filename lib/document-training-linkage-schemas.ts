import { z } from 'zod';
import {
  TRAINING_LINK_TYPES, ASSIGNMENT_METHODS, RETRAINING_TRIGGERS,
} from './document-training-linkage-types';

export const createTrainingLinkSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  training_type: z.enum(TRAINING_LINK_TYPES as unknown as [string, ...string[]]),
  training_program: z.string().min(1, 'Training program is required'),
  assignment_method: z.enum(ASSIGNMENT_METHODS as unknown as [string, ...string[]]).default('Automatic'),
  training_due_date: z.string().min(1, 'Due date is required'),
  department: z.string().optional().default(''),
  site: z.string().optional().default(''),
  business_unit: z.string().optional().default(''),
  qualification_required: z.boolean().default(false),
  competency_level: z.string().default('Competent'),
  employee_groups: z.array(z.string()).default([]),
  assigned_employees: z.array(z.string()).default([]),
  grace_period_days: z.number().min(0).default(7),
  retraining_required: z.boolean().default(true),
  retraining_trigger: z.enum(RETRAINING_TRIGGERS as unknown as [string, ...string[]]).default('Major Revision'),
  assessment_required: z.boolean().default(true),
  passing_score: z.number().min(0).max(100).default(80),
  electronic_signature_required: z.boolean().default(false),
  acknowledgement_required: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.assignment_method === 'Manual' && !data.assigned_employees.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Employee assignment required for manual method', path: ['assigned_employees'] });
  }
  if (data.assessment_required && data.passing_score <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Passing score required when assessment enabled', path: ['passing_score'] });
  }
});

export const retrainingSchema = z.object({
  link_id: z.string().min(1),
  trigger: z.enum(RETRAINING_TRIGGERS as unknown as [string, ...string[]]),
  due_date: z.string().min(1, 'Due date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

export const bulkAssignSchema = z.object({
  link_ids: z.array(z.string()).min(1),
  due_date: z.string().optional(),
});

export type CreateTrainingLinkInput = z.infer<typeof createTrainingLinkSchema>;
export type RetrainingInput = z.infer<typeof retrainingSchema>;
export type BulkAssignInput = z.infer<typeof bulkAssignSchema>;
