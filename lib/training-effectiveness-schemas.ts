import { z } from 'zod';
import {
  EVALUATION_TYPES, EVALUATION_METHODS, COMPETENCY_EVAL_LEVELS, EVALUATION_RESULTS, EVALUATION_STATUSES,
} from './training-effectiveness-types';

export const createEvaluationSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  employee_name: z.string().min(1),
  department: z.string().min(1),
  designation: z.string().default(''),
  training_record_id: z.string().min(1, 'Training record is required'),
  assignment_id: z.string().default(''),
  training_topic: z.string().min(1),
  document_number: z.string().default(''),
  sop_version: z.string().default(''),
  evaluation_type: z.enum(EVALUATION_TYPES as unknown as [string, ...string[]]).default('Written Test'),
  evaluator: z.string().min(1, 'Evaluator is required'),
  evaluation_date: z.string().min(1, 'Evaluation date is required'),
  method: z.enum(EVALUATION_METHODS as unknown as [string, ...string[]]).default('Assessment'),
  passing_score: z.number().min(0, 'Passing score is required'),
  obtained_score: z.number({ required_error: 'Obtained score is required' }),
  observation: z.string().default(''),
  practical_observation: z.string().default(''),
  supervisor_feedback: z.string().default(''),
  corrective_action: z.string().default(''),
  reassessment_required: z.boolean().default(false),
  reassessment_date: z.string().nullable().optional(),
  remarks: z.string().default(''),
});

export const approveEvaluationSchema = z.object({
  evaluation_id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  remarks: z.string().default(''),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type ApproveEvaluationInput = z.infer<typeof approveEvaluationSchema>;

export { EVALUATION_TYPES, EVALUATION_METHODS, COMPETENCY_EVAL_LEVELS, EVALUATION_RESULTS, EVALUATION_STATUSES };
