import { z } from 'zod';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CRITICALITIES,
  COMPLAINT_CUSTOMER_TYPES,
  COMPLAINT_RCA_METHODS,
  COMPLAINT_SOURCES,
  COMPLAINT_SUBCATEGORIES,
} from './complaint-types';

const yesNo = z.boolean().default(false);

export const complaintCreateSchema = z.object({
  complaint_date: z.string().min(1, 'Complaint date is required'),
  received_from: z.enum(COMPLAINT_SOURCES as unknown as [string, ...string[]]),
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_type: z.enum(COMPLAINT_CUSTOMER_TYPES as unknown as [string, ...string[]]).optional().default('Retail'),
  country: z.string().optional().default(''),
  customer_contact: z.string().optional().default(''),
  contact_person: z.string().optional().default(''),
  market_region: z.string().min(1, 'Market is required'),
  product_name: z.string().min(1, 'Product is required'),
  product_code: z.string().optional().default(''),
  batch_number: z.string().optional().default(''),
  batch_id: z.string().optional().nullable(),
  mfg_date: z.string().optional().default(''),
  exp_date: z.string().optional().default(''),
  complaint_category: z.enum(COMPLAINT_CATEGORIES as unknown as [string, ...string[]]),
  complaint_subcategory: z.enum(COMPLAINT_SUBCATEGORIES as unknown as [string, ...string[]]).optional().default('Other'),
  complaint_description: z.string().min(10, 'Complaint description is required'),
  issue_reported: z.string().optional().default(''),
  quantity_involved: z.string().optional().default(''),
  sample_received: yesNo,
  photographs_available: yesNo,
  retain_sample_required: yesNo,
  product_quality_impact: yesNo,
  product_safety_impact: yesNo,
  regulatory_impact: yesNo,
  market_impact: yesNo,
  recall_evaluation_required: yesNo,
  complaint_criticality: z.enum(COMPLAINT_CRITICALITIES as unknown as [string, ...string[]]),
  assigned_to: z.string().min(1, 'Assigned investigator is required'),
  assigned_to_name: z.string().min(1, 'Assigned investigator is required'),
  due_date: z.string().min(1, 'Target closure date is required'),
  investigation_required: z.boolean().default(true),
  initial_assessment: z.string().optional().default(''),
  qa_remarks: z.string().optional().default(''),
  risk_level: z.string().optional().default('Low'),
});

export const complaintDraftSchema = complaintCreateSchema.partial({
  customer_name: true,
  product_name: true,
  complaint_category: true,
  complaint_description: true,
  assigned_to: true,
  assigned_to_name: true,
  due_date: true,
});

export const complaintStep1Schema = complaintCreateSchema.pick({
  complaint_date: true,
  received_from: true,
  customer_name: true,
  customer_type: true,
  country: true,
  contact_person: true,
  customer_contact: true,
  market_region: true,
});

export const complaintStep2Schema = complaintCreateSchema.pick({
  product_name: true,
  product_code: true,
  batch_number: true,
  mfg_date: true,
  exp_date: true,
});

export const complaintStep3Schema = complaintCreateSchema.pick({
  complaint_category: true,
  complaint_subcategory: true,
  complaint_description: true,
  issue_reported: true,
  quantity_involved: true,
  sample_received: true,
  photographs_available: true,
  product_quality_impact: true,
  product_safety_impact: true,
  regulatory_impact: true,
  market_impact: true,
  recall_evaluation_required: true,
  complaint_criticality: true,
  risk_level: true,
  initial_assessment: true,
});

export const complaintStep4Schema = complaintCreateSchema.pick({
  assigned_to: true,
  assigned_to_name: true,
  due_date: true,
  investigation_required: true,
  qa_remarks: true,
});

export const complaintInvestigationSchema = z.object({
  investigation_start_date: z.string().optional().default(''),
  investigation_due_date: z.string().optional().default(''),
  customer_complaint_summary: z.string().optional().default(''),
  retain_sample_available: z.enum(['Yes', 'No']).optional().default('No'),
  complaint_sample_received: z.enum(['Yes', 'No']).optional().default('No'),
  sample_condition: z.string().optional().default(''),
  batch_record_review: z.string().optional().default(''),
  qc_result_review: z.string().optional().default(''),
  stability_data_review: z.string().optional().default(''),
  manufacturing_process_review: z.string().optional().default(''),
  packaging_review: z.string().optional().default(''),
  distribution_review: z.string().optional().default(''),
  previous_complaint_review: z.string().optional().default(''),
  root_cause_method: z.enum(COMPLAINT_RCA_METHODS as unknown as [string, ...string[]]).default('5 Why'),
  investigation_summary: z.string().min(10, 'Investigation summary is required'),
  findings: z.string().min(5, 'Investigation findings are required'),
  root_cause: z.string().optional().default(''),
  impact_assessment: z.string().min(5, 'Impact assessment is required'),
  sample_analysis: z.string().optional().default(''),
  batch_review: z.string().optional().default(''),
  conclusion: z.string().min(5, 'Final conclusion is required'),
  capa_required: z.boolean().default(false),
  recall_evaluation_required: z.boolean().default(false),
  qa_justification: z.string().optional().default(''),
});

export const complaintInvestigationQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().min(1, 'QA review comments are required'),
});

/** @deprecated use complaintInvestigationSchema */
export const investigationSchema = complaintInvestigationSchema;

export type ComplaintCreateInput = z.infer<typeof complaintCreateSchema>;
export type ComplaintInvestigationInput = z.infer<typeof complaintInvestigationSchema>;
export type ComplaintInvestigationQaReviewInput = z.infer<typeof complaintInvestigationQaReviewSchema>;
export type InvestigationInput = ComplaintInvestigationInput;

export {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CRITICALITIES,
  COMPLAINT_CUSTOMER_TYPES,
  COMPLAINT_SOURCES,
  COMPLAINT_SUBCATEGORIES,
};

/** @deprecated use COMPLAINT_SOURCES */
export const RECEIVED_FROM_OPTIONS = COMPLAINT_SOURCES;
