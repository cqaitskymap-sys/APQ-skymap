import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { RECALL_COLLECTIONS } from '@/lib/recall-types';

export const RECALL_AUDIT_TRAIL_MODULE = 'Recall Audit Trail';

export const RECALL_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'Recall Initiated',
  'Distribution Added',
  'Recovery Updated',
  'Regulatory Notification Submitted',
  'Authority Response Received',
  'CAPA Linked',
  'CAPA Unlinked',
  'Approved',
  'Rejected',
  'Sent Back',
  'Closed',
  'Reopened',
  'Attachment Uploaded',
  'Attachment Deleted',
  'Customer Notified',
  'Distributor Notified',
  'E-Signature Applied',
  'Exported',
] as const;

export const RECALL_AUDIT_MODULES = [
  'Recall',
  'Recall Create',
  'Recall Dashboard',
  'Recall Recovery',
  'Recall Distribution',
  'Recall Regulatory',
  'Recall Closure',
  'Recall Reports',
  'Recall Trend Analysis',
  'Recall Audit Trail',
  'Product Recall',
] as const;

export const RECALL_TIMELINE_SECTIONS = [
  'Recall Creation',
  'Distribution Activities',
  'Recovery Activities',
  'Customer Notifications',
  'Regulatory Notifications',
  'CAPA Activities',
  'Approval Workflow',
  'Closure Activities',
  'Reopen Activities',
] as const;

const RECALL_COLLECTION_NAMES = new Set(Object.values(RECALL_COLLECTIONS));

export type RecallAuditActor = { id: string; name: string; role?: string; department?: string };

