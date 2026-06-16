import {
  collection, doc, addDoc, getDocs, updateDoc, query, where, limit, orderBy, writeBatch,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { ENVIRONMENTAL_LEGACY_COLLECTIONS, ENVIRONMENTAL_MONITORING_COLLECTION } from '@/lib/cpv-environmental-monitoring';
import { UTILITY_LEGACY_COLLECTIONS, UTILITY_MONITORING_COLLECTION } from '@/lib/cpv-utility-monitoring';
import type { PqrOption } from '@/lib/pqr-batch-review-records';
import { fetchPqrOptions } from '@/lib/pqr-batch-review-service';
import {
  PQR_UTILITY_ENV_COLLECTIONS, PQR_UTILITY_ENV_MODULE,
  computeUtilityEnvCompliance, computeUtilityEnvSummary, generateUtilityEnvNarrative,
  type PqrUtilityEnvironmentalReviewRecord, type UtilityEnvReviewFormData,
} from '@/lib/pqr-utility-environmental-review-records';

export type PqrUtilityEnvActor = { id: string; name: string; role?: string };

export { fetchPqrOptions };

const nowIso = () => new Date().toISOString();
const str = (v: unknown, fb = '') => (v === null || v === undefined ? fb : String(v));
const num = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function buildReviewId(reviewType: string, system: string, param: string) {
  return `UER-${reviewType.slice(0, 3).toUpperCase()}-${system.slice(0, 6).replace(/\s+/g, '-')}-${param.slice(0, 8).replace(/\s+/g, '-')}-${Date.now().toString(36).toUpperCase()}`;
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
  for (const name of names) {
    const rows = await readCollection(name, max);
    if (rows.length) return rows;
  }
  return [];
}

async function logUtilityEnvAudit(actionType: string, actor: PqrUtilityEnvActor, detail?: unknown, recordId = 'utility-env-review') {
  try {
    await createAuditLog({
      moduleName: PQR_UTILITY_ENV_MODULE,
      collectionName: PQR_UTILITY_ENV_COLLECTIONS.review,
      recordId,
      actionType,
      newValue: detail,
      user: { id: actor.id, name: actor.name },
      status: 'Success',
    });
    await writeAuditTrail({
      collectionName: PQR_UTILITY_ENV_COLLECTIONS.review,
      documentId: recordId,
      action: actionType,
      oldValue: null,
      newValue: detail,
      userId: actor.id,
      userName: actor.name,
      moduleName: PQR_UTILITY_ENV_MODULE,
    });
  } catch (e) {
    console.error('logUtilityEnvAudit failed', e);
  }
}

function inPeriod(dateStr: string, from: string, to: string): boolean {
  const d = dateStr.slice(0, 10);
  if (!from || !to || !d) return true;
  return d >= from && d <= to;
}

function matchesProduct(raw: Record<string, unknown>, pqr: PqrOption): boolean {
  const code = str(raw.productCode || raw.product_code).toLowerCase();
  const name = str(raw.productName || raw.product_name).toLowerCase();
  if (code && code === pqr.productCode.toLowerCase()) return true;
  if (name && pqr.productName.toLowerCase().includes(name)) return true;
  if (name && name.includes(pqr.productName.toLowerCase())) return true;
  return !code && !name;
}

function parseObserved(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statusBucket(status: string): 'alert' | 'action' | 'excursion' | 'complies' {
  const s = status.toLowerCase();
  if (s === 'excursion') return 'excursion';
  if (s === 'action') return 'action';
  if (s === 'alert') return 'alert';
  return 'complies';
}

interface GroupAcc {
  reviewType: 'Utility Review' | 'Environmental Review';
  systemAreaName: string;
  systemAreaCode: string;
  utilityType: string;
  cleanroomGrade: string;
  roomNumber: string;
  monitoringParameter: string;
  values: number[];
  lowerLimit: number;
  upperLimit: number;
  alertCount: number;
  actionCount: number;
  excursionCount: number;
  deviationCount: number;
  capaCount: number;
  changeControlCount: number;
  impactOnProduct: string;
  sourceIds: string[];
}

function groupKey(g: GroupAcc) {
  return `${g.reviewType}|${g.systemAreaName}|${g.monitoringParameter}|${g.utilityType}|${g.cleanroomGrade}`.toLowerCase();
}

function countLinked(
  systemName: string,
  param: string,
  records: Record<string, unknown>[],
  from: string,
  to: string,
  kind: 'deviation' | 'capa' | 'cc',
): number {
  return records.filter((r) => {
    const text = `${str(r.title)} ${str(r.description)} ${str(r.systemName)} ${str(r.areaName)} ${str(r.parameter)} ${str(r.source)}`.toLowerCase();
    const match = text.includes(systemName.toLowerCase()) || text.includes(param.toLowerCase())
      || str(r.module).toLowerCase().includes(kind === 'deviation' ? 'deviation' : kind === 'capa' ? 'capa' : 'change');
    if (!match) return false;
    const date = str(r.createdAt || r.created_at || r.reportedDate || r.date).slice(0, 10);
    return inPeriod(date, from, to);
  }).length;
}

function accFromUtility(raw: Record<string, unknown>): GroupAcc | null {
  const date = str(raw.monitoringDate || raw.monitoring_date || raw.createdAt);
  const param = str(raw.parameterName || raw.parameter_name);
  const system = str(raw.utilitySystemName || raw.utility_system_name || raw.samplingPoint || raw.sampling_point);
  if (!param || !system) return null;
  const status = str(raw.status, 'Complies');
  const bucket = statusBucket(status);
  const val = parseObserved(raw.observedValue ?? raw.observed_value);
  return {
    reviewType: 'Utility Review',
    systemAreaName: system,
    systemAreaCode: str(raw.utilitySystemCode || raw.utility_system_code || raw.parameterCode),
    utilityType: str(raw.utilityType || raw.utility_type, 'Other'),
    cleanroomGrade: 'Unclassified',
    roomNumber: str(raw.areaRoomNo || raw.area_room_no || raw.roomNumber),
    monitoringParameter: param,
    values: val != null ? [val] : [],
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit, 100),
    alertCount: bucket === 'alert' ? 1 : 0,
    actionCount: bucket === 'action' ? 1 : 0,
    excursionCount: bucket === 'excursion' ? 1 : 0,
    deviationCount: raw.deviationRequired || raw.linkedDeviationNumber ? 1 : 0,
    capaCount: raw.capaRequired || raw.linkedCapaNumber ? 1 : 0,
    changeControlCount: 0,
    impactOnProduct: bucket === 'excursion' ? 'Yes' : 'No',
    sourceIds: [str(raw.id)],
  };
}

function accFromEnvironmental(raw: Record<string, unknown>): GroupAcc | null {
  const param = str(raw.parameterName || raw.parameter_name || raw.monitoringType || raw.monitoring_type);
  const system = str(raw.areaName || raw.area_name);
  if (!param || !system) return null;
  const status = str(raw.status, 'Complies');
  const bucket = statusBucket(status);
  const val = parseObserved(raw.observedValue ?? raw.observed_value);
  const grade = str(raw.cleanroomGrade || raw.cleanroom_grade, 'Unclassified');
  return {
    reviewType: 'Environmental Review',
    systemAreaName: system,
    systemAreaCode: str(raw.areaId || raw.area_id || raw.parameterCode),
    utilityType: 'Other',
    cleanroomGrade: grade,
    roomNumber: str(raw.roomNumber || raw.room_number),
    monitoringParameter: param,
    values: val != null ? [val] : [],
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit, 100),
    alertCount: bucket === 'alert' ? 1 : 0,
    actionCount: bucket === 'action' ? 1 : 0,
    excursionCount: bucket === 'excursion' ? 1 : 0,
    deviationCount: raw.deviationRequired || raw.linkedDeviationNumber ? 1 : 0,
    capaCount: raw.capaRequired || raw.linkedCapaNumber ? 1 : 0,
    changeControlCount: 0,
    impactOnProduct: bucket === 'excursion' && ['Grade A', 'Grade B'].includes(grade) ? 'Yes' : 'No',
    sourceIds: [str(raw.id)],
  };
}

