import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { TMS_COLLECTIONS, isTrainingCoordinator } from '@/lib/training-types';
import { TRAINING_APPROVAL_COLLECTIONS } from '@/lib/training-approval-types';

export const TRAINING_AUDIT_MODULE = 'Training Audit Trail';

export const TRAINING_AUDIT_ACTION_TYPES = [
  'Create', 'Update', 'Delete', 'Assign', 'Complete', 'Approve', 'Reject',
  'Issue Certificate', 'Renew Certificate', 'Revoke Certificate',
  'Retraining Assigned', 'Assessment Completed', 'Evaluation Completed',
  'Login', 'Logout', 'Export', 'Print', 'View',
  'E-Signature Applied', 'Submitted', 'Escalated', 'Cancelled',
] as const;

export const TRAINING_AUDIT_MODULES = [
  'Training',
  'Training Management',
  'Training Calendar',
  'Training Approval Workflow',
  'LMS Integration',
  'Training Matrix',
  'Training Reports',
  'Training Audit Trail',
  'Training Completion',
  'Training Effectiveness',
  'Competency Assessment',
] as const;

export const TRAINING_ENTITY_TYPES = [
  'training_assignments',
  'training_records',
  'training_matrix',
  'training_effectiveness',
  'training_certificates',
  'retraining_records',
  'training_events',
  'training_schedule',
  'approval_requests',
  'training_master',
  'competency_records',
  'training_attendance',
] as const;

const TRAINING_COLLECTION_NAMES = new Set<string>([
  ...Object.values(TMS_COLLECTIONS),
  ...Object.values(TRAINING_APPROVAL_COLLECTIONS),
  'lms_connections', 'lms_courses', 'lms_users', 'lms_training_records', 'lms_sync_jobs',
]);

export type TrainingAuditActor = { id: string; name: string; role?: string; department?: string };

export interface TrainingAuditEntry {
  id: string;
  audit_id: string;
  module: string;
  entity_type: string;
  entity_id: string;
  reference_number: string;
  action: string;
  previous_value: string;
  new_value: string;
  changed_field: string;
  reason_for_change: string;
  performed_by: string;
  performed_by_name: string;
  employee_id: string;
  role: string;
  department: string;
  ip_address: string;
  device: string;
  browser: string;
  session_id: string;
  timestamp: string;
  electronic_signature_required: boolean;
  electronic_signature_status: string;
  signature_id: string;
  comments: string;
  status: string;
}

export interface TrainingAuditFilters {
  search?: string;
  module?: string;
  action?: string;
  user_id?: string;
  department?: string;
  entity_type?: string;
  reference_number?: string;
  e_signature_status?: string;
  start_date?: string;
  end_date?: string;
  entity_id?: string;
}

export interface TrainingAuditDashboardKpis {
  totalEvents: number;
  todayEvents: number;
  criticalEvents: number;
  approvals: number;
  rejectedActions: number;
  certificateEvents: number;
  retrainingEvents: number;
  exports: number;
  logins: number;
  electronicSignatures: number;
}