export interface RecallAuditEntry {
  id: string;
  audit_id: string;
  recall_id: string;
  recall_number: string;
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

export interface RecallAuditFilters {
  search?: string;
  recall_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

export interface RecallAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  recoveryActivities: number;
  regulatoryActivities: number;
  capaActivities: number;
  closureActivities: number;
  reopenedRecalls: number;
  exportActivities: number;
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

export function normalizeRecallActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    Create: 'Created',
    'Recall Created': 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    Update: 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    'Recall Initiated': 'Recall Initiated',
    'Draft Saved': 'Updated',
    DISTRIBUTION_ADDED: 'Distribution Added',
    'Distribution Added': 'Distribution Added',
    CUSTOMER_NOTIFIED: 'Customer Notified',
    'Customer Notified': 'Customer Notified',
    DISTRIBUTOR_NOTIFIED: 'Distributor Notified',
    RECOVERY_UPDATED: 'Recovery Updated',
    'Recovery Updated': 'Recovery Updated',
    RECOVERY_CLOSED: 'Recovery Updated',
    EXPORT_REPORT: 'Exported',
    REGULATORY_CREATED: 'Regulatory Notification Submitted',
    REGULATORY_SUBMITTED: 'Regulatory Notification Submitted',
    'Regulatory Notification Submitted': 'Regulatory Notification Submitted',
    REGULATORY_RESPONSE: 'Authority Response Received',
    'Authority Response Received': 'Authority Response Received',
    REGULATORY_UPDATED: 'Updated',
    REGULATORY_FOLLOW_UP: 'Updated',
    REGULATORY_QA_REVIEW: 'Approved',
    REGULATORY_CLOSED: 'Closed',
    REGULATORY_ESIGN: 'E-Signature Applied',
    CAPA_LINKED: 'CAPA Linked',
    'CAPA Linked': 'CAPA Linked',
    CAPA_UNLINKED: 'CAPA Unlinked',
    'CAPA Unlinked': 'CAPA Unlinked',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    Reject: 'Rejected',
    SENT_BACK: 'Sent Back',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    RECALL_CLOSED: 'Closed',
    'Recall Closed': 'Closed',
    CLOSURE_REJECTED: 'Rejected',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    RECALL_REOPENED: 'Reopened',
    'Recall Reopened': 'Reopened',
    ATTACHMENT_UPLOAD: 'Attachment Uploaded',
    ATTACHMENT_UPLOADED: 'Attachment Uploaded',
    ATTACHMENT_DELETE: 'Attachment Deleted',
    ATTACHMENT_DELETED: 'Attachment Deleted',
    ESIGN_SUCCESS: 'E-Signature Applied',
    ESIGN_FAILED: 'E-Signature Applied',
    'E-Signature Applied': 'E-Signature Applied',
    EXPORT: 'Exported',
    export: 'Exported',
    'exported PDF': 'Exported',
    'exported Excel': 'Exported',
    'PDF export clicked': 'Exported',
    'Excel export clicked': 'Exported',
    'Dashboard Viewed': 'Updated',
    'Dashboard Refreshed': 'Updated',
    'Recall Opened': 'Updated',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('distribution')) return 'Distribution Added';
  if (lower.includes('recovery')) return 'Recovery Updated';
  if (lower.includes('customer') && lower.includes('notif')) return 'Customer Notified';
  if (lower.includes('distributor')) return 'Distributor Notified';
  if (lower.includes('regulatory') && lower.includes('response')) return 'Authority Response Received';
  if (lower.includes('regulatory') && lower.includes('submit')) return 'Regulatory Notification Submitted';
  if (lower.includes('regulatory')) return 'Regulatory Notification Submitted';
  if (lower.includes('reopen')) return 'Reopened';
  if (lower.includes('export') || lower.includes('download')) return 'Exported';
  if (lower.includes('capa') && lower.includes('unlink')) return 'CAPA Unlinked';
  if (lower.includes('capa') && lower.includes('link')) return 'CAPA Linked';
  if (lower.includes('e-sign') || lower.includes('esign')) return 'E-Signature Applied';
  if (lower.includes('attach') && lower.includes('upload')) return 'Attachment Uploaded';
  if (lower.includes('attach') && lower.includes('delete')) return 'Attachment Deleted';
  if (lower.includes('initiat')) return 'Recall Initiated';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('reject')) return 'Rejected';
  if (lower.includes('close')) return 'Closed';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapToRecallAuditEntry(
  raw: Record<string, unknown>,
  recallId?: string,
  recallNumber?: string,
): RecallAuditEntry {
  if (raw.deleted === true || raw.isDeleted === true) {
    return toRecallAuditEntry(normalizeAuditTrailEntry({ ...raw, status: 'Deleted' }), recallId, recallNumber);
  }
  const normalized = normalizeAuditTrailEntry(raw);
  return toRecallAuditEntry(normalized, recallId, recallNumber);
}

export function toRecallAuditEntry(
  entry: AuditTrailEntry,
  recallId?: string,
  recallNumber?: string,
): RecallAuditEntry {
  const action = normalizeRecallActionType(entry.actionType || entry.action || '');
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    recall_id: recallId || entry.recordId || entry.documentId || '',
    recall_number: recallNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'Recall',
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

export function isRecallAuditEntry(
  entry: AuditTrailEntry,
  recallId?: string,
  recallNumber?: string,
): boolean {
  if ((entry as AuditTrailEntry & { deleted?: boolean }).deleted) return false;
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isRecallModule = RECALL_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('recall');
  const collectionMatch = RECALL_COLLECTION_NAMES.has(
    entry.collectionName as typeof RECALL_COLLECTIONS[keyof typeof RECALL_COLLECTIONS],
  );
  if (recallId) {
    if (entry.recordId === recallId || entry.documentId === recallId) return true;
  }
  if (recallNumber && entry.documentNumber === recallNumber) return true;
  return isRecallModule || collectionMatch;
}

export function isVisibleRecallAuditEntry(entry: RecallAuditEntry): boolean {
  return entry.status !== 'Deleted' && entry.action_type !== 'Deleted';
}

export function applyRecallAuditFilters(
  entries: RecallAuditEntry[],
  filters: RecallAuditFilters,
): RecallAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries
    .filter(isVisibleRecallAuditEntry)
    .filter((e) => {
      const matchSearch = !q
        || e.action_type.toLowerCase().includes(q)
        || e.action_description.toLowerCase().includes(q)
        || e.field_name.toLowerCase().includes(q)
        || e.changed_by_name.toLowerCase().includes(q)
        || e.old_value.toLowerCase().includes(q)
        || e.new_value.toLowerCase().includes(q)
        || e.recall_number.toLowerCase().includes(q)
        || e.module_name.toLowerCase().includes(q);
      const matchRecall = !filters.recall_number || filters.recall_number === 'all'
        || e.recall_number.toLowerCase().includes(filters.recall_number.toLowerCase());
      const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
      const matchModule = !filters.module_name || filters.module_name === 'all' || e.module_name === filters.module_name;
      const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
      const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
      const matchStart = !filters.start_date || e.date_time >= filters.start_date;
      const matchEnd = !filters.end_date || e.date_time <= `${filters.end_date}T23:59:59.999Z`;
      return matchSearch && matchRecall && matchAction && matchModule && matchUser && matchDept && matchStart && matchEnd;
    });
}

