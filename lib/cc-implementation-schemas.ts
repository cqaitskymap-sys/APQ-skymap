import { z } from 'zod';
import {
  CC_IMPL_PRIORITIES,
  CC_IMPL_TASK_CATEGORIES,
} from '@/lib/change-control-types';

export const ccImplementationPlanSchema = z.object({
  change_id: z.string().min(1, 'Change Control ID is required'),
  implementation_title: z.string().trim().min(3, 'Implementation title is required'),
  implementation_description: z.string().optional().default(''),
  implementation_owner: z.string().min(1, 'Implementation owner is required'),
  implementation_owner_name: z.string().optional().default(''),
  department: z.string().min(1, 'Department is required'),
  planned_start_date: z.string().min(1, 'Planned start date is required'),
  planned_end_date: z.string().min(1, 'Planned end date is required'),
  validation_required: z.boolean().default(false),
  training_required: z.boolean().default(false),
  document_revision_required: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  overall_remarks: z.string().optional().default(''),
}).refine((d) => {
  const from = new Date(d.planned_start_date);
  const to = new Date(d.planned_end_date);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from;
}, { message: 'End date must be after start date', path: ['planned_end_date'] });

export const ccImplementationTaskSchema = z.object({
  change_id: z.string().min(1),
  plan_id: z.string().optional(),
  task_title: z.string().trim().min(3, 'Task title is required'),
  task_description: z.string().optional().default(''),
  task_category: z.enum(CC_IMPL_TASK_CATEGORIES as unknown as [string, ...string[]]),
  assigned_to: z.string().min(1, 'Assigned user is required'),
  assigned_to_name: z.string().optional().default(''),
  department: z.string().min(1),
  priority: z.enum(CC_IMPL_PRIORITIES as unknown as [string, ...string[]]).default('Medium'),
  dependency_task_id: z.string().nullable().optional(),
  planned_start_date: z.string().min(1),
  planned_end_date: z.string().min(1),
  remarks: z.string().optional().default(''),
  is_mandatory: z.boolean().optional().default(false),
}).refine((d) => {
  const from = new Date(d.planned_start_date);
  const to = new Date(d.planned_end_date);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to >= from;
}, { message: 'End date must be after start date', path: ['planned_end_date'] });

export const ccImplementationQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().trim().min(10, 'QA comments are required'),
});

export type CcImplementationPlanInput = z.infer<typeof ccImplementationPlanSchema>;
export type CcImplementationTaskInput = z.infer<typeof ccImplementationTaskSchema>;
