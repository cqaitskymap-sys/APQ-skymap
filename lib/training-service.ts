import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import {
  TMS_COLLECTIONS, type TrainingMaster, type TrainingAssignment, type AssessmentQuestion,
  type AssessmentAttempt, type TrainingEffectiveness, type TrainingMatrixRow,
  type CompetencyRecord, type TmsFilters, type TmsDashboardMetrics, type TmsActor,
  type EmployeeProfile, calcCompliance, isOverdue, calcPassFail,
} from './training-types';
import type {
  TrainingMasterInput, AssignmentInput, QuestionInput, EffectivenessInput, CompetencyInput,
} from './training-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: TmsActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Training', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
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
  const trainingCode = await generateTrainingCode();
  const timestamp = now();
  const record: Omit<TrainingMaster, 'id'> = {
    training_code: trainingCode,
    training_title: input.training_title,
    training_type: input.training_type,
    department: input.department,
    category: input.category,
    training_duration: input.training_duration,
    trainer_name: input.trainer_name,
    training_material: input.training_material,
    assessment_required: input.assessment_required,
    passing_percentage: input.passing_percentage,
    retraining_frequency: input.retraining_frequency,
    status: input.status,
    linked_document_id: input.linked_document_id || null,
    linked_capa_id: input.linked_capa_id || null,
    linked_change_control_id: input.linked_change_control_id || null,
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

export async function createAssignment(
  input: AssignmentInput, actor: TmsActor,
  options?: { source?: string; sourceRef?: string; retrainingOf?: string },
): Promise<TrainingAssignment> {
  const master = await getTrainingMasterById(input.training_master_id);
  if (!master) throw new Error('Training master not found');

  const trainingNumber = await generateAssignmentNumber();
  const record: Omit<TrainingAssignment, 'id'> = {
    training_number: trainingNumber,
    training_master_id: input.training_master_id,
    training_title: master.training_title,
    training_type: master.training_type,
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    department: input.department,
    designation: input.designation,
    assigned_date: input.assigned_date,
    due_date: input.due_date,
    completion_date: null,
    assessment_score: null,
    pass_fail: null,
    trainer_name: input.trainer_name || master.trainer_name,
    status: 'pending',
    source: options?.source || 'manual',
    source_ref: options?.sourceRef || null,
    retraining_of: options?.retrainingOf || null,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_at: now(),
  };

  const refDoc = await addDoc(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments), record);
  await audit(actor, 'ASSIGN', refDoc.id, null, record);
  await notify('Training Assigned', `${master.training_title} assigned to ${input.employee_name}`, refDoc.id, ['qa_manager']);
  return { id: refDoc.id, ...record };
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
    updated_at: now(),
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
  await notify('Retraining Required', `${failed.employee_name} failed ${failed.training_title} — retraining assigned`, failed.id, ['qa_manager', 'head_qa']);
}

export async function syncOverdueAssignments(): Promise<number> {
  let count = 0;
  const today = now().split('T')[0];
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.assignments));
    for (const d of snap.docs) {
      const data = d.data() as TrainingAssignment;
      if (['pending', 'in_progress'].includes(data.status) && data.due_date < today) {
        await updateDoc(d.ref, { status: 'overdue', updated_at: now() });
        count++;
      }
    }
  } catch { /* ignore */ }
  return count;
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

// ─── Training Matrix ─────────────────────────────────────────────────────────

export async function buildTrainingMatrix(): Promise<TrainingMatrixRow[]> {
  const [employees, assignments, masters] = await Promise.all([
    listEmployees(), listAssignments(), listTrainingMaster({ status: 'Active' }),
  ]);

  const matrix: TrainingMatrixRow[] = [];

  for (const emp of employees) {
    const deptMasters = masters.filter((m) => m.department === emp.department || m.department === 'QA');
    const required = deptMasters.map((m) => m.training_title);
    const empAssignments = assignments.filter((a) => a.employee_id === emp.id || a.employee_id === emp.employee_id);

    const completed = empAssignments
      .filter((a) => a.status === 'completed')
      .map((a) => a.training_title);
    const pending = empAssignments
      .filter((a) => ['pending', 'in_progress'].includes(a.status))
      .map((a) => a.training_title);
    const overdue = empAssignments
      .filter((a) => a.status === 'overdue' || isOverdue(a.due_date, a.status))
      .map((a) => a.training_title);

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
      await updateDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.matrix, emp.id), row).catch(async () => {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(getFirebaseFirestore(), TMS_COLLECTIONS.matrix, emp.id), row);
      });
    } catch { /* optional persist */ }
  }

  return matrix;
}

export async function getTrainingMatrix(): Promise<TrainingMatrixRow[]> {
  try {
    const snap = await getDocs(collection(getFirebaseFirestore(), TMS_COLLECTIONS.matrix));
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
    ['Number', 'Title', 'Employee', 'Department', 'Assigned', 'Due', 'Completed', 'Score', 'Pass/Fail', 'Status'],
    assignments.map((a) => [
      a.training_number, a.training_title, a.employee_name, a.department,
      a.assigned_date, a.due_date, a.completion_date || '', a.assessment_score ?? '', a.pass_fail || '', a.status,
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
