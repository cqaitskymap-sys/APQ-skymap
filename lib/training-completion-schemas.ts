import { z } from 'zod';
import { ATTENDANCE_STATUSES, TRAINING_MODES } from './training-completion-types';

export const markAttendanceSchema = z.object({
  assignment_id: z.string().min(1, 'Training assignment is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  training_date: z.string().min(1, 'Training date is required'),
  attendance_status: z.enum(ATTENDANCE_STATUSES as unknown as [string, ...string[]], {
    required_error: 'Attendance status is required',
  }),
  trainer: z.string().min(1, 'Trainer is required'),
  start_time: z.string().default('09:00'),
  end_time: z.string().default('17:00'),
  trainer_verified: z.boolean().default(false),
});

export const completeTrainingSchema = z.object({
  assignment_id: z.string().min(1, 'Training assignment is required'),
  employee_id: z.string().min(1, 'Employee is required'),
  training_date: z.string().min(1, 'Training date is required'),
  attendance_status: z.enum(ATTENDANCE_STATUSES as unknown as [string, ...string[]], {
    required_error: 'Attendance status is required',
  }),
  trainer: z.string().min(1, 'Trainer is required'),
  training_mode: z.enum(TRAINING_MODES as unknown as [string, ...string[]]).default('Classroom'),
  start_time: z.string().default('09:00'),
  end_time: z.string().default('17:00'),
  assessment_score: z.coerce.number().nullable().optional(),
  trainer_comments: z.string().default(''),
  employee_comments: z.string().default(''),
  completion_evidence: z.string().default(''),
  trainer_verified: z.boolean().default(false),
  assessment_required: z.boolean().default(false),
  pass_marks: z.number().default(80),
}).superRefine((data, ctx) => {
  if (data.attendance_status === 'Absent') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cannot complete training when absent', path: ['attendance_status'] });
  }
  if (data.assessment_required && (data.assessment_score == null || Number.isNaN(data.assessment_score))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Assessment score is required when assessment is required', path: ['assessment_score'] });
  }
});

export const qaReviewSchema = z.object({
  record_id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  remarks: z.string().default(''),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
export type CompleteTrainingInput = z.infer<typeof completeTrainingSchema>;
export type QaReviewInput = z.infer<typeof qaReviewSchema>;
