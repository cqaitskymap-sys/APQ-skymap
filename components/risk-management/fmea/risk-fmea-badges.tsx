'use client';

import { cn } from '@/lib/utils';
import { fmeaStatusColor, riskPriorityFromRpn } from '@/lib/risk-fmea-records';

export function FmeaStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', fmeaStatusColor(status))}>
      {status || 'Draft'}
    </span>
  );
}

export function RpnBadge({ rpn }: { rpn: number }) {
  const priority = riskPriorityFromRpn(rpn);
  const color = priority === 'Critical'
    ? 'bg-red-100 text-red-800'
    : priority === 'High'
      ? 'bg-orange-100 text-orange-800'
      : priority === 'Medium'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-green-100 text-green-800';
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', color)}>{priority} ({rpn})</span>;
}
