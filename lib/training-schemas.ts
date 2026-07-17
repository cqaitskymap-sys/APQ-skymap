import { z } from 'zod';
import {
  TRAINING_TYPES, TRAINING_CATEGORIES, TMS_DEPARTMENTS, ASSESSMENT_TYPES,
  EFFECTIVENESS_RESULTS, COMPETENCY_LEVELS, ATTENDANCE_STATUSES, TRAINING_MODES,
  ASSIGNMENT_TRAINING_MODES, MATRIX_FREQUENCIES, MATRIX_STATUSES,
} from './training-types';

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
  effectiveness_required: z.boolean().default(false),
});

export const assignmentSchema = z.object({
  training_master_id: z.string().min(1, 'Training topic is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  employee_name: z.string().min(1),
  department: z.string().min(1),
  designation: z.string().default(''),
  training_topic: z.string().optional(),
  training_type: z.string().optional(),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  trainer_name: z.string().default(''),
  training_mode: z.enum(ASSIGNMENT_TRAINING_MODES as unknown as [string, ...string[]]).default('Classroom'),
  effectiveness_required: z.boolean().default(false),
  effectiveness_due_date: z.string().nullable().optional(),
  remarks: z.string().default(''),
  scheduled_date: z.string().nullable().optional(),
  scheduled_time: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.due_date && data.assigned_date && data.due_date <= data.assigned_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Due date must be after assigned date',
      path: ['due_date'],
    });
  }
});

export const bulkAssignmentSchema = z.object({
  training_master_id: z.string().min(1, 'Training is required'),
  employee_ids: z.array(z.string()).min(1, 'Select at least one employee'),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  trainer_name: z.string().default(''),
  training_mode: z.enum(ASSIGNMENT_TRAINING_MODES as unknown as [string, ...string[]]).default('Classroom'),
  remarks: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.due_date <= data.assigned_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Due date must be after assigned date',
      path: ['due_date'],
    });
  }
});

export const departmentAssignmentSchema = z.object({
  training_master_id: z.string().min(1, 'Training is required'),
  department: z.string().min(1, 'Department is required'),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  trainer_name: z.string().default(''),
  training_mode: z.enum(ASSIGNMENT_TRAINING_MODES as unknown as [string, ...string[]]).default('Classroom'),
  remarks: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.due_date <= data.assigned_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Due date must be after assigned date',
      path: ['due_date'],
    });
  }
});

export const scheduleSessionSchema = z.object({
  training_master_id: z.string().min(1, 'Training is required'),
  department: z.string().min(1, 'Department is required'),
  scheduled_date: z.string().min(1, 'Schedule date is required'),
  scheduled_time: z.string().min(1, 'Schedule time is required'),
  trainer_name: z.string().default(''),
  training_mode: z.enum(ASSIGNMENT_TRAINING_MODES as unknown as [string, ...string[]]).default('Classroom'),
  employee_ids: z.array(z.string()).min(1, 'Select at least one employee'),
  due_date: z.string().min(1, 'Due date is required'),
  notes: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.due_date <= data.scheduled_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Due date must be after scheduled date',
      path: ['due_date'],
    });
  }
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

export const attendanceSchema = z.object({
  assignment_id: z.string().min(1, 'Training assignment is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  training_date: z.string().min(1, 'Training date is required'),
  attendance_status: z.enum(ATTENDANCE_STATUSES as unknown as [string, ...string[]], {
    required_error: 'Attendance status is required',
  }),
  trainer: z.string().min(1, 'Trainer is required'),
  start_time: z.string().default(''),
  end_time: z.string().default(''),
  trainer_verified: z.boolean().default(false),
});

export const completionSchema = z.object({
  assignment_id: z.string().min(1, 'Training assignment is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  training_date: z.string().min(1, 'Training date is required'),
  attendance_status: z.enum(ATTENDANCE_STATUSES as unknown as [string, ...string[]], {
    required_error: 'Attendance status is required',
  }),
  trainer: z.string().min(1, 'Trainer is required'),
  training_mode: z.enum(TRAINING_MODES as unknown as [string, ...string[]]).default('Classroom'),
  start_time: z.string().default(''),
  end_time: z.string().default(''),
  assessment_score: z.coerce.number().min(0, 'Assessment score cannot be negative').max(100, 'Assessment score cannot exceed 100').nullable().optional(),
  trainer_comments: z.string().default(''),
  employee_comments: z.string().default(''),
  completion_evidence: z.string().default(''),
  trainer_verified: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (!data.trainer_verified) {
    ctx.addIssue({ code: 'custom', message: 'Trainer verification is required', path: ['trainer_verified'] });
  }
  if (data.end_time && data.start_time && data.end_time <= data.start_time) {
    ctx.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['end_time'] });
  }
});

export type TrainingMasterInput = z.input<typeof trainingMasterSchema>;
export type AssignmentInput = z.input<typeof assignmentSchema>;
export type BulkAssignmentInput = z.infer<typeof bulkAssignmentSchema>;
export type DepartmentAssignmentInput = z.infer<typeof departmentAssignmentSchema>;
export type ScheduleSessionInput = z.infer<typeof scheduleSessionSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type EffectivenessInput = z.infer<typeof effectivenessSchema>;
export type CompetencyInput = z.infer<typeof competencySchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type CompletionInput = z.infer<typeof completionSchema>;

export const matrixDefinitionSchema = z.object({
  department: z.string().min(1, 'Department is required'),
  designation: z.string().min(1, 'Designation is required'),
  role: z.string().default(''),
  training_topic: z.string().min(1, 'Training topic is required'),
  training_type: z.enum(TRAINING_TYPES as unknown as [string, ...string[]], { required_error: 'Training type is required' }),
  document_number: z.string().default(''),
  document_title: z.string().default(''),
  sop_number: z.string().default(''),
  sop_version: z.string().default(''),
  training_required: z.boolean().default(true),
  training_frequency: z.enum(MATRIX_FREQUENCIES as unknown as [string, ...string[]], { required_error: 'Training frequency is required' }),
  initial_training_required: z.boolean().default(true),
  refresher_required: z.boolean().default(false),
  effectiveness_required: z.boolean().default(false),
  trainer_role: z.string().default('QA Trainer'),
  training_duration: z.string().default(''),
  due_days_after_assignment: z.coerce.number().min(1).default(30),
  status: z.enum(MATRIX_STATUSES as unknown as [string, ...string[]]).default('Active'),
  linked_document_id: z.string().nullable().optional(),
  linked_training_master_id: z.string().nullable().optional(),
  skill: z.string().default(''),
});

export type MatrixDefinitionInput = z.input<typeof matrixDefinitionSchema>;
