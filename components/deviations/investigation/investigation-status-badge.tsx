'use client';

import { cn } from '@/lib/utils';
import { investigationStatusColor } from '@/lib/deviation-investigation-records';

export function InvestigationStatusBadge({ status }: { status?: string }) {
  const label = status || 'Not Started';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', investigationStatusColor(label))}>
      {label}
    </span>
  );
}
