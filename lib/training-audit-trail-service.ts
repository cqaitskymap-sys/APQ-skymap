import {
  collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';
import { createAuditLog } from '@/lib/audit-trail';
import { fetchAuditTrailEntries } from '@/lib/admin/audit-trail-service';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { ADMIN_COLLECTIONS } from '@/lib/admin/constants';
import { TMS_COLLECTIONS } from '@/lib/training-types';
import {
  TRAINING_AUDIT_MODULE,
  applyTrainingAuditFilters,
  filterTrainingAuditByRole,
  isTrainingAuditEntry,
  mapLegacyLogToTrainingEntry,
  toTrainingAuditEntry,
  computeTrainingAuditKpis,
  computeTrainingAuditCharts,
  type TrainingAuditActor,
  type TrainingAuditEntry,
  type TrainingAuditFilters,
  type TrainingAuditDashboardKpis,
  type TrainingAuditCharts,
} from '@/lib/training-audit-trail-records';

export type {
  TrainingAuditEntry, TrainingAuditFilters, TrainingAuditActor,
  TrainingAuditDashboardKpis, TrainingAuditCharts,
};

function dedupeEntries(entries: TrainingAuditEntry[]): TrainingAuditEntry[] {
  const seen = new Set<string>();
  const out: TrainingAuditEntry[] = [];
  for (const e of entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
    const key = e.audit_id || `${e.timestamp}-${e.action}-${e.performed_by}-${e.changed_field}-${e.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function fetchLegacyTrainingLogs(): Promise<TrainingAuditEntry[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getFirebaseFirestore();
  const results: TrainingAuditEntry[] = [];

  for (const col of [ADMIN_COLLECTIONS.auditLogs, TMS_COLLECTIONS.auditLogs]) {
    try {
      const snap = await getDocs(query(
        collection(db, col),
        orderBy('dateTime', 'desc'),
        limit(500),
      ));
      for (const d of snap.docs) {
        const raw = d.data();
        const mod = String(raw.module || raw.moduleName || '').toLowerCase();
        if (mod.includes('training') || mod.includes('lms')) {
          results.push(mapLegacyLogToTrainingEntry({ id: d.id, ...raw }));
        }
      }
    } catch {
      try {
        const snap = await getDocs(query(collection(db, col), limit(500)));
        for (const d of snap.docs) {
          const raw = d.data();
          const mod = String(raw.module || raw.moduleName || '').toLowerCase();
          if (mod.includes('training') || mod.includes('lms')) {
            results.push(mapLegacyLogToTrainingEntry({ id: d.id, ...raw }));
          }
        }
      } catch { /* optional */ }
    }
  }
  return results;
}

export async function fetchAllTrainingAuditEntries(): Promise<TrainingAuditEntry[]> {
  const [globalTrail, legacy] = await Promise.all([
    fetchAuditTrailEntries(),
    fetchLegacyTrainingLogs(),
  ]);

  const fromTrail = globalTrail
    .filter((e) => isTrainingAuditEntry(e))
    .map((e) => toTrainingAuditEntry(e));

  return dedupeEntries([...fromTrail, ...legacy]);
}

export async function getFilteredTrainingAuditTrail(input: {
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: TrainingAuditFilters;
}): Promise<TrainingAuditEntry[]> {
  const base = await fetchAllTrainingAuditEntries();
  const scoped = filterTrainingAuditByRole(base, input.role, {
    userDepartment: input.userDepartment,
    userId: input.userId,
  });
  return applyTrainingAuditFilters(scoped, input.filters || {});
}

export async function fetchTrainingAuditDashboard(input: {
  role?: string | null;
  userDepartment?: string;
  userId?: string;
  filters?: TrainingAuditFilters;
}): Promise<{
  entries: TrainingAuditEntry[];
  kpis: TrainingAuditDashboardKpis;
  charts: TrainingAuditCharts;
  users: { id: string; name: string }[];
}> {
  const entries = await getFilteredTrainingAuditTrail(input);
  const userMap = new Map<string, string>();
  entries.forEach((e) => {
    if (e.performed_by) userMap.set(e.performed_by, e.performed_by_name);
  });
  return {
    entries,
    kpis: computeTrainingAuditKpis(entries),
    charts: computeTrainingAuditCharts(entries),
    users: Array.from(userMap.entries()).map(([id, name]) => ({ id, name })),
  };
}

export async function logTrainingAuditRecord(
  actor: TrainingAuditActor,
  action: string,
  recordId: string,
  collectionName: string,
  oldValue?: unknown,
  newValue?: unknown,
  options?: { documentNumber?: string; fieldName?: string; reason?: string; moduleName?: string },
): Promise<void> {
  await createAuditLog({
    moduleName: options?.moduleName || 'Training',
    collectionName,
    recordId,
    documentNumber: options?.documentNumber,
    actionType: action,
    fieldName: options?.fieldName,
    oldValue,
    newValue,
    reason: options?.reason,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logTrainingAuditExport(
  actor: TrainingAuditActor,
  format: 'CSV' | 'Excel' | 'PDF',
  count: number,
): Promise<void> {
  await createAuditLog({
    moduleName: TRAINING_AUDIT_MODULE,
    collectionName: TMS_COLLECTIONS.auditTrail,
    recordId: 'training-audit-export',
    actionType: 'Export',
    actionDescription: `Training audit trail exported as ${format} (${count} records)`,
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export async function logTrainingAuditView(
  actor: TrainingAuditActor,
  entityId?: string,
): Promise<void> {
  await createAuditLog({
    moduleName: TRAINING_AUDIT_MODULE,
    collectionName: TMS_COLLECTIONS.auditTrail,
    recordId: entityId || 'training-audit-trail',
    actionType: 'View',
    actionDescription: entityId ? `Training entity audit history viewed: ${entityId}` : 'Training audit trail page viewed',
    user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
    status: 'Success',
  });
}

export function buildTrainingAuditPrintHtml(
  entries: TrainingAuditEntry[],
  generatedBy: string,
  filters: TrainingAuditFilters,
): string {
  const filterLine = [
    filters.module && filters.module !== 'all' ? `Module: ${filters.module}` : null,
    filters.action && filters.action !== 'all' ? `Action: ${filters.action}` : null,
    filters.start_date ? `From: ${filters.start_date}` : null,
    filters.end_date ? `To: ${filters.end_date}` : null,
    filters.search ? `Search: ${filters.search}` : null,
  ].filter(Boolean).join(' | ');

  const rows = entries.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</td>
      <td>${e.reference_number || e.entity_id || '—'}</td>
      <td>${e.action}</td>
      <td>${e.module}</td>
      <td>${e.changed_field || '—'}</td>
      <td>${e.performed_by_name}</td>
      <td>${e.department || '—'}</td>
      <td>${e.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Training Audit Trail</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{margin:0;font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#f1f5f9}
.footer{margin-top:24px;font-size:10px;color:#64748b}
</style></head><body>
<div class="header"><h1>Training Audit Trail Report</h1>
<p>GMP Training Management — Inspection-Ready Audit Log</p>
<p>Generated: ${new Date().toISOString()} · By: ${generatedBy}</p>
${filterLine ? `<p>Filters: ${filterLine}</p>` : ''}
<p>Records: ${entries.length}</p></div>
<table><thead><tr>
<th>#</th><th>Timestamp</th><th>Reference</th><th>Action</th><th>Module</th>
<th>Field</th><th>User</th><th>Department</th><th>Status</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">Immutable audit record — 21 CFR Part 11 · EU GMP Annex 11 · ALCOA+ · GAMP 5</div>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

export function openTrainingAuditPrintReport(
  entries: TrainingAuditEntry[],
  generatedBy: string,
  filters: TrainingAuditFilters,
): void {
  const html = buildTrainingAuditPrintHtml(entries, generatedBy, filters);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

export async function exportTrainingAuditExcel(entries: TrainingAuditEntry[]): Promise<void> {
  const { exportTrainingAuditCsv } = await import('@/lib/training-audit-trail-records');
  const { downloadCsv } = await import('@/lib/export-utils');
  const { headers, rows } = exportTrainingAuditCsv(entries);
  downloadCsv('training-audit-trail.csv', headers, rows);
}
