import { normalizeRole } from '@/lib/permissions';
import { normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import type { AuditTrailEntry } from '@/lib/admin/schemas';
import {
  RISK_ASSESSMENT_COLLECTION,
  RISK_ASSESSMENT_MODULE,
} from '@/lib/cpv-risk-assessment-records';

export const AUDIT_TRAIL_MODULE = 'Risk Audit Trail';

export const RISK_COLLECTIONS = {
  assessments: 'risk_assessment',
  assessmentsAlias: 'risk_assessments',
  fmea: 'risk_fmea',
  mitigations: 'risk_mitigations',
  reviews: 'risk_reviews',
  approvals: 'risk_approvals',
  closure: 'risk_closure',
  auditTrail: 'audit_trail',
} as const;

const RISK_COLLECTION_NAMES = new Set(Object.values(RISK_COLLECTIONS));

export const RISK_AUDIT_ACTION_TYPES = [
  'Created',
  'Updated',
  'Submitted',
  'FMEA Created',
  'Failure Mode Added',
  'RPN Calculated',
  'Mitigation Created',
  'Residual Risk Calculated',
  'Review Started',
  'Review Completed',
  'Approved',
  'Rejected',
  'Sent Back',
  'Closed',
  'Reopened',
  'E-Signature Applied',
  'Exported',
] as const;

export const RISK_AUDIT_MODULES = [
  'Risk Management',
  'Risk Assessment',
  'CPV Risk Assessment Worksheet',
  'Risk FMEA',
  'Risk Mitigation',
  'Risk Review',
  'Risk Approval',
  'Risk Closure',
  'Risk Audit Trail',
  'Risk Dashboard',
] as const;

export const RISK_TIMELINE_SECTIONS = [
  'Risk Creation',
  'FMEA Activities',
  'Risk Scoring',
  'Mitigation Activities',
  'Residual Risk Review',
  'Approval Workflow',
  'Monitoring Review',
  'Closure Activities',
  'Reopen Activities',
] as const;

export type ReportActor = { id: string; name: string; role?: string; department?: string };

export interface RiskAuditEntry {
  id: string;
  audit_id: string;
  risk_assessment_id: string;
  risk_number: string;
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

export interface RiskAuditFilters {
  search?: string;
  risk_number?: string;
  action_type?: string;
  module_name?: string;
  user_id?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}

export interface RiskAuditDashboardMetrics {
  total: number;
  todayActivities: number;
  fmeaActivities: number;
  scoringActivities: number;
  mitigationActivities: number;
  approvalActivities: number;
  closureActivities: number;
  reopenedRisks: number;
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

export function normalizeRiskActionType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created',
    create: 'Created',
    'create risk': 'Created',
    'Create Risk': 'Created',
    'auto risk generation': 'Created',
    'Risk Created': 'Created',
    UPDATE: 'Updated',
    update: 'Updated',
    'edit risk': 'Updated',
    'Edit Risk': 'Updated',
    'QA override': 'Updated',
    SUBMIT: 'Submitted',
    SUBMITTED: 'Submitted',
    submit: 'Submitted',
    'Risk Submitted': 'Submitted',
    'fmea created': 'FMEA Created',
    'FMEA Created': 'FMEA Created',
    'failure mode added': 'Failure Mode Added',
    'Failure Mode Added': 'Failure Mode Added',
    'risk calculation': 'RPN Calculated',
    'Risk Calculation': 'RPN Calculated',
    'RPN Calculated': 'RPN Calculated',
    'risk mitigation': 'Mitigation Created',
    'Mitigation Created': 'Mitigation Created',
    'add mitigation': 'Mitigation Created',
    'residual risk': 'Residual Risk Calculated',
    'Residual Risk Calculated': 'Residual Risk Calculated',
    'effectiveness review': 'Residual Risk Calculated',
    'risk review': 'Review Started',
    'Review Started': 'Review Started',
    'Review Completed': 'Review Completed',
    'risk approval': 'Approved',
    APPROVE: 'Approved',
    APPROVED: 'Approved',
    Approve: 'Approved',
    'reject risk': 'Rejected',
    REJECT: 'Rejected',
    REJECTED: 'Rejected',
    SENT_BACK: 'Sent Back',
    'Sent Back': 'Sent Back',
    'risk closure': 'Closed',
    CLOSE: 'Closed',
    CLOSED: 'Closed',
    'Risk Closed': 'Closed',
    REOPEN: 'Reopened',
    REOPENED: 'Reopened',
    'Risk Reopened': 'Reopened',
    E_SIGNATURE: 'E-Signature Applied',
    'E-Signature Applied': 'E-Signature Applied',
    'E-Sign Success': 'E-Signature Applied',
    EXPORT: 'Exported',
    export: 'Exported',
    'export risk PDF': 'Exported',
    'export risk Excel': 'Exported',
    'exported PDF': 'Exported',
    'exported Excel': 'Exported',
    'audit trail viewed': 'Updated',
    'audit trail exported': 'Exported',
  };
  if (map[raw]) return map[raw];
  const lower = raw.toLowerCase().replace(/_/g, ' ');
  for (const [key, val] of Object.entries(map)) {
    if (key.toLowerCase().replace(/_/g, ' ') === lower) return val;
  }
  if (lower.includes('fmea') && lower.includes('creat')) return 'FMEA Created';
  if (lower.includes('failure mode')) return 'Failure Mode Added';
  if (lower.includes('rpn') || lower.includes('calculation') || lower.includes('scoring')) return 'RPN Calculated';
  if (lower.includes('mitigat')) return 'Mitigation Created';
  if (lower.includes('residual') || lower.includes('effectiveness')) return 'Residual Risk Calculated';
  if (lower.includes('review') && lower.includes('complet')) return 'Review Completed';
  if (lower.includes('review')) return 'Review Started';
  if (lower.includes('reopen')) return 'Reopened';
  if (lower.includes('export') || lower.includes('download')) return 'Exported';
  if (lower.includes('approv')) return 'Approved';
  if (lower.includes('reject')) return 'Rejected';
  if (lower.includes('sent back')) return 'Sent Back';
  if (lower.includes('close') || lower.includes('closure')) return 'Closed';
  if (lower.includes('e-sign')) return 'E-Signature Applied';
  if (lower.includes('submit')) return 'Submitted';
  if (lower.includes('creat')) return 'Created';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toRiskAuditEntry(
  entry: AuditTrailEntry,
  riskId?: string,
  riskNumber?: string,
): RiskAuditEntry {
  const action = normalizeRiskActionType(entry.actionType || entry.action || '');
  return {
    id: entry.id || entry.auditId,
    audit_id: entry.auditId || entry.id || '',
    risk_assessment_id: riskId || entry.recordId || entry.documentId || '',
    risk_number: riskNumber || entry.documentNumber || '',
    module_name: entry.moduleName || 'Risk Assessment',
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

export function mapToRiskAuditEntry(
  raw: Record<string, unknown>,
  riskId?: string,
  riskNumber?: string,
): RiskAuditEntry {
  if (raw.deleted === true || raw.isDeleted === true) {
    return toRiskAuditEntry(normalizeAuditTrailEntry({ ...raw, status: 'Deleted' }), riskId, riskNumber);
  }
  return toRiskAuditEntry(normalizeAuditTrailEntry(raw), riskId, riskNumber);
}

export function isRiskAuditEntry(
  entry: AuditTrailEntry,
  riskId?: string,
  riskNumber?: string,
): boolean {
  if ((entry as AuditTrailEntry & { deleted?: boolean }).deleted) return false;
  const moduleName = (entry.moduleName || '').toLowerCase();
  const collectionName = (entry.collectionName || '').toLowerCase();
  const isRiskModule = RISK_AUDIT_MODULES.some((m) => moduleName.includes(m.toLowerCase()))
    || moduleName.includes('risk');
  const collectionMatch = RISK_COLLECTION_NAMES.has(
    collectionName as typeof RISK_COLLECTIONS[keyof typeof RISK_COLLECTIONS],
  )
    || collectionName.includes('risk');
  if (riskId) {
    if (entry.recordId === riskId || entry.documentId === riskId) return true;
  }
  if (riskNumber && entry.documentNumber === riskNumber) return true;
  return isRiskModule || collectionMatch;
}

export function isVisibleRiskAuditEntry(entry: RiskAuditEntry): boolean {
  return entry.status !== 'Deleted' && entry.action_type !== 'Deleted';
}

export function applyRiskAuditFilters(
  entries: RiskAuditEntry[],
  filters: RiskAuditFilters,
): RiskAuditEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries
    .filter(isVisibleRiskAuditEntry)
    .filter((e) => {
      const matchSearch = !q
        || e.action_type.toLowerCase().includes(q)
        || e.action_description.toLowerCase().includes(q)
        || e.field_name.toLowerCase().includes(q)
        || e.changed_by_name.toLowerCase().includes(q)
        || e.old_value.toLowerCase().includes(q)
        || e.new_value.toLowerCase().includes(q)
        || e.risk_number.toLowerCase().includes(q)
        || e.module_name.toLowerCase().includes(q);
      const matchRisk = !filters.risk_number || filters.risk_number === 'all'
        || e.risk_number.toLowerCase().includes(filters.risk_number.toLowerCase());
      const matchAction = !filters.action_type || filters.action_type === 'all' || e.action_type === filters.action_type;
      const matchModule = !filters.module_name || filters.module_name === 'all' || e.module_name === filters.module_name;
      const matchUser = !filters.user_id || filters.user_id === 'all' || e.changed_by === filters.user_id;
      const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
      const matchStart = !filters.start_date || e.date_time >= filters.start_date;
      const matchEnd = !filters.end_date || e.date_time <= `${filters.end_date}T23:59:59.999Z`;
      return matchSearch && matchRisk && matchAction && matchModule && matchUser && matchDept && matchStart && matchEnd;
    });
}

export function filterRiskAuditByRole(
  entries: RiskAuditEntry[],
  role?: string | null,
): RiskAuditEntry[] {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager', 'auditor'].includes(r)) {
    return entries;
  }
  return entries;
}

export function canViewRiskAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return [
    'super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive',
    'risk_manager', 'auditor', 'viewer',
  ].includes(r);
}

export function canExportRiskAuditTrail(role?: string | null): boolean {
  const r = normalizeRole(role);
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'risk_manager'].includes(r);
}

