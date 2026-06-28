import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import {
  listAssignments, listTrainingRecords, listEffectiveness, listCompetency,
  listAttendance, listEmployees, getTrainingMatrix, syncOverdueAssignments,
} from '@/lib/training-service';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { TMS_COLLECTIONS } from '@/lib/training-types';
import type { TrainingCertificate } from '@/lib/lms-types';
import { listRetrainingRecords } from '@/lib/training-retraining-service';
import {
  TRAINING_REPORTS_MODULE,
  applyTrainingReportFilters,
  filterReportsByRole,
  computeTrainingReportAnalytics,
  type TrainingReportActor,
  type TrainingReportFilters,
  type TrainingReportAnalytics,
  type TrainingReportDataContext,
  type TrainingReportTemplate,
  type TrainingReportSchedule,
} from '@/lib/training-reports-records';

export type {
  TrainingReportAnalytics, TrainingReportFilters, TrainingReportActor,
  TrainingReportTemplate, TrainingReportSchedule,
};

const TEMPLATE_KEY = 'training_report_templates';
const SCHEDULE_KEY = 'training_report_schedules';
const GENERATED_COUNT_KEY = 'training_reports_generated_count';

async function listCertificates(): Promise<TrainingCertificate[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.certificates),
      orderBy('issued_date', 'desc'),
      limit(500),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingCertificate));
  } catch {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), TMS_COLLECTIONS.certificates), limit(500)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingCertificate));
  }
}

async function listRetraining(): Promise<import('@/lib/training-retraining-types').RetrainingRecord[]> {
  return listRetrainingRecords(300);
}

export async function fetchTrainingReportContext(): Promise<TrainingReportDataContext> {
  await syncOverdueAssignments().catch(() => {});
  const [
    assignments, records, effectiveness, matrix, competency, attendance,
    employees, certificates, retraining,
  ] = await Promise.all([
    listAssignments(),
    listTrainingRecords(),
    listEffectiveness(),
    getTrainingMatrix(),
    listCompetency(),
    listAttendance(),
    listEmployees(),
    listCertificates(),
    listRetraining(),
  ]);
  return {
    assignments, records, effectiveness, matrix, competency, attendance,
    certificates, retraining, employeeCount: employees.length,
  };
}

function getReportsGeneratedCount(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(GENERATED_COUNT_KEY) || '0');
}

function incrementReportsGenerated(): number {
  const next = getReportsGeneratedCount() + 1;
  if (typeof window !== 'undefined') localStorage.setItem(GENERATED_COUNT_KEY, String(next));
  return next;
}

export async function fetchTrainingReportsDashboard(input: {
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: TrainingReportFilters;
}): Promise<TrainingReportAnalytics & {
  context: TrainingReportDataContext;
  employees: { id: string; name: string }[];
  trainers: string[];
}> {
  const raw = await fetchTrainingReportContext();
  const scoped = filterReportsByRole(raw, input.role, input.userId, input.userDepartment);
  const filtered = applyTrainingReportFilters(scoped, input.filters || {});
  const analytics = computeTrainingReportAnalytics(filtered, input.filters || {}, getReportsGeneratedCount());

  const empMap = new Map<string, string>();
  filtered.assignments.forEach((a) => empMap.set(a.employee_id, a.employee_name));
  const trainerSet = new Set<string>();
  filtered.records.forEach((r) => { if (r.trainer) trainerSet.add(r.trainer); });
  filtered.assignments.forEach((a) => { if (a.trainer_name) trainerSet.add(a.trainer_name); });

  return {
    ...analytics,
    context: filtered,
    employees: Array.from(empMap.entries()).map(([id, name]) => ({ id, name })),
    trainers: Array.from(trainerSet),
  };
}

export async function generateTrainingReport(
  filters: TrainingReportFilters,
  actor: TrainingReportActor,
  role?: string | null,
  userDepartment?: string,
): Promise<TrainingReportAnalytics> {
  const count = incrementReportsGenerated();
  const result = await fetchTrainingReportsDashboard({
    role, userId: actor.id, userDepartment, filters,
  });
  await logTrainingAuditRecord(
    actor, 'Report Generated', `report-${Date.now()}`, TMS_COLLECTIONS.auditTrail,
    null,
    { report_type: filters.report_type, filters, row_count: result.previewRows.length },
    { moduleName: TRAINING_REPORTS_MODULE, reason: `Generated ${filters.report_type}` },
  );
  return { ...result, kpis: { ...result.kpis, totalReportsGenerated: count } };
}

