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
import { fetchUtilityRecords } from '@/lib/cpv-utility-monitoring-service';
import { fetchEnvironmentalRecords } from '@/lib/cpv-environmental-monitoring-service';
import { fetchHoldTimeRecords } from '@/lib/cpv-hold-time-monitoring-service';
import {
  CONTROL_CHARTS_COLLECTION,
  CONTROL_CHARTS_LEGACY,
  SPC_VIOLATIONS_COLLECTION,
  SPC_MODULE,
  buildSpcRecordId,
  calculateSpcAnalysis,
  dataSourceForParameterType,
  parameterTypeForDataSource,
  type SpcFormData,
  type SpcRecord,
  type SpcCalculationResult,
  type SpcSourcePoint,
  type SpcRuleViolationRecord,
} from '@/lib/cpv-spc-records';

export interface SpcActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: SpcActor) {
  return { moduleName: SPC_MODULE, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logSpcAudit(
  actionType: string,
  recordId: string,
  actor: SpcActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: SPC_MODULE,
    collectionName: CONTROL_CHARTS_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: CONTROL_CHARTS_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: SPC_MODULE,
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

function normalizeRecord(raw: Record<string, unknown>): SpcRecord {
  const productCode = str(raw.productCode || raw.product_code);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  const workflowStatuses = ['Draft', 'Generated', 'Under Review', 'Approved', 'Rejected', 'Archived'];
  const rawStatus = str(raw.status);

  return {
    id: str(raw.id),
    spcRecordId: str(raw.spcRecordId || raw.spc_record_id, buildSpcRecordId(productCode, parameterCode)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode,
    chartType: (str(raw.chartType || raw.chart_type, 'Individuals Chart') as SpcRecord['chartType']),
    dataSource: (str(raw.dataSource || raw.data_source, 'CPP Results') as SpcRecord['dataSource']),
    parameterType: (str(raw.parameterType || raw.parameter_type, 'CPP') as SpcRecord['parameterType']),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name),
    reviewPeriodFrom: str(raw.reviewPeriodFrom || raw.review_period_from),
    reviewPeriodTo: str(raw.reviewPeriodTo || raw.review_period_to),
    subgroupSize: num(raw.subgroupSize ?? raw.subgroup_size, 4),
    batchCount: num(raw.batchCount ?? raw.batch_count),
    dataPointsCount: num(raw.dataPointsCount ?? raw.data_points_count),
    centerLine: num(raw.centerLine ?? raw.center_line),
    upperControlLimit: num(raw.upperControlLimit ?? raw.upper_control_limit ?? raw.ucl),
    lowerControlLimit: num(raw.lowerControlLimit ?? raw.lower_control_limit ?? raw.lcl),
    upperSpecificationLimit: num(raw.upperSpecificationLimit ?? raw.upper_specification_limit ?? raw.usl),
    lowerSpecificationLimit: num(raw.lowerSpecificationLimit ?? raw.lower_specification_limit ?? raw.lsl),
    movingRangeAverage: num(raw.movingRangeAverage ?? raw.moving_range_average ?? raw.mrBar),
    averageRange: num(raw.averageRange ?? raw.average_range ?? raw.rBar),
    standardDeviation: num(raw.standardDeviation ?? raw.standard_deviation),
    spcStatus: (str(raw.spcStatus || raw.spc_status, 'Insufficient Data') as SpcRecord['spcStatus']),
    ruleViolationsCount: num(raw.ruleViolationsCount ?? raw.rule_violations_count),
    outOfControlPoints: num(raw.outOfControlPoints ?? raw.out_of_control_points),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low') as SpcRecord['riskLevel'],
    capaSuggested: Boolean(raw.capaSuggested || raw.capa_suggested),
    conclusion: str(raw.conclusion),
    recommendation: str(raw.recommendation),
    generatedBy: str(raw.generatedBy || raw.generated_by),
    generatedDate: str(raw.generatedDate || raw.generated_date || raw.createdAt),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    status: (workflowStatuses.includes(rawStatus)
      ? rawStatus
      : str(raw.workflowStatus, 'Generated')) as SpcRecord['status'],
    remarks: str(raw.remarks),
    linkedRiskId: str(raw.linkedRiskId || raw.linked_risk_id),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    chartData: Array.isArray(raw.chartData) ? raw.chartData as SpcRecord['chartData'] : [],
    movingRangeData: Array.isArray(raw.movingRangeData) ? raw.movingRangeData as SpcRecord['movingRangeData'] : [],
    xbarChartData: Array.isArray(raw.xbarChartData) ? raw.xbarChartData as SpcRecord['xbarChartData'] : [],
    rChartData: Array.isArray(raw.rChartData) ? raw.rChartData as SpcRecord['rChartData'] : [],
    violations: Array.isArray(raw.violations) ? raw.violations as SpcRuleViolationRecord[] : [],
    sourcePreview: Array.isArray(raw.sourcePreview) ? raw.sourcePreview as SpcSourcePoint[] : [],
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export async function fetchSpcRecords(max = 500): Promise<SpcRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: SpcRecord[] = [];
    try {
      primary = await getRecords<SpcRecord>(
        CONTROL_CHARTS_COLLECTION,
        [orderBy('generatedDate', 'desc'), limit(max)],
      );
    } catch {
      try {
        primary = await getRecords<SpcRecord>(
          CONTROL_CHARTS_COLLECTION,
          [orderBy('createdAt', 'desc'), limit(max)],
        );
      } catch {
        primary = await getRecords<SpcRecord>(CONTROL_CHARTS_COLLECTION, [limit(max)]);
      }
    }
    const normalized = primary.map((r) => normalizeRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const legacy of CONTROL_CHARTS_LEGACY) {
      const rows = await listCpvRecords<Record<string, unknown>>(legacy, max);
      if (rows.length) return rows.map((r) => normalizeRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.controlCharts, max);
    return cpvLegacy.map((r) => normalizeRecord(r));
  } catch (e) {
    console.error('fetchSpcRecords failed', e);
    return [];
  }
}

export async function fetchSpcRecordById(id: string): Promise<SpcRecord | null> {
  const record = await getRecord<SpcRecord>(CONTROL_CHARTS_COLLECTION, id);
  if (record) return normalizeRecord(record as unknown as Record<string, unknown>);
  const all = await fetchSpcRecords();
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

export async function fetchSpcSourceData(
  dataSource: string,
  productName: string,
  parameterName: string,
  from: string,
  to: string,
): Promise<SpcSourcePoint[]> {
  const points: SpcSourcePoint[] = [];
  try {
    if (dataSource === 'CPP Results') {
      const rows = await fetchCppResults(1000);
      rows.filter((r) => {
        const date = asDateString(r.observationDateTime, asDateString(r.manufacturingDate, r.createdAt));
        return r.productName === productName && r.parameterName === parameterName && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedValue);
        if (Number.isFinite(v)) {
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date: asDateString(r.observationDateTime, asDateString(r.manufacturingDate, r.createdAt)),
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
        return r.productName === productName && r.parameterName === parameterName && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedResult);
        if (Number.isFinite(v)) {
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date: asDateString(r.testDate, r.createdAt),
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
        points.push({
          batchNumber: r.batchNumber,
          value: r.yieldPercentage,
          date: asDateString(r.manufacturingDate, r.createdAt),
          lsl: r.lowerLimit,
          usl: r.upperLimit,
          target: r.targetYield,
        });
      });
    } else if (dataSource === 'Stability Monitoring') {
      const rows = await fetchStabilityResults(1000);
      rows.filter((r) => {
        const date = asDateString(r.testDate, r.createdAt);
        return r.productName === productName && r.parameterName === parameterName && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedResult);
        if (Number.isFinite(v)) {
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date: asDateString(r.testDate, r.createdAt),
            lsl: r.lowerLimit,
            usl: r.upperLimit,
            target: r.targetValue,
          });
        }
      });
    } else if (dataSource === 'Utility Monitoring') {
      const rows = await fetchUtilityRecords(1000);
      rows.filter((r) => {
        const date = asDateString(r.monitoringDate, r.createdAt);
        return r.productName === productName && r.parameterName === parameterName && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedValue);
        if (Number.isFinite(v)) {
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date: asDateString(r.monitoringDate, r.createdAt),
            lsl: r.lowerLimit,
            usl: r.upperLimit,
            target: r.targetValue,
          });
        }
      });
    } else if (dataSource === 'Environmental Monitoring') {
      const rows = await fetchEnvironmentalRecords(1000);
      rows.filter((r) => {
        const date = asDateString(r.monitoringDate, r.createdAt);
        return r.productName === productName && r.parameterName === parameterName && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedValue);
        if (Number.isFinite(v)) {
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date: asDateString(r.monitoringDate, r.createdAt),
            lsl: r.lowerLimit,
            usl: r.upperLimit,
            target: r.targetValue,
          });
        }
      });
    } else if (dataSource === 'Hold Time Monitoring') {
      const rows = await fetchHoldTimeRecords(1000);
      rows.filter((r) => {
        const date = asDateString(r.manufacturingDate, r.createdAt);
        return r.productName === productName
          && (r.holdStage === parameterName || parameterName.includes('Hold'))
          && inPeriod(date, from, to);
      }).forEach((r) => {
        points.push({
          batchNumber: r.batchNumber,
          value: r.actualHoldTime,
          date: asDateString(r.manufacturingDate, r.createdAt),
          lsl: 0,
          usl: r.allowedHoldTime,
        });
      });
    }
  } catch (e) {
    console.error('fetchSpcSourceData failed', e);
  }
  return points;
}