function mergeAcc(base: GroupAcc, add: GroupAcc): GroupAcc {
  return {
    ...base,
    values: [...base.values, ...add.values],
    alertCount: base.alertCount + add.alertCount,
    actionCount: base.actionCount + add.actionCount,
    excursionCount: base.excursionCount + add.excursionCount,
    deviationCount: base.deviationCount + add.deviationCount,
    capaCount: base.capaCount + add.capaCount,
    impactOnProduct: base.impactOnProduct === 'Yes' || add.impactOnProduct === 'Yes' ? 'Yes' : 'No',
    sourceIds: [...base.sourceIds, ...add.sourceIds],
  };
}

function accToRecord(
  g: GroupAcc,
  pqr: PqrOption,
  deviations: Record<string, unknown>[],
  capas: Record<string, unknown>[],
  changeControls: Record<string, unknown>[],
  actor: PqrUtilityEnvActor,
): Omit<PqrUtilityEnvironmentalReviewRecord, 'id'> {
  const ts = nowIso();
  const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
  const to = pqr.reviewPeriodTo?.slice(0, 10) || '';
  const min = g.values.length ? Math.min(...g.values) : null;
  const max = g.values.length ? Math.max(...g.values) : null;
  const avg = g.values.length ? g.values.reduce((a, b) => a + b, 0) / g.values.length : null;
  const linkedDev = countLinked(g.systemAreaName, g.monitoringParameter, deviations, from, to, 'deviation');
  const linkedCapa = countLinked(g.systemAreaName, g.monitoringParameter, capas, from, to, 'capa');
  const linkedCc = countLinked(g.systemAreaName, g.monitoringParameter, changeControls, from, to, 'cc');

  const partial: Partial<PqrUtilityEnvironmentalReviewRecord> = {
    reviewId: buildReviewId(g.reviewType, g.systemAreaName, g.monitoringParameter),
    pqrId: pqr.id,
    pqrNumber: pqr.pqrNumber,
    product: pqr.productName,
    productCode: pqr.productCode,
    reviewPeriodFrom: from,
    reviewPeriodTo: to,
    reviewType: g.reviewType,
    systemAreaName: g.systemAreaName,
    systemAreaCode: g.systemAreaCode,
    utilityType: g.utilityType,
    cleanroomGrade: g.cleanroomGrade,
    roomNumber: g.roomNumber,
    monitoringParameter: g.monitoringParameter,
    observedMinimum: min,
    observedMaximum: max,
    observedAverage: avg != null ? Math.round(avg * 1000) / 1000 : null,
    lowerLimit: g.lowerLimit,
    upperLimit: g.upperLimit,
    alertCount: g.alertCount,
    actionCount: g.actionCount,
    excursionCount: g.excursionCount,
    deviationCount: g.deviationCount + linkedDev,
    capaCount: g.capaCount + linkedCapa,
    changeControlCount: linkedCc,
    impactOnProductQuality: g.impactOnProduct,
    conclusion: g.excursionCount === 0 ? 'Within limits' : 'Reviewed for impact',
    remarks: '',
    sourceType: 'pull',
    sourceIds: g.sourceIds,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdByName: actor.name,
    updatedByName: actor.name,
    isDeleted: false,
  };
  const computed = computeUtilityEnvCompliance(partial);
  return { ...partial, ...computed } as Omit<PqrUtilityEnvironmentalReviewRecord, 'id'>;
}

