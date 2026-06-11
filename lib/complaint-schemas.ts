import { z } from 'zod';
import {
  COMPLAINT_CATEGORIES, COMPLAINT_CRITICALITIES, RECEIVED_FROM_OPTIONS,
} from './complaint-types';

export const complaintCreateSchema = z.object({
  complaint_date: z.string().min(1, 'Complaint date is required'),
  received_from: z.enum(RECEIVED_FROM_OPTIONS as unknown as [string, ...string[]]),
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_contact: z.string().optional().default(''),
  market_region: z.string().min(1, 'Market/region is required'),
  product_name: z.string().min(1, 'Product name is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  mfg_date: z.string().optional().default(''),
  exp_date: z.string().optional().default(''),
  complaint_category: z.enum(COMPLAINT_CATEGORIES as unknown as [string, ...string[]]),
  complaint_description: z.string().min(10, 'Description is required'),
  sample_received: z.boolean().default(false),
  retain_sample_required: z.boolean().default(false),
  complaint_criticality: z.enum(COMPLAINT_CRITICALITIES as unknown as [string, ...string[]]),
  initial_assessment: z.string().optional().default(''),
  investigation_required: z.boolean().default(true),
  product_safety_impact: z.boolean().default(false),
  qa_remarks: z.string().optional().default(''),
});

export const investigationSchema = z.object({
  investigation_summary: z.string().min(10, 'Summary is required'),
  findings: z.string().min(5, 'Findings are required'),
  root_cause: z.string().min(5, 'Root cause is required'),
  impact_assessment: z.string().min(5, 'Impact assessment is required'),
  sample_analysis: z.string().optional().default(''),
  batch_review: z.string().optional().default(''),
  conclusion: z.string().min(5, 'Conclusion is required'),
  capa_required: z.boolean().default(false),
});

export type ComplaintCreateInput = z.infer<typeof complaintCreateSchema>;
export type InvestigationInput = z.infer<typeof investigationSchema>;

export { COMPLAINT_CATEGORIES, COMPLAINT_CRITICALITIES, RECEIVED_FROM_OPTIONS };
