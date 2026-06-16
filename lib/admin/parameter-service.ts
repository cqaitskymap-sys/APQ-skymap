import { writeAuditTrail } from '@/lib/audit-trail';
import {
  getAdminRecords, createAdminRecord, updateAdminRecord,
  checkUniqueField, logAuditEvent,
} from './admin-service';
import {
  ADMIN_COLLECTIONS, DEFAULT_CPP_PARAMETERS, DEFAULT_CQA_PARAMETERS,
  DEFAULT_UTILITY_PARAMETERS,
} from './constants';
import type { Parameter, ParameterFormData } from './schemas';

export interface ParameterAuditMeta {
  userId: string;
  userName: string;
}

export type ParameterResultStatus = 'Pass' | 'OOS' | 'Alert' | 'Action' | 'OOT';

export interface ParameterEvaluation {
  status: ParameterResultStatus;
  triggers: {
    oosDraft?: boolean;
    deviationDraft?: boolean;
    capaSuggested?: boolean;
  };
}

async function logParameterAudit(
  action: string,
  recordId: string,
  meta: ParameterAuditMeta,
  oldValue: unknown,
  newValue: unknown,
) {
  await logAuditEvent({
    userId: meta.userId,
    userName: meta.userName,
    module: 'Parameter Master',
    recordId,
    action,
    oldValue: typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? ''),
    reason: '',
    ipAddress: 'client',
    device: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
    status: 'Success',
  });

  await writeAuditTrail({
    collectionName: ADMIN_COLLECTIONS.parameters,
    documentId: recordId,
    action,
    oldValue,
    newValue,
    userId: meta.userId,
    userName: meta.userName,
    moduleName: 'Parameter Master',
  });
}

export function buildParameterId(code: string): string {
  return `PARAM-${code.toUpperCase().replace(/\s+/g, '-')}`;
}

export function normalizeParameter(p: Parameter): Parameter {
  const lower = p.lowerLimit || p.lsl || '';
  const upper = p.upperLimit || p.usl || '';
  const target = p.targetValue || p.target || '';
  const productLink = p.productLink || p.product || '';
  return {
    ...p,
    parameterId: p.parameterId || buildParameterId(p.parameterCode),
    lowerLimit: lower,
    lsl: lower,
    upperLimit: upper,
    usl: upper,
    targetValue: target,
    target,
    productLink,
    product: productLink,
  };
}

export function evaluateParameterResult(param: Parameter, observedValue: number): ParameterEvaluation {
  const lower = Number(param.lowerLimit || param.lsl);
  const upper = Number(param.upperLimit || param.usl);
  const alertLow = param.alertLimitLow ? Number(param.alertLimitLow) : null;
  const alertHigh = param.alertLimitHigh ? Number(param.alertLimitHigh) : null;
  const actionLow = param.actionLimitLow ? Number(param.actionLimitLow) : null;
  const actionHigh = param.actionLimitHigh ? Number(param.actionLimitHigh) : null;

  let status: ParameterResultStatus = 'Pass';
  const triggers: ParameterEvaluation['triggers'] = {};

  if (!Number.isNaN(lower) && !Number.isNaN(upper)) {
    if (observedValue < lower || observedValue > upper) {
      status = 'OOS';
      if (param.oosApplicable) triggers.oosDraft = true;
      if (param.autoDeviationRequired) triggers.deviationDraft = true;
      if (param.autoCapaRequired) triggers.capaSuggested = true;
      return { status, triggers };
    }
  }

  if (actionLow !== null && observedValue < actionLow) status = 'Action';
  if (actionHigh !== null && observedValue > actionHigh) status = 'Action';

  if (status !== 'Action') {
    if (alertLow !== null && observedValue < alertLow) status = 'Alert';
    if (alertHigh !== null && observedValue > alertHigh) status = 'Alert';
  }

  if (param.ootApplicable && status === 'Alert') status = 'OOT';

  return { status, triggers };
}

export async function fetchParameters(): Promise<Parameter[]> {
  try {
    const records = await getAdminRecords<Parameter>(ADMIN_COLLECTIONS.parameters);
    return records.filter((p) => !p.isDeleted).map(normalizeParameter);
  } catch {
    return [];
  }
}

