import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries, normalizeAuditTrailEntry } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { normalizeRole } from '@/lib/permissions';
import {
  AUDIT_TRAIL_MODULE,
  applyComplaintAuditFilters,
  filterComplaintAuditByRole,
  isComplaintAuditEntry,
  isVisibleComplaintAuditEntry,
  mapToComplaintAuditEntry,
  toComplaintAuditEntry,
  type ComplaintAuditEntry,
  type ComplaintAuditFilters,
  type ReportActor,
} from '@/lib/complaint-audit-trail-records';
import { COMPLAINT_COLLECTIONS, type ComplaintRecord } from '@/lib/complaint-types';
import { getComplaintById, listComplaints } from '@/lib/complaint-service';

export type { ComplaintAuditEntry, ComplaintAuditFilters, ReportActor };

async function fetchLegacyComplaintLogs(complaintId: string): Promise<ComplaintAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.auditLogs),
      where('recordId', '==', complaintId),
      orderBy('dateTime', 'desc'),
      limit(200),
    ));
    return snap.docs
      .map((d) => mapToComplaintAuditEntry({ id: d.id, ...d.data() }, complaintId))
      .filter(isVisibleComplaintAuditEntry);
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.auditLogs),
        where('recordId', '==', complaintId),
        limit(200),
      ));
      return snap.docs
        .map((d) => mapToComplaintAuditEntry({ id: d.id, ...d.data() }, complaintId))
        .filter((e) => {
          if (!isVisibleComplaintAuditEntry(e)) return false;
          const mod = (e.module_name || '').toLowerCase();
          return mod.includes('complaint') || mod === 'complaint';
        });
    } catch {
      return [];
    }
  }
}

