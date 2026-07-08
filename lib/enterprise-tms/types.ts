/**
 * Enterprise Pharma Training Management System
 * Compliance: 21 CFR Part 11, EU GMP Annex 11, ALCOA+, ICH Q10/Q9
 */

export const ENTERPRISE_TMS_MODULE = 'Enterprise Training Management System';

export const COMPLIANCE_STANDARDS = [
  'FDA 21 CFR Part 11',
  'EU GMP Annex 11',
  'EU GMP Chapter 2',
  'EU GMP Chapter 4',
  'WHO GMP',
  'PIC/S GMP',
  'ICH Q10',
  'ICH Q9',
  'ALCOA+',
] as const;

export const TMS_ROLES = [
  'Admin', 'HR', 'QA', 'Training Coordinator', 'Department Head', 'Trainer', 'Employee', 'Auditor',
] as const;
export type TmsRole = typeof TMS_ROLES[number];

/** Full enterprise training type taxonomy */
export const ENTERPRISE_TRAINING_TYPES = [
  'Internal', 'External', 'Induction', 'New Joiner', 'Refresher', 'Need Based',
  'On Job Training', 'Self Reading', 'Emergency Training', 'CAPA Training',
  'Deviation Training', 'Change Control Training', 'Validation Training',
  'Equipment Training', 'Safety Training', 'GMP Training', 'GDP Training',
  'CSV Training', 'IT Training', 'Quality Training', 'SOP Training',
] as const;
export type EnterpriseTrainingType = typeof ENTERPRISE_TRAINING_TYPES[number];

/** Need-based training trigger sources */
export const NEED_BASED_TRIGGERS = [
  'CAPA', 'Deviation', 'OOS', 'OOT', 'Change Control', 'Risk Assessment',
  'Audit', 'Vendor Audit', 'Customer Complaint', 'Document Revision',
  'New Equipment', 'New Software', 'Regulatory Update',
] as const;
export type NeedBasedTrigger = typeof NEED_BASED_TRIGGERS[number];

/** Effectiveness review intervals */
export const EFFECTIVENESS_INTERVALS = ['30 Days', '60 Days', '90 Days'] as const;

/** Question types */
export const QUESTION_TYPES = ['MCQ', 'Descriptive', 'Practical', 'True/False', 'Multi-Select'] as const;
export type QuestionType = typeof QUESTION_TYPES[number];

/** Assessment modes */
export const ASSESSMENT_MODES = [
  'Written', 'Practical', 'Observation', 'Checklist', 'Competency', 'Interview',
] as const;

export const ENTERPRISE_TMS_COLLECTIONS = {
  annualPlans: 'annual_training_plans',
  trainingRequests: 'training_requests',
  questionBank: 'question_bank',
  questionnaires: 'questionnaires',
  questionnaireAttempts: 'questionnaire_attempts',
  practicalAssessments: 'practical_assessments',
  trainingSettings: 'training_settings',
  needBasedTraining: 'need_based_training',
  externalTraining: 'external_training_records',
  trainerQualifications: 'trainer_qualifications',
  trainerRenewals: 'trainer_renewals',
  automationLog: 'training_automation_log',
  trainingPlanner: 'training_planner_items',
} as const;

export interface EnterpriseTmsActor {
  id: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
}

export interface AnnualTrainingPlan {
  id: string;
  plan_number: string;
  plan_year: number;
  department: string;
  title: string;
  training_items: {
    training_type: string;
    topic: string;
    target_audience: string;
    planned_month: string;
    trainer: string;
    duration_hours: number;
    status: 'Planned' | 'Scheduled' | 'Completed' | 'Cancelled';
  }[];
  prepared_by: string;
  prepared_by_name: string;
  approved_by: string | null;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Active' | 'Closed';
  created_at: string;
  updated_at: string;
}

