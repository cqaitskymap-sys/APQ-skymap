'use client';

import { cn } from '@/lib/utils';
import { actionTypeColor } from '@/lib/complaint-audit-trail-records';

export function ComplaintAuditActionBadge({ action }: { action: string }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', actionTypeColor(action))}>
      {action}
    </span>
  );
}