export interface TrainingAuditCharts {
  dailyActivity: { date: string; count: number }[];
  moduleEvents: { name: string; value: number }[];
  actionDistribution: { name: string; value: number }[];
  userActivity: { name: string; value: number }[];
  departmentActivity: { name: string; value: number }[];
  criticalTrend: { date: string; count: number }[];
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

const CRITICAL_ACTIONS = new Set([
  'Delete', 'Reject', 'Revoke Certificate', 'Cancelled', 'Escalated',
]);

export function normalizeTrainingActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Create', create: 'Create', Create: 'Create',
    UPDATE: 'Update', update: 'Update', Update: 'Update',
    DELETE: 'Delete', delete: 'Delete', Delete: 'Delete',
    TRAINING_COMPLETE: 'Complete', 'Training Complete': 'Complete',
    ASSIGN: 'Assign', ASSIGNED: 'Assign', 'Training Assigned': 'Assign',
    APPROVE: 'Approve', APPROVED: 'Approved', Approve: 'Approve', approved: 'Approve',
    REJECT: 'Reject', REJECTED: 'Reject', Reject: 'Reject', rejected: 'Reject',
    EXPORT: 'Export', export: 'Export', Exported: 'Export',
    PRINT: 'Print', print: 'Print',
    VIEW: 'View', view: 'View',
    LOGIN: 'Login', Login: 'Login', LOGOUT: 'Logout', Logout: 'Logout',
    'E-Sign Success': 'E-Signature Applied', 'E-Signature Applied': 'E-Signature Applied',
    'workflow submitted': 'Submitted', submitted: 'Submitted',
    escalated: 'Escalated', cancelled: 'Cancelled',
    'Issue Certificate': 'Issue Certificate', 'Certificate Issued': 'Issue Certificate',
    'Renew Certificate': 'Renew Certificate', 'Revoke Certificate': 'Revoke Certificate',
    'Retraining Assigned': 'Retraining Assigned', RETRAINING: 'Retraining Assigned',
    'Assessment Completed': 'Assessment Completed', 'Evaluation Completed': 'Evaluation Completed',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('complete') && !lower.includes('evaluation')) return 'Complete';
  if (lower.includes('assign')) return 'Assign';
  if (lower.includes('certificate') && lower.includes('issue')) return 'Issue Certificate';
  if (lower.includes('certificate') && lower.includes('renew')) return 'Renew Certificate';
  if (lower.includes('certificate') && lower.includes('revok')) return 'Revoke Certificate';
  if (lower.includes('retrain')) return 'Retraining Assigned';
  if (lower.includes('assessment')) return 'Assessment Completed';
  if (lower.includes('evaluation') || lower.includes('effectiveness')) return 'Evaluation Completed';
  if (lower.includes('export') || lower.includes('download')) return 'Export';
  if (lower.includes('print')) return 'Print';
  if (lower.includes('view') || lower.includes('preview')) return 'View';
  if (lower.includes('approv')) return 'Approve';
  if (lower.includes('reject')) return 'Reject';
  if (lower.includes('login')) return 'Login';
  if (lower.includes('logout')) return 'Logout';
  if (lower.includes('e-sign')) return 'E-Signature Applied';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toTrainingAuditEntry(entry: AuditTrailEntry): TrainingAuditEntry {
  const action = normalizeTrainingActionType(entry.actionType || entry.action || '');
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    module: entry.moduleName || 'Training',
    entity_type: entry.collectionName || '',
    entity_id: entry.recordId || entry.documentId || '',
    reference_number: entry.documentNumber || '',
    action,
    previous_value: stringifyValue(entry.oldValue),
    new_value: stringifyValue(entry.newValue),
    changed_field: entry.fieldName || '',
    reason_for_change: entry.reasonForChange || entry.reason || '',
    performed_by: entry.changedByUserId || entry.userId || '',
    performed_by_name: entry.changedByUserName || entry.userName || 'System',
    employee_id: entry.changedByUserId || entry.userId || '',
    role: entry.changedByRole || '',
    department: entry.department || '',
    ip_address: entry.ipAddress || '',
    device: entry.deviceInfo || entry.device || '',
    browser: entry.browserInfo || '',
    session_id: '',
    timestamp: entry.dateTime || entry.timestamp || '',
    electronic_signature_required: Boolean(entry.eSignatureRequired),
    electronic_signature_status: entry.eSignatureStatus || '',
    signature_id: '',
    comments: entry.actionDescription || '',
    status: entry.status || 'Success',
  };
}

export function mapLegacyLogToTrainingEntry(raw: Record<string, unknown>): TrainingAuditEntry {
  const normalized = normalizeAuditTrailEntry(raw);
  return toTrainingAuditEntry(normalized);
}

export function isTrainingAuditEntry(entry: AuditTrailEntry): boolean {
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isTrainingModule = TRAINING_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('training')
    || moduleName.includes('lms');
  const collectionMatch = TRAINING_COLLECTION_NAMES.has(entry.collectionName);
  return isTrainingModule || collectionMatch;
}

