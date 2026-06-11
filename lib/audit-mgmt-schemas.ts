import { z } from 'zod';
import {
  AUDIT_TYPES, AUDIT_DEPARTMENTS, COMPLIANCE_STATUSES, FINDING_TYPES, FINDING_CATEGORIES,
} from './audit-mgmt-types';

export const auditCreateSchema = z.object({
  audit_type: z.enum(AUDIT_TYPES as unknown as [string, ...string[]]),
  audit_title: z.string().min(1, 'Audit title is required'),
  department: z.enum(AUDIT_DEPARTMENTS as unknown as [string, ...string[]]),
  audit_scope: z.string().min(1, 'Audit scope is required'),
  audit_criteria: z.string().min(1, 'Audit criteria is required'),
  audit_date: z.string().min(1, 'Audit date is required'),
  audit_start_time: z.string().default('09:00'),
  audit_end_time: z.string().default('17:00'),
  lead_auditor_name: z.string().min(1, 'Lead auditor is required'),
  auditor_team: z.string().default(''),
  auditee: z.string().default(''),
  remarks: z.string().default(''),
  linked_pqr_id: z.string().nullable().optional(),
});

export const auditUpdateSchema = auditCreateSchema.partial();

export const checklistItemSchema = z.object({
  audit_area: z.string().min(1, 'Audit area is required'),
  checklist_question: z.string().min(1, 'Question is required'),
  requirement_reference: z.string().default(''),
  expected_evidence: z.string().default(''),
  observation: z.string().default(''),
  compliance_status: z.enum(COMPLIANCE_STATUSES as unknown as [string, ...string[]]).default('Compliant'),
  auditor_remarks: z.string().default(''),
});

export const findingSchema = z.object({
  finding_type: z.enum(FINDING_TYPES as unknown as [string, ...string[]]),
  finding_category: z.enum(FINDING_CATEGORIES as unknown as [string, ...string[]]),
  department: z.string().min(1),
  observation: z.string().min(1, 'Observation is required'),
  requirement_reference: z.string().default(''),
  evidence: z.string().default(''),
  severity: z.coerce.number().min(1).max(10).default(1),
  occurrence: z.coerce.number().min(1).max(10).default(1),
  detectability: z.coerce.number().min(1).max(10).default(1),
  root_cause: z.string().default(''),
  correction: z.string().default(''),
  capa_required: z.boolean().default(false),
  responsible_person_name: z.string().default(''),
  target_closure_date: z.string().nullable().optional(),
});

export const scheduleSchema = z.object({
  audit_title: z.string().min(1),
  audit_type: z.enum(AUDIT_TYPES as unknown as [string, ...string[]]),
  department: z.string().min(1),
  planned_date: z.string().min(1),
  lead_auditor_name: z.string().default(''),
});

export const approvalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().default(''),
});

export type AuditCreateInput = z.infer<typeof auditCreateSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type FindingInput = z.infer<typeof findingSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
