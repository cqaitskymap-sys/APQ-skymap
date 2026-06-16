import {
  addDoc, collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { getFirebaseFirestore, isFirebaseConfigured } from '@/lib/firebase';
import { createRecord, getRecord, getRecords, updateRecord, type DocumentActor } from '@/lib/firestore';
import { createAuditLog, writeAuditTrail } from '@/lib/audit-trail';
import { fetchCpvProductById } from '@/lib/cpv-product-master-service';
import { listCpvRecords } from '@/lib/cpv-service';
import { CPV_COLLECTIONS } from '@/lib/cpv';
import { createAlert } from '@/lib/cpv-module-service';
import { fetchCppResults } from '@/lib/cpv-cpp-monitoring-service';
import { fetchCqaResults } from '@/lib/cpv-cqa-monitoring-service';
import { fetchYieldRecords } from '@/lib/cpv-yield-monitoring-service';
import { fetchStabilityResults } from '@/lib/cpv-stability-monitoring-service';
import {
  PROCESS_CAPABILITY_COLLECTION,
  PROCESS_CAPABILITY_LEGACY,
  PROCESS_CAPABILITY_MODULE,
  buildCapabilityId,
  calculateProcessCapability,
  evaluateCapabilityRisk,
  dataSourceForType,
  type ProcessCapabilityFormData,
  type ProcessCapabilityRecord,
  type CapabilityCalculationResult,
} from '@/lib/cpv-process-capability';

export interface ProcessCapabilityActor {
  id: string;
  name: string;
  role?: string;
}

export interface SourceDataPoint {
  batchNumber: string;
  value: number;
  date: string;
  lsl?: number;
  usl?: number;
  target?: number;
}

function actorCtx(actor: ProcessCapabilityActor) {
  return { moduleName: PROCESS_CAPABILITY_MODULE, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logCapabilityAudit(
  actionType: string,
  recordId: string,
  actor: ProcessCapabilityActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: PROCESS_CAPABILITY_MODULE,
    collectionName: PROCESS_CAPABILITY_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: PROCESS_CAPABILITY_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: PROCESS_CAPABILITY_MODULE,
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

function normalizeRecord(raw: Record<string, unknown>): ProcessCapabilityRecord {
  const productCode = str(raw.productCode || raw.product_code);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  const rawStatus = str(raw.status);
  const workflowStatuses = ['Draft', 'Calculated', 'Under Review', 'Approved', 'Rejected', 'Archived'];
  const capabilityStatus = str(raw.capabilityStatus || raw.capability_status)
    || (workflowStatuses.includes(rawStatus) ? 'Insufficient Data' : rawStatus || 'Insufficient Data');
  return {
    id: str(raw.id),
    capabilityId: str(raw.capabilityId || raw.capability_id, buildCapabilityId(productCode, parameterCode)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode,
    parameterType: (str(raw.parameterType || raw.parameter_type, 'CPP') as ProcessCapabilityRecord['parameterType']),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name || raw.parameter),
    dataSource: (str(raw.dataSource || raw.data_source, 'CPP Results') as ProcessCapabilityRecord['dataSource']),
    reviewPeriodFrom: str(raw.reviewPeriodFrom || raw.review_period_from),
    reviewPeriodTo: str(raw.reviewPeriodTo || raw.review_period_to),
    batchCount: num(raw.batchCount ?? raw.batch_count),
    sampleCount: num(raw.sampleCount ?? raw.sample_count ?? raw.count),
    lowerSpecificationLimit: num(raw.lowerSpecificationLimit ?? raw.lower_specification_limit ?? raw.lsl),
    upperSpecificationLimit: num(raw.upperSpecificationLimit ?? raw.upper_specification_limit ?? raw.usl),
    targetValue: num(raw.targetValue ?? raw.target_value ?? raw.target),
    mean: num(raw.mean),
    median: num(raw.median),
    minimumValue: num(raw.minimumValue ?? raw.minimum_value ?? raw.min),
    maximumValue: num(raw.maximumValue ?? raw.maximum_value ?? raw.max),
    range: num(raw.range),
    variance: num(raw.variance),
    standardDeviation: num(raw.standardDeviation ?? raw.standard_deviation ?? raw.stdDev),
    cp: num(raw.cp),
    cpk: num(raw.cpk ?? raw.Cpk),
    cpu: num(raw.cpu),
    cpl: num(raw.cpl),
    pp: num(raw.pp),
    ppk: num(raw.ppk ?? raw.Ppk),
    sigmaLevel: num(raw.sigmaLevel ?? raw.sigma_level),
    capabilityStatus,
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low'),
    conclusion: str(raw.conclusion),
    recommendation: str(raw.recommendation),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    approvedBy: str(raw.approvedBy || raw.approved_by),
    approvalDate: str(raw.approvalDate || raw.approval_date),
    status: (workflowStatuses.includes(rawStatus)
      ? rawStatus
      : str(raw.workflowStatus || raw.workflow_status || raw.recordStatus, 'Calculated')) as ProcessCapabilityRecord['status'],
    remarks: str(raw.remarks),
    capaRecommended: Boolean(raw.capaRecommended || raw.capa_recommended),
    linkedRiskId: str(raw.linkedRiskId || raw.linked_risk_id),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    sourcePreview: Array.isArray(raw.sourcePreview) ? raw.sourcePreview as number[] : [],
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export async function fetchProcessCapabilityRecords(max = 500): Promise<ProcessCapabilityRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: ProcessCapabilityRecord[] = [];
    try {
      primary = await getRecords<ProcessCapabilityRecord>(
        PROCESS_CAPABILITY_COLLECTION,
        [orderBy('reviewDate', 'desc'), limit(max)],
      );
    } catch {
      try {
        primary = await getRecords<ProcessCapabilityRecord>(
          PROCESS_CAPABILITY_COLLECTION,
          [orderBy('createdAt', 'desc'), limit(max)],
        );
      } catch {
        primary = await getRecords<ProcessCapabilityRecord>(PROCESS_CAPABILITY_COLLECTION, [limit(max)]);
      }
    }
    const normalized = primary.map((r) => normalizeRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) {
      return normalized.sort((a, b) =>
        (b.reviewDate || b.reviewPeriodTo || b.createdAt).localeCompare(
          a.reviewDate || a.reviewPeriodTo || a.createdAt,
        ),
      );
    }
    for (const legacy of PROCESS_CAPABILITY_LEGACY) {
      const rows = await listCpvRecords<Record<string, unknown>>(legacy, max);
      if (rows.length) return rows.map((r) => normalizeRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.capability, max);
    return cpvLegacy.map((r) => normalizeRecord(r));
  } catch (e) {
    console.error('fetchProcessCapabilityRecords failed', e);
    return [];
  }
}

export async function fetchProcessCapabilityById(id: string): Promise<ProcessCapabilityRecord | null> {
  const record = await getRecord<ProcessCapabilityRecord>(PROCESS_CAPABILITY_COLLECTION, id);
  if (record) return normalizeRecord(record as unknown as Record<string, unknown>);
  const all = await fetchProcessCapabilityRecords();
  return all.find((r) => r.id === id) ?? null;
}

function inPeriod(dateStr: string, from: string, to: string): boolean {
  const d = new Date(dateStr);
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(d.getTime())) return false;
  return d >= f && d <= t;
}

function asDateString(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

export async function fetchCapabilitySourceData(
  dataSource: string,
  productName: string,
  parameterName: string,
  from: string,
  to: string,
): Promise<SourceDataPoint[]> {
  const points: SourceDataPoint[] = [];
  try {
    if (dataSource === 'CPP Results') {
      const rows = await fetchCppResults(1000);
      rows.filter((r) => {
        const date = asDateString(r.observationDateTime, asDateString(r.manufacturingDate, r.createdAt));
        return r.productName === productName
          && r.parameterName === parameterName
          && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedValue);
        if (Number.isFinite(v)) {
          const date = asDateString(r.observationDateTime, asDateString(r.manufacturingDate, r.createdAt));
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date,
            lsl: r.lowerLimit,
            usl: r.upperLimit,
            target: r.targetValue,
          });
        }
      });
    } else if (dataSource === 'CQA Results') {
      const rows = await fetchCqaResults(1000);
      rows.filter((r) => {
        const date = asDateString(r.testDate, r.createdAt);
        return r.productName === productName
          && r.parameterName === parameterName
          && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedResult);
        if (Number.isFinite(v)) {
          const date = asDateString(r.testDate, r.createdAt);
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date,
            lsl: r.lowerLimit,
            usl: r.upperLimit,
            target: r.targetValue,
          });
        }
      });
    } else if (dataSource === 'Yield Monitoring') {
      const rows = await fetchYieldRecords(1000);
      rows.filter((r) => {
        const date = asDateString(r.manufacturingDate, r.createdAt);
        return r.productName === productName
          && (r.yieldStage === parameterName || parameterName.includes('Yield'))
          && inPeriod(date, from, to);
      }).forEach((r) => {
        const date = asDateString(r.manufacturingDate, r.createdAt);
        points.push({
          batchNumber: r.batchNumber,
          value: r.yieldPercentage,
          date,
          lsl: r.lowerLimit,
          usl: r.upperLimit,
          target: r.targetYield,
        });
      });
    } else if (dataSource === 'Stability Monitoring') {
      const rows = await fetchStabilityResults(1000);
      rows.filter((r) => {
        const date = asDateString(r.testDate, r.createdAt);
        return r.productName === productName
          && r.parameterName === parameterName
          && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedResult);
        if (Number.isFinite(v)) {
          const date = asDateString(r.testDate, r.createdAt);
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date,
            lsl: r.lowerLimit,
            usl: r.upperLimit,
            target: r.targetValue,
          });
        }
      });
    }
  } catch (e) {
    console.error('fetchCapabilitySourceData failed', e);
  }
  return points;
}

