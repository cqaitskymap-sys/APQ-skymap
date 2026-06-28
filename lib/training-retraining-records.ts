import {
  type RetrainingRecord, type RetrainingFilters,
  type RetrainingDashboardKpis, type RetrainingDashboardCharts,
  type RetrainingDashboardData,
  computeRetrainingStatus,
  isEmployeeRetrainingView,
} from './training-retraining-types';
import { normalizeRole } from '@/lib/permissions';

export function filterRetrainingByRole(
  records: RetrainingRecord[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): RetrainingRecord[] {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa', 'auditor', 'viewer', 'training_coordinator', 'trainer'].includes(r)) {
    return records;
  }
  if (isEmployeeRetrainingView(r) && userId) {
    return records.filter((rec) => rec.employee_id === userId);
  }
  if (userDepartment) {
    const dept = userDepartment.toLowerCase();
    return records.filter((rec) => rec.department?.toLowerCase() === dept);
  }
  if (userId) return records.filter((rec) => rec.employee_id === userId);
  return records;
}

export function applyRetrainingFilters(
  records: RetrainingRecord[],
  filters: RetrainingFilters,
): RetrainingRecord[] {
  const q = filters.search?.toLowerCase() || '';
  return records.filter((rec) => {
    const status = String(rec.retraining_status || rec.status || '');
    const topic = rec.training_topic || rec.training_title || '';
    const matchSearch = !q
      || rec.retraining_number.toLowerCase().includes(q)
      || rec.employee_name.toLowerCase().includes(q)
      || topic.toLowerCase().includes(q)
      || rec.trigger_reference.toLowerCase().includes(q);
    const matchDept = !filters.department || rec.department === filters.department;
    const matchEmp = !filters.employee_id || rec.employee_id === filters.employee_id;
    const matchTrigger = !filters.trigger_type || filters.trigger_type === 'all'
      || rec.trigger_type === filters.trigger_type;
    const matchType = !filters.training_type || rec.training_type === filters.training_type;
    const matchStatus = !filters.status || filters.status === 'all' || status === filters.status;
    const matchTrainer = !filters.trainer || rec.trainer === filters.trainer;
    const matchFrom = !filters.date_from || rec.assigned_date >= filters.date_from;
    const matchTo = !filters.date_to || rec.assigned_date <= filters.date_to;
    return matchSearch && matchDept && matchEmp && matchTrigger && matchType
      && matchStatus && matchTrainer && matchFrom && matchTo;
  });
}

