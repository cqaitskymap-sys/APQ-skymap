'use client';

import { cn } from '@/lib/utils';
import { complaintTrendRiskColor, complaintTrendStatusColor } from '@/lib/complaint-trend-records';

export function ComplaintTrendStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', complaintTrendStatusColor(status))}>
      {status}
    </span>
  );
}

export function ComplaintTrendRiskBadge({ level }: { level: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', complaintTrendRiskColor(level))}>
      {level}
    </span>
  );
}
