import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { z } from 'zod';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  TMS_COLLECTIONS, type TrainingMaster, type TrainingAssignment, type AssessmentQuestion,
  type AssessmentAttempt, type TrainingEffectiveness, type TrainingMatrixRow,
  type CompetencyRecord, type TmsFilters, type TmsDashboardMetrics, type TmsActor,
  type EmployeeProfile, type TrainingAttendance, type TrainingRecord,
  type TrainingScheduleSession, type TrainingCalendarEvent,
  type TrainingMatrixDefinition,
  calcCompliance, isOverdue, calcPassFail, calcTrainingResult, mapResultToCompletionStatus,
  toTrainingAssignmentStatus,
} from './training-types';
import { assignmentSchema, matrixDefinitionSchema, trainingMasterSchema } from './training-schemas';
import type {
  TrainingMasterInput, AssignmentInput, QuestionInput, EffectivenessInput, CompetencyInput,
  AttendanceInput, CompletionInput, BulkAssignmentInput, DepartmentAssignmentInput,
  ScheduleSessionInput, MatrixDefinitionInput,
} from './training-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: TmsActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '', collectionName = TMS_COLLECTIONS.records) {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Training', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
  await logTrainingAuditRecord(
    { id: actor.id, name: actor.name, role: actor.role },
    action, recordId, collectionName, oldValue, newValue, { reason, moduleName: 'Training' },
  ).catch(() => {});
}

async function notify(title: string, message: string, recordId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.notifications), {
        title, message, module: 'Training', record_id: recordId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

export async function generateTrainingCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRN-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.master),
      where('training_code', '>=', prefix),
      where('training_code', '<=', `${prefix}\uf8ff`),
      orderBy('training_code', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().training_code as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.master));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

export async function generateAssignmentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TAS-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments),
      where('training_number', '>=', prefix),
      where('training_number', '<=', `${prefix}\uf8ff`),
      orderBy('training_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().training_number as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

export async function generateTrainingRecordNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRR-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.records),
      where('training_record_id', '>=', prefix),
      where('training_record_id', '<=', `${prefix}\uf8ff`),
      orderBy('training_record_id', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().training_record_id as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.records));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function fetchLinkedDocumentInfo(documentId: string | null): Promise<{ document_number: string; document_title: string; sop_version: string }> {
  if (!documentId) return { document_number: '', document_title: '', sop_version: '' };
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.documents, documentId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        document_number: (data.document_number as string) || (data.documentNumber as string) || '',
        document_title: (data.document_title as string) || (data.title as string) || (data.documentTitle as string) || '',
        sop_version: (data.version as string) || (data.revision as string) || '',
      };
    }
    const sopSnap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.sopManagement, documentId));
    if (sopSnap.exists()) {
      const data = sopSnap.data();
      return {
        document_number: (data.sop_number as string) || (data.document_number as string) || '',
        document_title: (data.sop_title as string) || (data.title as string) || '',
        sop_version: (data.version as string) || (data.effective_version as string) || '',
      };
    }
    const masterSnap = await getDoc(doc(getFirebaseFirestore(), 'sop_master', documentId));
    if (masterSnap.exists()) {
      const data = masterSnap.data();
      return {
        document_number: (data.sop_number as string) || '',
        document_title: (data.sop_title as string) || '',
        sop_version: (data.version as string) || '',
      };
    }
  } catch { /* optional */ }
  return { document_number: '', document_title: '', sop_version: '' };
}

async function notifyCompletion(
  assignment: TrainingAssignment,
  result: string,
  recordId: string,
) {
  const outcome = result === 'Pass' ? 'completed successfully' : result === 'Fail' ? 'failed — retraining scheduled' : 'recorded';
  await notify(
    'Training Completion',
    `${assignment.employee_name}: ${assignment.training_title} ${outcome}`,
    recordId,
    ['qa_manager', 'head_qa', 'department_head', 'training_coordinator'],
  );
  try {
    await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.notifications), {
      title: 'Your Training Update',
      message: `Your training "${assignment.training_title}" has been ${outcome}.`,
      module: 'Training',
      record_id: recordId,
      target_user_id: assignment.employee_id,
      read: false,
      created_at: now(),
    });
  } catch { /* optional */ }
}

async function scheduleEffectivenessTask(assignment: TrainingAssignment, actor: TmsActor) {
  await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.effectiveness), {
    assignment_id: assignment.id,
    training_number: assignment.training_number,
    employee_id: assignment.employee_id,
    employee_name: assignment.employee_name,
    assessment_score: assignment.assessment_score,
    practical_observation: '',
    supervisor_feedback: '',
    effectiveness_result: 'Pending',
    evaluated_by: '',
    evaluated_by_name: '',
    evaluated_at: '',
    status: 'pending',
    created_at: now(),
    created_by: actor.id,
  });
  await notify(
    'Training Effectiveness Required',
    `Effectiveness evaluation required for ${assignment.employee_name} — ${assignment.training_title}`,
    assignment.id,
    ['qa_manager', 'head_qa'],
  );
}

// ─── Employees ───────────────────────────────────────────────────────────────

export async function listEmployees(): Promise<EmployeeProfile[]> {
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.users));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        employee_id: (data.employeeId as string) || d.id,
        full_name: (data.fullName as string) || '',
        department: (data.department as string) || '',
        designation: (data.designation as string) || '',
        email: (data.email as string) || '',
      };
    }).filter((e) => e.full_name);
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.profiles));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        employee_id: d.id,
        full_name: (data.full_name as string) || (data.email as string) || '',
        department: (data.department as string) || '',
        designation: (data.designation as string) || '',
        email: (data.email as string) || '',
      };
    });
  }
}

// ─── Training Master ─────────────────────────────────────────────────────────

export async function createTrainingMaster(input: TrainingMasterInput, actor: TmsActor): Promise<TrainingMaster> {
  const parsed = trainingMasterSchema.parse(input);
  const trainingCode = await generateTrainingCode();
  const timestamp = now();
  const record: Omit<TrainingMaster, 'id'> = {
    training_code: trainingCode,
    training_title: parsed.training_title,
    training_type: parsed.training_type,
    department: parsed.department,
    category: parsed.category,
    training_duration: parsed.training_duration,
    trainer_name: parsed.trainer_name,
    training_material: parsed.training_material,
    assessment_required: parsed.assessment_required,
    passing_percentage: parsed.passing_percentage,
    retraining_frequency: parsed.retraining_frequency,
    status: parsed.status,
    linked_document_id: parsed.linked_document_id || null,
    linked_capa_id: parsed.linked_capa_id || null,
    linked_change_control_id: parsed.linked_change_control_id || null,
    effectiveness_required: parsed.effectiveness_required,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.master), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getTrainingMasterById(id: string): Promise<TrainingMaster | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.master, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TrainingMaster;
}