export async function fetchUtilityEnvReviewRecords(pqrId: string): Promise<PqrUtilityEnvironmentalReviewRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review),
      where('pqrId', '==', pqrId),
      where('isDeleted', '==', false),
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as PqrUtilityEnvironmentalReviewRecord))
      .sort((a, b) => a.systemAreaName.localeCompare(b.systemAreaName));
  } catch {
    try {
      const snap = await getDocs(query(
        collection(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review),
        where('pqrId', '==', pqrId),
      ));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PqrUtilityEnvironmentalReviewRecord))
        .filter((r) => !r.isDeleted)
        .sort((a, b) => a.systemAreaName.localeCompare(b.systemAreaName));
    } catch (e) {
      console.error('fetchUtilityEnvReviewRecords failed', e);
      return [];
    }
  }
}

export async function pullUtilityEnvironmentalData(
  pqr: PqrOption,
  actor: PqrUtilityEnvActor,
): Promise<{ created: number; skipped: number; error?: string }> {
  if (!isFirebaseConfigured()) return { created: 0, skipped: 0, error: 'Firebase is not configured.' };

  try {
    await logUtilityEnvAudit('pull utility data', actor, { pqrId: pqr.id }, pqr.id);

    const from = pqr.reviewPeriodFrom?.slice(0, 10) || '';
    const to = pqr.reviewPeriodTo?.slice(0, 10) || '';

    const [existing, utilityRaw, envRaw, deviations, capas, changeControls] = await Promise.all([
      fetchUtilityEnvReviewRecords(pqr.id),
      readFirst([UTILITY_MONITORING_COLLECTION, ...UTILITY_LEGACY_COLLECTIONS]),
      readFirst([ENVIRONMENTAL_MONITORING_COLLECTION, ...ENVIRONMENTAL_LEGACY_COLLECTIONS]),
      readFirst([PQR_UTILITY_ENV_COLLECTIONS.deviations, 'deviation']),
      readFirst([PQR_UTILITY_ENV_COLLECTIONS.capaRecords, 'capa']),
      readFirst([PQR_UTILITY_ENV_COLLECTIONS.changeControls, 'change_control']),
    ]);

    const existingKeys = new Set(existing.map((r) =>
      `${r.reviewType}|${r.systemAreaName}|${r.monitoringParameter}`.toLowerCase(),
    ));

    const groups = new Map<string, GroupAcc>();

    const processRaw = (raw: Record<string, unknown>, mapper: (r: Record<string, unknown>) => GroupAcc | null) => {
      const date = str(raw.monitoringDate || raw.monitoring_date || raw.createdAt);
      if (!inPeriod(date, from, to)) return;
      if (!matchesProduct(raw, pqr) && str(raw.productCode)) return;
      const acc = mapper(raw);
      if (!acc) return;
      const key = groupKey(acc);
      const cur = groups.get(key);
      groups.set(key, cur ? mergeAcc(cur, acc) : acc);
    };

    utilityRaw.forEach((r) => processRaw(r, accFromUtility));
    envRaw.forEach((r) => processRaw(r, accFromEnvironmental));

    await logUtilityEnvAudit('pull environmental data', actor, { groups: groups.size }, pqr.id);

    let created = 0;
    let skipped = 0;
    const batch = writeBatch(getFirebaseFirestore());

    for (const g of Array.from(groups.values())) {
      const simpleKey = `${g.reviewType}|${g.systemAreaName}|${g.monitoringParameter}`.toLowerCase();
      if (existingKeys.has(simpleKey)) {
        skipped += 1;
        continue;
      }
      const record = accToRecord(g, pqr, deviations, capas, changeControls, actor);
      batch.set(doc(collection(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review)), record);
      existingKeys.add(simpleKey);
      created += 1;
    }

    if (created > 0) await batch.commit();
    await logUtilityEnvAudit('excursion summary generated', actor, { created, skipped }, pqr.id);
    await logUtilityEnvAudit('risk calculated', actor, { created }, pqr.id);
    return { created, skipped };
  } catch (e) {
    console.error('pullUtilityEnvironmentalData failed', e);
    return { created: 0, skipped: 0, error: (e as Error).message };
  }
}

