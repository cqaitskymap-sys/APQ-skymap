import { z } from 'zod';
import { CRITICALITY_OPTIONS, RESULT_TYPES } from '@/lib/admin/constants';

export const CQA_RESULTS_COLLECTION = 'cqa_results';
export const CQA_LEGACY_COLLECTION = 'cpv_cqa';
export const CQA_MODULE_NAME = 'CQA Monitoring';

export const CQA_TEST_STAGES = [
  'In-Process Testing',
  'Finished Product Testing',
  'Stability Testing',
  'Microbiology Testing',
  'Sterility Testing',
  'Endotoxin Testing',
  'Particulate Matter Testing',
  'Preservative Testing',
  'Identification Testing',
  'Assay Testing',
  'Related Substance Testing',
] as const;

export const DEFAULT_CQA_PARAMETERS = [
  'Description', 'Colour', 'Clarity', 'Identification', 'pH', 'Extractable Volume',
  'Assay', 'Related Substances', 'Sterility', 'Bacterial Endotoxin',
  'Particulate Matter >=10µm', 'Particulate Matter >=25µm',
  'Methyl Paraben Assay', 'Propyl Paraben Assay', 'Preservative Content',
  'Visible Particles', 'Sub Visible Particles', 'Water Content', 'Appearance',
  'Total Viable Count', 'Colour Index', 'Ondansetron Imp. D',
  'Any Secondary Impurity', 'Sum of All Impurities',
] as const;

export const MICROBIOLOGY_CQA_PARAMETERS = [
  'Sterility', 'Bacterial Endotoxin', 'Microbiology Testing',
] as const;

export const CQA_RESULT_STATUSES = [
  'Complies', 'Alert', 'Action', 'OOS', 'Pass', 'Fail', 'Does Not Comply',
] as const;

export const CQA_REVIEW_STATUSES = ['Draft', 'Under Review', 'Approved'] as const;

const requiredText = z.string().trim().min(1, 'Required');

export const cqaResultFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  batchNumber: requiredText,
  manufacturingDate: requiredText,
  expiryDate: z.string().trim().default(''),
  testStage: requiredText,
  parameterId: z.string().trim().default(''),
  parameterCode: requiredText,
  parameterName: requiredText,
  subParameter: z.string().trim().default(''),
  parameterCategory: z.string().trim().default(''),
  responsibility: z.string().trim().default(''),
  specificationText: z.string().trim().default(''),
  specificationNumber: z.string().trim().default(''),
  stpNumber: z.string().trim().default(''),
  observedResult: z.union([z.coerce.number(), z.string().trim().min(1, 'Required')]),
  targetValue: z.coerce.number().optional(),
  lowerLimit: z.coerce.number(),
  upperLimit: z.coerce.number(),
  alertLimitLow: z.coerce.number().optional(),
  alertLimitHigh: z.coerce.number().optional(),
  actionLimitLow: z.coerce.number().optional(),
  actionLimitHigh: z.coerce.number().optional(),
  unit: requiredText,
  resultType: z.enum(RESULT_TYPES).default('Numeric'),
  criticality: z.enum(CRITICALITY_OPTIONS).default('Major'),
  testDate: requiredText,
  analyst: requiredText,
  reviewedBy: z.string().trim().default(''),
  reviewDate: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
}).refine((d) => d.lowerLimit < d.upperLimit, {
  message: 'Upper limit must be greater than lower limit',
  path: ['upperLimit'],
}).refine((d) => {
  const mfg = new Date(d.manufacturingDate);
  return !Number.isNaN(mfg.getTime());
}, { message: 'Invalid manufacturing date', path: ['manufacturingDate'] }).refine((d) => {
  const test = new Date(d.testDate);
  return !Number.isNaN(test.getTime());
}, { message: 'Invalid test date', path: ['testDate'] });

export type CqaResultFormData = z.infer<typeof cqaResultFormSchema>;