export async function listTrainingMaster(filters?: TmsFilters): Promise<TrainingMaster[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));
  if (filters?.training_type) constraints.unshift(where('training_type', '==', filters.training_type));
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));

  let records: TrainingMaster[];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), TMS_COLLECTIONS.master), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMaster));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.master));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMaster));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.training_code.toLowerCase().includes(q) || r.training_title.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function updateTrainingMaster(id: string, input: Partial<TrainingMasterInput>, actor: TmsActor): Promise<TrainingMaster> {
  const existing = await getTrainingMasterById(id);
  if (!existing) throw new Error('Training not found');
  const updates = { ...input, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.master, id), updates);
  await audit(actor, 'EDIT', id, existing, updates);
  return { ...existing, ...updates } as TrainingMaster;
}

// ─── Assignments ─────────────────────────────────────────────────────────────

async function buildAssignmentRecord(
  input: z.infer<typeof assignmentSchema>,
  master: TrainingMaster,
  trainingNumber: string,
  actor: TmsActor,
  options?: { source?: string; sourceRef?: string; retrainingOf?: string },
): Promise<Omit<TrainingAssignment, 'id'>> {
  const timestamp = now();
  const docInfo = await fetchLinkedDocumentInfo(master.linked_document_id);
  const effectivenessRequired = input.effectiveness_required ?? master.effectiveness_required ?? false;
  const effDue = input.effectiveness_due_date
    ?? (effectivenessRequired
      ? new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
      : null);

  return {
    training_assignment_id: trainingNumber,
    training_number: trainingNumber,
    training_master_id: input.training_master_id,
    training_title: master.training_title,
    training_topic: input.training_topic || master.training_title,
    training_type: input.training_type || master.training_type,
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    department: input.department,
    designation: input.designation,
    document_number: docInfo.document_number,
    document_title: docInfo.document_title,
    sop_version: docInfo.sop_version,
    assigned_date: input.assigned_date,
    due_date: input.due_date,
    scheduled_date: input.scheduled_date ?? null,
    scheduled_time: input.scheduled_time ?? null,
    training_mode: input.training_mode || 'Classroom',
    completion_date: null,
    assessment_score: null,
    pass_fail: null,
    trainer_name: input.trainer_name || master.trainer_name,
    status: 'pending',
    training_status: 'Assigned',
    effectiveness_required: effectivenessRequired,
    effectiveness_due_date: effDue,
    remarks: input.remarks || '',
    source: options?.source || 'manual',
    source_ref: options?.sourceRef || null,
    retraining_of: options?.retrainingOf || null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

async function notifyAssignmentCreated(assignment: TrainingAssignment, master: TrainingMaster) {
  await notify(
    'Training Assigned',
    `${master.training_title} assigned to ${assignment.employee_name}. Due: ${assignment.due_date}`,
    assignment.id,
    ['qa_manager', 'head_qa', 'department_head'],
  );
  await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.notifications), {
    title: 'New Training Assignment',
    message: `You have been assigned: ${master.training_title}. Due date: ${assignment.due_date}`,
    module: 'Training',
    record_id: assignment.id,
    target_user_id: assignment.employee_id,
    read: false,
    created_at: now(),
  });
}

export async function createAssignment(
  input: AssignmentInput, actor: TmsActor,
  options?: { source?: string; sourceRef?: string; retrainingOf?: string },
): Promise<TrainingAssignment> {
  const parsed = assignmentSchema.parse(input);
  const master = await getTrainingMasterById(parsed.training_master_id);
  if (!master) throw new Error('Training master not found');

  const trainingNumber = await generateAssignmentNumber();
  const record = await buildAssignmentRecord(parsed, master, trainingNumber, actor, options);

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments), record);
  const created = { id: refDoc.id, ...record };
  await audit(actor, 'ASSIGN', refDoc.id, null, record);
  await notifyAssignmentCreated(created, master);
  return created;
}

export async function bulkAssignTraining(
  input: BulkAssignmentInput, actor: TmsActor,
): Promise<TrainingAssignment[]> {
  const employees = await listEmployees();
  const results: TrainingAssignment[] = [];
  for (const empId of input.employee_ids) {
    const emp = employees.find((e) => e.id === empId || e.employee_id === empId);
    if (!emp) continue;
    const assignment = await createAssignment({
      training_master_id: input.training_master_id,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_date: input.assigned_date,
      due_date: input.due_date,
      trainer_name: input.trainer_name,
      training_mode: input.training_mode,
      remarks: input.remarks,
    }, actor, { source: 'bulk' });
    results.push(assignment);
  }
  await audit(actor, 'BULK_ASSIGN', input.training_master_id, null, { count: results.length });
  return results;
}

export async function assignByDepartment(
  input: DepartmentAssignmentInput, actor: TmsActor,
): Promise<TrainingAssignment[]> {
  const employees = (await listEmployees()).filter((e) => e.department === input.department);
  if (employees.length === 0) throw new Error(`No employees found in ${input.department}`);

  const results: TrainingAssignment[] = [];
  for (const emp of employees) {
    const assignment = await createAssignment({
      training_master_id: input.training_master_id,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_date: input.assigned_date,
      due_date: input.due_date,
      trainer_name: input.trainer_name,
      training_mode: input.training_mode,
      remarks: input.remarks,
    }, actor, { source: 'department', sourceRef: input.department });
    results.push(assignment);
  }
  await audit(actor, 'DEPT_ASSIGN', input.department, null, { count: results.length });
  return results;
}

export async function assignFromMatrix(actor: TmsActor): Promise<number> {
  return assignFromMatrixDefinitions(actor);
}

export async function scheduleTrainingSession(
  input: ScheduleSessionInput, actor: TmsActor,
): Promise<{ session: TrainingScheduleSession; assignments: TrainingAssignment[] }> {
  const master = await getTrainingMasterById(input.training_master_id);
  if (!master) throw new Error('Training master not found');

  const employees = await listEmployees();
  const assignments: TrainingAssignment[] = [];

  for (const empId of input.employee_ids) {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) continue;
    const assignment = await createAssignment({
      training_master_id: input.training_master_id,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_date: input.scheduled_date,
      due_date: input.due_date,
      trainer_name: input.trainer_name || master.trainer_name,
      training_mode: input.training_mode,
      scheduled_date: input.scheduled_date,
      scheduled_time: input.scheduled_time,
      remarks: input.notes,
    }, actor, { source: 'scheduled' });
    assignments.push(assignment);
  }

  const timestamp = now();
  const session: Omit<TrainingScheduleSession, 'id'> = {
    training_master_id: input.training_master_id,
    training_title: master.training_title,
    training_type: master.training_type,
    department: input.department,
    trainer_name: input.trainer_name || master.trainer_name,
    scheduled_date: input.scheduled_date,
    scheduled_time: input.scheduled_time,
    training_mode: input.training_mode,
    employee_ids: input.employee_ids,
    assignment_ids: assignments.map((a) => a.id),
    notes: input.notes,
    created_by: actor.id,
    created_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(
    collection(getFirebaseFirestore(), TMS_COLLECTIONS.sessions),
    session,
  );
  await audit(actor, 'SCHEDULE', refDoc.id, null, session);
  return { session: { id: refDoc.id, ...session }, assignments };
}