export function isRiskAuditReadOnly(role?: string | null): boolean {
  return normalizeRole(role) === 'auditor';
}

export function actionTypeColor(action: string): string {
  const map: Record<string, string> = {
    Created: 'bg-green-100 text-green-800 border-green-200',
    Updated: 'bg-blue-100 text-blue-800 border-blue-200',
    Submitted: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'FMEA Created': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'Failure Mode Added': 'bg-teal-100 text-teal-800 border-teal-200',
    'RPN Calculated': 'bg-violet-100 text-violet-800 border-violet-200',
    'Mitigation Created': 'bg-orange-100 text-orange-800 border-orange-200',
    'Residual Risk Calculated': 'bg-amber-100 text-amber-800 border-amber-200',
    'Review Started': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Review Completed': 'bg-lime-100 text-lime-800 border-lime-200',
    Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Rejected: 'bg-red-100 text-red-800 border-red-200',
    'Sent Back': 'bg-rose-100 text-rose-800 border-rose-200',
    Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    Reopened: 'bg-amber-100 text-amber-800 border-amber-200',
    Exported: 'bg-violet-100 text-violet-800 border-violet-200',
    'E-Signature Applied': 'bg-purple-100 text-purple-800 border-purple-200',
  };
  return map[action] || 'bg-slate-100 text-slate-700 border-slate-200';
}

