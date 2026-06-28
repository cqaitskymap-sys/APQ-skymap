import { normalizeRole } from '@/lib/permissions';
import { isOverdue, isTrainingCoordinator, canReviewTraining } from '@/lib/training-types';
import { classifyTrainingType } from '@/lib/training-dashboard-records';
import type {
  TrainingAssignment, TrainingEffectiveness, TrainingMatrixRow,
  TrainingRecord, CompetencyRecord, TrainingAttendance,
} from '@/lib/training-types';
import type { TrainingCertificate } from '@/lib/lms-types';
import type { RetrainingRecord } from '@/lib/training-retraining-types';

export const TRAINING_REPORTS_MODULE = 'Training Reports & Analytics';

export const TRAINING_REPORT_TYPES = [
  'Training Compliance Report',
  'Department Training Report',
  'Employee Training History Report',
  'Overdue Training Report',
  'Upcoming Training Report',
  'Training Effectiveness Report',
  'Competency Report',
  'Assessment Result Report',
  'Certificate Status Report',
  'Certificate Expiry Report',
  'Retraining Report',
  'Trainer Performance Report',
  'Training Matrix Coverage Report',
  'Annual GMP Training Report',
  'Regulatory Inspection Report',
] as const;

export const TRAINING_REPORT_FREQUENCIES = [
  'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly',
] as const;

export type TrainingReportType = typeof TRAINING_REPORT_TYPES[number];
export type TrainingReportActor = { id: string; name: string; role?: string; department?: string };

export interface TrainingReportFilters {
  report_type?: TrainingReportType | string;
  date_from?: string;
  date_to?: string;
  department?: string;
  employee_id?: string;
  designation?: string;
  training_type?: string;
  trainer?: string;
  status?: string;
  training_mode?: string;
  certificate_status?: string;
  assessment_result?: string;
  search?: string;
}

export interface TrainingReportKpis {
  totalReportsGenerated: number;
  trainingCompliancePercent: number;
  employeesFullyTrained: number;
  employeesOverdue: number;
  certificatesExpiring: number;
  retrainingDue: number;
  averageAssessmentScore: number;
  competencyRate: number;
  departmentCompliance: number;
  monthlyCompletionPercent: number;
}

export interface TrainingReportCharts {
  monthlyCompletionTrend: { month: string; count: number }[];
  departmentCompliance: { name: string; value: number }[];
  passVsFail: { name: string; value: number }[];
  competencyDistribution: { name: string; value: number }[];
  certificateExpiryTrend: { month: string; count: number }[];
  retrainingTrend: { month: string; count: number }[];
  trainingTypeDistribution: { name: string; value: number }[];
  trainerPerformance: { name: string; sessions: number; passRate: number }[];
  assessmentScoreTrend: { month: string; avgScore: number }[];
  overdueTrend: { month: string; count: number }[];
}

export interface TrainingReportPreviewRow {
  reference: string;
  employee: string;
  department: string;
  training: string;
  type: string;
  status: string;
  due_date: string;
  completed_date: string;
  score: string;
  trainer: string;
}

export interface TrainingReportAnalytics {
  kpis: TrainingReportKpis;
  charts: TrainingReportCharts;
  previewRows: TrainingReportPreviewRow[];
  summary: string;
  filteredCount: number;
}

export interface TrainingReportTemplate {
  id: string;
  name: string;
  report_type: TrainingReportType;
  filters: TrainingReportFilters;
  created_at: string;
  created_by: string;
}

export interface TrainingReportSchedule {
  id: string;
  report_type: TrainingReportType;
  frequency: string;
  email_to: string;
  filters: TrainingReportFilters;
  next_run: string;
  created_at: string;
  created_by: string;
}

export interface TrainingReportDataContext {
  assignments: TrainingAssignment[];
  records: TrainingRecord[];
  effectiveness: TrainingEffectiveness[];
  matrix: TrainingMatrixRow[];
  competency: CompetencyRecord[];
  attendance: TrainingAttendance[];
  certificates: TrainingCertificate[];
  retraining: RetrainingRecord[];
  employeeCount: number;
}

function today() { return new Date().toISOString().split('T')[0]; }

