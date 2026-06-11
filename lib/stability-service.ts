import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firestore, storage } from '@/lib/firebase';
import { logAuditEvent } from '@/lib/admin/admin-service';
import { downloadCsv } from '@/lib/export-utils';
import { classifySpecification } from '@/lib/cpv';
import { createOosRecord } from '@/lib/oos-service';
import {
  STABILITY_COLLECTIONS, type StabilityStudy, type StabilitySchedule,
  type StabilitySamplePull, type StabilityResult, type StabilityApproval,
  type StabilityAttachment, type StabilityFilters, type StabilityDashboardMetrics,
  type StabilityActor, INTERVALS_BY_STUDY_TYPE, intervalToMonths, addMonths,
  isStudyClosed, computeStabilityResultStatus, parseSpecificationLimits,
} from './stability-types';
import type { StudyCreateInput } from './stability-schemas';

function now() { return new Date().toISOString(); }

async function audit(actor: StabilityActor, action: string, recordId: string, oldValue: unknown, newValue: unknown, reason = '') {
  await logAuditEvent({
    userId: actor.id, userName: actor.name, module: 'Stability', recordId, action,
    oldValue: oldValue ? JSON.stringify(oldValue) : '',
    newValue: newValue ? JSON.stringify(newValue) : '',
    reason, ipAddress: 'client', device: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    status: 'Success',
  });
}

async function notify(title: string, message: string, studyId: string, roles: string[]) {
  try {
    for (const role of roles) {
      await addDoc(collection(firestore, STABILITY_COLLECTIONS.notifications), {
        title, message, module: 'Stability', record_id: studyId, target_role: role,
        read: false, created_at: now(),
      });
    }
  } catch (e) { console.error('Notification failed:', e); }
}

export async function generateStudyNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STAB-${year}-`;
  try {
    const snap = await getDocs(query(
      collection(firestore, STABILITY_COLLECTIONS.studies),
      where('stability_study_number', '>=', prefix),
      where('stability_study_number', '<=', `${prefix}\uf8ff`),
      orderBy('stability_study_number', 'desc'),
      limit(1),
    ));
    if (!snap.empty) {
      const last = snap.docs[0].data().stability_study_number as string;
      const seq = parseInt(last.split('-').pop() || '0', 10) + 1;
      return `${prefix}${String(seq).padStart(4, '0')}`;
    }
  } catch {
    const all = await getDocs(collection(firestore, STABILITY_COLLECTIONS.studies));
    return `${prefix}${String(all.size + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

async function linkBatch(batchNumber: string) {
  if (!batchNumber) return { batch_id: null, pqr_id: null, product_id: null };
  try {
    const snap = await getDocs(query(
      collection(firestore, STABILITY_COLLECTIONS.batches),
      where('batch_number', '==', batchNumber),
      limit(1),
    ));
    if (snap.empty) return { batch_id: null, pqr_id: null, product_id: null };
    const data = snap.docs[0].data();
    return {
      batch_id: snap.docs[0].id,
      pqr_id: (data.pqr_id as string) || null,
      product_id: (data.product_id as string) || null,
    };
  } catch {
    return { batch_id: null, pqr_id: null, product_id: null };
  }
}

export async function createStabilityStudy(
  input: StudyCreateInput,
  actor: StabilityActor,
): Promise<StabilityStudy> {
  const studyNumber = await generateStudyNumber();
  const timestamp = now();
  const batchLink = await linkBatch(input.batch_number);

  const record: Omit<StabilityStudy, 'id'> = {
    stability_study_number: studyNumber,
    product_name: input.product_name,
    generic_name: input.generic_name || '',
    strength: input.strength,
    dosage_form: input.dosage_form,
    batch_number: input.batch_number,
    batch_size: input.batch_size || '',
    manufacturing_date: input.manufacturing_date,
    expiry_date: input.expiry_date,
    study_type: input.study_type,
    storage_condition: input.storage_condition,
    market: input.market || 'Domestic',
    protocol_number: input.protocol_number,
    protocol_version: input.protocol_version,
    study_initiation_date: input.study_initiation_date,
    study_end_date: input.study_end_date || null,
    status: 'draft',
    remarks: input.remarks || '',
    product_id: batchLink.product_id,
    batch_id: batchLink.batch_id,
    pqr_id: batchLink.pqr_id,
    created_by: actor.id,
    created_by_name: actor.name,
    updated_by: actor.id,
    updated_by_name: actor.name,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const refDoc = await addDoc(collection(firestore, STABILITY_COLLECTIONS.studies), record);
  await audit(actor, 'CREATE', refDoc.id, null, record);
  return { id: refDoc.id, ...record };
}

export async function getStudyById(id: string): Promise<StabilityStudy | null> {
  const snap = await getDoc(doc(firestore, STABILITY_COLLECTIONS.studies, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StabilityStudy;
}

export async function listStudies(filters?: StabilityFilters): Promise<StabilityStudy[]> {
  try {
    const snap = await getDocs(query(
      collection(firestore, STABILITY_COLLECTIONS.studies),
      orderBy('updated_at', 'desc'),
      limit(1000),
    ));
    return applyStudyFilters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityStudy)), filters);
  } catch {
    const snap = await getDocs(collection(firestore, STABILITY_COLLECTIONS.studies));
    return applyStudyFilters(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityStudy)), filters);
  }
}

