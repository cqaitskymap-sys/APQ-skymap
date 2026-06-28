import type {
  DocumentAuditEntry, DocumentAuditKpis, DocumentAuditCharts, DocumentAuditFilters,
} from './document-audit-trail-types';
import {
  DMS_AUDIT_MODULE_NAMES, CRITICAL_DMS_EVENTS, SECURITY_DMS_EVENTS,
} from './document-audit-trail-types';
import type { AuditTrailEntry } from '@/lib/admin/schemas';

function todayKey() { return new Date().toISOString().split('T')[0]; }
function dateKey(ts: string) { return ts.slice(0, 10); }

export function computeRecordHash(entry: Pick<DocumentAuditEntry,
  'audit_id' | 'timestamp_utc' | 'event_type' | 'performed_by' | 'document_id' | 'previous_value' | 'new_value'
>): string {
  const payload = [
    entry.audit_id, entry.timestamp_utc, entry.event_type, entry.performed_by,
    entry.document_id, entry.previous_value, entry.new_value,
  ].join('|');
  let hash = 0;
  for (let i = 0; i < payload.length; i++) hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export function computeDigitalFingerprint(entry: DocumentAuditEntry): string {
  const raw = `${entry.audit_number}:${entry.document_number}:${entry.timestamp_utc}:${entry.performed_by}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).toUpperCase().padStart(10, '0');
}

export function formatAuditLocalTime(utc: string): string {
  if (!utc) return '—';
  try { return new Date(utc).toLocaleString(); } catch { return utc; }
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function inferEventCategory(eventType: string, module: string): string {
  const t = eventType.toLowerCase();
  if (['login', 'logout', 'permission changed'].some((x) => t.includes(x))) return 'Security';
  if (t.includes('print')) return 'Print Control';
  if (t.includes('watermark')) return 'Print Control';
  if (['archive', 'restore'].some((x) => t.includes(x))) return 'Archive';
  if (['retention', 'disposed'].some((x) => t.includes(x))) return 'Retention';
  if (t.includes('train')) return 'Training';
  if (t.includes('distribut')) return 'Distribution';
  if (['approve', 'reject', 'review', 'submit'].some((x) => t.includes(x))) return 'Approval Workflow';
  if (module.toLowerCase().includes('config')) return 'System';
  return 'Document Lifecycle';
}

function inferRiskLevel(eventType: string): string {
  if (CRITICAL_DMS_EVENTS.has(eventType)) return 'Critical';
  if (SECURITY_DMS_EVENTS.has(eventType)) return 'High';
  if (['Updated', 'Viewed', 'Downloaded'].includes(eventType)) return 'Low';
  return 'Medium';
}

function normalizeEventType(raw: string): string {
  const map: Record<string, string> = {
    CREATE: 'Created', create: 'Created', Create: 'Created', CREATED: 'Created',
    UPDATE: 'Updated', update: 'Updated', Update: 'Updated',
    DELETE: 'Deleted', delete: 'Deleted',
    APPROVE: 'Approved', APPROVED: 'Approved', Approve: 'Approved',
    REJECT: 'Rejected', REJECTED: 'Rejected', Reject: 'Rejected',
    PRINT_REQUESTED: 'Printed', PRINT_APPROVED: 'Approved', WATERMARK_APPLIED: 'Watermark Applied',
    WATERMARK_PRINTED: 'Printed', WATERMARK_EXPORTED: 'Exported', WATERMARK_VIEWED: 'Viewed',
    ELECTRONIC_SIGNATURE_COMPLETED: 'Electronic Signature Applied',
    SIGNATURE_VERIFIED: 'Electronic Signature Applied',
    EXPORT: 'Exported', Export: 'Exported', VIEW: 'Viewed', View: 'Viewed',
    LOGIN: 'Login', Login: 'Login', LOGOUT: 'Logout',
    ARCHIVE: 'Archived', RESTORE: 'Restored',
    CONFIGURATION_CHANGED: 'Configuration Changed',
    PERMISSION_CHANGED: 'Permission Changed',
    TAMPER_DETECTED: 'Tamper Detected',
  };
  if (map[raw]) return map[raw];
  for (const [k, v] of Object.entries(map)) {
    if (raw.toLowerCase() === k.toLowerCase()) return v;
  }
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isDmsAuditModule(moduleName: string): boolean {
  const mod = moduleName.toLowerCase();
  if (DMS_AUDIT_MODULE_NAMES.some((m) => mod.includes(m.toLowerCase()))) return true;
  return mod.includes('document') || mod.includes('dms') || mod.includes('sop')
    || mod.includes('watermark') || mod.includes('print control') || mod.includes('archive')
    || mod.includes('retention') || mod.includes('external document');
}

export function mapAuditEventRaw(raw: Record<string, unknown> & { id: string }): DocumentAuditEntry {
  const timestamp = String(raw.timestamp_utc || raw.timestamp || raw.created_at || raw.dateTime || '');
  const eventType = normalizeEventType(String(raw.event_type || raw.actionType || raw.action || ''));
  const entry: DocumentAuditEntry = {
    id: raw.id,
    audit_id: String(raw.audit_id || raw.auditId || raw.id),
    audit_number: String(raw.audit_number || raw.auditId || raw.audit_id || raw.id),
    entity_type: String(raw.entity_type || raw.collectionName || raw.entityType || ''),
    entity_id: String(raw.entity_id || raw.recordId || raw.documentId || ''),
    module: String(raw.module || raw.moduleName || 'DMS'),
    document_id: String(raw.document_id || raw.documentId || raw.recordId || ''),
    document_number: String(raw.document_number || raw.documentNumber || ''),
    document_title: String(raw.document_title || raw.documentTitle || ''),
    document_version: String(raw.document_version || raw.documentVersion || ''),
    event_type: eventType,
    event_category: String(raw.event_category || raw.eventCategory || inferEventCategory(eventType, String(raw.module || ''))),
    previous_value: stringifyValue(raw.previous_value ?? raw.oldValue),
    new_value: stringifyValue(raw.new_value ?? raw.newValue),
    action_summary: String(raw.action_summary || raw.actionDescription || raw.action_summary || `${eventType} event`),
    reason_for_change: String(raw.reason_for_change || raw.reasonForChange || raw.reason || ''),
    performed_by: String(raw.performed_by || raw.changedByUserId || raw.userId || ''),
    performer_role: String(raw.performer_role || raw.changedByRole || raw.role || ''),
    performer_name: String(raw.performer_name || raw.performed_by_name || raw.changedByUserName || raw.userName || ''),
    department: String(raw.department || ''),
    business_unit: String(raw.business_unit || raw.businessUnit || ''),
    site: String(raw.site || ''),
    timestamp_utc: timestamp,
    local_timestamp: String(raw.local_timestamp || formatAuditLocalTime(timestamp)),
    ip_address: String(raw.ip_address || raw.ipAddress || ''),
    device_information: String(raw.device_information || raw.deviceInfo || raw.device || ''),
    browser_information: String(raw.browser_information || raw.browserInfo || ''),
    session_id: String(raw.session_id || raw.sessionId || ''),
    correlation_id: String(raw.correlation_id || raw.correlationId || ''),
    electronic_signature_id: String(raw.electronic_signature_id || raw.signature_id || raw.eSignatureId || ''),
    related_record_id: String(raw.related_record_id || raw.relatedRecordId || ''),
    risk_level: String(raw.risk_level || inferRiskLevel(eventType)),
    compliance_impact: String(raw.compliance_impact || raw.complianceImpact || ''),
    source_system: String(raw.source_system || raw.sourceSystem || 'eQMS'),
    record_hash: String(raw.record_hash || raw.recordHash || ''),
    digital_fingerprint: String(raw.digital_fingerprint || raw.digitalFingerprint || ''),
    status: String(raw.status || 'Success'),
    created_at: String(raw.created_at || timestamp),
  };
  if (!entry.record_hash) entry.record_hash = computeRecordHash(entry);
  if (!entry.digital_fingerprint) entry.digital_fingerprint = computeDigitalFingerprint(entry);
  return entry;
}

export function toDocumentAuditEntry(entry: AuditTrailEntry): DocumentAuditEntry {
  return mapAuditEventRaw({
    id: entry.id || entry.auditId,
    auditId: entry.auditId,
    moduleName: entry.moduleName,
    collectionName: entry.collectionName,
    recordId: entry.recordId,
    documentNumber: entry.documentNumber,
    actionType: entry.actionType,
    actionDescription: entry.actionDescription,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    changedByUserId: entry.changedByUserId,
    changedByUserName: entry.changedByUserName,
    changedByRole: entry.changedByRole,
    department: entry.department,
    reasonForChange: entry.reasonForChange,
    ipAddress: entry.ipAddress,
    deviceInfo: entry.deviceInfo,
    browserInfo: entry.browserInfo,
    dateTime: entry.dateTime,
    status: entry.status,
  });
}

export function emptyDocumentAuditKpis(): DocumentAuditKpis {
  return {
    auditEventsToday: 0, totalAuditRecords: 0, criticalEvents: 0,
    electronicSignatureEvents: 0, securityEvents: 0, configurationChanges: 0,
    exportRequests: 0, tamperVerificationStatus: 'Verified',
  };
}

export function emptyDocumentAuditCharts(): DocumentAuditCharts {
  return {
    dailyActivity: [], eventTypeDistribution: [], moduleActivity: [],
    userActivity: [], departmentActivity: [], securityEventTrend: [],
  };
}

export function computeDocumentAuditKpis(entries: DocumentAuditEntry[], exportCount = 0, tamperCount = 0): DocumentAuditKpis {
  const today = todayKey();
  return {
    auditEventsToday: entries.filter((e) => e.timestamp_utc.startsWith(today)).length,
    totalAuditRecords: entries.length,
    criticalEvents: entries.filter((e) => e.risk_level === 'Critical' || CRITICAL_DMS_EVENTS.has(e.event_type)).length,
    electronicSignatureEvents: entries.filter((e) => e.event_type.includes('Signature') || e.electronic_signature_id).length,
    securityEvents: entries.filter((e) => e.event_category === 'Security' || SECURITY_DMS_EVENTS.has(e.event_type)).length,
    configurationChanges: entries.filter((e) => e.event_type === 'Configuration Changed').length,
    exportRequests: exportCount,
    tamperVerificationStatus: tamperCount > 0 ? `${tamperCount} Tampered` : 'Verified',
  };
}

export function computeDocumentAuditCharts(entries: DocumentAuditEntry[]): DocumentAuditCharts {
  const daily = new Map<string, number>();
  const byType = new Map<string, number>();
  const byModule = new Map<string, number>();
  const byUser = new Map<string, number>();
  const byDept = new Map<string, number>();
  const securityByDate = new Map<string, number>();

  for (const e of entries) {
    if (e.timestamp_utc) daily.set(dateKey(e.timestamp_utc), (daily.get(dateKey(e.timestamp_utc)) || 0) + 1);
    byType.set(e.event_type || 'Unknown', (byType.get(e.event_type || 'Unknown') || 0) + 1);
    byModule.set(e.module || 'Unknown', (byModule.get(e.module || 'Unknown') || 0) + 1);
    byUser.set(e.performer_name || 'Unknown', (byUser.get(e.performer_name || 'Unknown') || 0) + 1);
    byDept.set(e.department || 'Unknown', (byDept.get(e.department || 'Unknown') || 0) + 1);
    if (e.event_category === 'Security' && e.timestamp_utc) {
      securityByDate.set(dateKey(e.timestamp_utc), (securityByDate.get(dateKey(e.timestamp_utc)) || 0) + 1);
    }
  }

  const toSorted = (m: Map<string, number>, key = 'date') =>
    Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, count]) => key === 'date' ? { date: k, count } : { name: k, value: count });

  return {
    dailyActivity: toSorted(daily, 'date') as DocumentAuditCharts['dailyActivity'],
    eventTypeDistribution: toSorted(byType, 'name') as DocumentAuditCharts['eventTypeDistribution'],
    moduleActivity: toSorted(byModule, 'name') as DocumentAuditCharts['moduleActivity'],
    userActivity: toSorted(byUser, 'name').slice(0, 10) as DocumentAuditCharts['userActivity'],
    departmentActivity: toSorted(byDept, 'name') as DocumentAuditCharts['departmentActivity'],
    securityEventTrend: toSorted(securityByDate, 'date') as DocumentAuditCharts['securityEventTrend'],
  };
}

export function filterDocumentAuditEntries(entries: DocumentAuditEntry[], filters: DocumentAuditFilters): DocumentAuditEntry[] {
  let result = [...entries];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((e) =>
      e.document_number.toLowerCase().includes(q) || e.document_title.toLowerCase().includes(q) ||
      e.performer_name.toLowerCase().includes(q) || e.action_summary.toLowerCase().includes(q) ||
      e.audit_number.toLowerCase().includes(q) || e.correlation_id.toLowerCase().includes(q),
    );
  }
  if (filters.module) result = result.filter((e) => e.module === filters.module);
  if (filters.event_type) result = result.filter((e) => e.event_type === filters.event_type);
  if (filters.event_category) result = result.filter((e) => e.event_category === filters.event_category);
  if (filters.department) result = result.filter((e) => e.department === filters.department);
  if (filters.user_id) result = result.filter((e) => e.performed_by === filters.user_id);
  if (filters.document_number) result = result.filter((e) => e.document_number === filters.document_number);
  if (filters.entity_id) result = result.filter((e) => e.entity_id === filters.entity_id || e.document_id === filters.entity_id);
  if (filters.correlation_id) result = result.filter((e) => e.correlation_id === filters.correlation_id);
  if (filters.risk_level) result = result.filter((e) => e.risk_level === filters.risk_level);
  if (filters.critical) result = result.filter((e) => e.risk_level === 'Critical' || CRITICAL_DMS_EVENTS.has(e.event_type));
  if (filters.security) result = result.filter((e) => e.event_category === 'Security');
  if (filters.e_signature) result = result.filter((e) => e.event_type.includes('Signature') || Boolean(e.electronic_signature_id));
  if (filters.configuration) result = result.filter((e) => e.event_type === 'Configuration Changed');
  if (filters.start_date) result = result.filter((e) => e.timestamp_utc >= filters.start_date!);
  if (filters.end_date) result = result.filter((e) => e.timestamp_utc <= `${filters.end_date}T23:59:59`);
  if (filters.department_only) result = result.filter((e) => e.department === filters.department_only);
  return result;
}

export const DAT_KPI_FILTER_MAP: Record<string, DocumentAuditFilters> = {
  today: {},
  total: {},
  critical: { critical: true },
  esignature: { e_signature: true },
  security: { security: true },
  configuration: { configuration: true },
  exports: {},
};

export function paginateAuditEntries(entries: DocumentAuditEntry[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return entries.slice(start, start + pageSize);
}

export function getEntityHistory(entries: DocumentAuditEntry[], entityId: string): DocumentAuditEntry[] {
  return entries
    .filter((e) => e.entity_id === entityId || e.document_id === entityId)
    .sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));
}

export function getCorrelationEvents(entries: DocumentAuditEntry[], correlationId: string): DocumentAuditEntry[] {
  return entries
    .filter((e) => e.correlation_id === correlationId)
    .sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));
}

export function getCriticalEvents(entries: DocumentAuditEntry[]): DocumentAuditEntry[] {
  return entries.filter((e) => e.risk_level === 'Critical' || CRITICAL_DMS_EVENTS.has(e.event_type));
}

export function verifyEntryHash(entry: DocumentAuditEntry): { valid: boolean; computed: string; stored: string } {
  const computed = computeRecordHash(entry);
  const stored = entry.record_hash;
  return { valid: !stored || stored === computed, computed, stored };
}

export function exportDocumentAuditCsv(entries: DocumentAuditEntry[]) {
  const headers = [
    'Audit #', 'Document', 'Version', 'Event', 'Category', 'User', 'Department',
    'Timestamp UTC', 'Risk', 'Hash', 'Summary',
  ];
  const rows = entries.map((e) => [
    e.audit_number, e.document_number, e.document_version, e.event_type, e.event_category,
    e.performer_name, e.department, e.timestamp_utc, e.risk_level, e.record_hash, e.action_summary,
  ]);
  return { headers, rows };
}
