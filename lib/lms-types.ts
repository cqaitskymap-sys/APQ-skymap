export const LMS_COLLECTIONS = {
  connections: 'lms_connections',
  courses: 'lms_courses',
  users: 'lms_users',
  trainingRecords: 'lms_training_records',
  syncJobs: 'lms_sync_jobs',
  integrationLogs: 'integration_logs',
  integrationSettings: 'integration_settings',
  certificates: 'training_certificates',
  auditTrail: 'audit_trail',
  notifications: 'notifications',
  eqmsRecords: 'training_records',
  eqmsAssignments: 'training_assignments',
  eqmsUsers: 'users',
  profiles: 'profiles',
} as const;

export const SUPPORTED_LMS_PLATFORMS = [
  'SAP SuccessFactors Learning',
  'Cornerstone OnDemand',
  'Moodle',
  'Docebo',
  'TalentLMS',
  'Absorb LMS',
  'Workday Learning',
  'Microsoft Viva Learning',
  'Oracle Learning',
  'Custom REST API LMS',
] as const;

export const LMS_AUTH_TYPES = [
  'OAuth2',
  'API Key',
  'Basic Authentication',
  'JWT',
  'Bearer Token',
] as const;

export const LMS_SYNC_MODES = ['Manual', 'Scheduled', 'Real-time Webhook'] as const;

export const LMS_SYNC_FREQUENCIES = [
  'On Demand',
  'Hourly',
  'Daily',
  'Weekly',
  'Monthly',
] as const;

export const LMS_SYNC_STATUSES = [
  'Pending',
  'Running',
  'Completed',
  'Failed',
  'Partial Success',
  'Cancelled',
] as const;

export const LMS_CONNECTION_STATUSES = ['Active', 'Inactive', 'Error', 'Testing'] as const;

export const LMS_SYNC_ENTITIES = [
  'Users',
  'Departments',
  'Training Courses',
  'Training Assignments',
  'Training Completion',
  'Assessment Scores',
  'Certificates',
  'Competencies',
  'Learning Paths',
] as const;

export type LmsPlatform = typeof SUPPORTED_LMS_PLATFORMS[number];
export type LmsAuthType = typeof LMS_AUTH_TYPES[number];
export type LmsSyncMode = typeof LMS_SYNC_MODES[number];
export type LmsSyncFrequency = typeof LMS_SYNC_FREQUENCIES[number];
export type LmsSyncStatus = typeof LMS_SYNC_STATUSES[number];
export type LmsConnectionStatus = typeof LMS_CONNECTION_STATUSES[number];
export type LmsSyncEntity = typeof LMS_SYNC_ENTITIES[number];

export interface LmsActor {
  id: string;
  name: string;
  role: string;
}

export interface LmsFieldMapping {
  eqmsField: string;
  lmsField: string;
  transform?: string;
}

