'use client';

import { cn } from '@/lib/utils';
import { mitigationStatusColor, riskLevelColor } from '@/lib/risk-mitigation-records';

export function MitigationStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', mitigationStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function RiskLevelBadge({ level }: { level?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', riskLevelColor(level))}>
      {level || '—'}
    </span>
  );
}

export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">Overdue</span>;
}
