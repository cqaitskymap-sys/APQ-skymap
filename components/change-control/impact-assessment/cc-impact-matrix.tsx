'use client';

import { buildImpactMatrix } from '@/lib/cc-impact-records';
import { impactRatingColor } from '@/lib/cc-impact-records';
import type { ChangeImpactAssessment } from '@/lib/change-control-types';
import { CC_IMPACT_LIKELIHOODS, CC_IMPACT_SEVERITIES } from '@/lib/change-control-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const LEVEL_HEX: Record<string, string> = {
  Low: '#22c55e', Medium: '#f59e0b', High: '#f97316', Critical: '#ef4444',
};

export function CcImpactMatrix({ assessments }: { assessments: ChangeImpactAssessment[] }) {
  const matrix = buildImpactMatrix(assessments);
  const severities = [...CC_IMPACT_SEVERITIES].reverse();
  const likelihoods = [...CC_IMPACT_LIKELIHOODS];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-center text-xs">
        <thead>
          <tr>
            <th className="border bg-slate-50 p-2 font-medium text-muted-foreground">Severity ↓ / Likelihood →</th>
            {likelihoods.map((l) => (
              <th key={l} className="border bg-slate-50 p-2 font-medium">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {severities.map((s) => (
            <tr key={s}>
              <td className="border bg-slate-50 p-2 font-medium">{s}</td>
              {likelihoods.map((l) => {
                const cell = matrix.find((c) => c.severity === s && c.likelihood === l);
                const rating = cell?.rating || 'Low';
                return (
                  <td
                    key={l}
                    className={cn('border p-2', cell?.count ? 'font-semibold' : 'text-muted-foreground')}
                    style={{ backgroundColor: cell?.count ? `${LEVEL_HEX[rating] || '#94a3b8'}22` : undefined }}
                  >
                    <div className="tabular-nums">{cell?.count || 0}</div>
                    {cell?.count ? (
                      <Badge variant="outline" className={cn('mt-0.5 text-[9px]', impactRatingColor(rating))}>{rating}</Badge>
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
