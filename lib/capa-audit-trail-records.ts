import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { CAPA_COLLECTIONS } from '@/lib/capa-types';

export const AUDIT_TRAIL_MODULE = 'CAPA Audit Trail';

export const CAPA_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'Investigation Started',
  'RCA Updated',
  'Corrective Action Added',
  'Preventive Action Added',
  'Action Assigned',
  'Implementation Updated',
  'Evidence Uploaded',
  'Evidence Deleted',
  'Effectiveness Started',
  'Effectiveness Completed',
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

export const CAPA_AUDIT_MODULES = [
  'CAPA',
  'CAPA Create',
  'CAPA Management',
  'CAPA Dashboard',
  'CAPA Investigation',
  'CAPA Corrective Action',
  'CAPA Preventive Action',
  'CAPA Implementation',
  'CAPA Effectiveness',
  'CAPA Approval',
  'CAPA Closure',
  'CAPA Trend Analysis',
  'CAPA Reports & Analytics',
  'CAPA Audit Trail',
] as const;

export const CAPA_TIMELINE_SECTIONS = [
  'CAPA Creation',
  'Investigation & RCA',
  'Corrective Actions',
  'Preventive Actions',
  'Implementation Activities',
  'Effectiveness Review',
  'Approval Workflow',
  'Closure Activities',
  'Reopen Activities',
] as const;

const CAPA_COLLECTION_NAMES = new Set(Object.values(CAPA_COLLECTIONS));

export type CapaAuditActor = { id: string; name: string; role?: string; department?: string };

export interface CapaAuditEntry {
  id: string;
  audit_id: string;
  capa_id: string;
  capa_number: string;
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

export interface CapaAuditFilters {
  search?: string;
  capa_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

export interface CapaAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  implementationActivities: number;
  approvalActivities: number;
  effectivenessActivities: number;
  closureActivities: number;
  reopenedCapa: number;
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

export function normalizeCapaActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    Create: 'Created',
    'CAPA Created': 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    Update: 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    submit: 'Submitted',
    'CAPA Submitted': 'Submitted',
    INVESTIGATION_START: 'Investigation Started',
    'Investigation Started': 'Investigation Started',
    'Investigation started': 'Investigation Started',
    RCA_UPDATE: 'RCA Updated',
    'RCA Updated': 'RCA Updated',
    'Root Cause Updated': 'RCA Updated',
    CORRECTIVE_ACTION: 'Corrective Action Added',
    'Corrective Action Added': 'Corrective Action Added',
    'Corrective action created': 'Corrective Action Added',
    PREVENTIVE_ACTION: 'Preventive Action Added',
    'Preventive Action Added': 'Preventive Action Added',
    'Preventive action created': 'Preventive Action Added',
    ACTION_ASSIGNED: 'Action Assigned',
    'Action Assigned': 'Action Assigned',
    'Owner assigned': 'Action Assigned',
    IMPLEMENTATION_UPDATE: 'Implementation Updated',
    'Implementation Updated': 'Implementation Updated',
    EVIDENCE_UPLOAD: 'Evidence Uploaded',
    'Evidence Uploaded': 'Evidence Uploaded',
    EVIDENCE_DELETE: 'Evidence Deleted',
    'Evidence Deleted': 'Evidence Deleted',
    EFFECTIVENESS_START: 'Effectiveness Started',
    'Effectiveness Started': 'Effectiveness Started',
    EFFECTIVENESS_COMPLETE: 'Effectiveness Completed',
    'Effectiveness Completed': 'Effectiveness Completed',
    'Effectiveness review completed': 'Effectiveness Completed',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    Reject: 'Rejected',
    SENT_BACK: 'Sent Back',
    'Sent Back': 'Sent Back',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    'CAPA Closed': 'Closed',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    'CAPA Reopened': 'Reopened',
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
    'CSV exported': 'Exported',
    'report exported': 'Exported',
    downloaded: 'Exported',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('investigation') && lower.includes('start')) return 'Investigation Started';
  if (lower.includes('root cause') || lower.includes('rca')) return 'RCA Updated';
  if (lower.includes('corrective')) return 'Corrective Action Added';
  if (lower.includes('preventive')) return 'Preventive Action Added';
  if (lower.includes('implement')) return 'Implementation Updated';
  if (lower.includes('evidence') && lower.includes('upload')) return 'Evidence Uploaded';
  if (lower.includes('evidence') && lower.includes('delete')) return 'Evidence Deleted';
  if (lower.includes('effectiveness') && lower.includes('complet')) return 'Effectiveness Completed';
  if (lower.includes('effectiveness') && lower.includes('start')) return 'Effectiveness Started';
  if (lower.includes('reopen')) return 'Reopened';
  if (lower.includes('export') || lower.includes('download')) return 'Exported';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('reject')) return 'Rejected';
  if (lower.includes('close')) return 'Closed';
  if (lower.includes('attach') && lower.includes('upload')) return 'Attachment Uploaded';
  if (lower.includes('attach') && lower.includes('delete')) return 'Attachment Deleted';
  if (lower.includes('e-sign')) return 'E-Signature Applied';
  if (lower.includes('assign')) return 'Action Assigned';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapToCapaAuditEntry(
  raw: Record<string, unknown>,
  capaId?: string,
  capaNumber?: string,
): CapaAuditEntry {
  const normalized = normalizeAuditTrailEntry(raw);
  return toCapaAuditEntry(normalized, capaId, capaNumber);
}

