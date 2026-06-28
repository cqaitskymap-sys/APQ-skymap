'use client';

import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  'Pending Approval': 'bg-amber-100 text-amber-800',
  'Under Review': 'bg-blue-100 text-blue-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  'Returned for Revision': 'bg-orange-100 text-orange-800',
  Cancelled: 'bg-slate-100 text-slate-600',
  Closed: 'bg-slate-100 text-slate-600',
  Pending: 'bg-amber-100 text-amber-800',
  Waiting: 'bg-slate-100 text-slate-500',
  Escalated: 'bg-red-100 text-red-800 animate-pulse',
};

export function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', COLORS[status] || COLORS.Draft)}>
      {status}
    </span>
  );
}

export { ApprovalStatusBadge as StatusBadge };
