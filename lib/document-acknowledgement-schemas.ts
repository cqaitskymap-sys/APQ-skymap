import { z } from 'zod';

export const ackAssignSchema = z.object({
  document_id: z.string().min(1, 'Document is required'),
  document_version: z.string().min(1, 'Version is required'),
  employee_id: z.string().min(1, 'Assigned employee is required'),
  employee_name: z.string().min(1, 'Employee name is required'),
  department: z.string().min(1, 'Department is required'),
  role: z.string().default(''),
  due_date: z.string().nullable().optional(),
  distribution_id: z.string().nullable().optional(),
  electronic_signature_required: z.boolean().default(false),
  training_required: z.boolean().default(false),
  read_confirmation_required: z.boolean().default(true),
});

export const ackSubmitSchema = z.object({
  comments: z.string().default(''),
  electronic_signature: z.string().optional(),
}).superRefine((data, ctx) => {
  // e-signature validated at service level when required
  if (data.electronic_signature !== undefined && !data.electronic_signature?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Electronic signature is required', path: ['electronic_signature'] });
  }
});

export const readConfirmSchema = z.object({
  comments: z.string().default(''),
});

export type AckAssignInput = z.infer<typeof ackAssignSchema>;
export type AckSubmitInput = z.infer<typeof ackSubmitSchema>;

export function validateDocumentForAcknowledgement(status: string, isLatest: boolean): string | null {
  if (status !== 'effective') return 'Only Effective documents can be acknowledged';
  if (!isLatest) return 'Superseded documents cannot be acknowledged';
  return null;
}

export function validateAcknowledgementActor(employeeId: string, actorId: string, actorRole: string): string | null {
  const canManage = ['super_admin', 'admin', 'regulatory_affairs', 'head_qa', 'qa_manager'].includes(actorRole);
  if (employeeId !== actorId && !canManage) return 'Only assigned users can acknowledge documents';
  return null;
}
