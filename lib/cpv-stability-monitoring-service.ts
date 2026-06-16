import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchCpvProductById } from '@/lib/cpv-product-master-service';
import { fetchCpvBatches } from '@/lib/cpv-batch-registration-service';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import {
  STABILITY_STUDIES_COLLECTION,
  STABILITY_SCHEDULES_COLLECTION,
  STABILITY_RESULTS_COLLECTION,
  STABILITY_LEGACY_COLLECTIONS,
  STABILITY_MONITORING_COLLECTION,
  STABILITY_MODULE_NAME,
  INTERVALS_BY_STUDY_TYPE,
  buildStabilityStudyNumber,
  buildStabilityMonitoringId,
  evaluateStabilityStatus,
  evaluateStabilityRisk,
  computeScheduleStatus,
  computeParameterSlope,
  intervalToMonths,
  addMonthsToDate,
  defaultLimitsForParameter,
  mapDefaultParameterFields,
  DEFAULT_STABILITY_PARAMETERS,
  type StabilityStudyFormData,
  type StabilityStudyRecord,
  type StabilityScheduleRecord,
  type StabilityResultFormData,
  type StabilityResultRecord,
  type StabilityAttachment,
} from '@/lib/cpv-stability-monitoring';

export interface StabilityActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: StabilityActor) {
  return { moduleName: STABILITY_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logStabilityAudit(
  actionType: string,
  recordId: string,
  actor: StabilityActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: STABILITY_MODULE_NAME,
    collectionName: STABILITY_RESULTS_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: STABILITY_RESULTS_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: STABILITY_MODULE_NAME,
  });
}

function str(v: unknown, fb = ''): string {
  if (v === null || v === undefined) return fb;
  return String(v);
}

