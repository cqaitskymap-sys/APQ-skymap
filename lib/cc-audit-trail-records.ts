import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { CC_COLLECTIONS } from '@/lib/change-control-types';

export const AUDIT_TRAIL_MODULE = 'Change Control Audit Trail';

export const CC_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'Impact Assessment Started',
  'Impact Assessment Approved',
  'Risk Assessment Updated',
  'Validation Assessment Updated',
  'Implementation Plan Created',
  'Task Assigned',
  'Task Completed',
  'Training Linked',
  'Document Linked',
  'CAPA Linked',
  'CAPA Unlinked',
  'Approved',
  'Rejected',
  'Sent Back',
  'Implemented',
  'Effectiveness Reviewed',
  'Closed',
  'Reopened',
  'Attachment Uploaded',
  'Attachment Deleted',
  'E-Signature Applied',
  'Exported',
] as const;

export const CC_AUDIT_MODULES = [
  'Change Control',
  'Change Control Audit Trail',
  'Change Impact Assessment',
  'Change Risk Assessment',
  'Validation Assessment',
  'Change Implementation',
  'Change Effectiveness',
  'Change Approval',
  'Change Closure',
] as const;

export const CC_TIMELINE_SECTIONS = [
  'Change Creation',
  'Impact Assessment',
  'Risk Assessment',
  'Validation Assessment',
  'Implementation Activities',
  'Training Activities',
  'Document Revisions',
  'CAPA Activities',
  'Approval Workflow',
  'Effectiveness Review',
  'Closure Activities',
  'Reopen Activities',
] as const;

const CC_COLLECTION_NAMES = new Set([
  ...Object.values(CC_COLLECTIONS),
  'audit_trail',
  'change_closure',
  'validation_assessments',
  'change_implementation_plans',
  'document_revisions',
  'training_records',
]);

export type CcAuditActor = { id: string; name: string; role?: string; department?: string };

export interface CcAuditEntry {
  id: string;
  audit_id: string;
  change_control_id: string;
  change_control_number: string;
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
  browser_info: string;
  date_time: string;
  status: string;
}

export interface CcAuditFilters {
  search?: string;
  change_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
  validation_impact_only?: boolean;
  csv_impact_only?: boolean;
  critical_only?: boolean;
}

export interface CcAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  implementationActivities: number;
  validationActivities: number;
  trainingActivities: number;
  approvalActivities: number;
  closureActivities: number;
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

