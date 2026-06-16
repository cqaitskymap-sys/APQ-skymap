'use client';

import { phase2StatusColor } from '@/lib/oos-phase2-records';
import { cn } from '@/lib/utils';

export function Phase2StatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Not Started';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', phase2StatusColor(label))}>
      {label}
    </span>
  );
}
