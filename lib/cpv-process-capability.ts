import { z } from 'zod';

export const PROCESS_CAPABILITY_COLLECTION = 'process_capability';
export const PROCESS_CAPABILITY_LEGACY = ['cpv_capability'] as const;
export const PROCESS_CAPABILITY_MODULE = 'Process Capability';

export const PARAMETER_TYPES = ['CPP', 'CQA', 'Yield', 'Stability'] as const;
export const DATA_SOURCES = [
  'CPP Results',
  'CQA Results',
  'Yield Monitoring',
  'Stability Monitoring',
] as const;

export const CAPABILITY_STATUSES = [
  'Excellent',
  'Acceptable',
  'Needs Improvement',
  'Poor',
  'Not Capable',
  'Insufficient Data',
  'Cannot Calculate',
] as const;

export const WORKFLOW_STATUSES = [
  'Draft',
  'Calculated',
  'Under Review',
  'Approved',
  'Rejected',
  'Archived',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;

const requiredText = z.string().trim().min(1, 'Required');

export const processCapabilityFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  parameterType: z.enum(PARAMETER_TYPES),
  parameterCode: requiredText,
  parameterName: requiredText,
  dataSource: z.enum(DATA_SOURCES),
  reviewPeriodFrom: requiredText,
  reviewPeriodTo: requiredText,
  lowerSpecificationLimit: z.coerce.number(),
  upperSpecificationLimit: z.coerce.number(),
  targetValue: z.coerce.number().optional(),
  conclusion: z.string().trim().default(''),
  recommendation: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
}).refine((d) => {
  const from = new Date(d.reviewPeriodFrom);
  const to = new Date(d.reviewPeriodTo);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['reviewPeriodTo'] }).refine(
  (d) => d.lowerSpecificationLimit < d.upperSpecificationLimit,
  { message: 'USL must be greater than LSL', path: ['upperSpecificationLimit'] },
);

export type ProcessCapabilityFormData = z.infer<typeof processCapabilityFormSchema>;

export interface ProcessCapabilityRecord extends ProcessCapabilityFormData, Record<string, unknown> {
  id: string;
  capabilityId: string;
  batchCount: number;
  sampleCount: number;
  mean: number;
  median: number;
  minimumValue: number;
  maximumValue: number;
  range: number;
  variance: number;
  standardDeviation: number;
  cp: number;
  cpk: number;
  cpu: number;
  cpl: number;
  pp: number;
  ppk: number;
  sigmaLevel: number;
  capabilityStatus: typeof CAPABILITY_STATUSES[number] | string;
  riskLevel: typeof RISK_LEVELS[number] | string;
  reviewedBy: string;
  reviewDate: string;
  approvedBy: string;
  approvalDate: string;
  status: typeof WORKFLOW_STATUSES[number];
  capaRecommended: boolean;
  linkedRiskId: string;
  isLocked: boolean;
  sourcePreview: number[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface ProcessCapabilitySummary {
  total: number;
  excellent: number;
  acceptable: number;
  needsImprovement: number;
  notCapable: number;
  insufficient: number;
  averageCpk: number;
  averagePpk: number;
  highRisk: number;
  capaRecommended: number;
}

export interface CapabilityCalculationResult {
  batchCount: number;
  sampleCount: number;
  mean: number;
  median: number;
  minimumValue: number;
  maximumValue: number;
  range: number;
  variance: number;
  standardDeviation: number;
  cp: number;
  cpk: number;
  cpu: number;
  cpl: number;
  pp: number;
  ppk: number;
  sigmaLevel: number;
  capabilityStatus: typeof CAPABILITY_STATUSES[number];
  riskLevel: typeof RISK_LEVELS[number];
  capaRecommended: boolean;
  values: number[];
}

export function buildCapabilityId(productCode: string, parameterCode: string): string {
  const year = new Date().getFullYear();
  return `PCAP-${productCode}-${parameterCode}-${year}`.replace(/\s+/g, '-').toUpperCase().slice(0, 80);
}

function round(n: number, d = 3): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** d) / 10 ** d;
}

