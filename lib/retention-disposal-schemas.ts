import { z } from 'zod';
import {
  RETENTION_TRIGGERS, RETENTION_UNITS, DISPOSAL_METHODS,
} from './retention-disposal-types';

export const createRetentionPolicySchema = z.object({
  policy_name: z.string().min(3, 'Policy name is required'),
  description: z.string().min(5, 'Description is required'),
  document_type: z.string().min(1, 'Document type is required'),
  document_category: z.string().optional().default(''),
  department: z.string().min(1, 'Department is required'),
  business_unit: z.string().optional().default(''),
  site: z.string().optional().default(''),
  applicable_regulations: z.array(z.string()).default(['21 CFR Part 11', 'EU GMP Chapter 4']),
  retention_trigger: z.enum(RETENTION_TRIGGERS as unknown as [string, ...string[]]),
  retention_period: z.number().min(1, 'Retention period is required'),
  retention_unit: z.enum(RETENTION_UNITS as unknown as [string, ...string[]]),
  archive_required: z.boolean().default(true),
  disposal_method: z.enum(DISPOSAL_METHODS as unknown as [string, ...string[]]),
  legal_hold_allowed: z.boolean().default(true),
  regulatory_hold_allowed: z.boolean().default(true),
  approval_workflow: z.string().default('QA Approval'),
  effective_date: z.string().min(1, 'Effective date is required'),
  review_frequency: z.string().default('Annual'),
  owner_name: z.string().min(1, 'Owner is required'),
});

export const createDisposalRequestSchema = z.object({
  schedule_id: z.string().min(1, 'Schedule is required'),
  disposal_method: z.enum(DISPOSAL_METHODS as unknown as [string, ...string[]]),
  disposal_reason: z.string().min(10, 'Disposal reason is required'),
  electronic_signature_required: z.boolean().default(true),
});

export const approveDisposalSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional().default(''),
});

export const applyHoldSchema = z.object({
  hold_type: z.enum(['legal', 'regulatory']),
  reason: z.string().min(5, 'Hold reason is required'),
  schedule_id: z.string().min(1),
  document_id: z.string().min(1),
});

export const releaseHoldSchema = z.object({
  hold_type: z.enum(['legal', 'regulatory']),
  reason: z.string().min(5, 'Release reason is required'),
  hold_id: z.string().min(1),
});

export const bulkAssignRetentionSchema = z.object({
  document_ids: z.array(z.string()).min(1),
  policy_id: z.string().min(1, 'Retention policy is required'),
});

export type CreateRetentionPolicyInput = z.infer<typeof createRetentionPolicySchema>;
export type CreateDisposalRequestInput = z.infer<typeof createDisposalRequestSchema>;
export type ApproveDisposalInput = z.infer<typeof approveDisposalSchema>;
export type ApplyHoldInput = z.infer<typeof applyHoldSchema>;
export type ReleaseHoldInput = z.infer<typeof releaseHoldSchema>;
export type BulkAssignRetentionInput = z.infer<typeof bulkAssignRetentionSchema>;
