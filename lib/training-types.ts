export const TMS_COLLECTIONS = {
  master: 'training_master',
  assignments: 'training_assignments',
  assessments: 'training_assessments',
  effectiveness: 'training_effectiveness',
  matrix: 'training_matrix',
  competency: 'competency_records',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  users: 'users',
  profiles: 'profiles',
  dmsLinks: 'document_training_links',
  changeControls: 'change_controls',
  capa: 'capa_records',
} as const;

export const TRAINING_TYPES = [
  'SOP Training', 'GMP Training', 'GDP Training', 'CSV Training', 'Data Integrity Training',
  'Safety Training', 'Process Training', 'Equipment Training', 'Validation Training',
  'CAPA Training', 'Deviation Training',
] as const;

export const TRAINING_CATEGORIES = [
  'Initial', 'Refresher', 'Retraining', 'On-the-Job', 'Read & Understand', 'Classroom', 'Other',
] as const;

export const TMS_DEPARTMENTS = [
  'Production', 'QC', 'QA', 'Engineering', 'Warehouse', 'Regulatory',
  'Microbiology', 'Packaging', 'Maintenance', 'IT / CSV', 'HR', 'PQR', 'CPV',
] as const;

export const MASTER_STATUSES = ['Active', 'Inactive'] as const;
export const ASSIGNMENT_STATUSES = ['pending', 'in_progress', 'completed', 'overdue', 'failed', 'retraining'] as const;
export const ASSESSMENT_TYPES = ['MCQ', 'Written', 'Practical'] as const;
export const EFFECTIVENESS_RESULTS = ['Effective', 'Partially Effective', 'Not Effective'] as const;
export const COMPETENCY_LEVELS = ['Novice', 'Basic', 'Competent', 'Proficient', 'Expert'] as const;

export type TrainingType = typeof TRAINING_TYPES[number];
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number];
export type AssessmentType = typeof ASSESSMENT_TYPES[number];
export type EffectivenessResult = typeof EFFECTIVENESS_RESULTS[number];

export interface TmsActor {
  id: string;
  name: string;
  role: string;
}

export interface TrainingMaster {
  id: string;
  training_code: string;
  training_title: string;
  training_type: TrainingType | string;
  department: string;
  category: string;
  training_duration: string;
  trainer_name: string;
  training_material: string;
  assessment_required: boolean;
  passing_percentage: number;
  retraining_frequency: string;
  status: string;
  linked_document_id: string | null;
  linked_capa_id: string | null;
  linked_change_control_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingAssignment {
  id: string;
  training_number: string;
  training_master_id: string;
  training_title: string;
  training_type: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  assigned_date: string;
  due_date: string;
  completion_date: string | null;
  assessment_score: number | null;
  pass_fail: string | null;
  trainer_name: string;
  status: AssignmentStatus | string;
  source: string;
  source_ref: string | null;
  retraining_of: string | null;
  created_by: string;
  created_by_name: string;
  updated_at: string;
}

export interface AssessmentQuestion {
  id: string;
  training_master_id: string;
  question: string;
  options: string[];
  correct_answer: string;
  marks: number;
  assessment_type: AssessmentType | string;
  created_at: string;
}

export interface AssessmentAttempt {
  id: string;
  assignment_id: string;
  employee_id: string;
  answers: Record<string, string>;
  score: number;
  percentage: number;
  pass_fail: string;
  attempted_at: string;
}

export interface TrainingEffectiveness {
  id: string;
  assignment_id: string;
  training_number: string;
  employee_id: string;
  employee_name: string;
  assessment_score: number | null;
  practical_observation: string;
  supervisor_feedback: string;
  effectiveness_result: EffectivenessResult | string;
  evaluated_by: string;
  evaluated_by_name: string;
  evaluated_at: string;
}

export interface TrainingMatrixRow {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  required_trainings: string[];
  completed_trainings: string[];
  pending_trainings: string[];
  overdue_trainings: string[];
  compliance_percent: number;
  updated_at: string;
}

export interface CompetencyRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  skill: string;
  competency_level: string;
  required_level: string;
  current_level: string;
  gap: string;
  training_required: boolean;
  linked_training_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TmsFilters {
  status?: string;
  department?: string;
  training_type?: string;
  search?: string;
}

export interface TmsDashboardMetrics {
  totalEmployees: number;
  compliancePercent: number;
  pending: number;
  overdue: number;
  effective: number;
  failedAssessments: number;
  retrainingRequired: number;
}

export interface EmployeeProfile {
  id: string;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  email: string;
}

export function isTmsReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageTraining(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive'].includes(role);
}

export function canAssignTraining(role: string): boolean {
  return canManageTraining(role) || ['production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

export function canEvaluateTraining(role: string): boolean {
  return canManageTraining(role) || role === 'admin';
}

export function calcCompliance(completed: number, required: number): number {
  if (required === 0) return 100;
  return Math.round((completed / required) * 100);
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (['completed', 'failed'].includes(status)) return false;
  return new Date(dueDate) < new Date();
}

export function calcPassFail(score: number, passingPercent: number): string {
  return score >= passingPercent ? 'Pass' : 'Fail';
}
