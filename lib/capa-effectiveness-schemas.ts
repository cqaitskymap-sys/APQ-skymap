import { z } from 'zod';
import { CAPA_EFF_EVALUATION_CRITERIA, CAPA_EFF_REVIEW_RESULTS } from '@/lib/capa-types';

const resultEnum = z.enum(CAPA_EFF_REVIEW_RESULTS as unknown as [string, ...string[]]);
const dateRequired = z.string().trim().min(1, 'Date is required');

export const capaEffectivenessReviewSchema = z.object({
  capa_id: z.string().trim().min(1, 'CAPA ID is required'),
  effectiveness_due_date: z.string().trim().optional().default(''),
  effectiveness_review_date: dateRequired,
  reviewed_by: z.string().trim().min(1, 'Reviewer is required'),
  reviewed_by_name: z.string().trim().optional().default(''),
  department: z.string().trim().min(1, 'Department is required'),
  review_period: z.string().trim().optional().default(''),
  evaluation_criteria: z.array(z.string()).min(1, 'Evaluation criteria required'),
  evidence_reviewed: z.string().trim().min(10, 'Evidence reviewed is required'),
  data_reviewed: z.string().trim().optional().default(''),
  repeat_issue_observed: z.boolean().default(false),
  issue_reoccurred: z.boolean().default(false),
  risk_reduced: z.boolean().default(false),
  root_cause_eliminated: z.boolean().default(false),
  corrective_action_effective: z.boolean().default(true),
  preventive_action_effective: z.boolean().default(true),
  effectiveness_result: resultEnum.optional(),
  effectiveness_score: z.number().min(0).max(100).optional(),
  qa_comments: z.string().trim().optional().default(''),
  final_conclusion: z.string().trim().min(10, 'Final conclusion is required'),
});

export const capaEffectivenessScheduleSchema = z.object({
  capa_id: z.string().trim().min(1),
  effectiveness_due_date: dateRequired,
  review_period: z.string().trim().optional().default(''),
});

export const capaEffectivenessQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_comments: z.string().trim().min(3, 'QA comments are required'),
  head_qa_comments: z.string().trim().optional().default(''),
});

export const CAPA_EFF_CRITERIA_OPTIONS = CAPA_EFF_EVALUATION_CRITERIA;

export type CapaEffectivenessReviewInput = z.infer<typeof capaEffectivenessReviewSchema>;
export type CapaEffectivenessScheduleInput = z.infer<typeof capaEffectivenessScheduleSchema>;
export type CapaEffectivenessQaReviewInput = z.infer<typeof capaEffectivenessQaReviewSchema>;