export function getTimelineSection(entry: RiskAuditEntry): typeof RISK_TIMELINE_SECTIONS[number] {
  const action = entry.action_type;
  const moduleName = entry.module_name.toLowerCase();
  const desc = entry.action_description.toLowerCase();
  if (action === 'Reopened' || moduleName.includes('reopen') || desc.includes('reopen')) return 'Reopen Activities';
  if (action === 'Closed' || moduleName.includes('closure') || desc.includes('closed')) return 'Closure Activities';
  if (moduleName.includes('approval') || ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(action)) {
    return 'Approval Workflow';
  }
  if (action.includes('FMEA') || action.includes('Failure Mode') || moduleName.includes('fmea')) return 'FMEA Activities';
  if (action === 'RPN Calculated' || desc.includes('rpn') || desc.includes('scoring')) return 'Risk Scoring';
  if (action.includes('Mitigation') || moduleName.includes('mitigation')) return 'Mitigation Activities';
  if (action.includes('Residual') || moduleName.includes('effectiveness') || desc.includes('effectiveness')) {
    return 'Residual Risk Review';
  }
  if (action.includes('Review') || moduleName.includes('review') || moduleName.includes('monitoring')) {
    return 'Monitoring Review';
  }
  return 'Risk Creation';
}

export function groupTimelineBySection(entries: RiskAuditEntry[]): Record<string, RiskAuditEntry[]> {
  const groups: Record<string, RiskAuditEntry[]> = {};
  for (const section of RISK_TIMELINE_SECTIONS) groups[section] = [];
  for (const entry of entries) {
    groups[getTimelineSection(entry)].push(entry);
  }
  return groups;
}

