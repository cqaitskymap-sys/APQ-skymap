import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, limit, orderBy, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseFirestore, getFirebaseStorage, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import {
  STABILITY_LEGACY_COLLECTIONS,
  STABILITY_MONITORING_COLLECTION,
  STABILITY_RESULTS_COLLECTION,
  STABILITY_SCHEDULES_COLLECTION,
  STABILITY_STUDIES_COLLECTION,
  computeScheduleStatus,
  defaultLimitsForParameter,
} from '@/lib/cpv-stability-monitoring';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions } from '@/lib/pqr-batch-review-service';
import {
  PQR_STABILITY_REVIEW_COLLECTIONS,
  PQR_STABILITY_REVIEW_MODULE,
  autoResultStatus,
  computeStabilityCompliance,
  computeStabilityReviewSummary,
  generateStabilityNarrative,
  type PqrStabilityReviewRecord,
  type StabilityReviewFormData,
} from '@/lib/pqr-stability-review-records';

export type PqrStabilityReviewActor = { id: string; name: string; role?: string };

export { fetchPqrOptions };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function buildStabilityReviewId(batch: string, interval: string, param: string) {
  return `STAB-REV-${batch.slice(0, 8)}-${interval.replace(/\s+/g, '')}-${param.slice(0, 6).replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
}

async function readCollection(name: string, max = 1000): Promise<Record<string, unknown>[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), name), orderBy('createdAt', 'desc'), limit(max)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(query(collection(getFirebaseFirestore(), name), limit(max)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`readCollection ${name}`, e);
      return [];
    }
  }
}

async function readFirst(names: string[], max = 1000): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const rows = await readCollection(name, max);
    rows.forEach((r) => {
      const id = str(r.id);
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      out.push(r);
    });
  }
  return out;
}

async function logStabilityReviewAudit(
  actionType: string,
  actor: PqrStabilityReviewActor,
  detail?: unknown,
  recordId = 'stability-review',
) {
  try {
    await createAuditLog({
      moduleName: PQR_STABILITY_REVIEW_MODULE,
      collectionName: PQR_STABILITY_REVIEW_COLLECTIONS.review,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_STABILITY_REVIEW_COLLECTIONS.review,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_STABILITY_REVIEW_MODULE,
    });
  } catch (e) {
    console.error('logStabilityReviewAudit failed', e);
  }
}

function inPeriod(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.slice(0, 10);
  if (!from || !to || !d) return true;
  return d >= from && d <= to;
}

function matchesProduct(raw: Record<string, unknown>, pqr: PqrOption): boolean {
  const code = str(raw.productCode || raw.product_code).toLowerCase();
  const name = str(raw.productName || raw.product_name || raw.product).toLowerCase();
  if (code && pqr.productCode && code === pqr.productCode.toLowerCase()) return true;
  if (name && pqr.productName && name === pqr.productName.toLowerCase()) return true;
  if (name && pqr.productName && pqr.productName.toLowerCase().includes(name)) return true;
  if (name && pqr.productName && name.includes(pqr.productName.toLowerCase())) return true;
  return !code && !name;
}

function parseObserved(v: unknown): string | number {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') return v;
  return String(v);
}

function groupKey(batch: string, studyType: string, storage: string, interval: string, param: string) {
  return `${batch}|${studyType}|${storage}|${interval}|${param}`.toLowerCase();
}

interface PullAcc {
  batchNumber: string;
  studyNumber: string;
  studyType: string;
  storageCondition: string;
  pullingInterval: string;
  samplePullingDueDate: string;
  actualPullingDate: string;
  testDate: string;
  studyStartDate: string;
  parameterName: string;
  observedResult: string | number;
  lowerLimit: number;
  upperLimit: number;
  unit: string;
  resultStatus: string;
  samplePullStatus: string;
  ootCount: number;
  oosCount: number;
  capaCount: number;
  sourceIds: string[];
}

function countLinkedCapa(
  batch: string,
  param: string,
  capas: Record<string, unknown>[],
  from: string,
  to: string,
): number {
  return capas.filter((r) => {
    const text = `${str(r.title)} ${str(r.description)} ${str(r.source)} ${str(r.module)} ${str(r.batchNumber)}`.toLowerCase();
    const match = text.includes('stability') || text.includes(batch.toLowerCase()) || text.includes(param.toLowerCase());
    if (!match) return false;
    const date = str(r.createdAt || r.created_at).slice(0, 10);
    return inPeriod(date, from, to);
  }).length;
}

function mergeAcc(base: PullAcc, add: PullAcc): PullAcc {
  const latest = (add.testDate || '') >= (base.testDate || '') ? add : base;
  return {
    ...latest,
    ootCount: base.ootCount + add.ootCount,
    oosCount: base.oosCount + add.oosCount,
    capaCount: base.capaCount + add.capaCount,
    sourceIds: [...base.sourceIds, ...add.sourceIds],
    samplePullingDueDate: add.samplePullingDueDate || base.samplePullingDueDate,
    actualPullingDate: add.actualPullingDate || base.actualPullingDate,
    samplePullStatus: add.samplePullStatus || base.samplePullStatus,
  };
}

function accFromResult(
  raw: Record<string, unknown>,
  scheduleMap: Map<string, Record<string, unknown>>,
  studyMap: Map<string, Record<string, unknown>>,
): PullAcc | null {
  const batch = str(raw.batchNumber || raw.batch_number);
  const studyType = str(raw.studyType || raw.study_type, 'Long Term');
  const storage = str(raw.storageCondition || raw.storage_condition, '25°C / 60% RH');
  const interval = str(raw.pullingInterval || raw.pulling_interval || raw.interval, 'Initial');
  const param = str(raw.parameterName || raw.parameter_name);
  if (!batch || !param) return null;

  const studyKey = `${batch}|${studyType}|${storage}`.toLowerCase();
  const study = studyMap.get(studyKey) || studyMap.get(str(raw.studyId || raw.study_id));
  const schedKey = `${batch}|${studyType}|${storage}|${interval}`.toLowerCase();
  const sched = scheduleMap.get(schedKey) || scheduleMap.get(str(raw.scheduleId || raw.schedule_id));

  const lower = num(raw.lowerLimit ?? raw.lower_limit, defaultLimitsForParameter(param).lower);
  const upper = num(raw.upperLimit ?? raw.upper_limit, defaultLimitsForParameter(param).upper);
  const observed = parseObserved(raw.observedResult ?? raw.observed_result ?? raw.result);
  const status = str(raw.status || raw.resultStatus || raw.result_status, autoResultStatus(observed, lower, upper, param));

  const dueDate = str(sched?.samplePullingDueDate || sched?.sample_pulling_due_date || raw.samplePullingDueDate);
  const actualPull = str(sched?.actualPullingDate || sched?.actual_pulling_date || raw.actualSamplePullingDate || raw.actual_pulling_date);
  const pullStatus = str(
    sched?.scheduleStatus || sched?.schedule_status,
    computeScheduleStatus(dueDate, actualPull, str(raw.reviewStatus, 'Pending')),
  );

  return {
    batchNumber: batch,
    studyNumber: str(raw.stabilityStudyNumber || raw.stability_study_number || study?.stabilityStudyNumber),
    studyType,
    storageCondition: storage,
    pullingInterval: interval,
    samplePullingDueDate: dueDate,
    actualPullingDate: actualPull,
    testDate: str(raw.testDate || raw.test_date || raw.createdAt).slice(0, 10),
    studyStartDate: str(study?.studyStartDate || study?.study_start_date || raw.studyStartDate),
    parameterName: param,
    observedResult: observed,
    lowerLimit: lower,
    upperLimit: upper,
    unit: str(raw.unit, defaultLimitsForParameter(param).unit),
    resultStatus: status,
    samplePullStatus: pullStatus,
    ootCount: status === 'OOT' || status === 'Action' ? 1 : 0,
    oosCount: status === 'OOS' ? 1 : 0,
    capaCount: raw.capaRequired || raw.linkedCapaNumber ? 1 : 0,
    sourceIds: [str(raw.id)],
  };
}

function accFromMonitoring(raw: Record<string, unknown>): PullAcc | null {
  const batch = str(raw.batchNumber || raw.batch_number || raw.batchNo);
  const param = str(raw.parameterName || raw.parameter_name || raw.parameter);
  if (!batch || !param) return null;
  const studyType = str(raw.studyType || raw.study_type, 'Long Term');
  const storage = str(raw.storageCondition || raw.storage_condition, '25°C / 60% RH');
  const interval = str(raw.pullingInterval || raw.interval || raw.timePoint, 'Initial');
  const lower = num(raw.lowerLimit ?? raw.lower_limit, defaultLimitsForParameter(param).lower);
  const upper = num(raw.upperLimit ?? raw.upper_limit, defaultLimitsForParameter(param).upper);
  const observed = parseObserved(raw.observedResult ?? raw.observed_value ?? raw.result);
  const status = str(raw.status, autoResultStatus(observed, lower, upper, param));
  return {
    batchNumber: batch,
    studyNumber: str(raw.stabilityStudyNumber || raw.study_number),
    studyType,
    storageCondition: storage,
    pullingInterval: interval,
    samplePullingDueDate: str(raw.samplePullingDueDate || raw.due_date),
    actualPullingDate: str(raw.actualPullingDate || raw.actual_pull_date),
    testDate: str(raw.testDate || raw.monitoring_date || raw.createdAt).slice(0, 10),
    studyStartDate: str(raw.studyStartDate || raw.study_start_date),
    parameterName: param,
    observedResult: observed,
    lowerLimit: lower,
    upperLimit: upper,
    unit: str(raw.unit),
    resultStatus: status,
    samplePullStatus: str(raw.scheduleStatus, 'Pending'),
    ootCount: status === 'OOT' || status === 'Action' ? 1 : 0,
    oosCount: status === 'OOS' ? 1 : 0,
    capaCount: 0,
    sourceIds: [str(raw.id)],
  };
}

function accToRecord(
  g: PullAcc,
  pqr: PqrOption,
  capas: Record<string, unknown>[],
  actor: PqrStabilityReviewActor,
): Omit<PqrStabilityReviewRecord, 'id'> {
  const ts = nowIso();
  const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
  const to = pqr.reviewPeriodTo?.slice(0, 10) || '';
  const linkedCapa = countLinkedCapa(g.batchNumber, g.parameterName, capas, from, to);

  const partial: Partial<PqrStabilityReviewRecord> = {
    stabilityReviewId: buildStabilityReviewId(g.batchNumber, g.pullingInterval, g.parameterName),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    batchNumber: g.batchNumber,
    studyNumber: g.studyNumber,
    studyType: g.studyType,
    storageCondition: g.storageCondition,
    pullingInterval: g.pullingInterval,
    samplePullingDueDate: g.samplePullingDueDate,
    actualPullingDate: g.actualPullingDate,
    testDate: g.testDate,
    studyStartDate: g.studyStartDate,
    parameterName: g.parameterName,
    observedResult: g.observedResult,
    lowerLimit: g.lowerLimit,
    upperLimit: g.upperLimit,
    unit: g.unit,
    resultStatus: g.resultStatus,
    samplePullStatus: g.samplePullStatus,
    ootCount: g.ootCount,
    oosCount: g.oosCount,
    capaCount: g.capaCount + linkedCapa,
    impactOnShelfLife: 'No',
    impactOnProductQuality: g.oosCount > 0 ? 'Yes' : 'No',
    conclusion: g.resultStatus === 'Complies' ? 'Within specification' : 'Reviewed for impact',
    remarks: '',
    sourceType: 'pull',
    sourceIds: g.sourceIds,
    attachmentUrls: [],
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };
  const computed = computeStabilityCompliance(partial);
  return { ...partial, ...computed } as Omit<PqrStabilityReviewRecord, 'id'>;
}

function formToPartial(data: StabilityReviewFormData): Partial<PqrStabilityReviewRecord> {
  const resultStatus = data.resultStatus === 'Under Review'
    ? data.resultStatus
    : autoResultStatus(data.observedResult, data.lowerLimit, data.upperLimit, data.parameterName);
  return {
    batchNumber: data.batchNumber,
    studyNumber: data.studyNumber,
    studyType: data.studyType,
    storageCondition: data.storageCondition,
    pullingInterval: data.pullingInterval,
    samplePullingDueDate: data.samplePullingDueDate,
    actualPullingDate: data.actualPullingDate,
    testDate: data.testDate,
    studyStartDate: data.studyStartDate,
    parameterName: data.parameterName,
    observedResult: data.observedResult,
    lowerLimit: data.lowerLimit,
    upperLimit: data.upperLimit,
    unit: data.unit,
    resultStatus,
    samplePullStatus: data.samplePullStatus,
    ootCount: resultStatus === 'OOT' || resultStatus === 'Action' ? Math.max(data.ootCount, 1) : data.ootCount,
    oosCount: resultStatus === 'OOS' ? Math.max(data.oosCount, 1) : data.oosCount,
    capaCount: data.capaCount,
    impactOnShelfLife: data.impactOnShelfLife,
    impactOnProductQuality: data.impactOnProductQuality,
    conclusion: data.conclusion,
    remarks: data.remarks,
  };
}

export async function fetchStabilityReviewRecords(pqrId: string): Promise<PqrStabilityReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrStabilityReviewRecord))
      .sort((a, b) => a.batchNumber.localeCompare(b.batchNumber) || intervalToMonthsSafe(a.pullingInterval) - intervalToMonthsSafe(b.pullingInterval));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrStabilityReviewRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.batchNumber.localeCompare(b.batchNumber));
    } catch (e) {
      console.error('fetchStabilityReviewRecords failed', e);
      return [];
    }
  }
}

function intervalToMonthsSafe(interval: string): number {
  if (interval === 'Initial') return 0;
  const match = interval.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export async function pullStabilityReviewData(
  pqr: PqrOption,
  actor: PqrStabilityReviewActor,
): Promise<{ created: number; skipped: number; error?: string }> {
  if (!isFirebaseConfigured()) return { created: 0, skipped: 0, error: 'Firebase is not configured.' };

  try {
    await logStabilityReviewAudit('pull stability data', actor, { pqrId: pqr.id }, pqr.id);

    const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
    const to = pqr.reviewPeriodTo?.slice(0, 10) || '';

    const [existing, resultsRaw, schedulesRaw, studiesRaw, monitoringRaw, capas] = await Promise.all([
      fetchStabilityReviewRecords(pqr.id),
      readFirst([STABILITY_RESULTS_COLLECTION, ...STABILITY_LEGACY_COLLECTIONS]),
      readFirst([STABILITY_SCHEDULES_COLLECTION]),
      readFirst([STABILITY_STUDIES_COLLECTION, ...STABILITY_LEGACY_COLLECTIONS]),
      readFirst([STABILITY_MONITORING_COLLECTION, ...STABILITY_LEGACY_COLLECTIONS]),
      readFirst([PQR_STABILITY_REVIEW_COLLECTIONS.capaRecords, 'capa']),
    ]);

    const existingKeys = new Set(existing.map((r) =>
      groupKey(r.batchNumber, r.studyType, r.storageCondition, r.pullingInterval, r.parameterName),
    ));

    const studyMap = new Map<string, Record<string, unknown>>();
    studiesRaw.filter((s) => !s.isDeleted).forEach((s) => {
      const batch = str(s.batchNumber || s.batch_number);
      const studyType = str(s.studyType || s.study_type);
      const storage = str(s.storageCondition || s.storage_condition);
      studyMap.set(`${batch}|${studyType}|${storage}`.toLowerCase(), s);
      if (s.id) studyMap.set(str(s.id), s);
    });

    const scheduleMap = new Map<string, Record<string, unknown>>();
    schedulesRaw.filter((s) => !s.isDeleted).forEach((s) => {
      const batch = str(s.batchNumber || s.batch_number);
      const studyType = str(s.studyType || s.study_type);
      const storage = str(s.storageCondition || s.storage_condition);
      const interval = str(s.interval || s.pullingInterval || s.pulling_interval);
      scheduleMap.set(`${batch}|${studyType}|${storage}|${interval}`.toLowerCase(), s);
      if (s.id) scheduleMap.set(str(s.id), s);
    });

    const groups = new Map<string, PullAcc>();

    const processResult = (raw: Record<string, unknown>) => {
      if (raw.isDeleted) return;
      const testDate = str(raw.testDate || raw.test_date || raw.createdAt);
      if (!inPeriod(testDate, from, to)) return;
      if (!matchesProduct(raw, pqr) && str(raw.productCode)) return;
      const acc = accFromResult(raw, scheduleMap, studyMap);
      if (!acc) return;
      const key = groupKey(acc.batchNumber, acc.studyType, acc.storageCondition, acc.pullingInterval, acc.parameterName);
      const cur = groups.get(key);
      groups.set(key, cur ? mergeAcc(cur, acc) : acc);
    };

    resultsRaw.forEach(processResult);
    if (groups.size === 0) {
      monitoringRaw.forEach((raw) => {
        if (raw.isDeleted) return;
        const testDate = str(raw.testDate || raw.monitoring_date || raw.createdAt);
        if (!inPeriod(testDate, from, to)) return;
        if (!matchesProduct(raw, pqr) && str(raw.productCode)) return;
        const acc = accFromMonitoring(raw);
        if (!acc) return;
        const key = groupKey(acc.batchNumber, acc.studyType, acc.storageCondition, acc.pullingInterval, acc.parameterName);
        const cur = groups.get(key);
        groups.set(key, cur ? mergeAcc(cur, acc) : acc);
      });
    }

    await logStabilityReviewAudit('sample pulling review', actor, { groups: groups.size }, pqr.id);

    let created = 0;
    let skipped = 0;
    const batch = writeBatch(getFirebaseFirestore());

    for (const g of Array.from(groups.values())) {
      const key = groupKey(g.batchNumber, g.studyType, g.storageCondition, g.pullingInterval, g.parameterName);
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      const record = accToRecord(g, pqr, capas, actor);
      batch.set(doc(collection(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review)), record);
      existingKeys.add(key);
      created += 1;
    }

    if (created > 0) await batch.commit();
    await logStabilityReviewAudit('OOT/OOS summary generated', actor, { created, skipped }, pqr.id);
    await logStabilityReviewAudit('risk calculated', actor, { created }, pqr.id);
    if (created > 0) await logStabilityReviewAudit('CAPA linked', actor, { created }, pqr.id);
    return { created, skipped };
  } catch (e) {
    console.error('pullStabilityReviewData failed', e);
    return { created: 0, skipped: 0, error: (e as Error).message };
  }
}

export async function createStabilityReviewRecord(
  pqr: PqrOption,
  data: StabilityReviewFormData,
  actor: PqrStabilityReviewActor,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  const existing = await fetchStabilityReviewRecords(pqr.id);
  const key = groupKey(data.batchNumber, data.studyType, data.storageCondition, data.pullingInterval, data.parameterName);
  if (existing.some((r) => groupKey(r.batchNumber, r.studyType, r.storageCondition, r.pullingInterval, r.parameterName) === key)) {
    return { error: 'Duplicate stability review entry for this batch/interval/parameter under the same PQR.' };
  }

  try {
    const partial = formToPartial(data);
    const computed = computeStabilityCompliance(partial);
    const ts = nowIso();
    const record: Omit<PqrStabilityReviewRecord, 'id'> = {
      stabilityReviewId: buildStabilityReviewId(data.batchNumber, data.pullingInterval, data.parameterName),
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      product: data.product,
      productCode: data.productCode,
      ...partial,
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      sourceType: 'manual',
      attachmentUrls: [],
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name,
      isDeleted: false,
    } as Omit<PqrStabilityReviewRecord, 'id'>;
    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review), record);
    await logStabilityReviewAudit('create stability review', actor, { batch: data.batchNumber }, docRef.id);
    return { id: docRef.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateStabilityReviewRecord(
  id: string,
  data: StabilityReviewFormData,
  actor: PqrStabilityReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const partial = formToPartial(data);
    const computed = computeStabilityCompliance(partial);
    await updateDoc(doc(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review, id), {
      ...partial,
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logStabilityReviewAudit('edit stability review', actor, { id }, id);
    await logStabilityReviewAudit('risk calculated', actor, computed, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function softDeleteStabilityReviewRecord(
  id: string,
  actor: PqrStabilityReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review, id), {
      isDeleted: true,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logStabilityReviewAudit('delete stability review', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveStabilitySectionToPqr(
  pqrId: string,
  narrative: string,
  records: PqrStabilityReviewRecord[],
  actor: PqrStabilityReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const summary = computeStabilityReviewSummary(records);
    const ts = nowIso();
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'stability_review'),
    ));
    const payload = {
      pqrId,
      sectionKey: 'stability_review',
      sectionType: 'Stability Review',
      sectionOrder: 24,
      sectionTitle: 'Stability Review',
      narrative,
      dataSummary: JSON.stringify(summary),
      included: true,
      status: 'Draft',
      updatedAt: ts,
      updatedBy: actor.id,
    };
    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.sections), {
        ...payload, createdAt: ts, createdBy: actor.id, isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, payload);
    }
    await logStabilityReviewAudit('section saved', actor, { pqrId }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function uploadStabilityReviewAttachment(
  pqrId: string,
  recordId: string,
  file: File,
  actor: PqrStabilityReviewActor,
): Promise<{ url?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const path = `pqr/${pqrId}/stability-review/${recordId}/${Date.now()}_${file.name}`;
    const storageRef = ref(getFirebaseStorage(), path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const docRef = doc(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review, recordId);
    const snap = await getDoc(docRef);
    const existing = (snap.data()?.attachmentUrls as string[] | undefined) || [];
    await updateDoc(docRef, {
      attachmentUrls: [...existing, url],
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });

    await logStabilityReviewAudit('attachment uploaded', actor, { recordId, fileName: file.name }, recordId);
    return { url };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteStabilityReviewAttachment(
  pqrId: string,
  recordId: string,
  url: string,
  actor: PqrStabilityReviewActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const docRef = doc(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review, recordId);
    const snap = await getDoc(docRef);
    const existing = (snap.data()?.attachmentUrls as string[] | undefined) || [];
    await updateDoc(docRef, {
      attachmentUrls: existing.filter((u) => u !== url),
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logStabilityReviewAudit('attachment deleted', actor, { recordId, url }, recordId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function getStabilityReviewNarrative(records: PqrStabilityReviewRecord[]): string {
  return generateStabilityNarrative(computeStabilityReviewSummary(records), records);
}

export {
  computeStabilityReviewSummary,
  generateStabilityNarrative,
  buildStabilityReviewCharts,
} from '@/lib/pqr-stability-review-records';

export async function recalculateAllStabilityCompliance(
  pqrId: string,
  actor: PqrStabilityReviewActor,
): Promise<void> {
  const records = await fetchStabilityReviewRecords(pqrId);
  for (const r of records) {
    if (!r.id) continue;
    const computed = computeStabilityCompliance(r);
    await updateDoc(doc(getFirebaseFirestore(), PQR_STABILITY_REVIEW_COLLECTIONS.review, r.id), {
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
  }
  await logStabilityReviewAudit('risk calculated', actor, { count: records.length }, pqrId);
}

export async function logStabilityReviewView(actor: PqrStabilityReviewActor) {
  await logStabilityReviewAudit('stability review viewed', actor);
}

export async function logStabilityReviewExport(actor: PqrStabilityReviewActor) {
  await logStabilityReviewAudit('export review', actor);
}

export async function logStabilityNarrativeEdit(actor: PqrStabilityReviewActor, pqrId: string) {
  await logStabilityReviewAudit('narrative edited', actor, { pqrId }, pqrId);
}

export async function logStabilityImportPlaceholder(actor: PqrStabilityReviewActor) {
  await logStabilityReviewAudit('import stability data placeholder', actor);
}
