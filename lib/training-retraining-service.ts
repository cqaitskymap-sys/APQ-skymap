import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { TMS_COLLECTIONS } from '@/lib/training-types';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import { listEmployees } from '@/lib/training-service';
import {
  TRAINING_RETRAINING_MODULE, RETRAINING_COLLECTION,
  generateRetrainingNumber, computeRetrainingStatus,
  type RetrainingRecord, type RetrainingFilters, type RetrainingActor,
  type RetrainingDashboardData,
} from '@/lib/training-retraining-types';
import type {
  CreateRetrainingInput, ScheduleRetrainingInput, CompleteRetrainingInput, BulkAssignRetrainingInput,
} from '@/lib/training-retraining-schemas';
import { createRetrainingSchema } from '@/lib/training-retraining-schemas';
import {
  filterRetrainingByRole, applyRetrainingFilters, computeRetrainingDashboard,
} from '@/lib/training-retraining-records';

export type { RetrainingRecord, RetrainingFilters, RetrainingActor, RetrainingDashboardData };

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function db() { return getFirebaseFirestore(); }

export function mapRetraining(id: string, data: Record<string, unknown>): RetrainingRecord {
  const topic = String(data.training_topic || data.training_title || '');
  const status = computeRetrainingStatus(
    String(data.due_date || ''),
    String(data.retraining_status || data.status || 'Assigned'),
    data.completion_date ? String(data.completion_date) : null,
  );
  return {
    id,
    retraining_id: String(data.retraining_id || id),
    retraining_number: String(data.retraining_number || `RTR-${id.slice(0, 8)}`),
    employee_id: String(data.employee_id || ''),
    employee_name: String(data.employee_name || ''),
    department: String(data.department || ''),
    designation: String(data.designation || ''),
    training_topic: topic,
    training_type: String(data.training_type || 'GMP Training'),
    original_training_id: String(data.original_training_id || data.original_assignment_id || ''),
    original_completion_date: data.original_completion_date ? String(data.original_completion_date) : null,
    trigger_type: String(data.trigger_type || 'Management Decision'),
    trigger_reference: String(data.trigger_reference || ''),
    document_number: String(data.document_number || ''),
    document_version: String(data.document_version || ''),
    sop_number: String(data.sop_number || data.document_number || ''),
    reason: String(data.reason || ''),
    assigned_date: String(data.assigned_date || data.created_at?.toString().slice(0, 10) || today()),
    due_date: String(data.due_date || ''),
    trainer: String(data.trainer || ''),
    training_mode: String(data.training_mode || 'Classroom'),
    assessment_required: Boolean(data.assessment_required ?? true),
    passing_score: Number(data.passing_score ?? 80),
    obtained_score: data.obtained_score != null ? Number(data.obtained_score) : null,
    result: String(data.result || ''),
    competency_status: String(data.competency_status || ''),
    retraining_status: status,
    completion_date: data.completion_date ? String(data.completion_date) : null,
    certificate_issued: Boolean(data.certificate_issued ?? false),
    certificate_number: data.certificate_number ? String(data.certificate_number) : null,
    scheduled_event_id: data.scheduled_event_id ? String(data.scheduled_event_id) : null,
    remarks: String(data.remarks || ''),
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    created_by: String(data.created_by || ''),
    created_by_name: String(data.created_by_name || ''),
    updated_by: String(data.updated_by || ''),
    updated_by_name: String(data.updated_by_name || ''),
    original_assignment_id: data.original_assignment_id ? String(data.original_assignment_id) : undefined,
    training_title: data.training_title ? String(data.training_title) : undefined,
    status: String(status),
  };
}

async function audit(actor: RetrainingActor, action: string, recordId: string, detail?: unknown) {
  await logTrainingAuditRecord(
    actor, action, recordId, RETRAINING_COLLECTION, null, detail,
    { moduleName: TRAINING_RETRAINING_MODULE },
  );
}

async function notify(title: string, message: string, recordId: string, roles: string[], userId?: string) {
  if (userId) {
    try {
      await addDoc(collection(db(), TMS_COLLECTIONS.notifications), {
        title, message, module: TRAINING_RETRAINING_MODULE, record_id: recordId,
        target_user_id: userId, read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
  for (const role of roles) {
    try {
      await addDoc(collection(db(), TMS_COLLECTIONS.notifications), {
        title, message, module: TRAINING_RETRAINING_MODULE, record_id: recordId,
        target_role: role, read: false, created_at: now(),
      });
    } catch { /* optional */ }
  }
}

export async function listRetrainingRecords(max = 500): Promise<RetrainingRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(db(), RETRAINING_COLLECTION),
      orderBy('created_at', 'desc'),
      limit(max),
    ));
    return snap.docs.map((d) => mapRetraining(d.id, d.data()));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(db(), RETRAINING_COLLECTION),
        orderBy('due_date', 'asc'),
        limit(max),
      ));
      return snap.docs.map((d) => mapRetraining(d.id, d.data()));
    } catch {
      const snap = await getDocs(query(collection(db(), RETRAINING_COLLECTION), limit(max)));
      return snap.docs.map((d) => mapRetraining(d.id, d.data()))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }
}

