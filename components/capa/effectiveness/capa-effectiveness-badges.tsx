'use client';

import { cn } from '@/lib/utils';
import {
  effectivenessResultColor,
  effectivenessStatusColor,
  effectivenessStatusLabel,
} from '@/lib/capa-effectiveness-records';

export function CapaEffectivenessStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', effectivenessStatusColor(status))}>
      {effectivenessStatusLabel(status)}
    </span>
  );
}

export function CapaEffectivenessResultBadge({ result }: { result?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', effectivenessResultColor(result))}>
      {result || 'Pending Review'}
    </span>
  );
}

export function CapaEffectivenessScoreBadge({ score }: { score?: number }) {
  const value = score ?? 0;
  const color = value >= 75 ? 'bg-green-100 text-green-800' : value >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums', color)}>
      {value}/100
    </span>
  );
}
