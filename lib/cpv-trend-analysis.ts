import type { CppRecord, CqaRecord, YieldRecord } from './cpv';
import { isQualitativeCqaParameter } from './cpv';

export const TREND_METRICS = [
  'Assay',
  'pH',
  'Extractable Volume',
  'Yield',
  'Fill Volume',
  'Particulate Matter',
  'Methyl Paraben',
  'Propyl Paraben',
  'Sterility',
] as const;

export type TrendMetric = (typeof TREND_METRICS)[number];

export interface TrendObservation {
  id: string;
  metric: TrendMetric;
  product: string;
  batch: string;
  date: string;
  observed: number;
  lower?: number;
  upper?: number;
  unit: string;
}

export interface TrendChartPoint extends TrendObservation {
  label: string;
  mean: number;
  trendLine: number;
  movingAverage: number;
  lowerLimit: number;
  upperLimit: number;
}

export interface TrendFilters {
  product?: string;
  batch?: string;
  year?: string;
  month?: string;
  quarter?: string;
}

const round = (value: number) => Number(value.toFixed(3));

export function safeTrendDate(value: string): Date {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function cqaMetricName(testParameter: string): TrendMetric | null {
  if (testParameter === 'Assay') return 'Assay';
  if (testParameter === 'pH') return 'pH';
  if (testParameter === 'Extractable Volume') return 'Extractable Volume';
  if (testParameter === 'Methyl Paraben') return 'Methyl Paraben';
  if (testParameter === 'Propyl Paraben') return 'Propyl Paraben';
  if (testParameter === 'Sterility') return 'Sterility';
  if (testParameter.includes('Particles') || testParameter.includes('Particulate')) return 'Particulate Matter';
  return null;
}

export function cqaToTrendObservations(records: CqaRecord[]): TrendObservation[] {
  const results: TrendObservation[] = [];

  records.forEach((record) => {
    const metric = cqaMetricName(record.testParameter);
    if (!metric) return;

    if (metric === 'Sterility') {
      results.push({
        id: record.id || `${record.batchNo}-sterility`,
        metric,
        product: record.productName,
        batch: record.batchNo,
        date: record.testDate || record.createdAt || '',
        observed: record.observedValue >= 1 ? 1 : 0,
        lower: 1,
        upper: 1,
        unit: 'Pass=1',
      });
      return;
    }

    if (isQualitativeCqaParameter(record.testParameter)) return;

    results.push({
      id: record.id || `${record.batchNo}-${record.testParameter}`,
      metric,
      product: record.productName,
      batch: record.batchNo,
      date: record.testDate || record.createdAt || '',
      observed: record.observedValue,
      lower: record.lsl,
      upper: record.usl,
      unit: record.unit,
    });
  });

  return results;
}

export function cppToTrendObservations(records: CppRecord[]): TrendObservation[] {
  return records
    .filter((record) => record.parameterName === 'Fill Volume')
    .map((record) => ({
      id: record.id || `${record.batchNo}-fill-volume`,
      metric: 'Fill Volume' as const,
      product: record.productName,
      batch: record.batchNo,
      date: record.manufacturingDate || record.createdAt || '',
      observed: record.observedValue,
      lower: record.lsl,
      upper: record.usl,
      unit: record.unit,
    }));
}

export function yieldToTrendObservations(records: YieldRecord[]): TrendObservation[] {
  return records.map((record) => ({
    id: record.id || `${record.batchNo}-yield`,
    metric: 'Yield' as const,
    product: record.productName,
    batch: record.batchNo,
    date: record.manufacturingDate || record.createdAt || '',
    observed: record.observedValue,
    lower: record.lowerLimit,
    upper: record.upperLimit,
    unit: '%',
  }));
}

export function mergeTrendObservations(
  yields: YieldRecord[],
  cpp: CppRecord[],
  cqa: CqaRecord[],
): TrendObservation[] {
  return [
    ...yieldToTrendObservations(yields),
    ...cppToTrendObservations(cpp),
    ...cqaToTrendObservations(cqa),
  ];
}

function matchesMonth(date: Date, month: string): boolean {
  if (!month || month === 'all') return true;
  const m = date.getMonth() + 1;
  const filter = parseInt(month.replace(/^0+/, '') || month, 10);
  return m === filter;
}

function matchesQuarter(date: Date, quarter: string): boolean {
  if (!quarter || quarter === 'all') return true;
  const q = parseInt(quarter.replace(/\D/g, ''), 10);
  if (!q || q < 1 || q > 4) return true;
  return Math.floor(date.getMonth() / 3) + 1 === q;
}

export function filterTrendObservations(
  observations: TrendObservation[],
  filters: TrendFilters,
): TrendObservation[] {
  return observations.filter((item) => {
    const date = safeTrendDate(item.date);
    if (filters.product && filters.product !== 'all' && item.product !== filters.product) return false;
    if (filters.batch && filters.batch !== 'all' && item.batch !== filters.batch) return false;
    if (filters.year && filters.year !== 'all' && date.getFullYear() !== Number(filters.year)) return false;
    if (!matchesMonth(date, filters.month || 'all')) return false;
    if (!matchesQuarter(date, filters.quarter || 'all')) return false;
    return true;
  });
}

export function enrichTrendSeries(records: TrendObservation[]): TrendChartPoint[] {
  if (!records.length) return [];

  const sorted = records.slice().sort(
    (a, b) => safeTrendDate(a.date).getTime() - safeTrendDate(b.date).getTime(),
  );
  const values = sorted.map((item) => item.observed);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1)
    : 0;
  const sigma = Math.sqrt(variance);
  const calculatedLower = mean - (3 * sigma);
  const calculatedUpper = mean + (3 * sigma);

  const n = values.length;
  const sumX = values.reduce((sum, _, index) => sum + index, 0);
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = values.reduce((sum, value, index) => sum + (index * value), 0);
  const sumXX = values.reduce((sum, _, index) => sum + (index * index), 0);
  const denominator = (n * sumXX) - (sumX ** 2);
  const slope = denominator ? ((n * sumXY) - (sumX * sumY)) / denominator : 0;
  const intercept = (sumY - (slope * sumX)) / n;

  return sorted.map((item, index) => {
    const window = values.slice(Math.max(0, index - 2), index + 1);
    const movingAverage = window.reduce((sum, value) => sum + value, 0) / window.length;
    return {
      ...item,
      label: item.batch,
      mean: round(mean),
      trendLine: round(intercept + (slope * index)),
      movingAverage: round(movingAverage),
      lowerLimit: round(item.lower ?? calculatedLower),
      upperLimit: round(item.upper ?? calculatedUpper),
    };
  });
}

