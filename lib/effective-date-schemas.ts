import { z } from 'zod';
import { ACTIVATION_METHODS } from './effective-date-types';

export const scheduleEffectiveDateSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  version: z.string().min(1, 'Version is required'),
  effective_date: z.string().min(1, 'Effective date is required'),
  activation_time: z.string().min(1, 'Activation time is required'),
  time_zone: z.string().default('UTC'),
  activation_method: z.enum(ACTIVATION_METHODS as unknown as [string, ...string[]]).default('Scheduled'),
  training_required: z.boolean().default(false),
  reason: z.string().default(''),
}).superRefine((data, ctx) => {
  if (data.effective_date && data.activation_time) {
    const eff = new Date(`${data.effective_date}T${data.activation_time}`);
    if (Number.isNaN(eff.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid activation date/time', path: ['activation_time'] });
    }
  }
});

export const rollbackSchema = z.object({
  reason: z.string().min(1, 'Rollback reason is required'),
});

export const overrideActivationSchema = z.object({
  reason: z.string().min(1, 'Override reason is required for QA approval'),
});

export type ScheduleEffectiveDateInput = z.infer<typeof scheduleEffectiveDateSchema>;
export type RollbackInput = z.infer<typeof rollbackSchema>;
export type OverrideActivationInput = z.infer<typeof overrideActivationSchema>;
