import { z } from 'zod';
import { REVISION_TYPES } from './document-version-control-types';

export const revisionCreateSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  revision_type: z.enum(REVISION_TYPES as unknown as [string, ...string[]]),
  revision_reason: z.string().min(1, 'Revision reason is required'),
  change_summary: z.string().min(1, 'Change summary is required'),
  change_control_id: z.string().nullable().optional(),
  effective_date: z.string().nullable().optional(),
  next_review_date: z.string().nullable().optional(),
  training_required: z.boolean().optional(),
  electronic_signature_required: z.boolean().default(false),
  review_required: z.boolean().default(true),
  approval_required: z.boolean().default(true),
});

export const rollbackSchema = z.object({
  target_version_id: z.string().min(1, 'Target version is required'),
  reason: z.string().min(1, 'Rollback reason is required'),
  approval_required: z.boolean().default(true),
});

export type RevisionCreateInput = z.infer<typeof revisionCreateSchema>;
export type RollbackInput = z.infer<typeof rollbackSchema>;

export function validateUniqueVersion(
  existingVersions: string[],
  newVersion: string,
): string | null {
  if (existingVersions.includes(newVersion)) return 'Version must be unique per document';
  return null;
}

export function validatePreviousVersionReference(
  revisionNumber: number,
  parentDocumentId: string | null,
): string | null {
  if (revisionNumber > 1 && !parentDocumentId) {
    return 'Previous version reference is required (except first version)';
  }
  return null;
}
