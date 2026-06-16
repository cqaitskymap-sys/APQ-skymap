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
import { listAreas } from '@/lib/monitoring-mgmt-service';
import type { AreaRecord } from '@/lib/monitoring-mgmt-types';
import {
  ENVIRONMENTAL_MONITORING_COLLECTION,
  ENVIRONMENTAL_LEGACY_COLLECTIONS,
  ENVIRONMENTAL_MODULE_NAME,
  buildEnvironmentalMonitoringId,
  evaluateEnvironmentalStatus,
  evaluateEnvironmentalRisk,
  parametersForMonitoringType,
  type EnvironmentalMonitoringFormData,
  type EnvironmentalMonitoringRecord,
} from '@/lib/cpv-environmental-monitoring';

export interface EnvironmentalActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: EnvironmentalActor) {
  return { moduleName: ENVIRONMENTAL_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logEmAudit(
  actionType: string,
  recordId: string,
  actor: EnvironmentalActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: ENVIRONMENTAL_MODULE_NAME,
    collectionName: ENVIRONMENTAL_MONITORING_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: ENVIRONMENTAL_MONITORING_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: ENVIRONMENTAL_MODULE_NAME,
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

function observedVal(v: unknown): string | number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return 0;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : trimmed;
  }
  return String(v);
}

function normalizeEnvironmentalRecord(raw: Record<string, unknown>): EnvironmentalMonitoringRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  const areaName = str(raw.areaName || raw.area_name);
  return {
    id: str(raw.id),
    environmentalMonitoringId: str(
      raw.environmentalMonitoringId || raw.environmental_monitoring_id,
      buildEnvironmentalMonitoringId(batchNumber, parameterCode, areaName),
    ),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    areaName,
    areaId: str(raw.areaId || raw.area_doc_id || raw.area_id),
    roomNumber: str(raw.roomNumber || raw.room_number),
    cleanroomGrade: str(raw.cleanroomGrade || raw.cleanroom_grade, 'Unclassified') as EnvironmentalMonitoringRecord['cleanroomGrade'],
    processStage: str(raw.processStage || raw.process_stage, 'General Monitoring') as EnvironmentalMonitoringRecord['processStage'],
    monitoringType: str(raw.monitoringType || raw.monitoring_type, 'Temperature') as EnvironmentalMonitoringRecord['monitoringType'],
    samplingLocation: str(raw.samplingLocation || raw.sampling_location),
    parameterId: str(raw.parameterId || raw.parameter_id),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name),
    observedValue: observedVal(raw.observedValue ?? raw.observed_value),
    targetValue: num(raw.targetValue ?? raw.target_value ?? raw.target),
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit ?? raw.lsl),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit ?? raw.usl),
    alertLimitLow: num(raw.alertLimitLow ?? raw.alert_limit_low),
    alertLimitHigh: num(raw.alertLimitHigh ?? raw.alert_limit_high),
    actionLimitLow: num(raw.actionLimitLow ?? raw.action_limit_low),
    actionLimitHigh: num(raw.actionLimitHigh ?? raw.action_limit_high),
    unit: str(raw.unit),
    resultType: (str(raw.resultType || raw.result_type, 'Numeric') as EnvironmentalMonitoringRecord['resultType']),
    monitoringDate: str(raw.monitoringDate || raw.monitoring_date),
    monitoringTime: str(raw.monitoringTime || raw.monitoring_time || '00:00'),
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
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as EnvironmentalMonitoringRecord['reviewStatus']),
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

export async function fetchEnvironmentalRecords(max = 500): Promise<EnvironmentalMonitoringRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: EnvironmentalMonitoringRecord[] = [];
    try {
      primary = await getRecords<EnvironmentalMonitoringRecord>(
        ENVIRONMENTAL_MONITORING_COLLECTION,
        [orderBy('monitoringDate', 'desc'), limit(max)],
      );
    } catch {
      primary = await getRecords<EnvironmentalMonitoringRecord>(ENVIRONMENTAL_MONITORING_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeEnvironmentalRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) {
      return normalized.sort((a, b) => `${b.monitoringDate}${b.monitoringTime}`.localeCompare(`${a.monitoringDate}${a.monitoringTime}`));
    }
    for (const legacyName of ENVIRONMENTAL_LEGACY_COLLECTIONS) {
      const legacy = await listCpvRecords<Record<string, unknown>>(legacyName, max);
      if (legacy.length) return legacy.map((r) => normalizeEnvironmentalRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.environment, max);
    if (cpvLegacy.length) return cpvLegacy.map((r) => normalizeEnvironmentalRecord(r));
    return [];
  } catch (e) {
    console.error('fetchEnvironmentalRecords failed', e);
    return [];
  }
}

