import { z } from 'zod';

export const complaintClosureDraftSchema = z.object({
  investigation_completed: z.boolean().default(false),
  impact_assessment_completed: z.boolean().default(false),
  capa_required: z.boolean().default(false),
  capa_linked: z.boolean().default(false),
  capa_completed: z.boolean().default(false),
  recall_evaluation_required: z.boolean().default(false),
  recall_evaluation_completed: z.boolean().default(false),
  customer_response_required: z.boolean().default(false),
  customer_response_sent: z.boolean().default(false),
  product_quality_impact_resolved: z.boolean().default(false),
  patient_safety_impact_resolved: z.boolean().default(false),
  regulatory_impact_resolved: z.boolean().default(false),
  all_attachments_reviewed: z.boolean().default(false),
  qa_closure_comments: z.string().optional().default(''),
  final_complaint_conclusion: z.string().optional().default(''),
});

export const complaintClosureFormSchema = complaintClosureDraftSchema.extend({
  qa_closure_comments: z.string().min(10, 'QA closure comments are required'),
  final_complaint_conclusion: z.string().min(10, 'Final complaint conclusion is required'),
});

export const complaintClosureReopenSchema = z.object({
  reason: z.string().min(5, 'Reopen reason is required'),
  e_signature: z.string().min(3, 'E-signature is required'),
});

export type ComplaintClosureFormInput = z.infer<typeof complaintClosureFormSchema>;
export type ComplaintClosureReopenInput = z.infer<typeof complaintClosureReopenSchema>;
