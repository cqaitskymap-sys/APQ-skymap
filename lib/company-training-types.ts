/**
 * Company Training Management — taxonomy & workflow types
 * Based on internal pharma training SOP process:
 * Internal/External → subtypes → HR induction → TNI from JD → SOP → evaluation
 */

export const COMPANY_TRAINING_MODULE = 'Company Training Management';

export const COMPANY_TRAINING_COLLECTIONS = {
  trainerCertifications: 'trainer_certifications',
  trainerAssessments: 'trainer_assessment_checklists',
  inductionRecords: 'induction_records',
  tniRecords: 'training_needs_identification',
  jobDescriptions: 'job_descriptions',
  ojtPlans: 'ojt_training_plans',
  ojtMatrix: 'ojt_competency_matrix',
  srdDeclarations: 'self_reading_declarations',
} as const;

/** Top-level classification */
export const TRAINING_CLASSIFICATION = ['Internal', 'External'] as const;
export type TrainingClassification = typeof TRAINING_CLASSIFICATION[number];

/** Internal training subtypes per company SOP */
export const INTERNAL_TRAINING_TYPES = [
  'Induction',
  'Training of New Joinee',
  'Refresher Training',
  'On-Job Training',
  'Need Based Training',
  'Self Reading Declaration',
] as const;
export type InternalTrainingType = typeof INTERNAL_TRAINING_TYPES[number];

export const EXTERNAL_TRAINING_TYPES = [
  'External Seminar',
  'External Workshop',
  'Vendor Training',
  'Regulatory Training',
  'Conference',
] as const;
export type ExternalTrainingType = typeof EXTERNAL_TRAINING_TYPES[number];

/** Evaluation methods per company process */
export const EVALUATION_METHODS = [
  'Questionnaire',
  'Training Attendance Record',
  'Training Record',
] as const;
export type EvaluationMethod = typeof EVALUATION_METHODS[number];

/** Induction workflow stages: HR → Dept Head → TC → TNI → SOP */
export const INDUCTION_STAGES = [
  'HR Induction',
  'Department Handover',
  'JD Preparation',
  'TNI Preparation',
  'SOP Training Assignment',
  'Completed',
] as const;
export type InductionStage = typeof INDUCTION_STAGES[number];

export const INDUCTION_STATUSES = [
  'Draft', 'HR In Progress', 'Pending Dept Head', 'Pending TC',
  'TNI In Progress', 'SOP Assigned', 'Completed', 'Cancelled',
] as const;
export type InductionStatus = typeof INDUCTION_STATUSES[number];

/** TNI statuses */
export const TNI_STATUSES = [
  'Draft', 'Pending Review', 'Approved', 'SOP Mapped', 'Training Assigned', 'Closed',
] as const;
export type TniStatus = typeof TNI_STATUSES[number];

/** Trainer certification statuses */
export const TRAINER_CERT_STATUSES = [
  'Draft', 'Assessment Pending', 'Certified', 'Expiring Soon', 'Expired', 'Revoked',
] as const;
export type TrainerCertStatus = typeof TRAINER_CERT_STATUSES[number];

/** OJT plan statuses */
export const OJT_STATUSES = [
  'Draft', 'Planned', 'In Progress', 'Mentor Review', 'Completed', 'Cancelled',
] as const;
export type OjtStatus = typeof OJT_STATUSES[number];

/** SRD statuses */
export const SRD_STATUSES = [
  'Draft', 'Pending Declaration', 'Declared', 'QA Review', 'Approved', 'Rejected',
] as const;
export type SrdStatus = typeof SRD_STATUSES[number];

/** Minimum designation level for SRD per company SOP */
export const SRD_MIN_DESIGNATIONS = [
  'Assistant Manager', 'Manager', 'Senior Manager', 'General Manager',
  'Department Head', 'Head QA', 'Head QC', 'Head Production',
] as const;

/** Trainer assessment checklist items */
export const TRAINER_ASSESSMENT_CHECKLIST = [
  { id: 'subject_knowledge', label: 'Subject matter knowledge demonstrated', weight: 20 },
  { id: 'presentation_skills', label: 'Presentation and communication skills', weight: 15 },
  { id: 'training_methodology', label: 'Training methodology and delivery technique', weight: 15 },
  { id: 'gmp_awareness', label: 'GMP and regulatory awareness', weight: 15 },
  { id: 'documentation', label: 'Training documentation and record keeping', weight: 10 },
  { id: 'assessment_capability', label: 'Ability to conduct assessment/evaluation', weight: 10 },
  { id: 'practical_demonstration', label: 'Practical demonstration capability', weight: 10 },
  { id: 'trainee_feedback', label: 'Positive trainee feedback received', weight: 5 },
] as const;

export interface CompanyTrainingActor {
  id: string;
  name: string;
  role: string;
  department?: string;
}

// ─── Train the Trainer ───────────────────────────────────────────

export interface TrainerCertification {
  id: string;
  certification_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  subject_areas: string[];
  assessment_score: number | null;
  passing_score: number;
  checklist_scores: Record<string, number>;
  certified_by: string;
  certified_by_name: string;
  certification_date: string;
  expiry_date: string;
  status: TrainerCertStatus | string;
  certificate_url: string | null;
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
}

export interface TrainerAssessmentChecklist {
  id: string;
  trainer_id: string;
  trainer_name: string;
  assessor_id: string;
  assessor_name: string;
  assessment_date: string;
  items: { item_id: string; label: string; score: number; max_score: number; remarks: string }[];
  total_score: number;
  max_total: number;
  result: 'Pass' | 'Fail' | 'Pending';
  remarks: string;
  created_at: string;
}

