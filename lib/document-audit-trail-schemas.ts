import { z } from 'zod';
import { AUDIT_EVENT_TYPES, AUDIT_EVENT_CATEGORIES } from './document-audit-trail-types';

export const auditExportSchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']),
  entity_id: z.string().optional(),
  event_type: z.enum(AUDIT_EVENT_TYPES as unknown as [string, ...string[]]).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  include_hash: z.boolean().default(true),
});

export const createAuditEventSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().min(1, 'Entity ID is required'),
  event_type: z.enum(AUDIT_EVENT_TYPES as unknown as [string, ...string[]], { required_error: 'Event type is required' }),
  document_id: z.string().optional(),
  document_number: z.string().optional(),
  previous_value: z.string().optional(),
  new_value: z.string().optional(),
  reason_for_change: z.string().optional(),
  correlation_id: z.string().optional(),
});

export type AuditExportInput = z.infer<typeof auditExportSchema>;
export type CreateAuditEventInput = z.infer<typeof createAuditEventSchema>;
