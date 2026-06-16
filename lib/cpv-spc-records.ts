import { z } from 'zod';
import {
  runSpcAnalysis,
  type SpcObservation,
  type SpcChartResult,
  type SpcRuleViolation,
} from '@/lib/cpv-spc';

export const CONTROL_CHARTS_COLLECTION = 'control_charts';
export const SPC_VIOLATIONS_COLLECTION = 'spc_rule_violations';
export const CONTROL_CHARTS_LEGACY = ['cpv_control_charts'] as const;
export const SPC_MODULE = 'Statistical Process Control';

export const CHART_TYPES = [
  'Individuals Chart',
  'Moving Range Chart',
  'X-Bar Chart',
  'R Chart',
  'X-Bar R Chart',
  'Run Chart',
] as const;

export const DATA_SOURCES = [
  'CPP Results',
  'CQA Results',
  'Yield Monitoring',
  'Stability Monitoring',
  'Utility Monitoring',
  'Environmental Monitoring',
  'Hold Time Monitoring',
] as const;

export const PARAMETER_TYPES = [
  'CPP',
  'CQA',
  'Yield',
  'Stability',
  'Utility',
  'Environmental',
  'Hold Time',
] as const;

export const SPC_STATUSES = [
  'In Control',
  'Out Of Control',
  'Warning',
  'Insufficient Data',
] as const;

export const WORKFLOW_STATUSES = [
  'Draft',
  'Generated',
  'Under Review',
  'Approved',
  'Rejected',
  'Archived',
] as const;

export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const;
export const VIOLATION_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const requiredText = z.string().trim().min(1, 'Required');

export const spcFormSchema = z.object({
  cpvProductId: requiredText,
  productName: requiredText,
  productCode: requiredText,
  chartType: z.enum(CHART_TYPES),
  dataSource: z.enum(DATA_SOURCES),
  parameterType: z.enum(PARAMETER_TYPES),
  parameterCode: requiredText,
  parameterName: requiredText,
  reviewPeriodFrom: requiredText,
  reviewPeriodTo: requiredText,
  subgroupSize: z.coerce.number().int().min(2).max(10).default(4),
  conclusion: z.string().trim().default(''),
  recommendation: z.string().trim().default(''),
  remarks: z.string().trim().default(''),
}).refine((d) => {
  const from = new Date(d.reviewPeriodFrom);
  const to = new Date(d.reviewPeriodTo);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > from;
}, { message: 'Review period end must be after start', path: ['reviewPeriodTo'] });

export type SpcFormData = z.infer<typeof spcFormSchema>;

export interface SpcSourcePoint {
  batchNumber: string;
  value: number;
  date: string;
  lsl?: number;
  usl?: number;
  target?: number;
}

export interface SpcChartPoint {
  index: number;
  label: string;
  batchNumber: string;
  date: string;
  value: number;
  movingRange: number;
  centerLine: number;
  ucl: number;
  lcl: number;
  outOfControl: boolean;
  violated: boolean;
}

export interface SpcRuleViolationRecord {
  violationId: string;
  spcRecordId: string;
  product: string;
  batchNumber: string;
  parameter: string;
  violationType: string;
  dataPointValue: number;
  dataPointDate: string;
  ruleDescription: string;
  severity: typeof VIOLATION_SEVERITIES[number];
  actionRequired: boolean;
}

