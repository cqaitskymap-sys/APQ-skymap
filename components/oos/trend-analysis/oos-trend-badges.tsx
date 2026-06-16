'use client';

import { cn } from '@/lib/utils';
import { oosTrendRiskColor, oosTrendStatusColor } from '@/lib/oos-trend-records';

export function OosTrendStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', oosTrendStatusColor(status))}>
      {status}
    </span>
  );
}

export function OosTrendRiskBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', oosTrendRiskColor(level))}>
      {level}
    </span>
  );
}
