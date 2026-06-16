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
import { fetchRawMaterialRecords } from '@/lib/cpv-raw-material-monitoring-service';
import { fetchPackingMaterialRecords } from '@/lib/cpv-packing-material-monitoring-service';
import { fetchUtilityRecords } from '@/lib/cpv-utility-monitoring-service';
import { fetchEnvironmentalRecords } from '@/lib/cpv-environmental-monitoring-service';
import { fetchHoldTimeRecords } from '@/lib/cpv-hold-time-monitoring-service';
import {
  TREND_ANALYSIS_COLLECTION,
  TREND_ANALYSIS_LEGACY,
  TREND_ANALYSIS_MODULE,
  buildTrendId,
  calculateTrendAnalysis,
  dataSourceForParameterType,
  trendTypeForDataSource,
  parameterTypeForDataSource,
  type TrendAnalysisFormData,
  type TrendAnalysisRecord,
  type TrendCalculationResult,
  type TrendSourcePoint,
} from '@/lib/cpv-trend-records';

export interface TrendAnalysisActor {
  id: string;
  name: string;
  role?: string;
}

function actorCtx(actor: TrendAnalysisActor) {
  return { moduleName: TREND_ANALYSIS_MODULE, actor: { id: actor.id, name: actor.name } as DocumentActor };
}

