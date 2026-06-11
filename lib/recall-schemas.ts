import { z } from 'zod';
import { RECALL_TYPES, RECALL_CLASSIFICATIONS } from './recall-types';

export const recallCreateSchema = z.object({
  recall_date: z.string().min(1, 'Recall date is required'),
  recall_type: z.enum(RECALL_TYPES as unknown as [string, ...string[]]),
  recall_classification: z.enum(RECALL_CLASSIFICATIONS as unknown as [string, ...string[]]),
  product_name: z.string().min(1, 'Product name is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  market_region: z.string().min(1, 'Market/region is required'),
  reason_for_recall: z.string().min(10, 'Reason is required'),
  recall_initiated_by_name: z.string().min(1, 'Initiated by is required'),
  regulatory_notification_required: z.boolean().default(false),
  stock_quantity: z.coerce.number().min(0).default(0),
  distributed_quantity: z.coerce.number().min(0).default(0),
  recovered_quantity: z.coerce.number().min(0).default(0),
  impact_assessment: z.string().optional().default(''),
  risk_assessment: z.string().optional().default(''),
  capa_required: z.boolean().default(false),
  linked_complaint_id: z.string().optional().nullable(),
  qa_remarks: z.string().optional().default(''),
});

export const distributionSchema = z.object({
  customer_name: z.string().min(1, 'Customer is required'),
  market_region: z.string().min(1, 'Market is required'),
  quantity_distributed: z.coerce.number().min(1),
  distribution_date: z.string().min(1),
  contact_details: z.string().optional().default(''),
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

export type RecallCreateInput = z.infer<typeof recallCreateSchema>;
export type DistributionInput = z.infer<typeof distributionSchema>;
export type RecoveryInput = z.infer<typeof recoverySchema>;
export type RecallApprovalInput = z.infer<typeof recallApprovalSchema>;

export { RECALL_TYPES, RECALL_CLASSIFICATIONS };