export function applyTrainingAuditFilters(entries: TrainingAuditEntry[], filters: TrainingAuditFilters): TrainingAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q
      || e.action.toLowerCase().includes(q)
      || e.comments.toLowerCase().includes(q)
      || e.changed_field.toLowerCase().includes(q)
      || e.performed_by_name.toLowerCase().includes(q)
      || e.previous_value.toLowerCase().includes(q)
      || e.new_value.toLowerCase().includes(q)
      || e.reference_number.toLowerCase().includes(q)
      || e.module.toLowerCase().includes(q)
      || e.entity_id.toLowerCase().includes(q);
    const matchModule = !filters.module || filters.module === 'all' || e.module === filters.module;
    const matchAction = !filters.action || filters.action === 'all' || e.action === filters.action;
    const matchUser = !filters.user_id || filters.user_id === 'all' || e.performed_by === filters.user_id;
    const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
    const matchEntity = !filters.entity_type || filters.entity_type === 'all' || e.entity_type === filters.entity_type;
    const matchRef = !filters.reference_number || e.reference_number.toLowerCase().includes(filters.reference_number.toLowerCase());
    const matchEntityId = !filters.entity_id || e.entity_id === filters.entity_id;
    const matchEsign = !filters.e_signature_status || filters.e_signature_status === 'all'
      || (filters.e_signature_status === 'required' && e.electronic_signature_required)
      || (filters.e_signature_status === 'signed' && Boolean(e.signature_id || e.electronic_signature_status))
      || (filters.e_signature_status === 'none' && !e.electronic_signature_required);
    const matchStart = !filters.start_date || e.timestamp >= filters.start_date;
    const matchEnd = !filters.end_date || e.timestamp <= `${filters.end_date}T23:59:59.999Z`;
    return matchSearch && matchModule && matchAction && matchUser && matchDept
      && matchEntity && matchRef && matchEntityId && matchEsign && matchStart && matchEnd;
  });
}

export function filterTrainingAuditByRole(
  entries: TrainingAuditEntry[],
  role?: string | null,
  options?: { userDepartment?: string; userId?: string },
): TrainingAuditEntry[] {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) {
    return entries;
  }
  if (isTrainingCoordinator(r)) return entries;
  const { userDepartment, userId } = options || {};
  if (['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)) {
    if (!userDepartment) return entries.filter((e) => e.performed_by === userId);
    return entries.filter((e) =>
      e.performed_by === userId
      || (e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
    );
  }
  return entries.filter((e) => e.performed_by === userId);
}

export function canViewTrainingAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  if (['employee', 'production', 'qc', 'warehouse'].includes(r)) return false;
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa', 'auditor', 'viewer'].includes(r)
    || isTrainingCoordinator(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r);
}

export function canExportTrainingAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r);
}

export function isTrainingAuditReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function isCriticalTrainingEvent(entry: TrainingAuditEntry): boolean {
  return CRITICAL_ACTIONS.has(entry.action) || entry.status === 'Failed';
}

export function computeTrainingAuditKpis(entries: TrainingAuditEntry[]): TrainingAuditDashboardKpis {
  const today = new Date().toISOString().split('T')[0];
  const isApproval = (e: TrainingAuditEntry) => ['Approve', 'Submitted'].includes(e.action);
  const isRejected = (e: TrainingAuditEntry) => e.action === 'Reject';
  const isCert = (e: TrainingAuditEntry) =>
    ['Issue Certificate', 'Renew Certificate', 'Revoke Certificate'].includes(e.action)
    || e.entity_type.includes('certificate');
  const isRetrain = (e: TrainingAuditEntry) =>
    e.action === 'Retraining Assigned' || e.entity_type.includes('retraining');
  const isExport = (e: TrainingAuditEntry) => ['Export', 'Print'].includes(e.action);
  const isLogin = (e: TrainingAuditEntry) => e.action === 'Login';
  const isEsign = (e: TrainingAuditEntry) =>
    e.action === 'E-Signature Applied' || Boolean(e.signature_id || e.electronic_signature_status);

  return {
    totalEvents: entries.length,
    todayEvents: entries.filter((e) => e.timestamp.startsWith(today)).length,
    criticalEvents: entries.filter(isCriticalTrainingEvent).length,
    approvals: entries.filter(isApproval).length,
    rejectedActions: entries.filter(isRejected).length,
    certificateEvents: entries.filter(isCert).length,
    retrainingEvents: entries.filter(isRetrain).length,
    exports: entries.filter(isExport).length,
    logins: entries.filter(isLogin).length,
    electronicSignatures: entries.filter(isEsign).length,
  };
}