export async function getTrainingCalendar(): Promise<TrainingCalendarEvent[]> {
  const assignments = await listAssignments();
  const events: TrainingCalendarEvent[] = [];

  for (const a of assignments) {
    const eventDate = a.scheduled_date;
    if (!eventDate) continue;
    events.push({
      id: a.id,
      date: eventDate,
      title: a.training_topic || a.training_title,
      training_number: a.training_number,
      employee_name: a.employee_name,
      department: a.department,
      trainer_name: a.trainer_name,
      training_status: toTrainingAssignmentStatus(a.training_status ?? a.status),
      training_mode: a.training_mode || 'Classroom',
      due_date: a.due_date,
    });
  }

  return events.sort((x, y) => x.date.localeCompare(y.date));
}

export async function cancelAssignment(id: string, actor: TmsActor, remarks = ''): Promise<TrainingAssignment> {
  const existing = await getAssignmentById(id);
  if (!existing) throw new Error('Assignment not found');
  const updates = {
    status: 'cancelled',
    training_status: 'Cancelled',
    remarks: remarks || existing.remarks || '',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.assignments, id), updates);
  await audit(actor, 'CANCEL', id, existing, updates);
  return { ...existing, ...updates } as TrainingAssignment;
}

export async function listAssignments(filters?: TmsFilters): Promise<TrainingAssignment[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));

  let records: TrainingAssignment[];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAssignment));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.training_number.toLowerCase().includes(q) ||
      r.training_title.toLowerCase().includes(q) ||
      r.employee_name.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function getAssignmentById(id: string): Promise<TrainingAssignment | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.assignments, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TrainingAssignment;
}

export async function completeAssignment(
  id: string, score: number | null, actor: TmsActor,
): Promise<TrainingAssignment> {
  const existing = await getAssignmentById(id);
  if (!existing) throw new Error('Assignment not found');

  const master = await getTrainingMasterById(existing.training_master_id);
  const passingPercent = master?.passing_percentage ?? 80;
  const passFail = score != null ? calcPassFail(score, passingPercent) : 'Pass';
  const status = passFail === 'Fail' ? 'failed' : 'completed';

  const updates = {
    completion_date: now().split('T')[0],
    assessment_score: score,
    pass_fail: passFail,
    status,
    training_status: status === 'failed' ? 'In Progress' : 'Completed',
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  };
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.assignments, id), updates);
  await audit(actor, 'COMPLETE', id, existing, updates);

  if (passFail === 'Fail') {
    await createRetrainingTask(existing, actor);
  }
  return { ...existing, ...updates } as TrainingAssignment;
}

async function createRetrainingTask(failed: TrainingAssignment, actor: TmsActor) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  await createAssignment({
    training_master_id: failed.training_master_id,
    employee_id: failed.employee_id,
    employee_name: failed.employee_name,
    department: failed.department,
    designation: failed.designation,
    assigned_date: now().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    trainer_name: failed.trainer_name,
  }, actor, { source: 'retraining', retrainingOf: failed.id });
  try {
    const { autoCreateFromFailedAssessment } = await import('./training-retraining-service');
    await autoCreateFromFailedAssessment({
      employee_id: failed.employee_id,
      employee_name: failed.employee_name,
      department: failed.department,
      designation: failed.designation,
      training_topic: failed.training_title,
      training_type: failed.training_type || 'GMP Training',
      original_training_id: failed.id,
      trainer: failed.trainer_name,
      reason: `Failed assessment on ${failed.training_title}`,
    }, actor);
  } catch { /* retraining record optional if service unavailable */ }
  await notify('Retraining Required', `${failed.employee_name} failed ${failed.training_title} — retraining assigned`, failed.id, ['qa_manager', 'head_qa', 'training_coordinator', 'department_head']);
}

export async function syncOverdueAssignments(): Promise<number> {
  let count = 0;
  const today = now().split('T')[0];
  const notifiedDepts = new Set<string>();
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments));
    for (const d of snap.docs) {
      const data = d.data() as TrainingAssignment;
      if (['pending', 'in_progress', 'assigned'].includes(data.status) && data.due_date < today) {
        await updateDoc(d.ref, {
          status: 'overdue',
          training_status: 'Overdue',
          updated_at: now(),
        });
        count++;
        if (!notifiedDepts.has(data.department)) {
          notifiedDepts.add(data.department);
          await notify(
            'Overdue Training Alert',
            `Department ${data.department} has overdue training assignments requiring attention.`,
            d.id,
            ['department_head', 'qa_manager', 'head_qa'],
          );
        }
        await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.notifications), {
          title: 'Training Overdue',
          message: `Your training "${data.training_title}" is overdue. Due date was ${data.due_date}.`,
          module: 'Training',
          record_id: d.id,
          target_user_id: data.employee_id,
          read: false,
          created_at: now(),
        });
      }
    }
  } catch { /* ignore */ }
  return count;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function recordAttendance(input: AttendanceInput, actor: TmsActor): Promise<TrainingAttendance> {
  const assignment = await getAssignmentById(input.assignment_id);
  if (!assignment) throw new Error('Training assignment not found');

  const timestamp = now();
  const record: Omit<TrainingAttendance, 'id'> = {
    training_record_id: null,
    assignment_id: input.assignment_id,
    training_number: assignment.training_number,
    employee_id: input.employee_id,
    employee_name: assignment.employee_name,
    department: assignment.department,
    designation: assignment.designation,
    training_topic: assignment.training_title,
    training_date: input.training_date,
    start_time: input.start_time,
    end_time: input.end_time,
    attendance_status: input.attendance_status,
    trainer: input.trainer,
    trainer_verified: input.trainer_verified,
    trainer_verified_by: input.trainer_verified ? actor.name : null,
    trainer_verified_at: input.trainer_verified ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.attendance), record);
  await audit(actor, 'ATTENDANCE', refDoc.id, null, record);

  const assignmentStatus = input.attendance_status === 'Absent' ? 'pending' : 'in_progress';
  const trainingStatus = input.attendance_status === 'Absent' ? 'Assigned' : 'In Progress';
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.assignments, input.assignment_id), {
    status: assignmentStatus,
    training_status: trainingStatus,
    trainer_name: input.trainer,
    updated_at: timestamp,
  });

  if (input.attendance_status === 'Absent') {
    await notify(
      'Training Attendance — Absent',
      `${assignment.employee_name} was absent for ${assignment.training_title}. Training remains pending.`,
      refDoc.id,
      ['qa_manager'],
    );
  }

  return { id: refDoc.id, ...record };
}

