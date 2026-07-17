import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { withFirestoreFallback, shouldSkipFirestore } from '@/lib/firestore-resilience';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import {
  createAssignment, createTrainingMaster, listAssignments, listEmployees, listTrainingMaster,
} from '@/lib/training-service';
import {
  COMPANY_TRAINING_MODULE, COMPANY_TRAINING_COLLECTIONS,
  type CompanyTrainingActor, type CompanyTrainingDashboard,
  type TrainerCertification, type TrainerAssessmentChecklist,
  type InductionRecord, type TniRecord, type JobDescription,
  type OjtTrainingPlan, type OjtCompetencyMatrixEntry, type SrdDeclaration,
  type InductionStatus, type TniStatus, type OjtStatus, type SrdStatus,
  type EvaluationMethod,
  SRD_MIN_DESIGNATIONS,
  generateCertNumber, generateInductionNumber, generateTniNumber,
  generateOjtNumber, generateSrdNumber,
} from '@/lib/company-training-types';
import {
  SEED_TRAINER_CERTIFICATIONS, SEED_INDUCTION_RECORDS, SEED_TNI_RECORDS,
  SEED_JOB_DESCRIPTIONS, SEED_OJT_PLANS, SEED_OJT_MATRIX, SEED_SRD_DECLARATIONS,
  computeCompanyTrainingDashboard, computeTrainerAssessmentScore,
  TRAINER_ASSESSMENT_CHECKLIST,
} from '@/lib/company-training-records';

export type {
  CompanyTrainingDashboard, TrainerCertification, InductionRecord,
  TniRecord, OjtTrainingPlan, SrdDeclaration, JobDescription,
};

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function db() { return getFirebaseFirestore(); }

// Demo records are opt-in so production never presents fabricated GMP records.
const demoDataEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === 'true';
let memTrainers = demoDataEnabled ? [...SEED_TRAINER_CERTIFICATIONS] : [];
let memInductions = demoDataEnabled ? [...SEED_INDUCTION_RECORDS] : [];
let memTnis = demoDataEnabled ? [...SEED_TNI_RECORDS] : [];
let memJds = demoDataEnabled ? [...SEED_JOB_DESCRIPTIONS] : [];
let memOjtPlans = demoDataEnabled ? [...SEED_OJT_PLANS] : [];
let memOjtMatrix = demoDataEnabled ? [...SEED_OJT_MATRIX] : [];
let memSrds = demoDataEnabled ? [...SEED_SRD_DECLARATIONS] : [];
let memAssessments: TrainerAssessmentChecklist[] = [];

async function audit(actor: CompanyTrainingActor, action: string, recordId: string, collection: string, detail?: unknown) {
  try {
    await logTrainingAuditRecord(actor, action, recordId, collection, null, detail, { moduleName: COMPANY_TRAINING_MODULE });
  } catch { /* optional */ }
}

// ─── List / Dashboard ────────────────────────────────────────────

export async function fetchCompanyTrainingDashboard(): Promise<CompanyTrainingDashboard> {
  if (shouldSkipFirestore()) {
    return computeCompanyTrainingDashboard(memTrainers, memInductions, memTnis, memOjtPlans, memSrds);
  }
  const [trainers, inductions, tnis, ojtPlans, srds] = await Promise.all([
    listTrainerCertifications(), listInductionRecords(), listTniRecords(),
    listOjtPlans(), listSrdDeclarations(),
  ]);
  return computeCompanyTrainingDashboard(trainers, inductions, tnis, ojtPlans, srds);
}

// ─── Trainer Certifications ──────────────────────────────────────

export async function listTrainerCertifications(max = 200): Promise<TrainerCertification[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(
      collection(db(), COMPANY_TRAINING_COLLECTIONS.trainerCertifications),
      orderBy('created_at', 'desc'), limit(max),
    ));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerCertification));
    if (items.length > 0) memTrainers = items;
    return items.length > 0 ? items : memTrainers;
  }, memTrainers);
}

