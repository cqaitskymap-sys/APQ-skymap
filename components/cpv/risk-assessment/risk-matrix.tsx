'use client';

import type { RiskLevel } from '@/lib/cpv';
import { riskLevelColor, type RiskMatrixCell } from '@/lib/cpv-risk-assessment-records';
import { Badge } from '@/components/ui/badge';

export function RiskMatrix({ matrix }: { matrix: RiskMatrixCell[] }) {
  const severities = [5, 4, 3, 2, 1];
  const occurrences = [1, 2, 3, 4, 5];
  const hasData = matrix?.some((c) => c.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed bg-slate-50 text-sm text-muted-foreground">
        No risk data to display on risk matrix
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-center text-sm">
        <thead>
          <tr>
            <th className="border bg-slate-50 p-2 text-xs font-medium text-muted-foreground">Severity ↓ / Occurrence →</th>
            {occurrences.map((o) => (
              <th key={o} className="border bg-slate-50 p-2 text-xs font-medium">{o}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {severities.map((s) => (
            <tr key={s}>
              <td className="border bg-slate-50 p-2 font-medium">{s}</td>
              {occurrences.map((o) => {
                const cell = matrix.find((c) => c.severity === s && c.occurrence === o);
                const level = cell?.level || 'Low';
                return (
                  <td
                    key={o}
                    className="border p-2 transition-colors"
                    style={{ backgroundColor: cell?.count ? `${riskLevelColor(level as RiskLevel)}22` : undefined }}
                  >
                    <div className="font-bold tabular-nums">{cell?.count || 0}</div>
                    {cell?.count ? (
                      <>
                        <div className="text-[10px] text-muted-foreground">max RPN {cell.maxRpn}</div>
                        <Badge variant="outline" className="mt-1 text-[10px]">{level}</Badge>
                      </>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">{level}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
