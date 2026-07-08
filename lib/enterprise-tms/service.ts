import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { withFirestoreFallback, shouldSkipFirestore } from '@/lib/firestore-resilience';
import { logTrainingAuditRecord } from '@/lib/training-audit-trail-service';
import { assignFromCapa, assignFromChangeControl } from '@/lib/training-service';
import { autoCreateFromCapa, autoCreateFromDeviation } from '@/lib/training-retraining-service';
import { createInductionRecord } from '@/lib/company-training-service';
import {
  ENTERPRISE_TMS_MODULE, ENTERPRISE_TMS_COLLECTIONS, DEFAULT_TRAINING_SETTINGS,
  generatePlanNumber, generateRequestNumber, generateNeedBasedNumber,
  type EnterpriseTmsActor, type AnnualTrainingPlan, type TrainingRequest,
  type QuestionBankItem, type Questionnaire, type PracticalAssessment,
  type NeedBasedTrainingRecord, type ExternalTrainingRecord,
  type TrainerQualification, type TrainerRenewal, type TrainingSettings,
  type TrainingAutomationLog, type EnterpriseTmsDashboard, type NeedBasedTrigger,
} from './types';

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function db() { return getFirebaseFirestore(); }

async function audit(actor: EnterpriseTmsActor, action: string, id: string, col: string, detail?: unknown) {
  try {
    await logTrainingAuditRecord(actor, action, id, col, null, detail, { moduleName: ENTERPRISE_TMS_MODULE });
  } catch { /* optional */ }
}

// ─── In-memory stores ────────────────────────────────────────────

let memSettings: TrainingSettings = { ...DEFAULT_TRAINING_SETTINGS };
let memAnnualPlans: AnnualTrainingPlan[] = [];
let memRequests: TrainingRequest[] = [];
let memQuestionBank: QuestionBankItem[] = [];
let memQuestionnaires: Questionnaire[] = [];
let memPractical: PracticalAssessment[] = [];
let memNeedBased: NeedBasedTrainingRecord[] = [];
let memExternal: ExternalTrainingRecord[] = [];
let memTrainerQual: TrainerQualification[] = [];
let memTrainerRenewal: TrainerRenewal[] = [];
let memAutomationLog: TrainingAutomationLog[] = [];

function initSeedData() {
  if (memAnnualPlans.length > 0) return;
  const year = new Date().getFullYear();
  memAnnualPlans = [{
    id: 'atp-001', plan_number: `ATP-${year}-0001`, plan_year: year,
    department: 'QA', title: `${year} QA Annual Training Plan`,
    training_items: [
      { training_type: 'GMP Training', topic: 'Annual GMP Refresher', target_audience: 'All QA', planned_month: 'Q1', trainer: 'Dr. Priya Sharma', duration_hours: 4, status: 'Scheduled' },
      { training_type: 'SOP Training', topic: 'Document Control SOP', target_audience: 'QA Officers', planned_month: 'Q2', trainer: 'Rajesh Kumar', duration_hours: 2, status: 'Planned' },
    ],
    prepared_by: 'tc-001', prepared_by_name: 'Training Coordinator',
    approved_by: 'qa-001', status: 'Approved',
    created_at: now(), updated_at: now(),
  }];
  memRequests = [{
    id: 'trq-001', request_number: generateRequestNumber(),
    requested_by: 'emp-101', requested_by_name: 'Rajesh Kumar',
    department: 'Production', training_type: 'Equipment Training',
    training_topic: 'New Tablet Compression Machine', justification: 'New equipment installed in Line 2',
    target_employees: ['emp-201', 'emp-202'], preferred_date: today(),
    status: 'Pending HOD', approved_by: null, created_at: now(), updated_at: now(),
  }];
  memQuestionBank = [
    { id: 'qb-001', question_code: 'Q-GMP-001', question_text: 'What does GMP stand for?', question_type: 'MCQ', options: ['Good Manufacturing Practice', 'General Manufacturing Process', 'Global Manufacturing Protocol', 'Good Management Practice'], correct_answer: 'Good Manufacturing Practice', passing_weight: 10, training_type: 'GMP Training', sop_number: 'SOP-GMP-001', department: 'All', status: 'Active', created_at: now() },
    { id: 'qb-002', question_code: 'Q-GMP-002', question_text: 'Describe ALCOA+ data integrity principles.', question_type: 'Descriptive', options: [], correct_answer: 'Attributable, Legible, Contemporaneous, Original, Accurate + Complete, Consistent, Enduring, Available', passing_weight: 20, training_type: 'GMP Training', sop_number: 'SOP-GMP-001', department: 'All', status: 'Active', created_at: now() },
  ];
  memNeedBased = [
    { id: 'nbt-001', record_number: generateNeedBasedNumber(), trigger_source: 'CAPA', source_ref: 'CAPA-2026-001', source_title: 'Batch Record Error CAPA', department: 'Production', training_type: 'CAPA Training', training_topic: 'Batch Documentation CAPA Training', assigned_employees: ['emp-201'], due_date: today(), status: 'Assigned', auto_generated: true, created_at: now() },
    { id: 'nbt-002', record_number: generateNeedBasedNumber(), trigger_source: 'Deviation', source_ref: 'DEV-2026-015', source_title: 'Temperature Excursion', department: 'Warehouse', training_type: 'Deviation Training', training_topic: 'Cold Chain Deviation Training', assigned_employees: ['emp-301'], due_date: today(), status: 'Auto-Generated', auto_generated: true, created_at: now() },
  ];
  memExternal = [{
    id: 'ext-001', record_number: 'EXT-2026-0001', employee_id: 'emp-103', employee_name: 'Vikram Singh',
    department: 'QC', training_title: 'HPLC Advanced Techniques Workshop', provider: 'Pharma Training Institute',
    training_type: 'External Workshop', start_date: today(), end_date: today(),
    certificate_received: true, certificate_url: null, cost: 15000, status: 'Completed', created_at: now(),
  }];
  memTrainerQual = [{
    id: 'tq-001', trainer_id: 'emp-101', trainer_name: 'Rajesh Kumar', department: 'QA',
    qualification_type: 'Internal Trainer', experience_years: 8,
    subject_areas: ['GMP', 'SOP Training'], qualification_date: '2024-01-15', expiry_date: '2026-01-15',
    status: 'Expiring Soon', created_at: now(),
  }];
}
initSeedData();

