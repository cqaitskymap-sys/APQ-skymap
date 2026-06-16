import { z } from 'zod';
import { PROCESS_STAGES, CRITICALITY_OPTIONS, RESULT_TYPES } from '@/lib/admin/constants';

export const CPP_RESULTS_COLLECTION = 'cpp_results';
export const CPP_LEGACY_COLLECTION = 'cpv_cpp';
export const CPP_MODULE_NAME = 'CPP Monitoring';

export const CPP_PROCESS_STAGES = PROCESS_STAGES;

export const DEFAULT_CPP_PARAMETERS = [
  'Bulk Yield', 'Filling Yield', 'Packing Yield', 'Mixing Time', 'Mixing RPM',
  'Mixing Temperature', 'Bulk Hold Time', 'Filtration Pressure', 'Filtration Time',
  'Sterilization Temperature', 'Sterilization Time', 'Sterile Hold Time', 'Filling Speed',
  'Fill Volume', 'Nitrogen Pressure', 'Room Temperature', 'Relative Humidity',
  'Differential Pressure', 'WFI Pressure', 'Compressed Air Pressure',
  'Tunnel Temperature Zone 1', 'Tunnel Temperature Zone 2', 'Tunnel Temperature Zone 3',
] as const;

export const CPP_RESULT_STATUSES = [
  'Complies', 'Alert', 'Action', 'OOT/OOL', 'Pass', 'Fail', 'Does Not Comply',
] as const;

export const CPP_REVIEW_STATUSES = ['Draft', 'Under Review', 'Approved'] as const;

const requiredText = z.string().trim().min(1, 'Required');

export const cppResultFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  batchNumber: requiredText,
  manufacturingDate: requiredText,
  processStage: requiredText,
  parameterId: z.string().trim().default(''),
  parameterCode: requiredText,
  parameterName: requiredText,
  parameterCategory: z.string().trim().default(''),
  observedValue: z.union([z.coerce.number(), z.string().trim().min(1, 'Required')]),
  targetValue: z.coerce.number().optional(),
  lowerLimit: z.coerce.number(),
  upperLimit: z.coerce.number(),
  alertLimitLow: z.coerce.number().optional(),
  alertLimitHigh: z.coerce.number().optional(),
  actionLimitLow: z.coerce.number().optional(),
  actionLimitHigh: z.coerce.number().optional(),
  unit: requiredText,
  resultType: z.enum(RESULT_TYPES).default('Numeric'),
  frequency: z.string().trim().default('Per Batch'),
  criticality: z.enum(CRITICALITY_OPTIONS).default('Major'),
  observationDateTime: requiredText,
  recordedBy: requiredText,
  reviewedBy: z.string().trim().default(''),
  reviewDate: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
}).refine((d) => d.lowerLimit < d.upperLimit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['upperLimit'],
}).refine((d) => {
  const mfg = new Date(d.manufacturingDate);
  return !Number.isNaN(mfg.getTime());
}, { message: 'Invalid manufacturing date', path: ['manufacturingDate'] });

export type CppResultFormData = z.infer<typeof cppResultFormSchema>;

