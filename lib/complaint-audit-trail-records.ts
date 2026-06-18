import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import { COMPLAINT_COLLECTIONS } from '@/lib/complaint-types';

export const AUDIT_TRAIL_MODULE = 'Complaint Audit Trail';

export const COMPLAINT_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'Investigation Started',
  'Investigation Completed',
  'Impact Assessment Updated',
  'CAPA Linked',
  'CAPA Unlinked',
  'Recall Evaluation Started',
  'Recall Evaluation Completed',
  'Approved',
  'Rejected',
  'Sent Back',
  'Closed',
  'Reopened',
  'Attachment Uploaded',
  'Attachment Deleted',
  'Customer Response Sent',
  'E-Signature Applied',
  'Exported',
] as const;

export const COMPLAINT_AUDIT_MODULES = [
  'Complaint',
  'Complaint Create',
  'Complaint Dashboard',
  'Complaint Investigation',
  'Complaint Impact Assessment',
  'Complaint CAPA Link',
  'Complaint Approval',
  'Complaint Closure',
  'Complaint Trend Analysis',
  'Complaint Reports & Analytics',
  'Complaint Audit Trail',
] as const;

export const COMPLAINT_TIMELINE_SECTIONS = [
  'Complaint Creation',
  'Investigation Activities',
  'Impact Assessment',
  'CAPA Activities',
  'Recall Evaluation',
  'Approval Workflow',
  'Customer Communication',
  'Closure Activities',
  'Reopen Activities',
] as const;

const COMPLAINT_COLLECTION_NAMES = new Set(Object.values(COMPLAINT_COLLECTIONS));

export type ReportActor = { id: string; name: string; role?: string; department?: string };

export interface ComplaintAuditEntry {
  id: string;
  audit_id: string;
  complaint_id: string;
  complaint_number: string;
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

export interface ComplaintAuditFilters {
  search?: string;
  complaint_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

export interface ComplaintAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  investigationActivities: number;
  capaActivities: number;
  recallActivities: number;
  closureActivities: number;
  reopenedComplaints: number;
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

export function normalizeComplaintActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    Create: 'Created',
    'Complaint Created': 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    Update: 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    submit: 'Submitted',
    'Submit Complaint for Approval': 'Submitted',
    'Complaint Submitted': 'Submitted',
    'Investigation Started': 'Investigation Started',
    'Investigation Edited': 'Updated',
    'Investigation Draft Created': 'Investigation Started',
    'Investigation Submitted for QA Review': 'Investigation Completed',
    'Investigation QA Approved': 'Investigation Completed',
    'Investigation QA Rejected': 'Rejected',
    'Investigation Completed': 'Investigation Completed',
    RCA_UPDATED: 'Updated',
    'RCA Updated': 'Updated',
    IMPACT_ASSESSMENT: 'Impact Assessment Updated',
    'Impact Assessment Updated': 'Impact Assessment Updated',
    'Impact Assessment Created': 'Impact Assessment Updated',
    'Impact Assessment Submitted': 'Impact Assessment Updated',
    'Impact Assessment Approved': 'Approved',
    'Impact Assessment Rejected': 'Rejected',
    'Risk Calculation Updated': 'Impact Assessment Updated',
    'Recall Evaluation Recommended': 'Recall Evaluation Started',
    'Recall Evaluation Started': 'Recall Evaluation Started',
    'Recall Evaluation Completed': 'Recall Evaluation Completed',
    CAPA_LINKED: 'CAPA Linked',
    'CAPA Linked': 'CAPA Linked',
    'CAPA Created': 'CAPA Linked',
    'CAPA linked': 'CAPA Linked',
    CAPA_UNLINKED: 'CAPA Unlinked',
    'CAPA Unlinked': 'CAPA Unlinked',
    'CAPA Required Changed': 'Updated',
    'CAPA Status Update': 'Updated',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    'Final Approval — Complaint Closed': 'Approved',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    Reject: 'Rejected',
    'Closure Rejected': 'Rejected',
    SENT_BACK: 'Sent Back',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    'Complaint Closed': 'Closed',
    'Closure Submitted for QA Review': 'Submitted',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    'Complaint Reopened': 'Reopened',
    ATTACHMENT_UPLOAD: 'Attachment Uploaded',
    ATTACHMENT_UPLOADED: 'Attachment Uploaded',
    'Attachment Uploaded': 'Attachment Uploaded',
    ATTACHMENT_DELETE: 'Attachment Deleted',
    ATTACHMENT_DELETED: 'Attachment Deleted',
    'Customer Response Sent': 'Customer Response Sent',
    E_SIGNATURE: 'E-Signature Applied',
    'E-Sign Success': 'E-Signature Applied',
    'E-Sign Failure': 'E-Signature Applied',
    'E-Signature Applied': 'E-Signature Applied',
    EXPORT: 'Exported',
    export: 'Exported',
    'exported PDF': 'Exported',
    'exported Excel': 'Exported',
    'PDF export clicked': 'Exported',
    'Excel export clicked': 'Exported',
    'Export Complaint Trend Report': 'Exported',
    'Complaint Report Generated': 'Exported',
    'Complaint Report Previewed': 'Exported',
    'Complaint Report Downloaded': 'Exported',
    'Draft Saved': 'Updated',
    'dashboard viewed': 'Updated',
    'dashboard refreshed': 'Updated',
    'filter applied': 'Updated',
    'complaint opened': 'Updated',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('investigation') && lower.includes('start')) return 'Investigation Started';
  if (lower.includes('investigation') && (lower.includes('complet') || lower.includes('submit'))) return 'Investigation Completed';
  if (lower.includes('recall') && lower.includes('complet')) return 'Recall Evaluation Completed';
  if (lower.includes('recall')) return 'Recall Evaluation Started';
  if (lower.includes('reopen')) return 'Reopened';
  if (lower.includes('export') || lower.includes('download')) return 'Exported';
  if (lower.includes('capa') && lower.includes('unlink')) return 'CAPA Unlinked';
  if (lower.includes('capa') && lower.includes('link')) return 'CAPA Linked';
  if (lower.includes('impact')) return 'Impact Assessment Updated';
  if (lower.includes('customer') && lower.includes('response')) return 'Customer Response Sent';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('reject')) return 'Rejected';
  if (lower.includes('close')) return 'Closed';
  if (lower.includes('attach') && lower.includes('upload')) return 'Attachment Uploaded';
  if (lower.includes('attach') && lower.includes('delete')) return 'Attachment Deleted';
  if (lower.includes('e-sign')) return 'E-Signature Applied';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapToComplaintAuditEntry(
  raw: Record<string, unknown>,
  complaintId?: string,
  complaintNumber?: string,
): ComplaintAuditEntry {
  if (raw.deleted === true || raw.isDeleted === true) {
    return toComplaintAuditEntry(normalizeAuditTrailEntry({ ...raw, status: 'Deleted' }), complaintId, complaintNumber);
  }
  const normalized = normalizeAuditTrailEntry(raw);
  return toComplaintAuditEntry(normalized, complaintId, complaintNumber);
}

