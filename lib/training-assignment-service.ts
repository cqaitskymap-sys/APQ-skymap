import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import {
  listAssignments, createAssignment, bulkAssignTraining, assignByDepartment,
  assignFromMatrix, scheduleTrainingSession, syncDmsTrainingLinks, syncOverdueAssignments,
  getTrainingCalendar, cancelAssignment, exportAssignmentsCsv, listEmployees,
  listTrainingMaster, createTrainingMaster,
} from '@/lib/training-service';
import type { TmsActor } from '@/lib/training-types';
import {
  TRAINING_ASSIGNMENT_MODULE, ASSIGNMENTS_COLLECTION,
  type AssignmentFilters, type AssignmentActor, type AssignmentDashboardData,
  type TrainingAssignment,
} from '@/lib/training-assignment-types';
import type {
  CreateAssignmentInput, BulkAssignmentInput, DepartmentAssignmentInput, ScheduleSessionInput,
} from '@/lib/training-assignment-schemas';
import type { TrainingMasterInput } from '@/lib/training-schemas';
import {
  filterAssignmentsByRole, filterCalendarByRole,
  applyAssignmentFilters, computeAssignmentDashboard,
} from '@/lib/training-assignment-records';

export type { AssignmentFilters, AssignmentActor, AssignmentDashboardData, TrainingAssignment };

function toTmsActor(actor: AssignmentActor): TmsActor {
  return { id: actor.id, name: actor.name, role: actor.role || '' };
}

async function audit(actor: AssignmentActor, action: string, recordId: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, recordId, ASSIGNMENTS_COLLECTION, null, detail,
    { moduleName: TRAINING_ASSIGNMENT_MODULE },
  );
}

export async function fetchAssignmentDashboard(input: {
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: AssignmentFilters;
}): Promise<AssignmentDashboardData> {
  await syncOverdueAssignments();
  const [assignments, calendar] = await Promise.all([
    listAssignments(),
    getTrainingCalendar(),
  ]);

  let scoped = filterAssignmentsByRole(assignments, input.role, input.userId, input.userDepartment);
  scoped = applyAssignmentFilters(scoped, input.filters || {});
  const scopedIds = new Set(scoped.map((a) => a.id));
  const scopedCalendar = filterCalendarByRole(calendar, scopedIds);

  return computeAssignmentDashboard(scoped, scopedCalendar);
}

export async function assignTraining(
  input: CreateAssignmentInput,
  actor: AssignmentActor,
): Promise<TrainingAssignment> {
  const result = await createAssignment(input, toTmsActor(actor));
  await audit(actor, 'Training Assigned', result.id, { employee: result.employee_name, topic: result.training_title });
  return result;
}

export async function bulkAssign(
  input: BulkAssignmentInput,
  actor: AssignmentActor,
): Promise<TrainingAssignment[]> {
  const results = await bulkAssignTraining(input, toTmsActor(actor));
  await audit(actor, 'Bulk Assignment', input.training_master_id, { count: results.length });
  return results;
}

export async function assignDepartmentTraining(
  input: DepartmentAssignmentInput,
  actor: AssignmentActor,
): Promise<TrainingAssignment[]> {
  const results = await assignByDepartment(input, toTmsActor(actor));
  await audit(actor, 'Department Assignment', input.department, { count: results.length });
  return results;
}

export async function assignFromTrainingMatrix(actor: AssignmentActor): Promise<number> {
  const count = await assignFromMatrix(toTmsActor(actor));
  await audit(actor, 'Matrix Auto-Assign', 'matrix', { count });
  return count;
}

export async function scheduleSession(
  input: ScheduleSessionInput,
  actor: AssignmentActor,
): Promise<{ assignments: TrainingAssignment[] }> {
  const { assignments } = await scheduleTrainingSession(input, toTmsActor(actor));
  await audit(actor, 'Session Scheduled', input.training_master_id, {
    date: input.scheduled_date, count: assignments.length,
  });
  return { assignments };
}

export async function syncSopRetraining(actor: AssignmentActor): Promise<number> {
  const count = await syncDmsTrainingLinks(toTmsActor(actor));
  await audit(actor, 'SOP Retraining Sync', 'dms-links', { count });
  return count;
}

export async function cancelTrainingAssignment(
  id: string,
  actor: AssignmentActor,
  remarks = '',
): Promise<TrainingAssignment> {
  const result = await cancelAssignment(id, toTmsActor(actor), remarks);
  await audit(actor, 'Assignment Cancelled', id, { remarks });
  return result;
}

export async function createMaster(
  input: TrainingMasterInput,
  actor: AssignmentActor,
) {
  const result = await createTrainingMaster(input, toTmsActor(actor));
  await audit(actor, 'Training Master Created', result.id, { title: result.training_title });
  return result;
}

export function exportAssignmentList(assignments: TrainingAssignment[]) {
  exportAssignmentsCsv(assignments);
}

export function openAssignmentPrint(assignments: TrainingAssignment[]) {
  const rows = assignments.map((a) => `
    <tr><td>${a.training_number}</td><td>${a.employee_name}</td><td>${a.department}</td>
    <td>${a.training_topic || a.training_title}</td><td>${a.assigned_date}</td><td>${a.due_date}</td>
    <td>${a.training_mode || '—'}</td><td>${a.trainer_name}</td><td>${a.training_status || a.status}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Training Assignments</title>
<style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #ccc;padding:6px}th{background:#2563eb;color:#fff}</style></head>
<body><h1>Training Assignment & Scheduling Report</h1><p>Generated: ${new Date().toISOString()}</p>
<table><thead><tr><th>Training #</th><th>Employee</th><th>Dept</th><th>Topic</th><th>Assigned</th><th>Due</th><th>Mode</th><th>Trainer</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export async function logAssignmentExport(actor: AssignmentActor, count: number) {
  await audit(actor, 'Export', 'assignments-export', { count });
}

export { listEmployees, listTrainingMaster };