export interface CppResultRecord extends CppResultFormData, Record<string, unknown> {
  id: string;
  cppResultId: string;
  status: string;
  riskLevel: string;
  deviationRequired: boolean;
  linkedDeviationNumber: string;
  capaRequired: boolean;
  linkedCapaNumber: string;
  reviewStatus: typeof CPP_REVIEW_STATUSES[number];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface CppSummary {
  total: number;
  compliant: number;
  alert: number;
  action: number;
  ootOol: number;
  highRisk: number;
  criticalRisk: number;
  deviationTriggered: number;
  capaSuggested: number;
}

export function buildCppResultId(batchNumber: string, parameterCode: string): string {
  return `CPP-${batchNumber}-${parameterCode}`.replace(/\s+/g, '-').toUpperCase();
}

export function evaluateCppStatus(
  observed: number | string,
  lsl: number,
  usl: number,
  resultType: string,
  alertLow?: number,
  alertHigh?: number,
  actionLow?: number,
  actionHigh?: number,
): string {
  if (resultType === 'Pass/Fail') {
    const v = String(observed).toLowerCase();
    return v === 'pass' ? 'Complies' : 'Does Not Comply';
  }
  if (resultType === 'Complies/Does Not Comply') {
    const v = String(observed).toLowerCase();
    return v.includes('comply') && !v.includes('not') ? 'Complies' : 'Does Not Comply';
  }
  const num = Number(observed);
  if (!Number.isFinite(num)) return 'OOT/OOL';
  if (num < lsl || num > usl) return 'OOT/OOL';
  if (actionLow != null && !Number.isNaN(actionLow) && num < actionLow) return 'Action';
  if (actionHigh != null && !Number.isNaN(actionHigh) && num > actionHigh) return 'Action';
  if (alertLow != null && !Number.isNaN(alertLow) && num < alertLow) return 'Alert';
  if (alertHigh != null && !Number.isNaN(alertHigh) && num > alertHigh) return 'Alert';
  return 'Complies';
}

export function evaluateCppRiskLevel(
  status: string,
  criticality: string,
  failureCount: number,
): string {
  if (failureCount >= 3) return 'Critical';
  const fail = ['OOT/OOL', 'Action', 'Does Not Comply', 'Fail'].includes(status);
  if (!fail) return 'Low';
  if (criticality === 'Critical') return 'High';
  if (criticality === 'Major') return 'Medium';
  return 'Low';
}

export function summarizeCppResults(results: CppResultRecord[]): CppSummary {
  return {
    total: results.length,
    compliant: results.filter((r) => r.status === 'Complies' || r.status === 'Pass').length,
    alert: results.filter((r) => r.status === 'Alert').length,
    action: results.filter((r) => r.status === 'Action').length,
    ootOol: results.filter((r) => r.status === 'OOT/OOL' || r.status === 'OOS' || r.status === 'OOT').length,
    highRisk: results.filter((r) => r.riskLevel === 'High').length,
    criticalRisk: results.filter((r) => r.riskLevel === 'Critical').length,
    deviationTriggered: results.filter((r) => r.deviationRequired || r.linkedDeviationNumber).length,
    capaSuggested: results.filter((r) => r.capaRequired).length,
  };
}

export function buildChartSeries(results: CppResultRecord[]) {
  const byMonth = new Map<string, { complies: number; total: number }>();
  results.forEach((r) => {
    const d = r.observationDateTime || r.createdAt;
    const key = d ? d.slice(0, 7) : 'unknown';
    const entry = byMonth.get(key) || { complies: 0, total: 0 };
    entry.total += 1;
    if (r.status === 'Complies' || r.status === 'Pass') entry.complies += 1;
    byMonth.set(key, entry);
  });
  const complianceTrend = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, rate: v.total ? Math.round((v.complies / v.total) * 100) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const paramMap = new Map<string, number>();
  results.filter((r) => !['Complies', 'Pass'].includes(r.status)).forEach((r) => {
    paramMap.set(r.parameterName, (paramMap.get(r.parameterName) || 0) + 1);
  });
  const parameterNonCompliance = Array.from(paramMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const stageMap = new Map<string, number>();
  results.filter((r) => !['Complies', 'Pass'].includes(r.status)).forEach((r) => {
    stageMap.set(r.processStage, (stageMap.get(r.processStage) || 0) + 1);
  });
  const stageNonCompliance = Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count }));

  const batchMap = new Map<string, { ok: number; total: number }>();
  results.forEach((r) => {
    const e = batchMap.get(r.batchNumber) || { ok: 0, total: 0 };
    e.total += 1;
    if (r.status === 'Complies' || r.status === 'Pass') e.ok += 1;
    batchMap.set(r.batchNumber, e);
  });
  const batchHealth = Array.from(batchMap.entries())
    .map(([batch, v]) => ({ batch, health: v.total ? Math.round((v.ok / v.total) * 100) : 0 }))
    .slice(0, 10);

  const riskMap = new Map<string, number>();
  results.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  return { complianceTrend, parameterNonCompliance, stageNonCompliance, batchHealth, riskDistribution };
}