export async function fetchParameterById(id: string): Promise<Parameter | null> {
  const params = await fetchParameters();
  return params.find((p) => p.id === id) ?? null;
}

export function getParameterSummaryCounts(params: Parameter[]) {
  const byType = (type: string) => params.filter((p) => p.parameterType === type).length;
  return {
    total: params.length,
    cpp: byType('CPP'),
    cqa: byType('CQA'),
    ipc: byType('IPC'),
    utility: byType('Utility Parameter'),
    environmental: byType('Environmental Parameter'),
    active: params.filter((p) => p.status === 'Active').length,
    inactive: params.filter((p) => p.status === 'Inactive').length,
    critical: params.filter((p) => p.criticality === 'Critical').length,
  };
}

function formToPayload(data: ParameterFormData, meta: ParameterAuditMeta, status = 'Active') {
  const parameterId = buildParameterId(data.parameterCode);
  return {
    parameterId,
    parameterCode: data.parameterCode,
    parameterName: data.parameterName,
    parameterType: data.parameterType,
    parameterCategory: data.parameterCategory,
    productLink: data.productLink,
    product: data.productLink,
    processStage: data.processStage,
    department: data.department,
    testMethodStp: data.testMethodStp,
    specificationNo: data.specificationNo,
    targetValue: data.targetValue,
    target: data.targetValue,
    lowerLimit: data.lowerLimit,
    lsl: data.lowerLimit,
    upperLimit: data.upperLimit,
    usl: data.upperLimit,
    alertLimitLow: data.alertLimitLow,
    alertLimitHigh: data.alertLimitHigh,
    actionLimitLow: data.actionLimitLow,
    actionLimitHigh: data.actionLimitHigh,
    unit: data.unit,
    resultType: data.resultType,
    frequency: data.frequency,
    criticality: data.criticality,
    ootApplicable: data.ootApplicable,
    oosApplicable: data.oosApplicable,
    autoDeviationRequired: data.autoDeviationRequired,
    autoCapaRequired: data.autoCapaRequired,
    remarks: data.remarks,
    status,
    updatedBy: meta.userId,
  };
}

export async function createParameter(
  data: ParameterFormData,
  meta: ParameterAuditMeta,
): Promise<{ parameter: Parameter | null; error: string | null }> {
  try {
    const unique = await checkUniqueField(ADMIN_COLLECTIONS.parameters, 'parameterCode', data.parameterCode);
    if (!unique) return { parameter: null, error: 'Parameter code already exists' };

    const payload = {
      ...formToPayload(data, meta),
      createdBy: meta.userId,
    };

    const created = await createAdminRecord(ADMIN_COLLECTIONS.parameters, payload as Omit<Parameter, 'id'>, {
      userId: meta.userId, userName: meta.userName, module: 'Parameter Master', action: 'CREATE_PARAMETER',
    });

    await logParameterAudit('CREATE_PARAMETER', created.id || payload.parameterId, meta, null, payload);
    return { parameter: normalizeParameter(created as Parameter), error: null };
  } catch (e) {
    return { parameter: null, error: (e as Error).message };
  }
}

