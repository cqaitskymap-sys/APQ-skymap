import { z } from 'zod';
import { RECALL_TYPES, RECALL_CLASSIFICATIONS, RECALL_SOURCES } from './recall-types';
import { RECALL_RECOVERY_STATUSES } from './recall-types';

const recallBaseSchema = z.object({
  recall_date: z.string().min(1, 'Recall date is required'),
  recall_type: z.enum(RECALL_TYPES as unknown as [string, ...string[]]),
  recall_classification: z.enum(RECALL_CLASSIFICATIONS as unknown as [string, ...string[]]),
  recall_source: z.enum(RECALL_SOURCES as unknown as [string, ...string[]]).default('Internal Quality Review'),
  source_reference_id: z.string().optional().nullable(),
  source_reference_number: z.string().optional().default(''),
  recall_initiated_by_name: z.string().min(1, 'Initiated by is required'),
  product_name: z.string().min(1, 'Product name is required'),
  product_code: z.string().optional().default(''),
  batch_number: z.string().min(1, 'Batch number is required'),
  mfg_date: z.string().optional().default(''),
  exp_date: z.string().optional().default(''),
  market_region: z.string().min(1, 'Market/region is required'),
  customer_name: z.string().optional().default(''),
  reason_for_recall: z.string().min(10, 'Reason for recall is required (min 10 characters)'),
  recall_justification: z.string().optional().default(''),
  impact_assessment: z.string().optional().default(''),
  risk_assessment: z.string().optional().default(''),
  stock_quantity: z.coerce.number().min(0).default(0),
  distributed_quantity: z.coerce.number().min(0).default(0),
  recovered_quantity: z.coerce.number().min(0).default(0),
  regulatory_notification_required: z.boolean().default(false),
  regulatory_authority: z.string().optional().default(''),
  notification_due_date: z.string().optional().nullable(),
  capa_required: z.boolean().default(false),
  linked_capa_id: z.string().optional().nullable(),
  linked_capa_number: z.string().optional().default(''),
  linked_complaint_id: z.string().optional().nullable(),
  linked_deviation_id: z.string().optional().nullable(),
  linked_oos_id: z.string().optional().nullable(),
  assigned_owner: z.string().optional().default(''),
  assigned_owner_name: z.string().min(1, 'Assigned owner is required'),
  due_date: z.string().min(1, 'Due date is required'),
  qa_remarks: z.string().optional().default(''),
  include_in_pqr_review: z.boolean().default(true),
});

function quantityRefine(data: {
  distributed_quantity: number;
  recovered_quantity: number;
  regulatory_notification_required: boolean;
  regulatory_authority?: string;
}, ctx: z.RefinementCtx, requireDistributed = false) {
  if (requireDistributed && data.distributed_quantity <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Distributed quantity must be greater than 0', path: ['distributed_quantity'] });
  }
  if (data.recovered_quantity > data.distributed_quantity) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Recovered quantity cannot exceed distributed quantity', path: ['recovered_quantity'] });
  }
  if (data.regulatory_notification_required && !data.regulatory_authority?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Regulatory authority is required when notification is required', path: ['regulatory_authority'] });
  }
}

export const recallDraftSchema = recallBaseSchema.superRefine((data, ctx) => {
  quantityRefine(data, ctx, false);
});

export const recallCreateSchema = recallBaseSchema.superRefine((data, ctx) => {
  quantityRefine(data, ctx, true);
});

export const recallStep1Schema = recallBaseSchema.pick({
  recall_date: true,
  recall_type: true,
  recall_classification: true,
  recall_source: true,
  source_reference_id: true,
  source_reference_number: true,
  recall_initiated_by_name: true,
});

export const recallStep2Schema = recallBaseSchema.pick({
  product_name: true,
  product_code: true,
  batch_number: true,
  mfg_date: true,
  exp_date: true,
  market_region: true,
  customer_name: true,
});

export const recallStep3Schema = recallBaseSchema.pick({
  reason_for_recall: true,
  recall_justification: true,
  impact_assessment: true,
  risk_assessment: true,
});

export const recallStep4Schema = recallBaseSchema.pick({
  stock_quantity: true,
  distributed_quantity: true,
  recovered_quantity: true,
});

export const recallStep5Schema = recallBaseSchema.pick({
  regulatory_notification_required: true,
  regulatory_authority: true,
  notification_due_date: true,
  capa_required: true,
  linked_capa_id: true,
  linked_capa_number: true,
});

export const distributionSchema = z.object({
  customer_name: z.string().min(1, 'Customer / distributor is required'),
  market_region: z.string().min(1, 'Market / region is required'),
  invoice_number: z.string().optional().default(''),
  dispatch_date: z.string().optional(),
  distribution_date: z.string().optional(),
  quantity_distributed: z.coerce.number().min(1, 'Distributed quantity is required'),
  unit: z.string().optional().default('Units'),
  contact_person: z.string().optional().default(''),
  contact_email: z.string().optional().default(''),
  contact_phone: z.string().optional().default(''),
  contact_details: z.string().optional().default(''),
  notification_sent: z.boolean().default(false),
  notification_date: z.string().optional().nullable(),
  recovery_required: z.boolean().default(true),
  remarks: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (!data.dispatch_date?.trim() && !data.distribution_date?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Dispatch date is required', path: ['dispatch_date'] });
  }
}).transform((data) => {
  const date = data.dispatch_date || data.distribution_date || '';
  return {
    ...data,
    dispatch_date: date,
    distribution_date: date,
    contact_details: data.contact_details
      || [data.contact_person, data.contact_email, data.contact_phone].filter(Boolean).join(' | '),
  };
});

export const recoveryTrackingSchema = z.object({
  distribution_id: z.string().optional().nullable(),
  customer_name: z.string().min(1, 'Customer / distributor is required'),
  market_region: z.string().min(1, 'Market / region is required'),
  distributed_quantity: z.coerce.number().min(1, 'Distributed quantity is required'),
  quantity_recovered: z.coerce.number().min(0, 'Recovered quantity must be numeric'),
  recovery_date: z.string().optional().default(''),
  recovered_by_name: z.string().optional().default(''),
  recovery_status: z.enum(RECALL_RECOVERY_STATUSES as unknown as [string, ...string[]]).default('Pending'),
  reason_for_pending: z.string().optional().default(''),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z.string().optional().nullable(),
  remarks: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.quantity_recovered > data.distributed_quantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recovered quantity cannot exceed distributed quantity',
      path: ['quantity_recovered'],
    });
  }
  if (data.quantity_recovered > 0 && !data.recovery_date?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Recovery date is required when recovered quantity is greater than 0',
      path: ['recovery_date'],
    });
  }
});

export const recoverySchema = z.object({
  recovery_date: z.string().min(1),
  quantity_recovered: z.coerce.number().min(0),
  recovered_from: z.string().min(1),
  recovery_status: z.string().default('Recovered'),
  remarks: z.string().optional().default(''),
});

export const recallApprovalSchema = z.object({
  approval_type: z.enum(['head_qa', 'regulatory', 'final']),
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5),
  e_signature: z.string().min(3),
});

export type RecallCreateInput = z.infer<typeof recallBaseSchema>;
export type DistributionInput = z.infer<typeof distributionSchema>;
export type RecoveryTrackingInput = z.infer<typeof recoveryTrackingSchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type RecallApprovalInput = z.infer<typeof recallApprovalSchema>;

export { RECALL_TYPES, RECALL_CLASSIFICATIONS, RECALL_SOURCES, RECALL_RECOVERY_STATUSES };
