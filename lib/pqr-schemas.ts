import { z } from 'zod';

export const compositionRowSchema = z.object({
  ingredient_name: z.string().min(1, 'Ingredient name required'),
  grade: z.string().default(''),
  equivalent_claim: z.string().default(''),
  quantity: z.string().default(''),
  unit: z.string().default(''),
  purpose: z.string().default(''),
  sort_order: z.number().default(0),
});

export const brandNameSchema = z.object({
  brand_name: z.string().min(1, 'Brand name required'),
});

export const pqrApprovalSchema = z.object({
  approval_type: z.enum(['prepared', 'reviewed', 'approved']),
  designation: z.string().min(1, 'Designation required'),
  name: z.string().default(''),
  signature_url: z.string().default(''),
  signature_text: z.string().default(''),
  approval_date: z.string().nullable().default(null),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  remarks: z.string().default(''),
});

export const revisionRowSchema = z.object({
  revision_no: z.string().min(1, 'Revision number required'),
  change_control_no: z.string().default('Not Applicable'),
  details_of_changes: z.string().default('Not Applicable'),
  reason_of_changes: z.string().default('New PQR'),
  effective_date: z.string().nullable().default(null),
  is_locked: z.boolean().default(false),
});

export const abbreviationSchema = z.object({
  abbreviation: z.string().min(1, 'Abbreviation required'),
  full_form: z.string().min(1, 'Full form required'),
  description: z.string().default(''),
  is_active: z.boolean().default(true),
});

export const pqrDocumentSchema = z.object({
  company_name: z.string().min(1, 'Company name required'),
  site_name: z.string().default(''),
  address: z.string().default(''),
  document_title: z.string().min(1, 'Document title required'),
  product_name: z.string().min(1, 'Product name required'),
  pqr_number: z.string().min(1, 'PQR number required'),
  page_number: z.string().default('1'),
  revision_number: z.string().min(1, 'Revision number required').default('00'),
  format_number: z.string().default(''),
  product_code: z.string().default(''),
  review_period_from: z.string().min(1, 'Review start date required'),
  review_period_to: z.string().min(1, 'Review end date required'),
  total_batches_manufactured: z.number().default(0),
  total_released_batches: z.number().default(0),
  total_rejected_batches: z.number().default(0),
  total_reworked_batches: z.number().default(0),
  total_reprocessed_batches: z.number().default(0),
  pqr_year: z.number().nullable().default(null),
  document_status: z.enum(['draft', 'under_review', 'approved', 'rejected', 'archived']).default('draft'),
  review_frequency: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']).default('yearly'),
  current_revision: z.string().default('00'),
  previous_revision: z.string().default(''),
  next_review_due_date: z.string().nullable().default(null),
  document_owner_department: z.string().default('Quality Assurance'),
  effective_date: z.string().nullable().default(null),
  prepared_date: z.string().nullable().default(null),
  company_logo_url: z.string().default(''),
  observations: z.string().default(''),
  conclusions: z.string().default(''),
  recommendations: z.string().default(''),
  overall_compliance: z.enum(['satisfactory', 'needs_improvement', 'unsatisfactory']).default('satisfactory'),
}).refine(
  (data) => {
    if (data.review_period_from && data.review_period_to) {
      return new Date(data.review_period_to) > new Date(data.review_period_from);
    }
    return true;
  },
  { message: 'Review period end must be after start', path: ['review_period_to'] }
);

export const productMasterSchema = z.object({
  generic_name: z.string().min(1, 'Generic name required'),
  product_name: z.string().min(1, 'Product name required'),
  strength: z.string().min(1, 'Strength required'),
  shelf_life: z.string().default(''),
  standard_batch_size: z.string().default(''),
  manufacturing_license_no: z.string().default(''),
  final_packing_details: z.string().default(''),
  product_code: z.string().default(''),
  dosage_form: z.string().default(''),
  market_type: z.string().default(''),
});

export type PqrDocumentForm = z.infer<typeof pqrDocumentSchema>;
export type ProductMasterForm = z.infer<typeof productMasterSchema>;
export type CompositionRow = z.infer<typeof compositionRowSchema>;
export type BrandNameRow = z.infer<typeof brandNameSchema>;
export type PqrApprovalForm = z.infer<typeof pqrApprovalSchema>;
export type RevisionRow = z.infer<typeof revisionRowSchema>;
export type AbbreviationForm = z.infer<typeof abbreviationSchema>;