export async function getRetrainingById(id: string): Promise<RetrainingRecord | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(db(), RETRAINING_COLLECTION, id));
  if (!snap.exists()) return null;
  return mapRetraining(snap.id, snap.data());
}

export async function fetchRetrainingDashboard(input: {
  role?: string | null;
  userId?: string;
  userDepartment?: string;
  filters?: RetrainingFilters;
}): Promise<RetrainingDashboardData> {
  const all = await listRetrainingRecords();
  const scoped = filterRetrainingByRole(all, input.role, input.userId, input.userDepartment);
  const filtered = applyRetrainingFilters(scoped, input.filters || {});
  return computeRetrainingDashboard(filtered);
}

function buildRetrainingPayload(
  input: CreateRetrainingInput,
  actor: RetrainingActor,
  retrainingNumber: string,
  status = 'Assigned',
) {
  const timestamp = now();
  return {
    retraining_id: '',
    retraining_number: retrainingNumber,
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    department: input.department,
    designation: input.designation,
    training_topic: input.training_topic,
    training_title: input.training_topic,
    training_type: input.training_type,
    original_training_id: input.original_training_id,
    original_assignment_id: input.original_training_id,
    original_completion_date: input.original_completion_date || null,
    trigger_type: input.trigger_type,
    trigger_reference: input.trigger_reference,
    document_number: input.document_number,
    document_version: input.document_version,
    sop_number: input.sop_number,
    reason: input.reason,
    assigned_date: input.assigned_date || today(),
    due_date: input.due_date,
    trainer: input.trainer,
    training_mode: input.training_mode,
    assessment_required: input.assessment_required,
    passing_score: input.passing_score,
    obtained_score: null,
    result: '',
    competency_status: '',
    retraining_status: status,
    status,
    completion_date: null,
    certificate_issued: false,
    certificate_number: null,
    scheduled_event_id: null,
    remarks: input.remarks,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
}

export async function createRetraining(
  input: CreateRetrainingInput,
  actor: RetrainingActor,
): Promise<RetrainingRecord> {
  const parsed = createRetrainingSchema.parse(input);
  const retrainingNumber = generateRetrainingNumber();
  const payload = buildRetrainingPayload(parsed, actor, retrainingNumber);
  const ref = await addDoc(collection(db(), RETRAINING_COLLECTION), payload);
  await updateDoc(ref, { retraining_id: ref.id });
  await audit(actor, 'Retraining Created', ref.id, { retraining_number: retrainingNumber, trigger: parsed.trigger_type });
  await notify(
    'Retraining Assigned',
    `${parsed.employee_name}: ${parsed.training_topic} due ${parsed.due_date}`,
    ref.id,
    ['training_coordinator', 'qa_manager', 'department_head'],
    parsed.employee_id,
  );
  await audit(actor, 'Retraining Assigned', ref.id);
  await audit(actor, 'Notification Sent', ref.id, { type: 'assignment' });
  return mapRetraining(ref.id, { ...payload, retraining_id: ref.id });
}

export async function bulkAssignRetraining(
  input: BulkAssignRetrainingInput,
  actor: RetrainingActor,
): Promise<number> {
  const employees = await listEmployees();
  let count = 0;
  for (const empId of input.employee_ids) {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) continue;
    await createRetraining({
      employee_id: emp.id,
      employee_name: emp.full_name || emp.email || emp.id,
      department: emp.department || input.training_type,
      designation: emp.designation || '',
      training_topic: input.training_topic,
      training_type: input.training_type,
      trigger_type: input.trigger_type,
      trigger_reference: input.trigger_reference,
      due_date: input.due_date,
      trainer: input.trainer,
      reason: input.reason,
    }, actor);
    count++;
  }
  await audit(actor, 'Bulk Retraining Assigned', 'bulk', { count, topic: input.training_topic });
  return count;
}

