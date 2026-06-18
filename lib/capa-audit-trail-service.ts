import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries, normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  AUDIT_TRAIL_MODULE,
  applyCapaAuditFilters,
  filterCapaAuditByRole,
  isCapaAuditEntry,
  mapToCapaAuditEntry,
  toCapaAuditEntry,
  type CapaAuditActor,
  type CapaAuditEntry,
  type CapaAuditFilters,
} from '@/lib/capa-audit-trail-records';
import { CAPA_COLLECTIONS, type CapaRecord } from '@/lib/capa-types';
import { getCapaById, listCapas } from '@/lib/capa-service';
import { normalizeRole } from '@/lib/permissions';

export type { CapaAuditEntry, CapaAuditFilters, CapaAuditActor };

async function fetchLegacyCapaLogs(capaId: string): Promise<CapaAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CAPA_COLLECTIONS.auditLogs),
      where('recordId', '==', capaId),
      orderBy('dateTime', 'desc'),
      limit(200),
    ));
    return snap.docs.map((d) => mapToCapaAuditEntry({ id: d.id, ...d.data() }, capaId));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), CAPA_COLLECTIONS.auditLogs),
        where('recordId', '==', capaId),
        limit(200),
      ));
      return snap.docs
        .map((d) => mapToCapaAuditEntry({ id: d.id, ...d.data() }, capaId))
        .filter((e) => {
          const mod = (e.module_name || '').toLowerCase();
          return mod.includes('capa') || mod === 'capa';
        });
    } catch {
      return [];
    }
  }
}

function dedupeEntries(entries: CapaAuditEntry[]): CapaAuditEntry[] {
  const seen = new Set<string>();
  const out: CapaAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}-${e.capa_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function getPermittedCapaIds(
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): Promise<Set<string> | undefined> {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r)) {
    return undefined;
  }
  const records = await listCapas();
  const ids = new Set<string>();
  for (const rec of records) {
    if (userId && (rec.action_owner === userId || rec.created_by === userId)) ids.add(rec.id);
    else if (userDepartment && rec.department?.toLowerCase() === userDepartment.toLowerCase()) ids.add(rec.id);
  }
  return ids;
}

export async function fetchCapaAuditTrail(
  capaId: string,
  capaNumber?: string,
): Promise<CapaAuditEntry[]> {
  if (!capaId) return [];
  let record: CapaRecord | null = null;
  if (!capaNumber) {
    record = await getCapaById(capaId);
    capaNumber = record?.capa_number;
  }

  const [globalTrail, legacy] = await Promise.all([
    fetchAuditTrailEntries(),
    fetchLegacyCapaLogs(capaId),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isCapaAuditEntry(e, capaId, capaNumber))
    .map((e) => toCapaAuditEntry(e, capaId, capaNumber || e.documentNumber));

  return dedupeEntries([...fromTrail, ...legacy]).sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function fetchAllCapaAuditEntries(): Promise<CapaAuditEntry[]> {
  const [globalTrail, capaRecords] = await Promise.all([
    fetchAuditTrailEntries(),
    listCapas(),
  ]);
  const numberById = new Map(capaRecords.map((r) => [r.id, r.capa_number]));

  const capaEntries = globalTrail
    .filter((e) => isCapaAuditEntry(e))
    .map((e) => {
      const cid = e.recordId || e.documentId || '';
      return toCapaAuditEntry(e, cid, numberById.get(cid) || e.documentNumber || '');
    });

  const legacyEntries: CapaAuditEntry[] = [];
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), CAPA_COLLECTIONS.auditLogs),
        orderBy('dateTime', 'desc'),
        limit(400),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        const mod = String(raw.module || raw.moduleName || '').toLowerCase();
        if (mod.includes('capa') || mod === 'capa') {
          const cid = String(raw.recordId || '');
          legacyEntries.push(mapToCapaAuditEntry(
            { id: d.id, ...raw },
            cid,
            numberById.get(cid),
          ));
        }
      }
    } catch {
      // ignore legacy fetch errors
    }
  }

  return dedupeEntries([...capaEntries, ...legacyEntries]).sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function getFilteredCapaAuditTrail(input: {
  capaId?: string;
  capaNumber?: string;
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: CapaAuditFilters;
}): Promise<CapaAuditEntry[]> {
  if (input.capaId === '') return [];
  const permittedCapaIds = await getPermittedCapaIds(input.role, input.userId, input.userDepartment);
  const base = input.capaId
    ? await fetchCapaAuditTrail(input.capaId, input.capaNumber)
    : await fetchAllCapaAuditEntries();

  const scoped = filterCapaAuditByRole(base, input.role, {
    userDepartment: input.userDepartment,
    userId: input.userId,
    permittedCapaIds,
  });
  return applyCapaAuditFilters(scoped, input.filters || {});
}

export async function logCapaAuditExport(
  actor: CapaAuditActor,
  capaId: string,
  capaNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: CAPA_COLLECTIONS.records,
    recordId: capaId,
    documentNumber: capaNumber,
    actionType: 'Exported',
    actionDescription: `CAPA audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logCapaAuditPreviewed(
  actor: CapaAuditActor,
  capaId: string,
  capaNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: CAPA_COLLECTIONS.records,
    recordId: capaId,
    documentNumber: capaNumber,
    actionType: 'Updated',
    actionDescription: 'CAPA audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildCapaAuditPdfHtml(
  entries: CapaAuditEntry[],
  capaNumber: string,
  generatedBy: string,
  filters: CapaAuditFilters,
): string {
  const filterLine = [
    filters.capa_number && filters.capa_number !== 'all' ? `CAPA: ${filters.capa_number}` : null,
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
      <td>${e.capa_number || capaNumber}</td>
      <td>${e.action_type}</td>
      <td>${e.module_name}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CAPA Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>CAPA Audit Trail Report</h1>
  <p class="meta">CAPA: ${capaNumber || 'All'} | 21 CFR Part 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Page 1 of 1 | Total records: ${entries.length} | Immutable — cannot edit or delete</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>CAPA No</th><th>Action</th><th>Module</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openCapaAuditPdfReport(
  entries: CapaAuditEntry[],
  capaNumber: string,
  generatedBy: string,
  filters: CapaAuditFilters,
): void {
  const html = buildCapaAuditPdfHtml(entries, capaNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper used by CAPA detail and legacy callers */
export async function getAuditLogsForCapa(capaId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchCapaAuditTrail(capaId);
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
    recordId: e.capa_id,
    documentNumber: e.capa_number,
    status: e.status,
  }));
}

export { normalizeAuditTrailEntry };