export interface SpcRecord extends SpcFormData, Record<string, unknown> {
  id: string;
  spcRecordId: string;
  batchCount: number;
  dataPointsCount: number;
  centerLine: number;
  upperControlLimit: number;
  lowerControlLimit: number;
  upperSpecificationLimit: number;
  lowerSpecificationLimit: number;
  movingRangeAverage: number;
  averageRange: number;
  standardDeviation: number;
  spcStatus: typeof SPC_STATUSES[number];
  ruleViolationsCount: number;
  outOfControlPoints: number;
  riskLevel: typeof RISK_LEVELS[number];
  capaSuggested: boolean;
  generatedBy: string;
  generatedDate: string;
  reviewedBy: string;
  reviewDate: string;
  status: typeof WORKFLOW_STATUSES[number];
  linkedRiskId: string;
  isLocked: boolean;
  chartData: SpcChartPoint[];
  movingRangeData: SpcChartPoint[];
  xbarChartData: SpcChartPoint[];
  rChartData: SpcChartPoint[];
  violations: SpcRuleViolationRecord[];
  sourcePreview: SpcSourcePoint[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  createdByName?: string;
  updatedByName?: string;
  isDeleted: boolean;
}

export interface SpcSummary {
  total: number;
  inControl: number;
  outOfControl: number;
  warning: number;
  insufficient: number;
  ruleViolations: number;
  highRisk: number;
  criticalRisk: number;
  capaSuggested: number;
}

export interface SpcCalculationResult {
  batchCount: number;
  dataPointsCount: number;
  centerLine: number;
  upperControlLimit: number;
  lowerControlLimit: number;
  upperSpecificationLimit: number;
  lowerSpecificationLimit: number;
  movingRangeAverage: number;
  averageRange: number;
  standardDeviation: number;
  spcStatus: typeof SPC_STATUSES[number];
  ruleViolationsCount: number;
  outOfControlPoints: number;
  riskLevel: typeof RISK_LEVELS[number];
  capaSuggested: boolean;
  chartData: SpcChartPoint[];
  movingRangeData: SpcChartPoint[];
  xbarChartData: SpcChartPoint[];
  rChartData: SpcChartPoint[];
  violations: SpcRuleViolationRecord[];
}

function round(n: number, d = 3): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** d) / 10 ** d;
}

export function buildSpcRecordId(productCode: string, parameterCode: string): string {
  const year = new Date().getFullYear();
  return `SPC-${productCode}-${parameterCode}-${year}`.replace(/\s+/g, '-').toUpperCase().slice(0, 80);
}

export function buildViolationId(index: number): string {
  return `SPCV-${Date.now()}-${index}`.slice(0, 40);
}

export function dataSourceForParameterType(type: typeof PARAMETER_TYPES[number]): typeof DATA_SOURCES[number] {
  const map: Record<string, typeof DATA_SOURCES[number]> = {
    CPP: 'CPP Results',
    CQA: 'CQA Results',
    Yield: 'Yield Monitoring',
    Stability: 'Stability Monitoring',
    Utility: 'Utility Monitoring',
    Environmental: 'Environmental Monitoring',
    'Hold Time': 'Hold Time Monitoring',
  };
  return map[type];
}

export function parameterTypeForDataSource(source: typeof DATA_SOURCES[number]): typeof PARAMETER_TYPES[number] {
  const map: Record<string, typeof PARAMETER_TYPES[number]> = {
    'CPP Results': 'CPP',
    'CQA Results': 'CQA',
    'Yield Monitoring': 'Yield',
    'Stability Monitoring': 'Stability',
    'Utility Monitoring': 'Utility',
    'Environmental Monitoring': 'Environmental',
    'Hold Time Monitoring': 'Hold Time',
  };
  return map[source];
}

function isCriticalParameter(name: string): boolean {
  const critical = ['Sterility', 'Assay', 'Bacterial Endotoxin', 'Fill Volume', 'pH'];
  return critical.some((p) => name.toLowerCase().includes(p.toLowerCase()));
}

function toObservations(
  points: SpcSourcePoint[],
  productName: string,
  parameterName: string,
): SpcObservation[] {
  return points.map((p) => ({
    id: `${p.batchNumber}-${p.date}`,
    source: 'cpp' as const,
    product: productName,
    batch: p.batchNumber,
    date: p.date,
    parameter: parameterName,
    value: p.value,
    lsl: p.lsl,
    usl: p.usl,
    unit: '',
  }));
}