export async function scheduleRetraining(
  input: ScheduleRetrainingInput,
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  const existing = await getRetrainingById(input.retraining_id);
  if (!existing) return null;
  const updates: Record<string, unknown> = {
    retraining_status: 'Scheduled',
    status: 'Scheduled',
    scheduled_event_id: input.scheduled_event_id || null,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  if (input.trainer) updates.trainer = input.trainer;
  if (input.training_mode) updates.training_mode = input.training_mode;
  await updateDoc(doc(db(), RETRAINING_COLLECTION, input.retraining_id), updates as Record<string, string | null>);
  await audit(actor, 'Retraining Scheduled', input.retraining_id, updates);
  await notify('Retraining Scheduled', `${existing.training_topic} scheduled for ${existing.employee_name}`,
    input.retraining_id, ['training_coordinator'], existing.employee_id);
  return { ...existing, ...updates } as RetrainingRecord;
}

export async function startRetraining(id: string, actor: RetrainingActor): Promise<void> {
  await updateDoc(doc(db(), RETRAINING_COLLECTION, id), {
    retraining_status: 'In Progress',
    status: 'In Progress',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'Retraining Started', id);
}

export async function completeRetraining(
  input: CompleteRetrainingInput,
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  const existing = await getRetrainingById(input.retraining_id);
  if (!existing) return null;
  const passed = input.result === 'Pass';
  const status = passed ? 'Completed' : 'Failed';
  const updates = {
    obtained_score: input.obtained_score ?? null,
    result: input.result,
    competency_status: input.competency_status,
    retraining_status: status,
    status,
    completion_date: today(),
    certificate_issued: Boolean(input.certificate_number),
    certificate_number: input.certificate_number || null,
    remarks: input.remarks || existing.remarks,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(db(), RETRAINING_COLLECTION, input.retraining_id), updates);
  await audit(actor, passed ? 'Training Completed' : 'Assessment Failed', input.retraining_id, updates);
  if (input.certificate_number) {
    await audit(actor, 'Certificate Renewed', input.retraining_id, { certificate_number: input.certificate_number });
  }
  await notify(
    passed ? 'Retraining Completed' : 'Retraining Failed',
    `${existing.employee_name}: ${existing.training_topic} — ${input.result}`,
    input.retraining_id,
    ['training_coordinator', 'qa_manager', 'department_head'],
    existing.employee_id,
  );
  if (!passed) {
    await autoCreateFromFailedAssessment({
      employee_id: existing.employee_id,
      employee_name: existing.employee_name,
      department: existing.department,
      designation: existing.designation,
      training_topic: existing.training_topic,
      training_type: existing.training_type,
      original_training_id: input.retraining_id,
      trainer: existing.trainer,
    }, actor);
  }
  return { ...existing, ...updates } as RetrainingRecord;
}

export async function cancelRetraining(id: string, reason: string, actor: RetrainingActor): Promise<void> {
  await updateDoc(doc(db(), RETRAINING_COLLECTION, id), {
    retraining_status: 'Cancelled',
    status: 'Cancelled',
    remarks: reason,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'Retraining Cancelled', id, { reason });
}

export async function closeRetraining(id: string, actor: RetrainingActor): Promise<void> {
  await updateDoc(doc(db(), RETRAINING_COLLECTION, id), {
    retraining_status: 'Closed',
    status: 'Closed',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'Retraining Closed', id);
}

export async function processRetrainingOverdueAndReminders(): Promise<number> {
  const records = await listRetrainingRecords();
  const todayStr = today();
  const sevenDays = new Date();
  sevenDays.setDate(sevenDays.getDate() + 7);
  const threshold = sevenDays.toISOString().slice(0, 10);
  let count = 0;

  for (const rec of records) {
    if (['Completed', 'Closed', 'Cancelled'].includes(String(rec.retraining_status))) continue;

    if (rec.due_date && rec.due_date < todayStr && rec.retraining_status !== 'Overdue') {
      try {
        await updateDoc(doc(db(), RETRAINING_COLLECTION, rec.id), {
          retraining_status: 'Overdue',
          status: 'Overdue',
          updated_at: now(),
        });
        await notify('Retraining Overdue', `${rec.employee_name}: ${rec.training_topic} is overdue`,
          rec.id, ['training_coordinator', 'qa_manager', 'department_head'], rec.employee_id);
        count++;
      } catch { /* skip */ }
    }

    if (rec.due_date && rec.due_date >= todayStr && rec.due_date <= threshold) {
      await notify('Retraining Reminder', `${rec.training_topic} due ${rec.due_date}`,
        rec.id, ['training_coordinator'], rec.employee_id);
      count++;
    }
  }
  return count;
}

export interface AutoRetrainingContext {
  employee_id: string;
  employee_name: string;
  department: string;
  designation?: string;
  training_topic: string;
  training_type?: string;
  original_training_id?: string;
  original_completion_date?: string;
  trigger_type?: string;
  trigger_reference?: string;
  document_number?: string;
  document_version?: string;
  sop_number?: string;
  reason?: string;
  trainer?: string;
  due_days?: number;
}

export async function autoCreateRetraining(
  ctx: AutoRetrainingContext,
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  const existing = (await listRetrainingRecords()).find((r) =>
    r.employee_id === ctx.employee_id
    && r.training_topic === ctx.training_topic
    && !['Completed', 'Closed', 'Cancelled'].includes(String(r.retraining_status)),
  );
  if (existing) return existing;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (ctx.due_days ?? 14));
  return createRetraining({
    employee_id: ctx.employee_id,
    employee_name: ctx.employee_name,
    department: ctx.department,
    designation: ctx.designation || '',
    training_topic: ctx.training_topic,
    training_type: ctx.training_type || 'GMP Training',
    original_training_id: ctx.original_training_id || '',
    original_completion_date: ctx.original_completion_date || null,
    trigger_type: (ctx.trigger_type || 'Management Decision') as CreateRetrainingInput['trigger_type'],
    trigger_reference: ctx.trigger_reference || '',
    document_number: ctx.document_number || '',
    document_version: ctx.document_version || '',
    sop_number: ctx.sop_number || '',
    reason: ctx.reason || `Auto-generated retraining: ${ctx.trigger_type || 'Management Decision'}`,
    due_date: dueDate.toISOString().slice(0, 10),
    trainer: ctx.trainer || 'Training Coordinator',
  }, actor);
}

export async function autoCreateFromFailedAssessment(
  ctx: AutoRetrainingContext,
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  return autoCreateRetraining({ ...ctx, trigger_type: 'Failed Assessment', due_days: 14 }, actor);
}

export async function autoCreateFromExpiredCertificate(
  ctx: AutoRetrainingContext & { certificate_number?: string },
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  return autoCreateRetraining({
    ...ctx,
    trigger_type: 'Periodic Refresher',
    trigger_reference: ctx.certificate_number || ctx.trigger_reference || '',
    reason: `Certificate expired — retraining required for ${ctx.training_topic}`,
    due_days: 30,
  }, actor);
}

export async function autoCreateFromCapa(
  ctx: AutoRetrainingContext & { capa_id: string },
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  return autoCreateRetraining({
    ...ctx,
    trigger_type: 'CAPA',
    trigger_reference: ctx.capa_id,
    reason: ctx.reason || `CAPA ${ctx.capa_id} requires retraining`,
  }, actor);
}

export async function autoCreateFromDeviation(
  ctx: AutoRetrainingContext & { deviation_id: string },
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  return autoCreateRetraining({
    ...ctx,
    trigger_type: 'Deviation',
    trigger_reference: ctx.deviation_id,
    reason: ctx.reason || `Deviation ${ctx.deviation_id} investigation recommends retraining`,
  }, actor);
}

export async function autoCreateFromSopRevision(
  ctx: AutoRetrainingContext & { sop_number: string; document_version: string },
  actor: RetrainingActor,
): Promise<RetrainingRecord | null> {
  return autoCreateRetraining({
    ...ctx,
    trigger_type: 'SOP Revision',
    trigger_reference: `${ctx.sop_number} v${ctx.document_version}`,
    reason: `SOP ${ctx.sop_number} revision ${ctx.document_version} effective — retraining required`,
    due_days: 30,
  }, actor);
}

export function exportRetrainingCsv(records: RetrainingRecord[]) {
  const headers = [
    'Retraining #', 'Employee', 'Department', 'Topic', 'Trigger Type', 'Trigger Ref',
    'Status', 'Due Date', 'Trainer', 'Result', 'Completion Date',
  ];
  const rows = records.map((r) => [
    r.retraining_number, r.employee_name, r.department, r.training_topic, r.trigger_type,
    r.trigger_reference, String(r.retraining_status), r.due_date, r.trainer,
    r.result || '—', r.completion_date || '—',
  ]);
  downloadCsv(`retraining-export-${today()}.csv`, headers, rows);
}

export function openRetrainingPrint(records: RetrainingRecord[]) {
  const rows = records.map((r) => `
    <tr>
      <td>${r.retraining_number}</td><td>${r.employee_name}</td><td>${r.department}</td>
      <td>${r.training_topic}</td><td>${r.trigger_type}</td><td>${r.retraining_status}</td>
      <td>${r.due_date}</td><td>${r.trainer}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><title>Retraining Report</title>
    <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ccc;padding:8px;font-size:12px}th{background:#f1f5f9}</style></head>
    <body><h1>Retraining Management Report</h1><p>Generated: ${now()}</p>
    <table><thead><tr><th>#</th><th>Employee</th><th>Dept</th><th>Topic</th><th>Trigger</th><th>Status</th><th>Due</th><th>Trainer</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export async function logRetrainingExport(actor: RetrainingActor, count: number) {
  await audit(actor, 'Export', 'retraining-export', { count, format: 'CSV' });
}
