'use client';

import { phase1StatusColor } from '@/lib/oos-phase1-records';
import { cn } from '@/lib/utils';

export function Phase1StatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium', phase1StatusColor(status))}>
      {status || 'Not Started'}
    </span>
  );
}
