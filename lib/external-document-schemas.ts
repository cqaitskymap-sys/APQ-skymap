import { z } from 'zod';
import {
  EXTERNAL_DOC_TYPES, EXTERNAL_DOC_CATEGORIES, REVIEW_FREQUENCIES, RISK_CLASSIFICATIONS,
} from './external-document-types';

export const registerExternalDocumentSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  short_title: z.string().optional().default(''),
  external_reference_number: z.string().optional().default(''),
  document_type: z.enum(EXTERNAL_DOC_TYPES as unknown as [string, ...string[]]),
  document_category: z.enum(EXTERNAL_DOC_CATEGORIES as unknown as [string, ...string[]]),
  source_organization: z.string().min(2, 'Source organization is required'),
  source_contact: z.string().optional().default(''),
  source_url: z.string().optional().default(''),
  issuing_authority: z.string().optional().default(''),
  publication_date: z.string().optional().nullable(),
  revision_number: z.string().default('1.0'),
  revision_date: z.string().optional().nullable(),
  language: z.string().default('English'),
  country_region: z.string().optional().default(''),
  department_owner: z.string().min(1, 'Owner department is required'),
  business_unit: z.string().optional().default(''),
  site: z.string().optional().default(''),
  risk_classification: z.enum(RISK_CLASSIFICATIONS as unknown as [string, ...string[]]).default('Medium'),
  criticality: z.string().default('Normal'),
  review_frequency: z.enum(REVIEW_FREQUENCIES as unknown as [string, ...string[]]),
  owner_name: z.string().min(1, 'Owner is required'),
  supplier: z.string().optional().default(''),
  manufacturer: z.string().optional().default(''),
  effective_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  approval_required: z.boolean().default(true),
  distribution_required: z.boolean().default(false),
  training_required: z.boolean().default(false),
  electronic_signature_required: z.boolean().default(false),
});

export const approveExternalDocumentSchema = z.object({
  signature_meaning: z.string().optional(),
  comments: z.string().optional().default(''),
});

export const linkInternalDocumentSchema = z.object({
  external_document_id: z.string().min(1),
  internal_document_id: z.string().min(1),
  link_type: z.string().default('Reference'),
});

export const bulkReviewAssignSchema = z.object({
  document_ids: z.array(z.string()).min(1),
  reviewer_id: z.string().min(1),
  reviewer_name: z.string().min(1),
  review_due_date: z.string().min(1),
});

export const newVersionSchema = z.object({
  revision_number: z.string().min(1),
  revision_date: z.string().min(1),
  change_summary: z.string().min(5),
});

export type RegisterExternalDocumentInput = z.infer<typeof registerExternalDocumentSchema>;
export type ApproveExternalDocumentInput = z.infer<typeof approveExternalDocumentSchema>;
export type LinkInternalDocumentInput = z.infer<typeof linkInternalDocumentSchema>;
export type BulkReviewAssignInput = z.infer<typeof bulkReviewAssignSchema>;
export type NewVersionInput = z.infer<typeof newVersionSchema>;
