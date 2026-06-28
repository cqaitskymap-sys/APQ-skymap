import { normalizeRole } from '@/lib/permissions';
import type { TrainingAssignment, TrainingCalendarEvent } from '@/lib/training-types';
import { getAssignmentDisplayStatus } from '@/lib/training-types';
import {
  type AssignmentFilters, type AssignmentDashboardData,
  canManageAssignments, canAssignAssignments,
  isEmployeeAssignmentView, isDepartmentAssignmentView, isOverdueAssignment,
} from './training-assignment-types';

export function filterAssignmentsByRole(
  assignments: TrainingAssignment[],
  role?: string | null,
  userId?: string,
  userDepartment?: string,
): TrainingAssignment[] {
  const r = normalizeRole(role || '');
  if (canManageAssignments(r) || canAssignAssignments(r) || ['auditor', 'viewer'].includes(r)) {
    if (isDepartmentAssignmentView(r) && userDepartment) {
      return assignments.filter((a) => a.department?.toLowerCase() === userDepartment.toLowerCase());
    }
    return assignments;
  }
  if (isEmployeeAssignmentView(r) && userId) {
    return assignments.filter((a) => a.employee_id === userId);
  }
  return assignments;
}

export function filterCalendarByRole(
  events: TrainingCalendarEvent[],
  scopedAssignmentIds: Set<string>,
): TrainingCalendarEvent[] {
  return events.filter((e) => scopedAssignmentIds.has(e.id));
}

export function applyAssignmentFilters(
  assignments: TrainingAssignment[],
  filters: AssignmentFilters,
): TrainingAssignment[] {
  const q = filters.search?.toLowerCase() || '';
  return assignments.filter((a) => {
    const status = getAssignmentDisplayStatus(a);
    const matchSearch = !q
      || a.training_number.toLowerCase().includes(q)
      || a.employee_name.toLowerCase().includes(q)
      || (a.training_topic || a.training_title).toLowerCase().includes(q);
    const matchDept = !filters.department || a.department === filters.department;
    const matchEmp = !filters.employee_id || a.employee_id === filters.employee_id;
    const matchType = !filters.training_type || a.training_type === filters.training_type;
    const matchStatus = !filters.training_status || status === filters.training_status;
    const matchMode = !filters.training_mode || a.training_mode === filters.training_mode;
    const matchTrainer = !filters.trainer || a.trainer_name === filters.trainer;
    const matchSource = !filters.source || a.source === filters.source;
    const matchFrom = !filters.date_from || a.assigned_date >= filters.date_from;
    const matchTo = !filters.date_to || a.due_date <= filters.date_to;
    return matchSearch && matchDept && matchEmp && matchType && matchStatus
      && matchMode && matchTrainer && matchSource && matchFrom && matchTo;
  });
}

export function computeAssignmentDashboard(
  assignments: TrainingAssignment[],
  calendar: TrainingCalendarEvent[],
): AssignmentDashboardData {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const statusMap: Record<string, number> = {};
  const deptMap: Record<string, number> = {};
  const modeMap: Record<string, number> = {};
  const trend: Record<string, number> = {};

  let assigned = 0;
  let inProgress = 0;
  let completed = 0;
  let overdue = 0;
  let dueThisWeek = 0;
  let fromMatrix = 0;
  let sopRetraining = 0;

  assignments.forEach((a) => {
    const status = getAssignmentDisplayStatus(a);
    statusMap[status] = (statusMap[status] || 0) + 1;
    deptMap[a.department] = (deptMap[a.department] || 0) + 1;
    const mode = String(a.training_mode || 'Classroom');
    modeMap[mode] = (modeMap[mode] || 0) + 1;
    if (a.assigned_date) trend[a.assigned_date.slice(0, 7)] = (trend[a.assigned_date.slice(0, 7)] || 0) + 1;

    if (status === 'Assigned') assigned++;
    if (status === 'In Progress') inProgress++;
    if (status === 'Completed') completed++;
    if (status === 'Overdue' || isOverdueAssignment(a)) overdue++;
    if (a.due_date >= todayStr && a.due_date <= weekEndStr && status !== 'Completed') dueThisWeek++;
    if (['matrix', 'matrix_new_user', 'matrix_refresher'].includes(String(a.source))) fromMatrix++;
    if (['dms_revision', 'sop_revision'].includes(String(a.source))) sopRetraining++;
  });

  const upcomingDue = assignments
    .filter((a) => !['completed', 'cancelled'].includes(String(a.status)) && a.due_date >= todayStr)
    .sort((x, y) => x.due_date.localeCompare(y.due_date))
    .slice(0, 10);

  return {
    kpis: {
      totalAssignments: assignments.length,
      assigned,
      inProgress,
      completed,
      overdue,
      dueThisWeek,
      fromMatrix,
      sopRetraining,
    },
    charts: {
      statusDistribution: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
      departmentAssignments: Object.entries(deptMap).map(([name, value]) => ({ name, value })),
      assignmentTrend: Object.entries(trend).sort().map(([month, count]) => ({ month, count })),
      modeDistribution: Object.entries(modeMap).map(([name, value]) => ({ name, value })),
    },
    assignments,
    calendar,
    upcomingDue,
  };
}
