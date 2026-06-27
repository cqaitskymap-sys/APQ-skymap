import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc,
} from 'firebase/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { fetchRiskAssessmentRecords } from '@/lib/cpv-risk-assessment-service';
import {
  REPORTS_MODULE,
  RISK_REPORTS_COLLECTION,
  computeRiskReportAnalytics,
  extractRiskOwnerOptions,
  extractRiskProductOptions,
  generateRiskReportNumber,
  mapRiskReportToRecord,
  summarizeRiskReportsDashboard,
  type RiskReportActor,
  type RiskReportFilterInput,
  type RiskReportFormData,
  type RiskReportRecord,
} from '@/lib/risk-reports-records';

export type { RiskReportActor, RiskReportFilterInput, RiskReportFormData, RiskReportRecord };

const nowIso = () => new Date().toISOString();

async function audit(
  actor: RiskReportActor,
  actionType: string,
  recordId: string,
  detail?: string,
  oldVal?: unknown,
  newVal?: unknown,
) {
  try {
    await createAuditLog({
      moduleName: REPORTS_MODULE,
      collectionName: RISK_REPORTS_COLLECTION,
      recordId,
      actionType,
      actionDescription: detail || actionType,
      reason: detail || '',
      oldValue: oldVal,
      newValue: newVal,
      user: { id: actor.id, name: actor.name, role: actor.role || '' },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: RISK_REPORTS_COLLECTION,
      documentId: recordId,
      action: actionType,
      oldValue: oldVal,
      newValue: newVal,
      userId: actor.id,
      userName: actor.name,
      moduleName: REPORTS_MODULE,
    });
  } catch (e) {
    console.error('risk report audit', e);
  }
}

async function notify(
  title: string,
  message: string,
  recordId: string,
  userId?: string,
  targetRole?: string,
) {
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title,
      message,
      module: REPORTS_MODULE,
      record_id: recordId,
      ...(userId ? { user_id: userId } : {}),
      ...(targetRole ? { target_role: targetRole } : {}),
      read: false,
      created_at: nowIso(),
    });
  } catch (e) {
    console.error('risk report notify', e);
  }
}

export async function previewRiskReport(filters: RiskReportFilterInput) {
  const records = await fetchRiskAssessmentRecords(1000);
  return computeRiskReportAnalytics(records.filter((r) => !r.isDeleted), filters);
}

export async function fetchRiskReportRecords(max = 100): Promise<RiskReportRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), RISK_REPORTS_COLLECTION),
      orderBy('created_at', 'desc'),
      limit(max),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as RiskReportRecord))
      .filter((r) => !r.is_deleted);
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), RISK_REPORTS_COLLECTION), limit(max)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as RiskReportRecord))
        .filter((r) => !r.is_deleted)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, max);
    } catch (e) {
      console.error('fetchRiskReportRecords', e);
      return [];
    }
  }
}

export async function getRiskReportById(id: string): Promise<RiskReportRecord | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), RISK_REPORTS_COLLECTION, id));
    if (!snap.exists()) return null;
    const data = snap.data() as RiskReportRecord;
    if (data.is_deleted) return null;
    return { id: snap.id, ...data };
  } catch {
    return null;
  }
}

export async function generateRiskReport(
  form: RiskReportFormData,
  actor: RiskReportActor,
  existingCount = 0,
): Promise<{ record?: RiskReportRecord; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured' };
  const filters: RiskReportFilterInput = {
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    risk_number: form.risk_number,
    department: form.department,
    product: form.product,
    risk_category: form.risk_category,
    risk_level: form.risk_level,
    risk_owner: form.risk_owner,
    status: form.status,
    mitigation_status: form.mitigation_status,
    review_status: form.review_status,
  };
  const analytics = await previewRiskReport(filters);
  const year = new Date(form.review_period_to).getFullYear();
  const reportNumber = generateRiskReportNumber(year, existingCount);
  const payload = mapRiskReportToRecord(form, analytics, actor, reportNumber);
  try {
    const ref = await addDoc(collection(getFirebaseFirestore(), RISK_REPORTS_COLLECTION), payload);
    const record = { id: ref.id, ...payload };
    await audit(actor, 'report generated', ref.id, `${form.report_type} — ${reportNumber}`, undefined, payload);
    if (form.report_type === 'Management Review Report') {
      await notify('Risk Management Review Report', `Report ${reportNumber} generated`, ref.id, undefined, 'head_qa');
    }
    return { record };
  } catch (e) {
    console.error('generateRiskReport', e);
    return { error: 'Failed to save report' };
  }
}