function applyStudyFilters(records: StabilityStudy[], filters?: StabilityFilters): StabilityStudy[] {
  let results = records;
  if (filters?.status && filters.status !== 'all') results = results.filter((r) => r.status === filters.status);
  if (filters?.study_type && filters.study_type !== 'all') results = results.filter((r) => r.study_type === filters.study_type);
  if (filters?.storage_condition && filters.storage_condition !== 'all') {
    results = results.filter((r) => r.storage_condition === filters.storage_condition);
  }
  if (filters?.product) {
    const q = filters.product.toLowerCase();
    results = results.filter((r) => r.product_name.toLowerCase().includes(q));
  }
  if (filters?.batch_number) results = results.filter((r) => r.batch_number.includes(filters.batch_number!));
  if (filters?.date_from) results = results.filter((r) => r.study_initiation_date >= filters.date_from!);
  if (filters?.date_to) results = results.filter((r) => r.study_initiation_date <= filters.date_to!);
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter((r) =>
      r.stability_study_number.toLowerCase().includes(s)
      || r.product_name.toLowerCase().includes(s)
      || r.batch_number.toLowerCase().includes(s),
    );
  }
  return results;
}

export async function updateStudy(
  id: string, patch: Partial<StabilityStudy>, actor: StabilityActor, workflow = false,
): Promise<StabilityStudy> {
  const existing = await getStudyById(id);
  if (!existing) throw new Error('Study not found');
  if (!workflow && existing.status !== 'draft') throw new Error('Only draft studies can be edited');
  const payload = { ...patch, updated_by: actor.id, updated_by_name: actor.name, updated_at: now() };
  await updateDoc(doc(firestore, STABILITY_COLLECTIONS.studies, id), payload);
  await audit(actor, 'UPDATE', id, existing, { ...existing, ...payload });
  return { ...existing, ...payload } as StabilityStudy;
}