function inRange(dateStr: string | null | undefined, from?: string, to?: string): boolean {
  if (!dateStr) return true;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function canViewTrainingReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa', 'auditor', 'viewer'].includes(r)
    || isTrainingCoordinator(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)
    || ['employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function canGenerateTrainingReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r)
    || isTrainingCoordinator(r)
    || ['department_head', 'production_manager', 'qc_manager', 'engineering_manager', 'warehouse_manager'].includes(r)
    || ['employee', 'production', 'qc', 'warehouse'].includes(r);
}

export function canExportTrainingReports(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(r)
    || isTrainingCoordinator(r)
    || canReviewTraining(r);
}

export function isTrainingReportsReadOnly(role?: string | null): boolean {
  return ['auditor', 'viewer'].includes(normalizeRole(role || ''));
}

export function isEmployeeReportView(role?: string | null): boolean {
  const r = normalizeRole(role || '');
  return ['employee', 'production', 'qc', 'warehouse'].includes(r)
    && !isTrainingCoordinator(r) && !canReviewTraining(r);
}

export function filterReportsByRole(
  ctx: TrainingReportDataContext,
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingReportDataContext {
  const r = normalizeRole(role || '');
  if (['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa', 'auditor', 'viewer'].includes(r)) {
    return ctx;
  }
  if (isTrainingCoordinator(r)) return ctx;

  if (isEmployeeReportView(r) && userId) {
    const filterEmp = <T extends { employee_id: string }>(rows: T[]) => rows.filter((x) => x.employee_id === userId);
    return {
      ...ctx,
      assignments: filterEmp(ctx.assignments),
      records: filterEmp(ctx.records),
      effectiveness: filterEmp(ctx.effectiveness),
      matrix: ctx.matrix.filter((m) => m.employee_id === userId),
      competency: filterEmp(ctx.competency),
      attendance: filterEmp(ctx.attendance),
      certificates: filterEmp(ctx.certificates),
      retraining: filterEmp(ctx.retraining),
      employeeCount: 1,
    };
  }

  if (userDepartment) {
    const dept = userDepartment.toLowerCase();
    const byDept = <T extends { department: string }>(rows: T[]) =>
      rows.filter((x) => x.department?.toLowerCase() === dept);
    const empIdsInDept = new Set(byDept(ctx.assignments).map((a) => a.employee_id));
    return {
      ...ctx,
      assignments: byDept(ctx.assignments),
      records: byDept(ctx.records),
      effectiveness: ctx.effectiveness.filter((e) => empIdsInDept.has(e.employee_id)),
      matrix: byDept(ctx.matrix),
      competency: byDept(ctx.competency),
      attendance: byDept(ctx.attendance),
      certificates: ctx.certificates.filter((c) => empIdsInDept.has(c.employee_id)),
      retraining: ctx.retraining.filter((r) => empIdsInDept.has(r.employee_id)),
      employeeCount: empIdsInDept.size,
    };
  }
  return ctx;
}

export function applyTrainingReportFilters(
  ctx: TrainingReportDataContext,
  filters: TrainingReportFilters,
): TrainingReportDataContext {
  const { assignments, records, effectiveness, matrix, competency, attendance, certificates, retraining } = ctx;
  const q = filters.search?.toLowerCase() || '';

  const filterAssign = assignments.filter((a) => {
    if (filters.department && a.department !== filters.department) return false;
    if (filters.employee_id && a.employee_id !== filters.employee_id) return false;
    if (filters.designation && a.designation !== filters.designation) return false;
    if (filters.training_type && classifyTrainingType(a) !== filters.training_type && a.training_type !== filters.training_type) return false;
    if (filters.trainer && a.trainer_name !== filters.trainer) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.training_mode && a.training_mode !== filters.training_mode) return false;
    if (filters.assessment_result && a.pass_fail !== filters.assessment_result) return false;
    if (!inRange(a.assigned_date, filters.date_from, filters.date_to)
      && !inRange(a.completion_date || undefined, filters.date_from, filters.date_to)) return false;
    if (q && !`${a.employee_name} ${a.training_title} ${a.training_number}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const assignIds = new Set(filterAssign.map((a) => a.id));
  const empIds = new Set(filterAssign.map((a) => a.employee_id));

  return {
    ...ctx,
    assignments: filterAssign,
    records: records.filter((r) => empIds.has(r.employee_id) || assignIds.has(r.assignment_id)),
    effectiveness: effectiveness.filter((e) => assignIds.has(e.assignment_id) || empIds.has(e.employee_id)),
    matrix: matrix.filter((m) => !filters.department || m.department === filters.department),
    competency: competency.filter((c) => empIds.has(c.employee_id) || !filters.employee_id),
    attendance: attendance.filter((a) => assignIds.has(a.assignment_id)),
    certificates: certificates.filter((c) => {
      if (filters.certificate_status === 'expired' && c.expiry_date && c.expiry_date >= today()) return false;
      if (filters.certificate_status === 'active' && c.expiry_date && c.expiry_date < today()) return false;
      return empIds.has(c.employee_id) || !filters.employee_id;
    }),
    retraining: retraining.filter((r) => empIds.has(r.employee_id)),
  };
}

function buildPreviewRows(
  reportType: string,
  ctx: TrainingReportDataContext,
): TrainingReportPreviewRow[] {
  const { assignments, records, effectiveness, competency, certificates, retraining, matrix } = ctx;
  const t = today();

  switch (reportType) {
    case 'Overdue Training Report':
      return assignments.filter((a) => a.status === 'overdue' || isOverdue(a.due_date, a.status)).map((a) => ({
        reference: a.training_number, employee: a.employee_name, department: a.department,
        training: a.training_title, type: classifyTrainingType(a), status: 'Overdue',
        due_date: a.due_date, completed_date: '—', score: '—', trainer: a.trainer_name || '—',
      }));
    case 'Upcoming Training Report': {
      const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 30);
      const end = weekEnd.toISOString().slice(0, 10);
      return assignments.filter((a) =>
        !['completed', 'cancelled'].includes(a.status) && a.due_date >= t && a.due_date <= end,
      ).map((a) => ({
        reference: a.training_number, employee: a.employee_name, department: a.department,
        training: a.training_title, type: classifyTrainingType(a), status: a.status,
        due_date: a.due_date, completed_date: '—', score: '—', trainer: a.trainer_name || '—',
      }));
    }
    case 'Training Effectiveness Report':
      return effectiveness.map((e) => ({
        reference: e.training_number, employee: e.employee_name, department: '—',
        training: e.training_number, type: 'Effectiveness', status: e.effectiveness_result,
        due_date: '—', completed_date: e.evaluated_at?.slice(0, 10) || '—',
        score: e.assessment_score != null ? String(e.assessment_score) : '—', trainer: e.evaluated_by_name,
      }));
    case 'Competency Report':
      return competency.map((c) => ({
        reference: c.id.slice(0, 8), employee: c.employee_name, department: c.department,
        training: c.skill, type: 'Competency', status: c.gap === 'None' ? 'Competent' : 'Gap',
        due_date: '—', completed_date: c.updated_at?.slice(0, 10) || '—',
        score: `${c.current_level}/${c.required_level}`, trainer: '—',
      }));
    case 'Assessment Result Report':
      return records.filter((r) => r.assessment_required).map((r) => ({
        reference: r.training_record_id, employee: r.employee_name, department: r.department,
        training: r.training_topic, type: r.training_type, status: r.training_result,
        due_date: '—', completed_date: r.training_date, score: r.assessment_score != null ? String(r.assessment_score) : '—',
        trainer: r.trainer,
      }));
    case 'Certificate Status Report':
    case 'Certificate Expiry Report':
      return certificates.map((c) => ({
        reference: c.certificate_number, employee: c.employee_name, department: '—',
        training: c.course_title, type: 'Certificate',
        status: !c.expiry_date ? 'Active' : c.expiry_date < t ? 'Expired' : 'Active',
        due_date: c.expiry_date || '—', completed_date: c.issued_date, score: '—', trainer: '—',
      }));
    case 'Retraining Report':
      return retraining.map((r) => ({
        reference: r.retraining_number || r.id.slice(0, 8), employee: r.employee_name, department: r.department || '—',
        training: r.training_topic || r.training_title || '—', type: 'Retraining', status: String(r.retraining_status || r.status || ''),
        due_date: r.due_date, completed_date: r.completion_date || '—', score: r.obtained_score != null ? String(r.obtained_score) : '—', trainer: r.trainer || '—',
      }));
    case 'Training Matrix Coverage Report':
      return matrix.map((m) => ({
        reference: m.employee_id.slice(0, 8), employee: m.employee_name, department: m.department,
        training: `${m.completed_trainings.length}/${m.required_trainings.length} complete`,
        type: 'Matrix', status: `${m.compliance_percent}%`, due_date: '—',
        completed_date: m.updated_at?.slice(0, 10) || '—', score: String(m.compliance_percent), trainer: '—',
      }));
    case 'Department Training Report': {
      const deptMap = new Map<string, { total: number; completed: number }>();
      assignments.forEach((a) => {
        const cur = deptMap.get(a.department) || { total: 0, completed: 0 };
        cur.total++;
        if (a.status === 'completed') cur.completed++;
        deptMap.set(a.department, cur);
      });
      return Array.from(deptMap.entries()).map(([dept, v]) => ({
        reference: dept, employee: '—', department: dept,
        training: `${v.completed}/${v.total} completed`, type: 'Department Summary',
        status: v.total > 0 ? `${Math.round((v.completed / v.total) * 100)}%` : '100%',
        due_date: '—', completed_date: '—', score: '—', trainer: '—',
      }));
    }
    case 'Employee Training History Report':
      return records.map((r) => ({
        reference: r.training_record_id, employee: r.employee_name, department: r.department,
        training: r.training_topic, type: r.training_type, status: r.completion_status,
        due_date: '—', completed_date: r.training_date, score: r.assessment_score != null ? String(r.assessment_score) : '—',
        trainer: r.trainer,
      }));
    case 'Trainer Performance Report': {
      const trainerMap = new Map<string, { sessions: number; pass: number; total: number }>();
      records.forEach((r) => {
        if (!r.trainer) return;
        const cur = trainerMap.get(r.trainer) || { sessions: 0, pass: 0, total: 0 };
        cur.sessions++;
        cur.total++;
        if (r.training_result === 'Pass') cur.pass++;
        trainerMap.set(r.trainer, cur);
      });
      return Array.from(trainerMap.entries()).map(([name, v]) => ({
        reference: name, employee: '—', department: '—', training: `${v.sessions} sessions`,
        type: 'Trainer', status: v.total > 0 ? `${Math.round((v.pass / v.total) * 100)}% pass` : '—',
        due_date: '—', completed_date: '—', score: String(v.pass), trainer: name,
      }));
    }
    case 'Annual GMP Training Report':
      return assignments.filter((a) =>
        classifyTrainingType(a).includes('GMP') || a.training_type?.toLowerCase().includes('gmp'),
      ).map((a) => ({
        reference: a.training_number, employee: a.employee_name, department: a.department,
        training: a.training_title, type: 'GMP', status: a.status,
        due_date: a.due_date, completed_date: a.completion_date || '—',
        score: a.assessment_score != null ? String(a.assessment_score) : '—', trainer: a.trainer_name || '—',
      }));
    case 'Regulatory Inspection Report':
      return [
        ...assignments.filter((a) => a.status === 'overdue' || isOverdue(a.due_date, a.status)).slice(0, 20),
        ...effectiveness.filter((e) => e.effectiveness_result === 'Not Effective').slice(0, 10),
      ].map((item) => {
        const a = item as TrainingAssignment;
        if ('training_title' in a) {
          return {
            reference: a.training_number, employee: a.employee_name, department: a.department,
            training: a.training_title, type: classifyTrainingType(a), status: 'Inspection Risk',
            due_date: a.due_date, completed_date: a.completion_date || '—', score: '—', trainer: a.trainer_name || '—',
          };
        }
        const e = item as TrainingEffectiveness;
        return {
          reference: e.training_number, employee: e.employee_name, department: '—',
          training: e.training_number, type: 'Effectiveness', status: 'Not Effective',
          due_date: '—', completed_date: e.evaluated_at?.slice(0, 10) || '—', score: '—', trainer: e.evaluated_by_name,
        };
      });
    default:
      return assignments.map((a) => ({
        reference: a.training_number, employee: a.employee_name, department: a.department,
        training: a.training_title, type: classifyTrainingType(a), status: a.status,
        due_date: a.due_date, completed_date: a.completion_date || '—',
        score: a.assessment_score != null ? String(a.assessment_score) : '—', trainer: a.trainer_name || '—',
      }));
  }
}

export function computeTrainingReportAnalytics(
  ctx: TrainingReportDataContext,
  filters: TrainingReportFilters,
  reportsGenerated = 0,
): TrainingReportAnalytics {
  const { assignments, records, effectiveness, matrix, competency, certificates, retraining } = ctx;
  const t = today();
  const monthStart = t.slice(0, 7);

  const completed = assignments.filter((a) => a.status === 'completed' || !!a.completion_date).length;
  const compliance = assignments.length > 0 ? Math.round((completed / assignments.length) * 100) : 100;

  const fullyTrained = matrix.filter((m) => m.compliance_percent >= 100).length;
  const overdueEmps = new Set(
    assignments.filter((a) => a.status === 'overdue' || isOverdue(a.due_date, a.status)).map((a) => a.employee_id),
  ).size;

  const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
  const expiring = certificates.filter((c) =>
    c.expiry_date && c.expiry_date >= t && c.expiry_date <= thirtyDays.toISOString().slice(0, 10),
  ).length;

  const retrainDue = retraining.filter((r) => !['Completed', 'Closed'].includes(String(r.retraining_status || r.status))).length
    + assignments.filter((a) => a.status === 'retraining').length;

  const scores = records.filter((r) => r.assessment_score != null).map((r) => r.assessment_score!);
  const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const competent = competency.filter((c) => c.gap === 'None' || c.competency_level === c.required_level).length;
  const compRate = competency.length > 0 ? Math.round((competent / competency.length) * 100) : 100;

  const deptComp = matrix.length > 0
    ? Math.round(matrix.reduce((s, m) => s + m.compliance_percent, 0) / matrix.length) : compliance;

  const monthCompleted = assignments.filter((a) => a.completion_date?.startsWith(monthStart)).length;
  const monthAssigned = assignments.filter((a) => a.assigned_date?.startsWith(monthStart)).length;
  const monthCompPct = monthAssigned > 0 ? Math.round((monthCompleted / monthAssigned) * 100) : 0;

  const monthlyCompletion: Record<string, number> = {};
  const overdueTrend: Record<string, number> = {};
  const typeDist: Record<string, number> = {};
  const certExpiry: Record<string, number> = {};
  const retrainTrend: Record<string, number> = {};
  const scoreTrend: Record<string, { total: number; count: number }> = {};
  const trainerPerf: Record<string, { sessions: number; pass: number; total: number }> = {};
  const compDist: Record<string, number> = {};

  assignments.forEach((a) => {
    typeDist[classifyTrainingType(a)] = (typeDist[classifyTrainingType(a)] || 0) + 1;
    if (a.completion_date) monthlyCompletion[a.completion_date.slice(0, 7)] = (monthlyCompletion[a.completion_date.slice(0, 7)] || 0) + 1;
    if (a.status === 'overdue' || isOverdue(a.due_date, a.status)) {
      overdueTrend[a.due_date.slice(0, 7)] = (overdueTrend[a.due_date.slice(0, 7)] || 0) + 1;
    }
  });

  certificates.forEach((c) => {
    if (c.expiry_date) certExpiry[c.expiry_date.slice(0, 7)] = (certExpiry[c.expiry_date.slice(0, 7)] || 0) + 1;
  });

  retraining.forEach((r) => {
    retrainTrend[r.created_at.slice(0, 7)] = (retrainTrend[r.created_at.slice(0, 7)] || 0) + 1;
  });

  records.forEach((r) => {
    if (r.assessment_score != null) {
      const m = r.training_date.slice(0, 7);
      if (!scoreTrend[m]) scoreTrend[m] = { total: 0, count: 0 };
      scoreTrend[m].total += r.assessment_score;
      scoreTrend[m].count++;
    }
    if (r.trainer) {
      if (!trainerPerf[r.trainer]) trainerPerf[r.trainer] = { sessions: 0, pass: 0, total: 0 };
      trainerPerf[r.trainer].sessions++;
      trainerPerf[r.trainer].total++;
      if (r.training_result === 'Pass') trainerPerf[r.trainer].pass++;
    }
  });

  competency.forEach((c) => {
    compDist[c.gap === 'None' ? 'Competent' : 'Gap Identified'] = (compDist[c.gap === 'None' ? 'Competent' : 'Gap Identified'] || 0) + 1;
  });

  const passCount = records.filter((r) => r.training_result === 'Pass').length;
  const failCount = records.filter((r) => r.training_result === 'Fail').length;

  const deptMap: Record<string, { total: number; count: number }> = {};
  matrix.forEach((m) => {
    if (!deptMap[m.department]) deptMap[m.department] = { total: 0, count: 0 };
    deptMap[m.department].total += m.compliance_percent;
    deptMap[m.department].count++;
  });

  const reportType = filters.report_type || 'Training Compliance Report';
  const previewRows = buildPreviewRows(reportType, ctx);

  return {
    kpis: {
      totalReportsGenerated: reportsGenerated,
      trainingCompliancePercent: compliance,
      employeesFullyTrained: fullyTrained,
      employeesOverdue: overdueEmps,
      certificatesExpiring: expiring,
      retrainingDue: retrainDue,
      averageAssessmentScore: avgScore,
      competencyRate: compRate,
      departmentCompliance: deptComp,
      monthlyCompletionPercent: monthCompPct,
    },
    charts: {
      monthlyCompletionTrend: Object.entries(monthlyCompletion).sort().map(([month, count]) => ({ month, count })),
      departmentCompliance: Object.entries(deptMap).map(([name, v]) => ({
        name, value: v.count > 0 ? Math.round(v.total / v.count) : 0,
      })),
      passVsFail: [{ name: 'Pass', value: passCount }, { name: 'Fail', value: failCount }],
      competencyDistribution: Object.entries(compDist).map(([name, value]) => ({ name, value })),
      certificateExpiryTrend: Object.entries(certExpiry).sort().map(([month, count]) => ({ month, count })),
      retrainingTrend: Object.entries(retrainTrend).sort().map(([month, count]) => ({ month, count })),
      trainingTypeDistribution: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
      trainerPerformance: Object.entries(trainerPerf).slice(0, 8).map(([name, v]) => ({
        name, sessions: v.sessions, passRate: v.total > 0 ? Math.round((v.pass / v.total) * 100) : 0,
      })),
      assessmentScoreTrend: Object.entries(scoreTrend).sort().map(([month, v]) => ({
        month, avgScore: v.count > 0 ? Math.round(v.total / v.count) : 0,
      })),
      overdueTrend: Object.entries(overdueTrend).sort().map(([month, count]) => ({ month, count })),
    },
    previewRows,
    summary: `${reportType}: ${previewRows.length} records · Compliance ${compliance}% · ${overdueEmps} employees overdue · ${expiring} certificates expiring within 30 days.`,
    filteredCount: previewRows.length,
  };
}

export function exportTrainingReportCsv(rows: TrainingReportPreviewRow[]): { headers: string[]; rows: string[][] } {
  const headers = ['Reference', 'Employee', 'Department', 'Training', 'Type', 'Status', 'Due Date', 'Completed', 'Score', 'Trainer'];
  return {
    headers,
    rows: rows.map((r) => [
      r.reference, r.employee, r.department, r.training, r.type, r.status,
      r.due_date, r.completed_date, r.score, r.trainer,
    ]),
  };
}

export function reportStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('overdue') || s.includes('fail') || s.includes('expired') || s.includes('gap')) {
    return 'bg-red-100 text-red-800';
  }
  if (s.includes('complete') || s.includes('pass') || s.includes('effective') || s.includes('competent') || s.includes('100')) {
    return 'bg-green-100 text-green-800';
  }
  if (s.includes('pending') || s.includes('progress')) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}
