export const TRAINING_HISTORY_MODULE = 'Employee Training History';

export const HISTORY_STATUSES = [
  'Assigned', 'In Progress', 'Completed', 'Failed', 'Overdue', 'Cancelled', 'Expired', 'Retraining Scheduled',
] as const;

export const HISTORY_TRAINING_TYPES = [
  'Induction', 'GMP', 'GDP', 'Data Integrity', 'CSV', 'Validation', 'Equipment', 'Safety', 'SOP',
  'Quality System', 'CAPA', 'Deviation', 'OOS', 'OOT', 'Risk Management', 'Cyber Security',
] as const;

export type HistoryStatus = typeof HISTORY_STATUSES[number];
export type HistoryTrainingType = typeof HISTORY_TRAINING_TYPES[number];

export interface EmployeeExtendedProfile {
  id: string;
  employee_id: string;
  employee_number: string;
  employee_name: string;
  department: string;
  designation: string;
  role: string;
  location: string;
  joining_date: string;
  reporting_manager: string;
  employment_status: string;
  email: string;
}

export interface TrainingHistoryEntry {
  id: string;
  training_number: string;
  training_topic: string;
  training_type: string;
  training_category: string;
  trainer: string;
  training_mode: string;
  document_number: string;
  document_version: string;
  sop_number: string;
  assignment_date: string;
  training_date: string;
  completion_date: string | null;
  assessment_score: number | null;
  passing_score: number;
  training_result: string;
  competency_level: string;
  certificate_number: string | null;
  certificate_expiry: string | null;
  retraining_required: boolean;
  retraining_due: string | null;
  training_status: HistoryStatus | string;
  employee_id: string;
  employee_name: string;
  department: string;
  source: 'assignment' | 'record' | 'certificate' | 'retraining';
  source_id: string;
  is_overdue: boolean;
  is_expired_cert: boolean;
  created_at: string;
}

export interface AssessmentHistoryEntry {
  id: string;
  training_number: string;
  training_topic: string;
  assessment_score: number | null;
  passing_score: number;
  result: string;
  assessed_at: string;
  trainer: string;
}

export interface CompetencyHistoryEntry {
  id: string;
  skill: string;
  required_level: string;
  current_level: string;
  competency_level: string;
  gap: string;
  updated_at: string;
}

export interface CertificateHistoryEntry {
  id: string;
  certificate_number: string;
  training_topic: string;
  issue_date: string;
  expiry_date: string;
  status: string;
  verification_code: string;
}

export interface RetrainingHistoryEntry {
  id: string;
  retraining_number: string;
  training_topic: string;
  trigger_type: string;
  due_date: string;
  status: string;
  completion_date: string | null;
}

export interface SopRevisionHistoryEntry {
  id: string;
  sop_number: string;
  document_version: string;
  training_topic: string;
  effective_date: string;
  status: string;
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'training' | 'assessment' | 'competency' | 'certificate' | 'retraining' | 'sop' | 'audit';
  status: string;
}

export interface HistoryFilters {
  department?: string;
  employee_id?: string;
  training_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface HistoryDashboardKpis {
  totalTrainings: number;
  completed: number;
  pending: number;
  failed: number;
  overdue: number;
  certificates: number;
  expiredCertificates: number;
  upcomingRetraining: number;
  averageAssessmentScore: number;
  competencyScore: number;
}

export interface HistoryDashboardCharts {
  completionTrend: { month: string; count: number }[];
  assessmentScoreTrend: { month: string; avgScore: number }[];
  competencyTrend: { month: string; percent: number }[];
  certificateExpiryTrend: { month: string; count: number }[];
  trainingTypeDistribution: { name: string; value: number }[];
}

export interface MatrixMappingEntry {
  id: string;
  training_topic: string;
  training_type: string;
  document_number: string;
  sop_number: string;
  training_frequency: string;
  status: string;
  mapped: boolean;
}

export interface EmployeeHistoryData {
  profile: EmployeeExtendedProfile | null;
  kpis: HistoryDashboardKpis;
  charts: HistoryDashboardCharts;
  history: TrainingHistoryEntry[];
  assessments: AssessmentHistoryEntry[];
  competency: CompetencyHistoryEntry[];
  certificates: CertificateHistoryEntry[];
  retraining: RetrainingHistoryEntry[];
  sopRevisions: SopRevisionHistoryEntry[];
  matrixMapping: MatrixMappingEntry[];
  timeline: TimelineEvent[];
  auditEvents: TimelineEvent[];
}

export interface HistoryActor {
  id: string;
  name: string;
  role?: string;
  department?: string;
}

export function mapAssignmentStatus(status: string, dueDate?: string): HistoryStatus {
  const today = new Date().toISOString().slice(0, 10);
  const map: Record<string, HistoryStatus> = {
    pending: 'Assigned',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    retraining: 'Retraining Scheduled',
  };
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  if (dueDate && dueDate < today && !['completed', 'cancelled'].includes(normalized)) {
    return 'Overdue';
  }
  return map[normalized] || map[status] || 'Assigned';
}

export function canViewTrainingHistory(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa', 'training_coordinator',
    'auditor', 'viewer', 'department_head', 'production_manager', 'qc_manager', 'engineering_manager',
    'warehouse_manager', 'employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function canManageTrainingHistory(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'training_coordinator', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function isHistoryReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes((role || '').toLowerCase());
}

export function isEmployeeHistoryView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['employee', 'production', 'qc', 'warehouse'].includes(r) && !canManageTrainingHistory(r);
}

export function isDepartmentHistoryView(role?: string | null): boolean {
  const r = (role || '').toLowerCase();
  return ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)
    && !canManageTrainingHistory(r);
}

export function historyStatusColor(status: string): string {
  const map: Record<string, string> = {
    Assigned: 'bg-amber-100 text-amber-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
    Overdue: 'bg-red-100 text-red-800',
    Cancelled: 'bg-slate-100 text-slate-600',
    Expired: 'bg-red-100 text-red-800',
    'Retraining Scheduled': 'bg-purple-100 text-purple-800',
  };
  return map[status] || map.Assigned;
}
