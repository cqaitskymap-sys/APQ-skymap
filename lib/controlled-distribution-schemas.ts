import { z } from 'zod';
import { DISTRIBUTION_TYPES } from './controlled-distribution-types';

export const distributionCreateSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  document_version: z.string().min(1, 'Version is required'),
  distribution_type: z.enum(DISTRIBUTION_TYPES as unknown as [string, ...string[]]),
  distribution_group: z.string().optional(),
  department: z.string().optional(),
  site: z.string().optional(),
  plant: z.string().optional(),
  assigned_users: z.array(z.string()).default([]),
  assigned_user_names: z.array(z.string()).default([]),
  assigned_roles: z.array(z.string()).default([]),
  assigned_departments: z.array(z.string()).default([]),
  effective_date: z.string().min(1, 'Effective date is required'),
  expiry_date: z.string().nullable().optional(),
  distribution_date: z.string().nullable().optional(),
  acknowledgement_required: z.boolean().default(true),
  training_required: z.boolean().default(false),
  read_confirmation_required: z.boolean().default(false),
  reason: z.string().default(''),
  schedule_later: z.boolean().default(false),
}).superRefine((data, ctx) => {
  const hasTarget = data.assigned_users.length > 0
    || data.assigned_roles.length > 0
    || data.assigned_departments.length > 0
    || data.department
    || data.site
    || data.plant
    || data.distribution_type === 'Global';
  if (!hasTarget) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Distribution target is required', path: ['distribution_type'] });
  }
});

export const distributionBulkSchema = z.object({
  document_ids: z.array(z.string()).min(1, 'Select at least one document'),
  distribution_type: z.enum(DISTRIBUTION_TYPES as unknown as [string, ...string[]]),
  assigned_departments: z.array(z.string()).default([]),
  assigned_roles: z.array(z.string()).default([]),
  effective_date: z.string().min(1, 'Effective date is required'),
  acknowledgement_required: z.boolean().default(true),
  training_required: z.boolean().default(false),
  reason: z.string().default(''),
});

export const distributionWithdrawSchema = z.object({
  reason: z.string().min(1, 'Withdrawal reason is required'),
});

export type DistributionCreateInput = z.infer<typeof distributionCreateSchema>;
export type DistributionBulkInput = z.infer<typeof distributionBulkSchema>;

export function validateDocumentForDistribution(
  status: string,
  isLatest: boolean,
  version: string,
  requestedVersion: string,
): string | null {
  if (status !== 'effective') return 'Only Effective documents can be distributed';
  if (!isLatest) return 'Only the latest Effective version can be distributed';
  if (version !== requestedVersion) return 'Document version mismatch — refresh and select the current version';
  return null;
}