export async function fetchEnvironmentalRecordById(id: string): Promise<EnvironmentalMonitoringRecord | null> {
  const record = await getRecord<EnvironmentalMonitoringRecord>(ENVIRONMENTAL_MONITORING_COLLECTION, id);
  if (record) return normalizeEnvironmentalRecord(record as unknown as Record<string, unknown>);
  const all = await fetchEnvironmentalRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchEmBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

export async function fetchEnvironmentalParameters(monitoringType?: string): Promise<Parameter[]> {
  try {
    const all = await fetchParameters();
    let params = all.filter((p) => {
      const n = normalizeParameter(p);
      return n.parameterType === 'Environmental Parameter' && n.status === 'Active';
    });
    if (monitoringType) {
      const names = parametersForMonitoringType(monitoringType);
      const filtered = params.filter((p) => names.some((n) => p.parameterName?.includes(n) || n.includes(p.parameterName || '')));
      if (filtered.length) params = filtered;
    }
    return params;
  } catch {
    return [];
  }
}

export async function fetchAreaOptions(): Promise<AreaRecord[]> {
  try {
    const areas = await listAreas({ area_status: 'Active' });
    if (areas.length) return areas;
  } catch { /* optional */ }
  return [
    {
      id: 'grade-a-filling',
      area_code: 'GA-FILL',
      area_name: 'Grade A Filling Room',
      department: 'Production',
      room_number: 'FILL-01',
      cleanroom_grade: 'Grade A',
      process_area: 'Filling',
      monitoring_required: true,
      temperature_limit_lower: 18,
      temperature_limit_upper: 22,
      rh_limit_lower: 45,
      rh_limit_upper: 55,
      dp_limit_lower: 10,
      dp_limit_upper: 20,
      area_status: 'Active',
      remarks: '',
      created_by: 'system',
      created_by_name: 'System',
      updated_by: 'system',
      updated_by_name: 'System',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'grade-b-prep',
      area_code: 'GB-PREP',
      area_name: 'Grade B Preparation',
      department: 'Production',
      room_number: 'PREP-02',
      cleanroom_grade: 'Grade B',
      process_area: 'Preparation',
      monitoring_required: true,
      temperature_limit_lower: 18,
      temperature_limit_upper: 22,
      rh_limit_lower: 45,
      rh_limit_upper: 55,
      dp_limit_lower: 10,
      dp_limit_upper: 20,
      area_status: 'Active',
      remarks: '',
      created_by: 'system',
      created_by_name: 'System',
      updated_by: 'system',
      updated_by_name: 'System',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

async function countEmFailures(batchNumber: string, parameterCode: string, areaName: string): Promise<number> {
  const results = await fetchEnvironmentalRecords(1000);
  return results.filter((r) =>
    r.batchNumber === batchNumber
    && r.parameterCode === parameterCode
    && r.areaName === areaName
    && ['Alert', 'Action', 'Excursion'].includes(r.status),
  ).length;
}

async function maybeCreateDeviation(record: EnvironmentalMonitoringRecord, actor: EnvironmentalActor, autoDeviation: boolean) {
  if (!autoDeviation || !['Excursion', 'Action', 'Alert'].includes(record.status)) return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const devStatus = record.status === 'Excursion' ? 'OOS' : 'OOT';
    const dev = await createDeviationFromCpv('cpv_cpp', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: `${record.areaName}: ${record.parameterName}`,
      observedValue: Number(record.observedValue),
      status: devStatus,
      department: 'Microbiology',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlertAndNotification(record: EnvironmentalMonitoringRecord, actor: EnvironmentalActor) {
  if (record.status === 'Complies') return;
  try {
    await createAlert({
      alertType: record.status === 'Excursion' ? 'OOT' : 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'Environmental Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.parameterName,
      message: `Environmental ${record.parameterName} ${record.status} in ${record.areaName}`,
      observedValue: Number(record.observedValue),
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title: `Environmental ${record.status}`,
      message: `${record.areaName}: ${record.parameterName} ${record.status}`,
      module: ENVIRONMENTAL_MODULE_NAME,
      record_id: record.id,
      target_roles: ['qa', 'microbiology', 'qc'],
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch { /* optional */ }
}

export async function createEnvironmentalRecord(
  data: EnvironmentalMonitoringFormData,
  actor: EnvironmentalActor,
): Promise<{ result: EnvironmentalMonitoringRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchEmBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existing = await fetchEnvironmentalRecords(1000);
    const duplicate = existing.find(
      (r) => r.batchNumber === data.batchNumber
        && r.parameterCode === data.parameterCode
        && r.areaName === data.areaName
        && r.monitoringDate === data.monitoringDate
        && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'Environmental record already exists for this batch, area, parameter and date.' };

    const status = evaluateEnvironmentalStatus(
      data.observedValue,
      data.lowerLimit,
      data.upperLimit,
      data.resultType,
      data.alertLimitLow,
      data.alertLimitHigh,
      data.actionLimitLow,
      data.actionLimitHigh,
    );
    const failures = await countEmFailures(data.batchNumber, data.parameterCode, data.areaName);
    const riskLevel = evaluateEnvironmentalRisk({ ...data, status }, failures);
    const capaRequired = failures >= 3;
    const autoDev = data.autoDeviationRequired;

    const payload = {
      ...data,
      environmentalMonitoringId: buildEnvironmentalMonitoringId(data.batchNumber, data.parameterCode, data.areaName),
      status,
      riskLevel,
      deviationRequired: autoDev && status !== 'Complies',
      capaRequired,
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      ENVIRONMENTAL_MONITORING_COLLECTION,
      payload as Omit<EnvironmentalMonitoringRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeEnvironmentalRecord(created as unknown as Record<string, unknown>);

    const devNo = await maybeCreateDeviation(result, actor, autoDev);
    if (devNo) {
      const updated = await updateRecord(ENVIRONMENTAL_MONITORING_COLLECTION, result.id, {
        linkedDeviationNumber: devNo,
        deviationRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeEnvironmentalRecord(updated as unknown as Record<string, unknown>);
      await logEmAudit('deviation auto-created', result.id, actor, null, devNo, result.environmentalMonitoringId);
    }

    if (status !== 'Complies') {
      await maybeCreateAlertAndNotification(result, actor);
      if (capaRequired) await logEmAudit('CAPA suggested', result.id, actor, null, { parameter: data.parameterCode }, result.environmentalMonitoringId);
    }

    await logEmAudit('create environmental record', result.id, actor, null, result, result.environmentalMonitoringId);
    await logEmAudit('status calculation', result.id, actor, null, status, result.environmentalMonitoringId);
    await logEmAudit('risk calculation', result.id, actor, null, riskLevel, result.environmentalMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('createEnvironmentalRecord failed', e);
    return { result: null, error: 'Failed to create environmental record.' };
  }
}

export async function updateEnvironmentalRecord(
  id: string,
  data: Partial<EnvironmentalMonitoringFormData>,
  actor: EnvironmentalActor,
  existing: EnvironmentalMonitoringRecord,
  qaOverride = false,
): Promise<{ result: EnvironmentalMonitoringRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved environmental record is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    const status = evaluateEnvironmentalStatus(
      merged.observedValue,
      merged.lowerLimit,
      merged.upperLimit,
      merged.resultType,
      merged.alertLimitLow,
      merged.alertLimitHigh,
      merged.actionLimitLow,
      merged.actionLimitHigh,
    );
    const failures = await countEmFailures(merged.batchNumber, merged.parameterCode, merged.areaName);
    const riskLevel = evaluateEnvironmentalRisk({ ...merged, status }, failures);
    const updates = {
      ...data,
      status,
      riskLevel,
      capaRequired: failures >= 3,
      updatedByName: actor.name,
    };
    const updated = await updateRecord(ENVIRONMENTAL_MONITORING_COLLECTION, id, updates as Partial<EnvironmentalMonitoringRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeEnvironmentalRecord(updated as unknown as Record<string, unknown>);
    await logEmAudit(qaOverride ? 'QA override' : 'edit environmental record', id, actor, existing, result, result.environmentalMonitoringId);
    await logEmAudit('status calculation', id, actor, existing.status, status, result.environmentalMonitoringId);
    await logEmAudit('risk calculation', id, actor, existing.riskLevel, riskLevel, result.environmentalMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updateEnvironmentalRecord failed', e);
    return { result: null, error: 'Failed to update environmental record.' };
  }
}

export async function reviewEnvironmentalRecord(id: string, actor: EnvironmentalActor, existing: EnvironmentalMonitoringRecord) {
  const updated = await updateRecord(ENVIRONMENTAL_MONITORING_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeEnvironmentalRecord(updated as unknown as Record<string, unknown>);
  await logEmAudit('review environmental record', id, actor, existing.reviewStatus, 'Under Review', result.environmentalMonitoringId);
  return { result, error: null };
}

export async function approveEnvironmentalRecord(id: string, actor: EnvironmentalActor, existing: EnvironmentalMonitoringRecord) {
  const updated = await updateRecord(ENVIRONMENTAL_MONITORING_COLLECTION, id, {
    reviewStatus: 'Approved',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeEnvironmentalRecord(updated as unknown as Record<string, unknown>);
  await logEmAudit('approve environmental record', id, actor, existing.reviewStatus, 'Approved', result.environmentalMonitoringId);
  return { result, error: null };
}

export async function bulkCreateEnvironmentalRecords(
  rows: EnvironmentalMonitoringFormData[],
  actor: EnvironmentalActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createEnvironmentalRecord(row, actor);
    if (error) errors.push(`${row.parameterName}: ${error}`);
    else created += 1;
  }
  if (created) await logEmAudit('bulk environmental entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function fetchEnvironmentalAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logEnvironmentalExport(actor: EnvironmentalActor, count: number) {
  await logEmAudit('export environmental list', 'export', actor, null, { count });
}

export function environmentalParameterTrendData(
  records: EnvironmentalMonitoringRecord[],
  parameterName: string,
) {
  return records
    .filter((r) => r.parameterName === parameterName || r.parameterName.toLowerCase().includes(parameterName.toLowerCase()))
    .sort((a, b) => `${a.monitoringDate}${a.monitoringTime}`.localeCompare(`${b.monitoringDate}${b.monitoringTime}`))
    .map((r) => ({
      label: r.batchNumber,
      observed: Number(r.observedValue),
      target: r.targetValue,
      lsl: r.lowerLimit,
      usl: r.upperLimit,
      date: r.monitoringDate,
    }));
}
