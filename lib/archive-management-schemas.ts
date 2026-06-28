import { z } from 'zod';
import { ARCHIVE_CATEGORIES, ARCHIVE_STATUSES, STORAGE_CLASSES, STORAGE_TIERS } from './archive-management-types';

const categoryEnum = z.enum(ARCHIVE_CATEGORIES as unknown as [string, ...string[]]);

export const createArchiveRequestSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  archive_reason: z.string().min(5, 'Archive reason is required'),
  archive_category: categoryEnum,
  retention_policy: z.string().min(1, 'Retention policy is required'),
  archive_location: z.string().min(1, 'Archive location is required'),
  storage_class: z.enum(STORAGE_CLASSES as unknown as [string, ...string[]]).default('Standard'),
  storage_tier: z.enum(STORAGE_TIERS as unknown as [string, ...string[]]).default('Primary'),
  electronic_signature_required: z.boolean().default(false),
  restoration_allowed: z.boolean().default(true),
  retention_years: z.number().min(1).max(99).default(7),
});

export const approveArchiveSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional().default(''),
});

export const restoreRequestSchema = z.object({
  restoration_reason: z.string().min(10, 'Restoration reason is required'),
});

export const approveRestoreSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional().default(''),
});

export const bulkArchiveSchema = z.object({
  document_ids: z.array(z.string()).min(1),
  archive_reason: z.string().min(5),
  archive_category: categoryEnum,
  retention_policy: z.string().min(1),
  archive_location: z.string().min(1),
});

export const applyHoldSchema = z.object({
  hold_type: z.enum(['legal', 'regulatory']),
  reason: z.string().min(5, 'Hold reason is required'),
});

export type CreateArchiveRequestInput = z.infer<typeof createArchiveRequestSchema>;
export type ApproveArchiveInput = z.infer<typeof approveArchiveSchema>;
export type RestoreRequestInput = z.infer<typeof restoreRequestSchema>;
export type ApproveRestoreInput = z.infer<typeof approveRestoreSchema>;
export type BulkArchiveInput = z.infer<typeof bulkArchiveSchema>;
export type ApplyHoldInput = z.infer<typeof applyHoldSchema>;
