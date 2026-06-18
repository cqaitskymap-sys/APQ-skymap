import { z } from 'zod';

export const complaintCapaRequirementSchema = z.object({
  capa_required: z.boolean(),
  remarks: z.string().optional().default(''),
});

export const complaintCapaLinkExistingSchema = z.object({
  capa_number: z.string().min(1, 'CAPA number is required'),
  remarks: z.string().optional().default(''),
});

export const complaintCapaCreateSchema = z.object({
  capa_required: z.boolean().default(true),
  capa_title: z.string().min(3, 'CAPA title is required'),
  capa_source: z.string().default('Market Complaint'),
  root_cause: z.string().min(3, 'Root cause is required'),
  corrective_action: z.string().min(3, 'Corrective action is required'),
  preventive_action: z.string().min(3, 'Preventive action is required'),
  action_owner_name: z.string().min(1, 'Action owner is required'),
  department: z.string().optional().default('QA'),
  target_completion_date: z.string().min(1, 'Target completion date is required'),
  effectiveness_check_required: z.boolean().default(true),
  remarks: z.string().optional().default(''),
});

export const complaintCapaUnlinkSchema = z.object({
  reason: z.string().min(5, 'Unlink reason is required'),
});

export const complaintCapaImplementationSchema = z.object({
  capa_status: z.string().min(1, 'CAPA status is required'),
  implementation_date: z.string().optional().default(''),
  corrective_action: z.string().optional().default(''),
  preventive_action: z.string().optional().default(''),
  remarks: z.string().optional().default(''),
});

export type ComplaintCapaRequirementInput = z.infer<typeof complaintCapaRequirementSchema>;
export type ComplaintCapaLinkExistingInput = z.infer<typeof complaintCapaLinkExistingSchema>;
export type ComplaintCapaCreateInput = z.infer<typeof complaintCapaCreateSchema>;
export type ComplaintCapaUnlinkInput = z.infer<typeof complaintCapaUnlinkSchema>;
export type ComplaintCapaImplementationInput = z.infer<typeof complaintCapaImplementationSchema>;
