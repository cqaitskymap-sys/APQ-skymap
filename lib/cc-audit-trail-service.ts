import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries, normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  AUDIT_TRAIL_MODULE,
  applyCcAuditFilters,
  filterCcAuditByRole,
  isCcAuditEntry,
  mapToCcAuditEntry,
  toCcAuditEntry,
  type CcAuditActor,
  type CcAuditEntry,
  type CcAuditFilters,
} from '@/lib/cc-audit-trail-records';
import { CC_COLLECTIONS, type ChangeControlRecord } from '@/lib/change-control-types';
import { getChangeById, listChanges } from '@/lib/change-control-service';
import { normalizeRole } from '@/lib/permissions';

export type { CcAuditEntry, CcAuditFilters, CcAuditActor };

async function fetchLegacyCcLogs(changeId: string): Promise<CcAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CC_COLLECTIONS.auditLogs),
      where('recordId', '==', changeId),
      orderBy('dateTime', 'desc'),
      limit(200),
    ));
    return snap.docs.map((d) => mapToCcAuditEntry({ id: d.id, ...d.data() }, changeId));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), CC_COLLECTIONS.auditLogs),
        where('recordId', '==', changeId),
        limit(200),
      ));
      return snap.docs
        .map((d) => mapToCcAuditEntry({ id: d.id, ...d.data() }, changeId))
        .filter((e) => {
          const mod = (e.module_name || '').toLowerCase();
          return mod.includes('change') || mod === 'change control';
        });
    } catch {
      return [];
    }
  }
}

function dedupeEntries(entries: CcAuditEntry[]): CcAuditEntry[] {
  const seen = new Set<string>();
  const out: CcAuditEntry[] = [];
  for (const e of entries.sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}-${e.change_control_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function fetchAuditTrailForRecord(recordId: string): Promise<CcAuditEntry[]> {
  if (!isFirebaseConfigured() || !recordId) return [];
  const mapDoc = (id: string, raw: Record<string, unknown>, changeId: string, changeNumber?: string) =>
    toCcAuditEntry(normalizeAuditTrailEntry({ id, ...raw }), changeId, changeNumber);

  const results: CcAuditEntry[] = [];
  for (const field of ['recordId', 'documentId'] as const) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), 'audit_trail'),
        where(field, '==', recordId),
        orderBy('dateTime', 'desc'),
        limit(500),
      ));
      results.push(...snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>, recordId)));
    } catch {
      try {
        const snap = await getDocs(query(
          collection(getFirebaseFirestore(), 'audit_trail'),
          where(field, '==', recordId),
          limit(500),
        ));
        results.push(...snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>, recordId)));
      } catch {
        // indexed query may be unavailable
      }
    }
  }
  return results;
}

async function getPermittedChangeIds(
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): Promise<Set<string> | undefined> {
  const r = normalizeRole(role || '');
  const raw = (role || '').toLowerCase();
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'auditor'].includes(r)) {
    return undefined;
  }
  if (raw.includes('validation') || raw.includes('csv') || raw === 'regulatory_affairs' || raw === 'regulatory') {
    return undefined;
  }
  const records = await listChanges();
  const ids = new Set<string>();
  for (const rec of records) {
    if (userId && (rec.initiated_by === userId || rec.created_by === userId)) ids.add(rec.id);
    else if (userDepartment && rec.department?.toLowerCase() === userDepartment.toLowerCase()) ids.add(rec.id);
  }
  return ids;
}

function applyCriticalFilter(
  entries: CcAuditEntry[],
  criticalOnly: boolean | undefined,
  criticalIds: Set<string>,
): CcAuditEntry[] {
  if (!criticalOnly) return entries;
  return entries.filter((e) => criticalIds.has(e.change_control_id));
}

export async function fetchCcAuditTrail(
  changeId: string,
  changeNumber?: string,
): Promise<CcAuditEntry[]> {
  if (!changeId) return [];
  let record: ChangeControlRecord | null = null;
  if (!changeNumber) {
    record = await getChangeById(changeId);
    changeNumber = record?.change_control_number;
  }

  const [directTrail, globalTrail, legacy] = await Promise.all([
    fetchAuditTrailForRecord(changeId),
    fetchAuditTrailEntries().then((rows) =>
      rows
        .filter((e) => isCcAuditEntry(e, changeId, changeNumber))
        .map((e) => toCcAuditEntry(e, changeId, changeNumber || e.documentNumber)),
    ),
    fetchLegacyCcLogs(changeId),
  ]);

  return dedupeEntries([...directTrail, ...globalTrail, ...legacy]);
}

