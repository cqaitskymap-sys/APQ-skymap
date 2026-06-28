import { normalizeRole } from '@/lib/permissions';
import type { TrainingAttendance, TrainingRecord, TrainingAssignment } from '@/lib/training-types';
import {
  type CompletionFilters, type CompletionDashboardData,
  canManageCompletion, canApproveCompletion, canMarkCompletionAttendance,
  isEmployeeCompletionView, isDepartmentCompletionView, openAssignmentStatuses,
} from './training-completion-types';

export function filterAttendanceByRole(
  records: TrainingAttendance[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingAttendance[] {
  const r = normalizeRole(role || '');
  if (canManageCompletion(r) || canApproveCompletion(r) || canMarkCompletionAttendance(r) || ['auditor', 'viewer'].includes(r)) {
    if (isDepartmentCompletionView(r) && userDepartment) {
      return records.filter((rec) => rec.department?.toLowerCase() === userDepartment.toLowerCase());
    }
    return records;
  }
  if (isEmployeeCompletionView(r) && userId) {
    return records.filter((rec) => rec.employee_id === userId);
  }
  return records;
}

export function filterRecordsByRole(
  records: TrainingRecord[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingRecord[] {
  const r = normalizeRole(role || '');
  if (canManageCompletion(r) || canApproveCompletion(r) || canMarkCompletionAttendance(r) || ['auditor', 'viewer'].includes(r)) {
    if (isDepartmentCompletionView(r) && userDepartment) {
      return records.filter((rec) => rec.department?.toLowerCase() === userDepartment.toLowerCase());
    }
    return records;
  }
  if (isEmployeeCompletionView(r) && userId) {
    return records.filter((rec) => rec.employee_id === userId);
  }
  return records;
}

export function filterAssignmentsByRole(
  assignments: TrainingAssignment[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingAssignment[] {
  const r = normalizeRole(role || '');
  let scoped = assignments.filter((a) => openAssignmentStatuses().includes(a.status));
  if (isEmployeeCompletionView(r) && userId) {
    scoped = scoped.filter((a) => a.employee_id === userId);
  } else if (isDepartmentCompletionView(r) && userDepartment) {
    scoped = scoped.filter((a) => a.department?.toLowerCase() === userDepartment.toLowerCase());
  }
  return scoped;
}

export function applyCompletionFilters(
  attendance: TrainingAttendance[],
  records: TrainingRecord[],
  filters: CompletionFilters,
): { attendance: TrainingAttendance[]; records: TrainingRecord[] } {
  const q = filters.search?.toLowerCase() || '';
  const matchCommon = (topic: string, num: string, emp: string, dept: string) => {
    const matchSearch = !q || num.toLowerCase().includes(q) || emp.toLowerCase().includes(q) || topic.toLowerCase().includes(q);
    const matchDept = !filters.department || dept === filters.department;
    return matchSearch && matchDept;
  };

  const filteredAttendance = attendance.filter((r) => {
    const matchEmp = !filters.employee_id || r.employee_id === filters.employee_id;
    const matchStatus = !filters.attendance_status || r.attendance_status === filters.attendance_status;
    const matchTrainer = !filters.trainer || r.trainer === filters.trainer;
    const matchFrom = !filters.date_from || r.training_date >= filters.date_from;
    const matchTo = !filters.date_to || r.training_date <= filters.date_to;
    return matchCommon(r.training_topic, r.training_number, r.employee_name, r.department)
      && matchEmp && matchStatus && matchTrainer && matchFrom && matchTo;
  });

  const filteredRecords = records.filter((r) => {
    const matchEmp = !filters.employee_id || r.employee_id === filters.employee_id;
    const matchCompletion = !filters.completion_status || r.completion_status === filters.completion_status;
    const matchResult = !filters.training_result || r.training_result === filters.training_result;
    const matchTrainer = !filters.trainer || r.trainer === filters.trainer;
    const matchFrom = !filters.date_from || r.training_date >= filters.date_from;
    const matchTo = !filters.date_to || r.training_date <= filters.date_to;
    return matchCommon(r.training_topic, r.training_number, r.employee_name, r.department)
      && matchEmp && matchCompletion && matchResult && matchTrainer && matchFrom && matchTo;
  });

  return { attendance: filteredAttendance, records: filteredRecords };
}

export function computeCompletionDashboard(
  attendance: TrainingAttendance[],
  records: TrainingRecord[],
  openAssignments: TrainingAssignment[],
): CompletionDashboardData {
  const completed = records.filter((r) => r.completion_status === 'Completed');
  const failed = records.filter((r) => r.completion_status === 'Failed' || r.training_result === 'Fail');
  const inProgress = records.filter((r) => r.completion_status === 'In Progress');
  const absent = attendance.filter((a) => a.attendance_status === 'Absent');
  const passed = records.filter((r) => r.training_result === 'Pass');
  const assessed = records.filter((r) => r.training_result === 'Pass' || r.training_result === 'Fail');
  const passRate = assessed.length > 0 ? Math.round((passed.length / assessed.length) * 100) : 100;

  const passFail = [
    { name: 'Pass', value: passed.length },
    { name: 'Fail', value: records.filter((r) => r.training_result === 'Fail').length },
    { name: 'N/A', value: records.filter((r) => r.training_result === 'Not Applicable').length },
  ];

  const attMap: Record<string, number> = {};
  const trend: Record<string, number> = {};
  const deptMap: Record<string, { done: number; total: number }> = {};

  attendance.forEach((a) => {
    attMap[String(a.attendance_status)] = (attMap[String(a.attendance_status)] || 0) + 1;
  });

  records.forEach((r) => {
    if (r.training_date) trend[r.training_date.slice(0, 7)] = (trend[r.training_date.slice(0, 7)] || 0) + 1;
    if (!deptMap[r.department]) deptMap[r.department] = { done: 0, total: 0 };
    deptMap[r.department].total++;
    if (r.completion_status === 'Completed') deptMap[r.department].done++;
  });

  return {
    kpis: {
      totalRecords: records.length,
      completed: completed.length,
      failed: failed.length,
      inProgress: inProgress.length,
      pendingCompletion: openAssignments.length,
      attendanceLogged: attendance.length,
      absentCount: absent.length,
      passRate,
    },
    charts: {
      passVsFail: passFail,
      attendanceStatus: Object.entries(attMap).map(([name, value]) => ({ name, value })),
      completionTrend: Object.entries(trend).sort().map(([month, count]) => ({ month, count })),
      departmentCompletion: Object.entries(deptMap).map(([name, v]) => ({
        name, value: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
      })),
    },
    attendance,
    records,
    openAssignments,
    pendingEffectiveness: completed.filter((r) => r.training_result === 'Pass' || r.training_result === 'Not Applicable'),
  };
}