export function toComplaintAuditEntry(
  entry: AuditTrailEntry,
  complaintId?: string,
  complaintNumber?: string,
): ComplaintAuditEntry {
  const action = normalizeComplaintActionType(entry.actionType || entry.action || '');
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    complaint_id: complaintId || entry.recordId || entry.documentId || '',
    complaint_number: complaintNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'Complaint',
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

export function isComplaintAuditEntry(
  entry: AuditTrailEntry,
  complaintId?: string,
  complaintNumber?: string,
): boolean {
  if ((entry as AuditTrailEntry & { deleted?: boolean }).deleted) return false;
  const moduleName = (entry.moduleName || '').toLowerCase();
  const isComplaintModule = COMPLAINT_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('complaint');
  const collectionMatch = COMPLAINT_COLLECTION_NAMES.has(
    entry.collectionName as typeof COMPLAINT_COLLECTIONS[keyof typeof COMPLAINT_COLLECTIONS],
  );
  if (complaintId) {
    if (entry.recordId === complaintId || entry.documentId === complaintId) return true;
  }
  if (complaintNumber && entry.documentNumber === complaintNumber) return true;
  return isComplaintModule || collectionMatch;
}

export function isVisibleComplaintAuditEntry(entry: ComplaintAuditEntry): boolean {
  return entry.status !== 'Deleted' && entry.action_type !== 'Deleted';
}

export function applyComplaintAuditFilters(
  entries: ComplaintAuditEntry[],
  filters: ComplaintAuditFilters,
): ComplaintAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries
    .filter(isVisibleComplaintAuditEntry)
    .filter((e) => {
      const matchSearch = !q
        || e.action_type.toLowerCase().includes(q)
        || e.action_description.toLowerCase().includes(q)
        || e.field_name.toLowerCase().includes(q)
        || e.changed_by_name.toLowerCase().includes(q)
        || e.old_value.toLowerCase().includes(q)
        || e.new_value.toLowerCase().includes(q)
        || e.complaint_number.toLowerCase().includes(q)
        || e.module_name.toLowerCase().includes(q);
      const matchComplaint = !filters.complaint_number || filters.complaint_number === 'all'
        || e.complaint_number.toLowerCase().includes(filters.complaint_number.toLowerCase());
      const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
      const matchModule = !filters.module_name || filters.module_name === 'all' || e.module_name === filters.module_name;
      const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
      const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
      const matchStart = !filters.start_date || e.date_time >= filters.start_date;
      const matchEnd = !filters.end_date || e.date_time <= `${filters.end_date}T23:59:59.999Z`;
      return matchSearch && matchComplaint && matchAction && matchModule && matchUser && matchDept && matchStart && matchEnd;
    });
}