export function canCreateSpcForDataSource(
  role: string | undefined,
  dataSource: typeof DATA_SOURCES[number],
): boolean {
  if (!role) return false;
  if (['super_admin', 'admin'].includes(role)) return true;
  const qcSources: typeof DATA_SOURCES[number][] = [
    'CQA Results', 'Stability Monitoring',
  ];
  const productionSources: typeof DATA_SOURCES[number][] = [
    'CPP Results', 'Yield Monitoring', 'Hold Time Monitoring',
  ];
  const engineeringSources: typeof DATA_SOURCES[number][] = [
    'Utility Monitoring', 'Environmental Monitoring',
  ];
  if (['qc', 'qc_manager'].includes(role) && qcSources.includes(dataSource)) return true;
  if (['production', 'production_manager'].includes(role) && productionSources.includes(dataSource)) return true;
  if (['engineering', 'engineering_manager'].includes(role) && engineeringSources.includes(dataSource)) return true;
  return false;
}

function detectExtendedRules(
  values: number[],
  batches: string[],
  dates: string[],
  limits: { centerLine: number; ucl: number; lcl: number },
): SpcRuleViolation[] {
  const violations: SpcRuleViolation[] = [];
  const cl = limits.centerLine;
  const span = limits.ucl - limits.lcl;

  for (let i = 2; i < values.length && span > 0; i++) {
    const window = values.slice(i - 2, i + 1);
    const nearUpper = window.filter((v) => (limits.ucl - v) / span < 0.15).length;
    const nearLower = window.filter((v) => (v - limits.lcl) / span < 0.15).length;
    if (nearUpper >= 2 || nearLower >= 2) {
      violations.push({
        rule: 7,
        ruleName: '2 of 3 near control limit',
        description: 'Two of three consecutive points near upper or lower control limit',
        pointIndex: i + 1,
        batch: batches[i] || `Point ${i + 1}`,
        chart: 'individuals',
      });
    }
  }

  for (let i = 5; i < values.length; i++) {
    const window = values.slice(i - 5, i + 1);
    let inc = true;
    let dec = true;
    for (let j = 1; j < window.length; j++) {
      if (window[j] <= window[j - 1]) inc = false;
      if (window[j] >= window[j - 1]) dec = false;
    }
    if (inc || dec) {
      violations.push({
        rule: 5,
        ruleName: '6 consecutive trend',
        description: 'Six consecutive points increasing or decreasing',
        pointIndex: i + 1,
        batch: batches[i] || `Point ${i + 1}`,
        chart: 'individuals',
      });
    }
  }

  for (let i = 6; i < values.length; i++) {
    const window = values.slice(i - 6, i + 1);
    const allAbove = window.every((v) => v > cl);
    const allBelow = window.every((v) => v < cl);
    if (allAbove || allBelow) {
      violations.push({
        rule: 6,
        ruleName: '7 consecutive same side',
        description: 'Seven consecutive points above or below center line',
        pointIndex: i + 1,
        batch: batches[i] || `Point ${i + 1}`,
        chart: 'individuals',
      });
    }
  }

  return violations;
}

function mapChartPoints(
  result: SpcChartResult,
  dates: string[],
): SpcChartPoint[] {
  return result.points.map((p, idx) => ({
    index: p.index,
    label: p.batch,
    batchNumber: p.batch,
    date: dates[idx] || '',
    value: p.value,
    movingRange: p.movingRange,
    centerLine: result.limits.centerLine,
    ucl: result.limits.ucl,
    lcl: result.limits.lcl,
    outOfControl: p.outOfControl,
    violated: p.specialCause,
  }));
}

function violationSeverity(
  violation: SpcRuleViolation,
  ooc: boolean,
  critical: boolean,
): typeof VIOLATION_SEVERITIES[number] {
  if (ooc && critical) return 'Critical';
  if (ooc || violation.rule === 1) return 'High';
  if (violation.rule <= 3) return 'Medium';
  return 'Low';
}

