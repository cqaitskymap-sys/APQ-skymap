export const STABILITY_COLLECTIONS = {
  studies: 'stability_studies',
  schedules: 'stability_schedules',
  samplePulling: 'stability_sample_pulling',
  results: 'stability_results',
  approvals: 'stability_approvals',
  attachments: 'stability_attachments',
  auditLogs: 'audit_logs',
  notifications: 'notifications',
  batches: 'batches',
  cpvTrends: 'cpv_trends',
  cpvRisk: 'cpv_risk_assessment',
} as const;

export const STUDY_TYPES = [
  'Long Term', 'Accelerated', 'Intermediate', 'Ongoing',
  'Validation Batch', 'PV Batch', 'Commercial Batch',
] as const;

export const STORAGE_CONDITIONS = [
  '25°C / 60% RH', '30°C / 65% RH', '30°C / 75% RH', '40°C / 75% RH', 'Other',
] as const;

export const TESTING_INTERVALS = [
  'Initial', '1 Month', '3 Month', '6 Month', '9 Month', '12 Month',
  '18 Month', '24 Month', '36 Month', '48 Month',
] as const;

export const SAMPLE_PULL_STATUSES = ['Pending', 'Pulled', 'Missed', 'Cancelled'] as const;

export const STABILITY_PARAMETERS = [
  'Description', 'pH', 'Assay', 'Related Substances', 'Dissolution', 'Water Content',
  'Sterility', 'Bacterial Endotoxin', 'Particulate Matter', 'Preservative Content',
  'Extractable Volume', 'Appearance', 'Colour',
] as const;

export const RESULT_STATUSES = ['Complies', 'OOT', 'OOS'] as const;

export const STUDY_STATUSES = [
  'draft', 'approved_protocol', 'study_ongoing', 'sample_due', 'sample_pulled',
  'testing_completed', 'qa_review', 'completed', 'closed', 'cancelled',
] as const;

export type StudyType = typeof STUDY_TYPES[number];
export type StorageCondition = typeof STORAGE_CONDITIONS[number];
export type TestingInterval = typeof TESTING_INTERVALS[number];
export type SamplePullStatus = typeof SAMPLE_PULL_STATUSES[number];
export type StabilityParameter = typeof STABILITY_PARAMETERS[number];
export type ResultStatus = typeof RESULT_STATUSES[number];
export type StudyStatus = typeof STUDY_STATUSES[number];

export interface StabilityActor {
  id: string;
  name: string;
  role: string;
}