function num(v: unknown, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function normalizeStudy(raw: Record<string, unknown>): StabilityStudyRecord {
  const batchNumber = str(raw.batchNumber || raw.batch_number);
  const studyType = str(raw.studyType || raw.study_type, 'Long Term');
  return {
    id: str(raw.id),
    stabilityMonitoringId: str(raw.stabilityMonitoringId || raw.stability_monitoring_id),
    stabilityStudyNumber: str(raw.stabilityStudyNumber || raw.stability_study_number, buildStabilityStudyNumber(batchNumber, studyType)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    expiryDate: str(raw.expiryDate || raw.expiry_date),
    studyType: studyType as StabilityStudyRecord['studyType'],
    storageCondition: (str(raw.storageCondition || raw.storage_condition, '25°C / 60% RH') as StabilityStudyRecord['storageCondition']),
    studyStartDate: str(raw.studyStartDate || raw.study_start_date || raw.study_initiation_date),
    studyEndDate: str(raw.studyEndDate || raw.study_end_date),
    studyStatus: (str(raw.studyStatus || raw.study_status || raw.status, 'Ongoing') as StabilityStudyRecord['studyStatus']),
    remarks: str(raw.remarks),
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

function normalizeSchedule(raw: Record<string, unknown>): StabilityScheduleRecord {
  const dueDate = str(raw.samplePullingDueDate || raw.sample_pulling_due_date || raw.scheduled_date);
  const actualPull = str(raw.actualPullingDate || raw.actual_pulling_date || raw.actualSamplePullingDate);
  const resultEntry = str(raw.resultEntryStatus || raw.result_entry_status, 'Pending');
  const cancelled = str(raw.scheduleStatus) === 'Cancelled';
  const scheduleStatus = str(
    raw.scheduleStatus || raw.schedule_status,
    computeScheduleStatus(dueDate, actualPull, resultEntry, cancelled),
  );
  return {
    id: str(raw.id),
    studyId: str(raw.studyId || raw.study_id),
    stabilityStudyNumber: str(raw.stabilityStudyNumber || raw.stability_study_number || raw.study_number),
    batchNumber: str(raw.batchNumber || raw.batch_number),
    studyType: str(raw.studyType || raw.study_type),
    storageCondition: str(raw.storageCondition || raw.storage_condition),
    interval: str(raw.interval || raw.pullingInterval || raw.pulling_interval),
    samplePullingDueDate: dueDate,
    actualPullingDate: actualPull,
    scheduleStatus,
    resultEntryStatus: resultEntry,
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    isDeleted: Boolean(raw.isDeleted),
  };
}

function normalizeResult(raw: Record<string, unknown>): StabilityResultRecord {
  const batchNumber = str(raw.batchNumber || raw.batch_number);
  const interval = str(raw.pullingInterval || raw.pulling_interval || raw.interval);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  const lower = num(raw.lowerLimit ?? raw.lower_limit ?? raw.lsl);
  const upper = num(raw.upperLimit ?? raw.upper_limit ?? raw.usl);
  const resultType = str(raw.resultType || raw.result_type, 'Numeric');
  const observed = raw.observedResult ?? raw.observed_result ?? raw.observedValue;
  const status = str(
    raw.status || raw.result_status,
    evaluateStabilityStatus(
      observed as number | string,
      lower,
      upper,
      resultType,
      num(raw.alertLimitLow ?? raw.alert_limit_low),
      num(raw.alertLimitHigh ?? raw.alert_limit_high),
      num(raw.actionLimitLow ?? raw.action_limit_low),
      num(raw.actionLimitHigh ?? raw.action_limit_high),
    ),
  );
  const attachments = Array.isArray(raw.attachments) ? raw.attachments as StabilityAttachment[] : [];
  return {
    id: str(raw.id),
    stabilityMonitoringId: str(
      raw.stabilityMonitoringId || raw.stability_monitoring_id,
      buildStabilityMonitoringId(batchNumber, interval, parameterCode),
    ),
    studyId: str(raw.studyId || raw.study_id),
    scheduleId: str(raw.scheduleId || raw.schedule_id),
    stabilityStudyNumber: str(raw.stabilityStudyNumber || raw.stability_study_number || raw.study_number),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    expiryDate: str(raw.expiryDate || raw.expiry_date),
    studyType: (str(raw.studyType || raw.study_type, 'Long Term') as StabilityResultRecord['studyType']),
    storageCondition: (str(raw.storageCondition || raw.storage_condition, '25°C / 60% RH') as StabilityResultRecord['storageCondition']),
    pullingInterval: (interval as StabilityResultRecord['pullingInterval']),
    samplePullingDueDate: str(raw.samplePullingDueDate || raw.sample_pulling_due_date),
    actualSamplePullingDate: str(raw.actualSamplePullingDate || raw.actual_sample_pulling_date),
    testDate: str(raw.testDate || raw.test_date),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name),
    observedResult: observed as number | string,
    targetValue: num(raw.targetValue ?? raw.target_value ?? raw.target),
    lowerLimit: lower,
    upperLimit: upper,
    alertLimitLow: num(raw.alertLimitLow ?? raw.alert_limit_low),
    alertLimitHigh: num(raw.alertLimitHigh ?? raw.alert_limit_high),
    actionLimitLow: num(raw.actionLimitLow ?? raw.action_limit_low),
    actionLimitHigh: num(raw.actionLimitHigh ?? raw.action_limit_high),
    unit: str(raw.unit),
    resultType: (resultType as StabilityResultRecord['resultType']),
    analyst: str(raw.analyst || raw.analyst_name),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    remarks: str(raw.remarks),
    status,
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    ootRequired: Boolean(raw.ootRequired || raw.oot_required || status === 'OOT'),
    oosRequired: Boolean(raw.oosRequired || raw.oos_required || status === 'OOS'),
    linkedOosNumber: str(raw.linkedOosNumber || raw.linked_oos_number),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as StabilityResultRecord['reviewStatus']),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    attachments,
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export function buildStabilityComputedFields(
  data: Pick<StabilityResultFormData, 'observedResult' | 'lowerLimit' | 'upperLimit' | 'resultType' | 'alertLimitLow' | 'alertLimitHigh' | 'actionLimitLow' | 'actionLimitHigh' | 'parameterName'>,
) {
  const status = evaluateStabilityStatus(
    data.observedResult,
    data.lowerLimit,
    data.upperLimit,
    data.resultType,
    data.alertLimitLow,
    data.alertLimitHigh,
    data.actionLimitLow,
    data.actionLimitHigh,
  );
  return {
    status,
    ootRequired: status === 'OOT',
    oosRequired: status === 'OOS',
  };
}

async function fetchFromCollection<T>(
  collectionName: string,
  normalize: (raw: Record<string, unknown>) => T,
  max = 500,
): Promise<T[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await getRecords<Record<string, unknown>>(collectionName, [orderBy('createdAt', 'desc'), limit(max)]);
    } catch {
      rows = await getRecords<Record<string, unknown>>(collectionName, [limit(max)]);
    }
    const normalized = rows
      .map((r) => normalize(r))
      .filter((r) => !(r as { isDeleted?: boolean }).isDeleted);
    if (normalized.length) return normalized.sort((a, b) => {
      const aDate = (a as { createdAt?: string }).createdAt || '';
      const bDate = (b as { createdAt?: string }).createdAt || '';
      return bDate.localeCompare(aDate);
    });
    return [];
  } catch (e) {
    console.error(`fetchFromCollection ${collectionName} failed`, e);
    return [];
  }
}

export async function fetchStabilityStudies(max = 500): Promise<StabilityStudyRecord[]> {
  const primary = await fetchFromCollection(STABILITY_STUDIES_COLLECTION, normalizeStudy, max);
  if (primary.length) return primary;
  for (const legacy of STABILITY_LEGACY_COLLECTIONS) {
    const legacyRows = await listCpvRecords<Record<string, unknown>>(legacy, max);
    if (legacyRows.length) return legacyRows.map((r) => normalizeStudy(r));
  }
  const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.stability, max);
  return cpvLegacy.map((r) => normalizeStudy(r));
}

export async function fetchStabilitySchedules(studyId?: string, max = 500): Promise<StabilityScheduleRecord[]> {
  const all = await fetchFromCollection(STABILITY_SCHEDULES_COLLECTION, normalizeSchedule, max);
  if (!studyId) return all;
  return all.filter((s) => s.studyId === studyId);
}

export async function fetchStabilityResults(max = 500): Promise<StabilityResultRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: StabilityResultRecord[] = [];
    try {
      const rows = await getRecords<Record<string, unknown>>(
        STABILITY_RESULTS_COLLECTION,
        [orderBy('testDate', 'desc'), limit(max)],
      );
      primary = rows.map((r) => normalizeResult(r)).filter((r) => !r.isDeleted);
    } catch {
      primary = await fetchFromCollection(STABILITY_RESULTS_COLLECTION, normalizeResult, max);
    }
    if (!primary.length) {
      const legacy = await listCpvRecords<Record<string, unknown>>(STABILITY_MONITORING_COLLECTION, max);
      if (legacy.length) primary = legacy.map((r) => normalizeResult(r));
    }
    primary.sort((a, b) => (b.testDate || b.createdAt).localeCompare(a.testDate || a.createdAt));
    return primary;
  } catch (e) {
    console.error('fetchStabilityResults failed', e);
    return [];
  }
}

