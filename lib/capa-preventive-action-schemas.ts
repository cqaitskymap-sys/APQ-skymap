import { z } from 'zod';
import { CAPA_CA_PRIORITIES, CAPA_CA_IMPLEMENTATION_STATUSES, CAPA_PA_RISK_LEVELS } from '@/lib/capa-types';

const priorityEnum = z.enum(CAPA_CA_PRIORITIES as unknown as [string, ...string[]]);
const riskEnum = z.enum(CAPA_PA_RISK_LEVELS as unknown as [string, ...string[]]);
const implEnum = z.enum(CAPA_CA_IMPLEMENTATION_STATUSES as unknown as [string, ...string[]]);
const dateRequired = z.string().trim().min(1, 'Date is required');

export const capaPreventiveActionSchema = z.object({
  capa_id: z.string().trim().min(1, 'CAPA ID is required'),
  risk_reference: z.string().trim().optional().default(''),
  root_cause_reference: z.string().trim().optional().default(''),
  preventive_action_description: z.string().trim().min(10, 'Preventive action description is required'),
  objective: z.string().trim().min(5, 'Objective is required'),
  expected_outcome: z.string().trim().optional().default(''),
  action_owner: z.string().trim().min(1, 'Action owner is required'),
  action_owner_name: z.string().trim().optional().default(''),
  department: z.string().trim().min(1, 'Department is required'),
  priority: priorityEnum,
  risk_level: riskEnum.default('medium'),
  target_completion_date: dateRequired,
  training_required: z.boolean().default(false),
  sop_revision_required: z.boolean().default(false),
  change_control_required: z.boolean().default(false),
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

export const capaPreventiveActionImplementationSchema = z.object({
  implementation_status: implEnum,
  implementation_evidence: z.string().trim().min(5, 'Implementation evidence is required'),
  actual_completion_date: z.string().trim().optional().default(''),
});

export const capaPreventiveActionVerificationSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  verification_comments: z.string().trim().min(3, 'Verification comments are required'),
  qa_review_comments: z.string().trim().optional().default(''),
});

export const capaPreventiveActionLinkSchema = z.object({
  reference: z.string().trim().min(1, 'Reference is required'),
  record_id: z.string().trim().optional().default(''),
});

export type CapaPreventiveActionInput = z.infer<typeof capaPreventiveActionSchema>;
export type CapaPreventiveActionImplementationInput = z.infer<typeof capaPreventiveActionImplementationSchema>;
export type CapaPreventiveActionVerificationInput = z.infer<typeof capaPreventiveActionVerificationSchema>;
export type CapaPreventiveActionLinkInput = z.infer<typeof capaPreventiveActionLinkSchema>;
