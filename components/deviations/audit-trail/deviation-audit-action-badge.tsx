'use client';

import { cn } from '@/lib/utils';
import { actionTypeColor } from '@/lib/deviation-audit-trail-records';

export function DeviationAuditActionBadge({ action }: { action: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', actionTypeColor(action))}>
      {action}
    </span>
  );
}