function dedupeEntries(entries: ComplaintAuditEntry[]): ComplaintAuditEntry[] {
  const seen = new Set<string>();
  const out: ComplaintAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.date_time.localeCompare(a.date_time))) {
    const key = e.audit_id || `${e.date_time}-${e.action_type}-${e.changed_by}-${e.field_name}-${e.complaint_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function getPermittedComplaintIds(
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): Promise<Set<string> | undefined> {
  const r = normalizeRole(role);
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa', 'qa_executive', 'regulatory_affairs', 'auditor'].includes(r)) {
    return undefined;
  }
  const records = await listComplaints();
  const ids = new Set<string>();
  for (const rec of records) {
    if (userId && (rec.created_by === userId || rec.assigned_to === userId)) ids.add(rec.id);
    else if (userDepartment && rec.market_region?.toLowerCase() === userDepartment.toLowerCase()) ids.add(rec.id);
  }
  return ids;
}

export async function fetchComplaintAuditTrail(
  complaintId: string,
  complaintNumber?: string,
): Promise<ComplaintAuditEntry[]> {
  let record: ComplaintRecord | null = null;
  if (!complaintNumber) {
    record = await getComplaintById(complaintId);
    complaintNumber = record?.complaint_number;
  }

  const [globalTrail, legacy] = await Promise.all([
    fetchAuditTrailEntries(),
    fetchLegacyComplaintLogs(complaintId),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isComplaintAuditEntry(e, complaintId, complaintNumber))
    .map((e) => toComplaintAuditEntry(e, complaintId, complaintNumber || e.documentNumber))
    .filter(isVisibleComplaintAuditEntry);

  return dedupeEntries([...fromTrail, ...legacy]).sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function fetchAllComplaintAuditEntries(): Promise<ComplaintAuditEntry[]> {
  const [globalTrail, complaints] = await Promise.all([
    fetchAuditTrailEntries(),
    listComplaints(),
  ]);
  const numberById = new Map(complaints.map((c) => [c.id, c.complaint_number]));

  const complaintEntries = globalTrail
    .filter((e) => isComplaintAuditEntry(e))
    .map((e) => {
      const cid = e.recordId || e.documentId || '';
      return toComplaintAuditEntry(e, cid, numberById.get(cid) || e.documentNumber || '');
    })
    .filter(isVisibleComplaintAuditEntry);

  const legacyEntries: ComplaintAuditEntry[] = [];
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.auditLogs),
        orderBy('dateTime', 'desc'),
        limit(400),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        if (raw.deleted === true || raw.isDeleted === true) continue;
        const mod = String(raw.module || raw.moduleName || '').toLowerCase();
        if (mod.includes('complaint')) {
          const cid = String(raw.recordId || '');
          legacyEntries.push(mapToComplaintAuditEntry(
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

  return dedupeEntries([...complaintEntries, ...legacyEntries])
    .filter(isVisibleComplaintAuditEntry)
    .sort((a, b) => b.date_time.localeCompare(a.date_time));
}

export async function getFilteredComplaintAuditTrail(input: {
  complaintId?: string;
  complaintNumber?: string;
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: ComplaintAuditFilters;
}): Promise<ComplaintAuditEntry[]> {
  const permittedComplaintIds = await getPermittedComplaintIds(input.role, input.userId, input.userDepartment);
  const base = input.complaintId
    ? await fetchComplaintAuditTrail(input.complaintId, input.complaintNumber)
    : await fetchAllComplaintAuditEntries();

  const scoped = filterComplaintAuditByRole(base, input.role, {
    userDepartment: input.userDepartment,
    userId: input.userId,
    permittedComplaintIds,
  });
  return applyComplaintAuditFilters(scoped, input.filters || {});
}

export async function logComplaintAuditExport(
  actor: ReportActor,
  complaintId: string,
  complaintNumber: string,
  format: 'PDF' | 'Excel',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: COMPLAINT_COLLECTIONS.records,
    recordId: complaintId,
    documentNumber: complaintNumber,
    actionType: 'Exported',
    actionDescription: `Complaint audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logComplaintAuditPreviewed(
  actor: ReportActor,
  complaintId: string,
  complaintNumber: string,
): Promise<void> {
  await createAuditLog({
    moduleName: AUDIT_TRAIL_MODULE,
    collectionName: COMPLAINT_COLLECTIONS.records,
    recordId: complaintId,
    documentNumber: complaintNumber,
    actionType: 'Updated',
    actionDescription: 'Complaint audit trail viewed',
    user: { id: actor.id, name: actor.name, role: actor.role },
    status: 'Success',
  });
}

export function buildComplaintAuditPdfHtml(
  entries: ComplaintAuditEntry[],
  complaintNumber: string,
  generatedBy: string,
  filters: ComplaintAuditFilters,
): string {
  const filterLine = [
    filters.complaint_number && filters.complaint_number !== 'all' ? `Complaint: ${filters.complaint_number}` : null,
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
      <td>${e.complaint_number || complaintNumber}</td>
      <td>${e.action_type}</td>
      <td>${e.module_name}</td>
      <td>${e.field_name || '—'}</td>
      <td>${e.old_value.slice(0, 40) || '—'}</td>
      <td>${e.new_value.slice(0, 40) || '—'}</td>
      <td>${e.changed_by_name}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Complaint Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px} .meta{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>Complaint Audit Trail Report</h1>
  <p class="meta">Complaint: ${complaintNumber || 'All'} | 21 CFR Part 11 | Generated: ${new Date().toLocaleString()}</p>
  <p class="meta">Generated by: ${generatedBy}</p>
  ${filterLine ? `<p class="meta">Filters: ${filterLine}</p>` : ''}
  <p class="meta">Page 1 of 1 | Total records: ${entries.length} | Append-only — cannot edit or delete</p>
</div>
<table>
<thead><tr><th>#</th><th>Date Time</th><th>Complaint No</th><th>Action</th><th>Module</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
}

export function openComplaintAuditPdfReport(
  entries: ComplaintAuditEntry[],
  complaintNumber: string,
  generatedBy: string,
  filters: ComplaintAuditFilters,
): void {
  const html = buildComplaintAuditPdfHtml(entries, complaintNumber, generatedBy, filters);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

/** Backward-compatible helper used by complaint detail and legacy callers */
export async function getAuditLogsForComplaint(complaintId: string): Promise<Record<string, unknown>[]> {
  const entries = await fetchComplaintAuditTrail(complaintId);
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
    recordId: e.complaint_id,
    documentNumber: e.complaint_number,
    status: e.status,
  }));
}

export { normalizeAuditTrailEntry };