export function filterComplaintAuditByRole(
  entries: ComplaintAuditEntry[],
  role?: string | null,
  options?: { userDepartment?: string; userId?: string; permittedComplaintIds?: Set<string> },
): ComplaintAuditEntry[] {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor'].includes(r)) {
    return entries;
  }
  const { userDepartment, userId, permittedComplaintIds } = options || {};
  if (permittedComplaintIds?.size) {
    return entries.filter((e) =>
      permittedComplaintIds.has(e.complaint_id)
      || e.changed_by === userId
      || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
    );
  }
  return entries.filter((e) =>
    e.changed_by === userId
    || (userDepartment && e.department && e.department.toLowerCase() === userDepartment.toLowerCase()),
  );
}

export function canViewComplaintAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'regulatory_affairs', 'auditor', 'viewer',
  ].includes(r)
    || ['production_manager', 'production', 'warehouse_manager', 'warehouse'].includes(r);
}

export function canExportComplaintAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs'].includes(r);
}

export function isComplaintAuditReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Investigation Started': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Investigation Completed': 'bg-lime-100 text-lime-800 border-lime-200',
    'Impact Assessment Updated': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Recall Evaluation Started': 'bg-orange-100 text-orange-800 border-orange-200',
    'Recall Evaluation Completed': 'bg-amber-100 text-amber-800 border-amber-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
    'CAPA Linked': 'bg-orange-100 text-orange-800 border-orange-200',
    'CAPA Unlinked': 'bg-rose-100 text-rose-800 border-rose-200',
    'Customer Response Sent': 'bg-teal-100 text-teal-800 border-teal-200',
    'Attachment Uploaded': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Attachment Deleted': 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getTimelineSection(entry: ComplaintAuditEntry): typeof COMPLAINT_TIMELINE_SECTIONS[number] {
  const action = entry.action_type;
  const moduleName = entry.module_name.toLowerCase();
  const desc = entry.action_description.toLowerCase();
  if (action === 'Reopened' || moduleName.includes('reopen') || desc.includes('reopen')) return 'Reopen Activities';
  if (action === 'Closed' || moduleName.includes('closure') || desc.includes('closed')) return 'Closure Activities';
  if (action === 'Customer Response Sent' || desc.includes('customer response')) return 'Customer Communication';
  if (moduleName.includes('approval') || ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(action)) {
    return 'Approval Workflow';
  }
  if (action.includes('Recall') || desc.includes('recall')) return 'Recall Evaluation';
  if (moduleName.includes('capa') || action.includes('CAPA')) return 'CAPA Activities';
  if (moduleName.includes('impact') || action.includes('Impact')) return 'Impact Assessment';
  if (moduleName.includes('investigation') || action.includes('Investigation')) return 'Investigation Activities';
  return 'Complaint Creation';
}

export function groupTimelineBySection(entries: ComplaintAuditEntry[]): Record<string, ComplaintAuditEntry[]> {
  const groups: Record<string, ComplaintAuditEntry[]> = {};
  for (const section of COMPLAINT_TIMELINE_SECTIONS) groups[section] = [];
  for (const entry of entries) {
    const section = getTimelineSection(entry);
    groups[section].push(entry);
  }
  return groups;
}

export function computeComplaintAuditDashboard(entries: ComplaintAuditEntry[]): ComplaintAuditDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const isInvestigation = (e: ComplaintAuditEntry) =>
    e.action_type.includes('Investigation') || e.module_name.toLowerCase().includes('investigation');
  const isCapa = (e: ComplaintAuditEntry) =>
    e.action_type.includes('CAPA') || e.module_name.toLowerCase().includes('capa');
  const isRecall = (e: ComplaintAuditEntry) =>
    e.action_type.includes('Recall') || e.action_description.toLowerCase().includes('recall');
  const isClosure = (e: ComplaintAuditEntry) =>
    e.action_type === 'Closed' || e.module_name.toLowerCase().includes('closure');
  const isReopen = (e: ComplaintAuditEntry) => e.action_type === 'Reopened';
  const isExport = (e: ComplaintAuditEntry) => e.action_type === 'Exported';

  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.date_time.startsWith(today)).length,
    investigationActivities: entries.filter(isInvestigation).length,
    capaActivities: entries.filter(isCapa).length,
    recallActivities: entries.filter(isRecall).length,
    closureActivities: entries.filter(isClosure).length,
    reopenedComplaints: entries.filter(isReopen).length,
    exportActivities: entries.filter(isExport).length,
  };
}

export function paginateComplaintAuditEntries(
  entries: ComplaintAuditEntry[],
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

export function getFieldChangeEntries(entries: ComplaintAuditEntry[]): ComplaintAuditEntry[] {
  return entries.filter((e) => Boolean(e.field_name) && (Boolean(e.old_value) || Boolean(e.new_value)));
}

export function getUserActivitySummary(entries: ComplaintAuditEntry[]): {
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

export function getExportHistoryEntries(entries: ComplaintAuditEntry[]): ComplaintAuditEntry[] {
  return entries.filter((e) => e.action_type === 'Exported');
}

export function exportComplaintAuditCsv(entries: ComplaintAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'Complaint ID', 'Complaint Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Timestamp (UTC)', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.complaint_id, e.complaint_number, e.module_name, e.action_type, e.action_description,
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