export interface StabilityStudy {
  id: string;
  stability_study_number: string;
  product_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  batch_number: string;
  batch_size: string;
  manufacturing_date: string;
  expiry_date: string;
  study_type: StudyType | string;
  storage_condition: StorageCondition | string;
  market: string;
  protocol_number: string;
  protocol_version: string;
  study_initiation_date: string;
  study_end_date: string | null;
  status: StudyStatus | string;
  remarks: string;
  product_id: string | null;
  batch_id: string | null;
  pqr_id: string | null;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface StabilitySchedule {
  id: string;
  study_id: string;
  study_number: string;
  batch_number: string;
  interval: string;
  scheduled_date: string;
  status: 'pending' | 'completed' | 'missed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface StabilitySamplePull {
  id: string;
  study_id: string;
  study_number: string;
  batch_number: string;
  interval: string;
  pulling_due_date: string;
  actual_pulling_date: string | null;
  sample_quantity: string;
  pulled_by: string;
  pulled_by_name: string;
  checked_by: string;
  checked_by_name: string;
  status: SamplePullStatus | string;
  remarks: string;
  created_at: string;
  updated_at: string;
}

export interface StabilityResult {
  id: string;
  study_id: string;
  study_number: string;
  batch_number: string;
  interval: string;
  test_date: string;
  parameter_name: string;
  specification: string;
  spec_lower_limit: number | null;
  spec_upper_limit: number | null;
  observed_result: number | string;
  unit: string;
  result_status: ResultStatus | string;
  analyst: string;
  analyst_name: string;
  reviewed_by: string;
  reviewed_by_name: string;
  attachment_url: string | null;
  remarks: string;
  linked_oos_id: string | null;
  linked_oos_number: string | null;
  cpv_trend_id: string | null;
  cpv_risk_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StabilityApproval {
  id: string;
  study_id: string;
  approval_level: 'protocol' | 'qa_review' | 'head_qa' | 'final';
  approver_id: string;
  approver_name: string;
  approver_role: string;
  decision: 'approved' | 'rejected';
  comments: string;
  e_signature: string;
  signed_at: string;
  created_at: string;
}

export interface StabilityAttachment {
  id: string;
  study_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface StabilityFilters {
  product?: string;
  batch_number?: string;
  study_type?: string;
  storage_condition?: string;
  interval?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface StabilityDashboardMetrics {
  total: number;
  ongoing: number;
  completed: number;
  samplesDue: number;
  missedSamples: number;
  oosResults: number;
  ootResults: number;
  closingThisMonth: number;
}

export const INTERVALS_BY_STUDY_TYPE: Record<string, string[]> = {
  'Long Term': ['Initial', '3 Month', '6 Month', '9 Month', '12 Month', '18 Month', '24 Month', '36 Month'],
  'Accelerated': ['Initial', '1 Month', '3 Month', '6 Month'],
  'Intermediate': ['Initial', '1 Month', '3 Month', '6 Month', '9 Month', '12 Month'],
  'Ongoing': ['Initial', '3 Month', '6 Month', '12 Month'],
  'Validation Batch': ['Initial', '3 Month', '6 Month'],
  'PV Batch': ['Initial', '3 Month', '6 Month', '12 Month'],
  'Commercial Batch': ['Initial', '3 Month', '6 Month', '9 Month', '12 Month', '18 Month', '24 Month', '36 Month', '48 Month'],
};

export function intervalToMonths(interval: string): number {
  if (interval === 'Initial') return 0;
  const match = interval.match(/^(\d+)\s*Month/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function isStudyClosed(status: string): boolean {
  return ['closed', 'cancelled', 'completed'].includes(status);
}

export function isStabilityReadOnly(role: string): boolean {
  return ['auditor', 'viewer', 'production'].includes(role);
}

export function canCreateStudy(role: string): boolean {
  return !['auditor', 'viewer', 'production'].includes(role);
}

export function canEnterResults(role: string): boolean {
  return ['super_admin', 'admin', 'qa', 'qa_manager', 'head_qa', 'qc', 'qc_manager'].includes(role);
}

export function canApproveStudy(role: string): boolean {
  return ['super_admin', 'admin', 'qa', 'qa_manager', 'head_qa'].includes(role);
}

export function parseSpecificationLimits(spec: string): { lsl: number | null; usl: number | null } {
  const nums = spec.match(/-?\d+\.?\d*/g);
  if (!nums || nums.length < 2) return { lsl: null, usl: null };
  const a = parseFloat(nums[0]);
  const b = parseFloat(nums[1]);
  return { lsl: Math.min(a, b), usl: Math.max(a, b) };
}

export function computeStabilityResultStatus(
  observed: number | string,
  lsl: number | null,
  usl: number | null,
  specification: string,
): ResultStatus {
  const numeric = typeof observed === 'number' ? observed : parseFloat(String(observed));
  if (!Number.isFinite(numeric) || lsl === null || usl === null) {
    const specLower = specification.toLowerCase();
    const obsLower = String(observed).toLowerCase();
    if (specLower.includes('pass') || specLower.includes('comply') || specLower.includes('clear')) {
      return obsLower.includes('pass') || obsLower.includes('comply') || obsLower.includes('clear') ? 'Complies' : 'OOS';
    }
    return 'Complies';
  }
  if (numeric < lsl || numeric > usl) return 'OOS';
  const tolerance = usl - lsl;
  const warningBand = tolerance * 0.1;
  if (numeric <= lsl + warningBand || numeric >= usl - warningBand) return 'OOT';
  return 'Complies';
}
