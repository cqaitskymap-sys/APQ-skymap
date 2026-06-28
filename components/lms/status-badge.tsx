'use client';

import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300',
  Inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  Error: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300',
  Testing: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  Running: 'bg-blue-100 text-blue-800 animate-pulse',
  Completed: 'bg-green-100 text-green-800',
  Failed: 'bg-red-100 text-red-800',
  'Partial Success': 'bg-amber-100 text-amber-800',
  Cancelled: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-100 text-blue-800',
  warn: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  debug: 'bg-slate-100 text-slate-600',
};

export function LmsStatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[status] || STATUS_COLORS.Pending)}>
      {label}
    </span>
  );
}

export { LmsStatusBadge as StatusBadge };