export function computeTrainingAuditCharts(entries: TrainingAuditEntry[]): TrainingAuditCharts {
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.push(d.toISOString().slice(0, 10));
  }

  const moduleMap = new Map<string, number>();
  const actionMap = new Map<string, number>();
  const userMap = new Map<string, number>();
  const deptMap = new Map<string, number>();

  entries.forEach((e) => {
     moduleMap.set(e.module, (moduleMap.get(e.module) ?? 0) + 1);
    actionMap.set(e.action, (actionMap.get(e.action) ?? 0) + 1);
    userMap.set(e.performed_by_name || 'System', (userMap.get(e.performed_by_name || 'System') ?? 0) + 1);
    if (e.department) deptMap.set(e.department, (deptMap.get(e.department) ?? 0) + 1);
  });

  return {
    dailyActivity: last7.map((date) => ({
      date: date.slice(5),
      count: entries.filter((e) => e.timestamp.startsWith(date)).length,
    })),
    moduleEvents: Array.from(moduleMap.entries()).map(([name, value]) => ({ name, value })).slice(0, 8),
    actionDistribution: Array.from(actionMap.entries()).map(([name, value]) => ({ name, value })).slice(0, 10),
    userActivity: Array.from(userMap.entries()).map(([name, value]) => ({ name, value })).slice(0, 8),
    departmentActivity: Array.from(deptMap.entries()).map(([name, value]) => ({ name, value })),
    criticalTrend: last7.map((date) => ({
      date: date.slice(5),
      count: entries.filter((e) => e.timestamp.startsWith(date) && isCriticalTrainingEvent(e)).length,
    })),
  };
}

export function paginateTrainingAuditEntries(entries: TrainingAuditEntry[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return {
    items: entries.slice(start, start + pageSize),
    total: entries.length,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(entries.length / pageSize)),
  };
}

export function getEntityHistory(entries: TrainingAuditEntry[], entityId: string): TrainingAuditEntry[] {
  return entries.filter((e) => e.entity_id === entityId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function getUserActivitySummary(entries: TrainingAuditEntry[]) {
  const map = new Map<string, { user: string; role: string; count: number; lastActivity: string }>();
  for (const e of entries) {
    const key = e.performed_by || e.performed_by_name;
    const cur = map.get(key) || { user: e.performed_by_name, role: e.role, count: 0, lastActivity: '' };
    cur.count += 1;
    if (!cur.lastActivity || e.timestamp > cur.lastActivity) cur.lastActivity = e.timestamp;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function exportTrainingAuditCsv(entries: TrainingAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'Module', 'Entity Type', 'Entity ID', 'Reference Number', 'Action',
    'Changed Field', 'Previous Value', 'New Value', 'Reason', 'Performed By', 'Role',
    'Department', 'IP Address', 'Device', 'Browser', 'Timestamp (UTC)', 'E-Sign Status', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.module, e.entity_type, e.entity_id, e.reference_number, e.action,
    e.changed_field, e.previous_value, e.new_value, e.reason_for_change,
    e.performed_by_name, e.role, e.department, e.ip_address, e.device, e.browser,
    e.timestamp, e.electronic_signature_status, e.status,
  ]);
  return { headers, rows };
}

export function formatAuditDateTimeLocal(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch { return iso; }
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Create: 'bg-green-100 text-green-800 border-green-200',
    Update: 'bg-blue-100 text-blue-800 border-blue-200',
    Delete: 'bg-red-100 text-red-800 border-red-200',
    Approve: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Reject: 'bg-red-100 text-red-800 border-red-200',
    Complete: 'bg-lime-100 text-lime-800 border-lime-200',
    Assign: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    Export: 'bg-violet-100 text-violet-800 border-violet-200',
    Print: 'bg-purple-100 text-purple-800 border-purple-200',
    View: 'bg-slate-100 text-slate-700 border-slate-200',
    Login: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'Issue Certificate': 'bg-teal-100 text-teal-800 border-teal-200',
    'Retraining Assigned': 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}
