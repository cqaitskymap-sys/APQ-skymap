import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  listAssignments, listEffectiveness, listEmployees, getTrainingMatrix,
} from '@/lib/training-service';
import type {
  TrainingAssignment, TrainingEffectiveness, TrainingMatrixRow,
} from '@/lib/training-types';
import {
  emptyTrainingCharts, emptyTrainingKpis, mapAssignmentDashboardStatus,
  classifyTrainingType,
  type TrainingDashboardData, type TrainingDashboardFilters,
  type TrainingDashboardKpis, type TrainingDashboardCharts,
  type RecentAssignmentRow, type OverdueTrainingRow,
  type EffectivenessPendingRow, type TrainingActivityEntry,
  TRAINING_DASHBOARD_MODULE,
} from '@/lib/training-dashboard-records';
import type { TrainingDashboardActor } from '@/lib/training-dashboard-types';

export type { TrainingDashboardActor } from '@/lib/training-dashboard-types';
export type {
  TrainingDashboardData, TrainingDashboardFilters, TrainingDashboardKpis,
  TrainingDashboardCharts, RecentAssignmentRow, OverdueTrainingRow,
  EffectivenessPendingRow, TrainingActivityEntry,
} from '@/lib/training-dashboard-records';

function today() { return new Date().toISOString().split('T')[0]; }

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
}

