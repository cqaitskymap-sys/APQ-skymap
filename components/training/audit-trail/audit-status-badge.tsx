'use client';

import { cn } from '@/lib/utils';
import { actionTypeColor } from '@/lib/training-audit-trail-records';

export function AuditStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Success: 'bg-green-100 text-green-800',
    Failed: 'bg-red-100 text-red-800',
    Pending: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', colors[status] || colors.Success)}>
      {status}
    </span>
  );
}

export function AuditActionBadge({ action }: { action: string }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', actionTypeColor(action))}>
      {action}
    </span>
  );
}

export { AuditStatusBadge as StatusBadge };
