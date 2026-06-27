import { z } from 'zod';
import { FMEA_STATUSES } from '@/lib/risk-fmea-records';

const score = z.coerce.number().int().min(1).max(10);

export const fmeaRowSchema = z.object({
  failure_mode_id: z.string().trim().min(1),
  process_step: z.string().trim().min(1),
  failure_mode: z.string().trim().min(1, 'Failure mode required'),
  potential_effect: z.string().trim().min(1, 'Potential effect required'),
  potential_cause: z.string().trim().min(1, 'Potential cause required'),
  existing_control: z.string().trim().optional().default(''),
  severity: score,
  occurrence: score,
  detection: score,
  mitigation_required: z.boolean().default(false),
  mitigation_action: z.string().trim().optional().default(''),
  action_owner: z.string().trim().optional().default(''),
  target_date: z.string().trim().optional().default(''),
  residual_severity: score,
  residual_occurrence: score,
  residual_detection: score,
  status: z.string().trim().optional().default('Open'),
});

export const fmeaHeaderSchema = z.object({
  fmea_title: z.string().trim().min(1, 'FMEA title required'),
  department: z.string().trim().min(1, 'Department required'),
  product: z.string().trim().optional().default(''),
  process_area: z.string().trim().min(1, 'Process area required'),
  assessment_date: z.string().trim().min(1, 'Assessment date required'),
  facilitator: z.string().trim().min(1, 'Facilitator required'),
  team_members: z.array(z.string().trim()).default([]),
  review_date: z.string().trim().min(1, 'Review date required'),
  status: z.enum(FMEA_STATUSES).default('Draft'),
});

export const fmeaRecordSchema = fmeaHeaderSchema.extend({
  rows: z.array(fmeaRowSchema).min(1, 'At least one failure mode is required'),
}).superRefine((data, ctx) => {
  data.rows.forEach((r, idx) => {
    const rpn = r.severity * r.occurrence * r.detection;
    if (rpn >= 101 && !r.mitigation_action.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows', idx, 'mitigation_action'],
        message: 'Mitigation action required for High/Critical risk',
      });
    }
  });
});

export type FmeaHeaderInput = z.infer<typeof fmeaHeaderSchema>;
export type FmeaRowInput = z.infer<typeof fmeaRowSchema>;
export type FmeaRecordInput = z.infer<typeof fmeaRecordSchema>;
