'use client';

import { cn } from '@/lib/utils';
import { riskLevelColor, trendStatusColor } from '@/lib/recall-trend-records';

export function RecallTrendStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium border', trendStatusColor(status || ''))}>
      {status || 'Insufficient Data'}
    </span>
  );
}

export function RecallTrendRiskBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', riskLevelColor(level || 'Low'))}>
      {level || 'Low'}
    </span>
  );
}
