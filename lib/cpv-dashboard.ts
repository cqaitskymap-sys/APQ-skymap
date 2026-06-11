import { calculateCapability, type CppRecord, type CqaRecord, type RiskRecord, type CpvStatus } from './cpv';

export interface CpvDashboardFilters {
  product?: string;
  year?: string;
  month?: string;
  quarter?: string;
}

type DatedRecord = {
  productName?: string;
  batchNo?: string;
  manufacturingDate?: string;
  createdAt?: string;
  status?: CpvStatus | string;
};

function getRecordDate(record: DatedRecord): Date | null {
  const raw = record.manufacturingDate || record.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function matchesQuarter(month: number, quarter: string): boolean {
  const q = parseInt(quarter.replace(/\D/g, ''), 10);
  if (!q || q < 1 || q > 4) return true;
  const start = (q - 1) * 3 + 1;
  return month >= start && month <= start + 2;
}

export function filterCpvRecords<T extends DatedRecord>(records: T[], filters: CpvDashboardFilters): T[] {
  return records.filter((record) => {
    if (filters.product && filters.product !== 'all' && record.productName !== filters.product) return false;
    const date = getRecordDate(record);
    if (!date && (filters.year || filters.month || filters.quarter)) return false;
    if (date) {
      if (filters.year && filters.year !== 'all' && String(date.getFullYear()) !== filters.year) return false;
      if (filters.month && filters.month !== 'all' && String(date.getMonth() + 1).padStart(2, '0') !== filters.month) return false;
      if (filters.quarter && filters.quarter !== 'all' && !matchesQuarter(date.getMonth() + 1, filters.quarter)) return false;
    }
    return true;
  });
}

export function filterRiskRecords(records: RiskRecord[], filters: CpvDashboardFilters): RiskRecord[] {
  return records.filter((record) => {
    if (filters.product && filters.product !== 'all' && record.productName !== filters.product) return false;
    const date = getRecordDate(record);
    if (date) {
      if (filters.year && filters.year !== 'all' && String(date.getFullYear()) !== filters.year) return false;
      if (filters.month && filters.month !== 'all' && String(date.getMonth() + 1).padStart(2, '0') !== filters.month) return false;
      if (filters.quarter && filters.quarter !== 'all' && !matchesQuarter(date.getMonth() + 1, filters.quarter)) return false;
    }
    return true;
  });
}

export function uniqueProducts(cpp: CppRecord[], cqa: CqaRecord[]): string[] {
  const set = new Set<string>();
  cpp.forEach((r) => r.productName && set.add(r.productName));
  cqa.forEach((r) => r.productName && set.add(r.productName));
  return Array.from(set).sort();
}

export function uniqueBatches(cpp: CppRecord[], cqa: CqaRecord[], batches: Record<string, unknown>[]): number {
  const set = new Set<string>();
  cpp.forEach((r) => r.batchNo && set.add(r.batchNo));
  cqa.forEach((r) => r.batchNo && set.add(r.batchNo));
  batches.forEach((b) => {
    const bn = String(b.batch_number || b.batchNo || b.batchNumber || '');
    if (bn) set.add(bn);
  });
  return set.size;
}

export function countByStatus(records: Array<{ status?: string }>) {
  return {
    complies: records.filter((r) => r.status === 'Complies').length,
    oot: records.filter((r) => r.status === 'OOT').length,
    oos: records.filter((r) => r.status === 'OOS').length,
  };
}

export function computeCapabilityAverages(cpp: CppRecord[], cqa: CqaRecord[]) {
  const grouped = new Map<string, number[]>();
  const limits = new Map<string, { lsl: number; usl: number }>();

  const add = (key: string, value: number, lsl: number, usl: number) => {
    grouped.set(key, [...(grouped.get(key) || []), value]);
    limits.set(key, { lsl, usl });
  };

  cpp.forEach((r) => add(`${r.productName}|${r.parameterName}`, r.observedValue, r.lsl, r.usl));
  cqa.forEach((r) => add(`${r.productName}|${r.testParameter}`, r.observedValue, r.lsl, r.usl));

  const results = Array.from(grouped.entries())
    .filter(([, values]) => values.length >= 2)
    .map(([key, values]) => {
      const { lsl, usl } = limits.get(key)!;
      return calculateCapability(values, lsl, usl);
    });

  const avg = (field: 'cpk' | 'ppk') =>
    results.length ? results.reduce((s, r) => s + r[field], 0) / results.length : 0;

  return { averageCpk: avg('cpk'), averagePpk: avg('ppk'), capabilityCount: results.length };
}

export function monthlyTrend(records: DatedRecord[]) {
  const map = new Map<string, number>();
  records.forEach((r) => {
    const d = getRecordDate(r);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function complianceTrend(records: DatedRecord[]) {
  const map = new Map<string, { total: number; complies: number }>();
  records.forEach((r) => {
    const d = getRecordDate(r);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map.get(key) || { total: 0, complies: 0 };
    entry.total += 1;
    if (r.status === 'Complies') entry.complies += 1;
    map.set(key, entry);
  });
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, rate: v.total ? Math.round((v.complies / v.total) * 100) : 0, total: v.total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function riskTrend(records: RiskRecord[]) {
  const map = new Map<string, { count: number; totalRpn: number }>();
  records.forEach((r) => {
    const d = getRecordDate(r);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map.get(key) || { count: 0, totalRpn: 0 };
    entry.count += 1;
    entry.totalRpn += r.rpn || 0;
    map.set(key, entry);
  });
  return Array.from(map.entries())
    .map(([month, v]) => ({ month, count: v.count, avgRpn: v.count ? Math.round(v.totalRpn / v.count) : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function productCompliance(cpp: CppRecord[], cqa: CqaRecord[]) {
  const map = new Map<string, { total: number; complies: number }>();
  [...cpp, ...cqa].forEach((r) => {
    const entry = map.get(r.productName) || { total: 0, complies: 0 };
    entry.total += 1;
    if (r.status === 'Complies') entry.complies += 1;
    map.set(r.productName, entry);
  });
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, rate: v.total ? Math.round((v.complies / v.total) * 100) : 0, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

export function openRiskCount(risks: RiskRecord[]): number {
  return risks.filter((r) => ['High', 'Critical', 'Medium'].includes(r.riskLevel)).length;
}

export interface OotOosAlert {
  id?: string;
  type: 'CPP' | 'CQA';
  productName: string;
  batchNo: string;
  parameter: string;
  status: string;
  observedValue: number;
  unit: string;
  date: string;
}

export function buildOotOosAlerts(cpp: CppRecord[], cqa: CqaRecord[]): OotOosAlert[] {
  const alerts: OotOosAlert[] = [];
  cpp.filter((r) => r.status === 'OOT' || r.status === 'OOS').forEach((r) => {
    alerts.push({
      id: r.id, type: 'CPP', productName: r.productName, batchNo: r.batchNo,
      parameter: r.parameterName, status: r.status, observedValue: r.observedValue,
      unit: r.unit, date: r.manufacturingDate || r.createdAt || '',
    });
  });
  cqa.filter((r) => r.status === 'OOT' || r.status === 'OOS').forEach((r) => {
    alerts.push({
      id: r.id, type: 'CQA', productName: r.productName, batchNo: r.batchNo,
      parameter: r.testParameter, status: r.status, observedValue: r.observedValue,
      unit: r.unit, date: r.createdAt || '',
    });
  });
  return alerts.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
}

export interface CpvActivity {
  id?: string;
  timestamp: string;
  action: string;
  module: string;
  actorName: string;
  recordId: string;
}

export function mapAuditToActivities(audit: Record<string, unknown>[]): CpvActivity[] {
  return audit.map((a) => ({
    id: a.id as string,
    timestamp: String(a.timestamp || a.createdAt || ''),
    action: String(a.action || ''),
    module: String(a.module || ''),
    actorName: String(a.actorName || 'System'),
    recordId: String(a.recordId || ''),
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 25);
}

export function availableYears(records: DatedRecord[]): string[] {
  const years = new Set<string>();
  records.forEach((r) => {
    const d = getRecordDate(r);
    if (d) years.add(String(d.getFullYear()));
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}
