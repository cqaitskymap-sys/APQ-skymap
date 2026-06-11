import { z } from 'zod';
import { CAPA_SOURCES, CAPA_DEPARTMENTS, CAPA_PRIORITIES, EFFECTIVENESS_RESULTS } from './capa-types';

export const capaCreateSchema = z.object({
  capa_date: z.string().min(1, 'CAPA date is required'),
  capa_source: z.enum(CAPA_SOURCES as unknown as [string, ...string[]]),
  source_reference_number: z.string().min(1, 'Source reference number is required'),
  department: z.enum(CAPA_DEPARTMENTS as unknown as [string, ...string[]]),
  product_name: z.string().min(1, 'Product name is required'),
  batch_number: z.string().optional().default(''),
  capa_title: z.string().min(3, 'Title must be at least 3 characters'),
  problem_description: z.string().min(10, 'Problem description is required'),
  root_cause: z.string().optional().default(''),
  corrective_action: z.string().optional().default(''),
  preventive_action: z.string().optional().default(''),
  action_owner: z.string().min(1, 'Action owner is required'),
  target_completion_date: z.string().min(1, 'Target completion date is required'),
  effectiveness_check_required: z.boolean().default(true),
  effectiveness_criteria: z.string().optional().default(''),
  priority: z.enum(CAPA_PRIORITIES as unknown as [string, ...string[]]).default('medium'),
  qa_remarks: z.string().optional().default(''),
});

export const capaUpdateSchema = capaCreateSchema.partial();

export const capaRootCauseSchema = z.object({
  root_cause: z.string().min(10, 'Root cause analysis is required'),
  corrective_action: z.string().min(5, 'Corrective action is required'),
  preventive_action: z.string().min(5, 'Preventive action is required'),
});

export const capaImplementationSchema = z.object({
  actual_completion_date: z.string().min(1, 'Actual completion date is required'),
  implementation_evidence: z.string().min(5, 'Implementation evidence is required'),
  status: z.enum(['in_progress', 'completed']).default('completed'),
});

export const capaActionSchema = z.object({
  action_type: z.enum(['corrective', 'preventive', 'implementation']),
  description: z.string().min(5, 'Action description is required'),
  owner_name: z.string().min(1, 'Owner is required'),
  target_date: z.string().optional().nullable(),
  evidence: z.string().optional().default(''),
});

export const capaEffectivenessSchema = z.object({
  check_date: z.string().min(1, 'Effectiveness check date is required'),
  criteria: z.string().min(5, 'Effectiveness criteria is required'),
  result: z.enum(EFFECTIVENESS_RESULTS as unknown as [string, ...string[]]),
  evidence: z.string().min(5, 'Evidence is required'),
  remarks: z.string().optional().default(''),
});

export const capaApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().min(5, 'Comments are required'),
  e_signature: z.string().min(3, 'E-signature required (typed full name)'),
});

export const capaAssignSchema = z.object({
  action_owner: z.string().min(1, 'Action owner is required'),
  action_owner_name: z.string().min(1, 'Owner name is required'),
});

export type CapaCreateInput = z.infer<typeof capaCreateSchema>;
export type CapaRootCauseInput = z.infer<typeof capaRootCauseSchema>;
export type CapaImplementationInput = z.infer<typeof capaImplementationSchema>;
export type CapaActionInput = z.infer<typeof capaActionSchema>;
export type CapaEffectivenessInput = z.infer<typeof capaEffectivenessSchema>;
export type CapaApprovalInput = z.infer<typeof capaApprovalSchema>;
export type CapaAssignInput = z.infer<typeof capaAssignSchema>;

export { CAPA_SOURCES, CAPA_DEPARTMENTS, CAPA_PRIORITIES };
