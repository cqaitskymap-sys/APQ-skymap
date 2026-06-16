import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { OOS_COLLECTIONS } from '@/lib/oos-types';

export const AUDIT_TRAIL_MODULE = 'OOS Audit Trail';

export const OOS_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'Phase-I Started',
  'Phase-I Completed',
  'Phase-II Started',
  'Phase-II Completed',
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

export const OOS_AUDIT_MODULES = [
  'OOS',
  'OOS Create',
  'OOS Management',
  'OOS Phase-I',
  'OOS Phase-II',
  'OOS Impact Assessment',
  'OOS CAPA',
  'OOS Approval',
  'OOS Closure',
  'OOS Trend Analysis',
  'OOS Reports & Analytics',
  'OOS Audit Trail',
  'OOS Dashboard',
] as const;

export const OOS_TIMELINE_SECTIONS = [
  'OOS Creation',
  'Phase-I Investigation',
  'Phase-II Investigation',
  'Impact Assessment',
  'CAPA Activities',
  'Approval Workflow',
  'Closure Activities',
  'Reopen Activities',
] as const;

const OOS_COLLECTION_NAMES = new Set(Object.values(OOS_COLLECTIONS));

export type ReportActor = { id: string; name: string; role?: string; department?: string };

export interface OosAuditEntry {
  id: string;
  audit_id: string;
  oos_id: string;
  oos_number: string;
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

export interface OosAuditFilters {
  search?: string;
  oos_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

export interface OosAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  approvalActivities: number;
  investigationActivities: number;
  capaActivities: number;
  closureActivities: number;
  reopenedCases: number;
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

export function normalizeOosActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    Create: 'Created',
    'OOS Created': 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    Update: 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    submit: 'Submitted',
    'OOS Submitted': 'Submitted',
    PHASE1_UPDATE: 'Phase-I Started',
    'Phase-I started': 'Phase-I Started',
    'Phase-I submitted to QA': 'Phase-I Completed',
    'Phase-I Completed': 'Phase-I Completed',
    PHASE2_UPDATE: 'Phase-II Started',
    'Phase-II started': 'Phase-II Started',
    'Phase-II submitted to QA': 'Phase-II Completed',
    'Phase-II Completed': 'Phase-II Completed',
    IMPACT_ASSESSMENT: 'Impact Assessment Updated',
    'Impact Assessment Updated': 'Impact Assessment Updated',
    'Impact Assessment Created': 'Impact Assessment Updated',
    'Impact Assessment Submitted': 'Impact Assessment Updated',
    'Risk Calculation Updated': 'Impact Assessment Updated',
    CAPA_LINKED: 'CAPA Linked',
    'CAPA linked to Phase-II': 'CAPA Linked',
    'CAPA Created': 'CAPA Linked',
    'CAPA Linked': 'CAPA Linked',
    CAPA_UNLINKED: 'CAPA Unlinked',
    'CAPA Unlinked': 'CAPA Unlinked',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    'Final Approval': 'Approved',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    Reject: 'Rejected',
    'Closure Rejected': 'Rejected',
    SENT_BACK: 'Sent Back',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    'OOS Closed': 'Closed',
    'Closure Submitted': 'Closed',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    'OOS Reopened': 'Reopened',
    ATTACHMENT_UPLOAD: 'Attachment Uploaded',
    ATTACHMENT_UPLOADED: 'Attachment Uploaded',
    'Phase-I attachment uploaded': 'Attachment Uploaded',
    ATTACHMENT_DELETE: 'Attachment Deleted',
    ATTACHMENT_DELETED: 'Attachment Deleted',
    E_SIGNATURE: 'E-Signature Applied',
    'E-Sign Success': 'E-Signature Applied',
    'E-Signature Applied': 'E-Signature Applied',
    EXPORT: 'Exported',
    export: 'Exported',
    'exported PDF': 'Exported',
    'exported Excel': 'Exported',
    'PDF export clicked': 'Exported',
    'Excel export clicked': 'Exported',
    'export trend report': 'Exported',
    downloaded: 'Exported',
    'report generated': 'Exported',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('phase-i') && lower.includes('complet')) return 'Phase-I Completed';
  if (lower.includes('phase-ii') && lower.includes('complet')) return 'Phase-II Completed';
  if (lower.includes('phase-i') && lower.includes('start')) return 'Phase-I Started';
  if (lower.includes('phase-ii') && lower.includes('start')) return 'Phase-II Started';
  if (lower.includes('reopen')) return 'Reopened';
  if (lower.includes('export') || lower.includes('download')) return 'Exported';
  if (lower.includes('capa') && lower.includes('link')) return 'CAPA Linked';
  if (lower.includes('capa') && lower.includes('unlink')) return 'CAPA Unlinked';
  if (lower.includes('impact')) return 'Impact Assessment Updated';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('reject')) return 'Rejected';
  if (lower.includes('close')) return 'Closed';
  if (lower.includes('attach') && lower.includes('upload')) return 'Attachment Uploaded';
  if (lower.includes('attach') && lower.includes('delete')) return 'Attachment Deleted';
  if (lower.includes('e-sign')) return 'E-Signature Applied';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapToOosAuditEntry(
  raw: Record<string, unknown>,
  oosId?: string,
  oosNumber?: string,
): OosAuditEntry {
  const normalized = normalizeAuditTrailEntry(raw);
  return toOosAuditEntry(normalized, oosId, oosNumber);
}

