import { z } from 'zod';
import { TRAINING_TYPES, TRAINING_CATEGORIES, TMS_DEPARTMENTS, ASSESSMENT_TYPES, EFFECTIVENESS_RESULTS, COMPETENCY_LEVELS } from './training-types';

export const trainingMasterSchema = z.object({
  training_title: z.string().min(1, 'Training title is required'),
  training_type: z.enum(TRAINING_TYPES as unknown as [string, ...string[]], { required_error: 'Training type is required' }),
  department: z.enum(TMS_DEPARTMENTS as unknown as [string, ...string[]]),
  category: z.enum(TRAINING_CATEGORIES as unknown as [string, ...string[]]).default('Initial'),
  training_duration: z.string().default(''),
  trainer_name: z.string().min(1, 'Trainer name is required'),
  training_material: z.string().default(''),
  assessment_required: z.boolean().default(true),
  passing_percentage: z.coerce.number().min(0).max(100).default(80),
  retraining_frequency: z.string().default('Annual'),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  linked_document_id: z.string().nullable().optional(),
  linked_capa_id: z.string().nullable().optional(),
  linked_change_control_id: z.string().nullable().optional(),
});

export const assignmentSchema = z.object({
  training_master_id: z.string().min(1, 'Training is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  employee_name: z.string().min(1),
  department: z.string().min(1),
  designation: z.string().default(''),
  assigned_date: z.string().min(1),
  due_date: z.string().min(1),
  trainer_name: z.string().default(''),
});

export const questionSchema = z.object({
  training_master_id: z.string().min(1),
  question: z.string().min(1, 'Question is required'),
  options: z.array(z.string()).min(2, 'At least 2 options required'),
  correct_answer: z.string().min(1, 'Correct answer is required'),
  marks: z.coerce.number().min(1).default(1),
  assessment_type: z.enum(ASSESSMENT_TYPES as unknown as [string, ...string[]]).default('MCQ'),
});

export const assessmentSubmitSchema = z.object({
  assignment_id: z.string().min(1),
  answers: z.record(z.string()),
});

export const effectivenessSchema = z.object({
  assignment_id: z.string().min(1),
  assessment_score: z.coerce.number().nullable().optional(),
  practical_observation: z.string().default(''),
  supervisor_feedback: z.string().default(''),
  effectiveness_result: z.enum(EFFECTIVENESS_RESULTS as unknown as [string, ...string[]]),
});

export const competencySchema = z.object({
  employee_id: z.string().min(1),
  employee_name: z.string().min(1),
  department: z.string().min(1),
  skill: z.string().min(1, 'Skill is required'),
  required_level: z.enum(COMPETENCY_LEVELS as unknown as [string, ...string[]]),
  current_level: z.enum(COMPETENCY_LEVELS as unknown as [string, ...string[]]),
  training_required: z.boolean().default(false),
});

export const scheduleSchema = z.object({
  training_master_id: z.string().min(1),
  scheduled_date: z.string().min(1),
  department: z.string().min(1),
  trainer_name: z.string().default(''),
  notes: z.string().default(''),
});

export type TrainingMasterInput = z.infer<typeof trainingMasterSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type EffectivenessInput = z.infer<typeof effectivenessSchema>;
export type CompetencyInput = z.infer<typeof competencySchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
