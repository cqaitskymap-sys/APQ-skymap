import type { CqaRecord } from './cpv';
import { CQA_PARAMETERS, displayCpvStatus } from './cpv';

export interface MonthlyCqaReport {
  month: string;
  year: string;
  generatedAt: string;
  total: number;
  pass: number;
  oot: number;
  oos: number;
  complianceRate: number;
  records: CqaRecord[];
  byParameter: Array<{
    name: string;
    total: number;
    pass: number;
    oot: number;
    oos: number;
    complianceRate: number;
  }>;
}

function inMonth(dateStr: string, year: string, month: string): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return String(d.getFullYear()) === year && String(d.getMonth() + 1).padStart(2, '0') === month;
}

function countStatuses(records: Array<{ status?: string }>) {
  let pass = 0;
  let oot = 0;
  let oos = 0;
  records.forEach((r) => {
    const s = displayCpvStatus(r.status || '');
    if (s === 'Pass') pass++;
    else if (s === 'OOT') oot++;
    else oos++;
  });
  return { pass, oot, oos };
}

export function buildMonthlyCqaReport(
  records: CqaRecord[],
  year: string,
  month: string,
): MonthlyCqaReport {
  const filtered = records.filter((r) =>
    inMonth(r.testDate || r.createdAt || '', year, month),
  );
  const stats = countStatuses(filtered);

  const paramMap = new Map<string, CqaRecord[]>();
  filtered.forEach((r) => {
    paramMap.set(r.testParameter, [...(paramMap.get(r.testParameter) || []), r]);
  });

  const byParameter = CQA_PARAMETERS.map((name) => {
    const recs = paramMap.get(name) || [];
    const paramStats = countStatuses(recs);
    return {
      name,
      total: recs.length,
      ...paramStats,
      complianceRate: recs.length ? Math.round((paramStats.pass / recs.length) * 100) : 0,
    };
  }).filter((p) => p.total > 0);

  return {
    month,
    year,
    generatedAt: new Date().toISOString(),
    total: filtered.length,
    ...stats,
    complianceRate: filtered.length ? Math.round((stats.pass / filtered.length) * 100) : 0,
    records: filtered,
    byParameter,
  };
}

export function cqaMonthlyTrendData(records: CqaRecord[], year: string) {
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  return months.map((month) => {
    const filtered = records.filter((r) => inMonth(r.testDate || r.createdAt || '', year, month));
    const stats = countStatuses(filtered);
    return {
      month: `${year}-${month}`,
      label: new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short' }),
      total: filtered.length,
      pass: stats.pass,
      oot: stats.oot,
      oos: stats.oos,
      complianceRate: filtered.length ? Math.round((stats.pass / filtered.length) * 100) : 0,
    };
  });
}

export function cqaParameterTrendData(
  records: CqaRecord[],
  parameter: string,
  limit = 30,
) {
  return records
    .filter((r) => r.testParameter === parameter)
    .slice(0, limit)
    .reverse()
    .map((r) => ({
      label: r.batchNo,
      observed: r.observedValue,
      target: r.target,
      lsl: r.lsl,
      usl: r.usl,
      status: displayCpvStatus(r.status),
    }));
}
