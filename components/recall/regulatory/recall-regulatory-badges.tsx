'use client';

import { cn } from '@/lib/utils';

const NOTIFICATION_COLORS: Record<string, string> = {
  'Not Required': 'bg-slate-100 text-slate-700',
  Pending: 'bg-amber-100 text-amber-800',
  Submitted: 'bg-blue-100 text-blue-800',
  Acknowledged: 'bg-indigo-100 text-indigo-800',
  'Response Received': 'bg-green-100 text-green-800',
  'Follow Up Required': 'bg-purple-100 text-purple-800',
  Closed: 'bg-slate-200 text-slate-800',
  Overdue: 'bg-red-100 text-red-800 animate-pulse',
};

const APPROVAL_COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  'Under QA Review': 'bg-amber-100 text-amber-800',
  'Regulatory Review': 'bg-blue-100 text-blue-800',
  'Head QA Approval': 'bg-indigo-100 text-indigo-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Closed: 'bg-slate-200 text-slate-800',
};

export function RegulatoryNotificationStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', NOTIFICATION_COLORS[status] || NOTIFICATION_COLORS.Pending)}>
      {status}
    </span>
  );
}

export function RegulatoryApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', APPROVAL_COLORS[status] || APPROVAL_COLORS.Draft)}>
      {status}
    </span>
  );
}