export interface CqaResultRecord extends CqaResultFormData, Record<string, unknown> {
  id: string;
  cqaResultId: string;
  status: string;
  riskLevel: string;
  oosRequired: boolean;
  linkedOosNumber: string;
  deviationRequired: boolean;
  linkedDeviationNumber: string;
  capaRequired: boolean;
  linkedCapaNumber: string;
  reviewStatus: typeof CQA_REVIEW_STATUSES[number];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface CqaSummary {
  total: number;
  compliant: number;
  alert: number;
  action: number;
  oos: number;
  highRisk: number;
  criticalRisk: number;
  oosTriggered: number;
  capaSuggested: number;
}

export function buildCqaResultId(batchNumber: string, parameterCode: string): string {
  return `CQA-${batchNumber}-${parameterCode}`.replace(/\s+/g, '-').toUpperCase();
}

export function evaluateCqaStatus(
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
    return v === 'pass' ? 'Complies' : 'OOS';
  }
  if (resultType === 'Complies/Does Not Comply') {
    const v = String(observed).toLowerCase();
    return v.includes('comply') && !v.includes('not') ? 'Complies' : 'OOS';
  }
  const num = Number(observed);
  if (!Number.isFinite(num)) return 'OOS';
  if (num < lsl || num > usl) return 'OOS';
  if (actionLow != null && !Number.isNaN(actionLow) && num < actionLow) return 'Action';
  if (actionHigh != null && !Number.isNaN(actionHigh) && num > actionHigh) return 'Action';
  if (alertLow != null && !Number.isNaN(alertLow) && num < alertLow) return 'Alert';
  if (alertHigh != null && !Number.isNaN(alertHigh) && num > alertHigh) return 'Alert';
  return 'Complies';
}

export function evaluateCqaRiskLevel(
  status: string,
  criticality: string,
  oosCount: number,
  alertCount: number,
): string {
  if (oosCount >= 2) return 'Critical';
  if (alertCount >= 3) return 'Medium';
  if (status === 'OOS' || status === 'Fail' || status === 'Does Not Comply') {
    if (criticality === 'Critical') return 'Critical';
    if (criticality === 'Major') return 'High';
    return 'Medium';
  }
  if (status === 'Action' || status === 'Alert') return 'Medium';
  return 'Low';
}

export function summarizeCqaResults(results: CqaResultRecord[]): CqaSummary {
  return {
    total: results.length,
    compliant: results.filter((r) => r.status === 'Complies' || r.status === 'Pass').length,
    alert: results.filter((r) => r.status === 'Alert').length,
    action: results.filter((r) => r.status === 'Action').length,
    oos: results.filter((r) => r.status === 'OOS' || r.status === 'Fail' || r.status === 'Does Not Comply').length,
    highRisk: results.filter((r) => r.riskLevel === 'High').length,
    criticalRisk: results.filter((r) => r.riskLevel === 'Critical').length,
    oosTriggered: results.filter((r) => r.oosRequired || r.linkedOosNumber).length,
    capaSuggested: results.filter((r) => r.capaRequired).length,
  };
}

function trendPoints(results: CqaResultRecord[], parameterName: string) {
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

export function buildCqaChartSeries(results: CqaResultRecord[]) {
  const byMonth = new Map<string, { complies: number; total: number }>();
  results.forEach((r) => {
    const d = r.testDate || r.createdAt;
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
  results.forEach((r) => {
    paramMap.set(r.parameterName, (paramMap.get(r.parameterName) || 0) + 1);
  });
  const parameterTrend = Array.from(paramMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const stageMap = new Map<string, number>();
  results.filter((r) => r.status === 'OOS' || r.status === 'Fail').forEach((r) => {
    stageMap.set(r.testStage, (stageMap.get(r.testStage) || 0) + 1);
  });
  const stageOos = Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count }));

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

  return {
    complianceTrend,
    parameterTrend,
    stageOos,
    batchHealth,
    riskDistribution,
    assayTrend: trendPoints(results, 'Assay'),
    phTrend: trendPoints(results, 'pH'),
    extractableVolumeTrend: trendPoints(results, 'Extractable Volume'),
    particulateMatterTrend: trendPoints(results, 'Particulate Matter >=10µm'),
  };
}

export function isMicrobiologyCqaParameter(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('sterility') || n.includes('endotoxin') || n.includes('microbial')
    || n.includes('microbiology') || MICROBIOLOGY_CQA_PARAMETERS.some((p) => p.toLowerCase() === n);
}
