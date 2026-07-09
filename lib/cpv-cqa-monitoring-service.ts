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
import { CPV_COLLECTIONS, type CqaRecord } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import {
  CQA_RESULTS_COLLECTION,
  CQA_MODULE_NAME,
  buildCqaResultId,
  evaluateCqaStatus,
  evaluateCqaRiskLevel,
  parameterMatchesCqaTestStage,
  type CqaResultFormData,
  type CqaResultRecord,
} from '@/lib/cpv-cqa-monitoring';

export interface CqaActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: CqaActor) {
  return { moduleName: CQA_MODULE_NAME, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logCqaAudit(actionType: string, recordId: string, actor: CqaActor, oldVal?: unknown, newVal?: unknown, docNo?: string) {
  await createAuditLog({
    moduleName: CQA_MODULE_NAME,
    collectionName: CQA_RESULTS_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: CQA_RESULTS_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: CQA_MODULE_NAME,
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

function normalizeCqaResult(raw: Record<string, unknown>): CqaResultRecord {
  const batchNumber = str(raw.batchNumber || raw.batchNo || raw.batch_number);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  return {
    id: str(raw.id),
    cqaResultId: str(raw.cqaResultId || raw.cqa_result_id, buildCqaResultId(batchNumber, parameterCode)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode: str(raw.productCode || raw.product_code),
    batchNumber,
    manufacturingDate: str(raw.manufacturingDate || raw.manufacturing_date),
    expiryDate: str(raw.expiryDate || raw.expiry_date),
    testStage: str(raw.testStage || raw.test_stage),
    parameterId: str(raw.parameterId || raw.parameter_id),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name || raw.testParameter),
    subParameter: str(raw.subParameter || raw.sub_parameter || raw.subparameter),
    parameterCategory: str(raw.parameterCategory || raw.parameter_category),
    responsibility: str(raw.responsibility),
    specificationText: str(raw.specificationText || raw.specification_text),
    specificationNumber: str(raw.specificationNumber || raw.specification_number),
    stpNumber: str(raw.stpNumber || raw.stp_number),
    observedResult: observedVal(raw.observedResult ?? raw.observed_result ?? raw.observedValue ?? raw.observed_value),
    targetValue: num(raw.targetValue ?? raw.target_value ?? raw.target),
    lowerLimit: num(raw.lowerLimit ?? raw.lower_limit ?? raw.lsl),
    upperLimit: num(raw.upperLimit ?? raw.upper_limit ?? raw.usl),
    alertLimitLow: num(raw.alertLimitLow ?? raw.alert_limit_low),
    alertLimitHigh: num(raw.alertLimitHigh ?? raw.alert_limit_high),
    actionLimitLow: num(raw.actionLimitLow ?? raw.action_limit_low),
    actionLimitHigh: num(raw.actionLimitHigh ?? raw.action_limit_high),
    unit: str(raw.unit),
    resultType: (str(raw.resultType || raw.result_type, 'Numeric') as CqaResultRecord['resultType']),
    criticality: (str(raw.criticality, 'Major') as CqaResultRecord['criticality']),
    testDate: str(raw.testDate || raw.test_date || raw.createdAt),
    analyst: str(raw.analyst || raw.recordedBy || raw.recorded_by),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    remarks: str(raw.remarks),
    status: str(raw.status, 'Complies'),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    oosRequired: Boolean(raw.oosRequired || raw.oos_required),
    linkedOosNumber: str(raw.linkedOosNumber || raw.linked_oos_number),
    deviationRequired: Boolean(raw.deviationRequired || raw.deviation_required),
    linkedDeviationNumber: str(raw.linkedDeviationNumber || raw.linked_deviation_number),
    capaRequired: Boolean(raw.capaRequired || raw.capa_required),
    linkedCapaNumber: str(raw.linkedCapaNumber || raw.linked_capa_number),
    reviewStatus: (str(raw.reviewStatus || raw.review_status, 'Draft') as CqaResultRecord['reviewStatus']),
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

export async function fetchCqaResults(max = 500): Promise<CqaResultRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: CqaResultRecord[] = [];
    try {
      primary = await getRecords<CqaResultRecord>(CQA_RESULTS_COLLECTION, [orderBy('testDate', 'desc'), limit(max)]);
    } catch {
      primary = await getRecords<CqaResultRecord>(CQA_RESULTS_COLLECTION, [limit(max)]);
    }
    const normalized = primary.map((r) => normalizeCqaResult(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.testDate.localeCompare(a.testDate));
    const legacy = await listCpvRecords<CqaRecord>(CPV_COLLECTIONS.cqa, max);
    return legacy.map((r) => normalizeCqaResult({
      ...r,
      batchNumber: r.batchNo,
      parameterName: r.testParameter,
      lowerLimit: r.lsl,
      upperLimit: r.usl,
      targetValue: r.target,
      testDate: r.testDate,
      analyst: r.recordedBy,
      reviewStatus: 'Draft',
    }));
  } catch (e) {
    console.error('fetchCqaResults failed', e);
    return [];
  }
}

export async function fetchCqaResultById(id: string): Promise<CqaResultRecord | null> {
  const record = await getRecord<CqaResultRecord>(CQA_RESULTS_COLLECTION, id);
  if (record) return normalizeCqaResult(record as unknown as Record<string, unknown>);
  const all = await fetchCqaResults();
  return all.find((r) => r.id === id) ?? null;
}

export async function fetchCqaParametersForProduct(
  productName: string,
  cpvProductId?: string,
  microbiologyOnly = false,
  testStage?: string,
): Promise<Parameter[]> {
  try {
    const all = await fetchParameters();
    let cqa = all.filter((p) => {
      const n = normalizeParameter(p);
      return n.parameterType === 'CQA' && n.status === 'Active';
    });
    if (cpvProductId) {
      const product = await fetchCpvProductById(cpvProductId);
      const linked = product?.linkedCqaParameterIds || [];
      if (linked.length) {
        cqa = cqa.filter((p) => linked.includes(p.id || ''));
      }
    }
    const byProduct = cqa.filter((p) => {
      const link = p.productLink || p.product || '';
      return !link || link === productName || link === 'All Products';
    });
    let list = byProduct.length ? byProduct : cqa;
    if (microbiologyOnly) {
      list = list.filter((p) => {
        const name = normalizeParameter(p).parameterName;
        return ['Sterility', 'Bacterial Endotoxin', 'Endotoxin'].some((k) => name.toLowerCase().includes(k.toLowerCase()))
          || name.toLowerCase().includes('microbial');
      });
    }
    if (testStage) {
      list = list.filter((p) => {
        const n = normalizeParameter(p);
        const raw = p as Parameter & { testStage?: string; test_stage?: string };
        const explicitStage = raw.testStage || raw.test_stage || '';
        return parameterMatchesCqaTestStage(
          n.parameterName,
          testStage,
          n.processStage,
          explicitStage,
        );
      });
    }
    return list;
  } catch {
    return [];
  }
}

export async function fetchCqaBatchesForProduct(productName: string) {
  const batches = await fetchCpvBatches();
  return batches.filter((b) => b.productName === productName || b.productCode === productName);
}

async function countParameterStatuses(
  batchNumber: string,
  parameterCode: string,
  status: string,
): Promise<number> {
  const results = await fetchCqaResults(1000);
  return results.filter((r) =>
    r.batchNumber === batchNumber
    && r.parameterCode === parameterCode
    && r.status === status
    && !r.isDeleted,
  ).length;
}

async function maybeCreateOos(record: CqaResultRecord, actor: CqaActor, autoOos: boolean): Promise<string> {
  if (!autoOos || record.status !== 'OOS') return '';
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

async function maybeCreateDeviation(record: CqaResultRecord, actor: CqaActor): Promise<string> {
  if (!['OOS', 'Action', 'Alert'].includes(record.status)) return '';
  try {
    const { createDeviationFromCpv } = await import('@/lib/deviation-service');
    const devStatus = record.status === 'OOS' ? 'OOS' : 'OOT';
    const dev = await createDeviationFromCpv('cpv_cqa', {
      id: record.id,
      product: record.productName,
      batchNumber: record.batchNumber,
      parameter: record.parameterName,
      observedValue: Number(record.observedResult),
      status: devStatus,
      department: 'QC',
    }, { id: actor.id, name: actor.name, role: actor.role || 'qa' });
    if (!dev) return '';
    return String((dev as { deviation_number?: string }).deviation_number || dev.id || '');
  } catch {
    return '';
  }
}

async function maybeCreateAlert(record: CqaResultRecord, actor: CqaActor) {
  if (['Complies', 'Pass'].includes(record.status)) return;
  try {
    await createAlert({
      alertType: 'Limit Exceeded',
      severity: record.riskLevel === 'Critical' ? 'Critical' : record.riskLevel === 'High' ? 'High' : 'Medium',
      module: 'CQA Monitoring',
      productName: record.productName,
      batchNo: record.batchNumber,
      parameterName: record.parameterName,
      message: `CQA ${record.parameterName} ${record.status} for batch ${record.batchNumber}`,
      observedValue: Number(record.observedResult),
      recordId: record.id,
    }, { id: actor.id, name: actor.name, role: actor.role });
  } catch { /* optional */ }
}

export async function createCqaResult(
  data: CqaResultFormData,
  actor: CqaActor,
  autoOos = true,
): Promise<{ result: CqaResultRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(data.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive CPV product — entry not allowed.' };
    const batches = await fetchCqaBatchesForProduct(data.productName);
    const batchMatch = batches.find((b) => b.batchNumber === data.batchNumber);
    if (batches.length && !batchMatch) return { result: null, error: 'Batch does not belong to selected product.' };
    if (batchMatch && ['Cancelled', 'Rejected'].includes(batchMatch.batchStatus)) {
      return { result: null, error: 'Cancelled or rejected batch — entry not allowed.' };
    }

    const existingResults = await fetchCqaResults(1000);
    const duplicate = existingResults.find(
      (r) => r.batchNumber === data.batchNumber
        && r.parameterCode === data.parameterCode
        && !r.isDeleted,
    );
    if (duplicate) return { result: null, error: 'CQA result already exists for this batch and parameter.' };

    const status = evaluateCqaStatus(
      data.observedResult,
      data.lowerLimit,
      data.upperLimit,
      data.resultType,
      data.alertLimitLow,
      data.alertLimitHigh,
      data.actionLimitLow,
      data.actionLimitHigh,
    );
    const oosCount = await countParameterStatuses(data.batchNumber, data.parameterCode, 'OOS');
    const alertCount = await countParameterStatuses(data.batchNumber, data.parameterCode, 'Alert');
    const riskLevel = evaluateCqaRiskLevel(status, data.criticality, oosCount, alertCount);
    const capaRequired = oosCount >= 2 || alertCount >= 3;

    const payload = removeUndefined({
      ...data,
      cqaResultId: buildCqaResultId(data.batchNumber, data.parameterCode),
      status,
      riskLevel,
      oosRequired: autoOos && status === 'OOS',
      deviationRequired: !['Complies', 'Pass'].includes(status),
      capaRequired,
      linkedOosNumber: '',
      linkedDeviationNumber: '',
      linkedCapaNumber: '',
      reviewStatus: 'Draft' as const,
      isLocked: false,
      createdByName: actor.name,
      updatedByName: actor.name,
      batchNo: data.batchNumber,
      product_name: data.productName,
      testParameter: data.parameterName,
      lsl: data.lowerLimit,
      usl: data.upperLimit,
      target: data.targetValue,
      observedValue: data.observedResult,
      recordedBy: data.analyst,
    });

    const created = await createRecord(
      CQA_RESULTS_COLLECTION,
      payload as Omit<CqaResultRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeCqaResult(created as unknown as Record<string, unknown>);

    const oosNo = await maybeCreateOos(result, actor, autoOos);
    if (oosNo) {
      const updated = await updateRecord(CQA_RESULTS_COLLECTION, result.id, {
        linkedOosNumber: oosNo,
        oosRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeCqaResult(updated as unknown as Record<string, unknown>);
      await logCqaAudit('OOS auto-created', result.id, actor, null, oosNo, result.cqaResultId);
    }

    const devNo = await maybeCreateDeviation(result, actor);
    if (devNo) {
      const updated = await updateRecord(CQA_RESULTS_COLLECTION, result.id, {
        linkedDeviationNumber: devNo,
        deviationRequired: true,
      }, actorCtx(actor));
      if (updated) result = normalizeCqaResult(updated as unknown as Record<string, unknown>);
      await logCqaAudit('deviation auto-created', result.id, actor, null, devNo, result.cqaResultId);
    }

    if (!['Complies', 'Pass'].includes(status)) {
      await maybeCreateAlert(result, actor);
      if (capaRequired) await logCqaAudit('CAPA suggested', result.id, actor, null, { parameter: data.parameterCode }, result.cqaResultId);
    }

    await logCqaAudit('create CQA result', result.id, actor, null, result, result.cqaResultId);
    return { result, error: null };
  } catch (e) {
    console.error('createCqaResult failed', e);
    return { result: null, error: 'Failed to create CQA result.' };
  }
}

export async function updateCqaResult(
  id: string,
  data: Partial<CqaResultFormData>,
  actor: CqaActor,
  existing: CqaResultRecord,
  qaOverride = false,
): Promise<{ result: CqaResultRecord | null; error: string | null }> {
  if (existing.isLocked && existing.reviewStatus === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved CQA result is locked. QA override required.' };
  }
  try {
    const merged = { ...existing, ...data };
    const status = evaluateCqaStatus(
      merged.observedResult,
      merged.lowerLimit,
      merged.upperLimit,
      merged.resultType,
      merged.alertLimitLow,
      merged.alertLimitHigh,
      merged.actionLimitLow,
      merged.actionLimitHigh,
    );
    const oosCount = await countParameterStatuses(merged.batchNumber, merged.parameterCode, 'OOS');
    const alertCount = await countParameterStatuses(merged.batchNumber, merged.parameterCode, 'Alert');
    const riskLevel = evaluateCqaRiskLevel(status, merged.criticality, oosCount, alertCount);
    const updates = removeUndefined({
      ...data,
      status,
      riskLevel,
      capaRequired: oosCount >= 2 || alertCount >= 3,
      updatedByName: actor.name,
    });
    const updated = await updateRecord(CQA_RESULTS_COLLECTION, id, updates as Partial<CqaResultRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeCqaResult(updated as unknown as Record<string, unknown>);
    await logCqaAudit(qaOverride ? 'QA override' : 'edit CQA result', id, actor, existing, result, result.cqaResultId);
    return { result, error: null };
  } catch (e) {
    console.error('updateCqaResult failed', e);
    return { result: null, error: 'Failed to update CQA result.' };
  }
}

export async function reviewCqaResult(id: string, actor: CqaActor, existing: CqaResultRecord) {
  const updated = await updateRecord(CQA_RESULTS_COLLECTION, id, {
    reviewStatus: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeCqaResult(updated as unknown as Record<string, unknown>);
  await logCqaAudit('review CQA result', id, actor, existing.reviewStatus, 'Under Review', result.cqaResultId);
  return { result, error: null };
}

export async function approveCqaResult(id: string, actor: CqaActor, existing: CqaResultRecord) {
  const updated = await updateRecord(CQA_RESULTS_COLLECTION, id, {
    reviewStatus: 'Approved',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeCqaResult(updated as unknown as Record<string, unknown>);
  await logCqaAudit('approve CQA result', id, actor, existing.reviewStatus, 'Approved', result.cqaResultId);
  return { result, error: null };
}

export async function bulkCreateCqaResults(
  rows: CqaResultFormData[],
  actor: CqaActor,
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error } = await createCqaResult(row, actor);
    if (error) errors.push(`${row.parameterName}: ${error}`);
    else created += 1;
  }
  if (created) await logCqaAudit('bulk CQA entry', 'bulk', actor, null, { count: created });
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

export async function fetchCqaAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logCqaExport(actor: CqaActor, count: number) {
  await logCqaAudit('export CQA list', 'export', actor, null, { count });
}

export function parameterTrendData(results: CqaResultRecord[], parameterName: string) {
  return results
    .filter((r) => r.parameterName === parameterName)
    .sort((a, b) => a.testDate.localeCompare(b.testDate))
    .map((r) => ({
      label: r.batchNumber,
      observed: Number(r.observedResult),
      target: r.targetValue,
      lsl: r.lowerLimit,
      usl: r.upperLimit,
      date: r.testDate,
    }));
}
