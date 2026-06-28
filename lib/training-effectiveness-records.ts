import { normalizeRole } from '@/lib/permissions';
import type { CompetencyRecord } from '@/lib/training-types';
import {
  type TrainingEvaluationRecord, type EffectivenessFilters,
  type EffectivenessDashboardKpis, type EffectivenessDashboardCharts,
  type EffectivenessDashboardData,
  isEmployeeEffectivenessView, canManageEffectiveness, canApproveEffectiveness,
} from './training-effectiveness-types';

export function filterEvaluationsByRole(
  records: TrainingEvaluationRecord[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingEvaluationRecord[] {
  const r = normalizeRole(role || '');
  if (canManageEffectiveness(r) || canApproveEffectiveness(r) || ['auditor', 'viewer'].includes(r)) {
    return records;
  }
  if (isEmployeeEffectivenessView(r) && userId) {
    return records.filter((rec) => rec.employee_id === userId);
  }
  if (userDepartment) {
    return records.filter((rec) => rec.department?.toLowerCase() === userDepartment.toLowerCase());
  }
  return records;
}

export function applyEffectivenessFilters(
  records: TrainingEvaluationRecord[],
  filters: EffectivenessFilters,
): TrainingEvaluationRecord[] {
  const q = filters.search?.toLowerCase() || '';
  return records.filter((rec) => {
    const matchSearch = !q
      || rec.evaluation_number.toLowerCase().includes(q)
      || rec.employee_name.toLowerCase().includes(q)
      || rec.training_topic.toLowerCase().includes(q);
    const matchDept = !filters.department || rec.department === filters.department;
    const matchEmp = !filters.employee_id || rec.employee_id === filters.employee_id;
    const matchType = !filters.evaluation_type || rec.evaluation_type === filters.evaluation_type;
    const matchResult = !filters.result || rec.result === filters.result;
    const matchStatus = !filters.status || rec.status === filters.status;
    const matchEvaluator = !filters.evaluator || rec.evaluator === filters.evaluator;
    const matchFrom = !filters.date_from || rec.evaluation_date >= filters.date_from;
    const matchTo = !filters.date_to || rec.evaluation_date <= filters.date_to;
    return matchSearch && matchDept && matchEmp && matchType && matchResult
      && matchStatus && matchEvaluator && matchFrom && matchTo;
  });
}

export function computeEffectivenessDashboard(
  evaluations: TrainingEvaluationRecord[],
  competency: CompetencyRecord[],
): EffectivenessDashboardData {
  const today = new Date().toISOString().slice(0, 10);
  const passed = evaluations.filter((e) => e.result === 'Pass');
  const failed = evaluations.filter((e) => e.result === 'Fail');
  const pending = evaluations.filter((e) => e.status === 'Submitted');
  const competent = evaluations.filter((e) =>
    ['Excellent', 'Competent'].includes(String(e.competency_level)),
  );
  const needingRetrain = evaluations.filter((e) =>
    e.result === 'Fail' || e.competency_level === 'Not Competent',
  );
  const upcomingReassess = evaluations.filter((e) =>
    e.reassessment_required && e.reassessment_date && e.reassessment_date >= today
    && !['Closed', 'Approved'].includes(String(e.status)),
  );

  const passFail = [{ name: 'Pass', value: passed.length }, { name: 'Fail', value: failed.length }];
  const deptMap: Record<string, { pass: number; total: number }> = {};
  const trend: Record<string, number> = {};
  const statusDist: Record<string, number> = {};

  evaluations.forEach((e) => {
    if (!deptMap[e.department]) deptMap[e.department] = { pass: 0, total: 0 };
    deptMap[e.department].total++;
    if (e.result === 'Pass') deptMap[e.department].pass++;
    if (e.evaluation_date) trend[e.evaluation_date.slice(0, 7)] = (trend[e.evaluation_date.slice(0, 7)] || 0) + 1;
    statusDist[String(e.status)] = (statusDist[String(e.status)] || 0) + 1;
  });

  competency.forEach((c) => {
    if (!deptMap[c.department]) deptMap[c.department] = { pass: 0, total: 0 };
  });

  const kpis: EffectivenessDashboardKpis = {
    totalEvaluations: evaluations.length,
    passed: passed.length,
    failed: failed.length,
    pendingApproval: pending.length,
    competentEmployees: competent.length,
    needingRetraining: needingRetrain.length,
    upcomingReassessments: upcomingReassess.length,
  };

  const charts: EffectivenessDashboardCharts = {
    passVsFail: passFail,
    departmentCompetency: Object.entries(deptMap).map(([name, v]) => ({
      name, value: v.total > 0 ? Math.round((v.pass / v.total) * 100) : 0,
    })),
    effectivenessTrend: Object.entries(trend).sort().map(([month, count]) => ({ month, count })),
    statusDistribution: Object.entries(statusDist).map(([name, value]) => ({ name, value })),
  };

  return {
    kpis,
    charts,
    evaluations,
    pendingApproval: pending,
    upcomingReassessments: upcomingReassess,
    competencyGaps: evaluations.filter((e) =>
      ['Needs Improvement', 'Not Competent'].includes(String(e.competency_level)),
    ),
  };
}