function inDateRange(dateStr: string | undefined, from?: string, to?: string): boolean {
  if (!dateStr) return true;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function filterAssignments(
  assignments: TrainingAssignment[],
  filters?: TrainingDashboardFilters,
  employeeDesignations?: Map<string, string>,
): TrainingAssignment[] {
  let rows = [...assignments];
  if (filters?.department) rows = rows.filter((a) => a.department === filters.department);
  if (filters?.training_type) {
    rows = rows.filter((a) =>
      classifyTrainingType(a) === filters.training_type || a.training_type === filters.training_type,
    );
  }
  if (filters?.employee_id) rows = rows.filter((a) => a.employee_id === filters.employee_id);
  if (filters?.designation && employeeDesignations) {
    rows = rows.filter((a) => employeeDesignations.get(a.employee_id) === filters.designation);
  }
  if (filters?.trainer) rows = rows.filter((a) => a.trainer_name === filters.trainer);
  if (filters?.training_mode) rows = rows.filter((a) => a.training_mode === filters.training_mode);
  if (filters?.status) {
    rows = rows.filter((a) => {
      const st = mapAssignmentDashboardStatus(a, []);
      return st === filters.status || a.status === filters.status;
    });
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((a) =>
      a.employee_name.toLowerCase().includes(q)
      || a.training_number.toLowerCase().includes(q)
      || a.training_title.toLowerCase().includes(q),
    );
  }
  if (filters?.date_from || filters?.date_to) {
    rows = rows.filter((a) => inDateRange(a.assigned_date, filters.date_from, filters.date_to));
  }
  return rows;
}

function computeKpis(
  assignments: TrainingAssignment[],
  effectiveness: TrainingEffectiveness[],
  matrix: TrainingMatrixRow[],
  employees: { id: string }[],
): TrainingDashboardKpis {
  const assigned = assignments.length;
  const completed = assignments.filter((a) => {
    const st = mapAssignmentDashboardStatus(a, effectiveness);
    return st === 'Completed' || st === 'Effective';
  }).length;
  const pending = assignments.filter((a) => {
    const st = mapAssignmentDashboardStatus(a, effectiveness);
    return ['Assigned', 'In Progress', 'Draft'].includes(st);
  }).length;
  const overdue = assignments.filter((a) =>
    mapAssignmentDashboardStatus(a, effectiveness) === 'Overdue',
  ).length;

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const dueThisWeek = assignments.filter((a) => {
    const st = mapAssignmentDashboardStatus(a, effectiveness);
    return !['Completed', 'Effective', 'Cancelled'].includes(st)
      && a.due_date >= today() && a.due_date <= weekEndStr;
  }).length;

  const effPending = assignments.filter((a) =>
    mapAssignmentDashboardStatus(a, effectiveness) === 'Effectiveness Pending',
  ).length;
  const effective = effectiveness.filter((e) => e.effectiveness_result === 'Effective').length;
  const notEffective = effectiveness.filter((e) => e.effectiveness_result === 'Not Effective').length;

  const usersNotTrained = matrix.length > 0
    ? matrix.filter((m) => m.pending_trainings.length > 0 || m.overdue_trainings.length > 0).length
    : new Set(
      assignments.filter((a) => !['completed', 'cancelled'].includes(a.status)).map((a) => a.employee_id),
    ).size;

  const deptCompliance = matrix.length > 0
    ? Math.round(matrix.reduce((s, m) => s + m.compliance_percent, 0) / matrix.length) : 0;

  const typeCount = (label: string) =>
    assignments.filter((a) => classifyTrainingType(a) === label).length;

  return {
    totalTrainings: assigned,
    assignedTrainings: assigned,
    completedTrainings: completed,
    pendingTrainings: pending,
    overdueTrainings: overdue,
    sopTrainings: assignments.filter((a) => classifyTrainingType(a).includes('SOP')).length,
    inductionTrainings: typeCount('Induction'),
    refresherTrainings: typeCount('Refresher Training'),
    effectivenessPending: effPending,
    effectiveTrainings: effective,
    notEffectiveTrainings: notEffective,
    trainingCompliancePercent: assigned > 0 ? Math.round((completed / assigned) * 100) : 100,
    departmentCompliancePercent: deptCompliance,
    usersNotTrained,
    trainingDueThisWeek: dueThisWeek,
  };
}

function computeCharts(
  assignments: TrainingAssignment[],
  effectiveness: TrainingEffectiveness[],
  matrix: TrainingMatrixRow[],
): TrainingDashboardCharts {
  const monthlyCompletion: Record<string, number> = {};
  const typeDist: Record<string, number> = {};
  const overdueTrend: Record<string, number> = {};
  const effTrend: Record<string, { effective: number; notEffective: number }> = {};
  const sopTrend: Record<string, { total: number; completed: number }> = {};
  const userStatus: Record<string, { completed: number; pending: number; overdue: number }> = {};

  for (const a of assignments) {
    const type = classifyTrainingType(a);
    const status = mapAssignmentDashboardStatus(a, effectiveness);
    typeDist[type] = (typeDist[type] || 0) + 1;

    if (a.completion_date) {
      const m = a.completion_date.slice(0, 7);
      monthlyCompletion[m] = (monthlyCompletion[m] || 0) + 1;
    }

    if (status === 'Overdue') {
      overdueTrend[a.due_date.slice(0, 7)] = (overdueTrend[a.due_date.slice(0, 7)] || 0) + 1;
    }

    if (type.includes('SOP')) {
      const m = (a.assigned_date || today()).slice(0, 7);
      if (!sopTrend[m]) sopTrend[m] = { total: 0, completed: 0 };
      sopTrend[m].total++;
      if (['Completed', 'Effective'].includes(status)) sopTrend[m].completed++;
    }

    if (!userStatus[a.employee_name]) userStatus[a.employee_name] = { completed: 0, pending: 0, overdue: 0 };
    if (['Completed', 'Effective'].includes(status)) userStatus[a.employee_name].completed++;
    else if (status === 'Overdue') userStatus[a.employee_name].overdue++;
    else userStatus[a.employee_name].pending++;
  }

  for (const e of effectiveness) {
    const m = (e.evaluated_at || '').slice(0, 7) || 'Unknown';
    if (!effTrend[m]) effTrend[m] = { effective: 0, notEffective: 0 };
    if (e.effectiveness_result === 'Effective') effTrend[m].effective++;
    if (e.effectiveness_result === 'Not Effective') effTrend[m].notEffective++;
  }

  const deptMap: Record<string, { total: number; count: number }> = {};
  for (const m of matrix) {
    if (!deptMap[m.department]) deptMap[m.department] = { total: 0, count: 0 };
    deptMap[m.department].total += m.compliance_percent;
    deptMap[m.department].count++;
  }

  const completed = assignments.filter((a) =>
    ['Completed', 'Effective'].includes(mapAssignmentDashboardStatus(a, effectiveness)),
  ).length;
  const pending = assignments.filter((a) => {
    const st = mapAssignmentDashboardStatus(a, effectiveness);
    return !['Completed', 'Effective', 'Cancelled'].includes(st);
  }).length;

  return {
    monthlyCompletionTrend: Object.entries(monthlyCompletion).sort().map(([month, count]) => ({ month, count })),
    deptCompliance: Object.entries(deptMap).map(([name, v]) => ({
      name, value: v.count > 0 ? Math.round(v.total / v.count) : 0,
    })),
    typeDistribution: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
    pendingVsCompleted: [{ name: 'Completed', value: completed }, { name: 'Pending', value: pending }],
    overdueTrend: Object.entries(overdueTrend).sort().map(([month, count]) => ({ month, count })),
    effectivenessTrend: Object.entries(effTrend).sort().map(([month, v]) => ({
      month, effective: v.effective, notEffective: v.notEffective,
    })),
    sopComplianceTrend: Object.entries(sopTrend).sort().map(([month, v]) => ({
      month, value: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
    })),
    userWiseStatus: Object.entries(userStatus).slice(0, 15).map(([name, v]) => ({ name, ...v })),
  };
}

function buildTables(
  assignments: TrainingAssignment[],
  effectiveness: TrainingEffectiveness[],
): {
  recent: RecentAssignmentRow[];
  overdue: OverdueTrainingRow[];
  effPending: EffectivenessPendingRow[];
} {
  const t = today();

  const recent = [...assignments]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      training_number: a.training_number,
      employee_name: a.employee_name,
      department: a.department,
      training_type: classifyTrainingType(a),
      document_sop: [a.document_number, a.document_title, a.sop_version].filter(Boolean).join(' / ') || '—',
      due_date: a.due_date,
      status: mapAssignmentDashboardStatus(a, effectiveness),
      trainer: a.trainer_name,
    }));

  const overdue = assignments
    .filter((a) => mapAssignmentDashboardStatus(a, effectiveness) === 'Overdue')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 20)
    .map((a) => ({
      id: a.id,
      training_number: a.training_number,
      employee_name: a.employee_name,
      department: a.department,
      due_date: a.due_date,
      days_overdue: daysBetween(a.due_date, t),
      responsible_manager: a.trainer_name || 'Department Head',
      status: mapAssignmentDashboardStatus(a, effectiveness),
    }));

  const effPending = assignments
    .filter((a) => mapAssignmentDashboardStatus(a, effectiveness) === 'Effectiveness Pending')
    .slice(0, 20)
    .map((a) => {
      const eff = effectiveness.find((e) => e.assignment_id === a.id);
      return {
        id: a.id,
        training_number: a.training_number,
        employee_name: a.employee_name,
        training_topic: a.training_topic || a.training_title,
        effectiveness_due_date: a.effectiveness_due_date || a.due_date,
        evaluator: eff?.evaluated_by_name || 'QA Manager',
        status: 'Pending',
      };
    });

  return { recent, overdue, effPending };
}

