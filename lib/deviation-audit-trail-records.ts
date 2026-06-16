import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { DEVIATION_COLLECTIONS } from '@/lib/deviation-types';

export const AUDIT_TRAIL_MODULE = 'Deviation Audit Trail';

export const DEVIATION_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'Investigation Started',
  'RCA Updated',
  'Impact Assessment Updated',
  'CAPA Linked',
  'CAPA Unlinked',
  'Approved',
  'Rejected',
  'Sent Back',
  'Closed',
  'Reopened',
  'Attachment Uploaded',
  'Attachment Deleted',
  'E-Signature Applied',
  'Exported',
] as const;

export const DEVIATION_AUDIT_MODULES = [
  'Deviation',
  'Deviation Management',
  'Deviation Investigation',
  'Deviation Impact Assessment',
  'Deviation CAPA Link',
  'Deviation Approval',
  'Deviation Closure',
  'Deviation Trend Analysis',
  'Deviation Reports & Analytics',
  'Deviation Audit Trail',
] as const;

const DEVIATION_COLLECTION_NAMES = new Set(Object.values(DEVIATION_COLLECTIONS));

export type ReportActor = { id: string; name: string; role?: string; department?: string };

export interface DeviationAuditEntry {
  id: string;
  audit_id: string;
  deviation_id: string;
  deviation_number: string;
  module_name: string;
  action_type: string;
  action_description: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_by_name: string;
  changed_by_role: string;
  department: string;
  reason: string;
  ip_address: string;
  device_info: string;
  date_time: string;
  status: string;
}

export interface DeviationAuditFilters {
  search?: string;
  action_type?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    Create: 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    Update: 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    submit: 'Submitted',
    INVESTIGATION_STARTED: 'Investigation Started',
    RCA_UPDATED: 'RCA Updated',
    IMPACT_ASSESSMENT_UPDATED: 'Impact Assessment Updated',
    CAPA_LINKED: 'CAPA Linked',
    CAPA_UNLINKED: 'CAPA Unlinked',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    Reject: 'Rejected',
    SENT_BACK: 'Sent Back',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    ATTACHMENT_UPLOAD: 'Attachment Uploaded',
    ATTACHMENT_UPLOADED: 'Attachment Uploaded',
    ATTACHMENT_DELETE: 'Attachment Deleted',
    ATTACHMENT_DELETED: 'Attachment Deleted',
    E_SIGNATURE: 'E-Signature Applied',
    'E-Signature Applied': 'E-Signature Applied',
    EXPORT: 'Exported',
    export: 'Exported',
    'exported PDF': 'Exported',
    'exported Excel': 'Exported',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapToDeviationAuditEntry(
  raw: Record<string, unknown>,
  deviationId?: string,
  deviationNumber?: string,
): DeviationAuditEntry {
  const normalized = normalizeAuditTrailEntry(raw);
  return toDeviationAuditEntry(normalized, deviationId, deviationNumber);
}

export function toDeviationAuditEntry(
  entry: AuditTrailEntry,
  deviationId?: string,
  deviationNumber?: string,
): DeviationAuditEntry {
  const action = normalizeActionType(entry.actionType || entry.action || '');
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    deviation_id: deviationId || entry.recordId || entry.documentId || '',
    deviation_number: deviationNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'Deviation',
    action_type: action,
    action_description: entry.actionDescription || action,
    field_name: entry.fieldName || '',
    old_value: stringifyValue(entry.oldValue),
    new_value: stringifyValue(entry.newValue),
    changed_by: entry.changedByUserId || entry.userId || '',
    changed_by_name: entry.changedByUserName || entry.userName || 'System',
    changed_by_role: entry.changedByRole || '',
    department: entry.department || '',
    reason: entry.reasonForChange || entry.reason || '',
    ip_address: entry.ipAddress || '',
    device_info: entry.deviceInfo || entry.device || '',
    date_time: entry.dateTime || entry.timestamp || '',
    status: entry.status || 'Success',
  };
}

export function isDeviationAuditEntry(
  entry: AuditTrailEntry,
  deviationId?: string,
  deviationNumber?: string,
): boolean {
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isDeviationModule = DEVIATION_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('deviation');
  const collectionMatch = DEVIATION_COLLECTION_NAMES.has(entry.collectionName as typeof DEVIATION_COLLECTIONS[keyof typeof DEVIATION_COLLECTIONS]);
  if (deviationId) {
    if (entry.recordId === deviationId || entry.documentId === deviationId) return true;
  }
  if (deviationNumber && entry.documentNumber === deviationNumber) return true;
  return isDeviationModule || collectionMatch;
}

export function applyDeviationAuditFilters(
  entries: DeviationAuditEntry[],
  filters: DeviationAuditFilters,
): DeviationAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q
      || e.action_type.toLowerCase().includes(q)
      || e.action_description.toLowerCase().includes(q)
      || e.field_name.toLowerCase().includes(q)
      || e.changed_by_name.toLowerCase().includes(q)
      || e.old_value.toLowerCase().includes(q)
      || e.new_value.toLowerCase().includes(q)
      || e.deviation_number.toLowerCase().includes(q);
    const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
    const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
    const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
    const matchStart = !filters.start_date || e.date_time >= filters.start_date;
    const matchEnd = !filters.end_date || e.date_time <= `${filters.end_date}T23:59:59.999Z`;
    return matchSearch && matchAction && matchUser && matchDept && matchStart && matchEnd;
  });
}

export function filterDeviationAuditByRole(
  entries: DeviationAuditEntry[],
  role?: string | null,
  userDepartment?: string,
  userId?: string,
): DeviationAuditEntry[] {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)) {
    return entries;
  }
  return entries.filter((e) =>
    e.changed_by === userId
    || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
  );
}

export function canViewDeviationAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['qc_manager', 'qc', 'production_manager', 'production', 'engineering_manager', 'engineering', 'warehouse_manager', 'warehouse'].includes(r);
}

export function canExportDeviationAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isDeviationAuditReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'CAPA Linked': 'bg-orange-100 text-orange-800 border-orange-200',
    'Attachment Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Attachment Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function toTimelineEvents(entries: DeviationAuditEntry[]) {
  return [...entries]
    .sort((a, b) => a.date_time.localeCompare(b.date_time))
    .map((e) => ({
      date: e.date_time,
      title: e.action_type,
      description: e.field_name
        ? `${e.field_name}: ${e.old_value ? `${e.old_value.slice(0, 60)} → ` : ''}${e.new_value.slice(0, 60)}`
        : (e.action_description || e.reason || '').slice(0, 120),
      user: e.changed_by_name,
      action: e.action_type,
      module: e.module_name,
    }));
}

export function exportDeviationAuditCsv(entries: DeviationAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'Deviation ID', 'Deviation Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Date Time', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.deviation_id, e.deviation_number, e.module_name, e.action_type, e.action_description,
    e.field_name, e.old_value, e.new_value, e.changed_by_name, e.changed_by_role, e.department, e.reason,
    e.ip_address, e.device_info, e.date_time, e.status,
  ]);
  return { headers, rows };
}
