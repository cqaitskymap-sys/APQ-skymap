'use client';

import { cn } from '@/lib/utils';
import { riskLevelBadgeClass, riskStatusBadgeClass } from '@/lib/risk-dashboard-records';

export function RiskBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', riskLevelBadgeClass(level))}>
      {level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', riskStatusBadgeClass(status))}>
      {status}
    </span>
  );
}
