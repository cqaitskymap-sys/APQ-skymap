import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { downloadCsv } from '@/lib/export-utils';
import {
  RECALL_DASHBOARD_MODULE,
  applyRecallDashboardFilters,
  buildRecallActivityTimeline,
  computeRecallChartData,
  computeRecallDashboardMetrics,
  exportRecallDashboardCsv,
  filterRecallsByRole,
  getOpenRecoveryRows,
  getRecentRecalls,
  getRegulatoryPendingRows,
  type RecallDashboardActor,
} from '@/lib/recall-dashboard-records';
import {
  RECALL_COLLECTIONS,
  type RecallActivityEntry,
  type RecallDashboardChartData,
  type RecallDashboardMetrics,
  type RecallFilters,
  type RecallOpenRecoveryRow,
  type RecallRecord,
  type RecallRegulatoryPendingRow,
} from '@/lib/recall-types';
import { listRecalls } from '@/lib/recall-service';
import {
  collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';

export type { RecallDashboardActor };

export interface RecallDashboardData {
  records: RecallRecord[];
  metrics: RecallDashboardMetrics;
  charts: RecallDashboardChartData;
  recentRecalls: RecallRecord[];
  openRecovery: RecallOpenRecoveryRow[];
  regulatoryPending: RecallRegulatoryPendingRow[];
  activity: RecallActivityEntry[];
}

async function audit(actor: RecallDashboardActor, actionType: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: RECALL_DASHBOARD_MODULE,
      collectionName: RECALL_COLLECTIONS.records,
      recordId: 'dashboard',
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('recall dashboard audit', e);
  }
}

async function fetchRecallAuditActivity(): Promise<RecallActivityEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RECALL_COLLECTIONS.auditLogs),
      orderBy('dateTime', 'desc'),
      limit(25),
    ));
    return snap.docs
      .map((d) => d.data())
      .filter((raw) => String(raw.module || raw.moduleName || '').toLowerCase().includes('recall'))
      .map((raw) => ({
        date: String(raw.dateTime || raw.timestamp || raw.created_at || ''),
        title: String(raw.action || raw.actionType || 'Recall Activity'),
        description: String(raw.newValue || raw.actionDescription || raw.reason || '').slice(0, 120),
        user: String(raw.userName || raw.user?.name || 'System'),
        recall_number: String(raw.documentNumber || raw.recordId || ''),
      }));
  } catch {
    return [];
  }
}

export async function fetchRecallDashboardData(
  filters?: RecallFilters,
  actor?: RecallDashboardActor,
): Promise<RecallDashboardData> {
  const emptyMetrics = computeRecallDashboardMetrics([]);
  const emptyCharts = computeRecallChartData([]);

  if (!isFirebaseConfigured()) {
    return {
      records: [],
      metrics: emptyMetrics,
      charts: emptyCharts,
      recentRecalls: [],
      openRecovery: [],
      regulatoryPending: [],
      activity: [],
    };
  }

  try {
    const all = await listRecalls();
    const scoped = filterRecallsByRole(all, actor?.role, actor?.id);
    const filtered = applyRecallDashboardFilters(scoped, filters);
    const [auditActivity] = await Promise.all([
      fetchRecallAuditActivity().catch(() => []),
    ]);

    return {
      records: filtered,
      metrics: computeRecallDashboardMetrics(scoped),
      charts: computeRecallChartData(scoped),
      recentRecalls: getRecentRecalls(filtered),
      openRecovery: getOpenRecoveryRows(scoped),
      regulatoryPending: getRegulatoryPendingRows(scoped),
      activity: auditActivity.length ? auditActivity : buildRecallActivityTimeline(scoped),
    };
  } catch (e) {
    console.error('fetchRecallDashboardData', e);
    throw new Error('Failed to load recall dashboard data');
  }
}

export async function logRecallDashboardViewed(actor: RecallDashboardActor): Promise<void> {
  await audit(actor, 'Dashboard Viewed', 'Product recall dashboard opened');
}

export async function logRecallDashboardRefreshed(actor: RecallDashboardActor, count: number): Promise<void> {
  await audit(actor, 'Dashboard Refreshed', `${count} recall record(s) loaded`);
}

export async function logRecallDashboardFilterApplied(actor: RecallDashboardActor, filters: RecallFilters): Promise<void> {
  await audit(actor, 'Filter Applied', JSON.stringify(filters).slice(0, 200));
}

export async function logRecallDashboardPdfExport(actor: RecallDashboardActor, count: number): Promise<void> {
  await audit(actor, 'PDF Export', `Dashboard PDF placeholder (${count} records)`);
}

export async function logRecallDashboardExcelExport(actor: RecallDashboardActor, count: number): Promise<void> {
  await audit(actor, 'Excel Export', `Dashboard Excel export (${count} records)`);
}

export async function logRecallRecordOpened(actor: RecallDashboardActor, recallId: string, recallNumber: string): Promise<void> {
  await audit(actor, 'Recall Opened', `${recallNumber} (${recallId})`);
}

export function exportRecallDashboardCsvDownload(records: RecallRecord[], filename = 'recall-dashboard.csv'): void {
  const { headers, rows } = exportRecallDashboardCsv(records);
  downloadCsv(filename, headers, rows);
}

export function openRecallDashboardPdfPlaceholder(
  records: RecallRecord[],
  metrics: RecallDashboardMetrics,
  generatedBy: string,
): void {
  const rows = records.slice(0, 50).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.recall_number}</td>
      <td>${r.recall_date}</td>
      <td>${r.product_name}</td>
      <td>${r.recall_classification}</td>
      <td>${r.recall_status}</td>
      <td>${r.recovery_percent ?? 0}%</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Recall Dashboard</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;color:#1e293b;font-size:11px}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0 0 4px}.meta{color:#64748b;font-size:11px}
.kpi{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.kpi span{border:1px solid #cbd5e1;padding:6px 10px;border-radius:4px}
table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}
th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong><br/>
  <h1>Product Recall Dashboard Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()} | By: ${generatedBy}</p>
  <p class="meta">Page 1 of 1</p>
</div>
<div class="kpi">
  <span>Total: ${metrics.total}</span>
  <span>Open: ${metrics.open}</span>
  <span>Closed: ${metrics.closed}</span>
  <span>Mock: ${metrics.mockRecalls}</span>
  <span>Class I: ${metrics.classI}</span>
  <span>Regulatory Pending: ${metrics.regulatoryPending}</span>
  <span>Avg Recovery: ${metrics.avgRecoveryPercent}%</span>
</div>
<table>
<thead><tr><th>#</th><th>Recall No</th><th>Date</th><th>Product</th><th>Class</th><th>Status</th><th>Recovery</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
