'use client';

import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700',
  Open: 'bg-blue-100 text-blue-800',
  'Under Implementation': 'bg-indigo-100 text-indigo-800',
  'Effectiveness Pending': 'bg-purple-100 text-purple-800',
  Closed: 'bg-green-100 text-green-800',
  Overdue: 'bg-red-100 text-red-800 animate-pulse',
};

export function CapaLinkStatusBadge({ status }: { status?: string | null }) {
  const label = status || 'Draft';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', COLORS[label] || COLORS.Draft)}>
      {label}
    </span>
  );
}