export async function listAttendance(filters?: TmsFilters): Promise<TrainingAttendance[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));

  let records: TrainingAttendance[];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), TMS_COLLECTIONS.attendance), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAttendance));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.attendance));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAttendance));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.training_number.toLowerCase().includes(q) ||
      r.employee_name.toLowerCase().includes(q) ||
      r.training_topic.toLowerCase().includes(q),
    );
  }
  return records;
}

// ─── Training Records (Completion) ───────────────────────────────────────────

export async function completeTraining(
  input: CompletionInput,
  actor: TmsActor,
  options?: { assessmentRequired?: boolean; passMarks?: number },
): Promise<TrainingRecord> {
  const assignment = await getAssignmentById(input.assignment_id);
  if (!assignment) throw new Error('Training assignment not found');

  const master = await getTrainingMasterById(assignment.training_master_id);
  const assessmentRequired = options?.assessmentRequired ?? master?.assessment_required ?? false;
  const passMarks = options?.passMarks ?? master?.passing_percentage ?? 80;

  if (assessmentRequired && (input.assessment_score == null || Number.isNaN(input.assessment_score))) {
    throw new Error('Assessment score is required when assessment is required');
  }
  if (input.attendance_status === 'Absent') {
    throw new Error('Cannot complete training when attendance status is Absent');
  }

  const trainingResult = calcTrainingResult(input.assessment_score ?? null, passMarks, assessmentRequired);
  const completionStatus = mapResultToCompletionStatus(trainingResult);
  const docInfo = await fetchLinkedDocumentInfo(master?.linked_document_id ?? null);
  const recordNumber = await generateTrainingRecordNumber();
  const timestamp = now();

  const record: Omit<TrainingRecord, 'id'> = {
    training_record_id: recordNumber,
    training_number: assignment.training_number,
    assignment_id: input.assignment_id,
    employee_id: input.employee_id,
    employee_name: assignment.employee_name,
    department: assignment.department,
    designation: assignment.designation,
    training_topic: assignment.training_title,
    training_type: assignment.training_type,
    document_number: docInfo.document_number,
    sop_version: docInfo.sop_version,
    training_mode: input.training_mode,
    trainer: input.trainer,
    training_date: input.training_date,
    start_time: input.start_time,
    end_time: input.end_time,
    attendance_status: input.attendance_status,
    completion_status: completionStatus,
    assessment_required: assessmentRequired,
    assessment_score: input.assessment_score ?? null,
    pass_marks: passMarks,
    training_result: trainingResult,
    trainer_comments: input.trainer_comments,
    employee_comments: input.employee_comments,
    completion_evidence: input.completion_evidence,
    trainer_verified: input.trainer_verified,
    trainer_verified_by: input.trainer_verified ? actor.name : null,
    trainer_verified_at: input.trainer_verified ? timestamp : null,
    created_at: timestamp,
    updated_at: timestamp,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.records), record);
  await audit(actor, 'TRAINING_COMPLETE', refDoc.id, null, record);

  const assignmentUpdates: Partial<TrainingAssignment> = {
    completion_date: input.training_date,
    assessment_score: input.assessment_score ?? null,
    pass_fail: trainingResult === 'Not Applicable' ? 'Pass' : trainingResult,
    trainer_name: input.trainer,
    updated_at: timestamp,
  };

  if (trainingResult === 'Pass' || trainingResult === 'Not Applicable') {
    assignmentUpdates.status = 'completed';
    assignmentUpdates.training_status = 'Completed';
  } else if (trainingResult === 'Fail') {
    assignmentUpdates.status = 'failed';
    assignmentUpdates.training_status = 'In Progress';
    await createRetrainingTask(assignment, actor);
  } else {
    assignmentUpdates.status = 'in_progress';
    assignmentUpdates.training_status = 'In Progress';
  }

  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.assignments, input.assignment_id), assignmentUpdates);
  await audit(actor, 'COMPLETE', input.assignment_id, assignment, assignmentUpdates);

  if (master?.effectiveness_required) {
    await scheduleEffectivenessTask({ ...assignment, ...assignmentUpdates } as TrainingAssignment, actor);
  }

  await notifyCompletion(assignment, trainingResult, refDoc.id);

  return { id: refDoc.id, ...record };
}

export async function listTrainingRecords(filters?: TmsFilters): Promise<TrainingRecord[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));

  let records: TrainingRecord[];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), TMS_COLLECTIONS.records), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingRecord));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.records));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingRecord));
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.training_record_id.toLowerCase().includes(q) ||
      r.training_number.toLowerCase().includes(q) ||
      r.employee_name.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function getTrainingRecordById(id: string): Promise<TrainingRecord | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.records, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TrainingRecord;
}