function mapViolations(
  allViolations: SpcRuleViolation[],
  points: SpcChartPoint[],
  dates: string[],
  product: string,
  parameter: string,
  spcRecordId: string,
): SpcRuleViolationRecord[] {
  const seen = new Set<string>();
  const records: SpcRuleViolationRecord[] = [];
  allViolations.forEach((v, i) => {
    const key = `${v.chart}-${v.pointIndex}-${v.rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    const point = points.find((p) => p.index === v.pointIndex);
    const ooc = point?.outOfControl ?? false;
    const critical = isCriticalParameter(parameter);
    records.push({
      violationId: buildViolationId(i),
      spcRecordId,
      product,
      batchNumber: v.batch,
      parameter,
      violationType: v.ruleName,
      dataPointValue: point?.value ?? 0,
      dataPointDate: dates[v.pointIndex - 1] || '',
      ruleDescription: v.description,
      severity: violationSeverity(v, ooc, critical),
      actionRequired: ooc || v.rule <= 2,
    });
  });
  return records;
}

function evaluateSpcRisk(
  status: typeof SPC_STATUSES[number],
  parameterName: string,
): typeof RISK_LEVELS[number] {
  const critical = isCriticalParameter(parameterName);
  if (status === 'Out Of Control') return critical ? 'Critical' : 'High';
  if (status === 'Warning') return 'Medium';
  return 'Low';
}

export function calculateSpcAnalysis(
  points: SpcSourcePoint[],
  form: Pick<SpcFormData, 'productName' | 'parameterName' | 'subgroupSize'>,
  spcRecordId = 'preview',
): SpcCalculationResult {
  const sorted = points
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const values = sorted.map((p) => p.value);
  const batches = sorted.map((p) => p.batchNumber);
  const dates = sorted.map((p) => p.date);
  const batchCount = new Set(batches).size;
  const lslPoint = sorted.find((p) => Number.isFinite(p.lsl));
  const uslPoint = sorted.find((p) => Number.isFinite(p.usl));
  const lsl = lslPoint?.lsl ?? 0;
  const usl = uslPoint?.usl ?? 0;

  const empty: SpcCalculationResult = {
    batchCount,
    dataPointsCount: values.length,
    centerLine: 0,
    upperControlLimit: 0,
    lowerControlLimit: 0,
    upperSpecificationLimit: Number.isFinite(usl) ? usl : 0,
    lowerSpecificationLimit: Number.isFinite(lsl) ? lsl : 0,
    movingRangeAverage: 0,
    averageRange: 0,
    standardDeviation: 0,
    spcStatus: 'Insufficient Data',
    ruleViolationsCount: 0,
    outOfControlPoints: 0,
    riskLevel: 'Low',
    capaSuggested: false,
    chartData: [],
    movingRangeData: [],
    xbarChartData: [],
    rChartData: [],
    violations: [],
  };

  if (values.length < 5) return empty;

  const observations = toObservations(sorted, form.productName, form.parameterName);
  const analysis = runSpcAnalysis(observations, form.subgroupSize || 4);

  const individuals = analysis.individuals;
  const mrValues = values.slice(1).map((v, i) => Math.abs(v - values[i]));
  const mrBar = mrValues.length ? mrValues.reduce((s, v) => s + v, 0) / mrValues.length : 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;

  if (mrBar > 0) {
    individuals.limits = {
      centerLine: round(mean),
      ucl: round(mean + 2.66 * mrBar),
      lcl: round(mean - 2.66 * mrBar),
    };
  } else {
    individuals.limits = {
      centerLine: round(mean),
      ucl: round(mean),
      lcl: round(mean),
    };
  }

  const extended = detectExtendedRules(values, batches, dates, individuals.limits);
  const allViolations = [...individuals.violations, ...extended];
  individuals.violations = allViolations;

  const chartData = mapChartPoints(individuals, dates);
  const movingRangeData = mapChartPoints(analysis.movingRange, dates.slice(1));
  const xbarChartData = mapChartPoints(analysis.xbar, []);
  const rChartData = mapChartPoints(analysis.rChart, []);

  chartData.forEach((p) => {
    const v = values[p.index - 1];
    if (v != null) {
      p.outOfControl = v > individuals.limits.ucl || v < individuals.limits.lcl;
      p.violated = p.outOfControl || allViolations.some((vi) => vi.pointIndex === p.index);
    }
  });

  const outOfControlPoints = chartData.filter((p) => p.outOfControl).length;
  const violations = mapViolations(
    [...allViolations, ...analysis.movingRange.violations, ...analysis.xbar.violations, ...analysis.rChart.violations],
    chartData,
    dates,
    form.productName,
    form.parameterName,
    spcRecordId,
  );

  const hasCritical = violations.some((v) => v.severity === 'Critical' || v.severity === 'High');
  let spcStatus: typeof SPC_STATUSES[number] = 'In Control';
  if (outOfControlPoints > 0) spcStatus = 'Out Of Control';
  else if (violations.length > 0) spcStatus = 'Warning';

  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  const capaSuggested = outOfControlPoints > 0 || violations.filter((v) => v.severity === 'Critical').length > 0;

  return {
    batchCount,
    dataPointsCount: values.length,
    centerLine: individuals.limits.centerLine,
    upperControlLimit: individuals.limits.ucl,
    lowerControlLimit: individuals.limits.lcl,
    upperSpecificationLimit: usl,
    lowerSpecificationLimit: lsl,
    movingRangeAverage: round(mrBar),
    averageRange: round(analysis.rChart.limits.centerLine),
    standardDeviation: round(sd),
    spcStatus,
    ruleViolationsCount: violations.length,
    outOfControlPoints,
    riskLevel: evaluateSpcRisk(spcStatus, form.parameterName),
    capaSuggested,
    chartData,
    movingRangeData,
    xbarChartData,
    rChartData,
    violations,
  };
}

export function summarizeSpcRecords(records: SpcRecord[]): SpcSummary {
  return {
    total: records.length,
    inControl: records.filter((r) => r.spcStatus === 'In Control').length,
    outOfControl: records.filter((r) => r.spcStatus === 'Out Of Control').length,
    warning: records.filter((r) => r.spcStatus === 'Warning').length,
    insufficient: records.filter((r) => r.spcStatus === 'Insufficient Data').length,
    ruleViolations: records.reduce((s, r) => s + r.ruleViolationsCount, 0),
    highRisk: records.filter((r) => r.riskLevel === 'High').length,
    criticalRisk: records.filter((r) => r.riskLevel === 'Critical').length,
    capaSuggested: records.filter((r) => r.capaSuggested).length,
  };
}

export function buildSpcCharts(records: SpcRecord[]) {
  const statusMap = new Map<string, number>();
  records.forEach((r) => statusMap.set(r.spcStatus, (statusMap.get(r.spcStatus) || 0) + 1));
  const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

  const riskMap = new Map<string, number>();
  records.forEach((r) => riskMap.set(r.riskLevel, (riskMap.get(r.riskLevel) || 0) + 1));
  const riskDistribution = Array.from(riskMap.entries()).map(([level, count]) => ({ level, count }));

  const byMonth = new Map<string, number>();
  records.forEach((r) => {
    const key = (r.generatedDate || r.createdAt).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) || 0) + r.ruleViolationsCount);
  });
  const violationTrend = Array.from(byMonth.entries())
    .map(([month, count]) => ({ month, violations: count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const paramMap = new Map<string, { ok: number; issues: number }>();
  records.forEach((r) => {
    const e = paramMap.get(r.parameterName) || { ok: 0, issues: 0 };
    if (r.spcStatus === 'In Control') e.ok += 1;
    else e.issues += 1;
    paramMap.set(r.parameterName, e);
  });
  const parameterHealth = Array.from(paramMap.entries()).map(([parameter, v]) => ({
    parameter,
    ok: v.ok,
    issues: v.issues,
  }));

  const productMap = new Map<string, { ok: number; issues: number }>();
  records.forEach((r) => {
    const e = productMap.get(r.productName) || { ok: 0, issues: 0 };
    if (r.spcStatus === 'In Control') e.ok += 1;
    else e.issues += 1;
    productMap.set(r.productName, e);
  });
  const productHealth = Array.from(productMap.entries()).map(([product, v]) => ({
    product,
    ok: v.ok,
    issues: v.issues,
  }));

  return { statusDistribution, riskDistribution, violationTrend, parameterHealth, productHealth };
}