export async function logTrainingReportExported(
  actor: TrainingReportActor,
  format: 'CSV' | 'Excel' | 'PDF' | 'Print',
  reportType: string,
  count: number,
): Promise<void> {
  await logTrainingAuditRecord(
    actor, 'Export', `export-${Date.now()}`, TMS_COLLECTIONS.auditTrail,
    null, { format, report_type: reportType, count },
    { moduleName: TRAINING_REPORTS_MODULE, reason: `${format} export of ${reportType}` },
  );
}

export async function logTrainingReportViewed(actor: TrainingReportActor, reportType?: string): Promise<void> {
  await logTrainingAuditRecord(
    actor, 'View', 'training-reports', TMS_COLLECTIONS.auditTrail,
    null, { report_type: reportType },
    { moduleName: TRAINING_REPORTS_MODULE },
  );
}

export function getReportTemplates(userId: string): TrainingReportTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${TEMPLATE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveReportTemplate(userId: string, template: Omit<TrainingReportTemplate, 'id' | 'created_at' | 'created_by'>): TrainingReportTemplate {
  const saved: TrainingReportTemplate = {
    ...template,
    id: `tpl-${Date.now()}`,
    created_at: new Date().toISOString(),
    created_by: userId,
  };
  const existing = getReportTemplates(userId);
  localStorage.setItem(`${TEMPLATE_KEY}_${userId}`, JSON.stringify([saved, ...existing].slice(0, 20)));
  return saved;
}

export function getReportSchedules(userId: string): TrainingReportSchedule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${SCHEDULE_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveReportSchedule(
  userId: string,
  schedule: Omit<TrainingReportSchedule, 'id' | 'created_at' | 'created_by' | 'next_run'>,
): TrainingReportSchedule {
  const next = new Date();
  next.setDate(next.getDate() + (schedule.frequency === 'Daily' ? 1 : schedule.frequency === 'Weekly' ? 7 : 30));
  const saved: TrainingReportSchedule = {
    ...schedule,
    id: `sch-${Date.now()}`,
    next_run: next.toISOString(),
    created_at: new Date().toISOString(),
    created_by: userId,
  };
  const existing = getReportSchedules(userId);
  localStorage.setItem(`${SCHEDULE_KEY}_${userId}`, JSON.stringify([saved, ...existing].slice(0, 10)));
  return saved;
}

export function buildTrainingReportPrintHtml(
  reportType: string,
  rows: { reference: string; employee: string; department: string; training: string; type: string; status: string; due_date: string; completed_date: string; score: string; trainer: string }[],
  summary: string,
  generatedBy: string,
): string {
  const tableRows = rows.map((r, i) => `
    <tr><td>${i + 1}</td><td>${r.reference}</td><td>${r.employee}</td><td>${r.department}</td>
    <td>${r.training}</td><td>${r.type}</td><td>${r.status}</td><td>${r.due_date}</td><td>${r.completed_date}</td></tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${reportType}</title>
<style>
body{font-family:Arial,sans-serif;margin:24px;font-size:11px;color:#1e293b}
.header{border:2px solid #000;padding:16px;text-align:center;margin-bottom:20px}
.sig{margin-top:40px;border-top:1px solid #ccc;padding-top:16px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#f1f5f9}
</style></head><body>
<div class="header"><h1>${reportType}</h1><p>GMP Training Report — Inspection Ready</p>
<p>Generated: ${new Date().toISOString()} · By: ${generatedBy}</p><p>${summary}</p></div>
<table><thead><tr><th>#</th><th>Reference</th><th>Employee</th><th>Dept</th><th>Training</th><th>Type</th><th>Status</th><th>Due</th><th>Completed</th></tr></thead>
<tbody>${tableRows}</tbody></table>
<div class="sig"><p><strong>Digital Signature Placeholder</strong></p>
<p>Approved By: _________________________ Date: _____________</p>
<p>QA Review: _________________________ Date: _____________</p>
<p>21 CFR Part 11 · EU GMP Annex 11 · ALCOA+ · GAMP 5</p></div>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

export function openTrainingReportPrint(
  reportType: string,
  rows: TrainingReportAnalytics['previewRows'],
  summary: string,
  generatedBy: string,
): void {
  const html = buildTrainingReportPrintHtml(reportType, rows, summary, generatedBy);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}