export function normalizeCcActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    Create: 'Created',
    'Change Created': 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    Update: 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    submit: 'Submitted',
    'Change Submitted': 'Submitted',
    'IMPACT ASSESSMENT': 'Impact Assessment Started',
    'Impact Assessment Started': 'Impact Assessment Started',
    'Impact Assessment Approved': 'Impact Assessment Approved',
    'RISK ASSESSMENT': 'Risk Assessment Updated',
    'Risk Assessment Updated': 'Risk Assessment Updated',
    'VALIDATION': 'Validation Assessment Updated',
    'Validation Assessment Updated': 'Validation Assessment Updated',
    'IMPLEMENTATION PLAN': 'Implementation Plan Created',
    'Implementation Plan Created': 'Implementation Plan Created',
    'TASK ASSIGNED': 'Task Assigned',
    'Task Assigned': 'Task Assigned',
    'TASK COMPLETED': 'Task Completed',
    'Task Completed': 'Task Completed',
    'TRAINING LINKED': 'Training Linked',
    'Training Linked': 'Training Linked',
    'DOCUMENT LINKED': 'Document Linked',
    'Document Linked': 'Document Linked',
    'CAPA LINKED': 'CAPA Linked',
    'CAPA Linked': 'CAPA Linked',
    'CAPA UNLINKED': 'CAPA Unlinked',
    'CAPA Unlinked': 'CAPA Unlinked',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    Reject: 'Rejected',
    SENT_BACK: 'Sent Back',
    'Sent Back': 'Sent Back',
    IMPLEMENTED: 'Implemented',
    Implemented: 'Implemented',
    'EFFECTIVENESS REVIEW': 'Effectiveness Reviewed',
    'Effectiveness Reviewed': 'Effectiveness Reviewed',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    'Change Closed': 'Closed',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    'Change Reopened': 'Reopened',
    ATTACHMENT_UPLOAD: 'Attachment Uploaded',
    ATTACHMENT_UPLOADED: 'Attachment Uploaded',
    ATTACHMENT_DELETE: 'Attachment Deleted',
    ATTACHMENT_DELETED: 'Attachment Deleted',
    E_SIGNATURE: 'E-Signature Applied',
    'E-Sign Success': 'E-Signature Applied',
    'E-Signature Applied': 'E-Signature Applied',
    EXPORT: 'Exported',
    export: 'Exported',
    'exported PDF': 'Exported',
    'exported Excel': 'Exported',
    'PDF exported': 'Exported',
    'Excel exported': 'Exported',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('impact') && lower.includes('approv')) return 'Impact Assessment Approved';
  if (lower.includes('impact')) return 'Impact Assessment Started';
  if (lower.includes('risk')) return 'Risk Assessment Updated';
  if (lower.includes('validat')) return 'Validation Assessment Updated';
  if (lower.includes('implement') && lower.includes('plan')) return 'Implementation Plan Created';
  if (lower.includes('task') && lower.includes('assign')) return 'Task Assigned';
  if (lower.includes('task') && lower.includes('complet')) return 'Task Completed';
  if (lower.includes('training')) return 'Training Linked';
  if (lower.includes('document')) return 'Document Linked';
  if (lower.includes('capa') && lower.includes('unlink')) return 'CAPA Unlinked';
  if (lower.includes('capa')) return 'CAPA Linked';
  if (lower.includes('effectiveness')) return 'Effectiveness Reviewed';
  if (lower.includes('implement')) return 'Implemented';
  if (lower.includes('reopen')) return 'Reopened';
  if (lower.includes('export') || lower.includes('download')) return 'Exported';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('reject')) return 'Rejected';
  if (lower.includes('close')) return 'Closed';
  if (lower.includes('attach') && lower.includes('upload')) return 'Attachment Uploaded';
  if (lower.includes('attach') && lower.includes('delete')) return 'Attachment Deleted';
  if (lower.includes('e-sign')) return 'E-Signature Applied';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapToCcAuditEntry(
  raw: Record<string, unknown>,
  changeId?: string,
  changeNumber?: string,
): CcAuditEntry {
  const normalized = normalizeAuditTrailEntry(raw);
  return toCcAuditEntry(normalized, changeId, changeNumber);
}

export function toCcAuditEntry(
  entry: AuditTrailEntry,
  changeId?: string,
  changeNumber?: string,
): CcAuditEntry {
  const action = normalizeCcActionType(entry.actionType || entry.action || '');
  const description = entry.actionDescription || action;
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    change_control_id: changeId || entry.recordId || entry.documentId || '',
    change_control_number: changeNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'Change Control',
    action_type: action,
    action_description: description,
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
    browser_info: entry.browserInfo || '',
    date_time: entry.dateTime || entry.timestamp || '',
    status: entry.status || 'Success',
  };
}

export function isCcAuditEntry(
  entry: AuditTrailEntry,
  changeId?: string,
  changeNumber?: string,
): boolean {
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isCcModule = CC_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('change control')
    || moduleName.includes('change');
  const collectionMatch = CC_COLLECTION_NAMES.has(entry.collectionName as typeof CC_COLLECTIONS[keyof typeof CC_COLLECTIONS])
    || entry.collectionName === 'audit_trail';
  if (changeId) {
    if (entry.recordId === changeId || entry.documentId === changeId) return true;
  }
  if (changeNumber && entry.documentNumber === changeNumber) return true;
  return isCcModule || collectionMatch;
}

export function isValidationActivity(entry: CcAuditEntry): boolean {
  const text = `${entry.module_name} ${entry.action_type} ${entry.action_description}`.toLowerCase();
  return text.includes('validation') || text.includes('validat');
}

export function isCsvActivity(entry: CcAuditEntry): boolean {
  const text = `${entry.module_name} ${entry.action_type} ${entry.action_description}`.toLowerCase();
  return text.includes('csv') || text.includes('computerized') || text.includes('data integrity');
}

export function isRegulatoryActivity(entry: CcAuditEntry): boolean {
  const text = `${entry.module_name} ${entry.action_type} ${entry.action_description}`.toLowerCase();
  return text.includes('regulatory');
}