export async function createTrainerCertification(
  actor: CompanyTrainingActor,
  input: Partial<TrainerCertification>,
): Promise<TrainerCertification> {
  const record: TrainerCertification = {
    id: `ttc-${Date.now()}`,
    certification_number: generateCertNumber(),
    employee_id: input.employee_id || '',
    employee_name: input.employee_name || '',
    department: input.department || '',
    designation: input.designation || '',
    subject_areas: input.subject_areas || [],
    assessment_score: input.assessment_score ?? null,
    passing_score: input.passing_score ?? 80,
    checklist_scores: input.checklist_scores || {},
    certified_by: actor.id,
    certified_by_name: actor.name,
    certification_date: input.certification_date || today(),
    expiry_date: input.expiry_date || '',
    status: input.status || 'Draft',
    certificate_url: null,
    remarks: input.remarks || '',
    created_at: now(), updated_at: now(),
    created_by: actor.id, created_by_name: actor.name,
  };

  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), COMPANY_TRAINING_COLLECTIONS.trainerCertifications), record);
    record.id = ref.id;
  } else {
    memTrainers = [record, ...memTrainers];
  }
  await audit(actor, 'Trainer Certification Created', record.id, COMPANY_TRAINING_COLLECTIONS.trainerCertifications, record);
  return record;
}

export async function submitTrainerAssessment(
  actor: CompanyTrainingActor,
  trainerId: string,
  trainerName: string,
  scores: Record<string, number>,
  remarks = '',
): Promise<TrainerAssessmentChecklist> {
  const { total, max, percent, result } = computeTrainerAssessmentScore(scores);
  const items = TRAINER_ASSESSMENT_CHECKLIST.map((item) => ({
    item_id: item.id, label: item.label,
    score: scores[item.id] ?? 0, max_score: item.weight, remarks: '',
  }));

  const assessment: TrainerAssessmentChecklist = {
    id: `tta-${Date.now()}`,
    trainer_id: trainerId, trainer_name: trainerName,
    assessor_id: actor.id, assessor_name: actor.name,
    assessment_date: today(), items, total_score: total, max_total: max,
    result, remarks, created_at: now(),
  };

  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), COMPANY_TRAINING_COLLECTIONS.trainerAssessments), assessment);
    assessment.id = ref.id;
  } else {
    memAssessments = [assessment, ...memAssessments];
  }

  if (result === 'Pass') {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 2);
    await createTrainerCertification(actor, {
      employee_id: trainerId, employee_name: trainerName,
      assessment_score: percent, status: 'Certified',
      expiry_date: expiry.toISOString().slice(0, 10),
      checklist_scores: scores,
    });
  }

  await audit(actor, 'Trainer Assessment Submitted', assessment.id, COMPANY_TRAINING_COLLECTIONS.trainerAssessments, assessment);
  return assessment;
}

// ─── Induction Workflow ──────────────────────────────────────────

export async function listInductionRecords(max = 200): Promise<InductionRecord[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(
      collection(db(), COMPANY_TRAINING_COLLECTIONS.inductionRecords),
      orderBy('created_at', 'desc'), limit(max),
    ));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InductionRecord));
    if (items.length > 0) memInductions = items;
    return items.length > 0 ? items : memInductions;
  }, memInductions);
}

export async function createInductionRecord(
  actor: CompanyTrainingActor,
  input: Partial<InductionRecord>,
): Promise<InductionRecord> {
  const record: InductionRecord = {
    id: `ind-${Date.now()}`,
    induction_number: generateInductionNumber(),
    employee_id: input.employee_id || '',
    employee_name: input.employee_name || '',
    department: input.department || '',
    designation: input.designation || '',
    joining_date: input.joining_date || today(),
    current_stage: 'HR Induction',
    status: 'HR In Progress',
    hr_conducted_by: actor.id,
    hr_conducted_by_name: actor.name,
    hr_conducted_date: null,
    dept_head_id: input.dept_head_id || '',
    dept_head_name: input.dept_head_name || '',
    dept_handover_date: null,
    training_coordinator_id: input.training_coordinator_id || '',
    training_coordinator_name: input.training_coordinator_name || '',
    jd_id: null, jd_number: '', tni_id: null, tni_number: '',
    sop_assignments: [],
    evaluation_methods: ['Questionnaire', 'Training Attendance Record', 'Training Record'],
    remarks: input.remarks || '',
    created_at: now(), updated_at: now(),
    created_by: actor.id, created_by_name: actor.name,
  };

  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), COMPANY_TRAINING_COLLECTIONS.inductionRecords), record);
    record.id = ref.id;
  } else {
    memInductions = [record, ...memInductions];
  }
  await audit(actor, 'Induction Created', record.id, COMPANY_TRAINING_COLLECTIONS.inductionRecords, record);
  return record;
}