export function toOosAuditEntry(
  entry: AuditTrailEntry,
  oosId?: string,
  oosNumber?: string,
): OosAuditEntry {
  const action = normalizeOosActionType(entry.actionType || entry.action || '');
  const description = entry.actionDescription || action;
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    oos_id: oosId || entry.recordId || entry.documentId || '',
    oos_number: oosNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'OOS',
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
    date_time: entry.dateTime || entry.timestamp || '',
    status: entry.status || 'Success',
  };
}

export function isOosAuditEntry(
  entry: AuditTrailEntry,
  oosId?: string,
  oosNumber?: string,
): boolean {
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isOosModule = OOS_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('oos');
  const collectionMatch = OOS_COLLECTION_NAMES.has(entry.collectionName as typeof OOS_COLLECTIONS[keyof typeof OOS_COLLECTIONS]);
  if (oosId) {
    if (entry.recordId === oosId || entry.documentId === oosId) return true;
  }
  if (oosNumber && entry.documentNumber === oosNumber) return true;
  return isOosModule || collectionMatch;
}

export function applyOosAuditFilters(
  entries: OosAuditEntry[],
  filters: OosAuditFilters,
): OosAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q
      || e.action_type.toLowerCase().includes(q)
      || e.action_description.toLowerCase().includes(q)
      || e.field_name.toLowerCase().includes(q)
      || e.changed_by_name.toLowerCase().includes(q)
      || e.old_value.toLowerCase().includes(q)
      || e.new_value.toLowerCase().includes(q)
      || e.oos_number.toLowerCase().includes(q)
      || e.module_name.toLowerCase().includes(q);
    const matchOos = !filters.oos_number || filters.oos_number === 'all'
      || e.oos_number.toLowerCase().includes(filters.oos_number.toLowerCase());
    const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
    const matchModule = !filters.module_name || filters.module_name === 'all' || e.module_name === filters.module_name;
    const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
    const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
    const matchStart = !filters.start_date || e.date_time >= filters.start_date;
    const matchEnd = !filters.end_date || e.date_time <= `${filters.end_date}T23:59:59.999Z`;
    return matchSearch && matchOos && matchAction && matchModule && matchUser && matchDept && matchStart && matchEnd;
  });
}

export function filterOosAuditByRole(
  entries: OosAuditEntry[],
  role?: string | null,
  options?: { userDepartment?: string; userId?: string; permittedOosIds?: Set<string> },
): OosAuditEntry[] {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r)) {
    return entries;
  }
  const { userDepartment, userId, permittedOosIds } = options || {};
  if (permittedOosIds?.size) {
    return entries.filter((e) =>
      permittedOosIds.has(e.oos_id)
      || e.changed_by === userId
      || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
    );
  }
  return entries.filter((e) =>
    e.changed_by === userId
    || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
  );
}

