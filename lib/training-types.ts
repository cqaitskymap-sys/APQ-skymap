export const TMS_COLLECTIONS = {
  master: 'training_master',
  assignments: 'training_assignments',
  assessments: 'training_assessments',
  effectiveness: 'training_effectiveness',
  matrix: 'training_matrix',
  competency: 'competency_records',
  records: 'training_records',
  attendance: 'training_attendance',
  auditLogs: 'audit_logs',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  users: 'users',
  profiles: 'profiles',
  documents: 'documents',
  sopManagement: 'sop_management',
  dmsLinks: 'document_training_links',
  changeControls: 'change_controls',
  capa: 'capa_records',
  departments: 'departments',
  designations: 'designations',
  roles: 'roles',
  matrixCompliance: 'training_matrix_compliance',
  events: 'training_events',
  schedule: 'training_schedule',
  rooms: 'training_rooms',
  trainers: 'trainers',
  retrainingRecords: 'retraining_records',
  sessions: 'training_assignments_sessions',
  certificates: 'training_certificates',
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
export const ASSIGNMENT_STATUSES = ['pending', 'in_progress', 'completed', 'overdue', 'failed', 'retraining', 'cancelled'] as const;
export const ASSESSMENT_TYPES = ['MCQ', 'Written', 'Practical'] as const;
export const EFFECTIVENESS_RESULTS = ['Effective', 'Partially Effective', 'Not Effective'] as const;
export const COMPETENCY_LEVELS = ['Novice', 'Basic', 'Competent', 'Proficient', 'Expert'] as const;
export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Excused'] as const;
export const COMPLETION_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Failed', 'Cancelled'] as const;
export const TRAINING_RESULTS = ['Pass', 'Fail', 'Not Applicable'] as const;
export const TRAINING_MODES = ['Classroom', 'On-the-Job', 'Read & Understand', 'Virtual', 'Self-Study', 'Practical'] as const;
export const ASSIGNMENT_TRAINING_MODES = ['Classroom', 'Online', 'On Job Training', 'Self Reading', 'External'] as const;
export const TRAINING_ASSIGNMENT_STATUSES = ['Assigned', 'In Progress', 'Completed', 'Overdue', 'Cancelled'] as const;
export const MATRIX_FREQUENCIES = ['One Time', 'Monthly', 'Quarterly', 'Half Yearly', 'Yearly', 'On Revision', 'As Required'] as const;
export const MATRIX_STATUSES = ['Active', 'Inactive'] as const;

export type TrainingType = typeof TRAINING_TYPES[number];
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number];
export type AssessmentType = typeof ASSESSMENT_TYPES[number];
export type EffectivenessResult = typeof EFFECTIVENESS_RESULTS[number];
export type AttendanceStatus = typeof ATTENDANCE_STATUSES[number];
export type CompletionStatus = typeof COMPLETION_STATUSES[number];
export type TrainingResult = typeof TRAINING_RESULTS[number];
export type TrainingMode = typeof TRAINING_MODES[number];
export type AssignmentTrainingMode = typeof ASSIGNMENT_TRAINING_MODES[number];
export type TrainingAssignmentStatus = typeof TRAINING_ASSIGNMENT_STATUSES[number];
export type MatrixFrequency = typeof MATRIX_FREQUENCIES[number];
export type MatrixStatus = typeof MATRIX_STATUSES[number];

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
  effectiveness_required?: boolean;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingAssignment {
  id: string;
  training_assignment_id?: string;
  training_number: string;
  training_master_id: string;
  training_title: string;
  training_topic?: string;
  training_type: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  document_number?: string;
  document_title?: string;
  sop_version?: string;
  assigned_date: string;
  due_date: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  training_mode?: AssignmentTrainingMode | string;
  completion_date: string | null;
  assessment_score: number | null;
  pass_fail: string | null;
  trainer_name: string;
  status: AssignmentStatus | string;
  training_status?: TrainingAssignmentStatus | string;
  effectiveness_required?: boolean;
  effectiveness_due_date?: string | null;
  remarks?: string;
  source: string;
  source_ref: string | null;
  retraining_of: string | null;
  created_by: string;
  created_by_name: string;
  updated_by?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at: string;
}