export async function advanceInductionStage(
  actor: CompanyTrainingActor,
  id: string,
  newStatus: InductionStatus,
  updates: Partial<InductionRecord> = {},
): Promise<void> {
  const stageMap: Record<string, string> = {
    'HR In Progress': 'HR Induction',
    'Pending Dept Head': 'Department Handover',
    'Pending TC': 'JD Preparation',
    'TNI In Progress': 'TNI Preparation',
    'SOP Assigned': 'SOP Training Assignment',
    'Completed': 'Completed',
  };

  const patch: Partial<InductionRecord> = {
    status: newStatus,
    current_stage: stageMap[newStatus] ?? updates.current_stage ?? newStatus,
    updated_at: now(),
    ...updates,
  };

  if (isFirebaseConfigured()) {
    await updateDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.inductionRecords, id), patch);
  } else {
    memInductions = memInductions.map((r) => r.id === id ? { ...r, ...patch } as InductionRecord : r);
  }
  await audit(actor, `Induction Advanced to ${newStatus}`, id, COMPANY_TRAINING_COLLECTIONS.inductionRecords, patch);
}

export async function completeHrInduction(actor: CompanyTrainingActor, id: string): Promise<void> {
  await advanceInductionStage(actor, id, 'Pending Dept Head', {
    hr_conducted_by: actor.id,
    hr_conducted_by_name: actor.name,
    hr_conducted_date: today(),
  });
}

export async function completeDeptHandover(actor: CompanyTrainingActor, id: string): Promise<void> {
  await advanceInductionStage(actor, id, 'Pending TC', {
    dept_head_id: actor.id,
    dept_head_name: actor.name,
    dept_handover_date: today(),
  });
}

// ─── TNI ─────────────────────────────────────────────────────────

export async function listTniRecords(max = 200): Promise<TniRecord[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(
      collection(db(), COMPANY_TRAINING_COLLECTIONS.tniRecords),
      orderBy('created_at', 'desc'), limit(max),
    ));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TniRecord));
    if (items.length > 0) memTnis = items;
    return items.length > 0 ? items : memTnis;
  }, memTnis);
}

export async function listJobDescriptions(max = 100): Promise<JobDescription[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(
      collection(db(), COMPANY_TRAINING_COLLECTIONS.jobDescriptions),
      orderBy('created_at', 'desc'), limit(max),
    ));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as JobDescription));
    if (items.length > 0) memJds = items;
    return items.length > 0 ? items : memJds;
  }, memJds);
}

export async function createTniFromJd(
  actor: CompanyTrainingActor,
  jd: JobDescription,
  employeeId?: string,
  employeeName?: string,
): Promise<TniRecord> {
  const trainingNeeds = jd.linked_sops.map((sop) => ({
    sop_number: sop.sop_number,
    sop_title: sop.sop_title,
    training_type: 'Training of New Joinee',
    priority: 'High' as const,
    evaluation_methods: ['Questionnaire', 'Training Attendance Record', 'Training Record'] as EvaluationMethod[],
    remarks: `Derived from JD ${jd.jd_number}`,
  }));

  const record: TniRecord = {
    id: `tni-${Date.now()}`,
    tni_number: generateTniNumber(),
    jd_id: jd.id, jd_number: jd.jd_number,
    department: jd.department, designation: jd.designation,
    employee_id: employeeId || null, employee_name: employeeName || null,
    training_needs: trainingNeeds,
    prepared_by: actor.id, prepared_by_name: actor.name,
    reviewed_by: null, reviewed_by_name: null,
    status: 'Pending Review', sop_mapped: true, training_assigned: false,
    created_at: now(), updated_at: now(),
  };

  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), COMPANY_TRAINING_COLLECTIONS.tniRecords), record);
    record.id = ref.id;
  } else {
    memTnis = [record, ...memTnis];
  }
  await audit(actor, 'TNI Created from JD', record.id, COMPANY_TRAINING_COLLECTIONS.tniRecords, record);
  return record;
}