export function toCapaAuditEntry(
  entry: AuditTrailEntry,
  capaId?: string,
  capaNumber?: string,
): CapaAuditEntry {
  const action = normalizeCapaActionType(entry.actionType || entry.action || '');
  const description = entry.actionDescription || action;
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    capa_id: capaId || entry.recordId || entry.documentId || '',
    capa_number: capaNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'CAPA',
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

export function isCapaAuditEntry(
  entry: AuditTrailEntry,
  capaId?: string,
  capaNumber?: string,
): boolean {
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isCapaModule = CAPA_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('capa');
  const collectionMatch = CAPA_COLLECTION_NAMES.has(entry.collectionName as typeof CAPA_COLLECTIONS[keyof typeof CAPA_COLLECTIONS]);
  if (capaId) {
    if (entry.recordId === capaId || entry.documentId === capaId) return true;
  }
  if (capaNumber && entry.documentNumber === capaNumber) return true;
  return isCapaModule || collectionMatch;
}

export function applyCapaAuditFilters(
  entries: CapaAuditEntry[],
  filters: CapaAuditFilters,
): CapaAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q
      || e.action_type.toLowerCase().includes(q)
      || e.action_description.toLowerCase().includes(q)
      || e.field_name.toLowerCase().includes(q)
      || e.changed_by_name.toLowerCase().includes(q)
      || e.old_value.toLowerCase().includes(q)
      || e.new_value.toLowerCase().includes(q)
      || e.capa_number.toLowerCase().includes(q)
      || e.module_name.toLowerCase().includes(q);
    const matchCapa = !filters.capa_number || filters.capa_number === 'all'
      || e.capa_number.toLowerCase().includes(filters.capa_number.toLowerCase());
    const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
    const matchModule = !filters.module_name || filters.module_name === 'all' || e.module_name === filters.module_name;
    const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
    const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
    const matchStart = !filters.start_date || e.date_time >= filters.start_date;
    const matchEnd = !filters.end_date || e.date_time <= `${filters.end_date}T23:59:59.999Z`;
    return matchSearch && matchCapa && matchAction && matchModule && matchUser && matchDept && matchStart && matchEnd;
  });
}

export function filterCapaAuditByRole(
  entries: CapaAuditEntry[],
  role?: string | null,
  options?: { userDepartment?: string; userId?: string; permittedCapaIds?: Set<string> },
): CapaAuditEntry[] {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r)) {
    return entries;
  }
  const { userDepartment, userId, permittedCapaIds } = options || {};
  if (permittedCapaIds?.size) {
    return entries.filter((e) =>
      permittedCapaIds.has(e.capa_id)
      || e.changed_by === userId
      || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
    );
  }
  return entries.filter((e) =>
    e.changed_by === userId
    || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
  );
}

export function canViewCapaAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor', 'viewer'].includes(r)
    || ['production_manager', 'production', 'qc_manager', 'qc'].includes(r);
}

export function canExportCapaAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive'].includes(r);
}

