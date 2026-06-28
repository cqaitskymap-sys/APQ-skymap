import { z } from 'zod';
import { CERTIFICATE_STATUSES, APPROVAL_STATUSES } from './training-certificate-types';

export const createCertificateSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  employee_name: z.string().min(1),
  department: z.string().min(1),
  designation: z.string().default(''),
  training_record_id: z.string().min(1, 'Training record is required'),
  training_topic: z.string().min(1),
  training_type: z.string().default('GMP Training'),
  document_number: z.string().default(''),
  document_version: z.string().default(''),
  sop_number: z.string().default(''),
  trainer: z.string().default(''),
  assessment_score: z.number().nullable().optional(),
  result: z.string().default('Pass'),
  competency_level: z.string().default('Competent'),
  issue_date: z.string().min(1, 'Issue date is required'),
  effective_date: z.string().optional(),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  renewal_required: z.boolean().default(true),
  remarks: z.string().default(''),
}).refine((d) => d.expiry_date > d.issue_date, {
  message: 'Expiry date must be after issue date',
  path: ['expiry_date'],
});

export const renewCertificateSchema = z.object({
  certificate_id: z.string().min(1),
  new_expiry_date: z.string().min(1),
  remarks: z.string().default(''),
});

export const revokeCertificateSchema = z.object({
  certificate_id: z.string().min(1),
  reason: z.string().min(1, 'Revocation reason is required'),
});

export const verifyCertificateSchema = z.object({
  verification_code: z.string().min(1),
  certificate_number: z.string().optional(),
});

export type CreateCertificateInput = z.infer<typeof createCertificateSchema>;
export type RenewCertificateInput = z.infer<typeof renewCertificateSchema>;
export type RevokeCertificateInput = z.infer<typeof revokeCertificateSchema>;
export type VerifyCertificateInput = z.infer<typeof verifyCertificateSchema>;

export { CERTIFICATE_STATUSES, APPROVAL_STATUSES };
