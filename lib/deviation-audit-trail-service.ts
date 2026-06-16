import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries, normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  AUDIT_TRAIL_MODULE,
  applyDeviationAuditFilters,
  filterDeviationAuditByRole,
  isDeviationAuditEntry,
  mapToDeviationAuditEntry,
  toDeviationAuditEntry,
  type DeviationAuditEntry,
  type DeviationAuditFilters,
  type ReportActor,
} from '@/lib/deviation-audit-trail-records';
import { DEVIATION_COLLECTIONS, type DeviationRecord } from '@/lib/deviation-types';
import { getDeviationById, listDeviations } from '@/lib/deviation-service';

export type { DeviationAuditEntry, DeviationAuditFilters, ReportActor };

async function fetchLegacyDeviationLogs(deviationId: string): Promise<DeviationAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.auditLogs),
      where('recordId', '==', deviationId),
      orderBy('dateTime', 'desc'),
      limit(200),
    ));
    return snap.docs.map((d) => mapToDeviationAuditEntry({ id: d.id, ...d.data() }, deviationId));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.auditLogs),
        where('recordId', '==', deviationId),
        limit(200),
      ));
      return snap.docs.map((d) => mapToDeviationAuditEntry({ id: d.id, ...d.data() }, deviationId));
    } catch {
      return [];
    }
  }
}

function dedupeEntries(entries: DeviationAuditEntry[]): DeviationAuditEntry[] {
  const seen = new Set<string>();
  const out: DeviationAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export async function fetchDeviationAuditTrail(
  deviationId: string,
  deviationNumber?: string,
): Promise<DeviationAuditEntry[]> {
  let record: DeviationRecord | null = null;
  if (!deviationNumber) {
    record = await getDeviationById(deviationId);
    deviationNumber = record?.deviation_number;
  }

  const [globalTrail, legacy] = await Promise.all([
    fetchAuditTrailEntries(),
    fetchLegacyDeviationLogs(deviationId),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isDeviationAuditEntry(e, deviationId, deviationNumber))
    .map((e) => toDeviationAuditEntry(e, deviationId, deviationNumber));

  return dedupeEntries([...fromTrail, ...legacy]);
}

export async function fetchAllDeviationAuditEntries(): Promise<DeviationAuditEntry[]> {
  const [globalTrail, deviations] = await Promise.all([
    fetchAuditTrailEntries(),
    listDeviations(),
  ]);
  const numberById = new Map(deviations.map((d) => [d.id, d.deviation_number]));

  const deviationEntries = globalTrail
    .filter((e) => isDeviationAuditEntry(e))
    .map((e) => {
      const devId = e.recordId || e.documentId || '';
      return toDeviationAuditEntry(e, devId, numberById.get(devId) || e.documentNumber || '');
    });

  const legacyEntries: DeviationAuditEntry[] = [];
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), DEVIATION_COLLECTIONS.auditLogs),
        orderBy('dateTime', 'desc'),
        limit(300),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        if (String(raw.module || '').toLowerCase().includes('deviation')) {
          const devId = String(raw.recordId || '');
          legacyEntries.push(mapToDeviationAuditEntry(
            { id: d.id, ...raw },
            devId,
            numberById.get(devId),
          ));
        }
      }
    } catch {
      // ignore legacy fetch errors
    }
  }

  return dedupeEntries([...deviationEntries, ...legacyEntries]);
}

export async function getFilteredDeviationAuditTrail(input: {
  deviationId?: string;
  deviationNumber?: string;
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: DeviationAuditFilters;
}): Promise<DeviationAuditEntry[]> {
  const base = input.deviationId
    ? await fetchDeviationAuditTrail(input.deviationId, input.deviationNumber)
    : await fetchAllDeviationAuditEntries();

  const scoped = filterDeviationAuditByRole(base, input.role, input.userDepartment, input.userId);
  return applyDeviationAuditFilters(scoped, input.filters || {});
}

export async function logDeviationAuditExport(
  actor: ReportActor,
  deviationId: string,
  deviationNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: DEVIATION_COLLECTIONS.deviations,
    recordId: deviationId,
    documentNumber: deviationNumber,
    actionType: 'Exported',
    actionDescription: `Audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logDeviationAuditPreviewed(
  actor: ReportActor,
  deviationId: string,
  deviationNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: DEVIATION_COLLECTIONS.deviations,
    recordId: deviationId,
    documentNumber: deviationNumber,
    actionType: 'Updated',
    actionDescription: 'Audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildDeviationAuditPdfHtml(
  entries: DeviationAuditEntry[],
  deviationNumber: string,
  generatedBy: string,
  filters: DeviationAuditFilters,
): string {
  const filterLine = [
    filters.action_type && filters.action_type !== 'all' ? `Action: ${filters.action_type}` : null,
    filters.start_date ? `From: ${filters.start_date}` : null,
    filters.end_date ? `To: ${filters.end_date}` : null,
    filters.search ? `Search: ${filters.search}` : null,
  ].filter(Boolean).join(' | ');

  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${new Date(e.date_time).toLocaleString()}</td>
      <td>${e.action_type}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Deviation Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>Deviation Audit Trail Report</h1>
  <p class="meta">Deviation: ${deviationNumber} | 21 CFR Part 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Page 1 of 1 | Total records: ${entries.length}</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>Action</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="meta" style="margin-top:16px">Append-only audit log. Records cannot be edited or deleted.</p>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openDeviationAuditPdfReport(
  entries: DeviationAuditEntry[],
  deviationNumber: string,
  generatedBy: string,
  filters: DeviationAuditFilters,
): void {
  const html = buildDeviationAuditPdfHtml(entries, deviationNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper used by deviation detail and legacy callers */
export async function getAuditLogsForDeviation(deviationId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchDeviationAuditTrail(deviationId);
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
    module: e.module_name,
    moduleName: e.module_name,
    recordId: e.deviation_id,
    documentNumber: e.deviation_number,
    status: e.status,
  }));
}

export { normalizeAuditTrailEntry, ADMIN_COLLECTIONS };
