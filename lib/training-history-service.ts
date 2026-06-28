import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  listEmployees, listAssignments, listTrainingRecords,
  listEffectiveness, listCompetency, listMatrixDefinitions,
} from '@/lib/training-service';
import { listCertificates } from '@/lib/training-certificate-service';
import { listRetrainingRecords } from '@/lib/training-retraining-service';
import {
  TRAINING_HISTORY_MODULE,
  type HistoryFilters, type HistoryActor, type EmployeeHistoryData,
  type TrainingHistoryEntry,
} from '@/lib/training-history-types';
import {
  buildExtendedProfile, assignmentToHistory, recordToHistory, dedupeHistory,
  applyHistoryFilters, filterHistoryByRole, computeHistoryDashboard,
  buildAssessments, buildCompetency, buildCertificates, buildRetrainingHistory,
  buildSopRevisions, buildMatrixMapping,
} from '@/lib/training-history-records';

export type { HistoryFilters, HistoryActor, EmployeeHistoryData, TrainingHistoryEntry };

function today() { return new Date().toISOString().slice(0, 10); }

async function audit(actor: HistoryActor, action: string, recordId: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, recordId, 'training_records', null, detail,
    { moduleName: TRAINING_HISTORY_MODULE },
  );
}

function buildCertMap(certs: Awaited<ReturnType<typeof listCertificates>>) {
  const map = new Map<string, typeof certs[0]>();
  certs.forEach((c) => {
    map.set(c.employee_id + c.training_topic, c);
    if (c.training_record_id) map.set(c.training_record_id, c);
  });
  return map;
}

function buildRetrainMap(records: Awaited<ReturnType<typeof listRetrainingRecords>>) {
  const map = new Map<string, typeof records[0]>();
  records.forEach((r) => {
    if (r.original_training_id) map.set(r.original_training_id, r);
  });
  return map;
}

export async function fetchEmployeeHistory(input: {
  employeeId?: string;
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: HistoryFilters;
}): Promise<EmployeeHistoryData> {
  const [
    employees, assignments, records, effectiveness,
    competency, matrix, certificates, retraining,
  ] = await Promise.all([
    listEmployees(),
    listAssignments(),
    listTrainingRecords(),
    listEffectiveness(),
    listCompetency(),
    listMatrixDefinitions({ status: 'Active' }),
    listCertificates(),
    listRetrainingRecords(),
  ]);

  let targetEmployeeId = input.employeeId || input.userId || '';
  const role = input.role || '';

  if (!targetEmployeeId && employees.length > 0) {
    if (input.userDepartment) {
      const deptEmp = employees.find((e) => e.department === input.userDepartment);
      targetEmployeeId = deptEmp?.id || employees[0].id;
    } else {
      targetEmployeeId = employees[0].id;
    }
  }

  const emp = employees.find((e) => e.id === targetEmployeeId || e.employee_id === targetEmployeeId) || null;
  const empId = emp?.id || targetEmployeeId;

  const empAssignments = assignments.filter((a) => a.employee_id === empId);
  const empRecords = records.filter((r) => r.employee_id === empId);
  const empCerts = certificates.filter((c) => c.employee_id === empId);
  const empRetrain = retraining.filter((r) => r.employee_id === empId);
  const empComp = competency.filter((c) => c.employee_id === empId);
  const empEffectiveness = effectiveness.filter((e) => e.employee_id === empId);

  const certMap = buildCertMap(empCerts);
  const retrainMap = buildRetrainMap(empRetrain);

  const fromAssignments = empAssignments.map((a) => assignmentToHistory(a, certMap, retrainMap));
  const fromRecords = empRecords.map((r) => {
    const cert = certMap.get(r.id) || certMap.get(empId + r.training_topic);
    return recordToHistory(r, cert);
  });

  let history = dedupeHistory([...fromAssignments, ...fromRecords]);
  history = filterHistoryByRole(history, role, input.userId, input.userDepartment);
  history = applyHistoryFilters(history, { ...input.filters, employee_id: empId });

  const assessments = buildAssessments(empRecords, empAssignments);
  const compHistory = buildCompetency(empComp);
  const certHistory = buildCertificates(empCerts);
  const retrainHistory = buildRetrainingHistory(empRetrain);
  const sopHistory = buildSopRevisions(empAssignments);
  const matrixMapping = buildMatrixMapping(matrix, history, emp?.department || '', emp?.designation || '');

  const auditEvents = empEffectiveness.map((e) => ({
    id: `audit-eff-${e.id}`,
    date: e.evaluated_at?.slice(0, 10) || today(),
    title: `Effectiveness: ${e.training_number}`,
    description: e.effectiveness_result,
    type: 'audit' as const,
    status: e.effectiveness_result,
  }));

  const profile = buildExtendedProfile(emp, empId);

  return computeHistoryDashboard(
    profile, history, assessments, compHistory, certHistory,
    retrainHistory, sopHistory, matrixMapping, auditEvents,
  );
}

