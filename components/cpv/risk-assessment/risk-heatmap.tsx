'use client';

import { Fragment } from 'react';
import type { RiskLevel } from '@/lib/cpv';
import { riskLevelColor, type RiskHeatCell } from '@/lib/cpv-risk-assessment-records';

const ZONE_COLORS: Record<string, string> = {
  Low: '#16a34a',
  Medium: '#eab308',
  High: '#f97316',
  Critical: '#dc2626',
};

export function RiskHeatMap({ heatMap }: { heatMap: RiskHeatCell[] }) {
  const severities = [5, 4, 3, 2, 1];
  const occurrences = [1, 2, 3, 4, 5];
  const hasData = heatMap?.some((c) => c.count > 0);

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed bg-slate-50 text-sm text-muted-foreground">
        No risk data to display on heat map (Severity vs Occurrence)
      </div>
    );
  }

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
              const color = ZONE_COLORS[level] || riskLevelColor(level as RiskLevel);
              const opacity = cell?.count ? 0.35 + (cell.intensity * 0.65) : 0.06;
              return (
                <div
                  key={`${s}-${o}`}
                  className="flex min-h-[52px] flex-col items-center justify-center rounded-md border p-2 text-center"
                  style={{
                    backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                    borderColor: cell?.count ? color : '#e2e8f0',
                  }}
                  title={cell?.count ? `${cell.count} risk(s), max RPN ${cell.maxRpn}` : 'No risks'}
                >
                  <span className="text-lg font-bold tabular-nums text-slate-800">{cell?.count || ''}</span>
                  {cell?.count ? (
                    <span className="text-[10px] font-medium" style={{ color }}>{level}</span>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: ZONE_COLORS.Low }} />Green — Low</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: ZONE_COLORS.Medium }} />Yellow — Medium</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: ZONE_COLORS.High }} />Orange — High</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ backgroundColor: ZONE_COLORS.Critical }} />Red — Critical</span>
      </div>
    </div>
  );
}
