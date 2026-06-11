import type { CppRecord, YieldRecord, UtilityRecord } from './cpv';
import { displayCpvStatus } from './cpv';

export interface MonthlyCppReport {
  month: string;
  year: string;
  generatedAt: string;
  yield: {
    total: number; pass: number; oot: number; oos: number;
    records: YieldRecord[];
  };
  process: {
    total: number; pass: number; oot: number; oos: number;
    records: CppRecord[];
    byParameter: { name: string; total: number; pass: number; oot: number; oos: number }[];
  };
  utility: {
    total: number; pass: number; oot: number; oos: number;
    records: UtilityRecord[];
  };
}

function inMonth(dateStr: string, year: string, month: string): boolean {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return String(d.getFullYear()) === year && String(d.getMonth() + 1).padStart(2, '0') === month;
}

function countStatuses(records: Array<{ status?: string }>) {
  let pass = 0; let oot = 0; let oos = 0;
  records.forEach((r) => {
    const s = displayCpvStatus(r.status || '');
    if (s === 'Pass') pass++;
    else if (s === 'OOT') oot++;
    else oos++;
  });
  return { pass, oot, oos };
}

export function buildMonthlyCppReport(
  yields: YieldRecord[],
  process: CppRecord[],
  utilities: UtilityRecord[],
  year: string,
  month: string,
): MonthlyCppReport {
  const filterDate = (r: { manufacturingDate?: string; createdAt?: string }) =>
    inMonth(r.manufacturingDate || r.createdAt || '', year, month);

  const yieldRecords = yields.filter(filterDate);
  const processRecords = process.filter(filterDate);
  const utilityRecords = utilities.filter(filterDate);

  const yieldStats = countStatuses(yieldRecords);
  const processStats = countStatuses(processRecords);
  const utilityStats = countStatuses(utilityRecords);

  const paramMap = new Map<string, CppRecord[]>();
  processRecords.forEach((r) => {
    paramMap.set(r.parameterName, [...(paramMap.get(r.parameterName) || []), r]);
  });

  const byParameter = Array.from(paramMap.entries()).map(([name, recs]) => ({
    name,
    total: recs.length,
    ...countStatuses(recs),
  }));

  return {
    month,
    year,
    generatedAt: new Date().toISOString(),
    yield: { total: yieldRecords.length, ...yieldStats, records: yieldRecords },
    process: { total: processRecords.length, ...processStats, records: processRecords, byParameter },
    utility: { total: utilityRecords.length, ...utilityStats, records: utilityRecords },
  };
}

export function monthlyTrendData(
  records: Array<{ manufacturingDate?: string; createdAt?: string; status?: string }>,
  year: string,
) {
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  return months.map((month) => {
    const filtered = records.filter((r) => inMonth(r.manufacturingDate || r.createdAt || '', year, month));
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
