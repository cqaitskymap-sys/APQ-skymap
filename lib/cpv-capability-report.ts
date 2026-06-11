import type { CapabilityResult, CppRecord, CqaRecord } from './cpv';
import { calculateCapability, isQualitativeCqaParameter } from './cpv';

export type CapabilityDataSource = 'cpp' | 'cqa';

export interface CapabilityObservation {
  id: string;
  source: CapabilityDataSource;
  product: string;
  batch: string;
  date: string;
  parameter: string;
  value: number;
  lsl: number;
  usl: number;
  unit: string;
}

export interface CapabilityReportRow extends CapabilityResult {
  source: CapabilityDataSource;
  parameter: string;
  product: string;
  lsl: number;
  usl: number;
  unit: string;
}

export interface CapabilityReport {
  period: 'monthly' | 'yearly';
  year: number;
  month: number | null;
  source: CapabilityDataSource | 'all';
  product: string;
  generatedAt: string;
  rows: CapabilityReportRow[];
  summary: {
    total: number;
    excellent: number;
    acceptable: number;
    needsImprovement: number;
    insufficient: number;
    averageCpk: number;
    averagePpk: number;
  };
}

function getDate(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function cppToObservations(records: CppRecord[]): CapabilityObservation[] {
  return records.map((record) => ({
    id: record.id || `${record.batchNo}-${record.parameterName}`,
    source: 'cpp',
    product: record.productName,
    batch: record.batchNo,
    date: record.manufacturingDate || record.createdAt || '',
    parameter: record.parameterName,
    value: record.observedValue,
    lsl: record.lsl,
    usl: record.usl,
    unit: record.unit,
  }));
}

export function cqaToObservations(records: CqaRecord[]): CapabilityObservation[] {
  return records
    .filter((record) => !isQualitativeCqaParameter(record.testParameter))
    .filter((record) => record.lsl < record.usl)
    .map((record) => ({
      id: record.id || `${record.batchNo}-${record.testParameter}`,
      source: 'cqa',
      product: record.productName,
      batch: record.batchNo,
      date: record.testDate || record.createdAt || '',
      parameter: record.testParameter,
      value: record.observedValue,
      lsl: record.lsl,
      usl: record.usl,
      unit: record.unit,
    }));
}

export function mergeCapabilityObservations(
  cpp: CppRecord[],
  cqa: CqaRecord[],
): CapabilityObservation[] {
  return [...cppToObservations(cpp), ...cqaToObservations(cqa)];
}

export function filterObservations(
  observations: CapabilityObservation[],
  filters: {
    source?: CapabilityDataSource | 'all';
    product?: string;
    parameter?: string;
    year?: number;
    month?: number | null;
    period?: 'monthly' | 'yearly';
  },
): CapabilityObservation[] {
  return observations.filter((item) => {
    if (filters.source && filters.source !== 'all' && item.source !== filters.source) return false;
    if (filters.product && filters.product !== 'all' && item.product !== filters.product) return false;
    if (filters.parameter && filters.parameter !== 'all' && item.parameter !== filters.parameter) return false;
    if (filters.year) {
      const date = getDate(item.date);
      if (date.getFullYear() !== filters.year) return false;
      if (filters.period === 'monthly' && filters.month && date.getMonth() + 1 !== filters.month) return false;
    }
    return true;
  });
}

export function groupObservationsByParameter(
  observations: CapabilityObservation[],
): Map<string, CapabilityObservation[]> {
  const groups = new Map<string, CapabilityObservation[]>();
  observations.forEach((item) => {
    const key = `${item.source}::${item.product}::${item.parameter}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  });
  return groups;
}

export function computeCapabilityRow(
  source: CapabilityDataSource,
  product: string,
  parameter: string,
  records: CapabilityObservation[],
): CapabilityReportRow {
  const first = records[0];
  return {
    source,
    product,
    parameter,
    lsl: first.lsl,
    usl: first.usl,
    unit: first.unit,
    ...calculateCapability(records.map((r) => r.value), first.lsl, first.usl),
  };
}

export function buildCapabilityReport(
  observations: CapabilityObservation[],
  options: {
    period: 'monthly' | 'yearly';
    year: number;
    month: number | null;
    source: CapabilityDataSource | 'all';
    product: string;
  },
): CapabilityReport {
  const scoped = filterObservations(observations, {
    source: options.source,
    product: options.product,
    year: options.year,
    month: options.month,
    period: options.period,
  });

  const groups = groupObservationsByParameter(scoped);
  const rows = Array.from(groups.entries()).map(([key, records]) => {
    const [source, product, parameter] = key.split('::') as [CapabilityDataSource, string, string];
    return computeCapabilityRow(source, product, parameter, records);
  }).sort((a, b) => a.parameter.localeCompare(b.parameter));

  const valid = rows.filter((r) => r.status !== 'Insufficient Data');
  const average = (field: 'cpk' | 'ppk') =>
    valid.length ? valid.reduce((sum, row) => sum + row[field], 0) / valid.length : 0;

  return {
    period: options.period,
    year: options.year,
    month: options.month,
    source: options.source,
    product: options.product,
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      total: rows.length,
      excellent: rows.filter((r) => r.status === 'Excellent').length,
      acceptable: rows.filter((r) => r.status === 'Acceptable').length,
      needsImprovement: rows.filter((r) => r.status === 'Needs Improvement').length,
      insufficient: rows.filter((r) => r.status === 'Insufficient Data').length,
      averageCpk: Number(average('cpk').toFixed(3)),
      averagePpk: Number(average('ppk').toFixed(3)),
    },
  };
}

export function capabilityIndexChartData(result: CapabilityResult) {
  return [
    { index: 'Cp', value: result.cp, target: 1.33 },
    { index: 'Cpk', value: result.cpk, target: 1.33 },
    { index: 'CPU', value: result.cpu, target: 1.33 },
    { index: 'CPL', value: result.cpl, target: 1.33 },
    { index: 'Pp', value: result.pp, target: 1.33 },
    { index: 'Ppk', value: result.ppk, target: 1.33 },
  ];
}

export function buildHistogram(values: number[], binCount = 8) {
  if (!values.length) return [];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const bins = Math.min(binCount, Math.max(5, Math.ceil(Math.sqrt(values.length))));
  const width = (maximum - minimum) / bins || 1;
  return Array.from({ length: bins }, (_, index) => {
    const start = minimum + (index * width);
    const end = index === bins - 1 ? maximum + Number.EPSILON : start + width;
    return {
      range: `${start.toFixed(2)}–${(end - Number.EPSILON).toFixed(2)}`,
      count: values.filter((value) => value >= start && value < end).length,
    };
  });
}

export function parameterCpkComparison(rows: CapabilityReportRow[]) {
  return rows
    .filter((r) => r.status !== 'Insufficient Data')
    .map((r) => ({
      label: `${r.parameter} (${r.source.toUpperCase()})`,
      cpk: r.cpk,
      ppk: r.ppk,
      status: r.status,
    }));
}
