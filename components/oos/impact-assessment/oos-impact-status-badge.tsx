'use client';

import { impactStatusColor } from '@/lib/oos-impact-records';
import { cn } from '@/lib/utils';

export function OosImpactStatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Draft';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', impactStatusColor(label))}>
      {label}
    </span>
  );
}