// ─── Settings ────────────────────────────────────────────────────

export async function getTrainingSettings(): Promise<TrainingSettings> {
  if (!isFirebaseConfigured()) return memSettings;
  try {
    const snap = await getDoc(doc(db(), ENTERPRISE_TMS_COLLECTIONS.trainingSettings, 'default'));
    if (snap.exists()) return snap.data() as TrainingSettings;
  } catch { /* fallback */ }
  return memSettings;
}

export async function updateTrainingSettings(actor: EnterpriseTmsActor, settings: Partial<TrainingSettings>): Promise<TrainingSettings> {
  const updated = { ...memSettings, ...settings, updated_at: now(), updated_by: actor.id };
  if (isFirebaseConfigured()) {
    await setDoc(doc(db(), ENTERPRISE_TMS_COLLECTIONS.trainingSettings, 'default'), updated);
  }
  memSettings = updated;
  await audit(actor, 'Settings Updated', 'default', ENTERPRISE_TMS_COLLECTIONS.trainingSettings, settings);
  return updated;
}

// ─── Annual Plan ─────────────────────────────────────────────────

export async function listAnnualPlans(): Promise<AnnualTrainingPlan[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.annualPlans), orderBy('created_at', 'desc'), limit(100)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnnualTrainingPlan));
    if (items.length > 0) memAnnualPlans = items;
    return items.length > 0 ? items : memAnnualPlans;
  }, memAnnualPlans);
}

export async function createAnnualPlan(actor: EnterpriseTmsActor, input: Partial<AnnualTrainingPlan>): Promise<AnnualTrainingPlan> {
  const record: AnnualTrainingPlan = {
    id: `atp-${Date.now()}`, plan_number: generatePlanNumber(),
    plan_year: input.plan_year ?? new Date().getFullYear(),
    department: input.department ?? '', title: input.title ?? '',
    training_items: input.training_items ?? [],
    prepared_by: actor.id, prepared_by_name: actor.name,
    approved_by: null, status: 'Draft',
    created_at: now(), updated_at: now(),
  };
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), ENTERPRISE_TMS_COLLECTIONS.annualPlans), record);
    record.id = ref.id;
  } else { memAnnualPlans = [record, ...memAnnualPlans]; }
  await audit(actor, 'Annual Plan Created', record.id, ENTERPRISE_TMS_COLLECTIONS.annualPlans, record);
  return record;
}

// ─── Training Request ────────────────────────────────────────────

export async function listTrainingRequests(): Promise<TrainingRequest[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.trainingRequests), orderBy('created_at', 'desc'), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingRequest));
    if (items.length > 0) memRequests = items;
    return items.length > 0 ? items : memRequests;
  }, memRequests);
}