export async function uploadCompletionEvidence(
  recordId: string,
  file: File,
  actor: TmsActor,
): Promise<string> {
  const path = `training/completion/${recordId}/${Date.now()}_${file.name}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.records, recordId), {
    completion_evidence: url,
    updated_at: now(),
    updated_by: actor.id,
    updated_by_name: actor.name,
  });
  await audit(actor, 'UPLOAD_EVIDENCE', recordId, null, { file_name: file.name, url });
  return url;
}

export async function exportTrainingRecordsCsv(records: TrainingRecord[]) {
  downloadCsv(
    `training-records-${now().split('T')[0]}.csv`,
    ['Record ID', 'Training #', 'Employee', 'Department', 'Topic', 'Date', 'Attendance', 'Completion', 'Result', 'Score', 'Trainer'],
    records.map((r) => [
      r.training_record_id, r.training_number, r.employee_name, r.department,
      r.training_topic, r.training_date, r.attendance_status, r.completion_status,
      r.training_result, r.assessment_score ?? '', r.trainer,
    ]),
  );
}

export async function exportAttendanceCsv(records: TrainingAttendance[]) {
  downloadCsv(
    `training-attendance-${now().split('T')[0]}.csv`,
    ['Training #', 'Employee', 'Department', 'Topic', 'Date', 'Status', 'Trainer', 'Verified'],
    records.map((r) => [
      r.training_number, r.employee_name, r.department, r.training_topic,
      r.training_date, r.attendance_status, r.trainer, r.trainer_verified ? 'Yes' : 'No',
    ]),
  );
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export async function addQuestion(input: QuestionInput, actor: TmsActor): Promise<AssessmentQuestion> {
  const record: Omit<AssessmentQuestion, 'id'> = {
    ...input,
    created_at: now(),
  };
  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assessments), {
    ...record, record_type: 'question',
  });
  await audit(actor, 'ADD_QUESTION', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getQuestions(trainingMasterId: string): Promise<AssessmentQuestion[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.assessments),
      where('training_master_id', '==', trainingMasterId),
      where('record_type', '==', 'question'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AssessmentQuestion));
  } catch {
    return [];
  }
}

export async function submitAssessment(
  assignmentId: string, answers: Record<string, string>, actor: TmsActor,
): Promise<AssessmentAttempt> {
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) throw new Error('Assignment not found');

  const questions = await getQuestions(assignment.training_master_id);
  let totalMarks = 0;
  let earnedMarks = 0;

  for (const q of questions) {
    totalMarks += q.marks;
    if (answers[q.id] === q.correct_answer) earnedMarks += q.marks;
  }

  const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
  const master = await getTrainingMasterById(assignment.training_master_id);
  const passFail = calcPassFail(percentage, master?.passing_percentage ?? 80);

  const attempt: Omit<AssessmentAttempt, 'id'> = {
    assignment_id: assignmentId,
    employee_id: assignment.employee_id,
    answers,
    score: earnedMarks,
    percentage,
    pass_fail: passFail,
    attempted_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assessments), {
    ...attempt, record_type: 'attempt',
  });

  await completeAssignment(assignmentId, percentage, actor);
  await audit(actor, 'ASSESSMENT', assignmentId, null, attempt);
  return { id: refDoc.id, ...attempt };
}

// ─── Effectiveness ───────────────────────────────────────────────────────────

export async function saveEffectiveness(input: EffectivenessInput, actor: TmsActor): Promise<TrainingEffectiveness> {
  const assignment = await getAssignmentById(input.assignment_id);
  if (!assignment) throw new Error('Assignment not found');

  const record: Omit<TrainingEffectiveness, 'id'> = {
    assignment_id: input.assignment_id,
    training_number: assignment.training_number,
    employee_id: assignment.employee_id,
    employee_name: assignment.employee_name,
    assessment_score: input.assessment_score ?? assignment.assessment_score,
    practical_observation: input.practical_observation,
    supervisor_feedback: input.supervisor_feedback,
    effectiveness_result: input.effectiveness_result,
    evaluated_by: actor.id,
    evaluated_by_name: actor.name,
    evaluated_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.effectiveness), record);
  await audit(actor, 'EFFECTIVENESS', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listEffectiveness(): Promise<TrainingEffectiveness[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.effectiveness),
      orderBy('evaluated_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingEffectiveness));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.effectiveness));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingEffectiveness));
  }
}

// ─── Competency ────────────────────────────────────────────────────────────────

export async function saveCompetency(input: CompetencyInput, actor: TmsActor): Promise<CompetencyRecord> {
  const levelOrder = ['Novice', 'Basic', 'Competent', 'Proficient', 'Expert'];
  const reqIdx = levelOrder.indexOf(input.required_level);
  const curIdx = levelOrder.indexOf(input.current_level);
  const gap = curIdx < reqIdx ? `${input.required_level} required, currently ${input.current_level}` : 'None';

  const record: Omit<CompetencyRecord, 'id'> = {
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    department: input.department,
    skill: input.skill,
    competency_level: input.current_level,
    required_level: input.required_level,
    current_level: input.current_level,
    gap,
    training_required: input.training_required || curIdx < reqIdx,
    linked_training_id: null,
    created_at: now(),
    updated_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.competency), record);
  await audit(actor, 'COMPETENCY', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function listCompetency(): Promise<CompetencyRecord[]> {
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.competency),
      orderBy('updated_at', 'desc'),
    ));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompetencyRecord));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.competency));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompetencyRecord));
  }
}

// ─── Training Matrix Definitions ───────────────────────────────────────────────

export async function generateMatrixCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TMX-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrix),
      where('matrix_code', '>=', prefix),
      where('matrix_code', '<=', `${prefix}\uf8ff`),
      orderBy('matrix_code', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().matrix_code as string;
      return `${prefix}${String(parseInt(last.split('-').pop() || '0', 10) + 1).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrix));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

export async function listMatrixDefinitions(filters?: TmsFilters): Promise<TrainingMatrixDefinition[]> {
  const constraints: QueryConstraint[] = [orderBy('updated_at', 'desc')];
  if (filters?.department) constraints.unshift(where('department', '==', filters.department));
  if (filters?.status) constraints.unshift(where('status', '==', filters.status));

  let records: TrainingMatrixDefinition[];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrix), ...constraints));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMatrixDefinition));
  } catch {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrix));
    records = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMatrixDefinition));
  }

  if (filters?.designation) {
    records = records.filter((r) => r.designation === filters.designation);
  }
  if (filters?.role) {
    records = records.filter((r) => r.role === filters.role);
  }
  if (filters?.document_number) {
    records = records.filter((r) => r.document_number === filters.document_number);
  }
  if (filters?.sop_number) {
    records = records.filter((r) => r.sop_number === filters.sop_number);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    records = records.filter((r) =>
      r.matrix_code.toLowerCase().includes(q) ||
      r.training_topic.toLowerCase().includes(q) ||
      r.document_number.toLowerCase().includes(q) ||
      r.sop_number.toLowerCase().includes(q),
    );
  }
  return records;
}

export async function getMatrixDefinitionById(id: string): Promise<TrainingMatrixDefinition | null> {
  const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.matrix, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as TrainingMatrixDefinition;
}

export async function checkMatrixDuplicate(
  department: string,
  designation: string,
  documentNumber: string,
  sopNumber: string,
  excludeId?: string,
): Promise<boolean> {
  const docKey = documentNumber || sopNumber;
  if (!docKey) return false;
  const existing = await listMatrixDefinitions({ department, designation });
  return existing.some((m) => {
    if (excludeId && m.id === excludeId) return false;
    const mKey = m.document_number || m.sop_number;
    return mKey === docKey;
  });
}