export async function fetchDepartmentHistory(input: {
  department?: string;
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: HistoryFilters;
}): Promise<{ employees: { id: string; name: string; department: string }[]; summaries: { employee_id: string; employee_name: string; total: number; completed: number; overdue: number }[] }> {
  const employees = await listEmployees();
  const assignments = await listAssignments();
  const dept = input.department || input.userDepartment || '';

  const deptEmps = dept
    ? employees.filter((e) => e.department === dept)
    : employees;

  const summaries = deptEmps.map((emp) => {
    const empAssign = assignments.filter((a) => a.employee_id === emp.id);
    return {
      employee_id: emp.id,
      employee_name: emp.full_name,
      total: empAssign.length,
      completed: empAssign.filter((a) => a.status === 'completed').length,
      overdue: empAssign.filter((a) => a.status === 'overdue').length,
    };
  });

  return {
    employees: deptEmps.map((e) => ({ id: e.id, name: e.full_name, department: e.department })),
    summaries,
  };
}

export async function logHistoryViewed(actor: HistoryActor, employeeId: string) {
  await audit(actor, 'Record Viewed', employeeId, { employee_id: employeeId });
}

export async function logHistoryExported(actor: HistoryActor, employeeId: string, format: string, count: number) {
  await audit(actor, 'Export', employeeId, { format, count, employee_id: employeeId });
}

export function exportHistoryCsv(history: TrainingHistoryEntry[], employeeName: string) {
  const headers = [
    'Training #', 'Topic', 'Type', 'Category', 'Trainer', 'Mode', 'Document', 'SOP',
    'Assigned', 'Training Date', 'Completed', 'Score', 'Pass Score', 'Result',
    'Competency', 'Certificate', 'Cert Expiry', 'Retraining Due', 'Status',
  ];
  const rows = history.map((h) => [
    h.training_number, h.training_topic, h.training_type, h.training_category,
    h.trainer, h.training_mode, h.document_number, h.sop_number,
    h.assignment_date, h.training_date, h.completion_date || '—',
    h.assessment_score ?? '—', h.passing_score, h.training_result,
    h.competency_level || '—', h.certificate_number || '—', h.certificate_expiry || '—',
    h.retraining_due || '—', h.training_status,
  ]);
  downloadCsv(`training-history-${employeeName.replace(/\s+/g, '-')}-${today()}.csv`, headers, rows);
}

export function openHistoryPrint(data: EmployeeHistoryData) {
  const p = data.profile;
  const rows = data.history.map((h) => `
    <tr>
      <td>${h.training_number}</td><td>${h.training_topic}</td><td>${h.training_type}</td>
      <td>${h.trainer}</td><td>${h.completion_date || '—'}</td><td>${h.assessment_score ?? '—'}</td>
      <td>${h.training_result || '—'}</td><td>${h.training_status}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Employee Training Record — ${p?.employee_name || ''}</title>
<style>
body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
.header{border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px}
.header h1{color:#1e3a5f;margin:0;font-size:22px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin:16px 0}
.kpi{display:flex;gap:24px;margin:16px 0;font-size:13px}
.kpi span{background:#f1f5f9;padding:8px 16px;border-radius:6px}
table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border:1px solid #cbd5e1;padding:8px;font-size:11px;text-align:left}
th{background:#1e3a5f;font-weight:600}
.footer{margin-top:32px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:16px}
</style></head><body>
<div class="header">
  <h1>Employee Training History — Inspection Report</h1>
  <p style="color:#64748b;margin:4px 0">Generated: ${new Date().toISOString()} | Module: GMP Training Management</p>
</div>
<div class="meta">
  <div><strong>Employee:</strong> ${p?.employee_name || '—'}</div>
  <div><strong>Employee #:</strong> ${p?.employee_number || '—'}</div>
  <div><strong>Department:</strong> ${p?.department || '—'}</div>
  <div><strong>Designation:</strong> ${p?.designation || '—'}</div>
  <div><strong>Role:</strong> ${p?.role || '—'}</div>
  <div><strong>Status:</strong> ${p?.employment_status || 'Active'}</div>
</div>
<div class="kpi">
  <span>Total: ${data.kpis.totalTrainings}</span>
  <span>Completed: ${data.kpis.completed}</span>
  <span>Overdue: ${data.kpis.overdue}</span>
  <span>Certificates: ${data.kpis.certificates}</span>
  <span>Avg Score: ${data.kpis.averageAssessmentScore}%</span>
  <span>Competency: ${data.kpis.competencyScore}%</span>
</div>
<h2 style="font-size:16px;color:#1e3a5f">Training History</h2>
<table><thead><tr>
  <th>Training #</th><th>Topic</th><th>Type</th><th>Trainer</th><th>Completed</th><th>Score</th><th>Result</th><th>Status</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="footer">
  <p>This document is generated from the electronic Quality Management System (eQMS) and constitutes a true copy of training records.</p>
  <p>Compliant with: 21 CFR Part 11 | EU GMP Annex 11 | WHO GMP | PIC/S | MHRA Data Integrity</p>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export function buildInspectionReportHtml(data: EmployeeHistoryData): string {
  return `Employee Training Record for ${data.profile?.employee_name || 'Unknown'} — ${data.history.length} records`;
}