export function isTrainingActivity(entry: CcAuditEntry): boolean {
  return entry.action_type === 'Training Linked'
    || entry.module_name.toLowerCase().includes('training');
}

export function applyCcAuditFilters(
  entries: CcAuditEntry[],
  filters: CcAuditFilters,
): CcAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q
      || e.action_type.toLowerCase().includes(q)
      || e.action_description.toLowerCase().includes(q)
      || e.field_name.toLowerCase().includes(q)
      || e.changed_by_name.toLowerCase().includes(q)
      || e.old_value.toLowerCase().includes(q)
      || e.new_value.toLowerCase().includes(q)
      || e.change_control_number.toLowerCase().includes(q)
      || e.module_name.toLowerCase().includes(q);
    const matchCc = !filters.change_number || filters.change_number === 'all'
      || e.change_control_number.toLowerCase().includes(filters.change_number.toLowerCase());
    const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
    const matchModule = !filters.module_name || filters.module_name === 'all' || e.module_name === filters.module_name;
    const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
    const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
    const matchStart = !filters.start_date || (e.date_time && new Date(e.date_time) >= new Date(`${filters.start_date}T00:00:00.000Z`));
    const matchEnd = !filters.end_date || (e.date_time && new Date(e.date_time) <= new Date(`${filters.end_date}T23:59:59.999Z`));
    const matchValidation = !filters.validation_impact_only || isValidationActivity(e);
    const matchCsv = !filters.csv_impact_only || isCsvActivity(e);
    return matchSearch && matchCc && matchAction && matchModule && matchUser && matchDept
      && matchStart && matchEnd && matchValidation && matchCsv;
  });
}

export function filterCcAuditByRole(
  entries: CcAuditEntry[],
  role?: string | null,
  options?: { userDepartment?: string; userId?: string; permittedChangeIds?: Set<string> },
): CcAuditEntry[] {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();

  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r)) {
    return entries;
  }
  if (raw.includes('validation')) {
    return entries.filter(isValidationActivity);
  }
  if (raw.includes('csv')) {
    return entries.filter(isCsvActivity);
  }
  if (raw === 'regulatory_affairs' || raw === 'regulatory') {
    return entries.filter(isRegulatoryActivity);
  }
  if (r === 'auditor' || r === 'viewer') {
    return entries;
  }

  const { userDepartment, userId, permittedChangeIds } = options || {};
  if (permittedChangeIds?.size) {
    return entries.filter((e) =>
      permittedChangeIds.has(e.change_control_id)
      || e.changed_by === userId
      || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
    );
  }
  return entries.filter((e) =>
    e.changed_by === userId
    || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
  );
}

export function canViewCcAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || raw.includes('validation') || raw.includes('csv') || raw === 'regulatory_affairs' || raw === 'regulatory';
}