export async function updateParameter(
  id: string,
  data: ParameterFormData,
  existing: Parameter,
  meta: ParameterAuditMeta,
): Promise<{ parameter: Parameter | null; error: string | null }> {
  try {
    if (data.parameterCode !== existing.parameterCode) {
      const unique = await checkUniqueField(ADMIN_COLLECTIONS.parameters, 'parameterCode', data.parameterCode, id);
      if (!unique) return { parameter: null, error: 'Parameter code already exists' };
    }

    const updates = formToPayload(data, meta, existing.status);
    delete (updates as { createdBy?: string }).createdBy;

    const updated = await updateAdminRecord(ADMIN_COLLECTIONS.parameters, id, updates, {
      userId: meta.userId, userName: meta.userName, module: 'Parameter Master',
      oldValue: JSON.stringify(existing),
    });

    if (existing.criticality !== data.criticality) {
      await logParameterAudit('CRITICALITY_CHANGE', id, meta, existing.criticality, data.criticality);
    }
    if (existing.productLink !== data.productLink) {
      await logParameterAudit('PRODUCT_LINK_CHANGE', id, meta, existing.productLink, data.productLink);
    }
    if (
      existing.lowerLimit !== data.lowerLimit || existing.upperLimit !== data.upperLimit ||
      existing.alertLimitLow !== data.alertLimitLow || existing.alertLimitHigh !== data.alertLimitHigh
    ) {
      await logParameterAudit('LIMIT_CHANGE', id, meta, {
        lower: existing.lowerLimit, upper: existing.upperLimit,
        alertLow: existing.alertLimitLow, alertHigh: existing.alertLimitHigh,
      }, {
        lower: data.lowerLimit, upper: data.upperLimit,
        alertLow: data.alertLimitLow, alertHigh: data.alertLimitHigh,
      });
    }
    await logParameterAudit('EDIT_PARAMETER', id, meta, existing, updates);
    return { parameter: normalizeParameter(updated as Parameter), error: null };
  } catch (e) {
    return { parameter: null, error: (e as Error).message };
  }
}

export async function setParameterStatus(
  id: string,
  param: Parameter,
  status: 'Active' | 'Inactive',
  meta: ParameterAuditMeta,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateAdminRecord(ADMIN_COLLECTIONS.parameters, id, { status }, {
      userId: meta.userId, userName: meta.userName, module: 'Parameter Master',
      oldValue: JSON.stringify(param),
    });
    const action = status === 'Active' ? 'ACTIVATE_PARAMETER' : 'DEACTIVATE_PARAMETER';
    await logParameterAudit(action, id, meta, param.status, status);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function fetchParameterAuditTrail(recordId: string) {
  try {
    const [trail, logs] = await Promise.all([
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditTrail).catch(() => []),
      getAdminRecords<Record<string, unknown>>(ADMIN_COLLECTIONS.auditLogs).catch(() => []),
    ]);
    return [...trail, ...logs]
      .filter((l) => l.documentId === recordId || l.recordId === recordId)
      .sort((a, b) => String(b.timestamp ?? b.dateTime).localeCompare(String(a.timestamp ?? a.dateTime)))
      .slice(0, 30);
  } catch {
    return [];
  }
}

export function exportParametersCsv(params: Parameter[]): string {
  const headers = [
    'Parameter Code', 'Parameter Name', 'Type', 'Category', 'Product',
    'Stage', 'Lower Limit', 'Upper Limit', 'Unit', 'Result Type', 'Criticality', 'Status',
  ];
  const rows = params.map((p) => [
    p.parameterCode, p.parameterName, p.parameterType, p.parameterCategory,
    p.productLink, p.processStage, p.lowerLimit, p.upperLimit, p.unit,
    p.resultType, p.criticality, p.status,
  ]);
  return [headers.join(','), ...rows.map((row) =>
    row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  )].join('\n');
}

export async function logParameterExport(meta: ParameterAuditMeta, count: number) {
  await logParameterAudit('EXPORT_PARAMETER_LIST', 'export', meta, null, { count });
}