export interface TrainingScheduleSession {
  id: string;
  training_master_id: string;
  training_title: string;
  training_type: string;
  department: string;
  trainer_name: string;
  scheduled_date: string;
  scheduled_time: string;
  training_mode: string;
  employee_ids: string[];
  assignment_ids: string[];
  notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingCalendarEvent {
  id: string;
  date: string;
  title: string;
  training_number: string;
  employee_name: string;
  department: string;
  trainer_name: string;
  training_status: string;
  training_mode: string;
  due_date: string;
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

export interface TrainingMatrixDefinition {
  id: string;
  matrix_id: string;
  matrix_code: string;
  department: string;
  designation: string;
  role: string;
  training_topic: string;
  training_type: string;
  document_number: string;
  document_title: string;
  sop_number: string;
  sop_version: string;
  training_required: boolean;
  training_frequency: MatrixFrequency | string;
  initial_training_required: boolean;
  refresher_required: boolean;
  effectiveness_required: boolean;
  trainer_role: string;
  training_duration: string;
  due_days_after_assignment: number;
  status: MatrixStatus | string;
  linked_document_id: string | null;
  linked_training_master_id: string | null;
  skill: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

/** Employee compliance snapshot (computed) */
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

export interface TrainingAttendance {
  id: string;
  training_record_id: string | null;
  assignment_id: string;
  training_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  training_topic: string;
  training_date: string;
  start_time: string;
  end_time: string;
  attendance_status: AttendanceStatus | string;
  trainer: string;
  trainer_verified: boolean;
  trainer_verified_by: string | null;
  trainer_verified_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
}

export interface TrainingRecord {
  id: string;
  training_record_id: string;
  training_number: string;
  assignment_id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  training_topic: string;
  training_type: string;
  document_number: string;
  sop_version: string;
  training_mode: string;
  trainer: string;
  training_date: string;
  start_time: string;
  end_time: string;
  attendance_status: AttendanceStatus | string;
  completion_status: CompletionStatus | string;
  assessment_required: boolean;
  assessment_score: number | null;
  pass_marks: number;
  training_result: TrainingResult | string;
  trainer_comments: string;
  employee_comments: string;
  completion_evidence: string;
  trainer_verified: boolean;
  trainer_verified_by: string | null;
  trainer_verified_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
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
  designation?: string;
  training_type?: string;
  search?: string;
  role?: string;
  document_number?: string;
  sop_number?: string;
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

export function isTrainingCoordinator(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'training_coordinator'].includes(role);
}

export function canManageTraining(role: string): boolean {
  return isTrainingCoordinator(role);
}

export function canAssignTraining(role: string): boolean {
  return canManageTraining(role)
    || canReviewTraining(role)
    || ['production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager', 'department_head'].includes(role);
}

/** Department Head: assign training within their department */
export function canAssignDepartmentTraining(role: string): boolean {
  return canManageTraining(role)
    || canReviewTraining(role)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

/** Employee: no matrix management access — use canViewMatrix */
export function canManageMatrix(role: string): boolean {
  return ['super_admin', 'admin'].includes(role) || isTrainingCoordinator(role);
}

export function canEditMatrix(role: string): boolean {
  return canManageMatrix(role) || canReviewTraining(role);
}

export function canViewMatrix(role: string): boolean {
  if (isEmployeeTrainingView(role) && !canViewDepartmentTraining(role)) return false;
  return canManageMatrix(role) || canReviewTraining(role) || canViewDepartmentTraining(role) || isTmsReadOnly(role);
}

export function canRecommendMatrix(role: string): boolean {
  return ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

/** Employee: view own assignments only */
export function canViewOwnAssignments(role: string): boolean {
  return isEmployeeTrainingView(role);
}

export function canViewTrainingDashboard(role: string): boolean {
  return ['super_admin', 'admin'].includes(role)
    || isTrainingCoordinator(role)
    || canReviewTraining(role)
    || canViewDepartmentTraining(role)
    || isEmployeeTrainingView(role)
    || isTmsReadOnly(role);
}

export function canExportTrainingDashboard(role: string): boolean {
  return ['super_admin', 'admin'].includes(role)
    || isTrainingCoordinator(role)
    || canReviewTraining(role);
}

export function canEvaluateTraining(role: string): boolean {
  return canManageTraining(role) || role === 'admin';
}

/** QA: review and approve training completion records */
export function canReviewTraining(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(role);
}

/** Trainer: mark attendance and record completion */
export function canMarkAttendance(role: string): boolean {
  return isTrainingCoordinator(role)
    || ['production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

export function canCompleteTraining(role: string): boolean {
  return canMarkAttendance(role);
}

/** Department Head: view department training records */
export function canViewDepartmentTraining(role: string): boolean {
  return canManageTraining(role)
    || canReviewTraining(role)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

/** Employee: view own training records only */
export function isEmployeeTrainingView(role: string): boolean {
  return !canViewDepartmentTraining(role) && !isTmsReadOnly(role);
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

export function calcTrainingResult(
  score: number | null,
  passMarks: number,
  assessmentRequired: boolean,
): TrainingResult {
  if (!assessmentRequired || score == null) return 'Not Applicable';
  return score >= passMarks ? 'Pass' : 'Fail';
}

export function mapResultToCompletionStatus(result: TrainingResult | string): CompletionStatus {
  if (result === 'Pass') return 'Completed';
  if (result === 'Fail') return 'Failed';
  return 'In Progress';
}

const STATUS_TO_TRAINING: Record<string, TrainingAssignmentStatus> = {
  pending: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
  failed: 'In Progress',
  retraining: 'Assigned',
  cancelled: 'Cancelled',
};

const TRAINING_TO_STATUS: Record<string, AssignmentStatus> = {
  Assigned: 'pending',
  'In Progress': 'in_progress',
  Completed: 'completed',
  Overdue: 'overdue',
  Cancelled: 'cancelled',
};

export function toTrainingAssignmentStatus(status: string): TrainingAssignmentStatus {
  if ((TRAINING_ASSIGNMENT_STATUSES as readonly string[]).includes(status)) {
    return status as TrainingAssignmentStatus;
  }
  return STATUS_TO_TRAINING[status] ?? 'Assigned';
}

export function fromTrainingAssignmentStatus(trainingStatus: string): AssignmentStatus {
  return TRAINING_TO_STATUS[trainingStatus] ?? 'pending';
}

export function getAssignmentDisplayStatus(a: TrainingAssignment): TrainingAssignmentStatus {
  return toTrainingAssignmentStatus(a.training_status ?? a.status);
}