export function evaluateCapabilityStatus(cpk: number, sampleCount: number, canCalculate: boolean): typeof CAPABILITY_STATUSES[number] {
  if (sampleCount < 5) return 'Insufficient Data';
  if (!canCalculate) return 'Cannot Calculate';
  if (cpk >= 1.67) return 'Excellent';
  if (cpk >= 1.33) return 'Acceptable';
  if (cpk >= 1.0) return 'Needs Improvement';
  if (cpk >= 0.67) return 'Poor';
  return 'Not Capable';
}

export function evaluateCapabilityRisk(
  capabilityStatus: string,
  parameterType: string,
  parameterName: string,
): typeof RISK_LEVELS[number] {
  const critical = ['Sterility', 'Assay', 'Bacterial Endotoxin', 'Fill Volume', 'pH'];
  const isCritical = critical.some((p) => parameterName.toLowerCase().includes(p.toLowerCase()));
  if (capabilityStatus === 'Not Capable' || capabilityStatus === 'Poor') {
    if (isCritical && (parameterType === 'CQA' || parameterType === 'CPP')) return 'Critical';
    return 'High';
  }
  if (capabilityStatus === 'Needs Improvement') return 'Medium';
  return 'Low';
}

export function calculateProcessCapability(
  values: number[],
  lsl: number,
  usl: number,
  batchIds: string[] = [],
  parameterType: typeof PARAMETER_TYPES[number] | string = 'CPP',
  parameterName = '',
): CapabilityCalculationResult {
  const clean = values.filter(Number.isFinite);
  const batchCount = new Set(batchIds.filter(Boolean)).size;
  const empty: CapabilityCalculationResult = {
    batchCount,
    sampleCount: clean.length,
    mean: 0,
    median: 0,
    minimumValue: 0,
    maximumValue: 0,
    range: 0,
    variance: 0,
    standardDeviation: 0,
    cp: 0,
    cpk: 0,
    cpu: 0,
    cpl: 0,
    pp: 0,
    ppk: 0,
    sigmaLevel: 0,
    capabilityStatus: 'Insufficient Data',
    riskLevel: 'Low',
    capaRecommended: false,
    values: clean,
  };

  if (clean.length < 5) return empty;
  if (!Number.isFinite(lsl) || !Number.isFinite(usl) || lsl >= usl) {
    return { ...empty, capabilityStatus: 'Cannot Calculate' };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / clean.length;
  const sd = Math.sqrt(variance);

  if (sd === 0) {
    const withinSpec = mean >= lsl && mean <= usl;
    const cpk = withinSpec ? 2 : 0;
    const status = evaluateCapabilityStatus(cpk, clean.length, true);
    return {
      batchCount: batchCount || clean.length,
      sampleCount: clean.length,
      mean: round(mean),
      median: round(median),
      minimumValue: round(min),
      maximumValue: round(max),
      range: round(max - min),
      variance: round(variance),
      standardDeviation: 0,
      cp: withinSpec ? 2 : 0,
      cpk,
      cpu: withinSpec ? 2 : 0,
      cpl: withinSpec ? 2 : 0,
      pp: withinSpec ? 2 : 0,
      ppk: cpk,
      sigmaLevel: round(cpk * 3),
      capabilityStatus: status,
      riskLevel: evaluateCapabilityRisk(status, parameterType, parameterName),
      capaRecommended: cpk < 1.0,
      values: clean,
    };
  }

  const cp = (usl - lsl) / (6 * sd);
  const cpu = (usl - mean) / (3 * sd);
  const cpl = (mean - lsl) / (3 * sd);
  const cpk = Math.min(cpu, cpl);
  const pp = (usl - lsl) / (6 * sd);
  const ppu = (usl - mean) / (3 * sd);
  const ppl = (mean - lsl) / (3 * sd);
  const ppk = Math.min(ppu, ppl);
  const status = evaluateCapabilityStatus(cpk, clean.length, true);

  return {
    batchCount: batchCount || clean.length,
    sampleCount: clean.length,
    mean: round(mean),
    median: round(median),
    minimumValue: round(min),
    maximumValue: round(max),
    range: round(max - min),
    variance: round(variance),
    standardDeviation: round(sd),
    cp: round(cp),
    cpk: round(cpk),
    cpu: round(cpu),
    cpl: round(cpl),
    pp: round(pp),
    ppk: round(ppk),
    sigmaLevel: round(cpk * 3),
    capabilityStatus: status,
    riskLevel: evaluateCapabilityRisk(status, parameterType, parameterName),
    capaRecommended: cpk < 1.0,
    values: clean,
  };
}

export function summarizeProcessCapability(records: ProcessCapabilityRecord[]): ProcessCapabilitySummary {
  const validCpk = records.filter((r) => r.cpk > 0 && r.capabilityStatus !== 'Insufficient Data');
  const avg = (field: 'cpk' | 'ppk') => validCpk.length
    ? round(validCpk.reduce((s, r) => s + r[field], 0) / validCpk.length)
    : 0;
  return {
    total: records.length,
    excellent: records.filter((r) => r.capabilityStatus === 'Excellent').length,
    acceptable: records.filter((r) => r.capabilityStatus === 'Acceptable').length,
    needsImprovement: records.filter((r) => r.capabilityStatus === 'Needs Improvement').length,
    notCapable: records.filter((r) => r.capabilityStatus === 'Not Capable' || r.capabilityStatus === 'Poor').length,
    insufficient: records.filter((r) => r.capabilityStatus === 'Insufficient Data').length,
    averageCpk: avg('cpk'),
    averagePpk: avg('ppk'),
    highRisk: records.filter((r) => r.riskLevel === 'High' || r.riskLevel === 'Critical').length,
    capaRecommended: records.filter((r) => r.capaRecommended).length,
  };
}

export function buildProcessCapabilityCharts(records: ProcessCapabilityRecord[]) {
  const cpkByParameter = records
    .filter((r) => r.cpk > 0)
    .map((r) => ({ name: r.parameterName, cpk: r.cpk, ppk: r.ppk }))
    .slice(0, 15);

  const statusMap = new Map<string, number>();
  records.forEach((r) => statusMap.set(r.capabilityStatus, (statusMap.get(r.capabilityStatus) || 0) + 1));
  const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

  const riskMap = new Map<string, number>();
  records.forEach((r) => riskMap.set(r.riskLevel || 'Low', (riskMap.get(r.riskLevel || 'Low') || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  const byMonth = new Map<string, { cpk: number; count: number }>();
  records.forEach((r) => {
    const key = (r.reviewPeriodTo || r.createdAt).slice(0, 7);
    const e = byMonth.get(key) || { cpk: 0, count: 0 };
    if (r.cpk > 0) { e.cpk += r.cpk; e.count += 1; }
    byMonth.set(key, e);
  });
  const monthlyCpk = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, cpk: v.count ? round(v.cpk / v.count) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const cpVsCpk = records.filter((r) => r.cp > 0).slice(0, 12).map((r) => ({
    parameter: r.parameterName,
    cp: r.cp,
    cpk: r.cpk,
  }));

  const parameterTrend = records
    .filter((r) => r.cpk > 0)
    .sort((a, b) => (a.reviewPeriodTo || a.createdAt).localeCompare(b.reviewPeriodTo || b.createdAt))
    .slice(-12)
    .map((r) => ({
      label: `${r.parameterName}`.slice(0, 20),
      cpk: r.cpk,
      ppk: r.ppk,
    }));

  return { cpkByParameter, statusDistribution, riskDistribution, monthlyCpk, cpVsCpk, parameterTrend };
}

export function dataSourceForType(type: typeof PARAMETER_TYPES[number]): typeof DATA_SOURCES[number] {
  const map: Record<string, typeof DATA_SOURCES[number]> = {
    CPP: 'CPP Results',
    CQA: 'CQA Results',
    Yield: 'Yield Monitoring',
    Stability: 'Stability Monitoring',
  };
  return map[type];
}