export function isCapaAuditReadOnly(role?: string | null): boolean {
  return normalizeRole(role || '') === 'auditor';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Investigation Started': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'RCA Updated': 'bg-amber-100 text-amber-800 border-amber-200',
    'Corrective Action Added': 'bg-orange-100 text-orange-800 border-orange-200',
    'Preventive Action Added': 'bg-teal-100 text-teal-800 border-teal-200',
    'Action Assigned': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Implementation Updated': 'bg-purple-100 text-purple-800 border-purple-200',
    'Evidence Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Evidence Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
    'Effectiveness Started': 'bg-amber-100 text-amber-800 border-amber-200',
    'Effectiveness Completed': 'bg-lime-100 text-lime-800 border-lime-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    'Sent Back': 'bg-orange-100 text-orange-800 border-orange-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'Attachment Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Attachment Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getTimelineSection(entry: CapaAuditEntry): typeof CAPA_TIMELINE_SECTIONS[number] {
  const action = entry.action_type;
  const moduleName = entry.module_name.toLowerCase();
  if (action === 'Reopened' || moduleName.includes('reopen')) return 'Reopen Activities';
  if (action === 'Closed' || moduleName.includes('closure')) return 'Closure Activities';
  if (moduleName.includes('approval') || ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(action)) {
    return 'Approval Workflow';
  }
  if (moduleName.includes('effectiveness') || action.includes('Effectiveness')) return 'Effectiveness Review';
  if (moduleName.includes('implement') || action.includes('Implementation') || action.includes('Evidence')) {
    return 'Implementation Activities';
  }
  if (moduleName.includes('preventive') || action.includes('Preventive')) return 'Preventive Actions';
  if (moduleName.includes('corrective') || action.includes('Corrective')) return 'Corrective Actions';
  if (moduleName.includes('investigation') || action.includes('Investigation') || action.includes('RCA')) {
    return 'Investigation & RCA';
  }
  if (['Created', 'Updated'].includes(action) || moduleName.includes('create')) return 'CAPA Creation';
  return 'CAPA Creation';
}

export function groupTimelineBySection(entries: CapaAuditEntry[]): Record<string, CapaAuditEntry[]> {
  const groups: Record<string, CapaAuditEntry[]> = {};
  for (const section of CAPA_TIMELINE_SECTIONS) groups[section] = [];
  for (const entry of entries) {
    const section = getTimelineSection(entry);
    groups[section].push(entry);
  }
  return groups;
}

export function computeCapaAuditDashboard(entries: CapaAuditEntry[]): CapaAuditDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const isImplementation = (e: CapaAuditEntry) =>
    e.action_type.includes('Implementation') || e.action_type.includes('Evidence')
    || e.module_name.toLowerCase().includes('implement');
  const isApproval = (e: CapaAuditEntry) =>
    ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(e.action_type)
    || e.module_name.toLowerCase().includes('approval');
  const isEffectiveness = (e: CapaAuditEntry) =>
    e.action_type.includes('Effectiveness') || e.module_name.toLowerCase().includes('effectiveness');
  const isClosure = (e: CapaAuditEntry) =>
    e.action_type === 'Closed' || e.module_name.toLowerCase().includes('closure');
  const isReopen = (e: CapaAuditEntry) => e.action_type === 'Reopened';
  const isExport = (e: CapaAuditEntry) => e.action_type === 'Exported';

  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.date_time.startsWith(today)).length,
    implementationActivities: entries.filter(isImplementation).length,
    approvalActivities: entries.filter(isApproval).length,
    effectivenessActivities: entries.filter(isEffectiveness).length,
    closureActivities: entries.filter(isClosure).length,
    reopenedCapa: entries.filter(isReopen).length,
    exportActivities: entries.filter(isExport).length,
  };
}

export function paginateCapaAuditEntries(
  entries: CapaAuditEntry[],
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

export function getFieldChangeEntries(entries: CapaAuditEntry[]): CapaAuditEntry[] {
  return entries.filter((e) => Boolean(e.field_name) && (Boolean(e.old_value) || Boolean(e.new_value)));
}

export function getUserActivitySummary(entries: CapaAuditEntry[]): { user: string; role: string; count: number; lastActivity: string }[] {
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

export function getExportHistoryEntries(entries: CapaAuditEntry[]): CapaAuditEntry[] {
  return entries.filter((e) => e.action_type === 'Exported');
}

export function exportCapaAuditCsv(entries: CapaAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'CAPA ID', 'CAPA Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Timestamp (UTC)', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.capa_id, e.capa_number, e.module_name, e.action_type, e.action_description,
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

export function formatAuditDateTimeUtc(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleString(undefined, { timeZoneName: 'short' })} (UTC: ${iso.slice(0, 19)}Z)`;
  } catch {
    return iso;
  }
}
