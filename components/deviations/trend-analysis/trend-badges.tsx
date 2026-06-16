'use client';

import { cn } from '@/lib/utils';
import { trendStatusColor, riskLevelColor } from '@/lib/deviation-trend-records';

export function TrendStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', trendStatusColor(status))}>
      {status}
    </span>
  );
}

export function TrendRiskBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', riskLevelColor(level))}>
      {level}
    </span>
  );
}