export async function approveTni(actor: CompanyTrainingActor, id: string): Promise<void> {
  if (!['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(actor.role)) {
    throw new Error('You are not authorized to approve TNI records');
  }
  const records = await listTniRecords();
  const tni = records.find((record) => record.id === id);
  if (!tni) throw new Error('TNI record not found');
  if (tni.status !== 'Pending Review') throw new Error(`TNI cannot be approved from status "${tni.status}"`);

  const allEmployees = await listEmployees();
  const targetEmployees = tni.employee_id
    ? allEmployees.filter((employee) => employee.id === tni.employee_id || employee.employee_id === tni.employee_id)
    : allEmployees.filter((employee) =>
      employee.department === tni.department
      && (!tni.designation || employee.designation === tni.designation));
  if (targetEmployees.length === 0) {
    throw new Error('No matching employee was found for this TNI');
  }

  const [masters, assignments, jobDescriptions] = await Promise.all([
    listTrainingMaster(),
    listAssignments(),
    listJobDescriptions(),
  ]);
  const jd = jobDescriptions.find((item) => item.id === tni.jd_id);
  const assignedDate = today();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);
  let assignedCount = 0;

  for (const need of tni.training_needs) {
    const linkedDocumentId = jd?.linked_sops.find((sop) => sop.sop_number === need.sop_number)?.document_id ?? null;
    let master = masters.find((item) =>
      item.department === tni.department
      && (
        (linkedDocumentId && item.linked_document_id === linkedDocumentId)
        || item.training_title === need.sop_title
      ));
    if (!master) {
      master = await createTrainingMaster({
        training_title: need.sop_title,
        training_type: 'SOP Training',
        department: tni.department as Parameters<typeof createTrainingMaster>[0]['department'],
        category: 'Training of New Joinee',
        training_duration: '',
        trainer_name: actor.name,
        training_material: need.sop_number,
        assessment_required: need.evaluation_methods.includes('Questionnaire'),
        passing_percentage: 80,
        retraining_frequency: 'On revision',
        status: 'Active',
        linked_document_id: linkedDocumentId,
        effectiveness_required: false,
      }, actor);
      masters.push(master);
    }

    for (const employee of targetEmployees) {
      const duplicate = assignments.some((assignment) =>
        assignment.training_master_id === master!.id
        && (assignment.employee_id === employee.id || assignment.employee_id === employee.employee_id)
        && !['completed', 'cancelled', 'failed'].includes(String(assignment.status).toLowerCase()));
      if (duplicate) continue;
      const assignment = await createAssignment({
        training_master_id: master.id,
        employee_id: employee.id,
        employee_name: employee.full_name,
        department: employee.department,
        designation: employee.designation,
        training_topic: need.sop_title,
        training_type: 'SOP Training',
        assigned_date: assignedDate,
        due_date: dueDate.toISOString().slice(0, 10),
        trainer_name: actor.name,
        training_mode: 'Classroom',
        remarks: `Assigned from ${tni.tni_number}`,
      }, actor, { source: 'TNI', sourceRef: tni.id });
      assignments.push(assignment);
      assignedCount++;
    }
  }

  const patch = {
    status: 'Training Assigned' as TniStatus,
    reviewed_by: actor.id, reviewed_by_name: actor.name,
    training_assigned: true,
    updated_at: now(),
  };
  if (isFirebaseConfigured()) {
    await updateDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.tniRecords, id), patch);
  } else {
    memTnis = memTnis.map((r) => r.id === id ? { ...r, ...patch } : r);
  }
  if (tni.employee_id) {
    const induction = (await listInductionRecords()).find((record) =>
      record.employee_id === tni.employee_id && record.status !== 'Completed');
    if (induction) {
      await advanceInductionStage(actor, induction.id, 'SOP Assigned', {
        tni_id: tni.id,
        tni_number: tni.tni_number,
        sop_assignments: tni.training_needs.map((need) => need.sop_number),
      });
    }
  }
  await audit(actor, 'TNI Approved and Training Assigned', id, COMPANY_TRAINING_COLLECTIONS.tniRecords, {
    ...patch,
    assignments_created: assignedCount,
  });
}

// ─── OJT Planner ─────────────────────────────────────────────────

export async function listOjtPlans(max = 200): Promise<OjtTrainingPlan[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(
      collection(db(), COMPANY_TRAINING_COLLECTIONS.ojtPlans),
      orderBy('created_at', 'desc'), limit(max),
    ));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OjtTrainingPlan));
    if (items.length > 0) memOjtPlans = items;
    return items.length > 0 ? items : memOjtPlans;
  }, memOjtPlans);
}