export function buildTrendChartData(
  observations: TrendObservation[],
  filters: TrendFilters,
): Record<TrendMetric, TrendChartPoint[]> {
  const filtered = filterTrendObservations(observations, filters);
  return Object.fromEntries(
    TREND_METRICS.map((metric) => [
      metric,
      enrichTrendSeries(filtered.filter((item) => item.metric === metric)),
    ]),
  ) as Record<TrendMetric, TrendChartPoint[]>;
}

export function trendFilterOptions(observations: TrendObservation[], productFilter: string) {
  const products = Array.from(new Set(observations.map((item) => item.product))).sort();
  const batchSource = productFilter !== 'all'
    ? observations.filter((item) => item.product === productFilter)
    : observations;
  const batches = Array.from(new Set(batchSource.map((item) => item.batch))).sort();
  const years = Array.from(new Set(observations.map((item) => safeTrendDate(item.date).getFullYear())))
    .sort((a, b) => b - a);

  return { products, batches, years };
}

export function trendSummary(
  observations: TrendObservation[],
  filters: TrendFilters,
  chartData: Record<TrendMetric, TrendChartPoint[]>,
) {
  const filtered = filterTrendObservations(observations, filters);
  const activeMetrics = TREND_METRICS.filter((metric) => chartData[metric].length > 0);
  const failedSterility = filtered.filter((item) => item.metric === 'Sterility' && item.observed === 0).length;

  return {
    totalRecords: filtered.length,
    activeMetrics: activeMetrics.length,
    products: new Set(filtered.map((item) => item.product)).size,
    batches: new Set(filtered.map((item) => item.batch)).size,
    failedSterility,
    activeMetricNames: activeMetrics,
  };
}
