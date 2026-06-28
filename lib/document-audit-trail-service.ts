import {
  addDoc, collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { downloadCsv } from '@/lib/export-utils';
import type {
  DocumentAuditEntry, DocumentAuditFilters, DocumentAuditActor, HashVerificationResult,
  AuditExportRecord,
} from './document-audit-trail-types';
import {
  mapAuditEventRaw, toDocumentAuditEntry, computeDocumentAuditKpis, computeDocumentAuditCharts,
  filterDocumentAuditEntries, isDmsAuditModule, computeRecordHash, verifyEntryHash,
  exportDocumentAuditCsv,
} from './document-audit-trail-records';
import type { AuditExportInput, CreateAuditEventInput } from './document-audit-trail-schemas';
import { DAT_COLLECTIONS, DAT_MODULE, canViewDocumentAuditTrail, isEmployeeOwnActivityView, isDeptHeadAuditView } from './document-audit-trail-types';

function now() { return new Date().toISOString(); }

function generateAuditNumber(): string {
  const year = new Date().getFullYear();
  return `DAT-${year}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function generateCorrelationId(): string {
  return `COR-${Date.now().toString(36).toUpperCase()}`;
}

function dedupeEntries(entries: DocumentAuditEntry[]): DocumentAuditEntry[] {
  const seen = new Set<string>();
  const out: DocumentAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc))) {
    const key = e.audit_id || `${e.timestamp_utc}-${e.event_type}-${e.performed_by}-${e.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function fetchAuditEventsCollection(): Promise<DocumentAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DAT_COLLECTIONS.auditEvents),
      orderBy('timestamp_utc', 'desc'),
      limit(500),
    ));
    return snap.docs.map((d) => mapAuditEventRaw({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), DAT_COLLECTIONS.auditEvents), limit(500)));
      return snap.docs.map((d) => mapAuditEventRaw({ id: d.id, ...d.data() }))
        .sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
    } catch { return []; }
  }
}

async function fetchAuditExports(): Promise<AuditExportRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DAT_COLLECTIONS.auditExports),
      orderBy('exported_at', 'desc'),
      limit(100),
    ));
    return snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        export_id: String(raw.export_id || d.id),
        format: String(raw.format || ''),
        record_count: Number(raw.record_count || 0),
        filters_applied: String(raw.filters_applied || ''),
        exported_by: String(raw.exported_by || ''),
        exported_by_name: String(raw.exported_by_name || ''),
        exported_at: String(raw.exported_at || ''),
        status: String(raw.status || 'Completed'),
      };
    });
  } catch { return []; }
}

