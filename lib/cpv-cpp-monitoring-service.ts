import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchParameters, normalizeParameter } from '@/lib/admin/parameter-service';
import type { Parameter } from '@/lib/admin/schemas';
import { fetchCpvProductById } from '@/lib/cpv-product-master-service';
import { fetchCpvBatchById, fetchCpvBatches } from '@/lib/cpv-batch-registration-service';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS, type CppRecord } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import {
  CPP_RESULTS_COLLECTION,
  CPP_LEGACY_COLLECTION,
  CPP_MODULE_NAME,
  DEFAULT_CPP_PARAMETERS,
  buildCppResultId,
  evaluateCppStatus,
  evaluateCppRiskLevel,
  parameterMatchesCppProcessStage,
  type CppResultFormData,
  type CppResultRecord,
} from '@/lib/cpv-cpp-monitoring';

export interface CppActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: CppActor) {
  return { moduleName: CPP_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logCppAudit(actionType: string, recordId: string, actor: CppActor, oldVal?: unknown, newVal?: unknown, docNo?: string) {
  await createAuditLog({
    moduleName: CPP_MODULE_NAME,
    collectionName: CPP_RESULTS_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: CPP_RESULTS_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: CPP_MODULE_NAME,
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

function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}

function normalizeCppResult(raw: Record<string, unknown>): CppResultRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  return {
    id: str(raw.id),
    cppResultId: str(raw.cppResultId || raw.cpp_result_id, buildCppResultId(batchNumber, parameterCode)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    processStage: str(raw.processStage || raw.process_stage),
    parameterId: str(raw.parameterId || raw.parameter_id),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name),
    parameterCategory: str(raw.parameterCategory || raw.parameter_category),
    observedValue: observedVal(raw.observedValue ?? raw.observed_value),
    targetValue: num(raw.targetValue ?? raw.target_value ?? raw.target),
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit ?? raw.lsl),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit ?? raw.usl),
    alertLimitLow: num(raw.alertLimitLow ?? raw.alert_limit_low),
    alertLimitHigh: num(raw.alertLimitHigh ?? raw.alert_limit_high),
    actionLimitLow: num(raw.actionLimitLow ?? raw.action_limit_low),
    actionLimitHigh: num(raw.actionLimitHigh ?? raw.action_limit_high),
    unit: str(raw.unit),
    resultType: (str(raw.resultType || raw.result_type, 'Numeric') as CppResultRecord['resultType']),
    frequency: str(raw.frequency, 'Per Batch'),
    criticality: (str(raw.criticality, 'Major') as CppResultRecord['criticality']),
    observationDateTime: str(raw.observationDateTime || raw.observation_date_time || raw.createdAt),
    recordedBy: str(raw.recordedBy || raw.recorded_by),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    remarks: str(raw.remarks),
    status: str(raw.status, 'Complies'),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as CppResultRecord['reviewStatus']),
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

export async function fetchCppResults(max = 500): Promise<CppResultRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: CppResultRecord[] = [];
    try {
      primary = await getRecords<CppResultRecord>(CPP_RESULTS_COLLECTION, [orderBy('observationDateTime', 'desc'), limit(max)]);
    } catch {
      primary = await getRecords<CppResultRecord>(CPP_RESULTS_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeCppResult(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.observationDateTime.localeCompare(a.observationDateTime));
    const legacy = await listCpvRecords<CppRecord>(CPV_COLLECTIONS.cpp, max);
    return legacy.map((r) => normalizeCppResult({
      ...r,
      batchNumber: r.batchNo,
      parameterName: r.parameterName,
      lowerLimit: r.lsl,
      upperLimit: r.usl,
      targetValue: r.targetValue,
      observationDateTime: r.manufacturingDate,
      reviewStatus: 'Draft',
    }));
  } catch (e) {
    console.error('fetchCppResults failed', e);
    return [];
  }
}

export async function fetchCppResultById(id: string): Promise<CppResultRecord | null> {
  const record = await getRecord<CppResultRecord>(CPP_RESULTS_COLLECTION, id);
  if (record) return normalizeCppResult(record as unknown as Record<string, unknown>);
  const all = await fetchCppResults();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchCppParametersForProduct(
  productName: string,
  cpvProductId?: string,
  processStage?: string,
): Promise<Parameter[]> {
  try {
    const all = await fetchParameters();
    let cpp = all.filter((p) => {
      const n = normalizeParameter(p);
      return n.parameterType === 'CPP' && n.status === 'Active';
    });
    if (cpvProductId) {
      const product = await fetchCpvProductById(cpvProductId);
      const linked = product?.linkedCppParameterIds || [];
      if (linked.length) {
        const linkedParams = cpp.filter((p) =>
          linked.includes(p.id || '') || linked.includes(p.parameterId || ''),
        );
        if (linkedParams.length) cpp = linkedParams;
      }
    }
    const byProduct = cpp.filter((p) => {
      const link = p.productLink || p.product || '';
      return !link || link === productName || link === 'All Products';
    });
    let list = byProduct.length ? byProduct : cpp;
    if (processStage) {
      list = list.filter((p) => {
        const n = normalizeParameter(p);
        return parameterMatchesCppProcessStage(n.parameterName, processStage, n.processStage);
      });
    }
    return list;
  } catch {
    return [];
  }
}

export async function fetchCppBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

async function countParameterFailures(batchNumber: string, parameterCode: string): Promise<number> {
  const results = await fetchCppResults(1000);
  return results.filter((r) =>
    r.batchNumber === batchNumber
    && r.parameterCode === parameterCode
    && !['Complies', 'Pass'].includes(r.status),
  ).length;
}

async function maybeCreateDeviation(record: CppResultRecord, actor: CppActor, autoDeviation: boolean) {
  if (!autoDeviation || !['OOT/OOL', 'Action', 'Alert', 'OOT', 'OOS'].includes(record.status)) return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const devStatus = record.status === 'OOT/OOL' ? 'OOT' : record.status === 'Action' ? 'OOT' : 'OOT';
    const dev = await createDeviationFromCpv('cpv_cpp', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.parameterName,
      observedValue: Number(record.observedValue),
      status: devStatus,
      department: 'Production',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlert(record: CppResultRecord, actor: CppActor) {
  if (['Complies', 'Pass'].includes(record.status)) return;
  try {
    await createAlert({
      alertType: record.status === 'OOT/OOL' ? 'OOT' : 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'CPP Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.parameterName,
      message: `CPP ${record.parameterName} ${record.status} for batch ${record.batchNumber}`,
      observedValue: Number(record.observedValue),
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
}

export async function createCppResult(
  data: CppResultFormData,
  actor: CppActor,
  autoDeviation = true,
): Promise<{ result: CppResultRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchCppBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existingResults = await fetchCppResults(1000);
    const duplicate = existingResults.find(
      (r) => r.batchNumber === data.batchNumber
        && r.parameterCode === data.parameterCode
        && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'CPP result already exists for this batch and parameter.' };

    const status = evaluateCppStatus(
      data.observedValue,
      data.lowerLimit,
      data.upperLimit,
      data.resultType,
      data.alertLimitLow,
      data.alertLimitHigh,
      data.actionLimitLow,
      data.actionLimitHigh,
    );
    const failures = await countParameterFailures(data.batchNumber, data.parameterCode);
    const riskLevel = evaluateCppRiskLevel(status, data.criticality, failures);
    const capaRequired = failures >= 3;

    const payload = removeUndefined({
      ...data,
      cppResultId: buildCppResultId(data.batchNumber, data.parameterCode),
      status,
      riskLevel,
      deviationRequired: autoDeviation && !['Complies', 'Pass'].includes(status),
      capaRequired,
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      createdByName: actor.name,
      updatedByName: actor.name,
      batchNo: data.batchNumber,
      product_name: data.productName,
      lsl: data.lowerLimit,
      usl: data.upperLimit,
      target_value: data.targetValue,
    });

    const created = await createRecord(
      CPP_RESULTS_COLLECTION,
      payload as Omit<CppResultRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeCppResult(created as unknown as Record<string, unknown>);

    const devNo = await maybeCreateDeviation(result, actor, autoDeviation);
    if (devNo) {
      const updated = await updateRecord(CPP_RESULTS_COLLECTION, result.id, {
        linkedDeviationNumber: devNo,
        deviationRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeCppResult(updated as unknown as Record<string, unknown>);
      await logCppAudit('deviation auto-created', result.id, actor, null, devNo, result.cppResultId);
    }

    if (!['Complies', 'Pass'].includes(status)) {
      await maybeCreateAlert(result, actor);
      if (capaRequired) await logCppAudit('CAPA suggested', result.id, actor, null, { parameter: data.parameterCode }, result.cppResultId);
    }

    await logCppAudit('create CPP result', result.id, actor, null, result, result.cppResultId);
    return { result, error: null };
  } catch (e) {
    console.error('createCppResult failed', e);
    return { result: null, error: 'Failed to create CPP result.' };
  }
}

export async function updateCppResult(
  id: string,
  data: Partial<CppResultFormData>,
  actor: CppActor,
  existing: CppResultRecord,
  qaOverride = false,
): Promise<{ result: CppResultRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved CPP result is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    const status = evaluateCppStatus(
      merged.observedValue,
      merged.lowerLimit,
      merged.upperLimit,
      merged.resultType,
      merged.alertLimitLow,
      merged.alertLimitHigh,
      merged.actionLimitLow,
      merged.actionLimitHigh,
    );
    const failures = await countParameterFailures(merged.batchNumber, merged.parameterCode);
    const riskLevel = evaluateCppRiskLevel(status, merged.criticality, failures);
    const updates = removeUndefined({
      ...data,
      status,
      riskLevel,
      capaRequired: failures >= 3,
      updatedByName: actor.name,
    });
    const updated = await updateRecord(CPP_RESULTS_COLLECTION, id, updates as Partial<CppResultRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeCppResult(updated as unknown as Record<string, unknown>);
    await logCppAudit(qaOverride ? 'QA override' : 'edit CPP result', id, actor, existing, result, result.cppResultId);
    return { result, error: null };
  } catch (e) {
    console.error('updateCppResult failed', e);
    return { result: null, error: 'Failed to update CPP result.' };
  }
}

export async function reviewCppResult(id: string, actor: CppActor, existing: CppResultRecord) {
  const updated = await updateRecord(CPP_RESULTS_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeCppResult(updated as unknown as Record<string, unknown>);
  await logCppAudit('review CPP result', id, actor, existing.reviewStatus, 'Under Review', result.cppResultId);
  return { result, error: null };
}

export async function approveCppResult(id: string, actor: CppActor, existing: CppResultRecord) {
  const updated = await updateRecord(CPP_RESULTS_COLLECTION, id, {
    reviewStatus: 'Approved',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeCppResult(updated as unknown as Record<string, unknown>);
  await logCppAudit('approve CPP result', id, actor, existing.reviewStatus, 'Approved', result.cppResultId);
  return { result, error: null };
}

export async function bulkCreateCppResults(
  rows: CppResultFormData[],
  actor: CppActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createCppResult(row, actor);
    if (error) errors.push(`${row.parameterName}: ${error}`);
    else created += 1;
  }
  if (created) await logCppAudit('bulk CPP entry', 'bulk', actor, null, { count: created });
  return { created, errors };
}

export async function autofillFromBatch(batchId: string) {
  const batch = await fetchCpvBatchById(batchId);
  if (!batch) return null;
  return {
    cpvProductId: batch.cpvProductId,
    productName: batch.productName,
    productCode: batch.productCode,
    batchNumber: batch.batchNumber,
    manufacturingDate: batch.manufacturingDate,
  };
}

export async function fetchCppAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logCppExport(actor: CppActor, count: number) {
  await logCppAudit('export CPP list', 'export', actor, null, { count });
}

export function parameterTrendData(results: CppResultRecord[], parameterName: string) {
  return results
    .filter((r) => r.parameterName === parameterName)
    .sort((a, b) => a.observationDateTime.localeCompare(b.observationDateTime))
    .map((r) => ({
      label: r.batchNumber,
      observed: Number(r.observedValue),
      target: r.targetValue,
      lsl: r.lowerLimit,
      usl: r.upperLimit,
      date: r.observationDateTime,
    }));
}