export async function fetchAllCcAuditEntries(): Promise<CcAuditEntry[]> {
  const [globalTrail, changeRecords] = await Promise.all([
    fetchAuditTrailEntries(),
    listChanges(),
  ]);
  const numberById = new Map(changeRecords.map((r) => [r.id, r.change_control_number]));

  const ccEntries = globalTrail
    .filter((e) => isCcAuditEntry(e))
    .map((e) => {
      const cid = e.recordId || e.documentId || '';
      return toCcAuditEntry(e, cid, numberById.get(cid) || e.documentNumber || '');
    });

  const legacyEntries: CcAuditEntry[] = [];
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), CC_COLLECTIONS.auditLogs),
        orderBy('dateTime', 'desc'),
        limit(400),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        const mod = String(raw.module || raw.moduleName || '').toLowerCase();
        if (mod.includes('change') || mod === 'change control') {
          const cid = String(raw.recordId || '');
          legacyEntries.push(mapToCcAuditEntry(
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

  return dedupeEntries([...ccEntries, ...legacyEntries]);
}

export async function getFilteredCcAuditTrail(input: {
  changeId?: string;
  changeNumber?: string;
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: CcAuditFilters;
}): Promise<CcAuditEntry[]> {
  if (input.changeId === '') return [];
  const permittedChangeIds = await getPermittedChangeIds(input.role, input.userId, input.userDepartment);
  const base = input.changeId
    ? await fetchCcAuditTrail(input.changeId, input.changeNumber)
    : await fetchAllCcAuditEntries();

  const scoped = filterCcAuditByRole(base, input.role, {
    userDepartment: input.userDepartment,
    userId: input.userId,
    permittedChangeIds,
  });

  let filtered = applyCcAuditFilters(scoped, input.filters || {});

  if (input.filters?.critical_only) {
    const records = await listChanges();
    const criticalIds = new Set(
      records.filter((r) => r.change_category === 'Critical').map((r) => r.id),
    );
    filtered = applyCriticalFilter(filtered, true, criticalIds);
  }

  return filtered;
}

export async function logCcAuditExport(
  actor: CcAuditActor,
  changeId: string,
  changeNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: CC_COLLECTIONS.records,
    recordId: changeId,
    documentNumber: changeNumber,
    actionType: 'Exported',
    actionDescription: `Change control audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logCcAuditPreviewed(
  actor: CcAuditActor,
  changeId: string,
  changeNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: CC_COLLECTIONS.records,
    recordId: changeId,
    documentNumber: changeNumber,
    actionType: 'Updated',
    actionDescription: 'Change control audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildCcAuditPdfHtml(
  entries: CcAuditEntry[],
  changeNumber: string,
  generatedBy: string,
  filters: CcAuditFilters,
): string {
  const filterLine = [
    filters.change_number && filters.change_number !== 'all' ? `Change: ${filters.change_number}` : null,
    filters.action_type && filters.action_type !== 'all' ? `Action: ${filters.action_type}` : null,
    filters.module_name && filters.module_name !== 'all' ? `Module: ${filters.module_name}` : null,
    filters.start_date ? `From: ${filters.start_date}` : null,
    filters.end_date ? `To: ${filters.end_date}` : null,
    filters.search ? `Search: ${filters.search}` : null,
    filters.validation_impact_only ? 'Validation Impact Only' : null,
    filters.csv_impact_only ? 'CSV Impact Only' : null,
    filters.critical_only ? 'Critical Changes Only' : null,
  ].filter(Boolean).join(' | ');

  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.date_time ? new Date(e.date_time).toLocaleString() : '—'}</td>
      <td>${e.change_control_number || changeNumber}</td>
      <td>${e.action_type}</td>
      <td>${e.module_name}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Change Control Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>Change Control Audit Trail Report</h1>
  <p class="meta">Change: ${changeNumber || 'All'} | GMP / GAMP5 / Annex 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Page 1 of 1 | Total records: ${entries.length} | Immutable — cannot edit or delete</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>Change No</th><th>Action</th><th>Module</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openCcAuditPdfReport(
  entries: CcAuditEntry[],
  changeNumber: string,
  generatedBy: string,
  filters: CcAuditFilters,
): void {
  const html = buildCcAuditPdfHtml(entries, changeNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper used by change control detail and legacy callers */
export async function getAuditLogsForChange(changeId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchCcAuditTrail(changeId);
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
    browserInfo: e.browser_info,
    module: e.module_name,
    moduleName: e.module_name,
    recordId: e.change_control_id,
    documentNumber: e.change_control_number,
    status: e.status,
  }));
}