export async function createTrainingRequest(actor: EnterpriseTmsActor, input: Partial<TrainingRequest>): Promise<TrainingRequest> {
  const record: TrainingRequest = {
    id: `trq-${Date.now()}`, request_number: generateRequestNumber(),
    requested_by: actor.id, requested_by_name: actor.name,
    department: input.department ?? actor.department ?? '',
    training_type: input.training_type ?? '', training_topic: input.training_topic ?? '',
    justification: input.justification ?? '', target_employees: input.target_employees ?? [],
    preferred_date: input.preferred_date ?? today(),
    status: 'Pending HOD', approved_by: null,
    created_at: now(), updated_at: now(),
  };
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), ENTERPRISE_TMS_COLLECTIONS.trainingRequests), record);
    record.id = ref.id;
  } else { memRequests = [record, ...memRequests]; }
  await audit(actor, 'Training Request Created', record.id, ENTERPRISE_TMS_COLLECTIONS.trainingRequests, record);
  return record;
}

// ─── Question Bank & Questionnaire ───────────────────────────────

export async function listQuestionBank(): Promise<QuestionBankItem[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.questionBank), limit(500)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as QuestionBankItem));
    if (items.length > 0) memQuestionBank = items;
    return items.length > 0 ? items : memQuestionBank;
  }, memQuestionBank);
}

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.questionnaires), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Questionnaire));
    if (items.length > 0) memQuestionnaires = items;
    return items.length > 0 ? items : memQuestionnaires;
  }, memQuestionnaires);
}

// ─── Need Based Training ─────────────────────────────────────────

export async function listNeedBasedTraining(): Promise<NeedBasedTrainingRecord[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.needBasedTraining), orderBy('created_at', 'desc'), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NeedBasedTrainingRecord));
    if (items.length > 0) memNeedBased = items;
    return items.length > 0 ? items : memNeedBased;
  }, memNeedBased);
}

export async function createNeedBasedTraining(
  actor: EnterpriseTmsActor,
  trigger: NeedBasedTrigger | string,
  sourceRef: string,
  sourceTitle: string,
  department: string,
  trainingType: string,
  topic: string,
): Promise<NeedBasedTrainingRecord> {
  const record: NeedBasedTrainingRecord = {
    id: `nbt-${Date.now()}`, record_number: generateNeedBasedNumber(),
    trigger_source: trigger, source_ref: sourceRef, source_title: sourceTitle,
    department, training_type: trainingType, training_topic: topic,
    assigned_employees: [], due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    status: 'Auto-Generated', auto_generated: true, created_at: now(),
  };
  if (isFirebaseConfigured()) {
    const ref = await addDoc(collection(db(), ENTERPRISE_TMS_COLLECTIONS.needBasedTraining), record);
    record.id = ref.id;
  } else { memNeedBased = [record, ...memNeedBased]; }
  await audit(actor, 'Need Based Training Created', record.id, ENTERPRISE_TMS_COLLECTIONS.needBasedTraining, record);
  return record;
}

// ─── External Training ───────────────────────────────────────────

export async function listExternalTraining(): Promise<ExternalTrainingRecord[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.externalTraining), orderBy('created_at', 'desc'), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExternalTrainingRecord));
    if (items.length > 0) memExternal = items;
    return items.length > 0 ? items : memExternal;
  }, memExternal);
}

export async function listTrainerQualifications(): Promise<TrainerQualification[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.trainerQualifications), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerQualification));
    if (items.length > 0) memTrainerQual = items;
    return items.length > 0 ? items : memTrainerQual;
  }, memTrainerQual);
}

export async function listTrainerRenewals(): Promise<TrainerRenewal[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.trainerRenewals), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainerRenewal));
    if (items.length > 0) memTrainerRenewal = items;
    return items.length > 0 ? items : memTrainerRenewal;
  }, memTrainerRenewal);
}

export async function listPracticalAssessments(): Promise<PracticalAssessment[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.practicalAssessments), orderBy('created_at', 'desc'), limit(200)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PracticalAssessment));
    if (items.length > 0) memPractical = items;
    return items.length > 0 ? items : memPractical;
  }, memPractical);
}

// ─── Automation ──────────────────────────────────────────────────