export async function fetchStabilityStudyById(id: string): Promise<StabilityStudyRecord | null> {
  const record = await getRecord<Record<string, unknown>>(STABILITY_STUDIES_COLLECTION, id);
  if (record) return normalizeStudy(record);
  const all = await fetchStabilityStudies();
  return all.find((s) => s.id === id) ?? null;
}

export async function fetchStabilityResultById(id: string): Promise<StabilityResultRecord | null> {
  const record = await getRecord<Record<string, unknown>>(STABILITY_RESULTS_COLLECTION, id);
  if (record) return normalizeResult(record);
  const all = await fetchStabilityResults();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchStabilityBatchesForProduct(productName: string, productId?: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) =>
    b.productName === productName
    || b.productCode === productName
    || (productId && b.cpvProductId === productId),
  );
}

async function countOotIntervals(batchNumber: string, parameterName: string): Promise<number> {
  const results = await fetchStabilityResults(1000);
  const intervals = new Set(
    results.filter((r) =>
      r.batchNumber === batchNumber
      && r.parameterName === parameterName
      && (r.status === 'OOT' || r.status === 'Action')
      && !r.isDeleted,
    ).map((r) => r.pullingInterval),
  );
  return intervals.size;
}

async function maybeCreateOos(record: StabilityResultRecord, actor: StabilityActor): Promise<string> {
  if (record.status !== 'OOS') return '';
  try {
    const { createOosFromCpv } = await import('@/lib/oos-service');
    const oos = await createOosFromCpv({
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.parameterName,
      observedValue: Number(record.observedResult),
      lower: record.lowerLimit,
      upper: record.upperLimit,
      unit: record.unit,
      status: 'OOS',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qc' });
    if (!oos) return '';
    return String((oos as { oos_number?: string }).oos_number || oos.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlert(record: StabilityResultRecord, actor: StabilityActor) {
  if (record.status === 'Complies') return;
  try {
    await createAlert({
      alertType: record.status === 'OOT' ? 'OOT' : 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: STABILITY_MODULE_NAME,
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.parameterName,
      message: `Stability ${record.parameterName} ${record.status} at ${record.pullingInterval} for batch ${record.batchNumber}`,
      observedValue: Number(record.observedResult),
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title: `Stability ${record.status}`,
      message: `${record.batchNumber}: ${record.parameterName} ${record.status}`,
      module: STABILITY_MODULE_NAME,
      record_id: record.id,
      target_roles: ['qa', 'qc', 'cpv'],
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch { /* optional */ }
}

export async function createStabilityStudy(
  data: StabilityStudyFormData,
  actor: StabilityActor,
): Promise<{ result: StabilityStudyRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchStabilityBatchesForProduct(data.productName, data.cpvProductId);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const studyNumber = buildStabilityStudyNumber(data.batchNumber, data.studyType);
    const existing = await fetchStabilityStudies(1000);
    const duplicate = existing.find(
      (s) => s.batchNumber === data.batchNumber
        && s.studyType === data.studyType
        && s.storageCondition === data.storageCondition
        && !s.isDeleted,
    );
    if (duplicate) return { result: null, error: 'Stability study already exists for this batch, type and condition.' };

    const payload = {
      ...data,
      stabilityStudyNumber: studyNumber,
      stabilityMonitoringId: studyNumber,
      studyStatus: 'Ongoing' as const,
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      STABILITY_STUDIES_COLLECTION,
      payload as Omit<StabilityStudyRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    const result = normalizeStudy(created as unknown as Record<string, unknown>);
    await logStabilityAudit('create stability study', result.id, actor, null, result, result.stabilityStudyNumber);
    return { result, error: null };
  } catch (e) {
    console.error('createStabilityStudy failed', e);
    return { result: null, error: 'Failed to create stability study.' };
  }
}

export async function updateStabilityStudy(
  id: string,
  data: Partial<StabilityStudyFormData>,
  actor: StabilityActor,
  existing: StabilityStudyRecord,
): Promise<{ result: StabilityStudyRecord | null; error: string | null }> {
  try {
    const updated = await updateRecord(
      STABILITY_STUDIES_COLLECTION,
      id,
      { ...data, updatedByName: actor.name } as Partial<StabilityStudyRecord>,
      actorCtx(actor),
    );
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeStudy(updated as unknown as Record<string, unknown>);
    await logStabilityAudit('edit stability study', id, actor, existing, result, result.stabilityStudyNumber);
    return { result, error: null };
  } catch (e) {
    console.error('updateStabilityStudy failed', e);
    return { result: null, error: 'Failed to update stability study.' };
  }
}

export async function generateStabilitySchedule(
  studyId: string,
  intervals: string[],
  actor: StabilityActor,
): Promise<{ schedules: StabilityScheduleRecord[]; error: string | null }> {
  if (!isFirebaseConfigured()) return { schedules: [], error: 'Firebase is not configured.' };
  try {
    const study = await fetchStabilityStudyById(studyId);
    if (!study) return { schedules: [], error: 'Study not found.' };

    const existing = await fetchStabilitySchedules(studyId);
    if (existing.length) return { schedules: existing, error: null };

    const useIntervals = intervals.length
      ? intervals
      : INTERVALS_BY_STUDY_TYPE[study.studyType] || INTERVALS_BY_STUDY_TYPE['Long Term'];

    const created: StabilityScheduleRecord[] = [];
    for (const interval of useIntervals) {
      const months = intervalToMonths(interval);
      const dueDate = addMonthsToDate(study.studyStartDate, months);
      const scheduleStatus = computeScheduleStatus(dueDate, '', 'Pending');
      const payload = {
        studyId,
        stabilityStudyNumber: study.stabilityStudyNumber,
        batchNumber: study.batchNumber,
        studyType: study.studyType,
        storageCondition: study.storageCondition,
        interval,
        samplePullingDueDate: dueDate,
        actualPullingDate: '',
        scheduleStatus,
        resultEntryStatus: 'Pending',
        createdBy: actor.id,
        updatedBy: actor.id,
      };
      const row = await createRecord(
        STABILITY_SCHEDULES_COLLECTION,
        payload as Omit<StabilityScheduleRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
        actorCtx(actor),
      );
      created.push(normalizeSchedule(row as unknown as Record<string, unknown>));
    }
    await logStabilityAudit('generate schedule', studyId, actor, null, { count: created.length }, study.stabilityStudyNumber);
    return { schedules: created, error: null };
  } catch (e) {
    console.error('generateStabilitySchedule failed', e);
    return { schedules: [], error: 'Failed to generate schedule.' };
  }
}

export async function updateSchedulePull(
  scheduleId: string,
  actualPullingDate: string,
  actor: StabilityActor,
): Promise<{ result: StabilityScheduleRecord | null; error: string | null }> {
  try {
    const existing = await getRecord<Record<string, unknown>>(STABILITY_SCHEDULES_COLLECTION, scheduleId);
    if (!existing) return { result: null, error: 'Schedule not found.' };
    const prev = normalizeSchedule(existing);
    const scheduleStatus = computeScheduleStatus(prev.samplePullingDueDate, actualPullingDate, prev.resultEntryStatus);
    const updated = await updateRecord(
      STABILITY_SCHEDULES_COLLECTION,
      scheduleId,
      {
        actualPullingDate: actualPullingDate,
        scheduleStatus,
        updatedBy: actor.id,
      },
      actorCtx(actor),
    );
    if (!updated) return { result: null, error: 'Update failed.' };
    const result = normalizeSchedule(updated as unknown as Record<string, unknown>);
    const action = actualPullingDate ? 'sample pulled' : 'sample missed';
    await logStabilityAudit(action, scheduleId, actor, prev, result, prev.stabilityStudyNumber);
    if (result.scheduleStatus === 'Missed') {
      try {
        await createAlert({
          alertType: 'Limit Exceeded',
          severity: 'High',
          module: STABILITY_MODULE_NAME,
          productName: prev.batchNumber,
          batchNo: prev.batchNumber,
          parameterName: prev.interval,
          message: `Sample pulling missed for interval ${prev.interval}`,
          recordId: scheduleId,
        }, { id: actor.id, name: actor.name, role: actor.role });
      } catch { /* optional */ }
    }
    return { result, error: null };
  } catch (e) {
    console.error('updateSchedulePull failed', e);
    return { result: null, error: 'Failed to update sample pull.' };
  }
}

export async function refreshScheduleStatuses(actor: StabilityActor): Promise<void> {
  const schedules = await fetchStabilitySchedules();
  const today = new Date().toISOString().split('T')[0];
  for (const s of schedules) {
    if (s.scheduleStatus === 'Cancelled' || s.scheduleStatus === 'Testing Completed') continue;
    const newStatus = computeScheduleStatus(s.samplePullingDueDate, s.actualPullingDate, s.resultEntryStatus);
    if (newStatus !== s.scheduleStatus) {
      await updateRecord(STABILITY_SCHEDULES_COLLECTION, s.id, { scheduleStatus: newStatus }, actorCtx(actor));
      if (newStatus === 'Missed' && s.samplePullingDueDate < today) {
        await logStabilityAudit('sample missed', s.id, actor, s.scheduleStatus, newStatus, s.stabilityStudyNumber);
      }
    }
  }
}

export async function createStabilityResult(
  data: StabilityResultFormData,
  actor: StabilityActor,
  qaOverride = false,
): Promise<{ result: StabilityResultRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchStabilityBatchesForProduct(data.productName, data.cpvProductId);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };

    const existing = await fetchStabilityResults(1000);
    const duplicate = existing.find(
      (r) => r.batchNumber === data.batchNumber
        && r.pullingInterval === data.pullingInterval
        && r.parameterCode === data.parameterCode
        && r.studyType === data.studyType
        && r.storageCondition === data.storageCondition
        && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'Result already exists for this batch, interval and parameter.' };

    const computed = buildStabilityComputedFields(data);
    const batchResults = existing.filter((r) => r.batchNumber === data.batchNumber && !r.isDeleted);
    const assaySlope = computeParameterSlope(batchResults, 'Assay');
    const phSlope = computeParameterSlope(batchResults, 'pH');
    const ootCount = await countOotIntervals(data.batchNumber, data.parameterName);
    const riskLevel = evaluateStabilityRisk(
      { ...data, ...computed },
      ootCount,
      { assay: assaySlope, ph: phSlope },
    );
    const capaRequired = ootCount >= 2 || computed.status === 'OOS';

    const payload = {
      ...data,
      ...computed,
      stabilityMonitoringId: buildStabilityMonitoringId(data.batchNumber, data.pullingInterval, data.parameterCode),
      riskLevel,
      deviationRequired: computed.status === 'OOS' || computed.status === 'OOT',
      capaRequired,
      linkedOosNumber: '',
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      attachments: [] as StabilityAttachment[],
      scheduleId: '',
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      STABILITY_RESULTS_COLLECTION,
      payload as Omit<StabilityResultRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeResult(created as unknown as Record<string, unknown>);

    const oosNo = await maybeCreateOos(result, actor);
    if (oosNo) {
      const updated = await updateRecord(STABILITY_RESULTS_COLLECTION, result.id, {
        linkedOosNumber: oosNo,
        oosRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeResult(updated as unknown as Record<string, unknown>);
      await logStabilityAudit('OOS auto-created', result.id, actor, null, oosNo, result.stabilityMonitoringId);
    }

    if (computed.status === 'OOT') {
      await maybeCreateAlert(result, actor);
      await logStabilityAudit('OOT alert created', result.id, actor, null, result.status, result.stabilityMonitoringId);
    }
    if (capaRequired) await logStabilityAudit('CAPA suggested', result.id, actor, null, { ootCount }, result.stabilityMonitoringId);

    await logStabilityAudit('result entry', result.id, actor, null, result, result.stabilityMonitoringId);
    await logStabilityAudit('status calculation', result.id, actor, null, computed.status, result.stabilityMonitoringId);
    await logStabilityAudit('risk calculation', result.id, actor, null, riskLevel, result.stabilityMonitoringId);

    if (data.studyId && data.pullingInterval) {
      const schedules = await fetchStabilitySchedules(data.studyId);
      const sched = schedules.find((s) => s.interval === data.pullingInterval);
      if (sched) {
        await updateRecord(STABILITY_SCHEDULES_COLLECTION, sched.id, {
          resultEntryStatus: 'Completed',
          scheduleStatus: 'Testing Completed',
        }, actorCtx(actor));
      }
    }

    return { result, error: null };
  } catch (e) {
    console.error('createStabilityResult failed', e);
    return { result: null, error: 'Failed to create stability result.' };
  }
}

export async function updateStabilityResult(
  id: string,
  data: Partial<StabilityResultFormData>,
  actor: StabilityActor,
  existing: StabilityResultRecord,
  qaOverride = false,
): Promise<{ result: StabilityResultRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved stability result is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    const computed = buildStabilityComputedFields(merged);
    const batchResults = await fetchStabilityResults(1000);
    const batchOnly = batchResults.filter((r) => r.batchNumber === merged.batchNumber && !r.isDeleted);
    const assaySlope = computeParameterSlope(batchOnly, 'Assay');
    const phSlope = computeParameterSlope(batchOnly, 'pH');
    const ootCount = await countOotIntervals(merged.batchNumber, merged.parameterName);
    const riskLevel = evaluateStabilityRisk(
      { ...merged, ...computed },
      ootCount,
      { assay: assaySlope, ph: phSlope },
    );
    const updates = {
      ...data,
      ...computed,
      riskLevel,
      capaRequired: ootCount >= 2 || computed.status === 'OOS',
      updatedByName: actor.name,
    };
    const updated = await updateRecord(STABILITY_RESULTS_COLLECTION, id, updates as Partial<StabilityResultRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeResult(updated as unknown as Record<string, unknown>);
    await logStabilityAudit(qaOverride ? 'QA override' : 'edit stability result', id, actor, existing, result, result.stabilityMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updateStabilityResult failed', e);
    return { result: null, error: 'Failed to update stability result.' };
  }
}

export async function reviewStabilityResult(id: string, actor: StabilityActor, existing: StabilityResultRecord) {
  const updated = await updateRecord(STABILITY_RESULTS_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeResult(updated as unknown as Record<string, unknown>);
  await logStabilityAudit('review stability result', id, actor, existing.reviewStatus, 'Under Review', result.stabilityMonitoringId);
  return { result, error: null };
}

export async function approveStabilityResult(id: string, actor: StabilityActor, existing: StabilityResultRecord) {
  const updated = await updateRecord(STABILITY_RESULTS_COLLECTION, id, {
    reviewStatus: 'Approved',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeResult(updated as unknown as Record<string, unknown>);
  await logStabilityAudit('approve stability result', id, actor, existing.reviewStatus, 'Approved', result.stabilityMonitoringId);
  return { result, error: null };
}

export async function bulkCreateStabilityResults(
  rows: StabilityResultFormData[],
  actor: StabilityActor,
  qaOverride = false,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createStabilityResult(row, actor, qaOverride);
    if (error) errors.push(`${row.parameterName}: ${error}`);
    else created += 1;
  }
  if (created) await logStabilityAudit('bulk stability result entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function fetchStabilityAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logStabilityExport(actor: StabilityActor, count: number) {
  await logStabilityAudit('export stability list', 'export', actor, null, { count });
}

export async function updateStabilityAttachments(
  id: string,
  attachments: StabilityAttachment[],
  actor: StabilityActor,
  existing: StabilityResultRecord,
) {
  try {
    const updated = await updateRecord(
      STABILITY_RESULTS_COLLECTION,
      id,
      { attachments, updatedByName: actor.name },
      actorCtx(actor),
    );
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeResult(updated as unknown as Record<string, unknown>);
    await logStabilityAudit('attachment upload/delete', id, actor, existing.attachments, attachments, result.stabilityMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updateStabilityAttachments failed', e);
    return { result: null, error: 'Failed to update attachments.' };
  }
}

export function stabilityParameterTrendData(results: StabilityResultRecord[], parameterName: string) {
  return results
    .filter((r) => r.parameterName === parameterName && Number.isFinite(Number(r.observedResult)))
    .sort((a, b) => intervalToMonths(a.pullingInterval) - intervalToMonths(b.pullingInterval))
    .map((r) => ({
      label: r.pullingInterval,
      observed: Number(r.observedResult),
      target: r.targetValue,
      lsl: r.lowerLimit,
      usl: r.upperLimit,
    }));
}

export function defaultStabilityParameters() {
  return DEFAULT_STABILITY_PARAMETERS.map((name) => mapDefaultParameterFields(name));
}
