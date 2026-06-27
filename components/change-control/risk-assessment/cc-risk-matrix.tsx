'use client';

import { buildRiskMatrix } from '@/lib/cc-risk-records';
import { ccRiskLevelColor } from '@/lib/cc-risk-records';
import type { ChangeRiskAssessment } from '@/lib/change-control-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function CcRiskMatrix({ rows }: { rows: ChangeRiskAssessment[] }) {
  const matrix = buildRiskMatrix(rows);
  const severities = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const occurrences = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-center text-xs">
        <thead>
          <tr>
            <th className="border bg-slate-50 p-2 font-medium text-muted-foreground">S ↓ / O →</th>
            {occurrences.map((o) => (
              <th key={o} className="border bg-slate-50 p-1.5 font-medium">{o}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {severities.map((s) => (
            <tr key={s}>
              <td className="border bg-slate-50 p-1.5 font-medium">{s}</td>
              {occurrences.map((o) => {
                const cell = matrix.find((c) => c.severity === s && c.occurrence === o);
                const level = cell?.level || 'Low';
                return (
                  <td
                    key={o}
                    className={cn('border p-1.5 transition-colors', cell?.count ? 'font-semibold' : 'text-muted-foreground')}
                    style={{ backgroundColor: cell?.count ? `${LEVEL_HEX[level] || '#94a3b8'}22` : undefined }}
                  >
                    <div className="tabular-nums">{cell?.count || 0}</div>
                    {cell?.count ? (
                      <Badge variant="outline" className={cn('mt-0.5 text-[9px] px-1', ccRiskLevelColor(level))}>
                        {level}
                      </Badge>
                    ) : null}
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

const LEVEL_HEX: Record<string, string> = {
  Low: '#22c55e',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444',
};