export function filterRecallAuditByRole(
  entries: RecallAuditEntry[],
  role?: string | null,
  options?: { userDepartment?: string; userId?: string; permittedRecallIds?: Set<string> },
): RecallAuditEntry[] {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();

  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor'].includes(r)) {
    return entries;
  }

  if (raw.includes('warehouse')) {
    return entries.filter((e) =>
      e.action_type.includes('Recovery')
      || e.action_type.includes('Distribution')
      || e.action_type.includes('Customer')
      || e.action_type.includes('Distributor')
      || e.module_name.toLowerCase().includes('recovery')
      || e.module_name.toLowerCase().includes('distribution'),
    );
  }

  const { userDepartment, userId, permittedRecallIds } = options || {};
  if (permittedRecallIds?.size) {
    return entries.filter((e) =>
      permittedRecallIds.has(e.recall_id)
      || e.changed_by === userId
      || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
    );
  }
  return entries.filter((e) =>
    e.changed_by === userId
    || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
  );
}

export function canViewRecallAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (!role) return false;
  if (['auditor', 'viewer'].includes(r)) return true;
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs',
    'warehouse_manager', 'warehouse',
  ].includes(r) || raw.includes('warehouse') || raw.includes('regulatory');
}

export function canExportRecallAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs'].includes(r);
}

export function isRecallAuditReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Recall Initiated': 'bg-sky-100 text-sky-800 border-sky-200',
    'Distribution Added': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Recovery Updated': 'bg-purple-100 text-purple-800 border-purple-200',
    'Regulatory Notification Submitted': 'bg-orange-100 text-orange-800 border-orange-200',
    'Authority Response Received': 'bg-amber-100 text-amber-800 border-amber-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'CAPA Linked': 'bg-orange-100 text-orange-800 border-orange-200',
    'CAPA Unlinked': 'bg-rose-100 text-rose-800 border-rose-200',
    'Customer Notified': 'bg-teal-100 text-teal-800 border-teal-200',
    'Distributor Notified': 'bg-teal-100 text-teal-800 border-teal-200',
    'Attachment Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Attachment Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getRecallTimelineSection(entry: RecallAuditEntry): typeof RECALL_TIMELINE_SECTIONS[number] {
  const action = entry.action_type;
  const moduleName = entry.module_name.toLowerCase();
  const desc = entry.action_description.toLowerCase();
  if (action === 'Reopened' || moduleName.includes('reopen') || desc.includes('reopen')) return 'Reopen Activities';
  if (action === 'Closed' || moduleName.includes('closure') || desc.includes('closed')) return 'Closure Activities';
  if (moduleName.includes('approval') || ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(action)) {
    return 'Approval Workflow';
  }
  if (moduleName.includes('capa') || action.includes('CAPA')) return 'CAPA Activities';
  if (action.includes('Regulatory') || action.includes('Authority') || moduleName.includes('regulatory')) {
    return 'Regulatory Notifications';
  }
  if (action.includes('Customer') || action.includes('Distributor') || desc.includes('customer notified')) {
    return 'Customer Notifications';
  }
  if (action.includes('Recovery') || moduleName.includes('recovery')) return 'Recovery Activities';
  if (action.includes('Distribution') || moduleName.includes('distribution')) return 'Distribution Activities';
  return 'Recall Creation';
}

