export const TRAINING_EFFECTIVENESS_MODULE = 'Training Effectiveness & Competency Evaluation';

export const EVALUATION_TYPES = [
  'Written Test', 'Practical Assessment', 'Interview', 'Observation', 'Supervisor Review', 'Online Assessment',
] as const;

export const EVALUATION_METHODS = [
  'Questionnaire', 'Checklist', 'Practical Demo', 'Assessment', 'Interview',
] as const;

export const COMPETENCY_EVAL_LEVELS = [
  'Excellent', 'Competent', 'Needs Improvement', 'Not Competent',
] as const;

export const EVALUATION_RESULTS = ['Pass', 'Fail'] as const;

export const EVALUATION_STATUSES = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Closed'] as const;

export const EFFECTIVENESS_COLLECTION = 'training_effectiveness';

export type EvaluationType = typeof EVALUATION_TYPES[number];
export type EvaluationMethod = typeof EVALUATION_METHODS[number];
export type CompetencyEvalLevel = typeof COMPETENCY_EVAL_LEVELS[number];
export type EvaluationResult = typeof EVALUATION_RESULTS[number];
export type EvaluationStatus = typeof EVALUATION_STATUSES[number];

export interface TrainingEvaluationRecord {
  id: string;
  evaluation_id: string;
  evaluation_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  training_record_id: string;
  assignment_id: string;
  training_number: string;
  training_topic: string;
  document_number: string;
  sop_version: string;
  evaluation_type: EvaluationType | string;
  evaluator: string;
  evaluator_id: string;
  evaluation_date: string;
  method: EvaluationMethod | string;
  passing_score: number;
  obtained_score: number | null;
  result: EvaluationResult | string;
  competency_level: CompetencyEvalLevel | string;
  observation: string;
  corrective_action_required: boolean;
  corrective_action: string;
  reassessment_required: boolean;
  reassessment_date: string | null;
  status: EvaluationStatus | string;
  attachment_url: string | null;
  digital_signature: string | null;
  remarks: string;
  practical_observation: string;
  supervisor_feedback: string;
  effectiveness_result: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface EffectivenessFilters {
  department?: string;
  employee_id?: string;
  evaluation_type?: string;
  result?: string;
  status?: string;
  evaluator?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface EffectivenessDashboardKpis {
  totalEvaluations: number;
  passed: number;
  failed: number;
  pendingApproval: number;
  competentEmployees: number;
  needingRetraining: number;
  upcomingReassessments: number;
}

export interface EffectivenessDashboardCharts {
  passVsFail: { name: string; value: number }[];
  departmentCompetency: { name: string; value: number }[];
  effectivenessTrend: { month: string; count: number }[];
  statusDistribution: { name: string; value: number }[];
}

export interface EffectivenessDashboardData {
  kpis: EffectivenessDashboardKpis;
  charts: EffectivenessDashboardCharts;
  evaluations: TrainingEvaluationRecord[];
  pendingApproval: TrainingEvaluationRecord[];
  upcomingReassessments: TrainingEvaluationRecord[];
  competencyGaps: TrainingEvaluationRecord[];
}

export interface EffectivenessActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function generateEvaluationNumber(): string {
  const year = new Date().getFullYear();
  return `TEVAL-${year}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

export function computeEvaluationResult(obtained: number, passing: number): EvaluationResult {
  return obtained >= passing ? 'Pass' : 'Fail';
}

export function computeCompetencyFromScore(score: number, passing: number): CompetencyEvalLevel {
  if (score >= passing + 15) return 'Excellent';
  if (score >= passing) return 'Competent';
  if (score >= passing - 10) return 'Needs Improvement';
  return 'Not Competent';
}

export function canManageEffectiveness(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator'].includes(r);
}

export function canApproveEffectiveness(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageEffectiveness(r) || ['head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function canEvaluateEffectiveness(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canManageEffectiveness(r) || canApproveEffectiveness(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager', 'supervisor', 'trainer'].includes(r);
}

export function canViewEffectiveness(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return canEvaluateEffectiveness(r) || ['auditor', 'viewer', 'employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function isEffectivenessReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isEmployeeEffectivenessView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['employee', 'production', 'qc', 'warehouse'].includes(r) && !canManageEffectiveness(r);
}

export function evaluationStatusColor(status: string): string {
  const map: Record<string, string> = {
    Draft: 'bg-slate-100 text-slate-600',
    Submitted: 'bg-amber-100 text-amber-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Closed: 'bg-teal-100 text-teal-800',
  };
  return map[status] || map.Draft;
}

export function resultColor(result: string): string {
  return result === 'Pass' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
}

export function competencyColor(level: string): string {
  const map: Record<string, string> = {
    Excellent: 'bg-green-100 text-green-800',
    Competent: 'bg-blue-100 text-blue-800',
    'Needs Improvement': 'bg-amber-100 text-amber-800',
    'Not Competent': 'bg-red-100 text-red-800',
  };
  return map[level] || map.Competent;
}