export interface LmsConnection {
  id: string;
  connection_id: string;
  connection_name: string;
  lms_name: LmsPlatform | string;
  base_url: string;
  authentication_type: LmsAuthType | string;
  client_id: string;
  client_secret: string;
  api_key: string;
  username: string;
  encrypted_password: string;
  webhook_url: string;
  webhook_secret: string;
  sync_mode: LmsSyncMode | string;
  sync_frequency: LmsSyncFrequency | string;
  sync_entities: LmsSyncEntity[];
  field_mappings: LmsFieldMapping[];
  last_sync: string | null;
  next_sync: string | null;
  status: LmsConnectionStatus | string;
  created_by: string;
  created_by_name: string;
  updated_by: string;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface LmsCourse {
  id: string;
  connection_id: string;
  external_id: string;
  course_code: string;
  course_title: string;
  course_type: string;
  duration_hours: number;
  status: string;
  imported_at: string;
  last_synced: string;
}

export interface LmsUser {
  id: string;
  connection_id: string;
  external_id: string;
  employee_id: string;
  email: string;
  full_name: string;
  department: string;
  status: string;
  imported_at: string;
  last_synced: string;
}

export interface LmsTrainingRecord {
  id: string;
  connection_id: string;
  external_id: string;
  employee_id: string;
  employee_email: string;
  course_id: string;
  course_title: string;
  completion_date: string;
  score: number | null;
  status: string;
  certificate_id: string | null;
  imported_at: string;
  eqms_record_id: string | null;
}

export interface LmsSyncJob {
  id: string;
  job_id: string;
  connection_id: string;
  connection_name: string;
  sync_mode: string;
  status: LmsSyncStatus | string;
  entities: LmsSyncEntity[];
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  records_processed: number;
  records_imported: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  triggered_by: string;
  triggered_by_name: string;
}

export interface IntegrationLog {
  id: string;
  connection_id: string;
  sync_job_id: string | null;
  level: 'info' | 'warn' | 'error' | 'debug';
  action: string;
  message: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface TrainingCertificate {
  id: string;
  connection_id: string;
  external_id: string;
  employee_id: string;
  employee_name: string;
  course_title: string;
  certificate_number: string;
  issued_date: string;
  expiry_date: string | null;
  file_url: string | null;
  imported_at: string;
}

export interface LmsDashboardKpis {
  connectedLms: number;
  coursesImported: number;
  usersSynced: number;
  assignmentsSynced: number;
  certificatesImported: number;
  failedSyncs: number;
  pendingSyncJobs: number;
  todaysSyncJobs: number;
  averageSyncDurationMs: number;
}

export interface LmsDashboardCharts {
  dailySyncTrend: { date: string; count: number; success: number; failed: number }[];
  syncSuccessRate: { name: string; value: number }[];
  courseImportTrend: { date: string; count: number }[];
  certificateImportTrend: { date: string; count: number }[];
  userSyncTrend: { date: string; count: number }[];
  errorDistribution: { name: string; value: number }[];
}

export interface LmsDashboardData {
  kpis: LmsDashboardKpis;
  charts: LmsDashboardCharts;
  connections: LmsConnection[];
  recentSyncJobs: LmsSyncJob[];
  failedSyncJobs: LmsSyncJob[];
  courses: LmsCourse[];
  certificates: TrainingCertificate[];
  logs: IntegrationLog[];
}

export interface LmsFilters {
  connectionId?: string;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SyncProgressState {
  jobId: string;
  status: LmsSyncStatus | string;
  progress: number;
  currentStep: string;
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsFailed: number;
}

export interface ConflictRecord {
  id: string;
  entityType: string;
  externalId: string;
  existingData: Record<string, unknown>;
  incomingData: Record<string, unknown>;
  matchKey: string;
}

export function isLmsReadOnly(role: string): boolean {
  return ['auditor', 'viewer'].includes(role);
}

export function canManageLmsIntegration(role: string): boolean {
  return ['super_admin', 'admin'].includes(role);
}

export function canSyncLms(role: string): boolean {
  return canManageLmsIntegration(role)
    || ['head_qa', 'qa_manager', 'training_coordinator'].includes(role);
}

export function canViewLmsIntegration(role: string): boolean {
  return canSyncLms(role)
    || ['qa_executive', 'qa'].includes(role)
    || isLmsReadOnly(role);
}

export function calcNextSync(frequency: LmsSyncFrequency | string, from = new Date()): string | null {
  const d = new Date(from);
  switch (frequency) {
    case 'Hourly': d.setHours(d.getHours() + 1); break;
    case 'Daily': d.setDate(d.getDate() + 1); break;
    case 'Weekly': d.setDate(d.getDate() + 7); break;
    case 'Monthly': d.setMonth(d.getMonth() + 1); break;
    default: return null;
  }
  return d.toISOString();
}

export function formatSyncDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function generateConnectionId(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `LMS-${year}-${rand}`;
}

export function generateJobId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `SYNC-${ts}`;
}