export async function createMatrixDefinition(
  input: MatrixDefinitionInput,
  actor: TmsActor,
): Promise<TrainingMatrixDefinition> {
  const parsed = matrixDefinitionSchema.parse(input);
  const docKey = parsed.document_number || parsed.sop_number;
  if (docKey) {
    const dup = await checkMatrixDuplicate(parsed.department, parsed.designation, parsed.document_number, parsed.sop_number);
    if (dup) throw new Error(`Duplicate matrix: ${parsed.department} + ${parsed.designation} + ${docKey} already exists`);
  }

  const matrixCode = await generateMatrixCode();
  const timestamp = now();
  const record: Omit<TrainingMatrixDefinition, 'id'> = {
    matrix_id: matrixCode,
    matrix_code: matrixCode,
    ...parsed,
    linked_document_id: parsed.linked_document_id ?? null,
    linked_training_master_id: parsed.linked_training_master_id ?? null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrix), record);
  await audit(actor, 'MATRIX_CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function updateMatrixDefinition(
  id: string,
  input: Partial<MatrixDefinitionInput>,
  actor: TmsActor,
): Promise<TrainingMatrixDefinition> {
  const existing = await getMatrixDefinitionById(id);
  if (!existing) throw new Error('Matrix definition not found');

  const merged = { ...existing, ...input };
  const docKey = (merged.document_number || merged.sop_number) as string;
  if (docKey) {
    const dup = await checkMatrixDuplicate(
      merged.department, merged.designation,
      merged.document_number || '', merged.sop_number || '',
      id,
    );
    if (dup) throw new Error(`Duplicate matrix: ${merged.department} + ${merged.designation} + ${docKey} already exists`);
  }

  const updates = {
    ...input,
    updated_by: actor.id,
    updated_by_name: actor.name,
    updated_at: now(),
  };
  await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.matrix, id), updates);
  await audit(actor, 'MATRIX_EDIT', id, existing, updates);
  return { ...existing, ...updates } as TrainingMatrixDefinition;
}

function matrixMatchesEmployee(def: TrainingMatrixDefinition, emp: EmployeeProfile, userRole = ''): boolean {
  if (def.status !== 'Active' || !def.training_required) return false;
  if (def.department !== emp.department) return false;
  if (def.designation && def.designation !== emp.designation) return false;
  if (def.role && def.role !== userRole) return false;
  return true;
}

async function resolveMatrixTrainingMaster(def: TrainingMatrixDefinition, actor: TmsActor): Promise<string> {
  if (def.linked_training_master_id) return def.linked_training_master_id;
  const masters = await listTrainingMaster({ search: def.training_topic });
  if (masters.length > 0) return masters[0].id;

  const master = await createTrainingMaster({
    training_title: def.training_topic,
    training_type: def.training_type as import('./training-types').TrainingType,
    department: def.department,
    category: def.initial_training_required ? 'Initial' : 'Refresher',
    training_duration: def.training_duration,
    trainer_name: def.trainer_role || 'QA Trainer',
    training_material: '',
    assessment_required: true,
    passing_percentage: 80,
    retraining_frequency: def.training_frequency,
    status: 'Active',
    linked_document_id: def.linked_document_id,
    effectiveness_required: def.effectiveness_required,
  }, actor);
  await updateMatrixDefinition(def.id, { linked_training_master_id: master.id }, actor);
  return master.id;
}

export async function assignFromMatrixDefinitions(actor: TmsActor): Promise<number> {
  const [definitions, employees, assignments] = await Promise.all([
    listMatrixDefinitions({ status: 'Active' }),
    listEmployees(),
    listAssignments(),
  ]);
  let count = 0;
  const today = now().split('T')[0];

  for (const emp of employees) {
    for (const def of definitions) {
      if (!matrixMatchesEmployee(def, emp)) continue;

      const masterId = def.linked_training_master_id || await resolveMatrixTrainingMaster(def, actor).catch(() => null);
      if (!masterId) continue;

      const exists = assignments.some(
        (a) => (a.employee_id === emp.id || a.employee_id === emp.employee_id)
          && (a.training_master_id === masterId || a.training_title === def.training_topic)
          && !['completed', 'cancelled'].includes(a.status),
      );
      if (exists) continue;

      const dueDate = new Date(Date.now() + def.due_days_after_assignment * 86400000).toISOString().split('T')[0];
      await createAssignment({
        training_master_id: masterId,
        employee_id: emp.id,
        employee_name: emp.full_name,
        department: emp.department,
        designation: emp.designation,
        training_topic: def.training_topic,
        training_type: def.training_type,
        assigned_date: today,
        due_date: dueDate,
        trainer_name: def.trainer_role,
        effectiveness_required: def.effectiveness_required,
        remarks: `Auto-assigned from matrix ${def.matrix_code}`,
      }, actor, { source: 'matrix', sourceRef: def.id });
      count++;
    }
  }
  await audit(actor, 'MATRIX_AUTO_ASSIGN', 'training_matrix', null, { count });
  return count;
}

export async function assignTrainingForNewUser(employeeId: string, actor: TmsActor): Promise<number> {
  const employees = await listEmployees();
  const emp = employees.find((e) => e.id === employeeId || e.employee_id === employeeId);
  if (!emp) return 0;

  const definitions = await listMatrixDefinitions({ status: 'Active', department: emp.department });
  const assignments = await listAssignments();
  let count = 0;
  const today = now().split('T')[0];

  for (const def of definitions.filter((d) => d.designation === emp.designation || !d.designation)) {
    if (!def.training_required || !def.initial_training_required) continue;
    const masterId = def.linked_training_master_id;
    if (!masterId) continue;

    const exists = assignments.some(
      (a) => a.employee_id === emp.id && a.training_master_id === masterId,
    );
    if (exists) continue;

    const dueDate = new Date(Date.now() + def.due_days_after_assignment * 86400000).toISOString().split('T')[0];
    await createAssignment({
      training_master_id: masterId,
      employee_id: emp.id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      assigned_date: today,
      due_date: dueDate,
      trainer_name: def.trainer_role,
      effectiveness_required: def.effectiveness_required,
      remarks: `New user matrix assignment (${def.matrix_code})`,
    }, actor, { source: 'matrix_new_user', sourceRef: def.id });
    count++;
  }
  return count;
}

