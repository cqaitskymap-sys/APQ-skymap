'use client';

import { impactStatusColor } from '@/lib/complaint-impact-records';
import { cn } from '@/lib/utils';

export function ComplaintImpactStatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Not Started';
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', impactStatusColor(label))}>
      {label}
    </span>
  );
}