function buildActivity(assignments: TrainingAssignment[]): TrainingActivityEntry[] {
  return [...assignments]
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, 12)
    .map((a) => ({
      id: a.id,
      title: `${a.training_number} — ${a.employee_name}`,
      description: `${a.training_title} (${a.status})`,
      timestamp: a.updated_at || a.assigned_date,
      type: a.source || 'assignment',
    }));
}

async function audit(actor: TrainingDashboardActor, action: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, 'training-dashboard', 'training_assignments', null, detail,
    { moduleName: TRAINING_DASHBOARD_MODULE },
  );
}

export async function fetchTrainingDashboard(
  filters?: TrainingDashboardFilters,
  _actor?: TrainingDashboardActor,
): Promise<TrainingDashboardData> {
  if (!isFirebaseConfigured()) {
    return {
      kpis: emptyTrainingKpis(),
      charts: emptyTrainingCharts(),
      recentAssignments: [],
      overdueTrainings: [],
      effectivenessPending: [],
      activity: [],
      error: 'Firebase is not configured. Set environment variables to load live training data.',
    };
  }

  try {
    const [assignmentsRaw, effectiveness, matrix, employees] = await Promise.all([
      listAssignments().catch(() => [] as TrainingAssignment[]),
      listEffectiveness().catch(() => [] as TrainingEffectiveness[]),
      getTrainingMatrix().catch(() => [] as TrainingMatrixRow[]),
      listEmployees().catch(() => []),
    ]);

    const designationMap = new Map(employees.map((e) => [e.id, e.designation]));
    const assignments = filterAssignments(assignmentsRaw, filters, designationMap);
    const scopedMatrix = filters?.department
      ? matrix.filter((m) => m.department === filters.department) : matrix;

    const kpis = computeKpis(assignments, effectiveness, scopedMatrix, employees);
    const charts = computeCharts(assignments, effectiveness, scopedMatrix);
    const tables = buildTables(assignments, effectiveness);

    return {
      kpis,
      charts,
      recentAssignments: tables.recent,
      overdueTrainings: tables.overdue,
      effectivenessPending: tables.effPending,
      activity: buildActivity(assignments),
    };
  } catch (e) {
    console.error('fetchTrainingDashboard failed', e);
    return {
      kpis: emptyTrainingKpis(),
      charts: emptyTrainingCharts(),
      recentAssignments: [],
      overdueTrainings: [],
      effectivenessPending: [],
      activity: [],
      error: e instanceof Error ? e.message : 'Failed to load training dashboard',
    };
  }
}

