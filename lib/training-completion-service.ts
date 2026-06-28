import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { TMS_COLLECTIONS } from '@/lib/training-types';
import {
  listAttendance, listTrainingRecords, listAssignments, listTrainingMaster,
  recordAttendance, completeTraining, uploadCompletionEvidence,
  exportAttendanceCsv, exportTrainingRecordsCsv, getTrainingMasterById, getAssignmentById,
} from '@/lib/training-service';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import {
  TRAINING_COMPLETION_MODULE, ATTENDANCE_COLLECTION, RECORDS_COLLECTION,
  type CompletionFilters, type CompletionActor, type CompletionDashboardData,
  type TrainingRecord, type TrainingAttendance,
} from '@/lib/training-completion-types';
import type { MarkAttendanceInput, CompleteTrainingInput, QaReviewInput } from '@/lib/training-completion-schemas';
import { markAttendanceSchema, completeTrainingSchema, qaReviewSchema } from '@/lib/training-completion-schemas';
import {
  filterAttendanceByRole, filterRecordsByRole, filterAssignmentsByRole,
  applyCompletionFilters, computeCompletionDashboard,
} from '@/lib/training-completion-records';

export type { CompletionFilters, CompletionActor, CompletionDashboardData, TrainingRecord, TrainingAttendance };

function now() { return new Date().toISOString(); }

async function audit(actor: CompletionActor, action: string, recordId: string, detail?: unknown, collection = RECORDS_COLLECTION) {
  await logTrainingAuditRecord(
    actor, action, recordId, collection, null, detail,
    { moduleName: TRAINING_COMPLETION_MODULE },
  );
}

export async function fetchCompletionDashboard(input: {
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: CompletionFilters;
}): Promise<CompletionDashboardData> {
  const [attendance, records, assignments] = await Promise.all([
    listAttendance(),
    listTrainingRecords(),
    listAssignments(),
  ]);

  let scopedAtt = filterAttendanceByRole(attendance, input.role, input.userId, input.userDepartment);
  let scopedRec = filterRecordsByRole(records, input.role, input.userId, input.userDepartment);
  const open = filterAssignmentsByRole(assignments, input.role, input.userId, input.userDepartment);

  const filtered = applyCompletionFilters(scopedAtt, scopedRec, input.filters || {});
  return computeCompletionDashboard(filtered.attendance, filtered.records, open);
}

function toTmsActor(actor: CompletionActor) {
  return { id: actor.id, name: actor.name, role: actor.role || '' };
}

export async function markTrainingAttendance(
  input: MarkAttendanceInput,
  actor: CompletionActor,
): Promise<TrainingAttendance> {
  const parsed = markAttendanceSchema.parse(input);
  const result = await recordAttendance(parsed, toTmsActor(actor));
  await audit(actor, 'Attendance Recorded', result.id, {
    assignment_id: parsed.assignment_id,
    status: parsed.attendance_status,
  }, ATTENDANCE_COLLECTION);
  return result;
}

export async function completeTrainingRecord(
  input: CompleteTrainingInput,
  actor: CompletionActor,
  evidenceFile?: File | null,
): Promise<TrainingRecord> {
  const parsed = completeTrainingSchema.parse(input);
  const assignment = await getAssignmentById(parsed.assignment_id);
  if (!assignment) throw new Error('Training assignment not found');
  const master = await getTrainingMasterById(assignment.training_master_id);
  const assessmentRequired = master?.assessment_required ?? parsed.assessment_required;
  const passMarks = master?.passing_percentage ?? parsed.pass_marks;

  const { assessment_required: _ar, pass_marks: _pm, ...completionPayload } = parsed;
  const record = await completeTraining(completionPayload, toTmsActor(actor), { assessmentRequired, passMarks });

  if (evidenceFile) {
    await uploadCompletionEvidence(record.id, evidenceFile, toTmsActor(actor));
    await audit(actor, 'Evidence Uploaded', record.id, { file: evidenceFile.name });
  }

  await audit(actor, 'Training Completed', record.id, {
    result: record.training_result,
    assignment_id: parsed.assignment_id,
    score: record.assessment_score,
  });

  return record;
}

export async function qaReviewCompletion(
  input: QaReviewInput,
  actor: CompletionActor,
): Promise<void> {
  const parsed = qaReviewSchema.parse(input);
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.records, parsed.record_id), {
    qa_review_status: parsed.action === 'approve' ? 'Approved' : 'Rejected',
    qa_review_remarks: parsed.remarks,
    qa_reviewed_by: actor.name,
    qa_reviewed_at: now(),
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, parsed.action === 'approve' ? 'QA Approved Completion' : 'QA Rejected Completion',
    parsed.record_id, parsed);
}

export function exportCompletionAttendanceCsv(records: TrainingAttendance[]) {
  exportAttendanceCsv(records);
}

export function exportCompletionRecordsCsv(records: TrainingRecord[]) {
  exportTrainingRecordsCsv(records);
}

export function openCompletionPrint(records: TrainingRecord[], attendance: TrainingAttendance[]) {
  const recRows = records.map((r) => `
    <tr><td>${r.training_record_id}</td><td>${r.employee_name}</td><td>${r.training_topic}</td>
    <td>${r.training_date}</td><td>${r.attendance_status}</td><td>${r.completion_status}</td>
    <td>${r.training_result}</td><td>${r.assessment_score ?? '—'}</td></tr>`).join('');
  const attRows = attendance.map((a) => `
    <tr><td>${a.training_number}</td><td>${a.employee_name}</td><td>${a.training_date}</td>
    <td>${a.attendance_status}</td><td>${a.trainer}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Training Completion & Attendance</title>
<style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:24px}
th,td{border:1px solid #ccc;padding:6px}th{background:#2563eb;color:#fff}h2{font-size:14px;margin-top:20px}</style></head>
<body><h1>Training Completion & Attendance Report</h1><p>Generated: ${now()}</p>
<h2>Completion Records</h2>
<table><thead><tr><th>Record ID</th><th>Employee</th><th>Topic</th><th>Date</th><th>Attendance</th><th>Status</th><th>Result</th><th>Score</th></tr></thead>
<tbody>${recRows}</tbody></table>
<h2>Attendance Log</h2>
<table><thead><tr><th>Training #</th><th>Employee</th><th>Date</th><th>Status</th><th>Trainer</th></tr></thead>
<tbody>${attRows}</tbody></table>
<p><em>GMP Compliant | 21 CFR Part 11 Ready</em></p></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export async function logCompletionExport(actor: CompletionActor, count: number, type: string) {
  await audit(actor, 'Export', `completion-${type}`, { count });
}

export { listTrainingMaster };