export async function listOjtMatrix(max = 100): Promise<OjtCompetencyMatrixEntry[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), COMPANY_TRAINING_COLLECTIONS.ojtMatrix), limit(max)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OjtCompetencyMatrixEntry));
    if (items.length > 0) memOjtMatrix = items;
    return items.length > 0 ? items : memOjtMatrix;
  }, memOjtMatrix);
}

export async function createOjtPlan(
  actor: CompanyTrainingActor,
  input: Partial<OjtTrainingPlan>,
): Promise<OjtTrainingPlan> {
  const record: OjtTrainingPlan = {
    id: `ojt-${Date.now()}`,
    plan_number: generateOjtNumber(),
    employee_id: input.employee_id || '',
    employee_name: input.employee_name || '',
    department: input.department || '',
    designation: input.designation || '',
    mentor_id: input.mentor_id || '',
    mentor_name: input.mentor_name || '',
    training_area: input.training_area || '',
    sop_number: input.sop_number || '',
    sop_title: input.sop_title || '',
    planned_start: input.planned_start || today(),
    planned_end: input.planned_end || '',
    actual_start: null, actual_end: null,
    tasks: input.tasks || [],
    status: 'Planned',
    mentor_remarks: '', qa_remarks: '',
    created_at: now(), updated_at: now(),
  };

  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), COMPANY_TRAINING_COLLECTIONS.ojtPlans), record);
    record.id = ref.id;
  } else {
    memOjtPlans = [record, ...memOjtPlans];
  }
  await audit(actor, 'OJT Plan Created', record.id, COMPANY_TRAINING_COLLECTIONS.ojtPlans, record);
  return record;
}

export async function updateOjtTaskStatus(
  actor: CompanyTrainingActor,
  planId: string,
  taskNumber: number,
  status: 'Pending' | 'In Progress' | 'Completed' | 'N/A',
  mentorSignOff = false,
): Promise<void> {
  let plan = memOjtPlans.find((item) => item.id === planId);
  if (!plan && isFirebaseConfigured()) {
    const snapshot = await getDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.ojtPlans, planId));
    if (snapshot.exists()) plan = { id: snapshot.id, ...snapshot.data() } as OjtTrainingPlan;
  }
  if (!plan) throw new Error('OJT plan not found');
  const canSign = actor.id === plan.mentor_id
    || ['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(actor.role);
  if (!canSign) throw new Error('Only the assigned mentor or QA can update OJT tasks');
  if (status === 'Completed' && !mentorSignOff) {
    throw new Error('Mentor sign-off is required to complete an OJT task');
  }

  const tasks = plan.tasks.map((t) =>
    t.task_number === taskNumber
      ? { ...t, status, mentor_sign_off: mentorSignOff, sign_off_date: mentorSignOff ? today() : t.sign_off_date }
      : t,
  );
  const allDone = tasks.every((t) =>
    t.status === 'N/A' || (t.status === 'Completed' && t.mentor_sign_off));
  const patch = {
    tasks,
    status: (allDone ? 'Completed' : 'In Progress') as OjtStatus,
    actual_start: plan.actual_start || today(),
    actual_end: allDone ? today() : null,
    updated_at: now(),
  };

  if (isFirebaseConfigured()) {
    await updateDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.ojtPlans, planId), patch);
  } else {
    memOjtPlans = memOjtPlans.map((p) => p.id === planId ? { ...p, ...patch } : p);
  }
  await audit(actor, 'OJT Task Updated', planId, COMPANY_TRAINING_COLLECTIONS.ojtPlans, { taskNumber, status });
}

// ─── SRD ─────────────────────────────────────────────────────────

export async function listSrdDeclarations(max = 200): Promise<SrdDeclaration[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(
      collection(db(), COMPANY_TRAINING_COLLECTIONS.srdDeclarations),
      orderBy('created_at', 'desc'), limit(max),
    ));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SrdDeclaration));
    if (items.length > 0) memSrds = items;
    return items.length > 0 ? items : memSrds;
  }, memSrds);
}