export function canViewOosAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['qc_manager', 'qc', 'production_manager', 'production'].includes(r);
}

export function canExportOosAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r);
}

export function isOosAuditReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Phase-I Started': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Phase-I Completed': 'bg-lime-100 text-lime-800 border-lime-200',
    'Phase-II Started': 'bg-orange-100 text-orange-800 border-orange-200',
    'Phase-II Completed': 'bg-amber-100 text-amber-800 border-amber-200',
    'Impact Assessment Updated': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'CAPA Linked': 'bg-orange-100 text-orange-800 border-orange-200',
    'CAPA Unlinked': 'bg-rose-100 text-rose-800 border-rose-200',
    'Attachment Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Attachment Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getTimelineSection(entry: OosAuditEntry): typeof OOS_TIMELINE_SECTIONS[number] {
  const action = entry.action_type;
  const moduleName = entry.module_name.toLowerCase();
  if (action === 'Reopened' || moduleName.includes('reopen')) return 'Reopen Activities';
  if (action === 'Closed' || moduleName.includes('closure')) return 'Closure Activities';
  if (moduleName.includes('approval') || ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(action)) {
    return 'Approval Workflow';
  }
  if (moduleName.includes('capa') || action.includes('CAPA')) return 'CAPA Activities';
  if (moduleName.includes('impact') || action.includes('Impact')) return 'Impact Assessment';
  if (moduleName.includes('phase-ii') || action.includes('Phase-II')) return 'Phase-II Investigation';
  if (moduleName.includes('phase-i') || action.includes('Phase-I')) return 'Phase-I Investigation';
  if (['Created', 'Updated'].includes(action) || moduleName.includes('create')) return 'OOS Creation';
  return 'OOS Creation';
}

export function groupTimelineBySection(entries: OosAuditEntry[]): Record<string, OosAuditEntry[]> {
  const groups: Record<string, OosAuditEntry[]> = {};
  for (const section of OOS_TIMELINE_SECTIONS) groups[section] = [];
  for (const entry of entries) {
    const section = getTimelineSection(entry);
    groups[section].push(entry);
  }
  return groups;
}

export function computeOosAuditDashboard(entries: OosAuditEntry[]): OosAuditDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const isApproval = (e: OosAuditEntry) =>
    ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(e.action_type)
    || e.module_name.toLowerCase().includes('approval');
  const isInvestigation = (e: OosAuditEntry) =>
    e.action_type.includes('Phase-I') || e.action_type.includes('Phase-II')
    || e.module_name.toLowerCase().includes('phase');
  const isCapa = (e: OosAuditEntry) =>
    e.action_type.includes('CAPA') || e.module_name.toLowerCase().includes('capa');
  const isClosure = (e: OosAuditEntry) =>
    e.action_type === 'Closed' || e.module_name.toLowerCase().includes('closure');
  const isReopen = (e: OosAuditEntry) => e.action_type === 'Reopened';
  const isExport = (e: OosAuditEntry) => e.action_type === 'Exported';

  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.date_time.startsWith(today)).length,
    approvalActivities: entries.filter(isApproval).length,
    investigationActivities: entries.filter(isInvestigation).length,
    capaActivities: entries.filter(isCapa).length,
    closureActivities: entries.filter(isClosure).length,
    reopenedCases: entries.filter(isReopen).length,
    exportActivities: entries.filter(isExport).length,
  };
}

export function paginateOosAuditEntries(
  entries: OosAuditEntry[],
  page: number,
  pageSize: number,
) {
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

export function toTimelineEvents(entries: OosAuditEntry[]) {
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

export function exportOosAuditCsv(entries: OosAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'OOS ID', 'OOS Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Date Time (UTC)', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.oos_id, e.oos_number, e.module_name, e.action_type, e.action_description,
    e.field_name, e.old_value, e.new_value, e.changed_by_name, e.changed_by_role, e.department, e.reason,
    e.ip_address, e.device_info, e.date_time, e.status,
  ]);
  return { headers, rows };
}

export function formatAuditDateTimeUtc(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleString(undefined, { timeZoneName: 'short' })} (stored UTC: ${iso.slice(0, 19)}Z)`;
  } catch {
    return iso;
  }
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