export function previewSpcCalculation(
  form: SpcFormData,
  sourceData: SpcSourcePoint[],
): SpcCalculationResult {
  const spcId = buildSpcRecordId(form.productCode, form.parameterCode);
  return calculateSpcAnalysis(sourceData, form, spcId);
}

async function saveViolations(
  spcRecordId: string,
  violations: SpcRuleViolationRecord[],
  actor: SpcActor,
): Promise<void> {
  if (!isFirebaseConfigured() || !violations.length) return;
  try {
    const now = new Date().toISOString();
    for (const v of violations) {
      await addDoc(collection(getFirebaseFirestore(), SPC_VIOLATIONS_COLLECTION), {
        ...v,
        spcRecordId,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.id,
        updatedBy: actor.id,
        isDeleted: false,
      });
    }
  } catch (e) {
    console.error('saveViolations failed', e);
  }
}

async function maybeCreateRiskAndAlert(record: SpcRecord, actor: SpcActor): Promise<string> {
  let riskId = '';
  const needsRisk = record.spcStatus === 'Out Of Control' || record.spcStatus === 'Warning';
  if (needsRisk) {
    try {
      const { createRisk } = await import('@/lib/cpv-service');
      const risk = await createRisk({
        productName: record.productName,
        batchNo: '',
        factor: record.parameterName,
        riskDescription: `SPC ${record.spcStatus} for ${record.parameterName}`,
        occurrence: record.outOfControlPoints > 0 ? 4 : 3,
        severity: record.riskLevel === 'Critical' ? 5 : record.riskLevel === 'High' ? 4 : 3,
        detectability: 3,
        mitigation: 'Review control chart and investigate special cause variation.',
        owner: actor.name,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, 0);
      if (risk) riskId = String((risk as { id?: string }).id || '');
      await logSpcAudit('risk created', record.id, actor, null, riskId, record.spcRecordId);
    } catch { /* optional */ }
  }
  if (record.capaSuggested || record.outOfControlPoints > 0) {
    try {
      await createAlert({
        alertType: record.outOfControlPoints > 0 ? 'OOT' : 'Trend Deteriorating',
        severity: record.riskLevel === 'Critical' ? 'Critical' : 'High',
        module: SPC_MODULE,
        productName: record.productName,
        batchNo: '',
        parameterName: record.parameterName,
        message: `SPC ${record.spcStatus}: ${record.ruleViolationsCount} violations`,
        observedValue: record.centerLine,
        recordId: record.id,
      }, { id: actor.id, name: actor.name, role: actor.role });
      await logSpcAudit('CAPA suggested', record.id, actor, null, { violations: record.ruleViolationsCount }, record.spcRecordId);
    } catch { /* optional */ }
    if (isFirebaseConfigured()) {
      try {
        await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
          title: 'SPC Alert',
          message: `${record.parameterName}: ${record.spcStatus}`,
          module: SPC_MODULE,
          record_id: record.id,
          target_roles: ['qa', 'cpv'],
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch { /* optional */ }
    }
  }
  return riskId;
}

export async function createSpcRecord(
  form: SpcFormData,
  sourceData: SpcSourcePoint[],
  actor: SpcActor,
): Promise<{ result: SpcRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(form.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive product — SPC generation not allowed.' };

    const spcRecordId = buildSpcRecordId(form.productCode, form.parameterCode);
    const calc = calculateSpcAnalysis(sourceData, form, spcRecordId);
    if (calc.dataPointsCount < 5) return { result: null, error: 'At least 5 numeric data points required for SPC.' };

    const today = new Date().toISOString().split('T')[0];
    const payload = {
      ...form,
      spcRecordId,
      batchCount: calc.batchCount,
      dataPointsCount: calc.dataPointsCount,
      centerLine: calc.centerLine,
      upperControlLimit: calc.upperControlLimit,
      lowerControlLimit: calc.lowerControlLimit,
      upperSpecificationLimit: calc.upperSpecificationLimit,
      lowerSpecificationLimit: calc.lowerSpecificationLimit,
      movingRangeAverage: calc.movingRangeAverage,
      averageRange: calc.averageRange,
      standardDeviation: calc.standardDeviation,
      spcStatus: calc.spcStatus,
      ruleViolationsCount: calc.ruleViolationsCount,
      outOfControlPoints: calc.outOfControlPoints,
      riskLevel: calc.riskLevel,
      capaSuggested: calc.capaSuggested,
      generatedBy: actor.name,
      generatedDate: today,
      status: 'Generated' as const,
      isLocked: false,
      linkedRiskId: '',
      chartData: calc.chartData,
      movingRangeData: calc.movingRangeData,
      xbarChartData: calc.xbarChartData,
      rChartData: calc.rChartData,
      violations: calc.violations,
      sourcePreview: sourceData.slice(0, 50),
      reviewedBy: '',
      reviewDate: '',
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      CONTROL_CHARTS_COLLECTION,
      payload as Omit<SpcRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeRecord(created as unknown as Record<string, unknown>);

    await saveViolations(result.id, calc.violations.map((v) => ({ ...v, spcRecordId: result.id })), actor);

    const riskId = await maybeCreateRiskAndAlert(result, actor);
    if (riskId) {
      const updated = await updateRecord(CONTROL_CHARTS_COLLECTION, result.id, { linkedRiskId: riskId }, actorCtx(actor));
      if (updated) result = normalizeRecord(updated as unknown as Record<string, unknown>);
    }

    await logSpcAudit('generate SPC chart', result.id, actor, null, result, result.spcRecordId);
    await logSpcAudit('control limit calculation', result.id, actor, null, calc, result.spcRecordId);
    if (calc.violations.length) {
      await logSpcAudit('rule violation detected', result.id, actor, null, calc.violations.length, result.spcRecordId);
    }
    return { result, error: null };
  } catch (e) {
    console.error('createSpcRecord failed', e);
    return { result: null, error: 'Failed to save SPC record.' };
  }
}

export async function regenerateSpcRecord(
  id: string,
  actor: SpcActor,
  existing: SpcRecord,
  qaOverride = false,
): Promise<{ result: SpcRecord | null; error: string | null }> {
  if (existing.isLocked && existing.status === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved record is locked. QA override required.' };
  }
  try {
    const sourceData = await fetchSpcSourceData(
      existing.dataSource,
      existing.productName,
      existing.parameterName,
      existing.reviewPeriodFrom,
      existing.reviewPeriodTo,
    );
    const calc = calculateSpcAnalysis(sourceData, existing as SpcFormData, existing.spcRecordId);
    if (calc.dataPointsCount < 5) {
      return { result: null, error: 'At least 5 numeric data points required for SPC.' };
    }
    const updates = {
      batchCount: calc.batchCount,
      dataPointsCount: calc.dataPointsCount,
      centerLine: calc.centerLine,
      upperControlLimit: calc.upperControlLimit,
      lowerControlLimit: calc.lowerControlLimit,
      upperSpecificationLimit: calc.upperSpecificationLimit,
      lowerSpecificationLimit: calc.lowerSpecificationLimit,
      movingRangeAverage: calc.movingRangeAverage,
      averageRange: calc.averageRange,
      standardDeviation: calc.standardDeviation,
      spcStatus: calc.spcStatus,
      ruleViolationsCount: calc.ruleViolationsCount,
      outOfControlPoints: calc.outOfControlPoints,
      riskLevel: calc.riskLevel,
      capaSuggested: calc.capaSuggested,
      chartData: calc.chartData,
      movingRangeData: calc.movingRangeData,
      xbarChartData: calc.xbarChartData,
      rChartData: calc.rChartData,
      violations: calc.violations,
      sourcePreview: sourceData.slice(0, 50),
      status: 'Generated' as const,
      isLocked: qaOverride ? false : existing.isLocked,
      generatedBy: actor.name,
      generatedDate: new Date().toISOString().split('T')[0],
      updatedByName: actor.name,
    };
    const updated = await updateRecord(CONTROL_CHARTS_COLLECTION, id, updates as Partial<SpcRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeRecord(updated as unknown as Record<string, unknown>);
    await saveViolations(result.id, calc.violations.map((v) => ({ ...v, spcRecordId: result.id })), actor);
    await logSpcAudit(qaOverride ? 'QA override' : 're-generate SPC chart', id, actor, existing, result, result.spcRecordId);
    return { result, error: null };
  } catch (e) {
    console.error('regenerateSpcRecord failed', e);
    return { result: null, error: 'Regeneration failed.' };
  }
}

export async function reviewSpcRecord(id: string, actor: SpcActor, existing: SpcRecord) {
  const updated = await updateRecord(CONTROL_CHARTS_COLLECTION, id, {
    status: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logSpcAudit('review SPC', id, actor, existing.status, 'Under Review', result.spcRecordId);
  return { result, error: null };
}

export async function approveSpcRecord(id: string, actor: SpcActor, existing: SpcRecord, qaOverride = false) {
  if (existing.isLocked && existing.status === 'Approved' && !qaOverride) {
    return { result: null, error: 'Already approved.' };
  }
  const updated = await updateRecord(CONTROL_CHARTS_COLLECTION, id, {
    status: 'Approved',
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logSpcAudit(qaOverride ? 'QA override' : 'approve SPC', id, actor, existing.status, 'Approved', result.spcRecordId);
  return { result, error: null };
}

export async function rejectSpcRecord(id: string, actor: SpcActor, existing: SpcRecord) {
  const updated = await updateRecord(CONTROL_CHARTS_COLLECTION, id, {
    status: 'Rejected',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logSpcAudit('reject SPC', id, actor, existing.status, 'Rejected', result.spcRecordId);
  return { result, error: null };
}

export async function fetchSpcAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logSpcExport(actor: SpcActor, type: string, count: number) {
  await logSpcAudit(`export SPC ${type}`, 'export', actor, null, { type, count });
}

export async function fetchParametersForSpc(dataSource: string, productName: string): Promise<string[]> {
  const names = new Set<string>();
  try {
    if (dataSource === 'CPP Results') {
      const rows = await fetchCppResults(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (dataSource === 'CQA Results') {
      const rows = await fetchCqaResults(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (dataSource === 'Yield Monitoring') {
      const rows = await fetchYieldRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.yieldStage));
    } else if (dataSource === 'Stability Monitoring') {
      const rows = await fetchStabilityResults(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (dataSource === 'Utility Monitoring') {
      const rows = await fetchUtilityRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (dataSource === 'Environmental Monitoring') {
      const rows = await fetchEnvironmentalRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.parameterName));
    } else if (dataSource === 'Hold Time Monitoring') {
      const rows = await fetchHoldTimeRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.holdStage));
    }
  } catch { /* optional */ }
  return Array.from(names).filter(Boolean).sort();
}

export async function previewSpcSourceData(
  form: SpcFormData,
  actor: SpcActor,
): Promise<SpcSourcePoint[]> {
  const data = await fetchSpcSourceData(
    form.dataSource,
    form.productName,
    form.parameterName,
    form.reviewPeriodFrom,
    form.reviewPeriodTo,
  );
  await logSpcAudit('source data preview', 'preview', actor, null, {
    product: form.productName,
    parameter: form.parameterName,
    count: data.length,
  }, form.productCode);
  return data;
}

export { dataSourceForParameterType, parameterTypeForDataSource };
