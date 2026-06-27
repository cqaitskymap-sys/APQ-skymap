import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { normalizeRole } from '@/lib/permissions';
import {
  RECALL_AUDIT_TRAIL_MODULE,
  applyRecallAuditFilters,
  filterRecallAuditByRole,
  isRecallAuditEntry,
  isVisibleRecallAuditEntry,
  mapToRecallAuditEntry,
  toRecallAuditEntry,
  type RecallAuditActor,
  type RecallAuditEntry,
  type RecallAuditFilters,
} from '@/lib/recall-audit-trail-records';
import { RECALL_COLLECTIONS, type RecallRecord } from '@/lib/recall-types';
import { getRecallById, listRecalls } from '@/lib/recall-service';

export type { RecallAuditEntry, RecallAuditFilters, RecallAuditActor };

async function fetchLegacyRecallLogs(recallId: string): Promise<RecallAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RECALL_COLLECTIONS.auditLogs),
      where('recordId', '==', recallId),
      orderBy('dateTime', 'desc'),
      limit(300),
    ));
    return snap.docs
      .map((d) => mapToRecallAuditEntry({ id: d.id, ...d.data() }, recallId))
      .filter(isVisibleRecallAuditEntry);
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), RECALL_COLLECTIONS.auditLogs),
        where('recordId', '==', recallId),
        limit(300),
      ));
      return snap.docs
        .map((d) => mapToRecallAuditEntry({ id: d.id, ...d.data() }, recallId))
        .filter((e) => {
          if (!isVisibleRecallAuditEntry(e)) return false;
          const mod = (e.module_name || '').toLowerCase();
          return mod.includes('recall');
        });
    } catch {
      return [];
    }
  }
}

function dedupeEntries(entries: RecallAuditEntry[]): RecallAuditEntry[] {
  const seen = new Set<string>();
  const out: RecallAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}-${e.recall_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function getPermittedRecallIds(
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): Promise<Set<string> | undefined> {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor'].includes(r)) {
    return undefined;
  }
  const records = await listRecalls();
  const ids = new Set<string>();
  for (const rec of records) {
    if (userId && (rec.created_by === userId || rec.recall_initiated_by === userId)) ids.add(rec.id);
    else if (userDepartment && rec.market_region?.toLowerCase() === userDepartment.toLowerCase()) ids.add(rec.id);
  }
  return ids;
}

export async function fetchRecallAuditTrail(
  recallId: string,
  recallNumber?: string,
): Promise<RecallAuditEntry[]> {
  let record: RecallRecord | null = null;
  if (!recallNumber) {
    record = await getRecallById(recallId);
    recallNumber = record?.recall_number;
  }

  const [globalTrail, legacy] = await Promise.all([
    fetchAuditTrailEntries().catch(() => []),
    fetchLegacyRecallLogs(recallId),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isRecallAuditEntry(e, recallId, recallNumber))
    .map((e) => toRecallAuditEntry(e, recallId, recallNumber || e.documentNumber))
    .filter(isVisibleRecallAuditEntry);

  return dedupeEntries([...fromTrail, ...legacy]).sort((a, b) => a.date_time.localeCompare(b.date_time));
}

export async function fetchAllRecallAuditEntries(): Promise<RecallAuditEntry[]> {
  const [globalTrail, recalls] = await Promise.all([
    fetchAuditTrailEntries().catch(() => []),
    listRecalls().catch(() => [] as RecallRecord[]),
  ]);
  const numberById = new Map(recalls.map((r) => [r.id, r.recall_number]));

  const recallEntries = globalTrail
    .filter((e) => isRecallAuditEntry(e))
    .map((e) => {
      const rid = e.recordId || e.documentId || '';
      return toRecallAuditEntry(e, rid, numberById.get(rid) || e.documentNumber || '');
    })
    .filter(isVisibleRecallAuditEntry);

  const legacyEntries: RecallAuditEntry[] = [];
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), RECALL_COLLECTIONS.auditLogs),
        orderBy('dateTime', 'desc'),
        limit(500),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        if (raw.deleted === true || raw.isDeleted === true) continue;
        const mod = String(raw.module || raw.moduleName || '').toLowerCase();
        if (mod.includes('recall')) {
          const rid = String(raw.recordId || '');
          legacyEntries.push(mapToRecallAuditEntry(
            { id: d.id, ...raw },
            rid,
            numberById.get(rid),
          ));
        }
      }
    } catch {
      // ignore legacy fetch errors
    }
  }

  return dedupeEntries([...recallEntries, ...legacyEntries])
    .filter(isVisibleRecallAuditEntry)
    .sort((a, b) => a.date_time.localeCompare(b.date_time));
}

export async function getFilteredRecallAuditTrail(input: {
  recallId?: string;
  recallNumber?: string;
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: RecallAuditFilters;
}): Promise<RecallAuditEntry[]> {
  const permittedRecallIds = await getPermittedRecallIds(input.role, input.userId, input.userDepartment);
  const base = input.recallId
    ? await fetchRecallAuditTrail(input.recallId, input.recallNumber)
    : await fetchAllRecallAuditEntries();

  const scoped = filterRecallAuditByRole(base, input.role, {
    userDepartment: input.userDepartment,
    userId: input.userId,
    permittedRecallIds,
  });
  return applyRecallAuditFilters(scoped, input.filters || {});
}

export async function logRecallAuditExport(
  actor: RecallAuditActor,
  recallId: string,
  recallNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: RECALL_AUDIT_TRAIL_MODULE,
    collectionName: RECALL_COLLECTIONS.records,
    recordId: recallId,
    documentNumber: recallNumber,
    actionType: 'Exported',
    actionDescription: `Recall audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logRecallAuditPreviewed(
  actor: RecallAuditActor,
  recallId: string,
  recallNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: RECALL_AUDIT_TRAIL_MODULE,
    collectionName: RECALL_COLLECTIONS.records,
    recordId: recallId,
    documentNumber: recallNumber,
    actionType: 'Updated',
    actionDescription: 'Recall audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildRecallAuditPdfHtml(
  entries: RecallAuditEntry[],
  recallNumber: string,
  generatedBy: string,
  filters: RecallAuditFilters,
): string {
  const filterLine = [
    filters.recall_number && filters.recall_number !== 'all' ? `Recall: ${filters.recall_number}` : null,
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
      <td>${e.recall_number || recallNumber}</td>
      <td>${e.action_type}</td>
      <td>${e.module_name}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Recall Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>Recall Audit Trail Report</h1>
  <p class="meta">Recall: ${recallNumber || 'All'} | 21 CFR Part 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Total records: ${entries.length} | Append-only — cannot edit or delete</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>Recall No</th><th>Action</th><th>Module</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openRecallAuditPdfReport(
  entries: RecallAuditEntry[],
  recallNumber: string,
  generatedBy: string,
  filters: RecallAuditFilters,
): void {
  const html = buildRecallAuditPdfHtml(entries, recallNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper for recall detail view */
export async function getAuditLogsForRecall(recallId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchRecallAuditTrail(recallId);
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
    recordId: e.recall_id,
    documentNumber: e.recall_number,
    status: e.status,
  }));
}
