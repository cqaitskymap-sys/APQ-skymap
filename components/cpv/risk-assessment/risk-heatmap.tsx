'use client';

import { Fragment } from 'react';
import type { RiskLevel } from '@/lib/cpv';
import { riskLevelColor, type RiskHeatCell } from '@/lib/cpv-risk-assessment-records';
import { cn } from '@/lib/utils';

export function RiskHeatMap({ heatMap }: { heatMap: RiskHeatCell[] }) {
  const severities = [5, 4, 3, 2, 1];
  const occurrences = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[480px] gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
        <div />
        {occurrences.map((o) => (
          <div key={o} className="py-1 text-center text-xs font-medium text-muted-foreground">O={o}</div>
        ))}
        {severities.map((s) => (
          <Fragment key={s}>
            <div className="flex items-center pr-2 text-xs font-medium text-muted-foreground">S={s}</div>
            {occurrences.map((o) => {
              const cell = heatMap.find((c) => c.severity === s && c.occurrence === o);
              const level = cell?.level || 'Low';
              const opacity = cell?.count ? 0.25 + (cell.intensity * 0.75) : 0.05;
              return (
                <div
                  key={`${s}-${o}`}
                  className={cn(
                    'flex min-h-[52px] flex-col items-center justify-center rounded-md border p-2 text-center',
                    cell?.count && 'ring-1 ring-inset',
                  )}
                  style={{
                    backgroundColor: `${riskLevelColor(level as RiskLevel)}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                    borderColor: cell?.count ? riskLevelColor(level as RiskLevel) : undefined,
                  }}
                  title={cell?.count ? `${cell.count} risk(s), max RPN ${cell.maxRpn}` : 'No risks'}
                >
                  <span className="text-lg font-bold tabular-nums">{cell?.count || ''}</span>
                  {cell?.count ? (
                    <span className="text-[10px] font-medium" style={{ color: riskLevelColor(level as RiskLevel) }}>{level}</span>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {(['Low', 'Medium', 'High', 'Critical'] as const).map((level) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: riskLevelColor(level) }} />
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
