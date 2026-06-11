import { z } from 'zod';
import { VENDOR_TYPES, APPROVAL_STATUSES, RISK_CATEGORIES, VENDOR_STATUSES, QUALIFICATION_TYPES, QUALIFICATION_DECISIONS, SUPPLIER_AUDIT_TYPES, AUDIT_RATINGS, AGREEMENT_TYPES, AGREEMENT_STATUSES } from './vendor-mgmt-types';

export const vendorCreateSchema = z.object({
  vendor_name: z.string().min(1, 'Vendor name is required'),
  vendor_type: z.enum(VENDOR_TYPES as unknown as [string, ...string[]]),
  material_service_supplied: z.string().min(1, 'Material/service is required'),
  manufacturer_name: z.string().default(''),
  supplier_name: z.string().default(''),
  address: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  country: z.string().default(''),
  contact_person: z.string().default(''),
  email: z.string().email('Valid email required').or(z.literal('')).default(''),
  phone: z.string().default(''),
  gst_tax_no: z.string().default(''),
  license_no: z.string().default(''),
  approval_status: z.enum(APPROVAL_STATUSES as unknown as [string, ...string[]]).default('Not Qualified'),
  risk_category: z.enum(RISK_CATEGORIES as unknown as [string, ...string[]]),
  vendor_status: z.enum(VENDOR_STATUSES as unknown as [string, ...string[]]).default('Active'),
  remarks: z.string().default(''),
  next_audit_due: z.string().nullable().optional(),
});

export const avlSchema = z.object({
  vendor_id: z.string().min(1),
  vendor_name: z.string().min(1),
  material_service: z.string().min(1),
  approval_date: z.string().min(1),
  approval_expiry_date: z.string().min(1),
  qualification_ref: z.string().default(''),
  audit_required: z.boolean().default(true),
  audit_frequency: z.string().default('Annual'),
}).refine((d) => new Date(d.approval_expiry_date) > new Date(d.approval_date), {
  message: 'Expiry must be after approval date', path: ['approval_expiry_date'],
});

export const qualificationSchema = z.object({
  vendor_id: z.string().min(1),
  vendor_name: z.string().min(1),
  vendor_type: z.string().min(1),
  qualification_type: z.enum(QUALIFICATION_TYPES as unknown as [string, ...string[]]),
  material_service: z.string().min(1),
  questionnaire_sent_date: z.string().nullable().optional(),
  questionnaire_received_date: z.string().nullable().optional(),
  document_review_status: z.string().default('Pending'),
  sample_evaluation_required: z.boolean().default(false),
  sample_evaluation_status: z.string().default('N/A'),
  audit_required: z.boolean().default(false),
  audit_date: z.string().nullable().optional(),
  audit_status: z.string().default('Pending'),
  risk_assessment_score: z.coerce.number().min(0).max(100).default(0),
  qualification_decision: z.enum(QUALIFICATION_DECISIONS as unknown as [string, ...string[]]).default('More Information Required'),
  next_review_date: z.string().nullable().optional(),
  remarks: z.string().default(''),
});

export const supplierAuditSchema = z.object({
  vendor_id: z.string().min(1),
  vendor_name: z.string().min(1),
  audit_type: z.enum(SUPPLIER_AUDIT_TYPES as unknown as [string, ...string[]]),
  audit_date: z.string().min(1),
  audit_scope: z.string().default(''),
  lead_auditor: z.string().default(''),
  audit_team: z.string().default(''),
  findings_count: z.coerce.number().min(0).default(0),
  critical_findings: z.coerce.number().min(0).default(0),
  major_findings: z.coerce.number().min(0).default(0),
  minor_findings: z.coerce.number().min(0).default(0),
  capa_required: z.boolean().default(false),
  capa_status: z.string().default('N/A'),
  final_audit_rating: z.enum(AUDIT_RATINGS as unknown as [string, ...string[]]).default('Satisfactory'),
});

export const agreementSchema = z.object({
  vendor_id: z.string().min(1),
  vendor_name: z.string().min(1),
  agreement_type: z.enum(AGREEMENT_TYPES as unknown as [string, ...string[]]),
  material_service: z.string().min(1),
  effective_date: z.string().min(1),
  expiry_date: z.string().min(1),
  agreement_status: z.enum(AGREEMENT_STATUSES as unknown as [string, ...string[]]).default('Draft'),
  responsible_department: z.string().default('QA'),
  review_due_date: z.string().nullable().optional(),
  remarks: z.string().default(''),
}).refine((d) => new Date(d.expiry_date) > new Date(d.effective_date), {
  message: 'Expiry must be after effective date', path: ['expiry_date'],
});

export const performanceSchema = z.object({
  vendor_id: z.string().min(1),
  vendor_name: z.string().min(1),
  review_period: z.string().min(1),
  material_service: z.string().default(''),
  total_lots_received: z.coerce.number().min(0),
  approved_lots: z.coerce.number().min(0),
  rejected_lots: z.coerce.number().min(0),
  on_time_deliveries: z.coerce.number().min(0),
  delayed_deliveries: z.coerce.number().min(0),
  complaints: z.coerce.number().min(0),
  deviations: z.coerce.number().min(0),
  oos_linked: z.coerce.number().min(0),
  capa_linked: z.coerce.number().min(0),
  audit_findings: z.coerce.number().min(0),
  recommendation: z.string().default(''),
});

export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;
export type AvlInput = z.infer<typeof avlSchema>;
export type QualificationInput = z.infer<typeof qualificationSchema>;
export type SupplierAuditInput = z.infer<typeof supplierAuditSchema>;
export type AgreementInput = z.infer<typeof agreementSchema>;
export type PerformanceInput = z.infer<typeof performanceSchema>;
