import { z } from 'zod';
import { HISTORY_STATUSES, HISTORY_TRAINING_TYPES } from './training-history-types';

export const historyFiltersSchema = z.object({
  department: z.string().optional(),
  employee_id: z.string().optional(),
  training_type: z.string().optional(),
  status: z.enum(HISTORY_STATUSES as unknown as [string, ...string[]]).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
});

export const historyViewSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
});

export type HistoryFiltersInput = z.infer<typeof historyFiltersSchema>;

export { HISTORY_STATUSES, HISTORY_TRAINING_TYPES };