export function computeRetrainingDashboard(records: RetrainingRecord[]): RetrainingDashboardData {
  const todayStr = new Date().toISOString().slice(0, 10);

  const withStatus = records.map((rec) => ({
    ...rec,
    retraining_status: computeRetrainingStatus(
      rec.due_date,
      String(rec.retraining_status || rec.status || 'Assigned'),
      rec.completion_date,
    ),
  }));

  const assigned = withStatus.filter((r) => ['Assigned', 'Scheduled'].includes(String(r.retraining_status)));
  const completed = withStatus.filter((r) => r.retraining_status === 'Completed' || r.retraining_status === 'Closed');
  const pending = withStatus.filter((r) => ['Assigned', 'Scheduled', 'In Progress', 'Draft'].includes(String(r.retraining_status)));
  const overdue = withStatus.filter((r) => r.retraining_status === 'Overdue');
  const failed = withStatus.filter((r) => r.retraining_status === 'Failed');
  const annualGmp = withStatus.filter((r) =>
    r.trigger_type === 'Annual GMP' && !['Completed', 'Closed', 'Cancelled'].includes(String(r.retraining_status)),
  );
  const certRenewals = withStatus.filter((r) =>
    r.certificate_issued === false && ['Periodic Refresher', 'Annual GMP'].includes(String(r.trigger_type))
    && !['Completed', 'Closed', 'Cancelled'].includes(String(r.retraining_status)),
  );
  const competencyGaps = withStatus.filter((r) =>
    r.competency_status === 'Not Competent' || r.trigger_type === 'Failed Competency',
  );

  const deptCompleted: Record<string, { total: number; done: number }> = {};
  withStatus.forEach((r) => {
    if (!deptCompleted[r.department]) deptCompleted[r.department] = { total: 0, done: 0 };
    deptCompleted[r.department].total++;
    if (['Completed', 'Closed'].includes(String(r.retraining_status))) deptCompleted[r.department].done++;
  });
  const deptRates = Object.values(deptCompleted).map((d) => (d.total > 0 ? (d.done / d.total) * 100 : 100));
  const departmentCompliance = deptRates.length
    ? Math.round(deptRates.reduce((s, v) => s + v, 0) / deptRates.length) : 100;

  const retrainTrend: Record<string, number> = {};
  const completionTrend: Record<string, number> = {};
  const triggerMap: Record<string, number> = {};
  const deptMap: Record<string, number> = {};
  const overdueTrend: Record<string, number> = {};
  const certRenewTrend: Record<string, number> = {};
  const compImprove: Record<string, { pass: number; total: number }> = {};
  let passCount = 0;
  let failCount = 0;

  withStatus.forEach((r) => {
    if (r.created_at) retrainTrend[r.created_at.slice(0, 7)] = (retrainTrend[r.created_at.slice(0, 7)] || 0) + 1;
    if (r.completion_date) completionTrend[r.completion_date.slice(0, 7)] = (completionTrend[r.completion_date.slice(0, 7)] || 0) + 1;
    triggerMap[r.trigger_type] = (triggerMap[r.trigger_type] || 0) + 1;
    deptMap[r.department] = (deptMap[r.department] || 0) + 1;
    if (r.retraining_status === 'Overdue' && r.due_date) {
      overdueTrend[r.due_date.slice(0, 7)] = (overdueTrend[r.due_date.slice(0, 7)] || 0) + 1;
    }
    if (r.certificate_issued && r.completion_date) {
      certRenewTrend[r.completion_date.slice(0, 7)] = (certRenewTrend[r.completion_date.slice(0, 7)] || 0) + 1;
    }
    if (r.result === 'Pass') passCount++;
    if (r.result === 'Fail') failCount++;
    if (r.completion_date) {
      const m = r.completion_date.slice(0, 7);
      if (!compImprove[m]) compImprove[m] = { pass: 0, total: 0 };
      compImprove[m].total++;
      if (r.result === 'Pass') compImprove[m].pass++;
    }
  });

  const last6: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6.push(d.toISOString().slice(0, 7));
  }

  const kpis: RetrainingDashboardKpis = {
    totalRetraining: withStatus.length,
    assigned: assigned.length,
    completed: completed.length,
    pending: pending.length,
    overdue: overdue.length,
    failed: failed.length,
    annualGmpDue: annualGmp.length,
    certificatesExpired: certRenewals.length,
    competencyGaps: competencyGaps.length,
    departmentCompliance,
  };

  const charts: RetrainingDashboardCharts = {
    retrainingTrend: Object.entries(retrainTrend).sort().map(([month, count]) => ({ month, count })),
    triggerTypeDistribution: Object.entries(triggerMap).map(([name, value]) => ({ name, value })),
    departmentRetraining: Object.entries(deptMap).map(([name, value]) => ({ name, value })),
    completionTrend: Object.entries(completionTrend).sort().map(([month, count]) => ({ month, count })),
    passVsFail: [{ name: 'Pass', value: passCount }, { name: 'Fail', value: failCount }],
    competencyImprovement: last6.map((month) => {
      const c = compImprove[month];
      return { month: month.slice(5), percent: c && c.total > 0 ? Math.round((c.pass / c.total) * 100) : 0 };
    }),
    certificateRenewalTrend: Object.entries(certRenewTrend).sort().map(([month, count]) => ({ month, count })),
    overdueTrend: Object.entries(overdueTrend).sort().map(([month, count]) => ({ month, count })),
  };

  const upcoming = withStatus
    .filter((r) => ['Assigned', 'Scheduled', 'In Progress'].includes(String(r.retraining_status))
      && r.due_date >= todayStr)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 20);

  return {
    kpis,
    charts,
    records: withStatus,
    upcoming,
    overdue,
    failed,
    recentCompleted: completed.sort((a, b) => (b.completion_date || '').localeCompare(a.completion_date || '')).slice(0, 20),
    certificateRenewals: certRenewals.slice(0, 20),
    capaLinked: withStatus.filter((r) => r.trigger_type === 'CAPA').slice(0, 20),
    deviationLinked: withStatus.filter((r) => r.trigger_type === 'Deviation').slice(0, 20),
  };
}
