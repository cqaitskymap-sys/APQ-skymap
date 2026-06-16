import { z } from 'zod';
import {
  CAPA_SOURCES,
  CAPA_DEPARTMENTS,
  CAPA_PRIORITIES,
  EFFECTIVENESS_RESULTS,
} from './capa-types';

export { CAPA_SOURCES, CAPA_DEPARTMENTS, CAPA_PRIORITIES };

const sourceEnum = z.enum(CAPA_SOURCES as unknown as [string, ...string[]]);
const deptEnum = z.enum(CAPA_DEPARTMENTS as unknown as [string, ...string[]]);
const priorityEnum = z.enum(CAPA_PRIORITIES as unknown as [string, ...string[]]);
const effectivenessResultEnum = z.enum(EFFECTIVENESS_RESULTS as unknown as [string, ...string[]]);

const dateRequired = z.string().trim().min(1, 'Date is required');

export const capaCreateBaseSchema = z.object({
  capa_date: dateRequired,
  capa_source: sourceEnum,
  source_reference_number: z.string().trim().default(''),
  department: deptEnum,
  product_name: z.string().trim().default(''),
  batch_number: z.string().trim().optional().default(''),
  capa_title: z.string().trim().min(3, 'CAPA title is required (min 3 characters)'),
  problem_description: z.string().trim().min(10, 'Problem description is required'),
  root_cause: z.string().trim().min(5, 'Root cause is required'),
  corrective_action: z.string().trim().min(5, 'Corrective action is required'),
  preventive_action: z.string().trim().min(5, 'Preventive action is required'),
  action_owner: z.string().trim().min(1, 'Action owner is required'),
  action_owner_name: z.string().trim().optional().default(''),
  target_completion_date: dateRequired,
  effectiveness_check_required: z.boolean().default(true),
  effectiveness_check_date: z.string().trim().optional().default(''),
  effectiveness_criteria: z.string().trim().optional().default(''),
  priority: priorityEnum.default('medium'),
  criticality: z.string().trim().optional().default('Medium'),
  qa_reviewer: z.string().trim().optional().default(''),
  qa_reviewer_name: z.string().trim().optional().default(''),
  qa_remarks: z.string().trim().optional().default(''),
});

function applyCapaCreateRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: z.infer<typeof capaCreateBaseSchema>, ctx) => {
    const needsRef = !['Other', 'Self Inspection', 'Vendor Audit'].includes(data.capa_source);
    if (needsRef && !data.source_reference_number.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source reference number is required',
        path: ['source_reference_number'],
      });
    }
    const capaDate = new Date(data.capa_date);
    const targetDate = new Date(data.target_completion_date);
    if (
      !Number.isNaN(capaDate.getTime())
      && !Number.isNaN(targetDate.getTime())
      && targetDate <= capaDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target completion date must be after CAPA date',
        path: ['target_completion_date'],
      });
    }
    if (data.effectiveness_check_required) {
      if (!data.effectiveness_check_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effectiveness check date is required',
          path: ['effectiveness_check_date'],
        });
      }
      if (!data.effectiveness_criteria?.trim() || data.effectiveness_criteria.trim().length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effectiveness criteria is required',
          path: ['effectiveness_criteria'],
        });
      }
    }
  });
}

export const capaCreateSchema = applyCapaCreateRefinements(capaCreateBaseSchema);

export const capaStep1Schema = applyCapaCreateRefinements(capaCreateBaseSchema.pick({
  capa_date: true,
  capa_source: true,
  source_reference_number: true,
  department: true,
  capa_title: true,
}));

export const capaStep2Schema = capaCreateBaseSchema.pick({
  product_name: true,
  batch_number: true,
});

export const capaStep3Schema = capaCreateBaseSchema.pick({
  problem_description: true,
  root_cause: true,
});

export const capaStep4Schema = applyCapaCreateRefinements(capaCreateBaseSchema.pick({
  corrective_action: true,
  preventive_action: true,
  action_owner: true,
  action_owner_name: true,
  target_completion_date: true,
  priority: true,
  criticality: true,
  capa_date: true,
}));

export const capaStep5Schema = applyCapaCreateRefinements(capaCreateBaseSchema.pick({
  effectiveness_check_required: true,
  effectiveness_check_date: true,
  effectiveness_criteria: true,
  qa_reviewer: true,
  qa_reviewer_name: true,
  qa_remarks: true,
}));

export const capaUpdateSchema = capaCreateBaseSchema.partial();

export const capaRootCauseSchema = z.object({
  root_cause: z.string().trim().min(5, 'Root cause is required'),
  corrective_action: z.string().trim().min(5, 'Corrective action is required'),
  preventive_action: z.string().trim().min(5, 'Preventive action is required'),
});

export const capaImplementationSchema = z.object({
  actual_completion_date: dateRequired,
  implementation_evidence: z.string().trim().min(5, 'Implementation evidence is required'),
});

export const capaEffectivenessSchema = z.object({
  check_date: dateRequired,
  criteria: z.string().trim().min(5, 'Criteria is required'),
  result: effectivenessResultEnum,
  evidence: z.string().trim().min(5, 'Evidence is required'),
  remarks: z.string().trim().optional().default(''),
});

export const capaApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  comments: z.string().trim().min(3, 'Comments are required'),
  e_signature: z.string().trim().min(1, 'E-signature is required'),
});

export type CapaCreateInput = z.infer<typeof capaCreateSchema>;
export type CapaRootCauseInput = z.infer<typeof capaRootCauseSchema>;
export type CapaImplementationInput = z.infer<typeof capaImplementationSchema>;
export type CapaEffectivenessInput = z.infer<typeof capaEffectivenessSchema>;
export type CapaApprovalInput = z.infer<typeof capaApprovalSchema>;
