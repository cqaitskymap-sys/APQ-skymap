import { createAuditLog } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { downloadCsv } from '@/lib/export-utils';
import {
  COMPLAINT_DASHBOARD_MODULE,
  applyComplaintDashboardFilters,
  buildComplaintActivityTimeline,
  computeComplaintChartData,
  computeComplaintDashboardMetrics,
  exportComplaintDashboardCsv,
  filterComplaintsByRole,
  type ComplaintDashboardActor,
} from '@/lib/complaint-dashboard-records';
import {
  COMPLAINT_COLLECTIONS,
  type ComplaintActivityEntry,
  type ComplaintDashboardChartData,
  type ComplaintDashboardMetrics,
  type ComplaintFilters,
  type ComplaintRecord,
} from '@/lib/complaint-types';
import { listComplaints, syncOverdueComplaints } from '@/lib/complaint-service';
import {
  collection, getDocs, limit, orderBy, query,
} from 'firebase/firestore';

export type { ComplaintDashboardActor };

export interface ComplaintDashboardData {
  records: ComplaintRecord[];
  metrics: ComplaintDashboardMetrics;
  charts: ComplaintDashboardChartData;
  activity: ComplaintActivityEntry[];
}

async function audit(actor: ComplaintDashboardActor, actionType: string, detail?: string) {
  try {
    await createAuditLog({
      moduleName: COMPLAINT_DASHBOARD_MODULE,
      collectionName: COMPLAINT_COLLECTIONS.records,
      recordId: 'dashboard',
      actionType,
      actionDescription: detail || actionType,
      user: { id: actor.id, name: actor.name, role: actor.role, department: actor.department },
      status: 'Success',
    });
  } catch (e) {
    console.error('complaint dashboard audit', e);
  }
}

async function fetchComplaintAuditActivity(): Promise<ComplaintActivityEntry[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), COMPLAINT_COLLECTIONS.auditLogs),
      orderBy('dateTime', 'desc'),
      limit(20),
    ));
    return snap.docs
      .map((d) => d.data())
      .filter((raw) => String(raw.module || raw.moduleName || '').toLowerCase().includes('complaint'))
      .map((raw) => ({
        date: String(raw.dateTime || raw.timestamp || raw.created_at || ''),
        title: String(raw.action || raw.actionType || 'Complaint Activity'),
        description: String(raw.newValue || raw.actionDescription || raw.reason || '').slice(0, 120),
        user: String(raw.userName || raw.user?.name || 'System'),
        complaint_number: String(raw.recordId || ''),
      }));
  } catch {
    return [];
  }
}

export async function fetchComplaintDashboardData(
  filters?: ComplaintFilters,
  actor?: ComplaintDashboardActor,
): Promise<ComplaintDashboardData> {
  const emptyMetrics = computeComplaintDashboardMetrics([]);
  const emptyCharts = computeComplaintChartData([]);

  if (!isFirebaseConfigured()) {
    return {
      records: [],
      metrics: emptyMetrics,
      charts: emptyCharts,
      activity: [],
    };
  }

  try {
    await syncOverdueComplaints();
  } catch (e) {
    console.error('syncOverdueComplaints', e);
  }

  let allRecords: ComplaintRecord[] = [];
  try {
    allRecords = await listComplaints();
  } catch (e) {
    console.error('listComplaints', e);
    return {
      records: [],
      metrics: emptyMetrics,
      charts: emptyCharts,
      activity: [],
    };
  }

  const scoped = actor
    ? filterComplaintsByRole(allRecords, actor.role, actor.id)
    : allRecords;
  const filtered = applyComplaintDashboardFilters(scoped, filters);
  const metrics = computeComplaintDashboardMetrics(scoped);

  let activity: ComplaintActivityEntry[] = [];
  try {
    const auditActivity = await fetchComplaintAuditActivity();
    activity = auditActivity.length ? auditActivity : buildComplaintActivityTimeline(scoped);
  } catch {
    activity = buildComplaintActivityTimeline(scoped);
  }

  return {
    records: filtered,
    metrics,
    charts: computeComplaintChartData(scoped),
    activity,
  };
}

export async function logComplaintDashboardViewed(actor: ComplaintDashboardActor) {
  await audit(actor, 'dashboard viewed', 'Complaint dashboard opened');
}

export async function logComplaintDashboardRefreshed(actor: ComplaintDashboardActor, count: number) {
  await audit(actor, 'dashboard refreshed', `${count} complaint record(s) loaded`);
}

export async function logComplaintDashboardFilterApplied(actor: ComplaintDashboardActor, filters: ComplaintFilters) {
  await audit(actor, 'filter applied', JSON.stringify(filters).slice(0, 200));
}

export async function logComplaintDashboardPdfExport(actor: ComplaintDashboardActor, count: number) {
  await audit(actor, 'PDF export clicked', `Dashboard PDF placeholder (${count} records)`);
}

export async function logComplaintDashboardExcelExport(actor: ComplaintDashboardActor, count: number) {
  await audit(actor, 'Excel export clicked', `Dashboard Excel placeholder (${count} records)`);
}

export async function logComplaintRecordOpened(actor: ComplaintDashboardActor, complaintId: string, complaintNumber: string) {
  await audit(actor, 'complaint opened', `${complaintNumber} (${complaintId})`);
}

export function exportComplaintDashboardCsvDownload(records: ComplaintRecord[], filename = 'complaint-dashboard.csv') {
  const { headers, rows } = exportComplaintDashboardCsv(records);
  downloadCsv(filename, headers, rows);
}

export function openComplaintDashboardPdfPlaceholder(records: ComplaintRecord[], generatedBy: string): void {
  const rows = records.slice(0, 50).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.complaint_number || '—'}</td>
      <td>${r.complaint_date || '—'}</td>
      <td>${r.product_name || '—'}</td>
      <td>${r.batch_number || '—'}</td>
      <td>${r.complaint_category || '—'}</td>
      <td>${r.complaint_criticality || '—'}</td>
      <td>${(r.status || '').replace(/_/g, ' ')}</td>
      <td>${r.due_date || '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Complaint Dashboard</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;font-size:11px;color:#1e293b}
.header{border:2px solid #1e40af;padding:16px;text-align:center;margin-bottom:16px}
h1{color:#1e40af;margin:0} table{width:100%;border-collapse:collapse}
th,td{border:1px solid #cbd5e1;padding:6px;text-align:left} th{background:#f1f5f9}
</style></head><body>
<div class="header">
  <strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong>
  <h1>Complaint Dashboard Report</h1>
  <p>Generated: ${new Date().toLocaleString()} | By: ${generatedBy}</p>
  <p>Total records: ${records.length} | Page 1 of 1</p>
</div>
<table>
<thead><tr><th>#</th><th>Complaint No</th><th>Date</th><th>Product</th><th>Batch</th><th>Category</th><th>Criticality</th><th>Status</th><th>Due Date</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export { computeComplaintChartData, computeComplaintDashboardMetrics };