export async function scheduleRiskReport(
  form: RiskReportFormData,
  actor: RiskReportActor,
  frequency: string,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured' };
  const filters: RiskReportFilterInput = {
    report_type: form.report_type,
    review_period_from: form.review_period_from,
    review_period_to: form.review_period_to,
    department: form.department,
    product: form.product,
    risk_category: form.risk_category,
    risk_level: form.risk_level,
    risk_owner: form.risk_owner,
    status: form.status,
    mitigation_status: form.mitigation_status,
    review_status: form.review_status,
  };
  const analytics = await previewRiskReport(filters);
  const payload = mapRiskReportToRecord(form, analytics, actor, generateRiskReportNumber(new Date().getFullYear(), 0));
  const nextRun = new Date();
  if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
  else if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
  else nextRun.setDate(nextRun.getDate() + 1);

  try {
    const ref = await addDoc(collection(getFirebaseFirestore(), RISK_REPORTS_COLLECTION), {
      ...payload,
      report_status: 'Scheduled',
      scheduled: true,
      schedule_frequency: frequency,
      schedule_next_run: nextRun.toISOString().split('T')[0],
    });
    await audit(actor, 'report scheduled', ref.id, `${form.report_type} — ${frequency}`, undefined, { frequency });
    await notify('Scheduled Risk Report', `${form.report_type} scheduled (${frequency})`, ref.id, actor.id);
    return { id: ref.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to schedule report' };
  }
}

export async function softDeleteRiskReport(id: string, actor: RiskReportActor): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    await updateDoc(doc(getFirebaseFirestore(), RISK_REPORTS_COLLECTION, id), {
      is_deleted: true,
      updated_at: nowIso(),
    });
    await audit(actor, 'report soft deleted', id, 'Soft delete only');
  } catch (e) {
    console.error('softDeleteRiskReport', e);
  }
}

export async function logRiskReportPreviewed(actor: RiskReportActor, reportType: string, count: number) {
  await audit(actor, 'report previewed', 'workspace', `${reportType}: ${count} record(s)`);
}

export async function logManagementReportViewed(actor: RiskReportActor) {
  await audit(actor, 'management report viewed', 'management-review', 'Management review tab accessed');
}

export async function exportRiskReport(
  report: RiskReportRecord,
  exportType: 'PDF' | 'Excel' | 'CSV',
  actor: RiskReportActor,
): Promise<{ fileUrl: string; error?: string }> {
  const placeholderUrl = `/api/exports/risk-reports/${report.id}/${exportType.toLowerCase()}`;
  const ext = exportType === 'Excel' ? 'xlsx' : exportType === 'PDF' ? 'pdf' : 'csv';
  const fileName = `${report.report_number.replace(/\//g, '-')}.${ext}`;
  if (isFirebaseConfigured() && report.id) {
    try {
      await updateDoc(doc(getFirebaseFirestore(), RISK_REPORTS_COLLECTION, report.id), {
        export_type: exportType,
        file_url: placeholderUrl,
        file_name: fileName,
        report_status: 'Exported',
        updated_at: nowIso(),
      });
    } catch (e) {
      console.error('exportRiskReport update', e);
    }
  }
  const actionMap = { PDF: 'PDF exported', Excel: 'Excel exported', CSV: 'CSV exported' } as const;
  await audit(actor, actionMap[exportType], report.id || report.report_id, `${report.report_number} — ${exportType}`, undefined, { fileName, placeholderUrl });
  return { fileUrl: placeholderUrl };
}

