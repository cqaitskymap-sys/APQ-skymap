'use client';

import { cn } from '@/lib/utils';
import { effectivenessResultColor, effectivenessStatusColor } from '@/lib/cc-effectiveness-records';

export function CcEffectivenessStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', effectivenessStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function CcEffectivenessResultBadge({ result }: { result?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', effectivenessResultColor(result))}>
      {result || 'Pending Review'}
    </span>
  );
}

export function CcEffectivenessScoreBadge({ score }: { score?: number }) {
  const value = score ?? 0;
  const color = value >= 85 ? 'bg-green-100 text-green-800' : value >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', color)}>
      {value}/100
    </span>
  );
}

export function CcRiskBadge({ category }: { category?: string }) {
  const map: Record<string, string> = {
    Critical: 'bg-red-100 text-red-800',
    Major: 'bg-amber-100 text-amber-800',
    Minor: 'bg-green-100 text-green-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', map[category || ''] || 'bg-slate-100 text-slate-700')}>
      {category || '—'}
    </span>
  );
}