export function computeRiskAuditDashboard(entries: RiskAuditEntry[]): RiskAuditDashboardMetrics {
  const today = new Date().toISOString().split('T')[0];
  const isFmea = (e: RiskAuditEntry) =>
    e.action_type.includes('FMEA') || e.action_type.includes('Failure Mode');
  const isScoring = (e: RiskAuditEntry) => e.action_type === 'RPN Calculated';
  const isMitigation = (e: RiskAuditEntry) => e.action_type.includes('Mitigation');
  const isApproval = (e: RiskAuditEntry) =>
    ['Approved', 'Rejected', 'Sent Back', 'Submitted'].includes(e.action_type);
  const isClosure = (e: RiskAuditEntry) => e.action_type === 'Closed';
  const isReopen = (e: RiskAuditEntry) => e.action_type === 'Reopened';
  const isExport = (e: RiskAuditEntry) => e.action_type === 'Exported';

  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.date_time.startsWith(today)).length,
    fmeaActivities: entries.filter(isFmea).length,
    scoringActivities: entries.filter(isScoring).length,
    mitigationActivities: entries.filter(isMitigation).length,
    approvalActivities: entries.filter(isApproval).length,
    closureActivities: entries.filter(isClosure).length,
    reopenedRisks: entries.filter(isReopen).length,
    exportActivities: entries.filter(isExport).length,
  };
}

export function paginateRiskAuditEntries(entries: RiskAuditEntry[], page: number, pageSize: number) {
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

export function getFieldChangeEntries(entries: RiskAuditEntry[]): RiskAuditEntry[] {
  return entries.filter((e) => Boolean(e.field_name) && (Boolean(e.old_value) || Boolean(e.new_value)));
}

export function getUserActivitySummary(entries: RiskAuditEntry[]): {
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

export function getExportHistoryEntries(entries: RiskAuditEntry[]): RiskAuditEntry[] {
  return entries.filter((e) => e.action_type === 'Exported');
}

export function exportRiskAuditCsv(entries: RiskAuditEntry[]): { headers: string[]; rows: string[][] } {
  const headers = [
    'Audit ID', 'Risk Assessment ID', 'Risk Number', 'Module', 'Action Type', 'Description',
    'Field', 'Old Value', 'New Value', 'Changed By', 'Role', 'Department', 'Reason',
    'IP Address', 'Device', 'Timestamp (UTC)', 'Status',
  ];
  const rows = entries.map((e) => [
    e.audit_id, e.risk_assessment_id, e.risk_number, e.module_name, e.action_type, e.action_description,
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
    return `${d.toLocaleString(undefined, { timeZoneName: 'short' })} (stored UTC: ${iso})`;
  } catch {
    return iso;
  }
}

export { RISK_ASSESSMENT_COLLECTION, RISK_ASSESSMENT_MODULE };
