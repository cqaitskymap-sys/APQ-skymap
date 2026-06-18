'use client';

import { cn } from '@/lib/utils';
import { isFollowUpOverdue } from '@/lib/recall-types';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-700',
  'Partially Recovered': 'bg-amber-100 text-amber-800',
  Recovered: 'bg-green-100 text-green-800',
  'Not Recoverable': 'bg-gray-100 text-gray-700',
  Closed: 'bg-blue-100 text-blue-800',
};

export function RecoveryStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[status] || STATUS_COLORS.Pending)}>
      {status}
    </span>
  );
}

export function NotificationBadge({ sent }: { sent?: boolean }) {
  return sent
    ? <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">Notified</span>
    : <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">Pending</span>;
}

export function FollowUpBadge({ required, date }: { required?: boolean; date?: string | null }) {
  if (!required) return <span className="text-xs text-muted-foreground">—</span>;
  const overdue = isFollowUpOverdue(date);
  return (
    <span className={cn(
      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
      overdue ? 'bg-red-100 text-red-800' : 'bg-purple-100 text-purple-800',
    )}>
      {overdue ? 'Overdue' : date || 'Scheduled'}
    </span>
  );
}

export function RecoveryProgressBar({ percent, className }: { percent: number; className?: string }) {
  const value = Math.min(100, Math.max(0, percent));
  const color = value >= 100 ? 'bg-green-600' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Recovery progress</span>
        <span className="font-medium tabular-nums">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