async function logTrendAudit(
  actionType: string,
  recordId: string,
  actor: TrendAnalysisActor,
  oldVal?: unknown,
  newVal?: unknown,
  docNo?: string,
) {
  await createAuditLog({
    moduleName: TREND_ANALYSIS_MODULE,
    collectionName: TREND_ANALYSIS_COLLECTION,
    recordId,
    documentNumber: docNo,
    actionType,
    oldValue: oldVal,
    newValue: newVal,
    user: { id: actor.id, name: actor.name },
    status: 'Success',
  });
  await writeAuditTrail({
    collectionName: TREND_ANALYSIS_COLLECTION,
    documentId: recordId,
    action: actionType,
    oldValue: oldVal,
    newValue: newVal,
    userId: actor.id,
    userName: actor.name,
    moduleName: TREND_ANALYSIS_MODULE,
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

function normalizeRecord(raw: Record<string, unknown>): TrendAnalysisRecord {
  const productCode = str(raw.productCode || raw.product_code);
  const parameterCode = str(raw.parameterCode || raw.parameter_code, 'PARAM');
  const workflowStatuses = ['Draft', 'Generated', 'Under Review', 'Approved', 'Rejected', 'Archived'];
  const rawStatus = str(raw.status);
  const chartData = Array.isArray(raw.chartData) ? raw.chartData as TrendAnalysisRecord['chartData'] : [];
  const sourcePreview = Array.isArray(raw.sourcePreview) ? raw.sourcePreview as TrendSourcePoint[] : [];

  return {
    id: str(raw.id),
    trendId: str(raw.trendId || raw.trend_id, buildTrendId(productCode, parameterCode)),
    cpvProductId: str(raw.cpvProductId || raw.cpv_product_id),
    productName: str(raw.productName || raw.product_name),
    productCode,
    trendType: (str(raw.trendType || raw.trend_type, 'CPP Trend') as TrendAnalysisRecord['trendType']),
    dataSource: (str(raw.dataSource || raw.data_source, 'CPP Results') as TrendAnalysisRecord['dataSource']),
    parameterType: (str(raw.parameterType || raw.parameter_type, 'CPP') as TrendAnalysisRecord['parameterType']),
    parameterCode,
    parameterName: str(raw.parameterName || raw.parameter_name || raw.parameter),
    reviewPeriodFrom: str(raw.reviewPeriodFrom || raw.review_period_from),
    reviewPeriodTo: str(raw.reviewPeriodTo || raw.review_period_to),
    batchCount: num(raw.batchCount ?? raw.batch_count),
    dataPointsCount: num(raw.dataPointsCount ?? raw.data_points_count ?? raw.count),
    mean: num(raw.mean),
    minimumValue: num(raw.minimumValue ?? raw.minimum_value ?? raw.min),
    maximumValue: num(raw.maximumValue ?? raw.maximum_value ?? raw.max),
    standardDeviation: num(raw.standardDeviation ?? raw.standard_deviation ?? raw.stdDev),
    trendDirection: (str(raw.trendDirection || raw.trend_direction, 'No Data') as TrendAnalysisRecord['trendDirection']),
    trendStatus: (str(raw.trendStatus || raw.trend_status, 'Insufficient Data') as TrendAnalysisRecord['trendStatus']),
    riskLevel: str(raw.riskLevel || raw.risk_level, 'Low') as TrendAnalysisRecord['riskLevel'],
    ootCount: num(raw.ootCount ?? raw.oot_count),
    oosCount: num(raw.oosCount ?? raw.oos_count),
    alertCount: num(raw.alertCount ?? raw.alert_count),
    actionCount: num(raw.actionCount ?? raw.action_count),
    capaSuggested: Boolean(raw.capaSuggested || raw.capa_suggested),
    conclusion: str(raw.conclusion),
    recommendation: str(raw.recommendation),
    generatedBy: str(raw.generatedBy || raw.generated_by),
    generatedDate: str(raw.generatedDate || raw.generated_date || raw.createdAt),
    reviewedBy: str(raw.reviewedBy || raw.reviewed_by),
    reviewDate: str(raw.reviewDate || raw.review_date),
    status: (workflowStatuses.includes(rawStatus)
      ? rawStatus
      : str(raw.workflowStatus || raw.workflow_status, 'Generated')) as TrendAnalysisRecord['status'],
    remarks: str(raw.remarks),
    linkedRiskId: str(raw.linkedRiskId || raw.linked_risk_id),
    isLocked: Boolean(raw.isLocked || raw.is_locked),
    chartData,
    sourcePreview,
    createdAt: str(raw.createdAt || raw.created_at),
    updatedAt: str(raw.updatedAt || raw.updated_at),
    createdBy: str(raw.createdBy || raw.created_by),
    updatedBy: str(raw.updatedBy || raw.updated_by),
    createdByName: str(raw.createdByName),
    updatedByName: str(raw.updatedByName),
    isDeleted: Boolean(raw.isDeleted),
  };
}

export async function fetchTrendAnalysisRecords(max = 500): Promise<TrendAnalysisRecord[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    let primary: TrendAnalysisRecord[] = [];
    try {
      primary = await getRecords<TrendAnalysisRecord>(
        TREND_ANALYSIS_COLLECTION,
        [orderBy('generatedDate', 'desc'), limit(max)],
      );
    } catch {
      try {
        primary = await getRecords<TrendAnalysisRecord>(
          TREND_ANALYSIS_COLLECTION,
          [orderBy('createdAt', 'desc'), limit(max)],
        );
      } catch {
        primary = await getRecords<TrendAnalysisRecord>(TREND_ANALYSIS_COLLECTION, [limit(max)]);
      }
    }
    const normalized = primary.map((r) => normalizeRecord(r as unknown as Record<string, unknown>));
    if (normalized.length) return normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const legacy of TREND_ANALYSIS_LEGACY) {
      const rows = await listCpvRecords<Record<string, unknown>>(legacy, max);
      if (rows.length) return rows.map((r) => normalizeRecord(r));
    }
    const cpvLegacy = await listCpvRecords<Record<string, unknown>>(CPV_COLLECTIONS.trends, max);
    return cpvLegacy.map((r) => normalizeRecord(r));
  } catch (e) {
    console.error('fetchTrendAnalysisRecords failed', e);
    return [];
  }
}

export async function fetchTrendAnalysisById(id: string): Promise<TrendAnalysisRecord | null> {
  const record = await getRecord<TrendAnalysisRecord>(TREND_ANALYSIS_COLLECTION, id);
  if (record) return normalizeRecord(record as unknown as Record<string, unknown>);
  const all = await fetchTrendAnalysisRecords();
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

export async function fetchTrendSourceData(
  dataSource: string,
  productName: string,
  parameterName: string,
  from: string,
  to: string,
): Promise<TrendSourcePoint[]> {
  const points: TrendSourcePoint[] = [];
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
            alertLow: r.alertLimitLow,
            alertHigh: r.alertLimitHigh,
            actionLow: r.actionLimitLow,
            actionHigh: r.actionLimitHigh,
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
            alertLow: r.alertLimitLow,
            alertHigh: r.alertLimitHigh,
            actionLow: r.actionLimitLow,
            actionHigh: r.actionLimitHigh,
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
    } else if (dataSource === 'Raw Material Monitoring') {
      const rows = await fetchRawMaterialRecords(1000);
      rows.filter((r) => {
        const date = asDateString(r.mfgDate, r.createdAt);
        return r.productName === productName
          && (r.testParameter === parameterName || r.materialName === parameterName)
          && inPeriod(date, from, to);
      }).forEach((r) => {
        const v = Number(r.observedResult);
        if (Number.isFinite(v)) {
          points.push({
            batchNumber: r.batchNumber,
            value: v,
            date: asDateString(r.mfgDate, r.createdAt),
            lsl: r.lowerLimit,
            usl: r.upperLimit,
          });
        }
      });
    } else if (dataSource === 'Packing Material Monitoring') {
      const rows = await fetchPackingMaterialRecords(1000);
      rows.filter((r) => {
        const date = asDateString(r.mfgDate, r.createdAt);
        return r.productName === productName && r.materialName === parameterName && inPeriod(date, from, to);
      }).forEach((r) => {
        points.push({
          batchNumber: r.batchNumber,
          value: r.usedQuantity,
          date: asDateString(r.mfgDate, r.createdAt),
        });
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
            alertLow: r.alertLimitLow,
            alertHigh: r.alertLimitHigh,
            actionLow: r.actionLimitLow,
            actionHigh: r.actionLimitHigh,
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
            alertLow: r.alertLimitLow,
            alertHigh: r.alertLimitHigh,
            actionLow: r.actionLimitLow,
            actionHigh: r.actionLimitHigh,
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
    console.error('fetchTrendSourceData failed', e);
  }
  return points;
}

export function previewTrendCalculation(
  form: TrendAnalysisFormData,
  sourceData: TrendSourcePoint[],
): TrendCalculationResult {
  return calculateTrendAnalysis(sourceData, form.parameterName);
}

async function maybeCreateRiskAndAlert(
  record: TrendAnalysisRecord,
  actor: TrendAnalysisActor,
): Promise<string> {
  let riskId = '';
  const needsRisk = ['Alert', 'OOT', 'OOS', 'Action Required'].includes(record.trendStatus);
  if (needsRisk) {
    try {
      const { createRisk } = await import('@/lib/cpv-service');
      const risk = await createRisk({
        productName: record.productName,
        batchNo: '',
        factor: record.parameterName,
        riskDescription: `Trend ${record.trendStatus} for ${record.parameterName} (${record.trendDirection})`,
        occurrence: record.trendStatus === 'OOS' ? 4 : 3,
        severity: record.riskLevel === 'Critical' ? 5 : record.riskLevel === 'High' ? 4 : 3,
        detectability: 3,
        mitigation: 'Review trend analysis and implement corrective actions.',
        owner: actor.name,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }, { id: actor.id, name: actor.name, role: actor.role || 'qa' }, 0);
      if (risk) riskId = String((risk as { id?: string }).id || '');
      await logTrendAudit('risk created', record.id, actor, null, riskId, record.trendId);
    } catch { /* optional */ }
  }
  if (record.oosCount > 0 || record.capaSuggested) {
    try {
      await createAlert({
        alertType: record.oosCount > 0 ? 'OOT' : 'Trend Deteriorating',
        severity: record.riskLevel === 'Critical' ? 'Critical' : 'High',
        module: TREND_ANALYSIS_MODULE,
        productName: record.productName,
        batchNo: '',
        parameterName: record.parameterName,
        message: `${record.trendStatus} trend for ${record.parameterName}`,
        observedValue: record.mean,
        recordId: record.id,
      }, { id: actor.id, name: actor.name, role: actor.role });
      await logTrendAudit('CAPA suggested', record.id, actor, null, { trendStatus: record.trendStatus }, record.trendId);
    } catch { /* optional */ }
    if (isFirebaseConfigured()) {
      try {
        await addDoc(collection(getFirebaseFirestore(), 'notifications'), {
          title: 'Trend Analysis Alert',
          message: `${record.parameterName}: ${record.trendStatus}`,
          module: TREND_ANALYSIS_MODULE,
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

export async function createTrendAnalysis(
  form: TrendAnalysisFormData,
  sourceData: TrendSourcePoint[],
  actor: TrendAnalysisActor,
): Promise<{ result: TrendAnalysisRecord | null; error: string | null }> {
  if (!isFirebaseConfigured()) return { result: null, error: 'Firebase is not configured.' };
  try {
    const product = await fetchCpvProductById(form.cpvProductId);
    if (product?.cpvStatus === 'Inactive') return { result: null, error: 'Inactive product — trend generation not allowed.' };

    const calc = previewTrendCalculation(form, sourceData);
    if (calc.dataPointsCount < 3) return { result: null, error: 'At least 3 numeric data points required for trend analysis.' };

    const today = new Date().toISOString().split('T')[0];
    const payload = {
      ...form,
      trendId: buildTrendId(form.productCode, form.parameterCode),
      batchCount: calc.batchCount,
      dataPointsCount: calc.dataPointsCount,
      mean: calc.mean,
      minimumValue: calc.minimumValue,
      maximumValue: calc.maximumValue,
      standardDeviation: calc.standardDeviation,
      trendDirection: calc.trendDirection,
      trendStatus: calc.trendStatus,
      riskLevel: calc.riskLevel,
      ootCount: calc.ootCount,
      oosCount: calc.oosCount,
      alertCount: calc.alertCount,
      actionCount: calc.actionCount,
      capaSuggested: calc.capaSuggested,
      generatedBy: actor.name,
      generatedDate: today,
      status: 'Generated' as const,
      isLocked: false,
      linkedRiskId: '',
      chartData: calc.chartData.slice(0, 100),
      sourcePreview: sourceData.slice(0, 50),
      reviewedBy: '',
      reviewDate: '',
      createdByName: actor.name,
      updatedByName: actor.name,
    };

    const created = await createRecord(
      TREND_ANALYSIS_COLLECTION,
      payload as Omit<TrendAnalysisRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
      actorCtx(actor),
    );
    let result = normalizeRecord(created as unknown as Record<string, unknown>);

    const riskId = await maybeCreateRiskAndAlert(result, actor);
    if (riskId) {
      const updated = await updateRecord(TREND_ANALYSIS_COLLECTION, result.id, { linkedRiskId: riskId }, actorCtx(actor));
      if (updated) result = normalizeRecord(updated as unknown as Record<string, unknown>);
    }

    await logTrendAudit('generate trend', result.id, actor, null, result, result.trendId);
    await logTrendAudit('trend status calculation', result.id, actor, null, calc, result.trendId);
    return { result, error: null };
  } catch (e) {
    console.error('createTrendAnalysis failed', e);
    return { result: null, error: 'Failed to save trend analysis.' };
  }
}

export async function regenerateTrendAnalysis(
  id: string,
  actor: TrendAnalysisActor,
  existing: TrendAnalysisRecord,
  qaOverride = false,
): Promise<{ result: TrendAnalysisRecord | null; error: string | null }> {
  if (existing.isLocked && existing.status === 'Approved' && !qaOverride) {
    return { result: null, error: 'Approved record is locked. QA override required.' };
  }
  try {
    const sourceData = await fetchTrendSourceData(
      existing.dataSource,
      existing.productName,
      existing.parameterName,
      existing.reviewPeriodFrom,
      existing.reviewPeriodTo,
    );
    const calc = previewTrendCalculation(existing as TrendAnalysisFormData, sourceData);
    if (calc.dataPointsCount < 3) {
      return { result: null, error: 'At least 3 numeric data points required for trend analysis.' };
    }
    const {
      batchCount, dataPointsCount, mean, minimumValue, maximumValue, standardDeviation,
      trendDirection, trendStatus, riskLevel, ootCount, oosCount, alertCount, actionCount, capaSuggested,
    } = calc;
    const updates = {
      batchCount,
      dataPointsCount,
      mean,
      minimumValue,
      maximumValue,
      standardDeviation,
      trendDirection,
      trendStatus,
      riskLevel,
      ootCount,
      oosCount,
      alertCount,
      actionCount,
      capaSuggested,
      chartData: calc.chartData.slice(0, 100),
      sourcePreview: sourceData.slice(0, 50),
      status: 'Generated' as const,
      isLocked: qaOverride ? false : existing.isLocked,
      generatedBy: actor.name,
      generatedDate: new Date().toISOString().split('T')[0],
      updatedByName: actor.name,
    };
    const updated = await updateRecord(TREND_ANALYSIS_COLLECTION, id, updates as Partial<TrendAnalysisRecord>, actorCtx(actor));
    if (!updated) return { result: null, error: 'Not found.' };
    const result = normalizeRecord(updated as unknown as Record<string, unknown>);
    await logTrendAudit(qaOverride ? 'QA override' : 're-generate trend', id, actor, existing, result, result.trendId);
    return { result, error: null };
  } catch (e) {
    console.error('regenerateTrendAnalysis failed', e);
    return { result: null, error: 'Regeneration failed.' };
  }
}

export async function reviewTrendAnalysis(id: string, actor: TrendAnalysisActor, existing: TrendAnalysisRecord) {
  const updated = await updateRecord(TREND_ANALYSIS_COLLECTION, id, {
    status: 'Under Review',
    reviewedBy: actor.name,
    reviewDate: new Date().toISOString().split('T')[0],
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logTrendAudit('review trend', id, actor, existing.status, 'Under Review', result.trendId);
  return { result, error: null };
}

export async function approveTrendAnalysis(id: string, actor: TrendAnalysisActor, existing: TrendAnalysisRecord, qaOverride = false) {
  if (existing.isLocked && existing.status === 'Approved' && !qaOverride) {
    return { result: null, error: 'Already approved.' };
  }
  const updated = await updateRecord(TREND_ANALYSIS_COLLECTION, id, {
    status: 'Approved',
    isLocked: true,
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logTrendAudit(qaOverride ? 'QA override' : 'approve trend', id, actor, existing.status, 'Approved', result.trendId);
  return { result, error: null };
}

export async function rejectTrendAnalysis(id: string, actor: TrendAnalysisActor, existing: TrendAnalysisRecord) {
  const updated = await updateRecord(TREND_ANALYSIS_COLLECTION, id, {
    status: 'Rejected',
    updatedByName: actor.name,
  }, actorCtx(actor));
  if (!updated) return { result: null, error: 'Not found.' };
  const result = normalizeRecord(updated as unknown as Record<string, unknown>);
  await logTrendAudit('reject trend', id, actor, existing.status, 'Rejected', result.trendId);
  return { result, error: null };
}

export async function fetchTrendAnalysisAuditTrail(recordId: string) {
  if (!isFirebaseConfigured()) return [];
  try {
    const snap = await getDocs(query(collection(getFirebaseFirestore(), 'audit_trail'), where('documentId', '==', recordId), limit(50)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export async function logTrendExport(actor: TrendAnalysisActor, type: string, count: number) {
  await logTrendAudit(`export trend ${type}`, 'export', actor, null, { type, count });
}

export async function fetchParametersForTrend(
  dataSource: string,
  productName: string,
): Promise<string[]> {
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
    } else if (dataSource === 'Raw Material Monitoring') {
      const rows = await fetchRawMaterialRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => {
        if (r.testParameter) names.add(r.testParameter);
        names.add(r.materialName);
      });
    } else if (dataSource === 'Packing Material Monitoring') {
      const rows = await fetchPackingMaterialRecords(500);
      rows.filter((r) => r.productName === productName).forEach((r) => names.add(r.materialName));
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

export async function previewTrendSourceData(
  form: TrendAnalysisFormData,
  actor: TrendAnalysisActor,
): Promise<TrendSourcePoint[]> {
  const data = await fetchTrendSourceData(
    form.dataSource,
    form.productName,
    form.parameterName,
    form.reviewPeriodFrom,
    form.reviewPeriodTo,
  );
  await logTrendAudit('source data preview', 'preview', actor, null, {
    product: form.productName,
    parameter: form.parameterName,
    count: data.length,
  }, form.productCode);
  return data;
}

export {
  dataSourceForParameterType,
  trendTypeForDataSource,
  parameterTypeForDataSource,
};