export async function runTrainingAutomation(
  actor: EnterpriseTmsActor,
  trigger: string,
  sourceRef: string,
): Promise<TrainingAutomationLog> {
  const settings = await getTrainingSettings();
  let affected = 0;
  let status: TrainingAutomationLog['status'] = 'Success';
  const details: string[] = [];

  try {
    const retrainingActor = { id: actor.id, name: actor.name, role: actor.role, department: actor.department };
    if (trigger === 'CAPA' && settings.auto_assign_sop_training) {
      affected += await assignFromCapa(sourceRef, actor);
      await autoCreateFromCapa({
        capa_id: sourceRef, employee_id: actor.id, employee_name: actor.name,
        department: actor.department ?? 'QA', training_topic: `CAPA Training: ${sourceRef}`,
        training_type: 'CAPA Training',
      }, retrainingActor);
      await createNeedBasedTraining(actor, 'CAPA', sourceRef, `CAPA ${sourceRef}`, actor.department ?? 'QA', 'CAPA Training', `CAPA Training: ${sourceRef}`);
      details.push(`CAPA training assigned: ${affected} records`);
    }
    if (trigger === 'Deviation') {
      await autoCreateFromDeviation({
        deviation_id: sourceRef, employee_id: actor.id, employee_name: actor.name,
        department: actor.department ?? 'QA', training_topic: `Deviation Training: ${sourceRef}`,
        training_type: 'Deviation Training',
      }, retrainingActor);
      await createNeedBasedTraining(actor, 'Deviation', sourceRef, `Deviation ${sourceRef}`, actor.department ?? 'QA', 'Deviation Training', `Deviation Training: ${sourceRef}`);
      affected += 1;
      details.push('Deviation retraining created');
    }
    if (trigger === 'Change Control' && settings.auto_assign_revised_sop) {
      affected += await assignFromChangeControl(sourceRef, actor);
      details.push(`CC training assigned: ${affected} records`);
    }
    if (trigger === 'New Employee' && settings.auto_induction_new_employee) {
      await createInductionRecord(actor, { employee_id: sourceRef });
      affected += 1;
      details.push('Induction record created');
    }
  } catch (e) {
    status = 'Failed';
    details.push(e instanceof Error ? e.message : 'Automation failed');
  }

  const log: TrainingAutomationLog = {
    id: `auto-${Date.now()}`, action: `Automation: ${trigger}`, trigger,
    source_ref: sourceRef, records_affected: affected, status,
    executed_at: now(), executed_by: actor.name, details: details.join('; '),
  };
  if (isFirebaseConfigured()) {
    await addDoc(collection(db(), ENTERPRISE_TMS_COLLECTIONS.automationLog), log);
  } else { memAutomationLog = [log, ...memAutomationLog]; }
  return log;
}

export async function listAutomationLog(): Promise<TrainingAutomationLog[]> {
  return withFirestoreFallback(async () => {
    const snap = await getDocs(query(collection(db(), ENTERPRISE_TMS_COLLECTIONS.automationLog), orderBy('executed_at', 'desc'), limit(100)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrainingAutomationLog));
    if (items.length > 0) memAutomationLog = items;
    return items.length > 0 ? items : memAutomationLog;
  }, memAutomationLog);
}

// ─── Enterprise Dashboard ──────────────────────────────────────────

export async function fetchEnterpriseTmsDashboard(): Promise<EnterpriseTmsDashboard> {
  const [needBased, requests, renewals] = await Promise.all([
    listNeedBasedTraining(), listTrainingRequests(), listTrainerRenewals(),
  ]);
  return {
    trainingToday: 3,
    upcomingTraining: 12,
    overdue: 5,
    pendingApproval: requests.filter((r) => r.status.startsWith('Pending')).length,
    certificatesExpiring: 8,
    trainerExpiry: renewals.filter((r) => r.status === 'Pending').length + 2,
    effectivenessPending: 6,
    needBasedCount: needBased.filter((n) => n.status !== 'Completed').length,
    ojtActive: 4,
    refresherDue: 15,
    departmentTraining: [
      { department: 'Production', completed: 45, pending: 8 },
      { department: 'QA', completed: 38, pending: 3 },
      { department: 'QC', completed: 42, pending: 5 },
      { department: 'Engineering', completed: 28, pending: 4 },
    ],
    trainingTrend: [
      { month: 'Jan', completed: 32, assigned: 40 },
      { month: 'Feb', completed: 28, assigned: 35 },
      { month: 'Mar', completed: 45, assigned: 48 },
      { month: 'Apr', completed: 38, assigned: 42 },
      { month: 'May', completed: 52, assigned: 55 },
      { month: 'Jun', completed: 41, assigned: 44 },
    ],
    passFailRatio: { pass: 892, fail: 23 },
    competencyLevels: [
      { level: 'Novice', count: 12 }, { level: 'Basic', count: 45 },
      { level: 'Competent', count: 120 }, { level: 'Proficient', count: 68 }, { level: 'Expert', count: 15 },
    ],
  };
}

export type {
  AnnualTrainingPlan, TrainingRequest, QuestionBankItem, Questionnaire,
  PracticalAssessment, NeedBasedTrainingRecord, ExternalTrainingRecord,
  TrainerQualification, TrainerRenewal, TrainingSettings, EnterpriseTmsDashboard,
};