export interface TrainingRequest {
  id: string;
  request_number: string;
  requested_by: string;
  requested_by_name: string;
  department: string;
  training_type: string;
  training_topic: string;
  justification: string;
  target_employees: string[];
  preferred_date: string;
  status: 'Draft' | 'Pending HOD' | 'Pending QA' | 'Approved' | 'Rejected' | 'Scheduled' | 'Completed';
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionBankItem {
  id: string;
  question_code: string;
  question_text: string;
  question_type: QuestionType | string;
  options: string[];
  correct_answer: string;
  passing_weight: number;
  training_type: string;
  sop_number: string;
  department: string;
  status: 'Active' | 'Inactive';
  created_at: string;
}

export interface Questionnaire {
  id: string;
  questionnaire_number: string;
  title: string;
  training_master_id: string;
  question_ids: string[];
  passing_percentage: number;
  randomize: boolean;
  time_limit_minutes: number;
  auto_evaluate: boolean;
  e_signature_required: boolean;
  status: 'Draft' | 'Active' | 'Inactive';
  created_at: string;
}

export interface PracticalAssessment {
  id: string;
  assessment_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  sop_number: string;
  assessment_type: string;
  checklist_items: { item: string; score: number; max_score: number; remarks: string }[];
  total_score: number;
  result: 'Pass' | 'Fail' | 'Pending';
  assessor_id: string;
  assessor_name: string;
  assessment_date: string;
  approved_by: string | null;
  status: 'Draft' | 'Completed' | 'Approved';
  created_at: string;
}

export interface NeedBasedTrainingRecord {
  id: string;
  record_number: string;
  trigger_source: NeedBasedTrigger | string;
  source_ref: string;
  source_title: string;
  department: string;
  training_type: string;
  training_topic: string;
  assigned_employees: string[];
  due_date: string;
  status: 'Auto-Generated' | 'Assigned' | 'In Progress' | 'Completed' | 'Closed';
  auto_generated: boolean;
  created_at: string;
}

export interface ExternalTrainingRecord {
  id: string;
  record_number: string;
  employee_id: string;
  employee_name: string;
  department: string;
  training_title: string;
  provider: string;
  training_type: string;
  start_date: string;
  end_date: string;
  certificate_received: boolean;
  certificate_url: string | null;
  cost: number | null;
  status: 'Planned' | 'Completed' | 'Cancelled';
  created_at: string;
}

export interface TrainerQualification {
  id: string;
  trainer_id: string;
  trainer_name: string;
  department: string;
  qualification_type: string;
  experience_years: number;
  subject_areas: string[];
  qualification_date: string;
  expiry_date: string;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Revoked';
  created_at: string;
}

export interface TrainerRenewal {
  id: string;
  renewal_number: string;
  trainer_id: string;
  trainer_name: string;
  previous_cert_number: string;
  renewal_date: string;
  new_expiry_date: string;
  assessment_score: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by: string | null;
  created_at: string;
}

export interface TrainingSettings {
  id: string;
  passing_percentage_default: number;
  certificate_validity_months: number;
  trainer_cert_validity_months: number;
  effectiveness_review_days: number[];
  auto_assign_sop_training: boolean;
  auto_assign_revised_sop: boolean;
  auto_generate_refresher: boolean;
  auto_induction_new_employee: boolean;
  auto_notify_employee: boolean;
  auto_notify_hod: boolean;
  auto_notify_qa: boolean;
  auto_generate_certificate: boolean;
  auto_schedule_renewal: boolean;
  e_signature_required: boolean;
  updated_at: string;
  updated_by: string;
}

export interface TrainingAutomationLog {
  id: string;
  action: string;
  trigger: string;
  source_ref: string;
  records_affected: number;
  status: 'Success' | 'Failed' | 'Partial';
  executed_at: string;
  executed_by: string;
  details: string;
}

export interface EnterpriseTmsDashboard {
  trainingToday: number;
  upcomingTraining: number;
  overdue: number;
  pendingApproval: number;
  certificatesExpiring: number;
  trainerExpiry: number;
  effectivenessPending: number;
  needBasedCount: number;
  ojtActive: number;
  refresherDue: number;
  departmentTraining: { department: string; completed: number; pending: number }[];
  trainingTrend: { month: string; completed: number; assigned: number }[];
  passFailRatio: { pass: number; fail: number };
  competencyLevels: { level: string; count: number }[];
}

export const DEFAULT_TRAINING_SETTINGS: TrainingSettings = {
  id: 'default',
  passing_percentage_default: 80,
  certificate_validity_months: 24,
  trainer_cert_validity_months: 24,
  effectiveness_review_days: [30, 60, 90],
  auto_assign_sop_training: true,
  auto_assign_revised_sop: true,
  auto_generate_refresher: true,
  auto_induction_new_employee: true,
  auto_notify_employee: true,
  auto_notify_hod: true,
  auto_notify_qa: true,
  auto_generate_certificate: true,
  auto_schedule_renewal: true,
  e_signature_required: true,
  updated_at: new Date().toISOString(),
  updated_by: 'system',
};

export function generatePlanNumber(): string {
  return `ATP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
}
export function generateRequestNumber(): string {
  return `TRQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
}
export function generateNeedBasedNumber(): string {
  return `NBT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
}