export async function generateSchedule(studyId: string, actor: StabilityActor): Promise<StabilitySchedule[]> {
  const study = await getStudyById(studyId);
  if (!study) throw new Error('Study not found');

  const intervals = INTERVALS_BY_STUDY_TYPE[study.study_type] || INTERVALS_BY_STUDY_TYPE['Long Term'];
  const existing = await getSchedules(studyId);
  if (existing.length > 0) return existing;

  const timestamp = now();
  const created: StabilitySchedule[] = [];

  for (const interval of intervals) {
    const months = intervalToMonths(interval);
    const scheduledDate = addMonths(study.study_initiation_date, months);
    const ref = await addDoc(collection(firestore, STABILITY_COLLECTIONS.schedules), {
      study_id: studyId,
      study_number: study.stability_study_number,
      batch_number: study.batch_number,
      interval,
      scheduled_date: scheduledDate,
      status: 'pending',
      created_at: timestamp,
      updated_at: timestamp,
    });
    created.push({
      id: ref.id, study_id: studyId, study_number: study.stability_study_number,
      batch_number: study.batch_number, interval, scheduled_date: scheduledDate,
      status: 'pending', created_at: timestamp, updated_at: timestamp,
    });
  }

  for (const sched of created) {
    await addDoc(collection(firestore, STABILITY_COLLECTIONS.samplePulling), {
      study_id: studyId,
      study_number: study.stability_study_number,
      batch_number: study.batch_number,
      interval: sched.interval,
      pulling_due_date: sched.scheduled_date,
      actual_pulling_date: null,
      sample_quantity: '',
      pulled_by: '',
      pulled_by_name: '',
      checked_by: '',
      checked_by_name: '',
      status: 'Pending',
      remarks: '',
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  await updateStudy(studyId, { status: 'study_ongoing' }, actor, true);
  await audit(actor, 'SCHEDULE_GENERATION', studyId, null, { intervals: intervals.length });
  return created;
}

export async function getSchedules(studyId: string): Promise<StabilitySchedule[]> {
  const snap = await getDocs(query(
    collection(firestore, STABILITY_COLLECTIONS.schedules),
    where('study_id', '==', studyId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilitySchedule))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
}

export async function getSamplePulls(studyId: string): Promise<StabilitySamplePull[]> {
  const snap = await getDocs(query(
    collection(firestore, STABILITY_COLLECTIONS.samplePulling),
    where('study_id', '==', studyId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilitySamplePull))
    .sort((a, b) => a.pulling_due_date.localeCompare(b.pulling_due_date));
}

export async function listAllSamplePulls(): Promise<StabilitySamplePull[]> {
  const snap = await getDocs(collection(firestore, STABILITY_COLLECTIONS.samplePulling));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilitySamplePull));
}

export async function updateSamplePull(
  pullId: string, studyId: string,
  data: Partial<StabilitySamplePull>, actor: StabilityActor,
): Promise<void> {
  await updateDoc(doc(firestore, STABILITY_COLLECTIONS.samplePulling, pullId), {
    ...data, updated_at: now(),
  });
  if (data.status === 'Pulled') {
    await updateDoc(doc(firestore, STABILITY_COLLECTIONS.studies, studyId), {
      status: 'sample_pulled', updated_at: now(),
    });
    const schedSnap = await getDocs(query(
      collection(firestore, STABILITY_COLLECTIONS.schedules),
      where('study_id', '==', studyId),
      where('interval', '==', data.interval || ''),
      limit(1),
    ));
    if (!schedSnap.empty) {
      await updateDoc(schedSnap.docs[0].ref, { status: 'completed', updated_at: now() });
    }
  }
  await audit(actor, 'SAMPLE_PULLING', studyId, null, data);
}

export async function syncSampleDueNotifications(): Promise<number> {
  const pulls = await listAllSamplePulls();
  const today = new Date();
  const warnDate = new Date(today);
  warnDate.setDate(warnDate.getDate() + 7);
  const todayStr = today.toISOString().split('T')[0];
  const warnStr = warnDate.toISOString().split('T')[0];
  let count = 0;

  for (const pull of pulls) {
    if (pull.status !== 'Pending') continue;
    if (pull.pulling_due_date < todayStr) {
      await updateDoc(doc(firestore, STABILITY_COLLECTIONS.samplePulling, pull.id), {
        status: 'Missed', updated_at: now(),
      });
      await updateDoc(doc(firestore, STABILITY_COLLECTIONS.studies, pull.study_id), {
        status: 'sample_due', updated_at: now(),
      });
      await notify(
        'Stability Sample Missed',
        `Sample pull missed for ${pull.study_number} — ${pull.interval}`,
        pull.study_id, ['qa', 'qc', 'head_qa'],
      );
      count++;
    } else if (pull.pulling_due_date <= warnStr) {
      await notify(
        'Stability Sample Due Soon',
        `Sample due ${pull.pulling_due_date} for ${pull.study_number} — ${pull.interval}`,
        pull.study_id, ['qa', 'qc'],
      );
      count++;
    }
  }
  return count;
}

export async function getResults(studyId: string): Promise<StabilityResult[]> {
  const snap = await getDocs(query(
    collection(firestore, STABILITY_COLLECTIONS.results),
    where('study_id', '==', studyId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityResult))
    .sort((a, b) => a.test_date.localeCompare(b.test_date));
}

export async function listAllResults(): Promise<StabilityResult[]> {
  const snap = await getDocs(collection(firestore, STABILITY_COLLECTIONS.results));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityResult));
}

async function createCpvTrendFromResult(study: StabilityStudy, result: StabilityResult): Promise<string | null> {
  const numeric = typeof result.observed_result === 'number'
    ? result.observed_result : parseFloat(String(result.observed_result));
  if (!Number.isFinite(numeric)) return null;
  if (!['Assay', 'pH', 'Dissolution', 'Water Content'].includes(result.parameter_name)) return null;

  const ref = await addDoc(collection(firestore, STABILITY_COLLECTIONS.cpvTrends), {
    source: 'stability',
    study_id: study.id,
    study_number: study.stability_study_number,
    metric: result.parameter_name,
    product: study.product_name,
    batch: study.batch_number,
    interval: result.interval,
    date: result.test_date,
    observed: numeric,
    lower: result.spec_lower_limit,
    upper: result.spec_upper_limit,
    unit: result.unit,
    status: result.result_status,
    storage_condition: study.storage_condition,
    created_at: now(),
  });
  return ref.id;
}

async function createCpvRiskAlert(study: StabilityStudy, result: StabilityResult, actor: StabilityActor): Promise<string | null> {
  const ref = await addDoc(collection(firestore, STABILITY_COLLECTIONS.cpvRisk), {
    riskId: `STAB-RISK-${Date.now()}`,
    productName: study.product_name,
    batchNo: study.batch_number,
    riskSource: 'OOT',
    riskDescription: `Stability OOT: ${result.parameter_name} at ${result.interval} — observed ${result.observed_result} ${result.unit}`,
    severity: 3,
    occurrence: 2,
    detectability: 2,
    rpn: 12,
    riskLevel: 'Medium',
    mitigationPlan: 'Review stability trend and assess batch impact per SOP',
    status: 'Open',
    stability_result_id: result.id,
    stability_study_id: study.id,
    recordedBy: actor.name,
    createdAt: now(),
  });
  return ref.id;
}

async function createOosFromStability(
  study: StabilityStudy, result: StabilityResult, actor: StabilityActor,
): Promise<{ id: string; oos_number: string } | null> {
  const lsl = result.spec_lower_limit ?? 0;
  const usl = result.spec_upper_limit ?? 100;
  const numeric = typeof result.observed_result === 'number'
    ? result.observed_result : parseFloat(String(result.observed_result));
  if (!Number.isFinite(numeric)) return null;

  const oos = await createOosRecord({
    oos_date: result.test_date,
    department: 'QC',
    product_name: study.product_name,
    batch_number: study.batch_number,
    test_name: `Stability - ${result.parameter_name}`,
    test_method: 'Stability Testing',
    stp_number: study.protocol_number,
    specification_number: result.specification,
    parameter_name: result.parameter_name,
    spec_lower_limit: lsl,
    spec_upper_limit: usl,
    observed_result: numeric,
    unit: result.unit,
  }, { id: actor.id, name: actor.name, role: actor.role }, {
    source: 'stability',
    source_reference: study.stability_study_number,
    status: 'draft',
  });
  return { id: oos.id, oos_number: oos.oos_number };
}

export async function addStabilityResult(
  studyId: string,
  input: {
    interval: string; test_date: string; parameter_name: string; specification: string;
    spec_lower_limit?: number | null; spec_upper_limit?: number | null;
    observed_result: number | string; unit: string;
    analyst_name: string; reviewed_by_name?: string; remarks?: string;
  },
  actor: StabilityActor,
): Promise<StabilityResult> {
  const study = await getStudyById(studyId);
  if (!study) throw new Error('Study not found');

  let lsl = input.spec_lower_limit ?? null;
  let usl = input.spec_upper_limit ?? null;
  if (lsl === null || usl === null) {
    const parsed = parseSpecificationLimits(input.specification);
    lsl = parsed.lsl;
    usl = parsed.usl;
  }

  const numericObs = typeof input.observed_result === 'number'
    ? input.observed_result : parseFloat(String(input.observed_result));

  let resultStatus = computeStabilityResultStatus(input.observed_result, lsl, usl, input.specification);
  if (Number.isFinite(numericObs) && lsl !== null && usl !== null) {
    const target = (lsl + usl) / 2;
    resultStatus = classifySpecification(numericObs, target, lsl, usl);
  }

  const timestamp = now();
  const payload: Omit<StabilityResult, 'id'> = {
    study_id: studyId,
    study_number: study.stability_study_number,
    batch_number: study.batch_number,
    interval: input.interval,
    test_date: input.test_date,
    parameter_name: input.parameter_name,
    specification: input.specification,
    spec_lower_limit: lsl,
    spec_upper_limit: usl,
    observed_result: input.observed_result,
    unit: input.unit || '',
    result_status: resultStatus,
    analyst: actor.id,
    analyst_name: input.analyst_name,
    reviewed_by: actor.id,
    reviewed_by_name: input.reviewed_by_name || '',
    attachment_url: null,
    remarks: input.remarks || '',
    linked_oos_id: null,
    linked_oos_number: null,
    cpv_trend_id: null,
    cpv_risk_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const ref = await addDoc(collection(firestore, STABILITY_COLLECTIONS.results), payload);
  const result: StabilityResult = { id: ref.id, ...payload };

  const cpvTrendId = await createCpvTrendFromResult(study, result);
  if (cpvTrendId) {
    await updateDoc(ref, { cpv_trend_id: cpvTrendId });
    result.cpv_trend_id = cpvTrendId;
  }

  if (resultStatus === 'OOS') {
    const oos = await createOosFromStability(study, result, actor);
    if (oos) {
      await updateDoc(ref, { linked_oos_id: oos.id, linked_oos_number: oos.oos_number });
      result.linked_oos_id = oos.id;
      result.linked_oos_number = oos.oos_number;
      await notify('Stability OOS', `OOS created ${oos.oos_number} from ${study.stability_study_number}`, studyId, ['qa', 'qc', 'head_qa']);
    }
  } else if (resultStatus === 'OOT') {
    const riskId = await createCpvRiskAlert(study, result, actor);
    if (riskId) {
      await updateDoc(ref, { cpv_risk_id: riskId });
      result.cpv_risk_id = riskId;
      await notify('Stability OOT Alert', `OOT trend alert for ${result.parameter_name} — ${study.stability_study_number}`, studyId, ['qa', 'cpv']);
    }
  }

  await updateStudy(studyId, { status: 'testing_completed' }, actor, true);
  await audit(actor, 'RESULT_ENTRY', studyId, null, { ...result, result_status: resultStatus });
  return result;
}

export async function submitApproval(
  studyId: string,
  data: { decision: 'approved' | 'rejected'; comments: string; e_signature: string },
  actor: StabilityActor,
): Promise<StabilityApproval> {
  const study = await getStudyById(studyId);
  if (!study) throw new Error('Study not found');

  const timestamp = now();
  const approvalLevel: StabilityApproval['approval_level'] =
    study.status === 'draft' ? 'protocol'
      : study.status === 'qa_review' ? 'head_qa' : 'final';

  const approval: Omit<StabilityApproval, 'id'> = {
    study_id: studyId,
    approval_level: approvalLevel,
    approver_id: actor.id,
    approver_name: actor.name,
    approver_role: actor.role,
    decision: data.decision,
    comments: data.comments,
    e_signature: data.e_signature,
    signed_at: timestamp,
    created_at: timestamp,
  };
  const ref = await addDoc(collection(firestore, STABILITY_COLLECTIONS.approvals), approval);

  let newStatus = data.decision === 'rejected' ? 'cancelled' : 'approved_protocol';
  if (data.decision === 'approved' && approvalLevel === 'protocol') {
    newStatus = 'approved_protocol';
    await generateSchedule(studyId, actor);
  } else if (data.decision === 'approved' && approvalLevel === 'head_qa') {
    newStatus = 'completed';
  } else if (data.decision === 'approved') {
    newStatus = 'closed';
  }

  await updateStudy(studyId, { status: newStatus }, actor, true);
  await audit(actor, data.decision === 'approved' ? 'APPROVE' : 'REJECT', studyId, null, approval);
  return { id: ref.id, ...approval };
}

export async function closeStudy(studyId: string, actor: StabilityActor): Promise<StabilityStudy> {
  const study = await getStudyById(studyId);
  if (!study) throw new Error('Study not found');
  const updated = await updateStudy(studyId, { status: 'closed', study_end_date: now().split('T')[0] }, actor, true);
  await audit(actor, 'CLOSE', studyId, study, updated);
  return updated;
}

export async function getApprovals(studyId: string): Promise<StabilityApproval[]> {
  const snap = await getDocs(query(
    collection(firestore, STABILITY_COLLECTIONS.approvals),
    where('study_id', '==', studyId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityApproval));
}

export async function getAttachments(studyId: string): Promise<StabilityAttachment[]> {
  const snap = await getDocs(query(
    collection(firestore, STABILITY_COLLECTIONS.attachments),
    where('study_id', '==', studyId),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityAttachment));
}

export async function uploadAttachment(studyId: string, file: File, actor: StabilityActor): Promise<StabilityAttachment> {
  const path = `stability/${studyId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const timestamp = now();
  const attachment: Omit<StabilityAttachment, 'id'> = {
    study_id: studyId, file_name: file.name, file_url: url, file_type: file.type,
    uploaded_by: actor.id, uploaded_by_name: actor.name, uploaded_at: timestamp,
  };
  const refDoc = await addDoc(collection(firestore, STABILITY_COLLECTIONS.attachments), attachment);
  await audit(actor, 'ATTACHMENT_UPLOAD', studyId, null, { file_name: file.name });
  return { id: refDoc.id, ...attachment };
}

export async function getAuditLogsForStudy(studyId: string) {
  const snap = await getDocs(query(
    collection(firestore, STABILITY_COLLECTIONS.auditLogs),
    where('recordId', '==', studyId),
    limit(100),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function computeDashboardMetrics(
  studies: StabilityStudy[],
  pulls: StabilitySamplePull[],
  results: StabilityResult[],
): StabilityDashboardMetrics {
  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  return {
    total: studies.length,
    ongoing: studies.filter((s) => ['study_ongoing', 'sample_due', 'sample_pulled', 'testing_completed', 'qa_review'].includes(s.status)).length,
    completed: studies.filter((s) => ['completed', 'closed'].includes(s.status)).length,
    samplesDue: pulls.filter((p) => p.status === 'Pending' && p.pulling_due_date <= today.toISOString().split('T')[0]).length,
    missedSamples: pulls.filter((p) => p.status === 'Missed').length,
    oosResults: results.filter((r) => r.result_status === 'OOS').length,
    ootResults: results.filter((r) => r.result_status === 'OOT').length,
    closingThisMonth: studies.filter((s) =>
      s.study_end_date && s.study_end_date >= monthStart && s.study_end_date <= monthEnd,
    ).length,
  };
}

export function stabilityChartData(
  studies: StabilityStudy[],
  pulls: StabilitySamplePull[],
  results: StabilityResult[],
) {
  const byProduct = new Map<string, number>();
  const byStorage = new Map<string, number>();
  const sampleDueByMonth = new Map<string, number>();
  const oosOotByMonth = new Map<string, number>();
  const assayTrend: Array<{ interval: string; value: number }> = [];
  const phTrend: Array<{ interval: string; value: number }> = [];

  studies.forEach((s) => {
    byProduct.set(s.product_name, (byProduct.get(s.product_name) || 0) + 1);
    byStorage.set(s.storage_condition, (byStorage.get(s.storage_condition) || 0) + 1);
  });

  pulls.filter((p) => p.status === 'Pending').forEach((p) => {
    const month = p.pulling_due_date.slice(0, 7);
    sampleDueByMonth.set(month, (sampleDueByMonth.get(month) || 0) + 1);
  });

  results.filter((r) => ['OOS', 'OOT'].includes(r.result_status)).forEach((r) => {
    const month = r.test_date.slice(0, 7);
    oosOotByMonth.set(month, (oosOotByMonth.get(month) || 0) + 1);
  });

  results.filter((r) => r.parameter_name === 'Assay' && typeof r.observed_result === 'number').forEach((r) => {
    assayTrend.push({ interval: r.interval, value: r.observed_result as number });
  });
  results.filter((r) => r.parameter_name === 'pH' && typeof r.observed_result === 'number').forEach((r) => {
    phTrend.push({ interval: r.interval, value: r.observed_result as number });
  });

  return {
    byProduct: Array.from(byProduct.entries()).map(([name, value]) => ({ name, value })),
    byStorage: Array.from(byStorage.entries()).map(([name, value]) => ({ name, value })),
    sampleDueTrend: Array.from(sampleDueByMonth.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    oosOotTrend: Array.from(oosOotByMonth.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
    assayTrend: assayTrend.sort((a, b) => intervalToMonths(a.interval) - intervalToMonths(b.interval)),
    phTrend: phTrend.sort((a, b) => intervalToMonths(a.interval) - intervalToMonths(b.interval)),
  };
}

export function exportStudiesCsv(studies: StabilityStudy[]) {
  downloadCsv('stability-studies.csv',
    ['Study #', 'Product', 'Batch', 'Type', 'Storage', 'Status', 'Initiation Date'],
    studies.map((s) => [
      s.stability_study_number, s.product_name, s.batch_number, s.study_type,
      s.storage_condition, s.status, s.study_initiation_date,
    ]),
  );
}
