import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries, normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  AUDIT_TRAIL_MODULE,
  applyOosAuditFilters,
  filterOosAuditByRole,
  isOosAuditEntry,
  mapToOosAuditEntry,
  toOosAuditEntry,
  type OosAuditEntry,
  type OosAuditFilters,
  type ReportActor,
} from '@/lib/oos-audit-trail-records';
import { OOS_COLLECTIONS, type OosRecord } from '@/lib/oos-types';
import { getOosById, listOosRecords } from '@/lib/oos-service';
import { normalizeRole } from '@/lib/permissions';

export type { OosAuditEntry, OosAuditFilters, ReportActor };

async function fetchLegacyOosLogs(oosId: string): Promise<OosAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), OOS_COLLECTIONS.auditLogs),
      where('recordId', '==', oosId),
      orderBy('dateTime', 'desc'),
      limit(200),
    ));
    return snap.docs.map((d) => mapToOosAuditEntry({ id: d.id, ...d.data() }, oosId));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), OOS_COLLECTIONS.auditLogs),
        where('recordId', '==', oosId),
        limit(200),
      ));
      return snap.docs
        .map((d) => mapToOosAuditEntry({ id: d.id, ...d.data() }, oosId))
        .filter((e) => {
          const mod = (e.module_name || '').toLowerCase();
          return mod.includes('oos') || mod === 'oos';
        });
    } catch {
      return [];
    }
  }
}

function dedupeEntries(entries: OosAuditEntry[]): OosAuditEntry[] {
  const seen = new Set<string>();
  const out: OosAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}-${e.oos_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function getPermittedOosIds(
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): Promise<Set<string> | undefined> {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r)) {
    return undefined;
  }
  const records = await listOosRecords();
  const ids = new Set<string>();
  for (const rec of records) {
    if (userId && rec.created_by === userId) ids.add(rec.id);
    else if (userDepartment && rec.department?.toLowerCase() === userDepartment.toLowerCase()) ids.add(rec.id);
  }
  return ids;
}

export async function fetchOosAuditTrail(
  oosId: string,
  oosNumber?: string,
): Promise<OosAuditEntry[]> {
  let record: OosRecord | null = null;
  if (!oosNumber) {
    record = await getOosById(oosId);
    oosNumber = record?.oos_number;
  }

  const [globalTrail, legacy] = await Promise.all([
    fetchAuditTrailEntries(),
    fetchLegacyOosLogs(oosId),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isOosAuditEntry(e, oosId, oosNumber))
    .map((e) => toOosAuditEntry(e, oosId, oosNumber || e.documentNumber));

  return dedupeEntries([...fromTrail, ...legacy]).sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function fetchAllOosAuditEntries(): Promise<OosAuditEntry[]> {
  const [globalTrail, oosRecords] = await Promise.all([
    fetchAuditTrailEntries(),
    listOosRecords(),
  ]);
  const numberById = new Map(oosRecords.map((r) => [r.id, r.oos_number]));

  const oosEntries = globalTrail
    .filter((e) => isOosAuditEntry(e))
    .map((e) => {
      const oid = e.recordId || e.documentId || '';
      return toOosAuditEntry(e, oid, numberById.get(oid) || e.documentNumber || '');
    });

  const legacyEntries: OosAuditEntry[] = [];
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), OOS_COLLECTIONS.auditLogs),
        orderBy('dateTime', 'desc'),
        limit(400),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        const mod = String(raw.module || raw.moduleName || '').toLowerCase();
        if (mod.includes('oos') || mod === 'oos') {
          const oid = String(raw.recordId || '');
          legacyEntries.push(mapToOosAuditEntry(
            { id: d.id, ...raw },
            oid,
            numberById.get(oid),
          ));
        }
      }
    } catch {
      // ignore legacy fetch errors
    }
  }

  return dedupeEntries([...oosEntries, ...legacyEntries]).sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function getFilteredOosAuditTrail(input: {
  oosId?: string;
  oosNumber?: string;
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: OosAuditFilters;
}): Promise<OosAuditEntry[]> {
  const permittedOosIds = await getPermittedOosIds(input.role, input.userId, input.userDepartment);
  const base = input.oosId
    ? await fetchOosAuditTrail(input.oosId, input.oosNumber)
    : await fetchAllOosAuditEntries();

  const scoped = filterOosAuditByRole(base, input.role, {
    userDepartment: input.userDepartment,
    userId: input.userId,
    permittedOosIds,
  });
  return applyOosAuditFilters(scoped, input.filters || {});
}

export async function logOosAuditExport(
  actor: ReportActor,
  oosId: string,
  oosNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: OOS_COLLECTIONS.records,
    recordId: oosId,
    documentNumber: oosNumber,
    actionType: 'Exported',
    actionDescription: `OOS audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logOosAuditPreviewed(
  actor: ReportActor,
  oosId: string,
  oosNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: OOS_COLLECTIONS.records,
    recordId: oosId,
    documentNumber: oosNumber,
    actionType: 'Updated',
    actionDescription: 'OOS audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildOosAuditPdfHtml(
  entries: OosAuditEntry[],
  oosNumber: string,
  generatedBy: string,
  filters: OosAuditFilters,
): string {
  const filterLine = [
    filters.oos_number && filters.oos_number !== 'all' ? `OOS: ${filters.oos_number}` : null,
    filters.action_type && filters.action_type !== 'all' ? `Action: ${filters.action_type}` : null,
    filters.module_name && filters.module_name !== 'all' ? `Module: ${filters.module_name}` : null,
    filters.start_date ? `From: ${filters.start_date}` : null,
    filters.end_date ? `To: ${filters.end_date}` : null,
    filters.search ? `Search: ${filters.search}` : null,
  ].filter(Boolean).join(' | ');

  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.date_time ? new Date(e.date_time).toLocaleString() : '—'}</td>
      <td>${e.oos_number || oosNumber}</td>
      <td>${e.action_type}</td>
      <td>${e.module_name}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>OOS Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>OOS Audit Trail Report</h1>
  <p class="meta">OOS: ${oosNumber || 'All'} | 21 CFR Part 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Page 1 of 1 | Total records: ${entries.length} | Append-only — cannot edit or delete</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>OOS No</th><th>Action</th><th>Module</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openOosAuditPdfReport(
  entries: OosAuditEntry[],
  oosNumber: string,
  generatedBy: string,
  filters: OosAuditFilters,
): void {
  const html = buildOosAuditPdfHtml(entries, oosNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper used by OOS detail and legacy callers */
export async function getAuditLogsForOos(oosId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchOosAuditTrail(oosId);
  return entries.map((e) => ({
    id: e.id,
    auditId: e.audit_id,
    dateTime: e.date_time,
    action: e.action_type,
    actionType: e.action_type,
    actionDescription: e.action_description,
    fieldName: e.field_name,
    oldValue: e.old_value,
    newValue: e.new_value,
    userId: e.changed_by,
    userName: e.changed_by_name,
    changedByRole: e.changed_by_role,
    department: e.department,
    reason: e.reason,
    ipAddress: e.ip_address,
    device: e.device_info,
    deviceInfo: e.device_info,
    module: e.module_name,
    moduleName: e.module_name,
    recordId: e.oos_id,
    documentNumber: e.oos_number,
    status: e.status,
  }));
}

export { normalizeAuditTrailEntry };
