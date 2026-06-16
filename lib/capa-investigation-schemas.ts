import { z } from 'zod';
import { CAPA_RCA_CATEGORIES, CAPA_RCA_METHODS } from '@/lib/capa-types';

const methodEnum = z.enum(CAPA_RCA_METHODS as unknown as [string, ...string[]]);
const categoryEnum = z.enum(CAPA_RCA_CATEGORIES as unknown as [string, ...string[]]);

export const capaFiveWhySchema = z.object({
  why1: z.string().trim().optional().default(''),
  why2: z.string().trim().optional().default(''),
  why3: z.string().trim().optional().default(''),
  why4: z.string().trim().optional().default(''),
  why5: z.string().trim().optional().default(''),
  final_root_cause: z.string().trim().optional().default(''),
});

export const capaFishboneSchema = z.object({
  Man: z.string().trim().optional().default(''),
  Machine: z.string().trim().optional().default(''),
  Method: z.string().trim().optional().default(''),
  Material: z.string().trim().optional().default(''),
  Measurement: z.string().trim().optional().default(''),
  Environment: z.string().trim().optional().default(''),
});

export const capaInvestigationSchema = z.object({
  capa_id: z.string().trim().min(1, 'CAPA ID is required'),
  investigation_date: z.string().trim().min(1, 'Investigation date is required'),
  investigator: z.string().trim().min(1, 'Investigator is required'),
  investigator_name: z.string().trim().optional().default(''),
  department: z.string().trim().min(1, 'Department is required'),
  problem_statement: z.string().trim().min(10, 'Problem statement is required'),
  observed_issue: z.string().trim().optional().default(''),
  issue_description: z.string().trim().optional().default(''),
  immediate_containment_action: z.string().trim().optional().default(''),
  root_cause_method: methodEnum,
  root_cause_category: categoryEnum,
  root_cause_description: z.string().trim().min(5, 'Root cause description is required'),
  contributing_factors: z.string().trim().optional().default(''),
  evidence_summary: z.string().trim().optional().default(''),
  risk_assessment_result: z.string().trim().optional().default(''),
  corrective_action_recommendation: z.string().trim().optional().default(''),
  preventive_action_recommendation: z.string().trim().optional().default(''),
  investigation_conclusion: z.string().trim().min(10, 'Investigation conclusion is required'),
  five_why: capaFiveWhySchema.optional(),
  fishbone: capaFishboneSchema.optional(),
});

export const capaInvestigationDraftSchema = capaInvestigationSchema.partial({
  problem_statement: true,
  root_cause_method: true,
  root_cause_description: true,
  investigation_conclusion: true,
  investigator: true,
});

export const capaInvestigationQaReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  qa_review_comments: z.string().trim().min(3, 'QA review comments are required'),
});

export type CapaInvestigationInput = z.infer<typeof capaInvestigationSchema>;
export type CapaInvestigationQaReviewInput = z.infer<typeof capaInvestigationQaReviewSchema>;