export async function refreshTrainingDashboard(
  filters?: TrainingDashboardFilters,
  actor?: TrainingDashboardActor,
): Promise<TrainingDashboardData> {
  const data = await fetchTrainingDashboard(filters, actor);
  if (actor) await audit(actor, 'Dashboard Refreshed', { filters, kpis: data.kpis });
  return data;
}

export async function logTrainingDashboardExport(
  format: 'PDF' | 'Excel' | 'CSV',
  actor: TrainingDashboardActor,
): Promise<void> {
  await audit(actor, 'Export', { format });
}

export async function logTrainingDashboardViewed(actor: TrainingDashboardActor): Promise<void> {
  await audit(actor, 'Dashboard Viewed');
}

export async function logTrainingDashboardFilterChanged(
  actor: TrainingDashboardActor,
  filters: TrainingDashboardFilters,
): Promise<void> {
  await audit(actor, 'Filter Changed', filters);
}

export function exportTrainingDashboardCsv(data: TrainingDashboardData) {
  const headers = ['Training #', 'Employee', 'Department', 'Type', 'Due Date', 'Status', 'Trainer'];
  const rows = data.recentAssignments.map((r) => [
    r.training_number, r.employee_name, r.department, r.training_type,
    r.due_date, r.status, r.trainer || '—',
  ]);
  downloadCsv(`training-dashboard-${today()}.csv`, headers, rows);
}

export function openTrainingDashboardPdfPlaceholder(
  data: TrainingDashboardData,
  generatedBy: string,
): void {
  const k = data.kpis;
  const rows = data.recentAssignments.slice(0, 30).map((r, i) => `
    <tr><td>${i + 1}</td><td>${r.training_number}</td><td>${r.employee_name}</td>
    <td>${r.department}</td><td>${r.training_type}</td><td>${r.due_date}</td><td>${r.status}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><title>Training Management Dashboard</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#1e293b}
.header{border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px}
.header h1{color:#1e3a5f;margin:0}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
.kpi div{background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px}
.kpi strong{display:block;font-size:20px;color:#2563eb}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px}
th,td{border:1px solid #cbd5e1;padding:8px}th{background:#2563eb;color:#fff}
.footer{margin-top:32px;font-size:11px;color:#64748b}</style></head><body>
<div class="header"><h1>Training Management Dashboard</h1>
<p>Generated by ${generatedBy} on ${new Date().toLocaleString()}</p></div>
<div class="kpi">
  <div><strong>${k.totalTrainings}</strong>Total Trainings</div>
  <div><strong>${k.completedTrainings}/${k.assignedTrainings}</strong>Completed</div>
  <div><strong>${k.trainingCompliancePercent}%</strong>Compliance</div>
  <div><strong>${k.overdueTrainings}</strong>Overdue</div>
  <div><strong>${k.departmentCompliancePercent}%</strong>Dept Compliance</div>
  <div><strong>${k.effectivenessPending}</strong>Eff. Pending</div>
  <div><strong>${k.usersNotTrained}</strong>Not Trained</div>
  <div><strong>${k.trainingDueThisWeek}</strong>Due This Week</div>
</div>
<h2>Recent Assignments</h2>
<table><thead><tr><th>#</th><th>Training No</th><th>Employee</th><th>Dept</th><th>Type</th><th>Due</th><th>Status</th></tr></thead>
<tbody>${rows || '<tr><td colspan="7">No records</td></tr>'}</tbody></table>
<div class="footer"><p>GMP Training Management — FDA / MHRA / WHO / PIC/S / EU GMP Compliant</p></div>
</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export const DASHBOARD_LAYOUT_KEY = 'training_dashboard_layout';

export function saveDashboardLayout(visibleSections: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(visibleSections));
}

export function loadDashboardLayout(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_LAYOUT_KEY) || 'null');
  } catch { return null; }
}
