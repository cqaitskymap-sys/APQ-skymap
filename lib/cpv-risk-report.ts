import type { RiskLevel, RiskRecord } from './cpv';
import { matrixCellLevel, riskDescriptionText, riskOccurrence } from './cpv';

export interface RiskMatrixCell {
  severity: number;
  occurrence: number;
  count: number;
  maxRpn: number;
  level: RiskLevel;
  records: RiskRecord[];
}

export interface RiskHeatCell extends RiskMatrixCell {
  intensity: number;
  label: string;
}

export interface RiskReportSummary {
  generatedAt: string;
  total: number;
  byLevel: Record<RiskLevel, number>;
  bySource: Array<{ source: string; count: number; avgRpn: number }>;
  topRisks: RiskRecord[];
  matrix: RiskMatrixCell[];
}

const LEVEL_COLORS: Record<RiskLevel, string> = {
  Low: '#059669',
  Medium: '#d97706',
  High: '#ea580c',
  Critical: '#dc2626',
};

export function riskLevelColor(level: RiskLevel): string {
  return LEVEL_COLORS[level];
}

export function filterRiskRegister(
  records: RiskRecord[],
  filters: { product?: string; source?: string; level?: string },
): RiskRecord[] {
  return records.filter((r) => {
    if (filters.product && filters.product !== 'all' && r.productName !== filters.product) return false;
    if (filters.source && filters.source !== 'all' && r.factor !== filters.source) return false;
    if (filters.level && filters.level !== 'all' && r.riskLevel !== filters.level) return false;
    return true;
  });
}

export function buildRiskMatrix(records: RiskRecord[]): RiskMatrixCell[] {
  const cells: RiskMatrixCell[] = [];
  for (let severity = 5; severity >= 1; severity--) {
    for (let occurrence = 1; occurrence <= 5; occurrence++) {
      const cellRecords = records.filter(
        (r) => r.severity === severity && riskOccurrence(r) === occurrence,
      );
      const maxRpn = cellRecords.length
        ? Math.max(...cellRecords.map((r) => r.rpn))
        : 0;
      cells.push({
        severity,
        occurrence,
        count: cellRecords.length,
        maxRpn,
        level: cellRecords.length
          ? (cellRecords.reduce((worst, r) =>
            ['Critical', 'High', 'Medium', 'Low'].indexOf(r.riskLevel) <
            ['Critical', 'High', 'Medium', 'Low'].indexOf(worst) ? r.riskLevel : worst, 'Low' as RiskLevel))
          : matrixCellLevel(severity, occurrence),
        records: cellRecords,
      });
    }
  }
  return cells;
}

export function buildRiskHeatMap(records: RiskRecord[]): RiskHeatCell[] {
  const matrix = buildRiskMatrix(records);
  const maxCount = Math.max(1, ...matrix.map((c) => c.count));
  return matrix.map((cell) => ({
    ...cell,
    intensity: cell.count / maxCount,
    label: cell.count ? `${cell.count} risk${cell.count !== 1 ? 's' : ''}` : '',
  }));
}

export function buildRiskReport(records: RiskRecord[]): RiskReportSummary {
  const byLevel: Record<RiskLevel, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  records.forEach((r) => { byLevel[r.riskLevel] += 1; });

  const sourceMap = new Map<string, { count: number; totalRpn: number }>();
  records.forEach((r) => {
    const entry = sourceMap.get(r.factor) || { count: 0, totalRpn: 0 };
    entry.count += 1;
    entry.totalRpn += r.rpn;
    sourceMap.set(r.factor, entry);
  });

  const bySource = Array.from(sourceMap.entries())
    .map(([source, v]) => ({
      source,
      count: v.count,
      avgRpn: v.count ? Math.round(v.totalRpn / v.count) : 0,
    }))
    .sort((a, b) => b.avgRpn - a.avgRpn);

  const topRisks = [...records].sort((a, b) => b.rpn - a.rpn).slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    total: records.length,
    byLevel,
    bySource,
    topRisks,
    matrix: buildRiskMatrix(records),
  };
}

export function riskFilterOptions(records: RiskRecord[]) {
  return {
    products: Array.from(new Set(records.map((r) => r.productName))).sort(),
    sources: Array.from(new Set(records.map((r) => r.factor))).sort(),
  };
}

export function displayRiskId(record: RiskRecord): string {
  return record.riskId || record.id?.slice(0, 8).toUpperCase() || '—';
}

export { riskDescriptionText, riskOccurrence };
