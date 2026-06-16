import { createAuditLog } from '@/lib/audit-trail';
import {
  getAdminRecords, logAuditEvent,
} from './admin-service';
import {
  ADMIN_COLLECTIONS, ADMIN_AUDIT_MODULES, QMS_AUDIT_MODULES, CRITICAL_AUDIT_ACTIONS,
} from './constants';
import type { AuditTrailEntry } from './schemas';
import {
  canViewAllAuditTrail, canViewAdminAuditTrail, canViewQmsAuditTrail,
} from '@/lib/permissions';

export interface AuditTrailFilters {
  search?: string;
  moduleName?: string;
  actionType?: string;
  userId?: string;
  department?: string;
  status?: string;
  recordId?: string;
  documentNumber?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditTrailAuditMeta {
  userId: string;
  userName: string;
  role?: string;
  department?: string;
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

export function normalizeAuditTrailEntry(raw: Record<string, unknown>): AuditTrailEntry {
  const dateTime = String(raw.dateTime || raw.timestamp || raw.loginTime || '');
  const actionType = String(raw.actionType || raw.action || '');
  const recordId = String(raw.recordId || raw.documentId || '');
  return {
    id: raw.id as string | undefined,
    auditId: String(raw.auditId || raw.id || ''),
    dateTime,
    timestamp: dateTime,
    moduleName: String(raw.moduleName || raw.module || ''),
    collectionName: String(raw.collectionName || ''),
    recordId,
    documentId: recordId,
    documentNumber: String(raw.documentNumber || ''),
    actionType,
    action: actionType,
    actionDescription: String(raw.actionDescription || ''),
    fieldName: String(raw.fieldName || ''),
    oldValue: stringifyValue(raw.oldValue),
    newValue: stringifyValue(raw.newValue),
    changedByUserId: String(raw.changedByUserId || raw.userId || ''),
    changedByUserName: String(raw.changedByUserName || raw.userName || ''),
    changedByRole: String(raw.changedByRole || raw.role || ''),
    userId: String(raw.userId || raw.changedByUserId || ''),
    userName: String(raw.userName || raw.changedByUserName || ''),
    department: String(raw.department || ''),
    reasonForChange: String(raw.reasonForChange || raw.reason || raw.failureReason || ''),
    reason: String(raw.reason || raw.reasonForChange || ''),
    ipAddress: String(raw.ipAddress || ''),
    deviceInfo: String(raw.deviceInfo || raw.device || ''),
    device: String(raw.device || raw.deviceInfo || ''),
    browserInfo: String(raw.browserInfo || ''),
    location: String(raw.location || ''),
    eSignatureRequired: Boolean(raw.eSignatureRequired),
    eSignatureStatus: String(raw.eSignatureStatus || ''),
    status: (raw.status as AuditTrailEntry['status']) || 'Success',
  };
}

function loginActivityToAudit(raw: Record<string, unknown>): AuditTrailEntry {
  const status = String(raw.loginStatus || 'Success');
  const actionType = status === 'Failed' ? 'Failed Login' : 'Login';
  return normalizeAuditTrailEntry({
    ...raw,
    moduleName: 'Admin',
    actionType,
    actionDescription: status === 'Failed'
      ? `Failed login: ${raw.failureReason || 'Unknown'}`
      : 'User login',
    recordId: String(raw.userId || raw.id || ''),
    status: status === 'Failed' ? 'Failed' : 'Success',
    dateTime: raw.loginTime,
    userId: raw.userId,
    userName: raw.userName,
    department: '',
    reason: raw.failureReason,
  });
}

function isCriticalAction(actionType: string): boolean {
  const norm = actionType.toLowerCase().replace(/_/g, ' ').trim();
  return CRITICAL_AUDIT_ACTIONS.some((c) => c.toLowerCase() === norm);
}

function normalizeActionMatch(actionType: string, target: string): boolean {
  return actionType.toLowerCase().replace(/_/g, ' ') === target.toLowerCase();
}

export function filterAuditTrailByRole(
  entries: AuditTrailEntry[],
  role?: string | null,
  currentUserId?: string,
): AuditTrailEntry[] {
  if (canViewAllAuditTrail(role)) return entries;

  if (canViewAdminAuditTrail(role)) {
    const adminSet = new Set<string>(ADMIN_AUDIT_MODULES as unknown as string[]);
    return entries.filter((e) => adminSet.has(e.moduleName) || e.changedByUserId === currentUserId);
  }

  if (canViewQmsAuditTrail(role)) {
    const qmsSet = new Set<string>(QMS_AUDIT_MODULES as unknown as string[]);
    return entries.filter((e) => qmsSet.has(e.moduleName) || e.changedByUserId === currentUserId);
  }

  if (currentUserId) {
    return entries.filter((e) => e.changedByUserId === currentUserId || e.userId === currentUserId);
  }

  return [];
}

export async function fetchAuditTrailEntries(): Promise<AuditTrailEntry[]> {
  try {
    const [trail, adminLogs, loginActivity] = await Promise.all([
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditTrail).catch(() => []),
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditLogs).catch(() => []),
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.loginActivity).catch(() => []),
    ]);