export async function processRefresherAssignments(actor: TmsActor): Promise<number> {
  const definitions = (await listMatrixDefinitions({ status: 'Active' }))
    .filter((d) => d.refresher_required && d.training_frequency !== 'One Time');
  const assignments = await listAssignments();
  const employees = await listEmployees();
  let count = 0;
  const today = new Date();

  const freqMonths: Record<string, number> = {
    Monthly: 1, Quarterly: 3, 'Half Yearly': 6, Yearly: 12,
  };

  for (const def of definitions) {
    const months = freqMonths[def.training_frequency];
    if (!months) continue;

    for (const emp of employees.filter((e) => matrixMatchesEmployee(def, e))) {
      const completed = assignments
        .filter((a) =>
          (a.employee_id === emp.id || a.employee_id === emp.employee_id)
          && a.training_title === def.training_topic
          && a.status === 'completed'
          && a.completion_date,
        )
        .sort((a, b) => (b.completion_date || '').localeCompare(a.completion_date || ''))[0];

      if (!completed?.completion_date) continue;
      const completedDate = new Date(completed.completion_date);
      const dueRefresh = new Date(completedDate);
      dueRefresh.setMonth(dueRefresh.getMonth() + months);
      if (dueRefresh > today) continue;

      const activeExists = assignments.some(
        (a) => (a.employee_id === emp.id) && a.training_title === def.training_topic
          && !['completed', 'cancelled'].includes(a.status),
      );
      if (activeExists) continue;

      const masterId = def.linked_training_master_id;
      if (!masterId) continue;

      const dueDate = new Date(Date.now() + def.due_days_after_assignment * 86400000).toISOString().split('T')[0];
      await createAssignment({
        training_master_id: masterId,
        employee_id: emp.id,
        employee_name: emp.full_name,
        department: emp.department,
        designation: emp.designation,
        assigned_date: now().split('T')[0],
        due_date: dueDate,
        trainer_name: def.trainer_role,
        effectiveness_required: def.effectiveness_required,
        remarks: `Refresher (${def.training_frequency}) from matrix ${def.matrix_code}`,
      }, actor, { source: 'matrix_refresher', sourceRef: def.id });
      count++;
    }
  }
  return count;
}

export async function exportMatrixDefinitionsCsv(definitions: TrainingMatrixDefinition[]) {
  downloadCsv(
    `training-matrix-definitions-${now().split('T')[0]}.csv`,
    ['Matrix Code', 'Department', 'Designation', 'Role', 'Topic', 'Type', 'Document #', 'SOP #', 'Frequency', 'Duration', 'Due Days', 'Status'],
    definitions.map((m) => [
      m.matrix_code, m.department, m.designation, m.role, m.training_topic, m.training_type,
      m.document_number, m.sop_number, m.training_frequency, m.training_duration,
      m.due_days_after_assignment, m.status,
    ]),
  );
}

// ─── Employee Compliance Matrix ────────────────────────────────────────────────

export async function buildTrainingMatrix(): Promise<TrainingMatrixRow[]> {
  const [employees, assignments, definitions] = await Promise.all([
    listEmployees(), listAssignments(), listMatrixDefinitions({ status: 'Active' }),
  ]);

  const matrix: TrainingMatrixRow[] = [];

  for (const emp of employees) {
    const requiredDefs = definitions.filter((d) => matrixMatchesEmployee(d, emp));
    const required = requiredDefs.length > 0
      ? requiredDefs.map((d) => d.training_topic)
      : (await listTrainingMaster({ status: 'Active' }))
        .filter((m) => m.department === emp.department || m.department === 'QA')
        .map((m) => m.training_title);

    const empAssignments = assignments.filter((a) => a.employee_id === emp.id || a.employee_id === emp.employee_id);

    const completed = empAssignments
      .filter((a) => a.status === 'completed')
      .map((a) => a.training_topic || a.training_title);
    const pending = empAssignments
      .filter((a) => ['pending', 'in_progress'].includes(a.status))
      .map((a) => a.training_topic || a.training_title);
    const overdue = empAssignments
      .filter((a) => a.status === 'overdue' || isOverdue(a.due_date, a.status))
      .map((a) => a.training_topic || a.training_title);

    const uniqueRequired = Array.from(new Set(required));
    const uniqueCompleted = Array.from(new Set(completed));

    const row: Omit<TrainingMatrixRow, 'id'> = {
      employee_id: emp.employee_id,
      employee_name: emp.full_name,
      department: emp.department,
      designation: emp.designation,
      required_trainings: uniqueRequired,
      completed_trainings: uniqueCompleted,
      pending_trainings: Array.from(new Set(pending)),
      overdue_trainings: Array.from(new Set(overdue)),
      compliance_percent: calcCompliance(uniqueCompleted.length, uniqueRequired.length),
      updated_at: now(),
    };

    matrix.push({ id: emp.id, ...row });

    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.matrixCompliance, emp.id), row).catch(() => undefined);
    } catch { /* optional */ }
  }

  return matrix;
}

export async function getTrainingMatrix(): Promise<TrainingMatrixRow[]> {
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrixCompliance));
    if (snap.size > 0) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingMatrixRow));
    }
  } catch { /* rebuild */ }
  return buildTrainingMatrix();
}

// ─── Auto Rules / Integrations ───────────────────────────────────────────────

export async function syncDmsTrainingLinks(actor: TmsActor): Promise<number> {
  let count = 0;
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), TMS_COLLECTIONS.dmsLinks),
      where('status', '==', 'pending'),
    ));
    const employees = await listEmployees();

    for (const d of snap.docs) {
      const link = d.data();
      const dept = (link.target_department as string) || 'QA';
      const deptEmployees = employees.filter((e) => e.department === dept);
      const dueDate = (link.due_date as string) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      let masterId = '';
      const existingMaster = await listTrainingMaster({ search: link.document_number as string });
      if (existingMaster.length > 0) {
        masterId = existingMaster[0].id;
      } else {
        const master = await createTrainingMaster({
          training_title: link.training_title as string || `SOP Retraining: ${link.document_number}`,
          training_type: 'SOP Training',
          department: dept,
          category: 'Retraining',
          training_duration: '',
          training_material: '',
          trainer_name: 'QA Trainer',
          assessment_required: true,
          passing_percentage: 80,
          retraining_frequency: 'On Revision',
          status: 'Active',
          linked_document_id: link.document_id as string,
        }, actor);
        masterId = master.id;
      }

      for (const emp of deptEmployees) {
        await createAssignment({
          training_master_id: masterId,
          employee_id: emp.id,
          employee_name: emp.full_name,
          department: emp.department,
          designation: emp.designation,
          assigned_date: now().split('T')[0],
          due_date: dueDate,
          trainer_name: 'QA Trainer',
        }, actor, { source: 'dms_revision', sourceRef: link.document_id as string });
        count++;
      }

      await updateDoc(d.ref, { status: 'assigned', updated_at: now() });
    }
  } catch (e) { console.error('DMS sync failed:', e); }
  return count;
}