export function groupRecallTimelineBySection(entries: RecallAuditEntry[]): Record<string, RecallAuditEntry[]> {
  const groups: Record<string, RecallAuditEntry[]> = {};
  for (const section of RECALL_TIMELINE_SECTIONS) groups[section] = [];
  for (const entry of entries) {
    const section = getRecallTimelineSection(entry);
    groups[section].push(entry);
  }
  return groups;
}

export function computeRecallAuditDashboard(entries: RecallAuditEntry[]): RecallAuditDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const isRecovery = (e: RecallAuditEntry) =>
    e.action_type.includes('Recovery') || e.action_type.includes('Distribution')
    || e.module_name.toLowerCase().includes('recovery') || e.module_name.toLowerCase().includes('distribution');
  const isRegulatory = (e: RecallAuditEntry) =>
    e.action_type.includes('Regulatory') || e.action_type.includes('Authority')
    || e.module_name.toLowerCase().includes('regulatory');
  const isCapa = (e: RecallAuditEntry) =>
    e.action_type.includes('CAPA') || e.module_name.toLowerCase().includes('capa');
  const isClosure = (e: RecallAuditEntry) =>
    e.action_type === 'Closed' || e.module_name.toLowerCase().includes('closure');
  const isReopen = (e: RecallAuditEntry) => e.action_type === 'Reopened';
  const isExport = (e: RecallAuditEntry) => e.action_type === 'Exported';

  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.date_time.startsWith(today)).length,
    recoveryActivities: entries.filter(isRecovery).length,
    regulatoryActivities: entries.filter(isRegulatory).length,
    capaActivities: entries.filter(isCapa).length,
    closureActivities: entries.filter(isClosure).length,
    reopenedRecalls: entries.filter(isReopen).length,
    exportActivities: entries.filter(isExport).length,
  };
}

export function paginateRecallAuditEntries(entries: RecallAuditEntry[], page: number, pageSize: number) {
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

export function getFieldChangeEntries(entries: RecallAuditEntry[]): RecallAuditEntry[] {
  return entries.filter((e) => Boolean(e.field_name) && (Boolean(e.old_value) || Boolean(e.new_value)));
}

export function getUserActivitySummary(entries: RecallAuditEntry[]): {
  user: string; role: string; count: number; lastActivity: string;
}[] {
  const map = new Map<string, { user: string; role: string; count: number; lastActivity: string }>();
  for (const e of entries) {
    const key = e.changed_by || e.changed_by_name;
    const cur = map.get(key) || { user: e.changed_by_name, role: e.changed_by_role, count: 0, lastActivity: '' };
    cur.count += 1;
    if (!cur.lastActivity || e.date_time > cur.lastActivity) cur.lastActivity = e.date_time;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function getExportHistoryEntries(entries: RecallAuditEntry[]): RecallAuditEntry[] {
  return entries.filter((e) => e.action_type === 'Exported');
}

export function exportRecallAuditCsv(entries: RecallAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'Recall ID', 'Recall Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Timestamp (UTC)', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.recall_id, e.recall_number, e.module_name, e.action_type, e.action_description,
    e.field_name, e.old_value, e.new_value, e.changed_by_name, e.changed_by_role, e.department, e.reason,
    e.ip_address, e.device_info, e.date_time, e.status,
  ]);
  return { headers, rows };
}

export function formatAuditDateTimeLocal(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