export async function createUtilityEnvReviewRecord(
  pqr: PqrOption,
  data: UtilityEnvReviewFormData,
  actor: PqrUtilityEnvActor,
): Promise<{ id?: string; error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  const existing = await fetchUtilityEnvReviewRecords(pqr.id);
  const key = `${data.reviewType}|${data.systemAreaName}|${data.monitoringParameter}`.toLowerCase();
  if (existing.some((r) => `${r.reviewType}|${r.systemAreaName}|${r.monitoringParameter}`.toLowerCase() === key)) {
    return { error: 'Duplicate review entry for this system/parameter under the same PQR.' };
  }

  try {
    const computed = computeUtilityEnvCompliance(data);
    const ts = nowIso();
    const record: Omit<PqrUtilityEnvironmentalReviewRecord, 'id'> = {
      reviewId: buildReviewId(data.reviewType, data.systemAreaName, data.monitoringParameter),
      pqrId: pqr.id,
      pqrNumber: pqr.pqrNumber,
      product: data.product,
      productCode: data.productCode,
      reviewPeriodFrom: data.reviewPeriodFrom,
      reviewPeriodTo: data.reviewPeriodTo,
      reviewType: data.reviewType,
      systemAreaName: data.systemAreaName,
      systemAreaCode: data.systemAreaCode,
      utilityType: data.utilityType,
      cleanroomGrade: data.cleanroomGrade,
      roomNumber: data.roomNumber,
      monitoringParameter: data.monitoringParameter,
      observedMinimum: data.observedMinimum ?? null,
      observedMaximum: data.observedMaximum ?? null,
      observedAverage: data.observedAverage ?? null,
      lowerLimit: data.lowerLimit,
      upperLimit: data.upperLimit,
      alertCount: data.alertCount,
      actionCount: data.actionCount,
      excursionCount: data.excursionCount,
      deviationCount: data.deviationCount,
      capaCount: data.capaCount,
      changeControlCount: data.changeControlCount,
      impactOnProductQuality: data.impactOnProductQuality,
      conclusion: data.conclusion,
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      remarks: data.remarks,
      sourceType: 'manual',
      createdAt: ts,
      updatedAt: ts,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdByName: actor.name,
      updatedByName: actor.name,
      isDeleted: false,
    };
    const docRef = await addDoc(collection(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review), record);
    await logUtilityEnvAudit('create review', actor, { system: data.systemAreaName }, docRef.id);
    return { id: docRef.id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateUtilityEnvReviewRecord(
  id: string,
  data: UtilityEnvReviewFormData,
  actor: PqrUtilityEnvActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const computed = computeUtilityEnvCompliance(data);
    await updateDoc(doc(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review, id), {
      ...data,
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
      updatedByName: actor.name,
    });
    await logUtilityEnvAudit('edit review', actor, { id }, id);
    await logUtilityEnvAudit('risk calculated', actor, computed, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function softDeleteUtilityEnvReviewRecord(id: string, actor: PqrUtilityEnvActor): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    await updateDoc(doc(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review, id), {
      isDeleted: true,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
    await logUtilityEnvAudit('delete review', actor, { id }, id);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function saveUtilityEnvSectionToPqr(
  pqrId: string,
  narrative: string,
  records: PqrUtilityEnvironmentalReviewRecord[],
  actor: PqrUtilityEnvActor,
): Promise<{ error?: string }> {
  if (!isFirebaseConfigured()) return { error: 'Firebase is not configured.' };
  try {
    const summary = computeUtilityEnvSummary(records);
    const ts = nowIso();
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.sections),
      where('pqrId', '==', pqrId),
      where('sectionKey', '==', 'utility_environmental_review'),
    ));
    const payload = {
      pqrId,
      sectionKey: 'utility_environmental_review',
      sectionType: 'Utility & Environmental Review',
      sectionOrder: 23,
      sectionTitle: 'Utility & Environmental Monitoring Review',
      narrative,
      dataSummary: JSON.stringify(summary),
      included: true,
      status: 'Draft',
      updatedAt: ts,
      updatedBy: actor.id,
    };
    if (snap.empty) {
      await addDoc(collection(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.sections), {
        ...payload, createdAt: ts, createdBy: actor.id, isDeleted: false,
      });
    } else {
      await updateDoc(snap.docs[0].ref, payload);
    }
    await logUtilityEnvAudit('section saved to PQR', actor, { pqrId }, pqrId);
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export function getUtilityEnvReviewNarrative(records: PqrUtilityEnvironmentalReviewRecord[]): string {
  return generateUtilityEnvNarrative(computeUtilityEnvSummary(records), records);
}

export { computeUtilityEnvSummary, generateUtilityEnvNarrative, buildUtilityEnvCharts } from '@/lib/pqr-utility-environmental-review-records';

export async function logUtilityEnvReviewView(actor: PqrUtilityEnvActor) {
  await logUtilityEnvAudit('utility environmental review viewed', actor);
}

export async function logUtilityEnvReviewExport(actor: PqrUtilityEnvActor) {
  await logUtilityEnvAudit('export review', actor);
}

export async function logUtilityEnvNarrativeEdit(actor: PqrUtilityEnvActor, pqrId: string) {
  await logUtilityEnvAudit('narrative edited', actor, { pqrId }, pqrId);
}

export async function recalculateAllUtilityEnvCompliance(pqrId: string, actor: PqrUtilityEnvActor): Promise<void> {
  const records = await fetchUtilityEnvReviewRecords(pqrId);
  for (const r of records) {
    if (!r.id) continue;
    const computed = computeUtilityEnvCompliance(r);
    await updateDoc(doc(getFirebaseFirestore(), PQR_UTILITY_ENV_COLLECTIONS.review, r.id), {
      complianceStatus: computed.complianceStatus,
      complianceReasons: computed.complianceReasons,
      riskLevel: computed.riskLevel,
      updatedAt: nowIso(),
      updatedBy: actor.id,
    });
  }
  await logUtilityEnvAudit('risk calculated', actor, { count: records.length }, pqrId);
}