export async function logRiskReportPrinted(actor: RiskReportActor, reportId: string, reportNumber: string) {
  await audit(actor, 'report printed', reportId, `Print — ${reportNumber}`);
}

export async function fetchRiskReportProductOptions(): Promise<string[]> {
  const records = await fetchRiskAssessmentRecords(500);
  return extractRiskProductOptions(records.filter((r) => !r.isDeleted));
}

export async function fetchRiskReportOwnerOptions(): Promise<string[]> {
  const records = await fetchRiskAssessmentRecords(500);
  return extractRiskOwnerOptions(records.filter((r) => !r.isDeleted));
}

export async function fetchRiskDashboardAnalytics() {
  const records = await fetchRiskAssessmentRecords(1000);
  const active = records.filter((r) => !r.isDeleted);
  return summarizeRiskReportsDashboard(active);
}

export async function fetchRiskExportHistory(max = 50): Promise<RiskReportRecord[]> {
  const all = await fetchRiskReportRecords(max);
  return all.filter((r) => r.report_status === 'Exported' || Boolean(r.export_type));
}

export function openRiskReportPdfHtml(
  report: RiskReportRecord,
  generatedBy: string,
): void {
  const rows = (report.preview_rows || []).slice(0, 50).map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.risk_number}</td>
      <td>${r.product}</td>
      <td>${r.department}</td>
      <td>${r.risk_category}</td>
      <td>${r.risk_level}</td>
      <td>${r.rpn_score}</td>
      <td>${r.residual_rpn}</td>
      <td>${r.status}</td>
    </tr>`).join('');
  const m = report.metrics_snapshot;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Risk Report</title>
<style>body{font-family:Arial,sans-serif;margin:24px;font-size:11px;color:#1e293b}
.header{border:2px solid #000;padding:12px;margin-bottom:16px;text-align:center}
h1{color:#1e40af;margin:0} table{width:100%;border-collapse:collapse} th,td{border:1px solid #cbd5e1;padding:5px}
th{background:#f1f5f9}</style></head><body>
<div class="header">
<strong>SKYMAP PHARMACEUTICALS PVT. LTD.</strong>
<h1>${report.report_type}</h1>
<p>ICH Q9 | GMP Risk Management | Report No: ${report.report_number}</p>
<p>Review Period: ${report.review_period_from} — ${report.review_period_to}</p>
<p>Prepared By: ${generatedBy} | Generated: ${new Date().toLocaleString()} | Page 1</p>
</div>
<h2>Risk Register Summary</h2>
<ul>
<li>Total Risks: ${m?.totalRisks ?? 0}</li>
<li>Open: ${m?.openRisks ?? 0} | Closed: ${m?.closedRisks ?? 0}</li>
<li>Critical: ${m?.criticalRisks ?? 0} | Closure Rate: ${m?.riskClosureRate ?? 0}%</li>
<li>Avg RPN: ${m?.averageRpn ?? 0} | Risk Reduction: ${m?.riskReductionPercent ?? 0}%</li>
</ul>
<h2>FMEA / Mitigation Summary</h2>
<p>Mitigation Pending: ${m?.mitigationPending ?? 0} | Mitigation Completion: ${m?.mitigationCompletionRate ?? 0}%</p>
<h2>Residual Risk Summary</h2>
<p>Residual High Risks: ${m?.residualHighRisks ?? 0}</p>
<h2>Management Recommendations</h2>
<pre>${report.recommendations || report.summary}</pre>
<table><thead><tr><th>#</th><th>Risk No</th><th>Product</th><th>Dept</th><th>Category</th><th>Level</th><th>RPN</th><th>Residual</th><th>Status</th></tr></thead>
<tbody>${rows || '<tr><td colspan="9">No records</td></tr>'}</tbody></table>
<p><em>Approved By: _________________________</em></p>
<button onclick="window.print()">Print / Save PDF</button>
</body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

export { computeRiskReportAnalytics, summarizeRiskReportsDashboard } from '@/lib/risk-reports-records';