    const fromTrail = trail.map((r) => normalizeAuditTrailEntry({ ...r, id: r.id }));
    const fromAdminLogs = adminLogs.map((l) => normalizeAuditTrailEntry({
      id: l.id,
      auditId: l.id,
      dateTime: l.dateTime,
      moduleName: l.module,
      collectionName: ADMIN_COLLECTIONS.auditLogs,
      recordId: l.recordId,
      actionType: l.action,
      actionDescription: String(l.action),
      oldValue: l.oldValue,
      newValue: l.newValue,
      changedByUserId: l.userId,
      changedByUserName: l.userName,
      userId: l.userId,
      userName: l.userName,
      reasonForChange: l.reason,
      ipAddress: l.ipAddress,
      deviceInfo: l.device,
      browserInfo: l.device,
      status: l.status || 'Success',
    }));
    const fromLogin = loginActivity.map((l) => loginActivityToAudit({ ...l, id: l.id }));

    const merged = [...fromTrail, ...fromAdminLogs, ...fromLogin];
    const seen = new Set<string>();
    const deduped: AuditTrailEntry[] = [];

    for (const entry of merged.sort((a, b) => b.dateTime.localeCompare(a.dateTime))) {
      const key = entry.id || `${entry.auditId}-${entry.dateTime}-${entry.actionType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(entry);
    }

    return deduped;
  } catch {
    return [];
  }
}

export async function fetchAuditTrailById(id: string): Promise<AuditTrailEntry | null> {
  const all = await fetchAuditTrailEntries();
  return all.find((e) => e.id === id || e.auditId === id) ?? null;
}

export function applyAuditTrailFilters(entries: AuditTrailEntry[], filters: AuditTrailFilters): AuditTrailEntry[] {
  const q = filters.search?.toLowerCase() || '';
  return entries.filter((e) => {
    const matchSearch = !q ||
      e.changedByUserName.toLowerCase().includes(q) ||
      e.moduleName.toLowerCase().includes(q) ||
      e.recordId.toLowerCase().includes(q) ||
      e.documentNumber.toLowerCase().includes(q) ||
      e.actionType.toLowerCase().includes(q) ||
      e.actionDescription.toLowerCase().includes(q);
    const matchModule = !filters.moduleName || filters.moduleName === 'all' || e.moduleName === filters.moduleName;
    const matchAction = !filters.actionType || filters.actionType === 'all' || e.actionType === filters.actionType;
    const matchUser = !filters.userId || filters.userId === 'all' || e.changedByUserId === filters.userId;
    const matchDept = !filters.department || filters.department === 'all' || e.department === filters.department;
    const matchStatus = !filters.status || filters.status === 'all' || e.status === filters.status;
    const matchRecord = !filters.recordId || e.recordId.includes(filters.recordId);
    const matchDoc = !filters.documentNumber || e.documentNumber.includes(filters.documentNumber);
    const matchStart = !filters.startDate || e.dateTime >= filters.startDate;
    const matchEnd = !filters.endDate || e.dateTime <= `${filters.endDate}T23:59:59`;
    return matchSearch && matchModule && matchAction && matchUser && matchDept
      && matchStatus && matchRecord && matchDoc && matchStart && matchEnd;
  });
}

export function getAuditTrailSummary(entries: AuditTrailEntry[]) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: entries.length,
    todayActivities: entries.filter((e) => e.dateTime.startsWith(today)).length,
    criticalActions: entries.filter((e) => isCriticalAction(e.actionType)).length,
    failedLogins: entries.filter((e) => normalizeActionMatch(e.actionType, 'Failed Login') || e.status === 'Failed').length,
    approvalActions: entries.filter((e) => normalizeActionMatch(e.actionType, 'Approve')).length,
    rejectedActions: entries.filter((e) => normalizeActionMatch(e.actionType, 'Reject')).length,
    exportActions: entries.filter((e) => normalizeActionMatch(e.actionType, 'Export')).length,
    systemSettingChanges: entries.filter((e) => normalizeActionMatch(e.actionType, 'System Setting Change')).length,
    eSignatureActions: entries.filter((e) => normalizeActionMatch(e.actionType, 'E-Signature') || e.eSignatureRequired).length,
  };
}

export function getAuditChartsData(entries: AuditTrailEntry[]) {
  const byModule = new Map<string, number>();
  const byAction = new Map<string, number>();
  const userActivity = new Map<string, number>();
  const failedByDay = new Map<string, number>();
  const criticalByDay = new Map<string, number>();

  for (const e of entries) {
    byModule.set(e.moduleName, (byModule.get(e.moduleName) || 0) + 1);
    byAction.set(e.actionType, (byAction.get(e.actionType) || 0) + 1);
    const userKey = e.changedByUserName || 'Unknown';
    userActivity.set(userKey, (userActivity.get(userKey) || 0) + 1);

    const day = e.dateTime.slice(0, 10);
    if (normalizeActionMatch(e.actionType, 'Failed Login') || e.status === 'Failed') {
      failedByDay.set(day, (failedByDay.get(day) || 0) + 1);
    }
    if (isCriticalAction(e.actionType)) {
      criticalByDay.set(day, (criticalByDay.get(day) || 0) + 1);
    }
  }

  const toChart = (map: Map<string, number>, limit = 8) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, value]) => ({ name, value }));

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return {
    byModule: toChart(byModule),
    byAction: toChart(byAction, 10),
    userActivity: toChart(userActivity, 10),
    failedLoginTrend: last7Days.map((day) => ({
      name: day,
      value: failedByDay.get(day) || 0,
    })),
    criticalTrend: last7Days.map((day) => ({
      name: day,
      value: criticalByDay.get(day) || 0,
    })),
  };
}

export function getRecordTimeline(entries: AuditTrailEntry[], recordId: string): AuditTrailEntry[] {
  return entries
    .filter((e) => e.recordId === recordId || e.documentNumber === recordId)
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
}

export function getUserActivityTimeline(entries: AuditTrailEntry[], userId: string): AuditTrailEntry[] {
  return entries
    .filter((e) => e.changedByUserId === userId || e.userId === userId)
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

export function exportAuditTrailExcel(entries: AuditTrailEntry[]): string {
  const BOM = '\uFEFF';
  const headers = [
    'Audit ID', 'Date Time', 'Module', 'Collection', 'Record ID', 'Document Number',
    'Action Type', 'Description', 'Field', 'Old Value', 'New Value',
    'User ID', 'User Name', 'Role', 'Department', 'Reason', 'IP', 'Device', 'Browser',
    'E-Sign Required', 'E-Sign Status', 'Status',
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = entries.map((e) => [
    e.auditId, e.dateTime, e.moduleName, e.collectionName, e.recordId, e.documentNumber,
    e.actionType, e.actionDescription, e.fieldName, stringifyValue(e.oldValue), stringifyValue(e.newValue),
    e.changedByUserId, e.changedByUserName, e.changedByRole, e.department, e.reasonForChange,
    e.ipAddress, e.deviceInfo, e.browserInfo,
    e.eSignatureRequired ? 'Yes' : 'No', e.eSignatureStatus, e.status,
  ].map((c) => escape(String(c ?? ''))).join(','));

  return BOM + [headers.join(','), ...rows].join('\n');
}

export function buildAuditTrailPdfHtml(
  entries: AuditTrailEntry[],
  filters: AuditTrailFilters,
  generatedBy: string,
): string {
  const filterLines = [
    filters.moduleName && filters.moduleName !== 'all' ? `Module: ${filters.moduleName}` : null,
    filters.actionType && filters.actionType !== 'all' ? `Action: ${filters.actionType}` : null,
    filters.startDate ? `From: ${filters.startDate}` : null,
    filters.endDate ? `To: ${filters.endDate}` : null,
    filters.userId && filters.userId !== 'all' ? `User ID: ${filters.userId}` : null,
  ].filter(Boolean).join(' | ');

  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${new Date(e.dateTime).toLocaleString()}</td>
      <td>${e.moduleName}</td>
      <td>${e.recordId}</td>
      <td>${e.actionType}</td>
      <td>${e.changedByUserName}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Audit Trail Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1e293b; }
    h1 { color: #1e40af; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
    .footer { margin-top: 24px; font-size: 11px; color: #64748b; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>Pharma QMS — Audit Trail Report</h1>
  <p class="meta">21 CFR Part 11 Compliant Audit Log | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLines ? `<p class="meta">Filters: ${filterLines}</p>` : ''}
  <p class="meta">Total records: ${entries.length}</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Date Time</th><th>Module</th><th>Record ID</th>
        <th>Action</th><th>User</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <p>This report is system-generated and read-only. Audit records are append-only and tamper-protected.</p>
    <p>Page generated at ${new Date().toISOString()}</p>
  </div>
  <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;
}

export function openAuditTrailPdfReport(
  entries: AuditTrailEntry[],
  filters: AuditTrailFilters,
  generatedBy: string,
): void {
  const html = buildAuditTrailPdfHtml(entries, filters, generatedBy);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export async function logAuditTrailExport(
  meta: AuditTrailAuditMeta,
  format: 'Excel' | 'PDF' | 'Print',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: 'Admin',
    collectionName: ADMIN_COLLECTIONS.auditTrail,
    recordId: 'export',
    actionType: 'Export',
    actionDescription: `Audit trail exported as ${format} (${count} records)`,
    user: { id: meta.userId, name: meta.userName, role: meta.role, department: meta.department },
    status: 'Success',
  });

  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Audit Trail',
    recordId: 'export',
    action: 'EXPORT_AUDIT_TRAIL',
    oldValue: '',
    newValue: JSON.stringify({ format, count }),
    reason: '',
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });
}

/**
 * Firestore security recommendation (append-only audit trail):
 * match /audit_trail/{logId} {
 *   allow read: if isAuthenticated();
 *   allow create: if isAuthenticated();
 *   allow update, delete: if false;
 * }
 * Super Admin archive should use a separate archived_audit_trail collection via Admin SDK only.
 */
