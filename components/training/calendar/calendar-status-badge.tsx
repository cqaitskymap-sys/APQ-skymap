'use client';

import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Scheduled: 'bg-blue-100 text-blue-800',
  Open: 'bg-green-100 text-green-800',
  'In Progress': 'bg-amber-100 text-amber-800 animate-pulse',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-800',
  Postponed: 'bg-orange-100 text-orange-800',
  Closed: 'bg-slate-100 text-slate-600',
};

export function CalendarStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[status] || STATUS_COLORS.Scheduled)}>
      {status}
    </span>
  );
}

export { CalendarStatusBadge as StatusBadge };
