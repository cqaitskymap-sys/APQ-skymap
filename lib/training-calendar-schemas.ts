import { z } from 'zod';
import {
  CALENDAR_TRAINING_TYPES, EVENT_STATUSES, CALENDAR_MODES, RECURRENCE_PATTERNS,
} from './training-calendar-types';

export const trainingEventSchema = z.object({
  training_title: z.string().min(1, 'Training title is required'),
  training_type: z.enum(CALENDAR_TRAINING_TYPES as unknown as [string, ...string[]]),
  department: z.string().min(1, 'Department is required'),
  trainer: z.string().min(1, 'Trainer is required'),
  trainer_id: z.string().nullable().optional(),
  room: z.string().default(''),
  room_id: z.string().nullable().optional(),
  virtual_meeting_link: z.string().default(''),
  mode: z.enum(CALENDAR_MODES as unknown as [string, ...string[]]).default('Classroom'),
  description: z.string().default(''),
  capacity: z.coerce.number().min(1, 'Capacity must be greater than 0'),
  assigned_employees: z.array(z.string()).default([]),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  time_zone: z.string().default('UTC'),
  recurring: z.boolean().default(false),
  recurrence_pattern: z.enum(RECURRENCE_PATTERNS as unknown as [string, ...string[]]).default('None'),
  reminder_schedule: z.array(z.string()).default(['7 days', '1 day']),
  assessment_required: z.boolean().default(false),
  certificate_issued: z.boolean().default(false),
  status: z.enum(EVENT_STATUSES as unknown as [string, ...string[]]).default('Draft'),
}).superRefine((data, ctx) => {
  if (data.end_date < data.start_date) {
    ctx.addIssue({ code: 'custom', message: 'End date must be on or after start date', path: ['end_date'] });
  }
  if (data.start_date === data.end_date && data.end_time <= data.start_time) {
    ctx.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['end_time'] });
  }
  if (data.assigned_employees.length > data.capacity) {
    ctx.addIssue({
      code: 'custom',
      message: `Assigned employees (${data.assigned_employees.length}) exceed capacity (${data.capacity})`,
      path: ['assigned_employees'],
    });
  }
});

export const trainingRoomSchema = z.object({
  room_code: z.string().min(1),
  room_name: z.string().min(1),
  location: z.string().default(''),
  capacity: z.coerce.number().min(1),
  equipment: z.string().default(''),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

export const trainerProfileSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  department: z.string().default(''),
  specializations: z.array(z.string()).default([]),
  max_sessions_per_day: z.coerce.number().min(1).default(4),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

export type TrainingEventInput = z.infer<typeof trainingEventSchema>;
export type TrainingRoomInput = z.infer<typeof trainingRoomSchema>;
export type TrainerProfileInput = z.infer<typeof trainerProfileSchema>;
