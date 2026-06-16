import { z } from 'zod';
import { CAPA_CA_PRIORITIES, CAPA_CA_IMPLEMENTATION_STATUSES } from '@/lib/capa-types';

const priorityEnum = z.enum(CAPA_CA_PRIORITIES as unknown as [string, ...string[]]);
const implEnum = z.enum(CAPA_CA_IMPLEMENTATION_STATUSES as unknown as [string, ...string[]]);
const dateRequired = z.string().trim().min(1, 'Date is required');

export const capaCorrectiveActionSchema = z.object({
  capa_id: z.string().trim().min(1, 'CAPA ID is required'),
  root_cause_reference: z.string().trim().optional().default(''),
  corrective_action_description: z.string().trim().min(10, 'Corrective action description is required'),
  action_owner: z.string().trim().min(1, 'Action owner is required'),
  action_owner_name: z.string().trim().optional().default(''),
  department: z.string().trim().min(1, 'Department is required'),
  priority: priorityEnum,
  target_completion_date: dateRequired,
  verification_required: z.boolean().default(true),
  remarks: z.string().trim().optional().default(''),
}).superRefine((data, ctx) => {
  const created = new Date();
  const target = new Date(data.target_completion_date);
  created.setHours(0, 0, 0, 0);
  if (!Number.isNaN(target.getTime()) && target <= created) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Target completion date must be after action creation date',
      path: ['target_completion_date'],
    });
  }
});

export const capaCorrectiveActionImplementationSchema = z.object({
  implementation_status: implEnum,
  implementation_evidence: z.string().trim().min(5, 'Implementation evidence is required'),
  actual_completion_date: z.string().trim().optional().default(''),
});

export const capaCorrectiveActionVerificationSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  verification_comments: z.string().trim().min(3, 'Verification comments are required'),
  qa_review_comments: z.string().trim().optional().default(''),
});

export type CapaCorrectiveActionInput = z.infer<typeof capaCorrectiveActionSchema>;
export type CapaCorrectiveActionImplementationInput = z.infer<typeof capaCorrectiveActionImplementationSchema>;
export type CapaCorrectiveActionVerificationInput = z.infer<typeof capaCorrectiveActionVerificationSchema>;