export async function importParametersFromFile(
  file: File,
  meta: ParameterAuditMeta,
): Promise<{ imported: number; errors: string[] }> {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { imported: 0, errors: ['No data rows found'] };

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const idx = (name: string) => headers.findIndex((h) => h.includes(name));

  let imported = 0;
  const errors: string[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
    const code = cols[idx('parameter code')] || cols[idx('code')] || '';
    const name = cols[idx('parameter name')] || cols[idx('name')] || '';
    if (!code || !name) {
      errors.push(`Row missing code/name: ${line.slice(0, 40)}`);
      continue;
    }

    const typeRaw = cols[idx('type')] || 'CPP';
    const parameterType = (DEFAULT_CPP_PARAMETERS.includes(name as typeof DEFAULT_CPP_PARAMETERS[number]) ? 'CPP'
      : DEFAULT_CQA_PARAMETERS.includes(name as typeof DEFAULT_CQA_PARAMETERS[number]) ? 'CQA'
      : DEFAULT_UTILITY_PARAMETERS.includes(name as typeof DEFAULT_UTILITY_PARAMETERS[number]) ? 'Utility Parameter'
      : typeRaw) as ParameterFormData['parameterType'];

    const data: ParameterFormData = {
      parameterCode: code,
      parameterName: name,
      parameterType,
      parameterCategory: 'Manufacturing',
      productLink: cols[idx('product')] || '',
      processStage: 'Mixing',
      department: cols[idx('department')] || '',
      testMethodStp: cols[idx('stp')] || cols[idx('test method')] || '',
      specificationNo: cols[idx('specification')] || '',
      targetValue: cols[idx('target')] || '',
      lowerLimit: cols[idx('lower')] || '',
      upperLimit: cols[idx('upper')] || '',
      alertLimitLow: '',
      alertLimitHigh: '',
      actionLimitLow: '',
      actionLimitHigh: '',
      unit: cols[idx('unit')] || (parameterType === 'CQA' ? '%' : ''),
      resultType: 'Numeric',
      frequency: 'Per Batch',
      criticality: 'Major',
      ootApplicable: false,
      oosApplicable: parameterType === 'CQA',
      autoDeviationRequired: parameterType === 'CPP',
      autoCapaRequired: false,
      remarks: 'Imported',
    };

    const result = await createParameter(data, meta);
    if (result.error) errors.push(`${code}: ${result.error}`);
    else imported += 1;
  }

  if (imported) await logParameterAudit('IMPORT_PARAMETER', 'import', meta, null, { imported, errors: errors.length });
  return { imported, errors };
}

function presetToForm(
  name: string,
  type: ParameterFormData['parameterType'],
  category: ParameterFormData['parameterCategory'],
  stage: ParameterFormData['processStage'],
): ParameterFormData {
  const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
  return {
    parameterCode: `${type === 'CPP' ? 'CPP' : type === 'CQA' ? 'CQA' : 'UTL'}_${code}`,
    parameterName: name,
    parameterType: type,
    parameterCategory: category,
    productLink: '',
    processStage: stage,
    department: category === 'Utility' ? 'Engineering' : category === 'Quality Control' ? 'QC' : 'Production',
    testMethodStp: '',
    specificationNo: '',
    targetValue: '',
    lowerLimit: '',
    upperLimit: '',
    alertLimitLow: '',
    alertLimitHigh: '',
    actionLimitLow: '',
    actionLimitHigh: '',
    unit: type === 'CQA' ? '%' : type === 'Utility Parameter' ? 'varies' : '',
    resultType: type === 'CQA' && ['Description', 'Colour', 'Clarity', 'Identification', 'Sterility'].includes(name)
      ? 'Complies/Does Not Comply' : 'Numeric',
    frequency: type === 'Utility Parameter' ? 'Daily' : 'Per Batch',
    criticality: ['Assay', 'Sterility', 'Bacterial Endotoxin', 'Fill Volume'].includes(name) ? 'Critical' : 'Major',
    ootApplicable: type === 'CPP',
    oosApplicable: type === 'CQA' || type === 'IPC',
    autoDeviationRequired: type === 'CPP',
    autoCapaRequired: false,
    remarks: 'Default preset',
  };
}

export async function seedDefaultParameters(meta: ParameterAuditMeta): Promise<{ created: number; skipped: number }> {
  const existing = await fetchParameters();
  const codes = new Set(existing.map((p) => p.parameterCode));
  let created = 0;
  let skipped = 0;

  const presets: ParameterFormData[] = [
    ...DEFAULT_CPP_PARAMETERS.map((n) => presetToForm(n, 'CPP', 'Manufacturing', 'Mixing')),
    ...DEFAULT_CQA_PARAMETERS.map((n) => presetToForm(n, 'CQA', 'Quality Control', 'Finished Product Testing')),
    ...DEFAULT_UTILITY_PARAMETERS.map((n) => presetToForm(n, 'Utility Parameter', 'Utility', 'Utility Monitoring')),
  ];

  for (const preset of presets) {
    if (codes.has(preset.parameterCode)) {
      skipped += 1;
      continue;
    }
    const result = await createParameter(preset, meta);
    if (result.parameter) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}
