'use client';

import { cn } from '@/lib/utils';
import { investigationStatusColor, investigationStatusLabel } from '@/lib/capa-investigation-records';

export function CapaInvestigationStatusBadge({ status }: { status?: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', investigationStatusColor(status))}>
      {investigationStatusLabel(status)}
    </span>
  );
}
