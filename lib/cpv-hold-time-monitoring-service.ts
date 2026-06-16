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
  HOLD_TIME_MONITORING_COLLECTION,
  HOLD_TIME_MASTER_COLLECTION,
  HOLD_TIME_LEGACY_COLLECTIONS,
  HOLD_TIME_MODULE_NAME,
  BULK_HOLD_STAGES,
  buildHoldTimeId,
  calculateActualHoldTime,
  calculateHoldDifference,
  evaluateHoldTimeStatus,
  evaluateHoldTimeRisk,
  defaultAllowedForStage,
  type HoldTimeMonitoringFormData,
  type HoldTimeMonitoringRecord,
} from '@/lib/cpv-hold-time-monitoring';

export interface HoldTimeActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: HoldTimeActor) {
  return { moduleName: HOLD_TIME_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logHoldTimeAudit(
  actionType: string,
  recordId: string,
  actor: HoldTimeActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: HOLD_TIME_MODULE_NAME,
    collectionName: HOLD_TIME_MONITORING_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: HOLD_TIME_MONITORING_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: HOLD_TIME_MODULE_NAME,
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

function normalizeHoldTimeRecord(raw: Record<string, unknown>): HoldTimeMonitoringRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const holdStage = str(raw.holdStage || raw.hold_stage || raw.stage, 'Bulk Hold Time');
  const allowed = num(raw.allowedHoldTime ?? raw.allowed_hold_time ?? raw.allowedTime);
  const unit = str(raw.holdTimeUnit || raw.hold_time_unit || raw.unit, 'Hours');
  const start = str(raw.startDateTime || raw.start_date_time || raw.startTime);
  const end = str(raw.endDateTime || raw.end_date_time || raw.endTime);
  const actual = num(
    raw.actualHoldTime ?? raw.actual_hold_time ?? raw.actualTime,
    calculateActualHoldTime(start, end, unit),
  );
  const difference = num(raw.difference, calculateHoldDifference(allowed, actual));
  const status = str(
    raw.status || raw.complianceStatus || raw.compliance_status,
    evaluateHoldTimeStatus(actual, allowed),
  );
  return {
    id: str(raw.id),
    holdTimeId: str(raw.holdTimeId || raw.hold_time_id, buildHoldTimeId(batchNumber, holdStage)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    processStage: str(raw.processStage || raw.process_stage || holdStage),
      holdStage: holdStage,
    startDateTime: start,
    endDateTime: end,
    actualHoldTime: actual,
    allowedHoldTime: allowed,
    holdTimeUnit: (unit === 'Minutes' || unit === 'Days' ? unit : 'Hours') as HoldTimeMonitoringRecord['holdTimeUnit'],
    difference,
    complianceStatus: status,
    status,
    reasonForHold: str(raw.reasonForHold || raw.reason_for_hold),
    extensionApproved: Boolean(raw.extensionApproved || raw.extension_approved),
    extensionReason: str(raw.extensionReason || raw.extension_reason),
    approvedBy: str(raw.approvedBy || raw.approved_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    remarks: str(raw.remarks),
    autoDeviationRequired: Boolean(raw.autoDeviationRequired ?? raw.auto_deviation_required ?? true),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as HoldTimeMonitoringRecord['reviewStatus']),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export function buildHoldTimeComputedFields(
  data: Pick<HoldTimeMonitoringFormData, 'startDateTime' | 'endDateTime' | 'allowedHoldTime' | 'holdTimeUnit'>,
) {
  const actualHoldTime = calculateActualHoldTime(data.startDateTime, data.endDateTime, data.holdTimeUnit);
  const difference = calculateHoldDifference(data.allowedHoldTime, actualHoldTime);
  const status = evaluateHoldTimeStatus(actualHoldTime, data.allowedHoldTime);
  return { actualHoldTime, difference, status, complianceStatus: status };
}

export async function fetchHoldTimeMaster(stage: string): Promise<{ allowed: number; unit: string }> {
  if (!isFirebaseConfigured()) return defaultAllowedForStage(stage);
  try {
    const snap = await getDocs(query(
      collection(getFirebaseFirestore(), HOLD_TIME_MASTER_COLLECTION),
      where('holdStage', '==', stage),
      limit(1),
    ));
    if (snap.empty) {
      const snap2 = await getDocs(query(
        collection(getFirebaseFirestore(), HOLD_TIME_MASTER_COLLECTION),
        where('stage', '==', stage),
        limit(1),
      ));
      if (snap2.empty) return defaultAllowedForStage(stage);
      const d = snap2.docs[0].data();
      return {
        allowed: num(d.allowedHoldTime ?? d.allowed_hold_time ?? d.allowedTime, defaultAllowedForStage(stage).allowed),
        unit: str(d.holdTimeUnit || d.unit, defaultAllowedForStage(stage).unit),
      };
    }
    const d = snap.docs[0].data();
    return {
      allowed: num(d.allowedHoldTime ?? d.allowed_hold_time ?? d.allowedTime),
      unit: str(d.holdTimeUnit || d.unit, 'Hours'),
    };
  } catch {
    return defaultAllowedForStage(stage);
  }
}

export async function fetchHoldTimeRecords(max = 500): Promise<HoldTimeMonitoringRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: HoldTimeMonitoringRecord[] = [];
    try {
      primary = await getRecords<HoldTimeMonitoringRecord>(
        HOLD_TIME_MONITORING_COLLECTION,
        [orderBy('createdAt', 'desc'), limit(max)],
      );
    } catch {
      primary = await getRecords<HoldTimeMonitoringRecord>(HOLD_TIME_MONITORING_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeHoldTimeRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const legacy of HOLD_TIME_LEGACY_COLLECTIONS) {
      const legacyRows = await listCpvRecords<Record<string, unknown>>(legacy, max);
      if (legacyRows.length) return legacyRows.map((r) => normalizeHoldTimeRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.holdTime, max);
    return cpvLegacy.map((r) => normalizeHoldTimeRecord(r));
  } catch (e) {
    console.error('fetchHoldTimeRecords failed', e);
    return [];
  }
}

export async function fetchHoldTimeRecordById(id: string): Promise<HoldTimeMonitoringRecord | null> {
  const record = await getRecord<HoldTimeMonitoringRecord>(HOLD_TIME_MONITORING_COLLECTION, id);
  if (record) return normalizeHoldTimeRecord(record as unknown as Record<string, unknown>);
  const all = await fetchHoldTimeRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchHoldTimeBatchesForProduct(productName: string, productId?: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) =>
    b.productName === productName
    || b.productCode === productName
    || (productId && b.cpvProductId === productId),
  );
}

async function countExceededHoldTimes(batchNumber: string): Promise<number> {
  const records = await fetchHoldTimeRecords(1000);
  return records.filter((r) =>
    r.batchNumber === batchNumber
    && r.status === 'Exceeded'
    && !r.isDeleted,
  ).length;
}

async function maybeCreateDeviation(record: HoldTimeMonitoringRecord, actor: HoldTimeActor, autoDev: boolean) {
  if (!autoDev || record.status !== 'Exceeded') return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const dev = await createDeviationFromCpv('cpv_cpp', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.holdStage,
      observedValue: record.actualHoldTime,
      status: 'OOT',
      department: 'Production',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlertAndNotification(record: HoldTimeMonitoringRecord, actor: HoldTimeActor) {
  if (record.status === 'Complies') return;
  try {
    await createAlert({
      alertType: record.status === 'Exceeded' ? 'Limit Exceeded' : 'OOT',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: HOLD_TIME_MODULE_NAME,
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.holdStage,
      message: `Hold time ${record.status} for ${record.holdStage} — batch ${record.batchNumber}`,
      observedValue: record.actualHoldTime,
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title: `Hold Time ${record.status}`,
      message: `${record.batchNumber}: ${record.holdStage} ${record.actualHoldTime} ${record.holdTimeUnit}`,
      module: HOLD_TIME_MODULE_NAME,
      record_id: record.id,
      target_roles: ['qa', 'production'],
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch { /* optional */ }
}

export async function createHoldTimeRecord(
  data: HoldTimeMonitoringFormData,
  actor: HoldTimeActor,
  qaOverride = false,
): Promise<{ result: HoldTimeMonitoringRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchHoldTimeBatchesForProduct(data.productName, data.cpvProductId);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existing = await fetchHoldTimeRecords(1000);
    const duplicate = existing.find(
      (r) => r.batchNumber === data.batchNumber && r.holdStage === data.holdStage && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'Hold time record already exists for this batch and stage.' };

    const computed = buildHoldTimeComputedFields(data);
    const priorExceeded = await countExceededHoldTimes(data.batchNumber);
    const exceededCount = priorExceeded + (computed.status === 'Exceeded' ? 1 : 0);
    const riskLevel = evaluateHoldTimeRisk({ ...data, ...computed }, exceededCount);
    const capaRequired = exceededCount >= 3;
    const autoDev = data.autoDeviationRequired;

    const payload = {
      ...data,
      ...computed,
      holdTimeId: buildHoldTimeId(data.batchNumber, data.holdStage),
      riskLevel,
      deviationRequired: autoDev && computed.status === 'Exceeded',
      capaRequired,
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      HOLD_TIME_MONITORING_COLLECTION,
      payload as Omit<HoldTimeMonitoringRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeHoldTimeRecord(created as unknown as Record<string, unknown>);

    const devNo = await maybeCreateDeviation(result, actor, autoDev);
    if (devNo) {
      const updated = await updateRecord(HOLD_TIME_MONITORING_COLLECTION, result.id, {
        linkedDeviationNumber: devNo,
        deviationRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeHoldTimeRecord(updated as unknown as Record<string, unknown>);
      await logHoldTimeAudit('deviation auto-created', result.id, actor, null, devNo, result.holdTimeId);
    }

    if (computed.status !== 'Complies') {
      await maybeCreateAlertAndNotification(result, actor);
      if (capaRequired) await logHoldTimeAudit('CAPA suggested', result.id, actor, null, { exceededCount }, result.holdTimeId);
    }

    await logHoldTimeAudit('create hold time record', result.id, actor, null, result, result.holdTimeId);
    await logHoldTimeAudit('status calculation', result.id, actor, null, computed.status, result.holdTimeId);
    await logHoldTimeAudit('risk calculation', result.id, actor, null, riskLevel, result.holdTimeId);
    return { result, error: null };
  } catch (e) {
    console.error('createHoldTimeRecord failed', e);
    return { result: null, error: 'Failed to create hold time record.' };
  }
}

export async function updateHoldTimeRecord(
  id: string,
  data: Partial<HoldTimeMonitoringFormData>,
  actor: HoldTimeActor,
  existing: HoldTimeMonitoringRecord,
  qaOverride = false,
): Promise<{ result: HoldTimeMonitoringRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved hold time record is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    const computed = buildHoldTimeComputedFields(merged);
    const priorExceeded = await countExceededHoldTimes(merged.batchNumber);
    const isSameRecordExceeded = merged.status === 'Exceeded';
    const otherExceeded = existing.status === 'Exceeded' && isSameRecordExceeded
      ? priorExceeded
      : priorExceeded - (existing.status === 'Exceeded' ? 1 : 0);
    const exceededCount = Math.max(0, otherExceeded) + (computed.status === 'Exceeded' ? 1 : 0);
    const riskLevel = evaluateHoldTimeRisk({ ...merged, ...computed }, exceededCount);
    const updates = {
      ...data,
      ...computed,
      riskLevel,
      capaRequired: exceededCount >= 3,
      updatedByName: actor.name,
    };
    const updated = await updateRecord(HOLD_TIME_MONITORING_COLLECTION, id, updates as Partial<HoldTimeMonitoringRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeHoldTimeRecord(updated as unknown as Record<string, unknown>);
    await logHoldTimeAudit(qaOverride ? 'QA override' : 'edit hold time record', id, actor, existing, result, result.holdTimeId);
    await logHoldTimeAudit('status change', id, actor, existing.status, computed.status, result.holdTimeId);
    return { result, error: null };
  } catch (e) {
    console.error('updateHoldTimeRecord failed', e);
    return { result: null, error: 'Failed to update hold time record.' };
  }
}

export async function reviewHoldTimeRecord(id: string, actor: HoldTimeActor, existing: HoldTimeMonitoringRecord) {
  const updated = await updateRecord(HOLD_TIME_MONITORING_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeHoldTimeRecord(updated as unknown as Record<string, unknown>);
  await logHoldTimeAudit('review', id, actor, existing.reviewStatus, 'Under Review', result.holdTimeId);
  return { result, error: null };
}

export async function approveHoldTimeRecord(id: string, actor: HoldTimeActor, existing: HoldTimeMonitoringRecord) {
  const updated = await updateRecord(HOLD_TIME_MONITORING_COLLECTION, id, {
    reviewStatus: 'Approved',
    approvedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeHoldTimeRecord(updated as unknown as Record<string, unknown>);
  await logHoldTimeAudit('approval', id, actor, existing.reviewStatus, 'Approved', result.holdTimeId);
  return { result, error: null };
}

export async function bulkCreateHoldTimeRecords(
  rows: HoldTimeMonitoringFormData[],
  actor: HoldTimeActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createHoldTimeRecord(row, actor);
    if (error) errors.push(`${row.holdStage}: ${error}`);
    else created += 1;
  }
  if (created) await logHoldTimeAudit('bulk hold time entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function fetchHoldTimeAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logHoldTimeExport(actor: HoldTimeActor, count: number) {
  await logHoldTimeAudit('export', 'export', actor, null, { count });
}

export function holdTimeStageTrendData(records: HoldTimeMonitoringRecord[], stage: string) {
  return records
    .filter((r) => r.holdStage === stage || r.processStage === stage)
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
    .map((r) => ({
      label: r.batchNumber,
      observed: r.actualHoldTime,
      target: r.allowedHoldTime,
      lsl: 0,
      usl: r.allowedHoldTime,
    }));
}

export const BULK_HOLD_STAGE_OPTIONS = BULK_HOLD_STAGES;