export function previewCapabilityCalculation(
  form: ProcessCapabilityFormData,
  sourceData: SourceDataPoint[],
): CapabilityCalculationResult & { lsl: number; usl: number } {
  const lsl = form.lowerSpecificationLimit;
  const usl = form.upperSpecificationLimit;
  const batches = sourceData.map((p) => p.batchNumber);
  const values = sourceData.map((p) => p.value);
  const calc = calculateProcessCapability(values, lsl, usl, batches, form.parameterType, form.parameterName);
  const riskLevel = evaluateCapabilityRisk(calc.capabilityStatus, form.parameterType, form.parameterName);
  return { ...calc, riskLevel, lsl, usl };
}

async function maybeCreateRiskAndAlert(
  record: ProcessCapabilityRecord,
  actor: ProcessCapabilityActor,
): Promise<string> {
  let riskId = '';
  if (record.cpk < 1.33 && record.capabilityStatus !== 'Insufficient Data') {
    try {
      const { createRisk } = await import('@/lib/cpv-service');
      const risk = await createRisk({
        productName: record.productName,
        batchNo: '',
        factor: record.parameterName,
        riskDescription: `Low capability Cpk ${record.cpk} for ${record.parameterName}`,
        occurrence: record.cpk < 1.0 ? 4 : 3,
        severity: record.riskLevel === 'Critical' ? 5 : 4,
        detectability: 3,
        mitigation: 'Review process capability and implement corrective actions.',
        owner: actor.name,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, 0);
      if (risk) riskId = String((risk as { id?: string }).id || '');
      await logCapabilityAudit('risk created', record.id, actor, null, riskId, record.capabilityId);
    } catch { /* optional */ }
  }
  if (record.cpk < 1.0) {
    try {
      await createAlert({
        alertType: 'Cpk Low',
        severity: record.riskLevel === 'Critical' ? 'Critical' : 'High',
        module: PROCESS_CAPABILITY_MODULE,
        productName: record.productName,
        batchNo: '',
        parameterName: record.parameterName,
        message: `Cpk ${record.cpk} below 1.00 for ${record.parameterName}`,
        observedValue: record.cpk,
        recordId: record.id,
      }, { id: actor.id, name: actor.name, role: actor.role });
      await logCapabilityAudit('CAPA recommended', record.id, actor, null, { cpk: record.cpk }, record.capabilityId);
    } catch { /* optional */ }
    if (!isFirebaseConfigured()) return riskId;
    try {
      await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
        title: 'Low Process Capability',
        message: `${record.parameterName} Cpk ${record.cpk}`,
        module: PROCESS_CAPABILITY_MODULE,
        record_id: record.id,
        target_roles: ['qa', 'cpv'],
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch { /* optional */ }
  }
  return riskId;
}

export async function createProcessCapability(
  form: ProcessCapabilityFormData,
  sourceData: SourceDataPoint[],
  actor: ProcessCapabilityActor,
): Promise<{ result: ProcessCapabilityRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(form.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive product — calculation not allowed.' };

    const calc = previewCapabilityCalculation(form, sourceData);
    if (calc.sampleCount < 5) return { result: null, error: 'At least 5 numeric values required for calculation.' };

    const payload = {
      ...form,
      dataSource: form.dataSource || dataSourceForType(form.parameterType),
      capabilityId: buildCapabilityId(form.productCode, form.parameterCode),
      batchCount: calc.batchCount,
      sampleCount: calc.sampleCount,
      mean: calc.mean,
      median: calc.median,
      minimumValue: calc.minimumValue,
      maximumValue: calc.maximumValue,
      range: calc.range,
      variance: calc.variance,
      standardDeviation: calc.standardDeviation,
      cp: calc.cp,
      cpk: calc.cpk,
      cpu: calc.cpu,
      cpl: calc.cpl,
      pp: calc.pp,
      ppk: calc.ppk,
      sigmaLevel: calc.sigmaLevel,
      capabilityStatus: calc.capabilityStatus,
      riskLevel: calc.riskLevel,
      capaRecommended: calc.capaRecommended,
      status: 'Calculated' as const,
      isLocked: false,
      linkedRiskId: '',
      sourcePreview: calc.values.slice(0, 50),
      reviewedBy: '',
      reviewDate: '',
      approvedBy: '',
      approvalDate: '',
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      PROCESS_CAPABILITY_COLLECTION,
      payload as Omit<ProcessCapabilityRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeRecord(created as unknown as Record<string, unknown>);

    const riskId = await maybeCreateRiskAndAlert(result, actor);
    if (riskId) {
      const updated = await updateRecord(PROCESS_CAPABILITY_COLLECTION, result.id, { linkedRiskId: riskId }, actorCtx(actor));
      if (updated) result = normalizeRecord(updated as unknown as Record<string, unknown>);
    }

    await logCapabilityAudit('create capability calculation', result.id, actor, null, result, result.capabilityId);
    await logCapabilityAudit('statistics calculated', result.id, actor, null, calc, result.capabilityId);
    return { result, error: null };
  } catch (e) {
    console.error('createProcessCapability failed', e);
    return { result: null, error: 'Failed to save capability calculation.' };
  }
}

export async function recalculateProcessCapability(
  id: string,
  actor: ProcessCapabilityActor,
  existing: ProcessCapabilityRecord,
  qaOverride = false,
): Promise<{ result: ProcessCapabilityRecord | null; error: string | null }> {
  if (existing.isLocked && existing.status === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved record is locked. QA override required.' };
  }
  try {
    const sourceData = await fetchCapabilitySourceData(
      existing.dataSource,
      existing.productName,
      existing.parameterName,
      existing.reviewPeriodFrom,
      existing.reviewPeriodTo,
    );
    const form = existing as ProcessCapabilityFormData;
    const calc = previewCapabilityCalculation(form, sourceData);
    const updates = {
      ...calc,
      capabilityStatus: calc.capabilityStatus,
      riskLevel: calc.riskLevel,
      capaRecommended: calc.capaRecommended,
      batchCount: calc.batchCount,
      sampleCount: calc.sampleCount,
      status: 'Calculated',
      sourcePreview: calc.values.slice(0, 50),
      updatedByName: actor.name,
    };
    const updated = await updateRecord(PROCESS_CAPABILITY_COLLECTION, id, updates as Partial<ProcessCapabilityRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeRecord(updated as unknown as Record<string, unknown>);
    await logCapabilityAudit(qaOverride ? 'QA override' : 'recalculate capability', id, actor, existing, result, result.capabilityId);
    return { result, error: null };
  } catch (e) {
    console.error('recalculateProcessCapability failed', e);
    return { result: null, error: 'Recalculation failed.' };
  }
}

export async function reviewProcessCapability(id: string, actor: ProcessCapabilityActor, existing: ProcessCapabilityRecord) {
  const updated = await updateRecord(PROCESS_CAPABILITY_COLLECTION, id, {
    status: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logCapabilityAudit('review capability', id, actor, existing.status, 'Under Review', result.capabilityId);
  return { result, error: null };
}

export async function approveProcessCapability(id: string, actor: ProcessCapabilityActor, existing: ProcessCapabilityRecord, qaOverride = false) {
  if (existing.isLocked && existing.status === 'Approved' && !qaOverride) {
    return { result: null, error: 'Already approved.' };
  }
  const updated = await updateRecord(PROCESS_CAPABILITY_COLLECTION, id, {
    status: 'Approved',
    approvedBy: actor.name,
    approvalDate: new Date().toISOString().split('T')[0],
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logCapabilityAudit(qaOverride ? 'QA override' : 'approve capability', id, actor, existing.status, 'Approved', result.capabilityId);
  return { result, error: null };
}

export async function rejectProcessCapability(id: string, actor: ProcessCapabilityActor, existing: ProcessCapabilityRecord) {
  const updated = await updateRecord(PROCESS_CAPABILITY_COLLECTION, id, {
    status: 'Rejected',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logCapabilityAudit('reject capability', id, actor, existing.status, 'Rejected', result.capabilityId);
  return { result, error: null };
}

export async function fetchProcessCapabilityAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logProcessCapabilityExport(actor: ProcessCapabilityActor, count: number) {
  await logCapabilityAudit('export capability report', 'export', actor, null, { count });
}

export async function fetchParametersForProduct(
  parameterType: string,
  productName: string,
): Promise<string[]> {
  const names = new Set<string>();
  try {
    if (parameterType === 'CPP') {
      const rows = await fetchCppResults(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (parameterType === 'CQA') {
      const rows = await fetchCqaResults(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (parameterType === 'Yield') {
      const rows = await fetchYieldRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.yieldStage));
    } else if (parameterType === 'Stability') {
      const rows = await fetchStabilityResults(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    }
  } catch { /* optional */ }
  return Array.from(names).sort();
}