export async function createSrdDeclaration(
  actor: CompanyTrainingActor,
  input: Partial<SrdDeclaration>,
): Promise<SrdDeclaration> {
  const employeeId = input.employee_id || actor.id;
  const canCreateForOthers = ['super_admin', 'admin', 'head_qa', 'qa_manager', 'training_coordinator'].includes(actor.role);
  if (employeeId !== actor.id && !canCreateForOthers) {
    throw new Error('You are not authorized to create declarations for another employee');
  }
  if (!input.document_number?.trim() || !input.document_title?.trim() || !input.document_version?.trim()) {
    throw new Error('Document number, title, and version are required');
  }
  if (!input.designation || !SRD_MIN_DESIGNATIONS.includes(input.designation as typeof SRD_MIN_DESIGNATIONS[number])) {
    throw new Error('Self-reading declarations are only permitted for configured eligible designations');
  }
  const record: SrdDeclaration = {
    id: `srd-${Date.now()}`,
    declaration_number: generateSrdNumber(),
    employee_id: employeeId,
    employee_name: input.employee_name || actor.name,
    department: input.department || '',
    designation: input.designation || '',
    document_number: input.document_number || '',
    document_title: input.document_title || '',
    document_version: input.document_version || '',
    sop_number: input.sop_number || input.document_number || '',
    reading_date: input.reading_date || today(),
    declaration_text: 'I have read and understood the above SOP in its entirety and agree to comply with its requirements.',
    employee_signature: null, employee_signed_date: null,
    qa_reviewer_id: null, qa_reviewer_name: null, qa_review_date: null,
    status: 'Pending Declaration',
    remarks: input.remarks || '',
    created_at: now(), updated_at: now(),
  };

  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), COMPANY_TRAINING_COLLECTIONS.srdDeclarations), record);
    record.id = ref.id;
  } else {
    memSrds = [record, ...memSrds];
  }
  await audit(actor, 'SRD Created', record.id, COMPANY_TRAINING_COLLECTIONS.srdDeclarations, record);
  return record;
}

export async function signSrdDeclaration(actor: CompanyTrainingActor, id: string): Promise<void> {
  let declaration = memSrds.find((record) => record.id === id);
  if (!declaration && isFirebaseConfigured()) {
    const snapshot = await getDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.srdDeclarations, id));
    if (snapshot.exists()) declaration = { id: snapshot.id, ...snapshot.data() } as SrdDeclaration;
  }
  if (!declaration) throw new Error('Self-reading declaration not found');
  if (declaration.employee_id !== actor.id) {
    throw new Error('You can only sign your own self-reading declaration');
  }
  if (declaration.status !== 'Pending Declaration') {
    throw new Error(`Declaration cannot be signed from status "${declaration.status}"`);
  }
  const patch = {
    employee_signature: actor.name,
    employee_signed_date: today(),
    status: 'Declared' as SrdStatus,
    updated_at: now(),
  };
  if (isFirebaseConfigured()) {
    await updateDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.srdDeclarations, id), patch);
  } else {
    memSrds = memSrds.map((r) => r.id === id ? { ...r, ...patch } : r);
  }
  await audit(actor, 'SRD Signed', id, COMPANY_TRAINING_COLLECTIONS.srdDeclarations, patch);
}

export async function approveSrdDeclaration(actor: CompanyTrainingActor, id: string): Promise<void> {
  if (!['super_admin', 'admin', 'head_qa', 'qa_manager', 'qa_executive', 'qa'].includes(actor.role)) {
    throw new Error('Only QA may approve a self-reading declaration');
  }
  let declaration = memSrds.find((record) => record.id === id);
  if (!declaration && isFirebaseConfigured()) {
    const snapshot = await getDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.srdDeclarations, id));
    if (snapshot.exists()) declaration = { id: snapshot.id, ...snapshot.data() } as SrdDeclaration;
  }
  if (!declaration) throw new Error('Self-reading declaration not found');
  if (declaration.status !== 'Declared') {
    throw new Error('Employee declaration is required before QA approval');
  }
  const patch = {
    qa_reviewer_id: actor.id, qa_reviewer_name: actor.name,
    qa_review_date: today(), status: 'Approved' as SrdStatus,
    updated_at: now(),
  };
  if (isFirebaseConfigured()) {
    await updateDoc(doc(db(), COMPANY_TRAINING_COLLECTIONS.srdDeclarations, id), patch);
  } else {
    memSrds = memSrds.map((r) => r.id === id ? { ...r, ...patch } : r);
  }
  await audit(actor, 'SRD Approved', id, COMPANY_TRAINING_COLLECTIONS.srdDeclarations, patch);
}

export { TRAINER_ASSESSMENT_CHECKLIST, computeTrainerAssessmentScore };