export async function fetchAllDocumentAuditEntries(): Promise<DocumentAuditEntry[]> {
  const [globalTrail, enrichedEvents] = await Promise.all([
    fetchAuditTrailEntries(),
    fetchAuditEventsCollection(),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isDmsAuditModule(e.moduleName))
    .map((e) => toDocumentAuditEntry(e));

  return dedupeEntries([...fromTrail, ...enrichedEvents]);
}

export function filterDocumentAuditByRole(
  entries: DocumentAuditEntry[],
  role: string,
  userId?: string,
  department?: string,
): DocumentAuditEntry[] {
  if (!canViewDocumentAuditTrail(role)) return [];
  if (isEmployeeOwnActivityView(role) && userId) {
    return entries.filter((e) => e.performed_by === userId);
  }
  if (isDeptHeadAuditView(role) && department) {
    return entries.filter((e) => e.department === department || e.performed_by === userId);
  }
  return entries;
}

export async function fetchDocumentAuditDashboard(input: {
  role: string;
  userId?: string;
  department?: string;
  filters?: DocumentAuditFilters;
}) {
  const [entries, exports] = await Promise.all([
    fetchAllDocumentAuditEntries(),
    fetchAuditExports(),
  ]);
  const scoped = filterDocumentAuditByRole(entries, input.role, input.userId, input.department);
  const filtered = filterDocumentAuditEntries(scoped, input.filters || {});

  const tamperResults = filtered.slice(0, 200).map(verifyEntryHash);
  const tamperCount = tamperResults.filter((r) => !r.valid).length;

  const userMap = new Map<string, string>();
  filtered.forEach((e) => { if (e.performed_by) userMap.set(e.performed_by, e.performer_name); });

  return {
    entries: filtered.length ? filtered : scoped,
    exports,
    metrics: computeDocumentAuditKpis(filtered.length ? filtered : scoped, exports.length, tamperCount),
    charts: computeDocumentAuditCharts(filtered.length ? filtered : scoped),
    users: Array.from(userMap.entries()).map(([id, name]) => ({ id, name })),
    tamperCount,
  };
}

export async function createDocumentAuditEvent(input: CreateAuditEventInput, actor: DocumentAuditActor): Promise<DocumentAuditEntry> {
  const timestamp = now();
  const auditNumber = generateAuditNumber();
  const correlationId = input.correlation_id || generateCorrelationId();
  const base: DocumentAuditEntry = {
    id: '',
    audit_id: auditNumber,
    audit_number: auditNumber,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    module: DAT_MODULE,
    document_id: input.document_id || input.entity_id,
    document_number: input.document_number || '',
    document_title: '',
    document_version: '',
    event_type: input.event_type,
    event_category: 'Document Lifecycle',
    previous_value: input.previous_value || '',
    new_value: input.new_value || '',
    action_summary: `${input.event_type} on ${input.entity_type}`,
    reason_for_change: input.reason_for_change || '',
    performed_by: actor.id,
    performer_role: actor.role,
    performer_name: actor.name,
    department: actor.department || '',
    business_unit: '',
    site: '',
    timestamp_utc: timestamp,
    local_timestamp: new Date(timestamp).toLocaleString(),
    ip_address: typeof window !== 'undefined' ? 'client' : 'server',
    device_information: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop') : 'server',
    browser_information: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    session_id: '',
    correlation_id: correlationId,
    electronic_signature_id: '',
    related_record_id: '',
    risk_level: 'Medium',
    compliance_impact: 'GMP Document Control',
    source_system: 'eQMS',
    record_hash: '',
    digital_fingerprint: '',
    status: 'Success',
    created_at: timestamp,
  };
  base.record_hash = computeRecordHash(base);

  const ref = await addDoc(collection(getFirebaseFirestore(), DAT_COLLECTIONS.auditEvents), {
    ...base,
    module: DAT_MODULE,
    append_only: true,
  });

  await createAuditLog({
    moduleName: DAT_MODULE,
    collectionName: DAT_COLLECTIONS.auditEvents,
    recordId: ref.id,
    documentNumber: input.document_number,
    actionType: input.event_type,
    actionDescription: base.action_summary,
    oldValue: input.previous_value,
    newValue: input.new_value,
    reason: input.reason_for_change,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });

  return mapAuditEventRaw({ ...base, id: ref.id });
}

export async function verifyAuditRecordIntegrity(entry: DocumentAuditEntry): Promise<HashVerificationResult> {
  const { valid, computed, stored } = verifyEntryHash(entry);
  return {
    audit_id: entry.audit_id,
    valid,
    stored_hash: stored,
    computed_hash: computed,
    message: valid ? 'Record integrity verified — no tampering detected' : 'Hash mismatch — record may have been tampered with',
  };
}

export async function verifyAllAuditRecords(entries: DocumentAuditEntry[]): Promise<HashVerificationResult[]> {
  return Promise.all(entries.slice(0, 500).map(verifyAuditRecordIntegrity));
}

export async function exportDocumentAuditTrail(
  entries: DocumentAuditEntry[],
  input: AuditExportInput,
  actor: DocumentAuditActor,
): Promise<number> {
  const { headers, rows } = exportDocumentAuditCsv(entries);
  const exportId = `EXP-${Date.now()}`;

  if (input.format === 'csv' || input.format === 'excel') {
    downloadCsv(`document-audit-trail.${input.format === 'excel' ? 'csv' : 'csv'}`, headers, rows);
  } else {
    openDocumentAuditPrintReport(entries, actor.name, input);
  }

  await addDoc(collection(getFirebaseFirestore(), DAT_COLLECTIONS.auditExports), {
    export_id: exportId,
    format: input.format,
    record_count: entries.length,
    filters_applied: JSON.stringify(input),
    exported_by: actor.id,
    exported_by_name: actor.name,
    exported_at: now(),
    status: 'Completed',
    module: DAT_MODULE,
  });

  await createAuditLog({
    moduleName: DAT_MODULE,
    collectionName: DAT_COLLECTIONS.auditExports,
    recordId: exportId,
    actionType: 'Exported',
    actionDescription: `Document audit trail exported as ${input.format.toUpperCase()} (${entries.length} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });

  return entries.length;
}

export function openDocumentAuditPrintReport(
  entries: DocumentAuditEntry[],
  generatedBy: string,
  filters: AuditExportInput | DocumentAuditFilters,
) {
  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.timestamp_utc ? new Date(e.timestamp_utc).toLocaleString() : '—'}</td>
      <td>${e.document_number || e.entity_id}</td>
      <td>${e.event_type}</td>
      <td>${e.performer_name}</td>
      <td>${e.risk_level}</td>
      <td style="font-family:monospace;font-size:10px">${e.record_hash?.slice(0, 12)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Document Audit Trail Report</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
    h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0}
    .meta{color:#666;margin:8px 0}</style></head><body>
    <h1>Document Audit Trail — Inspection Report</h1>
    <p class="meta">Generated by: ${generatedBy} | ${new Date().toLocaleString()} | Records: ${entries.length}</p>
    <p class="meta">Append-only immutable audit records — 21 CFR Part 11 compliant</p>
    <table><thead><tr><th>#</th><th>Timestamp</th><th>Document</th><th>Event</th><th>User</th><th>Risk</th><th>Hash</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export async function logDocumentAuditViewed(actor: DocumentAuditActor, entityId?: string, inspectionMode = false) {
  await createAuditLog({
    moduleName: DAT_MODULE,
    collectionName: DAT_COLLECTIONS.auditTrail,
    recordId: entityId || 'document-audit-trail',
    actionType: inspectionMode ? 'Inspection Mode Enabled' : 'View',
    actionDescription: entityId
      ? `Document entity audit history viewed: ${entityId}`
      : 'Document audit trail dashboard viewed',
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logTamperDetected(actor: DocumentAuditActor, auditId: string, details: string) {
  await createAuditLog({
    moduleName: DAT_MODULE,
    collectionName: DAT_COLLECTIONS.auditEvents,
    recordId: auditId,
    actionType: 'Tamper Detected',
    actionDescription: details,
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Failed',
  });
  try {
    await addDoc(collection(getFirebaseFirestore(), DAT_COLLECTIONS.notifications), {
      title: 'Tamper Detection Alert',
      message: details,
      module: DAT_MODULE,
      record_id: auditId,
      target_role: 'head_qa',
      read: false,
      created_at: now(),
    });
  } catch { /* optional */ }
}

export async function runIntegrityVerificationJobs(): Promise<{ verified: number; tampered: number }> {
  const entries = await fetchAllDocumentAuditEntries();
  const results = await verifyAllAuditRecords(entries);
  const tampered = results.filter((r) => !r.valid);
  if (tampered.length) {
    await logTamperDetected(
      { id: 'system', name: 'Audit Scheduler', role: 'super_admin' },
      tampered[0].audit_id,
      `${tampered.length} audit record(s) failed hash verification`,
    );
  }
  return { verified: results.length, tampered: tampered.length };
}

export async function runScheduledDocumentAuditJobs() {
  return runIntegrityVerificationJobs();
}