export async function assignFromChangeControl(changeId: string, actor: TmsActor): Promise<number> {
  let count = 0;
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.changeControls, changeId));
    if (!snap.exists()) return 0;
    const cc = snap.data();
    if (!cc.training_impact) return 0;

    const employees = await listEmployees().then((e) => e.filter((x) => x.department === cc.department));
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const master = await createTrainingMaster({
      training_title: `CC Training: ${cc.change_title}`,
      training_type: 'Process Training',
      department: cc.department as string,
      category: 'Initial',
      training_duration: '',
      training_material: '',
      trainer_name: 'QA Trainer',
      assessment_required: true,
      passing_percentage: 80,
      retraining_frequency: 'One-time',
      status: 'Active',
      linked_change_control_id: changeId,
    }, actor);

    for (const emp of employees) {
      await createAssignment({
        training_master_id: master.id,
        employee_id: emp.id,
        employee_name: emp.full_name,
        department: emp.department,
        designation: emp.designation,
        assigned_date: now().split('T')[0],
        due_date: dueDate,
        trainer_name: 'QA Trainer',
      }, actor, { source: 'change_control', sourceRef: changeId });
      count++;
    }
  } catch (e) { console.error('CC training assign failed:', e); }
  return count;
}

export async function assignFromCapa(capaId: string, actor: TmsActor): Promise<number> {
  let count = 0;
  try {
    const snap = await getDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.capa, capaId));
    if (!snap.exists()) return 0;
    const capa = snap.data();

    const employees = await listEmployees();
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const master = await createTrainingMaster({
      training_title: `CAPA Training: ${capa.capa_title || capa.capa_number}`,
      training_type: 'CAPA Training',
      department: (capa.department as string) || 'QA',
      category: 'Initial',
      training_duration: '',
      training_material: '',
      trainer_name: 'QA Trainer',
      assessment_required: true,
      passing_percentage: 80,
      retraining_frequency: 'One-time',
      status: 'Active',
      linked_capa_id: capaId,
    }, actor);

    const deptEmployees = employees.filter((e) => e.department === capa.department);
    for (const emp of deptEmployees.length > 0 ? deptEmployees : employees.slice(0, 5)) {
      await createAssignment({
        training_master_id: master.id,
        employee_id: emp.id,
        employee_name: emp.full_name,
        department: emp.department,
        designation: emp.designation,
        assigned_date: now().split('T')[0],
        due_date: dueDate,
        trainer_name: 'QA Trainer',
      }, actor, { source: 'capa', sourceRef: capaId });
      count++;
    }
  } catch (e) { console.error('CAPA training assign failed:', e); }
  return count;
}

// ─── Dashboard & Charts ──────────────────────────────────────────────────────

export function computeDashboardMetrics(
  matrix: TrainingMatrixRow[], assignments: TrainingAssignment[], effectiveness: TrainingEffectiveness[],
): TmsDashboardMetrics {
  const avgCompliance = matrix.length > 0
    ? Math.round(matrix.reduce((s, m) => s + m.compliance_percent, 0) / matrix.length)
    : 0;

  return {
    totalEmployees: matrix.length,
    compliancePercent: avgCompliance,
    pending: assignments.filter((a) => ['pending', 'in_progress'].includes(a.status)).length,
    overdue: assignments.filter((a) => a.status === 'overdue' || isOverdue(a.due_date, a.status)).length,
    effective: effectiveness.filter((e) => e.effectiveness_result === 'Effective').length,
    failedAssessments: assignments.filter((a) => a.pass_fail === 'Fail').length,
    retrainingRequired: assignments.filter((a) => a.status === 'retraining' || a.retraining_of).length,
  };
}

export function tmsChartData(matrix: TrainingMatrixRow[], assignments: TrainingAssignment[], competency: CompetencyRecord[]) {
  const deptCompliance: Record<string, { total: number; count: number }> = {};
  const typeDist: Record<string, number> = {};
  const monthlyTrend: Record<string, number> = {};
  const gapTrend: Record<string, number> = {};

  for (const m of matrix) {
    if (!deptCompliance[m.department]) deptCompliance[m.department] = { total: 0, count: 0 };
    deptCompliance[m.department].total += m.compliance_percent;
    deptCompliance[m.department].count++;
  }

  for (const a of assignments) {
    typeDist[a.training_type] = (typeDist[a.training_type] || 0) + 1;
    if (a.completion_date) {
      const month = a.completion_date.slice(0, 7);
      monthlyTrend[month] = (monthlyTrend[month] || 0) + 1;
    }
  }

  for (const c of competency) {
    if (c.gap !== 'None') {
      gapTrend[c.department] = (gapTrend[c.department] || 0) + 1;
    }
  }

  return {
    deptCompliance: Object.entries(deptCompliance).map(([name, v]) => ({
      name, value: Math.round(v.total / v.count),
    })),
    typeDist: Object.entries(typeDist).map(([name, value]) => ({ name, value })),
    monthlyTrend: Object.entries(monthlyTrend).sort().map(([month, count]) => ({ month, count })),
    gapTrend: Object.entries(gapTrend).map(([name, value]) => ({ name, value })),
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export async function exportMatrixCsv(matrix: TrainingMatrixRow[]) {
  downloadCsv(
    `training-matrix-${now().split('T')[0]}.csv`,
    ['Employee ID', 'Name', 'Department', 'Designation', 'Required', 'Completed', 'Pending', 'Overdue', 'Compliance %'],
    matrix.map((m) => [
      m.employee_id, m.employee_name, m.department, m.designation,
      m.required_trainings.length, m.completed_trainings.length,
      m.pending_trainings.length, m.overdue_trainings.length, m.compliance_percent,
    ]),
  );
}

export async function exportAssignmentsCsv(assignments: TrainingAssignment[]) {
  downloadCsv(
    `training-assignments-${now().split('T')[0]}.csv`,
    [
      'Assignment ID', 'Training #', 'Employee', 'Employee ID', 'Department', 'Designation',
      'Topic', 'Type', 'Document #', 'SOP Version', 'Assigned', 'Due', 'Mode', 'Trainer',
      'Status', 'Completion', 'Effectiveness Req', 'Source', 'Remarks',
    ],
    assignments.map((a) => [
      a.training_assignment_id || a.training_number,
      a.training_number,
      a.employee_name,
      a.employee_id,
      a.department,
      a.designation,
      a.training_topic || a.training_title,
      a.training_type,
      a.document_number || '',
      a.sop_version || '',
      a.assigned_date,
      a.due_date,
      a.training_mode || '',
      a.trainer_name,
      toTrainingAssignmentStatus(a.training_status ?? a.status),
      a.completion_date || '',
      a.effectiveness_required ? 'Yes' : 'No',
      a.source?.replace(/_/g, ' ') || 'manual',
      a.remarks || '',
    ]),
  );
}

export async function uploadTrainingMaterial(masterId: string, file: File, actor: TmsActor): Promise<string> {
  const path = `training/${masterId}/${Date.now()}_${file.name}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateTrainingMaster(masterId, { training_material: url }, actor);
  await audit(actor, 'UPLOAD_MATERIAL', masterId, null, { file_name: file.name });
  return url;
}

export async function listSchedules(): Promise<TrainingAssignment[]> {
  return listAssignments({ status: 'pending' });
}