// ─── Induction Workflow ──────────────────────────────────────────

export interface InductionRecord {
  id: string;
  induction_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  joining_date: string;
  current_stage: InductionStage | string;
  status: InductionStatus | string;
  hr_conducted_by: string;
  hr_conducted_by_name: string;
  hr_conducted_date: string | null;
  dept_head_id: string;
  dept_head_name: string;
  dept_handover_date: string | null;
  training_coordinator_id: string;
  training_coordinator_name: string;
  jd_id: string | null;
  jd_number: string;
  tni_id: string | null;
  tni_number: string;
  sop_assignments: string[];
  evaluation_methods: EvaluationMethod[];
  remarks: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_name: string;
}

// ─── TNI (Training Needs Identification) ─────────────────────────

export interface JobDescription {
  id: string;
  jd_number: string;
  department: string;
  designation: string;
  role_title: string;
  responsibilities: string[];
  required_competencies: string[];
  linked_sops: { sop_number: string; sop_title: string; document_id?: string }[];
  prepared_by: string;
  prepared_by_name: string;
  approved_by: string | null;
  status: 'Draft' | 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface TniRecord {
  id: string;
  tni_number: string;
  jd_id: string;
  jd_number: string;
  department: string;
  designation: string;
  employee_id: string | null;
  employee_name: string | null;
  training_needs: {
    sop_number: string;
    sop_title: string;
    training_type: InternalTrainingType | string;
    priority: 'High' | 'Medium' | 'Low';
    evaluation_methods: EvaluationMethod[];
    remarks: string;
  }[];
  prepared_by: string;
  prepared_by_name: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  status: TniStatus | string;
  sop_mapped: boolean;
  training_assigned: boolean;
  created_at: string;
  updated_at: string;
}

// ─── OJT Planner & Matrix ────────────────────────────────────────

export interface OjtTrainingPlan {
  id: string;
  plan_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  mentor_id: string;
  mentor_name: string;
  training_area: string;
  sop_number: string;
  sop_title: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  tasks: {
    task_number: number;
    description: string;
    competency_required: string;
    status: 'Pending' | 'In Progress' | 'Completed' | 'N/A';
    mentor_sign_off: boolean;
    sign_off_date: string | null;
  }[];
  status: OjtStatus | string;
  mentor_remarks: string;
  qa_remarks: string;
  created_at: string;
  updated_at: string;
}

export interface OjtCompetencyMatrixEntry {
  id: string;
  department: string;
  designation: string;
  skill_area: string;
  sop_number: string;
  competency_level: 'Novice' | 'Basic' | 'Competent' | 'Proficient' | 'Expert';
  ojt_required: boolean;
  refresher_frequency: string;
  status: 'Active' | 'Inactive';
}

// ─── Self Reading Declaration ────────────────────────────────────

export interface SrdDeclaration {
  id: string;
  declaration_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  document_number: string;
  document_title: string;
  document_version: string;
  sop_number: string;
  reading_date: string;
  declaration_text: string;
  employee_signature: string | null;
  employee_signed_date: string | null;
  qa_reviewer_id: string | null;
  qa_reviewer_name: string | null;
  qa_review_date: string | null;
  status: SrdStatus | string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

// ─── Dashboard aggregates ─────────────────────────────────────────

export interface CompanyTrainingDashboard {
  totalCertifiedTrainers: number;
  trainerCertExpiring: number;
  activeInductions: number;
  pendingDeptHandover: number;
  activeTniRecords: number;
  sopMappedTni: number;
  activeOjtPlans: number;
  ojtCompleted: number;
  pendingSrdDeclarations: number;
  srdApproved: number;
  internalTrainingBreakdown: { type: string; count: number }[];
  evaluationMethodUsage: { method: string; count: number }[];
  inductionRecords: InductionRecord[];
  certifiedTrainers: TrainerCertification[];
  tniRecords: TniRecord[];
  ojtPlans: OjtTrainingPlan[];
  srdDeclarations: SrdDeclaration[];
}

// ─── Permissions ─────────────────────────────────────────────────

export function canViewCompanyTraining(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa',
    'training_coordinator', 'department_head', 'production_manager', 'qc_manager',
    'engineering_manager', 'warehouse_manager', 'auditor', 'viewer', 'hr'].includes(role);
}

export function canManageCompanyTraining(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(role);
}

export function canConductHrInduction(role: string): boolean {
  return ['super_admin', 'admin', 'hr', 'training_coordinator'].includes(role);
}

export function canApproveDeptHandover(role: string): boolean {
  return ['super_admin', 'admin', 'department_head', 'production_manager',
    'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(role);
}

export function canManageTni(role: string): boolean {
  return ['super_admin', 'admin', 'training_coordinator', 'qa_manager'].includes(role);
}

export function canCertifyTrainer(role: string): boolean {
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(role);
}

export function requiresSrd(designation: string): boolean {
  const d = designation.toLowerCase();
  return SRD_MIN_DESIGNATIONS.some((level) => d.includes(level.toLowerCase()))
    || d.includes('asst manager') || d.includes('assistant manager')
    || d.includes('manager') || d.includes('head');
}

export function generateCertNumber(): string {
  const y = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `TTC-${y}-${seq}`;
}

export function generateInductionNumber(): string {
  const y = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `IND-${y}-${seq}`;
}

export function generateTniNumber(): string {
  const y = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `TNI-${y}-${seq}`;
}

export function generateOjtNumber(): string {
  const y = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `OJT-${y}-${seq}`;
}

export function generateSrdNumber(): string {
  const y = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `SRD-${y}-${seq}`;
}
