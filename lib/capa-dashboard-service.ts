import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { downloadCsv } from '@/lib/export-utils';
import {
  CAPA_DASHBOARD_MODULE,
  applyCapaDashboardFilters,
  buildCapaActivityTimeline,
  computeCapaChartData,
  computeExtendedCapaDashboardMetrics,
  exportCapaDashboardCsv,
  filterCapaByRole,
  type CapaDashboardActor,
  type CapaDashboardChartData,
} from '@/lib/capa-dashboard-records';
import {
  CAPA_COLLECTIONS,
  type CapaActivityEntry,
  type CapaDashboardMetrics,
  type CapaFilters,
  type CapaRecord,
} from '@/lib/capa-types';
import { listCapas, syncOverdueCapas } from '@/lib/capa-service';
import {
  collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';

export type { CapaDashboardActor };

export interface CapaDashboardData {
  records: CapaRecord[];
  metrics: CapaDashboardMetrics;
  charts: CapaDashboardChartData;
  activity: CapaActivityEntry[];
}

async function audit(actor: CapaDashboardActor, actionType: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: CAPA_DASHBOARD_MODULE,
      collectionName: CAPA_COLLECTIONS.records,
      recordId: 'dashboard',
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('capa dashboard audit', e);
  }
}

async function fetchCapaAuditActivity(): Promise<CapaActivityEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), CAPA_COLLECTIONS.auditLogs),
      orderBy('dateTime', 'desc'),
      limit(20),
    ));
    return snap.docs
      .map((d) => d.data())
      .filter((raw) => String(raw.module || '').toLowerCase().includes('capa'))
      .map((raw) => ({
        date: String(raw.dateTime || raw.timestamp || ''),
        title: String(raw.action || 'CAPA Activity'),
        description: String(raw.newValue || raw.reason || '').slice(0, 120),
        user: String(raw.userName || 'System'),
        capa_number: String(raw.recordId || ''),
      }));
  } catch {
    return [];
  }
}

export async function fetchCapaDashboardData(
  filters?: CapaFilters,
  actor?: CapaDashboardActor,
): Promise<CapaDashboardData> {
  if (!isFirebaseConfigured()) {
    const emptyMetrics = computeExtendedCapaDashboardMetrics([]);
    return {
      records: [],
      metrics: emptyMetrics,
      charts: computeCapaChartData([]),
      activity: [],
    };
  }

  try {
    await syncOverdueCapas();
  } catch (e) {
    console.error('syncOverdueCapas', e);
  }

  let allRecords: CapaRecord[] = [];
  try {
    allRecords = await listCapas();
  } catch (e) {
    console.error('listCapas', e);
    const emptyMetrics = computeExtendedCapaDashboardMetrics([]);
    return {
      records: [],
      metrics: emptyMetrics,
      charts: computeCapaChartData([]),
      activity: [],
    };
  }

  const scoped = actor
    ? filterCapaByRole(allRecords, actor.role, actor.id, actor.department)
    : allRecords;
  const filtered = applyCapaDashboardFilters(scoped, filters);
  const metrics = computeExtendedCapaDashboardMetrics(scoped);

  let activity: CapaActivityEntry[] = [];
  try {
    const auditActivity = await fetchCapaAuditActivity();
    activity = auditActivity.length ? auditActivity : buildCapaActivityTimeline(scoped);
  } catch {
    activity = buildCapaActivityTimeline(scoped);
  }

  return {
    records: filtered,
    metrics,
    charts: computeCapaChartData(scoped),
    activity,
  };
}

export async function logCapaDashboardViewed(actor: CapaDashboardActor) {
  await audit(actor, 'dashboard viewed', 'CAPA dashboard opened');
}

export async function logCapaDashboardRefreshed(actor: CapaDashboardActor, count: number) {
  await audit(actor, 'dashboard refreshed', `${count} CAPA record(s) loaded`);
}

export async function logCapaDashboardFilterApplied(actor: CapaDashboardActor, filters: CapaFilters) {
  await audit(actor, 'filter applied', JSON.stringify(filters).slice(0, 200));
}

export async function logCapaDashboardPdfExport(actor: CapaDashboardActor, count: number) {
  await audit(actor, 'PDF export clicked', `Dashboard PDF placeholder (${count} records)`);
}

export async function logCapaDashboardExcelExport(actor: CapaDashboardActor, count: number) {
  await audit(actor, 'Excel export clicked', `Dashboard Excel placeholder (${count} records)`);
}

export async function logCapaRecordOpened(actor: CapaDashboardActor, capaId: string, capaNumber: string) {
  await audit(actor, 'CAPA opened', `${capaNumber} (${capaId})`);
}

export function exportCapaDashboardCsvDownload(records: CapaRecord[], filename = 'capa-dashboard.csv') {
  const { headers, rows } = exportCapaDashboardCsv(records);
  downloadCsv(filename, headers, rows);
}

export function openCapaDashboardPdfPlaceholder(records: CapaRecord[], generatedBy: string): void {
  const rows = records.slice(0, 50).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.capa_number}</td>
      <td>${r.capa_source}</td>
      <td>${r.department}</td>
      <td>${r.capa_status}</td>
      <td>${r.priority}</td>
      <td>${r.target_completion_date || '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CAPA Dashboard</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;font-size:11px;color:#1e293b}
.header{border:2px solid #1e40af;padding:16px;text-align:center;margin-bottom:16px}
h1{color:#1e40af;margin:0} table{width:100%;border-collapse:collapse}
th,td{border:1px solid #cbd5e1;padding:6px;text-align:left} th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong>
  <h1>CAPA Dashboard Report</h1>
  <p>Generated: ${new Date().toLocaleString()} | By: ${generatedBy}</p>
  <p>Total records: ${records.length} | Page 1 of 1</p>
</div>
<table>
<thead><tr><th>#</th><th>CAPA No</th><th>Source</th><th>Department</th><th>Status</th><th>Priority</th><th>Due Date</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export { computeCapaChartData, computeExtendedCapaDashboardMetrics };
