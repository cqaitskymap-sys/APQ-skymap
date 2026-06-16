import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchParameters, normalizeParameter } from '@/lib/admin/parameter-service';
import type { Parameter } from '@/lib/admin/schemas';
import { fetchCpvProductById } from '@/lib/cpv-product-master-service';
import { fetchCpvBatches } from '@/lib/cpv-batch-registration-service';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import {
  YIELD_MONITORING_COLLECTION,
  YIELD_LEGACY_COLLECTIONS,
  YIELD_MODULE_NAME,
  YIELD_STAGES,
  buildYieldMonitoringId,
  calculateLossQuantity,
  calculateYieldPercentage,
  calculateVariancePercentage,
  evaluateYieldStatus,
  evaluateYieldRisk,
  defaultLimitsForStage,
  type YieldMonitoringFormData,
  type YieldMonitoringRecord,
} from '@/lib/cpv-yield-monitoring';

export interface YieldActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: YieldActor) {
  return { moduleName: YIELD_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logYieldAudit(
  actionType: string,
  recordId: string,
  actor: YieldActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: YIELD_MODULE_NAME,
    collectionName: YIELD_MONITORING_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: YIELD_MONITORING_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: YIELD_MODULE_NAME,
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

function normalizeYieldRecord(raw: Record<string, unknown>): YieldMonitoringRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const yieldStage = str(raw.yieldStage || raw.stage || raw.yield_stage, 'Bulk Yield');
  const theoretical = num(raw.theoreticalQuantity ?? raw.theoretical_quantity ?? raw.expectedYield);
  const actual = num(raw.actualQuantity ?? raw.actual_quantity ?? raw.actualYield);
  const targetYield = num(raw.targetYield ?? raw.target_yield ?? raw.target);
  const yieldPct = num(raw.yieldPercentage ?? raw.yield_percent ?? raw.yieldPercent, calculateYieldPercentage(theoretical, actual));
  return {
    id: str(raw.id),
    yieldMonitoringId: str(raw.yieldMonitoringId || raw.yield_monitoring_id, buildYieldMonitoringId(batchNumber, yieldStage)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    batchSize: str(raw.batchSize || raw.batch_size),
    batchSizeUnit: str(raw.batchSizeUnit || raw.batch_size_unit),
    yieldStage: yieldStage as YieldMonitoringRecord['yieldStage'],
    theoreticalQuantity: theoretical,
    actualQuantity: actual,
    rejectQuantity: num(raw.rejectQuantity ?? raw.reject_quantity),
    reworkQuantity: num(raw.reworkQuantity ?? raw.rework_quantity),
    lossQuantity: num(raw.lossQuantity ?? raw.loss_quantity, calculateLossQuantity(theoretical, actual)),
    yieldPercentage: yieldPct,
    variancePercentage: num(raw.variancePercentage ?? raw.variance_percent, calculateVariancePercentage(targetYield, yieldPct)),
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit ?? raw.lsl),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit ?? raw.usl),
    targetYield,
    unit: str(raw.unit, 'units'),
    alertLimitLow: num(raw.alertLimitLow ?? raw.alert_limit_low),
    alertLimitHigh: num(raw.alertLimitHigh ?? raw.alert_limit_high),
    actionLimitLow: num(raw.actionLimitLow ?? raw.action_limit_low),
    actionLimitHigh: num(raw.actionLimitHigh ?? raw.action_limit_high),
    recordedBy: str(raw.recordedBy || raw.recorded_by),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    remarks: str(raw.remarks),
    autoDeviationRequired: Boolean(raw.autoDeviationRequired ?? raw.auto_deviation_required ?? true),
    status: str(raw.status, 'Complies'),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as YieldMonitoringRecord['reviewStatus']),
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

export function buildYieldComputedFields(data: Pick<YieldMonitoringFormData, 'theoreticalQuantity' | 'actualQuantity' | 'targetYield' | 'lowerLimit' | 'upperLimit' | 'alertLimitLow' | 'alertLimitHigh' | 'actionLimitLow' | 'actionLimitHigh'>) {
  const lossQuantity = calculateLossQuantity(data.theoreticalQuantity, data.actualQuantity);
  const yieldPercentage = calculateYieldPercentage(data.theoreticalQuantity, data.actualQuantity);
  const variancePercentage = calculateVariancePercentage(data.targetYield, yieldPercentage);
  const status = evaluateYieldStatus(
    yieldPercentage,
    data.lowerLimit,
    data.upperLimit,
    data.alertLimitLow,
    data.alertLimitHigh,
    data.actionLimitLow,
    data.actionLimitHigh,
  );
  return { lossQuantity, yieldPercentage, variancePercentage, status };
}

export async function fetchYieldRecords(max = 500): Promise<YieldMonitoringRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: YieldMonitoringRecord[] = [];
    try {
      primary = await getRecords<YieldMonitoringRecord>(
        YIELD_MONITORING_COLLECTION,
        [orderBy('createdAt', 'desc'), limit(max)],
      );
    } catch {
      primary = await getRecords<YieldMonitoringRecord>(YIELD_MONITORING_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeYieldRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const legacyName of YIELD_LEGACY_COLLECTIONS) {
      const legacy = await listCpvRecords<Record<string, unknown>>(legacyName, max);
      if (legacy.length) return legacy.map((r) => normalizeYieldRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.yield, max);
    if (cpvLegacy.length) return cpvLegacy.map((r) => normalizeYieldRecord(r));
    return [];
  } catch (e) {
    console.error('fetchYieldRecords failed', e);
    return [];
  }
}

export async function fetchYieldRecordById(id: string): Promise<YieldMonitoringRecord | null> {
  const record = await getRecord<YieldMonitoringRecord>(YIELD_MONITORING_COLLECTION, id);
  if (record) return normalizeYieldRecord(record as unknown as Record<string, unknown>);
  const all = await fetchYieldRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchYieldBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

export async function fetchYieldStageParameters(stage?: string): Promise<Parameter[]> {
  try {
    const all = await fetchParameters();
    let params = all.filter((p) => {
      const n = normalizeParameter(p);
      return n.parameterType === 'Yield Parameter' && n.status === 'Active';
    });
    if (stage) {
      const filtered = params.filter((p) => p.parameterName?.includes(stage.replace(' Yield', '')) || stage === 'Overall Yield');
      if (filtered.length) params = filtered;
    }
    return params;
  } catch {
    return [];
  }
}


async function countLowYieldBatches(productName: string, yieldStage: string): Promise<number> {
  const results = await fetchYieldRecords(1000);
  const batches = new Set(
    results.filter((r) =>
      r.productName === productName
      && r.yieldStage === yieldStage
      && ['Low Yield', 'Action', 'Alert'].includes(r.status),
    ).map((r) => r.batchNumber),
  );
  return batches.size;
}

async function maybeCreateDeviation(record: YieldMonitoringRecord, actor: YieldActor, autoDeviation: boolean) {
  if (!autoDeviation || !['Low Yield', 'High Yield', 'Action', 'Alert'].includes(record.status)) return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const devStatus = record.status === 'Low Yield' ? 'OOS' : 'OOT';
    const dev = await createDeviationFromCpv('cpv_cpp', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.yieldStage,
      observedValue: record.yieldPercentage,
      status: devStatus,
      department: 'Production',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlertAndNotification(record: YieldMonitoringRecord, actor: YieldActor) {
  if (record.status === 'Complies') return;
  try {
    await createAlert({
      alertType: record.status === 'Low Yield' ? 'OOT' : 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'Yield Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.yieldStage,
      message: `${record.yieldStage} ${record.status} for batch ${record.batchNumber} (${record.yieldPercentage}%)`,
      observedValue: record.yieldPercentage,
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title: `Yield ${record.status}`,
      message: `${record.batchNumber}: ${record.yieldStage} ${record.yieldPercentage}%`,
      module: YIELD_MODULE_NAME,
      record_id: record.id,
      target_roles: ['qa', 'production'],
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch { /* optional */ }
}

export async function createYieldRecord(
  data: YieldMonitoringFormData,
  actor: YieldActor,
  qaOverride = false,
): Promise<{ result: YieldMonitoringRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchYieldBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }
    if (!qaOverride && data.actualQuantity > data.theoreticalQuantity) {
      return { result: null, error: 'Actual quantity cannot exceed theoretical quantity without QA override.' };
    }

    const existing = await fetchYieldRecords(1000);
    const duplicate = existing.find(
      (r) => r.batchNumber === data.batchNumber && r.yieldStage === data.yieldStage && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'Yield record already exists for this batch and stage.' };

    const computed = buildYieldComputedFields(data);
    const lowYieldCount = await countLowYieldBatches(data.productName, data.yieldStage);
    const riskLevel = evaluateYieldRisk({ ...data, ...computed }, lowYieldCount);
    const capaRequired = lowYieldCount >= 3;
    const autoDev = data.autoDeviationRequired;

    const payload = {
      ...data,
      ...computed,
      yieldMonitoringId: buildYieldMonitoringId(data.batchNumber, data.yieldStage),
      riskLevel,
      deviationRequired: autoDev && computed.status !== 'Complies',
      capaRequired,
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      YIELD_MONITORING_COLLECTION,
      payload as Omit<YieldMonitoringRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeYieldRecord(created as unknown as Record<string, unknown>);

    const devNo = await maybeCreateDeviation(result, actor, autoDev);
    if (devNo) {
      const updated = await updateRecord(YIELD_MONITORING_COLLECTION, result.id, {
        linkedDeviationNumber: devNo,
        deviationRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeYieldRecord(updated as unknown as Record<string, unknown>);
      await logYieldAudit('deviation auto-created', result.id, actor, null, devNo, result.yieldMonitoringId);
    }

    if (computed.status !== 'Complies') {
      await maybeCreateAlertAndNotification(result, actor);
      if (capaRequired) await logYieldAudit('CAPA suggested', result.id, actor, null, { stage: data.yieldStage }, result.yieldMonitoringId);
    }

    await logYieldAudit('create yield record', result.id, actor, null, result, result.yieldMonitoringId);
    await logYieldAudit('yield calculation', result.id, actor, null, computed, result.yieldMonitoringId);
    await logYieldAudit('status calculation', result.id, actor, null, computed.status, result.yieldMonitoringId);
    await logYieldAudit('risk calculation', result.id, actor, null, riskLevel, result.yieldMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('createYieldRecord failed', e);
    return { result: null, error: 'Failed to create yield record.' };
  }
}

export async function updateYieldRecord(
  id: string,
  data: Partial<YieldMonitoringFormData>,
  actor: YieldActor,
  existing: YieldMonitoringRecord,
  qaOverride = false,
): Promise<{ result: YieldMonitoringRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved yield record is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    if (!qaOverride && merged.actualQuantity > merged.theoreticalQuantity) {
      return { result: null, error: 'Actual quantity cannot exceed theoretical quantity without QA override.' };
    }
    const computed = buildYieldComputedFields(merged);
    const lowYieldCount = await countLowYieldBatches(merged.productName, merged.yieldStage);
    const riskLevel = evaluateYieldRisk({ ...merged, ...computed }, lowYieldCount);
    const updates = {
      ...data,
      ...computed,
      riskLevel,
      capaRequired: lowYieldCount >= 3,
      updatedByName: actor.name,
    };
    const updated = await updateRecord(YIELD_MONITORING_COLLECTION, id, updates as Partial<YieldMonitoringRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeYieldRecord(updated as unknown as Record<string, unknown>);
    await logYieldAudit(qaOverride ? 'QA override' : 'edit yield record', id, actor, existing, result, result.yieldMonitoringId);
    await logYieldAudit('status calculation', id, actor, existing.status, computed.status, result.yieldMonitoringId);
    await logYieldAudit('risk calculation', id, actor, existing.riskLevel, riskLevel, result.yieldMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updateYieldRecord failed', e);
    return { result: null, error: 'Failed to update yield record.' };
  }
}

export async function reviewYieldRecord(id: string, actor: YieldActor, existing: YieldMonitoringRecord) {
  const updated = await updateRecord(YIELD_MONITORING_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeYieldRecord(updated as unknown as Record<string, unknown>);
  await logYieldAudit('review yield record', id, actor, existing.reviewStatus, 'Under Review', result.yieldMonitoringId);
  return { result, error: null };
}

export async function approveYieldRecord(id: string, actor: YieldActor, existing: YieldMonitoringRecord) {
  const updated = await updateRecord(YIELD_MONITORING_COLLECTION, id, {
    reviewStatus: 'Approved',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeYieldRecord(updated as unknown as Record<string, unknown>);
  await logYieldAudit('approve yield record', id, actor, existing.reviewStatus, 'Approved', result.yieldMonitoringId);
  return { result, error: null };
}

export async function bulkCreateYieldRecords(
  rows: YieldMonitoringFormData[],
  actor: YieldActor,
  qaOverride = false,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createYieldRecord(row, actor, qaOverride);
    if (error) errors.push(`${row.yieldStage}: ${error}`);
    else created += 1;
  }
  if (created) await logYieldAudit('bulk yield entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function fetchYieldAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logYieldExport(actor: YieldActor, count: number) {
  await logYieldAudit('export yield list', 'export', actor, null, { count });
}

export function yieldStageTrendData(records: YieldMonitoringRecord[], stage: string) {
  return records
    .filter((r) => r.yieldStage === stage)
    .sort((a, b) => (a.manufacturingDate || a.createdAt).localeCompare(b.manufacturingDate || b.createdAt))
    .map((r) => ({
      label: r.batchNumber,
      yield: r.yieldPercentage,
      target: r.targetYield,
      lower: r.lowerLimit,
      upper: r.upperLimit,
    }));
}

export function stageDefaults(stage: string) {
  return defaultLimitsForStage(stage);
}

export const YIELD_STAGE_OPTIONS = YIELD_STAGES;
