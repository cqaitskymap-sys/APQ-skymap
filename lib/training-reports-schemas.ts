import { z } from 'zod';
import { TRAINING_REPORT_TYPES, TRAINING_REPORT_FREQUENCIES } from './training-reports-records';

export const trainingReportFilterSchema = z.object({
  report_type: z.enum(TRAINING_REPORT_TYPES as unknown as [string, ...string[]]),
  date_from: z.string().min(1),
  date_to: z.string().min(1),
  department: z.string().optional(),
  employee_id: z.string().optional(),
  designation: z.string().optional(),
  training_type: z.string().optional(),
  trainer: z.string().optional(),
  status: z.string().optional(),
  training_mode: z.string().optional(),
  certificate_status: z.string().optional(),
  assessment_result: z.string().optional(),
  search: z.string().optional(),
});

export const trainingReportScheduleSchema = z.object({
  report_type: z.enum(TRAINING_REPORT_TYPES as unknown as [string, ...string[]]),
  frequency: z.enum(TRAINING_REPORT_FREQUENCIES as unknown as [string, ...string[]]),
  email_to: z.string().email().optional().or(z.literal('')),
  filters: trainingReportFilterSchema.partial().optional(),
});

export const trainingReportTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  report_type: z.enum(TRAINING_REPORT_TYPES as unknown as [string, ...string[]]),
  filters: trainingReportFilterSchema.partial(),
});

export type TrainingReportFilterInput = z.infer<typeof trainingReportFilterSchema>;
export type TrainingReportScheduleInput = z.infer<typeof trainingReportScheduleSchema>;
export type TrainingReportTemplateInput = z.infer<typeof trainingReportTemplateSchema>;