export function canExportCcAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isCcAuditReadOnly(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return r === 'auditor' || r === 'viewer';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Impact Assessment Started': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Impact Assessment Approved': 'bg-teal-100 text-teal-800 border-teal-200',
    'Risk Assessment Updated': 'bg-violet-100 text-violet-800 border-violet-200',
    'Validation Assessment Updated': 'bg-purple-100 text-purple-800 border-purple-200',
    'Implementation Plan Created': 'bg-orange-100 text-orange-800 border-orange-200',
    'Task Assigned': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Task Completed': 'bg-lime-100 text-lime-800 border-lime-200',
    'Training Linked': 'bg-sky-100 text-sky-800 border-sky-200',
    'Document Linked': 'bg-blue-100 text-blue-800 border-blue-200',
    'CAPA Linked': 'bg-amber-100 text-amber-800 border-amber-200',
    'CAPA Unlinked': 'bg-rose-100 text-rose-800 border-rose-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    'Sent Back': 'bg-orange-100 text-orange-800 border-orange-200',
    Implemented: 'bg-green-100 text-green-800 border-green-200',
    'Effectiveness Reviewed': 'bg-lime-100 text-lime-800 border-lime-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'Attachment Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Attachment Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getTimelineSection(entry: CcAuditEntry): typeof CC_TIMELINE_SECTIONS[number] {
  const action = entry.action_type;
  const moduleName = entry.module_name.toLowerCase();
  if (action === 'Reopened' || moduleName.includes('reopen')) return 'Reopen Activities';
  if (action === 'Closed' || moduleName.includes('closure')) return 'Closure Activities';
  if (moduleName.includes('approval') || ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(action)) {
    return 'Approval Workflow';
  }
  if (moduleName.includes('effectiveness') || action.includes('Effectiveness')) return 'Effectiveness Review';
  if (action.includes('CAPA') || moduleName.includes('capa')) return 'CAPA Activities';
  if (action.includes('Document') || moduleName.includes('document')) return 'Document Revisions';
  if (action.includes('Training') || moduleName.includes('training')) return 'Training Activities';
  if (moduleName.includes('implement') || action.includes('Implementation') || action.includes('Task')) {
    return 'Implementation Activities';
  }
  if (moduleName.includes('validation') || action.includes('Validation')) return 'Validation Assessment';
  if (moduleName.includes('risk') || action.includes('Risk')) return 'Risk Assessment';
  if (moduleName.includes('impact') || action.includes('Impact')) return 'Impact Assessment';
  if (['Created', 'Updated'].includes(action)) return 'Change Creation';
  return 'Change Creation';
}

export function groupTimelineBySection(entries: CcAuditEntry[]): Record<string, CcAuditEntry[]> {
  const groups: Record<string, CcAuditEntry[]> = {};
  for (const section of CC_TIMELINE_SECTIONS) groups[section] = [];
  for (const entry of entries) {
    const section = getTimelineSection(entry);
    groups[section].push(entry);
  }
  return groups;
}

export function computeCcAuditDashboard(entries: CcAuditEntry[]): CcAuditDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const isImplementation = (e: CcAuditEntry) =>
    e.action_type.includes('Implementation') || e.action_type.includes('Task')
    || e.module_name.toLowerCase().includes('implement');
  const isValidation = (e: CcAuditEntry) => isValidationActivity(e);
  const isTraining = (e: CcAuditEntry) => isTrainingActivity(e);
  const isApproval = (e: CcAuditEntry) =>
    ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(e.action_type)
    || e.module_name.toLowerCase().includes('approval');
  const isClosure = (e: CcAuditEntry) =>
    e.action_type === 'Closed' || e.module_name.toLowerCase().includes('closure');
  const isExport = (e: CcAuditEntry) => e.action_type === 'Exported';

  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.date_time.startsWith(today)).length,
    implementationActivities: entries.filter(isImplementation).length,
    validationActivities: entries.filter(isValidation).length,
    trainingActivities: entries.filter(isTraining).length,
    approvalActivities: entries.filter(isApproval).length,
    closureActivities: entries.filter(isClosure).length,
    exportActivities: entries.filter(isExport).length,
  };
}

export function sortCcAuditEntriesDesc(entries: CcAuditEntry[]): CcAuditEntry[] {
  return [...entries].sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''));
}

export function getUniqueAuditUsers(entries: CcAuditEntry[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  for (const e of entries) {
    const id = e.changed_by || e.changed_by_name;
    if (!id) continue;
    map.set(id, e.changed_by_name || id);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function paginateCcAuditEntries(entries: CcAuditEntry[], page: number, pageSize: number) {
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

export function getFieldChangeEntries(entries: CcAuditEntry[]): CcAuditEntry[] {
  return entries.filter((e) => Boolean(e.field_name) && (Boolean(e.old_value) || Boolean(e.new_value)));
}

export function getUserActivitySummary(entries: CcAuditEntry[]): { user: string; role: string; count: number; lastActivity: string }[] {
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

export function getExportHistoryEntries(entries: CcAuditEntry[]): CcAuditEntry[] {
  return entries.filter((e) => e.action_type === 'Exported');
}

export function getValidationActivityEntries(entries: CcAuditEntry[]): CcAuditEntry[] {
  return entries.filter(isValidationActivity);
}

export function exportCcAuditCsv(entries: CcAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'Change Control ID', 'Change Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Browser', 'Timestamp (UTC)', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.change_control_id, e.change_control_number, e.module_name, e.action_type, e.action_description,
    e.field_name, e.old_value, e.new_value, e.changed_by_name, e.changed_by_role, e.department, e.reason,
    e.ip_address, e.device_info, e.browser_info, e.date_time, e.status,
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
