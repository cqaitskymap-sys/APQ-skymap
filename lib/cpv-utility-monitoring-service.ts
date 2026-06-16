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
import { listEquipment } from '@/lib/equipment-mgmt-service';
import {
  UTILITY_MONITORING_COLLECTION,
  UTILITY_LEGACY_COLLECTIONS,
  UTILITY_MASTER_COLLECTION,
  UTILITY_MODULE_NAME,
  buildUtilityMonitoringId,
  evaluateUtilityStatus,
  evaluateUtilityRisk,
  parametersForUtilityType,
  type UtilityMonitoringFormData,
  type UtilityMonitoringRecord,
} from '@/lib/cpv-utility-monitoring';

export interface UtilityActor {
  id: string;
  name: string;
  role?: string;
}

export interface UtilitySystemOption {
  id: string;
  code: string;
  name: string;
  utilityType: string;
  samplingPoints: string[];
  areaRoomNo: string;
  department: string;
}

function actorCtx(actor: UtilityActor) {
  return { moduleName: UTILITY_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logUtilityAudit(
  actionType: string,
  recordId: string,
  actor: UtilityActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: UTILITY_MODULE_NAME,
    collectionName: UTILITY_MONITORING_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: UTILITY_MONITORING_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: UTILITY_MODULE_NAME,
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

function normalizeUtilityRecord(raw: Record<string, unknown>): UtilityMonitoringRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  const samplingPoint = str(raw.samplingPoint || raw.sampling_point);
  return {
    id: str(raw.id),
    utilityMonitoringId: str(
      raw.utilityMonitoringId || raw.utility_monitoring_id,
      buildUtilityMonitoringId(batchNumber, parameterCode, samplingPoint),
    ),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    utilityType: str(raw.utilityType || raw.utility_type, 'Other') as UtilityMonitoringRecord['utilityType'],
    utilitySystemName: str(raw.utilitySystemName || raw.utility_system_name || raw.utilitySystem),
    utilitySystemCode: str(raw.utilitySystemCode || raw.utility_system_code),
    samplingPoint,
    areaRoomNo: str(raw.areaRoomNo || raw.area_room_no || raw.area),
    department: str(raw.department),
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
    resultType: (str(raw.resultType || raw.result_type, 'Numeric') as UtilityMonitoringRecord['resultType']),
    monitoringDate: str(raw.monitoringDate || raw.monitoring_date || raw.recordedDate),
    monitoringTime: str(raw.monitoringTime || raw.monitoring_time || '00:00'),
    recordedBy: str(raw.recordedBy || raw.recorded_by),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    remarks: str(raw.remarks),
    utilityCriticality: str(raw.utilityCriticality || raw.criticality, 'Major'),
    autoDeviationRequired: Boolean(raw.autoDeviationRequired ?? raw.auto_deviation_required ?? true),
    status: str(raw.status, 'Complies'),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as UtilityMonitoringRecord['reviewStatus']),
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

export async function fetchUtilityRecords(max = 500): Promise<UtilityMonitoringRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: UtilityMonitoringRecord[] = [];
    try {
      primary = await getRecords<UtilityMonitoringRecord>(
        UTILITY_MONITORING_COLLECTION,
        [orderBy('monitoringDate', 'desc'), limit(max)],
      );
    } catch {
      primary = await getRecords<UtilityMonitoringRecord>(UTILITY_MONITORING_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeUtilityRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) {
      return normalized.sort((a, b) => `${b.monitoringDate}${b.monitoringTime}`.localeCompare(`${a.monitoringDate}${a.monitoringTime}`));
    }
    for (const legacyName of UTILITY_LEGACY_COLLECTIONS) {
      const legacy = await listCpvRecords<Record<string, unknown>>(legacyName, max);
      if (legacy.length) {
        return legacy.map((r) => normalizeUtilityRecord(r));
      }
    }
    return [];
  } catch (e) {
    console.error('fetchUtilityRecords failed', e);
    return [];
  }
}

export async function fetchUtilityRecordById(id: string): Promise<UtilityMonitoringRecord | null> {
  const record = await getRecord<UtilityMonitoringRecord>(UTILITY_MONITORING_COLLECTION, id);
  if (record) return normalizeUtilityRecord(record as unknown as Record<string, unknown>);
  const all = await fetchUtilityRecords();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchUtilityBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

export async function fetchUtilityParameters(utilityType?: string): Promise<Parameter[]> {
  try {
    const all = await fetchParameters();
    let params = all.filter((p) => {
      const n = normalizeParameter(p);
      return n.parameterType === 'Utility Parameter' && n.status === 'Active';
    });
    if (utilityType) {
      const names = parametersForUtilityType(utilityType);
      const filtered = params.filter((p) => names.some((n) => p.parameterName?.includes(n) || n.includes(p.parameterName || '')));
      if (filtered.length) params = filtered;
    }
    return params;
  } catch {
    return [];
  }
}

export async function fetchUtilitySystems(): Promise<UtilitySystemOption[]> {
  const systems: UtilitySystemOption[] = [];
  if (isFirebaseConfigured()) {
    try {
      const rows = await getRecords<Record<string, unknown>>(UTILITY_MASTER_COLLECTION, [limit(200)]);
      rows.forEach((r) => {
        systems.push({
          id: str(r.id),
          code: str(r.utility_system_code || r.systemCode || r.code, str(r.id)),
          name: str(r.utility_system_name || r.systemName || r.name),
          utilityType: str(r.utility_type || r.utilityType, 'Other'),
          samplingPoints: Array.isArray(r.sampling_points) ? r.sampling_points as string[] : [str(r.sampling_point, 'Main')],
          areaRoomNo: str(r.area_room_no || r.areaRoomNo),
          department: str(r.department, 'Utilities'),
        });
      });
    } catch { /* optional */ }
  }
  try {
    const equipment = await listEquipment({});
    equipment.filter((e) =>
      ['Utility Equipment', 'HVAC', 'Water System', 'Compressed Air System'].includes(e.equipment_type),
    ).forEach((e) => {
      systems.push({
        id: e.id,
        code: e.equipment_id,
        name: e.equipment_name,
        utilityType: e.equipment_type === 'HVAC' ? 'HVAC'
          : e.equipment_type === 'Water System' ? 'Purified Water'
            : e.equipment_type === 'Compressed Air System' ? 'Compressed Air'
              : 'Other',
        samplingPoints: [e.area_room_no || 'Main'],
        areaRoomNo: e.area_room_no,
        department: e.department,
      });
    });
  } catch { /* optional */ }
  if (!systems.length) {
    return [
      { id: 'wfi-loop', code: 'WFI-01', name: 'WFI Distribution Loop', utilityType: 'Water for Injection', samplingPoints: ['Loop Return', 'Storage Tank'], areaRoomNo: 'Utility Block', department: 'Utilities' },
      { id: 'pw-loop', code: 'PW-01', name: 'Purified Water Loop', utilityType: 'Purified Water', samplingPoints: ['Loop Return'], areaRoomNo: 'Utility Block', department: 'Utilities' },
      { id: 'ca-header', code: 'CA-01', name: 'Compressed Air Header', utilityType: 'Compressed Air', samplingPoints: ['Production Header', 'Filling Room'], areaRoomNo: 'Production', department: 'Engineering' },
      { id: 'hvac-ahu', code: 'AHU-01', name: 'AHU Grade B Area', utilityType: 'HVAC', samplingPoints: ['Grade B Room', 'Grade A Room'], areaRoomNo: 'Grade B', department: 'Engineering' },
    ];
  }
  return systems;
}

async function countUtilityFailures(batchNumber: string, parameterCode: string, samplingPoint: string): Promise<number> {
  const results = await fetchUtilityRecords(1000);
  return results.filter((r) =>
    r.batchNumber === batchNumber
    && r.parameterCode === parameterCode
    && r.samplingPoint === samplingPoint
    && ['Alert', 'Action', 'Excursion'].includes(r.status),
  ).length;
}

async function maybeCreateDeviation(record: UtilityMonitoringRecord, actor: UtilityActor, autoDeviation: boolean) {
  if (!autoDeviation || !['Excursion', 'Action', 'Alert'].includes(record.status)) return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const devStatus = record.status === 'Excursion' ? 'OOS' : 'OOT';
    const dev = await createDeviationFromCpv('cpv_cpp', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: `${record.utilitySystemName}: ${record.parameterName}`,
      observedValue: Number(record.observedValue),
      status: devStatus,
      department: record.department || 'Engineering',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlertAndNotification(record: UtilityMonitoringRecord, actor: UtilityActor) {
  if (record.status === 'Complies') return;
  try {
    await createAlert({
      alertType: record.status === 'Excursion' ? 'OOT' : 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'Utility Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.parameterName,
      message: `Utility ${record.parameterName} ${record.status} at ${record.samplingPoint}`,
      observedValue: Number(record.observedValue),
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
  if (!isFirebaseConfigured()) return;
  try {
    await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
      title: `Utility ${record.status}`,
      message: `${record.utilitySystemName}: ${record.parameterName} ${record.status}`,
      module: UTILITY_MODULE_NAME,
      record_id: record.id,
      target_roles: ['qa', 'engineering', 'qc'],
      read: false,
      created_at: new Date().toISOString(),
    });
  } catch { /* optional */ }
}

export async function createUtilityRecord(
  data: UtilityMonitoringFormData,
  actor: UtilityActor,
): Promise<{ result: UtilityMonitoringRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchUtilityBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existing = await fetchUtilityRecords(1000);
    const duplicate = existing.find(
      (r) => r.batchNumber === data.batchNumber
        && r.parameterCode === data.parameterCode
        && r.samplingPoint === data.samplingPoint
        && r.monitoringDate === data.monitoringDate
        && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'Utility record already exists for this batch, parameter, sampling point and date.' };

    const status = evaluateUtilityStatus(
      data.observedValue,
      data.lowerLimit,
      data.upperLimit,
      data.resultType,
      data.alertLimitLow,
      data.alertLimitHigh,
      data.actionLimitLow,
      data.actionLimitHigh,
    );
    const failures = await countUtilityFailures(data.batchNumber, data.parameterCode, data.samplingPoint);
    const riskLevel = evaluateUtilityRisk({ ...data, status }, failures);
    const capaRequired = failures >= 3;
    const autoDev = data.autoDeviationRequired;

    const payload = {
      ...data,
      utilityMonitoringId: buildUtilityMonitoringId(data.batchNumber, data.parameterCode, data.samplingPoint),
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
      UTILITY_MONITORING_COLLECTION,
      payload as Omit<UtilityMonitoringRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeUtilityRecord(created as unknown as Record<string, unknown>);

    const devNo = await maybeCreateDeviation(result, actor, autoDev);
    if (devNo) {
      const updated = await updateRecord(UTILITY_MONITORING_COLLECTION, result.id, {
        linkedDeviationNumber: devNo,
        deviationRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeUtilityRecord(updated as unknown as Record<string, unknown>);
      await logUtilityAudit('deviation auto-created', result.id, actor, null, devNo, result.utilityMonitoringId);
    }

    if (status !== 'Complies') {
      await maybeCreateAlertAndNotification(result, actor);
      if (capaRequired) await logUtilityAudit('CAPA suggested', result.id, actor, null, { parameter: data.parameterCode }, result.utilityMonitoringId);
    }

    await logUtilityAudit('create utility record', result.id, actor, null, result, result.utilityMonitoringId);
    await logUtilityAudit('status calculation', result.id, actor, null, status, result.utilityMonitoringId);
    await logUtilityAudit('risk calculation', result.id, actor, null, riskLevel, result.utilityMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('createUtilityRecord failed', e);
    return { result: null, error: 'Failed to create utility record.' };
  }
}

export async function updateUtilityRecord(
  id: string,
  data: Partial<UtilityMonitoringFormData>,
  actor: UtilityActor,
  existing: UtilityMonitoringRecord,
  qaOverride = false,
): Promise<{ result: UtilityMonitoringRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved utility record is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    const status = evaluateUtilityStatus(
      merged.observedValue,
      merged.lowerLimit,
      merged.upperLimit,
      merged.resultType,
      merged.alertLimitLow,
      merged.alertLimitHigh,
      merged.actionLimitLow,
      merged.actionLimitHigh,
    );
    const failures = await countUtilityFailures(merged.batchNumber, merged.parameterCode, merged.samplingPoint);
    const riskLevel = evaluateUtilityRisk({ ...merged, status }, failures);
    const updates = {
      ...data,
      status,
      riskLevel,
      capaRequired: failures >= 3,
      updatedByName: actor.name,
    };
    const updated = await updateRecord(UTILITY_MONITORING_COLLECTION, id, updates as Partial<UtilityMonitoringRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeUtilityRecord(updated as unknown as Record<string, unknown>);
    await logUtilityAudit(qaOverride ? 'QA override' : 'edit utility record', id, actor, existing, result, result.utilityMonitoringId);
    await logUtilityAudit('status calculation', id, actor, existing.status, status, result.utilityMonitoringId);
    await logUtilityAudit('risk calculation', id, actor, existing.riskLevel, riskLevel, result.utilityMonitoringId);
    return { result, error: null };
  } catch (e) {
    console.error('updateUtilityRecord failed', e);
    return { result: null, error: 'Failed to update utility record.' };
  }
}

export async function reviewUtilityRecord(id: string, actor: UtilityActor, existing: UtilityMonitoringRecord) {
  const updated = await updateRecord(UTILITY_MONITORING_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeUtilityRecord(updated as unknown as Record<string, unknown>);
  await logUtilityAudit('review utility record', id, actor, existing.reviewStatus, 'Under Review', result.utilityMonitoringId);
  return { result, error: null };
}

export async function approveUtilityRecord(id: string, actor: UtilityActor, existing: UtilityMonitoringRecord) {
  const updated = await updateRecord(UTILITY_MONITORING_COLLECTION, id, {
    reviewStatus: 'Approved',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeUtilityRecord(updated as unknown as Record<string, unknown>);
  await logUtilityAudit('approve utility record', id, actor, existing.reviewStatus, 'Approved', result.utilityMonitoringId);
  return { result, error: null };
}

export async function bulkCreateUtilityRecords(
  rows: UtilityMonitoringFormData[],
  actor: UtilityActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createUtilityRecord(row, actor);
    if (error) errors.push(`${row.parameterName}: ${error}`);
    else created += 1;
  }
  if (created) await logUtilityAudit('bulk utility entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function fetchUtilityAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logUtilityExport(actor: UtilityActor, count: number) {
  await logUtilityAudit('export utility list', 'export', actor, null, { count });
}

export function utilityParameterTrendData(
  records: UtilityMonitoringRecord[],
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
