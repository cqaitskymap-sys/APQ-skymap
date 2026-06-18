'use client';

import { cn } from '@/lib/utils';
import { riskLevelColor, trendStatusColor } from '@/lib/capa-trend-records';

export function CapaTrendStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', trendStatusColor(status || ''))}>
      {status || 'Insufficient Data'}
    </span>
  );
}

export function CapaTrendRiskBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', riskLevelColor(level || 'Low'))}>
      {level || 'Low'}
    </span>
  );
}
